// Pocket Almanac: unofficial live viewer. No wallet, no sign-in.
import { textures } from './textures.js';
const IMG = 'https://api.pocketpad.io/img/pocket';
const META = 'https://pocketpad.io/api/pocket';
const MARKET = 'https://pocketpad.io/market';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CONTRACT = '0x3a98de41a0df554f6b69ca1b5a1ad93a745ab1f2';
const EXPLORER = 'https://robinhoodchain.blockscout.com';
const DAY = 864e5, CLOCK = 3 * DAY; // official client: diesAt = lastWateredAt + 72h
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'One of One'];
const RCOL = { Common: 'var(--r-common)', Uncommon: 'var(--r-uncommon)', Rare: 'var(--r-rare)', Epic: 'var(--r-epic)', Legendary: 'var(--r-legendary)', 'One of One': 'var(--r-oneofone)' };
const CHUNK = 72;

const VIEWS = {
  soil: { seg: 'seed', title: 'Soil', eyebrow: 'Layer I · Underground', unit: 'seeds', tagline: 'Seeds asleep in the dark earth. Each one already knows which plant it will become. Water it, and it breaks the surface.',
    sorts: [['id', 'Number'], ['rarity', 'Rarest first'], ['price', 'Price: low to high']] },
  garden: { seg: 'plant', title: 'Garden', eyebrow: 'Layer II · Above ground', unit: 'living plants', tagline: 'Plants kept alive by one tap a day. Three days without water and a plant dies, and its spirit rises.',
    sorts: [['dies', 'Dies soonest'], ['streak', 'Longest streak'], ['rarity', 'Rarest first'], ['price', 'Price: low to high'], ['id', 'Number']] },
  heaven: { seg: 'reveal', title: 'Heaven', eyebrow: 'Layer III · Above the clouds', unit: 'spirits revealed', tagline: 'Where plants go when the watering stops. Every spirit is revealed once, ranked forever, and never changes again.',
    sorts: [['rank', 'Spirit rank (rarest first)'], ['rankdesc', 'Earliest departed'], ['rarity', 'Plant rarity'], ['price', 'Price: low to high'], ['id', 'Number']] },
};

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => Number(n).toLocaleString('en-US');
const eth = (wei) => { if (wei == null) return null; const v = Number(BigInt(wei)) / 1e18; return v >= 1 ? v.toFixed(3).replace(/\.?0+$/, '') : v.toPrecision(3).replace(/\.?0+$/, ''); };
const short = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return Math.floor(s) + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };
const dur = (ms) => { if (ms <= 0) return '0h 00m'; const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3); return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`; };

let ATLAS = null;
const S = {
  traitNames: [], byId: new Map(), collection: null, stats: null, liveAt: 0, stateAt: 0, snapAt: 0,
  view: 'soil', q: '', kind: '', rarities: new Set(), listedOnly: false, sort: {}, night: false,
  list: [], open: null, px: 2,
};

// ---------- data ----------
const segOf = (p) => p.d ? 'reveal' : p.w ? 'plant' : 'seed';
function attr(p, name) { const k = S.traitNames.indexOf(name); if (k < 0 || !p.a) return undefined; const f = p.a.find((x) => x[0] === k); return f ? f[1] : undefined; }
function decorate(p) {
  p.seg = segOf(p);
  p.kind = attr(p, 'Kind') ?? attr(p, 'Grew from') ?? null;
  p.rarity = attr(p, 'Plant rarity') ?? null;
  p.diesAt = p.seg === 'plant' && p.w ? Date.parse(p.w) + CLOCK : null;
  return p;
}
function mergeState(arr) {
  for (const n of arr) { const old = S.byId.get(n.i); if (!old) continue; const a = old.a; for (const k of ['l', 'rk', 'dn', 's']) delete old[k]; Object.assign(old, n, { a }); decorate(old); }
}
async function loadSnapshot() {
  const r = await fetch('/data/snapshot.json'); const j = await r.json();
  S.traitNames = j.traitNames; S.collection = j.collection; S.stats = j.stats; S.snapAt = Date.parse(j.generatedAt); S.stateAt = S.snapAt;
  for (const p of j.pockets) S.byId.set(p.i, decorate(p));
}
async function refreshLive() {
  try {
    const r = await fetch('/api/live', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.collection = j.collection; S.stats = j.stats; S.liveAt = Date.parse(j.fetchedAt);
    const listed = new Map(j.listings.map(([id, p, at]) => [id, { p, at }]));
    for (const p of S.byId.values()) { const l = listed.get(p.i); if (l) p.l = l; else delete p.l; }
    renderHeader(); refreshList(false); setLive();
  } catch (e) { setLive(true); }
}
async function refreshState() {
  try {
    const parts = await Promise.all([0, 1, 2, 3, 4].map((i) => fetch(`/api/state?part=${i}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })));
    for (const pt of parts) mergeState(pt.pockets);
    S.stateAt = Math.min(...parts.map((p) => Date.parse(p.fetchedAt)));
    renderHeader(); refreshList(false); setLive();
  } catch (e) { /* keep snapshot */ }
}

// ---------- header ----------
function counts() {
  const c = S.collection;
  if (c && Number.isFinite(c.planted) && Number.isFinite(c.revealed) && Number.isFinite(c.finalSupply))
    return { soil: c.finalSupply - c.planted - c.revealed, garden: c.planted, heaven: c.revealed };
  const t = { soil: 0, garden: 0, heaven: 0 }; for (const p of S.byId.values()) t[p.seg === 'seed' ? 'soil' : p.seg === 'plant' ? 'garden' : 'heaven']++; return t;
}
let countAnim = 0;
function animateCount(el, to) {
  const from = Number(el.dataset.v || 0); el.dataset.v = to; if (from === to) { el.textContent = fmtN(to); return; }
  const t0 = performance.now(), id = ++countAnim;
  const step = (t) => { if (id !== countAnim) return; const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtN(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function renderHeader() {
  const v = VIEWS[S.view], c = counts();
  for (const k of Object.keys(VIEWS)) $(`[data-count=${k}]`).textContent = fmtN(c[k]);
  animateCount($('#bigCount'), c[S.view]);
  const seg = S.stats?.segments?.[v.seg];
  const items = [];
  if (seg) {
    items.push(['Listed', fmtN(seg.listed)]);
    if (seg.fromWei) items.push(['Floor', eth(seg.fromWei) + ' ETH']);
    if (seg.lastSoldWei) items.push(['Last sale', eth(seg.lastSoldWei) + ' ETH']);
  }
  if (S.view === 'heaven' && S.collection?.lastRevealAt) items.push(['Last reveal', ago(Date.parse(S.collection.lastRevealAt))]);
  if (S.view === 'garden') { const n = [...S.byId.values()].filter((p) => p.seg === 'plant' && p.diesAt && p.diesAt - Date.now() < DAY && p.diesAt > Date.now()).length; items.push(['Thirsty (<24h left)', fmtN(n)]); }
  $('#market').innerHTML = items.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('');
}
function setLive(err) {
  const el = $('#live'), t = Math.max(S.liveAt, 0);
  el.classList.toggle('stale', !!err || !S.liveAt);
  $('#liveText').innerHTML = S.liveAt ? `Live<span class="long"> · market ${ago(S.liveAt)} · pockets ${ago(S.stateAt)}</span>` : `Snapshot<span class="long"> · ${ago(S.stateAt)}</span>`;
  $('#live').title = `Market data ${S.liveAt ? ago(S.liveAt) : 'n/a'}, Pocket states ${ago(S.stateAt)}. Refreshes automatically.`;
  $('#snapInfo').textContent = `Built-in snapshot: ${new Date(S.snapAt).toUTCString()}.`;
}

// ---------- world (literal tile grid) ----------
const RANK = Object.fromEntries(RARITIES.map((r, i) => [r, i]));
const TILE = { soil: [46, 38], garden: [56, 46], heaven: [150, 112] }; // [desktop, mobile] target tile px
function inSeg() { const v = VIEWS[S.view]; return [...S.byId.values()].filter((p) => p.seg === v.seg); }
function ordered() {
  const v = VIEWS[S.view]; const s = S.sort[S.view] || v.sorts[0][0];
  const byId = (a, b) => a.i - b.i;
  const cmp = {
    id: byId,
    rarity: (a, b) => (RANK[b.rarity] ?? -1) - (RANK[a.rarity] ?? -1) || byId(a, b),
    price: (a, b) => (a.l ? 0 : 1) - (b.l ? 0 : 1) || (a.l && b.l ? Number(BigInt(a.l.p) - BigInt(b.l.p)) / 1e12 : 0) || byId(a, b),
    dies: (a, b) => (a.diesAt ?? Infinity) - (b.diesAt ?? Infinity) || byId(a, b),
    streak: (a, b) => (b.sk ?? 0) - (a.sk ?? 0) || byId(a, b),
    rank: (a, b) => (a.rk ?? Infinity) - (b.rk ?? Infinity) || byId(a, b),
    rankdesc: (a, b) => (b.rk ?? -Infinity) - (a.rk ?? -Infinity) || byId(a, b),
  }[s];
  return inSeg().sort(cmp);
}
function matches(p) {
  const q = S.q.trim().toLowerCase().replace(/^#/, '');
  if (/^\d+$/.test(q)) { if (!String(p.i).startsWith(q)) return false; }
  else if (q && !((p.kind || '').toLowerCase().includes(q) || (p.s?.name || '').toLowerCase().includes(q))) return false;
  if (S.kind && p.kind !== S.kind) return false;
  if (S.rarities.size && !S.rarities.has(p.rarity)) return false;
  if (S.listedOnly && !p.l) return false;
  return true;
}
const filtersOn = () => !!(S.q.trim() || S.kind || S.rarities.size || S.listedOnly);
function imgUrl(p, night) { return p.c ? `${IMG}/${p.i}/card/${p.c}${night ? '-night' : ''}.png` : ''; }
function spriteUrl(p, night) { return p.c ? `${IMG}/${p.i}/sprite/${p.c}${night ? '-night' : ''}.png` : ''; }
const variant = (id) => [0, 0, 1, 0, 2, 0, 3, 1, 0, 2][(Math.imul(id, 2654435761) >>> 0) % 10];
function urgency(p) { if (p.seg !== 'plant' || !p.diesAt) return 0; const left = p.diesAt - Date.now(); return left < 12 * 36e5 ? 2 : left < DAY ? 1 : 0; }
function cellFor(p) { const sg = ATLAS?.segments?.[p.seg]; const c = sg?.cells?.[p.i]; return c ? { c, sg } : null; }
function sprHTML(p) {
  const hit = cellFor(p);
  if (hit && (!S.night || hit.c[5])) {
    const [x, y, w, h, stem] = hit.c;
    if (stem !== p.c) queueSprite(p);
    return `<span class="spr" style="--x:${x};--y:${y};--w:${w};--h:${h}"><i class="px a"></i></span>`;
  }
  queueSprite(p);
  return `<span class="spr"></span>`;
}
function tileHTML(p) {
  const u = urgency(p);
  return `<button class="tile v${variant(p.i)}${p.l ? ' listed' : ''}${u ? ' u' + u : ''}" data-id="${p.i}" aria-label="Pocket ${p.i}${p.s ? ', ' + esc(p.s.name) : p.kind ? ', ' + esc(p.kind) : ''}${p.l ? ', listed ' + eth(p.l.p) + ' ETH' : ''}">${sprHTML(p)}${p.l ? '<i class="coin" aria-hidden="true"></i>' : ''}${u ? '<i class="drop" aria-hidden="true"></i>' : ''}</button>`;
}
// Sprites not in the atlas (or changed since it was built) load one by one, throttled well under
// the image host's ~240/min per-visitor limit.
const spriteQ = new Map(); let qTimer = 0;
function queueSprite(p) { spriteQ.set(p.i, spriteUrl(p, S.night)); if (!qTimer) qTimer = setInterval(pumpSprites, 400); }
function pumpSprites() {
  const it = spriteQ.entries().next(); if (it.done) { clearInterval(qTimer); qTimer = 0; return; }
  const [id, url] = it.value; spriteQ.delete(id);
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { const t = document.querySelector(`#tiles .tile[data-id="${id}"]`); if (!t || im.src !== spriteUrl(S.byId.get(id), S.night)) return;
    const s = t.querySelector('.spr'); im.className = 'px'; s.style.cssText = `--w:${im.naturalWidth};--h:${im.naturalHeight}`; im.alt = ''; s.innerHTML = ''; s.appendChild(im); };
  im.src = url;
}
function measure() {
  const w = $('#world'); const t = w.querySelector('.tile'); if (!t) return;
  const tw = t.getBoundingClientRect().width;
  const ref = S.view === 'heaven' ? 40 : 21, frac = S.view === 'heaven' ? .55 : .82;
  S.px = Math.max(1, Math.floor(tw * frac / ref * 2) / 2);
  w.style.setProperty('--px', S.px);
}
function applyTextures() {
  const t = textures(S.view, S.night), w = $('#world');
  for (const [k, v] of Object.entries(t)) w.style.setProperty('--' + k, `url(${v})`);
  const sg = ATLAS?.segments?.[VIEWS[S.view].seg];
  if (sg) { w.style.setProperty('--atlas', `url(/atlas/${S.night ? sg.night : sg.day}?v=${ATLAS.v})`); w.style.setProperty('--aw', sg.w); w.style.setProperty('--ah', sg.h); }
}
let lastSig = '';
function refreshList(animate = true) {
  const list = ordered();
  const sig = S.view + '|' + (S.night ? 1 : 0) + '|' + list.map((p) => `${p.i}:${p.c}:${p.l?.p || ''}:${urgency(p)}`).join(',');
  if (animate || sig !== lastSig) {
    lastSig = sig; S.list = list;
    const w = $('#world');
    w.className = 'world w-' + S.view;
    const mobile = innerWidth < 640; w.style.setProperty('--tile', TILE[S.view][mobile ? 1 : 0] + 'px');
    applyTextures();
    $('#tiles').innerHTML = list.map(tileHTML).join('');
    if (animate) { w.classList.remove('fade'); void w.offsetWidth; w.classList.add('fade'); }
    measure();
  }
  applyFilters(false);
}
function applyFilters(scroll = true) {
  const on = filtersOn(); let n = 0, first = null;
  const q = S.q.trim().replace(/^#/, ''); const idq = /^\d+$/.test(q);
  for (const el of $('#tiles').children) {
    const p = S.byId.get(Number(el.dataset.id)); const m = matches(p);
    el.classList.toggle('dim', on && !m); el.classList.toggle('hit', on && m && !!q);
    if (m) { n++; if (!first) first = el; }
  }
  $('#world').classList.toggle('filtering', on);
  const total = S.list.length, unit = VIEWS[S.view].unit;
  const listed = S.list.filter((p) => p.l).length;
  $('#resultline').innerHTML = on ? `<b>${fmtN(n)}</b> of ${fmtN(total)} ${unit} match · others dimmed` :
    `${fmtN(total)} ${unit}, one tile each · <span class="lg"><i class="coin"></i>${fmtN(listed)} listed</span>${S.view === 'garden' ? ' · <span class="lg"><i class="drop d1"></i>under 24h left</span> · <span class="lg"><i class="drop d2"></i>under 12h</span>' : ''}`;
  $('#empty').hidden = !on || n > 0;
  if (scroll && on && first && (idq ? n <= 30 : n <= 12)) {
    const r = first.getBoundingClientRect();
    if (r.top < 120 || r.bottom > innerHeight - 40) window.scrollTo({ top: scrollY + r.top - innerHeight / 3, behavior: 'smooth' });
  }
}
function buildControls() {
  const v = VIEWS[S.view];
  const inView = inSeg();
  const kinds = {}; inView.forEach((p) => { if (p.kind) kinds[p.kind] = (kinds[p.kind] || 0) + 1; });
  if (S.kind && !kinds[S.kind]) S.kind = '';
  $('#kind').innerHTML = `<option value="">All kinds (${Object.keys(kinds).length})</option>` + Object.keys(kinds).sort().map((k) => `<option value="${esc(k)}"${k === S.kind ? ' selected' : ''}>${esc(k)} · ${kinds[k]}</option>`).join('');
  const cur = S.sort[S.view] || v.sorts[0][0];
  $('#sort').innerHTML = v.sorts.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${l}</option>`).join('');
  const rc = {}; inView.forEach((p) => { if (p.rarity) rc[p.rarity] = (rc[p.rarity] || 0) + 1; });
  $('#rarities').innerHTML = RARITIES.filter((r) => rc[r]).map((r) => `<button class="rchip" style="--c:${RCOL[r]}" data-r="${esc(r)}" aria-pressed="${S.rarities.has(r)}"><i></i>${r} <small>${rc[r]}</small></button>`).join('');
}
// hover tooltip
function tipHTML(p) {
  const name = p.seg === 'reveal' ? (p.s?.name || '') : (p.kind || '');
  const bits = [];
  if (p.rarity) bits.push(`<span class="rdot" style="--c:${RCOL[p.rarity]}">${esc(p.rarity)}</span>`);
  if (p.seg === 'plant') { const left = p.diesAt ? p.diesAt - Date.now() : null; bits.push(`${p.sk ?? 0}-day streak`); if (left != null) bits.push(left > 0 ? `${Math.ceil(left / 36e5)}h left` : 'past clock'); }
  if (p.seg === 'reveal') { if (p.rk != null) bits.push(`Rank ${fmtN(p.rk)}`); if (p.kind) bits.push(`from ${esc(p.kind)}`); }
  return `<b>#${p.i}</b> <span class="tn">${esc(name)}</span>${p.l ? `<span class="tp">${eth(p.l.p)} ETH</span>` : ''}<div class="tb">${bits.join(' · ')}</div>`;
}

// ---------- views ----------
function setView(v, { scroll = false } = {}) {
  if (!VIEWS[v]) v = 'soil';
  const changed = v !== S.view; S.view = v;
  document.body.dataset.view = v;
  const V = VIEWS[v];
  $('#title').textContent = V.title; $('#eyebrow').textContent = V.eyebrow; $('#tagline').textContent = V.tagline; $('#bigUnit').textContent = V.unit;
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  document.querySelector('meta[name=theme-color]').content = { soil: '#1a110b', garden: '#2c6331', heaven: '#c7cdfb' }[v];
  if (changed) { S.rarities.clear(); }
  buildControls(); renderHeader(); refreshList(true);
  if (scroll && changed) window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Meme Maker (#meme, #/meme or #/meme/<id>) lives in meme.js, loaded on first visit.
let memeOn = false;
function setMeme(on, id) {
  memeOn = on; $('#meme').hidden = !on; document.body.classList.toggle('meme-on', on);
  if (!on) return;
  closeDetail(true);
  document.body.dataset.view = 'meme';
  $('#title').textContent = 'Meme Maker'; $('#eyebrow').textContent = 'Layer ∞ · The group chat'; $('#tagline').textContent = 'Turn any Pocket into a meme. Real stats, a lot of jokes, zero sign-in. Pick a number or roll the dice.';
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === 'meme')));
  document.querySelector('meta[name=theme-color]').content = '#2a1433';
  import('./meme.js').then((m) => m.openMeme({ byId: () => S.byId, traitNames: () => S.traitNames, atlas: () => ATLAS, stats: () => S.stats, stateAt: () => S.stateAt, decorate, night: () => S.night }, id));
}
function route() {
  const mm = location.hash.match(/^#\/?meme(?:\/(\d+))?/);
  if (mm) { setMeme(true, mm[1] ? Number(mm[1]) : null); return; }
  if (memeOn) { setMeme(false); document.body.dataset.view = S.view; setView(S.view); }
  const [, v, id] = (location.hash.match(/^#\/(\w+)(?:\/(\d+))?/) || []);
  const p = id ? S.byId.get(Number(id)) : null;
  const view = p ? ({ seed: 'soil', plant: 'garden', reveal: 'heaven' }[p.seg]) : (VIEWS[v] ? v : 'soil');
  if (view !== S.view || !S.list.length) setView(view);
  if (p && v !== view) history.replaceState(null, '', `#/${view}/${p.i}`);
  if (p) openDetail(p.i); else closeDetail(true);
}

// ---------- detail ----------
let tick = 0;
async function rpcOwner(id) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CONTRACT, data: '0x6352211e' + id.toString(16).padStart(64, '0') }, 'latest'] }) });
  const j = await r.json(); return j.result && j.result.length >= 66 ? '0x' + j.result.slice(-40) : null;
}
function openDetail(id) {
  const p = S.byId.get(id); if (!p) return;
  S.open = id;
  const d = $('#drawer'), sc = $('#scrim');
  d.hidden = false; sc.hidden = false; requestAnimationFrame(() => { d.classList.add('on'); sc.classList.add('on'); });
  document.body.style.overflow = 'hidden';
  renderDetail(p, null, null, null);
  d.scrollTop = 0; $('#dClose').focus({ preventScroll: true });
  const want = id;
  Promise.allSettled([
    fetch(`/api/pocket?id=${id}`).then((r) => r.ok ? r.json() : null),
    fetch(`${META}/${id}`).then((r) => r.ok ? r.json() : null),
    rpcOwner(id),
  ]).then(([live, meta, owner]) => {
    if (S.open !== want) return;
    const L = live.value || null;
    if (L?.pocket) { const a = p.a; for (const k of ['l', 'rk', 'dn', 's']) delete p[k]; Object.assign(p, L.pocket, { a }); decorate(p); }
    renderDetail(p, meta.value || null, owner.status === 'fulfilled' ? owner.value : null, L?.traits || null, true);
  });
}
function closeDetail(fromRoute) {
  if (S.open == null) return; S.open = null;
  const d = $('#drawer'), sc = $('#scrim');
  d.classList.remove('on'); sc.classList.remove('on'); document.body.style.overflow = '';
  setTimeout(() => { if (S.open == null) { d.hidden = true; sc.hidden = true; } }, 450);
  if (!fromRoute) history.replaceState(null, '', `#/${S.view}`);
}
function renderDetail(p, meta, chainOwner, shares, loaded) {
  const night = S.night;
  const rcol = RCOL[p.rarity] || 'var(--r-common)';
  const stage = { seed: 'Seed', plant: 'Plant', reveal: 'Spirit' }[p.seg];
  const attrs = meta?.attributes || (p.a || []).map(([k, v]) => ({ trait_type: S.traitNames[k], value: v }));
  const shareOf = (t, v) => shares?.find((s) => s.trait === t && String(s.value) === String(v))?.share;
  const hide = new Set(['Stage', 'Spirit rank', 'Tier', 'Day', 'Streak']);
  const traitsHTML = attrs.filter((a) => !hide.has(a.trait_type)).map((a) => { const s = shareOf(a.trait_type, a.value); return `<div class="trait"><span>${esc(a.trait_type)}</span><b>${esc(a.value)}</b>${s != null ? `<em>${(s * 100).toFixed(s < 0.01 ? 2 : 1)}% have this</em>` : ''}</div>`; }).join('');
  const owner = chainOwner || p.o;
  let state = '';
  if (p.seg === 'plant') {
    state = `<div class="box"><h3>Watering</h3>
      <div class="countdown" id="cd" data-dies="${p.diesAt ?? ''}">${p.diesAt ? dur(p.diesAt - Date.now()) : ''}</div>
      <div class="bar" id="cdbar" style="height:8px;margin:8px 0 14px"><b></b></div>
      <div class="kv">
        <div><span>Health</span><b>${p.h ?? ''}${p.h != null ? '%' : ''}</b></div>
        <div><span>Streak</span><b>${fmtN(p.sk ?? 0)} days</b></div>
        <div><span>Days watered</span><b>${fmtN(p.wd ?? 0)}</b></div>
        <div><span>Last watered</span><b>${p.w ? ago(Date.parse(p.w)) : ''}</b></div>
      </div>
      <p class="note">Time left before it dies if nobody waters it (72 hours after the last watering, the same clock Pocket Pad uses).</p></div>`;
  } else if (p.seg === 'reveal') {
    state = `<div class="box spirit"><h3>Spirit</h3>${p.s ? `<h4>${esc(p.s.name)}</h4>${p.s.lore ? `<p>${esc(p.s.lore)}</p>` : ''}` : ''}
      <div class="kv" style="margin-top:14px">
        ${p.s?.tier ? `<div><span>Tier</span><b>${esc(p.s.tier)}</b></div>` : ''}
        ${p.rk != null ? `<div><span>Spirit rank</span><b>${fmtN(p.rk)} <small style="font-weight:400;color:var(--muted)">(1 is rarest)</small></b></div>` : ''}
        ${p.dn != null ? `<div><span>Death order</span><b>#${fmtN(p.dn)}</b></div>` : ''}
        ${p.wd != null ? `<div><span>Days it lived</span><b>${fmtN(p.wd)}</b></div>` : ''}
        ${p.h != null ? `<div><span>Health</span><b>${p.h}%</b></div>` : ''}
      </div></div>`;
  } else {
    state = `<div class="box"><h3>State</h3><div class="kv"><div><span>Stage</span><b>Seed, not planted</b></div>${p.h != null ? `<div><span>Health</span><b>${p.h}%</b></div>` : ''}</div>
      ${meta?.description ? `<p class="note">${esc(meta.description)}</p>` : ''}</div>`;
  }
  $('#dBody').innerHTML = `
    <div class="dhead"><p class="eyebrow">${stage}${p.kind ? ' · ' + esc(p.kind) : ''}</p><h2 id="dTitle">Pocket #${p.i}</h2>
      <div class="chips">${p.rarity ? `<span class="pill r" style="--c:${rcol}">${esc(p.rarity)} plant</span>` : ''}${p.l ? '<span class="pill">For sale</span>' : ''}</div></div>
    <div class="dart"><img id="dImg" alt="Pocket #${p.i} art" src="${imgUrl(p, night)}">
      <div class="dn"><button data-dn="day" aria-pressed="${!night}">Day</button><button data-dn="night" aria-pressed="${night}">Night</button></div></div>
    ${p.l ? `<div class="box"><h3>Listed for sale</h3><div class="bigprice"><b>${eth(p.l.p)} ETH</b><a class="btn" href="${MARKET}/${p.i}" target="_blank" rel="noopener">View on market ↗</a></div>${p.l.at ? `<p class="note">Listed ${ago(Date.parse(p.l.at))}</p>` : ''}</div>` : ''}
    ${state}
    ${owner ? `<div class="box"><h3>Owner</h3><div class="owner"><a href="${EXPLORER}/address/${owner}" target="_blank" rel="noopener"><code>${short(owner)}</code></a>${chainOwner ? '<span class="verified">✓ read on-chain just now</span>' : loaded ? '' : '<span class="note" style="margin:0">checking chain…</span>'}</div></div>` : ''}
    <div class="box"><h3>Traits</h3><div class="traits">${traitsHTML || '<div class="skel"></div>'}</div></div>
    <div class="links"><a class="btn" href="#/meme/${p.i}">Make a meme</a><a class="btn ghost" href="${MARKET}/${p.i}" target="_blank" rel="noopener">Open on pocketpad.io ↗</a><a class="btn ghost" href="${EXPLORER}/token/${CONTRACT}/instance/${p.i}" target="_blank" rel="noopener">Explorer ↗</a></div>`;
  updateCountdown();
}
function updateCountdown() {
  const cd = $('#cd'); if (!cd || !cd.dataset.dies) return;
  const left = Number(cd.dataset.dies) - Date.now();
  cd.textContent = left > 0 ? dur(left) : 'Past its clock';
  const bar = $('#cdbar'); const pct = Math.max(0, Math.min(100, left / CLOCK * 100));
  bar.className = 'bar ' + (left < 12 * 36e5 ? 'danger' : left < 48 * 36e5 ? 'warn' : ''); bar.firstElementChild.style.width = pct + '%';
}

// ---------- events ----------
function bind() {
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.v === 'meme' ? '#/meme' : `#/${b.dataset.v}`; }));
  let qt; $('#q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value; applyFilters(true); }, 120); });
  $('#q').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return; const n = Number(e.target.value.trim().replace(/^#/, ''));
    if (Number.isInteger(n) && S.byId.has(n)) { e.target.value = ''; S.q = ''; location.hash = `#/x/${n}`; }
  });
  $('#kind').addEventListener('change', (e) => { S.kind = e.target.value; applyFilters(true); });
  $('#sort').addEventListener('change', (e) => { S.sort[S.view] = e.target.value; refreshList(true); });
  $('#listedOnly').addEventListener('click', (e) => { S.listedOnly = !S.listedOnly; e.currentTarget.setAttribute('aria-pressed', S.listedOnly); applyFilters(false); });
  $('#dayNight').addEventListener('click', () => setNight(!S.night));
  $('#rarities').addEventListener('click', (e) => { const b = e.target.closest('.rchip'); if (!b) return; const r = b.dataset.r; S.rarities.has(r) ? S.rarities.delete(r) : S.rarities.add(r); b.setAttribute('aria-pressed', S.rarities.has(r)); applyFilters(false); });
  const tiles = $('#tiles'), tip = $('#tip');
  tiles.addEventListener('click', (e) => { const c = e.target.closest('.tile'); if (c) location.hash = `#/${S.view}/${c.dataset.id}`; });
  tiles.addEventListener('pointerover', (e) => {
    const c = e.target.closest('.tile'); if (!c || e.pointerType === 'touch') return;
    tip.innerHTML = tipHTML(S.byId.get(Number(c.dataset.id))); tip.hidden = false;
    const r = c.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2; x = Math.max(8, Math.min(innerWidth - tw - 8, x));
    let y = r.top - th - 10; if (y < 8) y = r.bottom + 10;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  });
  tiles.addEventListener('pointerleave', () => { tip.hidden = true; });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const mobile = innerWidth < 640; $('#world').style.setProperty('--tile', TILE[S.view][mobile ? 1 : 0] + 'px'); measure(); }, 150); });
  $('#dClose').addEventListener('click', () => closeDetail()); $('#scrim').addEventListener('click', () => closeDetail());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); } });
  $('#dBody').addEventListener('click', (e) => { const b = e.target.closest('[data-dn]'); if (!b) return; setNight(b.dataset.dn === 'night'); });
  window.addEventListener('hashchange', route);
  const tb = $('#toolbar'); new IntersectionObserver(([e]) => tb.classList.toggle('stuck', e.intersectionRatio < 1), { threshold: [1], rootMargin: '-1px 0px 0px 0px' }).observe(tb);
}
function setNight(n) {
  S.night = n; document.body.dataset.time = n ? 'night' : 'day';
  $('#dayNight').setAttribute('aria-pressed', n); $('.dn-label').textContent = n ? 'Night' : 'Day';
  spriteQ.clear(); refreshList(false); applyFilters(false);
  const di = $('#dImg'); if (di && S.open) { di.src = imgUrl(S.byId.get(S.open), n); document.querySelectorAll('[data-dn]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.dn === 'night') === n))); }
}

(async function main() {
  bind();
  await Promise.all([loadSnapshot(), fetch('/atlas/manifest.json').then((r) => r.ok ? r.json() : null).then((j) => { ATLAS = j; }).catch(() => {})]);
  route(); setLive();
  refreshLive(); refreshState();
  setInterval(refreshLive, 60e3);
  setInterval(refreshState, 10 * 60e3);
  setInterval(() => { updateCountdown(); if (++tick % 15 === 0) setLive(); }, 1000);
  setInterval(() => { if (S.view === 'garden') renderHeader(); }, 60e3);
})();
