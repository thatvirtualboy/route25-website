const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createHandler } = require('../api/giveaways');
const { rules, loadGiveaways } = require('../lib/giveaway-pages');
const { createLocalServer } = require('../scripts/local-server');
const config = require('../vercel.json');
const fs = require('node:fs');
const path = require('node:path');
const id = '11111111-1111-4111-8111-111111111111';
const fixture = (extra = {}) => ({ id, title: 'A card for your collection', description: 'A synthetic test prize.', prizes: [{ name: 'Test card', quantity: 2, imageUrl: 'https://images.pokemontcg.io/test.png' }], heroImageUrl: '', startsAt: 1795000000000, endsAt: 1795100000000, drawAt: 1795200000000, publishedAt: 1794900000000, claimDays: 7, countries: ['US'], minimumAge: 18, eligibility: 'open', prizeValueCents: 2500, sponsorName: 'Example sponsor', sponsorAddress: '123 Example Ave\nDenver, CO', contactEmail: 'example@example.invalid', referralBonusLimit: 3, officialRules: 'Exact published rules.\nSecond paragraph with <angle brackets> & punctuation.', rulesVersion: 'a'.repeat(64), status: 'published', phase: 'open', ...extra });
async function call(handler, query = {}, method = 'GET') {
  const headers = {}; let body;
  const res = { statusCode: 0, setHeader: (name, value) => { headers[name] = value; }, end: value => { body = value; } };
  await handler({ method, query }, res);
  return { status: res.statusCode, headers, body };
}
test('public rules are readable without JavaScript, with canonical identity and unchanged text', () => {
  const html = rules(fixture());
  assert.match(html, /Exact published rules\.\nSecond paragraph with &lt;angle brackets&gt; &amp; punctuation\./);
  assert.match(html, new RegExp(`https://route25.app/giveaways/${id}/rules`));
  for (const value of ['United States', 'Ages 18+', 'Example sponsor', '$25.00', '7 days after selection', 'No purchase or Trainer Plus required', '2 × Test card']) assert.ok(html.includes(value), value);
  assert.match(html, /<time datetime="2026-/);
  assert.match(html, /UTC/);
});
test('admin strings are escaped and unsafe artwork URLs never reach HTML', () => {
  const attack = '<script>alert("private")</script>';
  const html = rules(fixture({ title: attack, description: attack, sponsorName: attack, sponsorAddress: attack, officialRules: attack, heroImageUrl: 'javascript:alert(1)' }));
  assert.ok(!html.includes(attack)); assert.match(html, /&lt;script&gt;/); assert.ok(!html.includes('src="javascript:'));
});
test('upcoming, open, closed, cancelled, unclaimed and shipped pages keep permanent rules', () => {
  for (const phase of ['upcoming', 'open', 'closed', 'drawing', 'claim_pending', 'awarded', 'shipped', 'cancelled', 'no_winner', 'unavailable']) {
    const html = rules(fixture({ phase, status: phase === 'cancelled' ? 'cancelled' : 'published', cancellationReason: 'Weather affected the shipment.' }));
    assert.match(html, /Exact published rules/);
    assert.equal(html.includes('Enter this drawing in the Route 25 app.'), phase === 'open');
    if (phase === 'cancelled') assert.match(html, /Weather affected the shipment/);
  }
  assert.match(rules(fixture({ eligibility: 'trainer_plus', phase: 'unavailable' })), /previous eligibility policy/);
});
test('overview is a static, evergreen guide with bundled illustrative artwork', () => {
  const html = fs.readFileSync(path.join(__dirname, '../giveaways/index.html'), 'utf8');
  assert.match(html, /Having an account or Trainer Plus doesn’t enter you automatically/);
  assert.match(html, /Trainer Plus does not add entries or improve your odds/);
  assert.match(html, /create a new account and complete signup verification before entries close/);
  assert.match(html, /United States residents ages 18 and older/);
  assert.match(html, /Illustrative items. Prizes vary by giveaway/);
  assert.match(html, /permanent public rules link/);
  for (const text of ['Current &amp; upcoming', 'Past giveaways', 'data-refresh-after', '/api/giveaways', 'giveaways.js', 'cursor=']) assert.ok(!html.includes(text), text);
  const images = [...html.matchAll(/src="(\/assets\/giveaways\/[^"]+)"/g)];
  assert.equal(images.length, 3);
  for (const image of images) assert.ok(fs.existsSync(path.join(__dirname, '..', image[1])));
});
test('HTTP handler rejects malformed input and writes, preserves HEAD and distinguishes failures', async () => {
  let calls = 0;
  const handler = createHandler(async query => { calls++; return query.id ? {event: fixture()} : {events: [], activeEvents: [], nextCursor: null}; });
  assert.equal((await call(handler, { id: '../private' })).status, 404);
  assert.equal((await call(handler, { id: [id] })).status, 404);
  assert.equal((await call(handler)).status, 404);
  assert.equal((await call(handler, {}, 'POST')).status, 405);
  assert.equal(calls, 0);
  const head = await call(handler, { id }, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, undefined);
  const list = await call(handler, {id}); assert.equal(list.status, 200); assert.equal(list.headers['Cache-Control'], 'no-store');
  const missing = await call(createHandler(async () => { throw Object.assign(new Error(), { status: 404 }); }), { id }); assert.equal(missing.status, 404);
  const failed = await call(createHandler(async () => { throw new Error('SECRET'); }), {id});
  assert.equal(failed.status, 503); assert.equal(failed.headers['Retry-After'], '60'); assert.ok(!failed.body.includes('SECRET')); assert.ok(!failed.body.includes('No giveaways are open'));
});
test('upstream errors or malformed JSON cannot become successful rules pages', async () => {
  await assert.rejects(loadGiveaways({id}, async () => ({ok: false, status: 500})), e => e.status === 503);
  await assert.rejects(loadGiveaways({id}, async () => ({ok: false, status: 404})), e => e.status === 404);
  await assert.rejects(loadGiveaways({id}, async () => ({ok: true, json: async () => ({})})));
  await assert.rejects(loadGiveaways({id}, async () => ({ok: true, json: async () => ({event: {id:'other'}})})));
});
test('local and deployment paths serve the same anonymous endpoint and short-link redirect', async () => {
  const previous = process.env.ROUTE25_BACKEND_ORIGIN;
  const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.pathname, '/api/giveaways/public');
    assert.equal(req.headers.authorization, undefined);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(url.searchParams.has('id') ? {event: fixture()} : {events: [], activeEvents: [], nextCursor: null}));
  });
  const server = createLocalServer();
  try {
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    process.env.ROUTE25_BACKEND_ORIGIN = `http://127.0.0.1:${upstream.address().port}`;
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/giveaways', '/giveaways/', `/giveaways/${id}/rules`, `/giveaways/${id}/rules/`]) {
      const response = await fetch(origin + path); assert.equal(response.status, 200, path); assert.match(await response.text(), /Giveaway|giveaway|Official rules/);
    }
    const redirect = await fetch(`${origin}/giveaways/${id}`, {redirect: 'manual'}); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), `/giveaways/${id}/rules`);
    assert.equal((await fetch(`${origin}/giveaways/not-a-valid-id/rules`)).status, 404);
    assert.equal((await fetch(`${origin}/giveaways`, {method:'POST'})).status, 405);
    for (const path of ['/giveaways/:id/rules', '/giveaways/:id/rules/']) assert.ok(config.rewrites.some(rule => rule.source === path && rule.destination.startsWith('/api/giveaways.js')));
    for (const path of ['/giveaways', '/giveaways/']) assert.ok(config.rewrites.some(rule => rule.source === path && rule.destination === '/giveaways/index.html'));
    upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
    const offline = await fetch(origin + '/giveaways?cursor=ignored'); assert.equal(offline.status, 200); assert.match(await offline.text(), /How giveaways work/);
    assert.ok(config.redirects.some(rule => rule.source === '/giveaways/:id' && rule.destination === '/giveaways/:id/rules'));
  } finally {
    if (previous === undefined) delete process.env.ROUTE25_BACKEND_ORIGIN; else process.env.ROUTE25_BACKEND_ORIGIN = previous;
    server.closeAllConnections(); upstream.closeAllConnections();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
  }
});

test('entry-window refresh uses the backend clock and does not depend on the visitor clock', async () => {
  const event = fixture({phase: 'upcoming'});
  const upcoming = await call(createHandler(async () => ({event, serverTime: event.startsAt - 12000})), {id});
  assert.match(upcoming.body, /data-refresh-after="12100"/);
  const open = await call(createHandler(async () => ({event: {...event, phase: 'open'}, serverTime: event.endsAt - 5000})), {id});
  assert.match(open.body, /data-refresh-after="5100"/);
  const closed = await call(createHandler(async () => ({event: {...event, phase: 'closed'}, serverTime: event.endsAt})), {id});
  assert.ok(!closed.body.includes('data-refresh-after'));
});
