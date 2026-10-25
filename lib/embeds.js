const { route25BackendOrigin, route25BackendHeaders } = require('./route25-backend');
const SITE = 'https://route25.app';
const EMBED_CSP = "default-src 'none'; style-src 'self'; img-src 'self' data: https://palettetown-backend.vercel.app https://route25.app https://images.scrydex.com https://images.pokemontcg.io https://assets.tcgdex.net https://tcgplayer-cdn.tcgplayer.com https://static.tcgcollector.com https://firebasestorage.googleapis.com https://storage.googleapis.com; frame-ancestors http: https:; base-uri 'none'; form-action 'none'; object-src 'none'";
const PUBLIC_PROFILE_FIELDS = ['displayName', 'avatarSprite', 'trainer.level', 'ownedCardCount', 'completedTradeCount', 'followers'];
const IMAGE_HOSTS = new Set(['route25.app', 'palettetown-backend.vercel.app', 'images.scrydex.com', 'images.pokemontcg.io', 'assets.tcgdex.net', 'tcgplayer-cdn.tcgplayer.com', 'static.tcgcollector.com', 'firebasestorage.googleapis.com', 'storage.googleapis.com']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const number = value => count(value).toLocaleString('en-US');
function safeImage(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && IMAGE_HOSTS.has(url.hostname) ? url.href : ''; } catch { return ''; }
}
function options(query = {}) {
  const kind = query.kind, id = query.id;
  if (!['trainer', 'collection'].includes(kind) || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const token = typeof query.token === 'string' ? query.token : '';
  if (kind === 'collection' && !/^[A-Za-z0-9_-]{24,128}$/.test(token)) return null;
  return { kind, id, token: kind === 'collection' ? token : '', theme: ['light', 'dark'].includes(query.theme) ? query.theme : 'auto', showValue: query.value !== '0' };
}
function publicTrainer(id, raw = {}) {
  const sprite = typeof raw.avatarSprite === 'string' && /^(trainer|trainerBig)[A-Za-z0-9_-]*$/.test(raw.avatarSprite) ? raw.avatarSprite : '';
  return { id, displayName: typeof raw.displayName === 'string' ? raw.displayName.slice(0, 150) : 'Route 25 Trainer',
    avatarURL: sprite ? `https://palettetown-backend.vercel.app/trainer-avatars/${sprite}.png` : '',
    level: count(raw.trainer?.level), ownedCardCount: count(raw.ownedCardCount), completedTradeCount: count(raw.completedTradeCount),
    followers: Array.isArray(raw.followers) ? raw.followers.length : 0 };
}
async function loadTrainer(id) {
  // Only the fields already displayed on public in-app trainer profiles are read.
  // Do not read account/contact data, collection share tokens, or valuations here.
  const admin = require('firebase-admin');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    admin.initializeApp({ credential: raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault() });
  }
  const db = process.env.FIRESTORE_DATABASE_ID ? getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID) : getFirestore(admin.app());
  const [doc] = await db.getAll(db.collection('users').doc(id), { fieldMask: PUBLIC_PROFILE_FIELDS });
  return doc.exists ? publicTrainer(id, doc.data()) : null;
}
async function loadCollection(opts) {
  // The backend checks the share token against the owner. Never discover a token
  // from a trainer ID or forward the embedding visitor's cookies/credentials.
  const url = new URL(`/collection/${encodeURIComponent(opts.id)}`, route25BackendOrigin());
  url.searchParams.set('token', opts.token);
  url.searchParams.set('format', 'json');
  const response = await fetch(url, { headers: route25BackendHeaders(url), redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Collection unavailable');
  const payload = await response.json();
  if (!payload.ok || payload.collection?.trainerId !== opts.id || !payload.owner) throw new Error('Invalid collection response');
  return payload;
}
function shell(title, body, theme = 'auto') {
  return `<!doctype html><html lang="en" data-theme="${esc(theme)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link rel="stylesheet" href="/assets/embeds.css"></head><body class="widget-body">${body}</body></html>`;
}
function avatar(owner) {
  const src = safeImage(owner.avatarURL);
  return `<div class="widget-avatar">${src ? `<img src="${esc(src)}" alt="" width="56" height="56">` : esc(String(owner.displayName || 'R').slice(0,1).toUpperCase())}</div>`;
}
function brand() { return `<a class="widget-brand" href="${SITE}" target="_blank" rel="noopener noreferrer"><img src="/apple-touch-icon.png" width="24" height="24" alt="">Route 25 <span aria-hidden="true">↗</span></a>`; }
function stat(value, label) { return `<div class="widget-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`; }
function renderTrainer(trainer, opts) {
  const url = `${SITE}/trainer/${encodeURIComponent(opts.id)}`;
  return shell(`${trainer.displayName} · Route 25`, `<article class="widget profile-widget"><header class="widget-top">${brand()}<span class="widget-kind">Trainer profile</span></header><div class="widget-identity">${avatar(trainer)}<div><h1>${esc(trainer.displayName)}</h1><p>${trainer.level ? `Level ${number(trainer.level)} trainer` : 'Pokémon card collector'}</p></div></div><section class="widget-stats" aria-label="Trainer statistics">${stat(number(trainer.ownedCardCount),'Cards collected')}${stat(number(trainer.followers),'Followers')}${stat(number(trainer.completedTradeCount),'Completed trades')}</section><footer class="widget-footer"><span>A little piece of my collecting world.</span><a class="widget-link" href="${url}" target="_blank" rel="noopener noreferrer">View profile <span aria-hidden="true">↗</span></a></footer></article>`, opts.theme);
}
function renderCollection(payload, opts) {
  const {owner, collection} = payload;
  const url = new URL(`/collection/${encodeURIComponent(opts.id)}`, SITE); url.searchParams.set('token', opts.token);
  const cards = (Array.isArray(payload.cards) ? payload.cards : []).slice().sort((a,b) => (Number(b.sortPrice)||0)-(Number(a.sortPrice)||0) || String(a.id).localeCompare(String(b.id))).slice(0,12);
  const rawValue = collection.value?.totalValue;
  const value = typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0 ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(rawValue) : '—';
  const grid = cards.map(card => {
    const src = safeImage(card.images?.small || card.images?.large);
    const name = String(card.name || card.id || 'Pokémon card');
    return `<a class="widget-card" href="${SITE}/cards/${encodeURIComponent(String(card.id))}" target="_blank" rel="noopener noreferrer">${src ? `<img src="${esc(src)}" alt="${esc(name)}" width="245" height="342" loading="lazy" decoding="async">` : '<div class="widget-placeholder" aria-hidden="true"></div>'}<span>${esc(name)}</span>${count(card.quantity)>1 ? `<small>×${number(card.quantity)}</small>` : ''}</a>`;
  }).join('');
  return shell(`${owner.displayName}'s collection · Route 25`, `<article class="widget collection-widget"><header class="widget-top">${brand()}<span class="widget-kind">Collection</span></header><div class="widget-identity">${avatar(owner)}<div><h1>${esc(owner.displayName)}’s collection</h1></div></div><section class="widget-stats" aria-label="Collection statistics">${stat(number(collection.cardCount),'Unique cards')}${stat(number(collection.totalOwnedCopies),'Owned copies')}${opts.showValue ? stat(value,'Estimated value') : ''}</section>${grid ? `<section class="widget-grid" aria-label="Collection highlights">${grid}</section>` : '<p class="widget-empty">No cards in this collection yet.</p>'}<footer class="widget-footer"><span>${cards.length < count(collection.cardCount) ? `Showing ${cards.length} of ${number(collection.cardCount)} cards` : 'Your collection, at a glance'}</span><a class="widget-link" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">View full collection <span aria-hidden="true">↗</span></a></footer></article>`, opts.theme);
}
function renderError(message, theme) { return shell('Route 25 embed', `<article class="widget">${brand()}<h1 class="widget-error-title">${esc(message)}</h1><p class="widget-empty">Check the original share link or try again in a moment.</p></article>`,theme); }
module.exports = { EMBED_CSP, PUBLIC_PROFILE_FIELDS, options, publicTrainer, loadTrainer, loadCollection, renderTrainer, renderCollection, renderError, safeImage };
