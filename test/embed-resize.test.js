const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const parentCode = fs.readFileSync(require.resolve('../assets/embed-resize.js'), 'utf8');
const childCode = fs.readFileSync(require.resolve('../assets/embed-content.js'), 'utf8');

function hostHarness() {
  const messages = [], events = {}, documentEvents = {}, observers = [];
  const frames = [];
  function frame(src, marked = true) {
    const attributes = { src, height: '700' };
    const f = { style: {}, writes: 0, matches: () => marked,
      getAttribute: key => attributes[key] ?? null,
      setAttribute(key, value) { this.writes++; attributes[key] = value; },
      contentWindow: { postMessage(data, origin) { messages.push({ frame: f, data, origin }); } } };
    frames.push(f); return f;
  }
  const context = {
    URL, Symbol,
    window: { addEventListener(name, listener) { (events[name] ||= []).push(listener); } },
    document: { currentScript: { src: 'https://route25.app/assets/embed-resize.js' }, baseURI: 'https://collector.example/about', documentElement: {},
      querySelectorAll: () => frames, addEventListener(name, listener) { documentEvents[name] = listener; } },
    MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} }
  };
  const run = () => vm.runInNewContext(parentCode, context);
  const receive = (f, height, extra = {}) => events.message.forEach(fn => fn({ origin: 'https://route25.app', source: f.contentWindow, data: { type: 'route25:embed:resize', version: 1, height }, ...extra }));
  return { frame, frames, messages, events, documentEvents, observers, context, run, receive };
}

test('resizing accepts only finite bounded heights from the matching trusted widget', () => {
  const h = hostHarness();
  const a = h.frame('https://route25.app/embed/collection/a?token=secret');
  const b = h.frame('https://route25.app/embed/trainer/b');
  const foreign = h.frame('https://other.example/embed/trainer/a');
  const nonWidget = h.frame('https://route25.app/login');
  const unmarked = h.frame('https://route25.app/embed/trainer/c', false);
  h.run();
  assert.equal(h.messages.length, 2);
  assert.equal(h.messages[0].origin, 'https://route25.app');
  for (const height of [NaN, Infinity, -1, 0, 12001, '1000', null, {}]) h.receive(a, height);
  h.receive(a, 1000, { origin: 'https://route25.app.evil.example' });
  h.receive(a, 1000, { origin: 'null' });
  h.receive(a, 1000, { source: {} });
  h.receive(a, 1000, { data: { type: 'route25:embed:resize', version: 2, height: 1000 } });
  for (const f of [foreign, nonWidget, unmarked]) h.receive(f, 1000);
  assert.equal(a.writes, 0);
  assert.equal(b.writes, 0);
  h.receive(a, 1100.25);
  assert.equal(a.getAttribute('height'), '1101');
  assert.equal(a.style.height, '1101px');
  assert.equal(b.getAttribute('height'), '700');
  h.receive(a, 1100.25);
  assert.equal(a.writes, 1, 'unchanged dimensions must not cause a resize loop');
  h.receive(a, 520);
  assert.equal(a.style.height, '520px', 'must shrink after width/content changes');
  h.receive(b, 280);
  assert.equal(b.style.height, '280px');
});

test('late scripts, duplicate snippets, iframe reloads and dynamic insertion are supported', () => {
  const h = hostHarness();
  const a = h.frame('https://route25.app/embed/collection/a');
  h.run(); h.run();
  assert.equal(h.events.message.length, 1);
  assert.equal(h.observers.length, 1);
  assert.equal(h.messages.length, 1, 'request measurement if child loaded before host script');
  h.documentEvents.load({ target: a });
  assert.equal(h.messages.length, 2);
  const b = h.frame('https://route25.app/embed/trainer/b');
  h.observers[0]([{ addedNodes: [b] }]);
  assert.equal(h.messages.at(-1).frame, b);
  assert.equal(h.messages.at(-1).data.type, 'route25:embed:measure');
  h.receive(b, 280);
  assert.equal(b.style.height, '280px');
});

function childHarness() {
  const reports = [], callbacks = [], events = {}, documentEvents = {};
  let height = 1000, observer;
  const parent = { postMessage(data, origin) { reports.push({ data, origin }); } };
  const widget = { getBoundingClientRect: () => ({ height }) };
  const context = { window: { parent, addEventListener(name, fn) { events[name] = fn; } },
    document: { querySelector: () => widget, addEventListener(name, fn) { documentEvents[name] = fn; } },
    ResizeObserver: class { constructor(fn) { observer = fn; } observe(target) { assert.equal(target, widget); } },
    requestAnimationFrame: fn => callbacks.push(fn) };
  vm.runInNewContext(childCode, context);
  return { reports, events, documentEvents, parent, setHeight: value => { height = value; }, resize: () => observer(), flush: () => { while (callbacks.length) callbacks.shift()(); } };
}

test('widget reports content height, follows layout changes, and sends no collection information', () => {
  const h = childHarness(); h.flush();
  assert.equal(h.reports.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.reports[0])), { data: { type: 'route25:embed:resize', version: 1, height: 1000 }, origin: '*' });
  h.resize(); h.documentEvents.load(); h.events.resize(); h.flush();
  assert.equal(h.reports.length, 1, 'unchanged height is suppressed');
  h.setHeight(1400.1); h.resize(); h.flush();
  assert.equal(h.reports.at(-1).data.height, 1401);
  h.setHeight(260); h.resize(); h.flush();
  assert.equal(h.reports.at(-1).data.height, 260, 'measure article instead of iframe viewport');
  h.events.message({ source: {}, data: { type: 'route25:embed:measure', version: 1 } }); h.flush();
  assert.equal(h.reports.length, 3);
  h.events.message({ source: h.parent, data: { type: 'route25:embed:measure', version: 1 } }); h.flush();
  assert.equal(h.reports.length, 4, 'parent handshake recovers a lost initial report');
  h.setHeight(0); h.resize(); h.flush();
  assert.equal(h.reports.length, 4, 'hidden preview does not collapse the iframe');
});
