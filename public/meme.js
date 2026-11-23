// Meme Maker: stat cards, classic captions and code-drawn templates for any Pocket.
// Art: this morning's atlas sprite sheets (cropped on a canvas) + one same-origin card image per
// Pocket via /api/img. Stats: /api/pocket (live) when the meme is made. Nothing is invented.
import { textures } from './textures.js';
import { JOKES, CAPTIONS, BANNED } from './meme-text.js';
import { TEMPLATES } from './meme-templates.js';
import { W, H, RHEX, box, rr, text, oneLine, pocket, scene, tileRect, lin, rad, shadow, noShadow, cloud, stars, star, bubble, fmtLeft, fmtAgo, pct, rng } from './meme-draw.js';

const SITE = 'https://pocket-viewer.vercel.app/';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CONTRACT = '0x3a98de41a0df554f6b69ca1b5a1ad93a745ab1f2';
const CLOCK = 3 * 864e5;
const HIDE = new Set(['Stage', 'Spirit rank', 'Tier', 'Day', 'Streak', 'Plant rarity', 'Charms', 'Palette']);
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eth = (wei) => { if (wei == null) return null; const v = Number(BigInt(wei)) / 1e18; return v >= 1 ? v.toFixed(3).replace(/\.?0+$/, '') : v.toPrecision(3).replace(/\.?0+$/, ''); };
const short = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
const SEGNAME = { seed: 'Seed', plant: 'Plant', reveal: 'Spirit' };
// Lifecycle kinds, straight from the API: seed = never watered, plant = watered and not dead,
// spirit = dead and revealed (the API has no burned state, and every dead Pocket is revealed).
const K = { seed: 's', plant: 'p', reveal: 'r' };
const KPLURAL = { s: 'seeds', p: 'plants', r: 'spirits' };
const kindsLabel = (ks) => { const a = [...ks].map((k) => KPLURAL[k]); const t = a.length === 1 ? a[0] + ' only' : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1]; return t[0].toUpperCase() + t.slice(1); };

let A = null; // app bridge
const M = {
  mode: 'card', id: null, night: false, kindFilter: '', note: '',
  joke: { list: [], i: 0, custom: '' },
  cap: { top: '', bot: '', i: -1, edited: false, size: 0, color: '#ffffff', bg: 'scene' },
  tpl: 'wanted', extra: {}, fields: {},
  last: null,
};

// ---------------- data ----------------
const live = new Map(), pending = new Map();
function attr(p, name) { const k = A.traitNames().indexOf(name); if (k < 0 || !p.a) return undefined; const f = p.a.find((x) => x[0] === k); return f ? f[1] : undefined; }
async function rpcOwner(id) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CONTRACT, data: '0x6352211e' + id.toString(16).padStart(64, '0') }, 'latest'] }) });
  const j = await r.json(); return j.result && j.result.length >= 66 ? '0x' + j.result.slice(-40) : null;
}
function loadLive(id) {
  const c = live.get(id); if (c && Date.now() - c.t < 60e3) return Promise.resolve(c);
  if (pending.has(id)) return pending.get(id);
  const pr = (async () => {
    const tm = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
    const [r, o] = await Promise.allSettled([
      Promise.race([fetch(`/api/pocket?id=${id}`).then((r) => r.ok ? r.json() : Promise.reject(new Error(r.status))), tm(9000)]),
      Promise.race([rpcOwner(id), tm(6000)]),
    ]);
    const ok = r.status === 'fulfilled' && !!r.value?.pocket;
    const out = { t: Date.now(), ok, changed: c?.changed || null, traits: ok ? r.value.traits : (c?.traits || null), at: ok ? Date.parse(r.value.fetchedAt) : (c?.at || null), owner: o.status === 'fulfilled' ? o.value : (c?.owner || null) };
    if (ok) { const p = A.byId().get(id), a = p.a, before = p.seg; for (const k of ['l', 'rk', 'dn', 's']) delete p[k]; Object.assign(p, r.value.pocket, { a }); A.decorate(p); if (p.seg !== before) out.changed = [before, p.seg]; }
    live.set(id, out); pending.delete(id); return out;
  })();
  pending.set(id, pr); return pr;
}
function info(id) {
  const p = A.byId().get(id); if (!p) return null;
  const L = live.get(id), now = Date.now(), seg = p.seg;
  const w = p.w ? Date.parse(p.w) : null, diesAt = seg === 'plant' && w ? w + CLOCK : null;
  // Traits with a `from` day only show up later in the plant's life (Pot from day 5, Companion 10, Visitors 18,
  // Weather 45...). pocketpad.io never shows a share for those, and a seed doesn't have them yet, so skip them.
  const traits = (L?.traits || []).filter((t) => t.share != null && t.from == null && !HIDE.has(t.trait)).map((t) => ({ trait: t.trait, value: String(t.value), share: t.share })).sort((a, b) => a.share - b.share);
  const floorWei = A.stats()?.segments?.[seg]?.fromWei;
  const owner = L?.owner || p.o || null;
  const I = {
    id, seg, stage: SEGNAME[seg], kind: attr(p, 'Kind') ?? attr(p, 'Grew from') ?? null, rarity: attr(p, 'Plant rarity') ?? null, palette: attr(p, 'Palette') ?? null, colorway: attr(p, 'Colorway') ?? null,
    streak: p.sk ?? 0, wd: p.wd ?? null, rk: p.rk ?? null, dn: p.dn ?? null, spirit: p.s || null,
    lastWatered: w, diesAt, leftMs: diesAt ? diesAt - now : null, sinceMs: seg === 'plant' && w ? now - w : null,
    listing: p.l ? { eth: eth(p.l.p), num: Number(BigInt(p.l.p)) / 1e18 } : null,
    floor: floorWei ? eth(floorWei) : null, floorNum: floorWei ? Number(BigInt(floorWei)) / 1e18 : null,
    traits, owner, ownerShort: short(owner), stem: p.c, live: !!L?.ok, at: L?.ok ? L.at : A.stateAt(), chainOwner: !!L?.owner, changed: L?.changed || null, stageNum: p.sg ?? null,
  };
  I.healing = isHealing(I); Object.assign(I, healthState(I)); I.standing = standing(p, I); return I;
}
// ---------------- where a Pocket sits in the collection (for report-card grades) ----------------
// Everything here is counted from the loaded pockets (snapshot, plus any live updates already applied).
// pct is a mid-rank percentile from 0 to 1 where 1 is best; ties share the middle of their band.
const midPct = (better, same, n) => n ? (better + same / 2) / n : null;
let shareCache = null, kindCache = null;
const KINDT = new Set(['Kind', 'Grew from']);
const LATER = new Set(['Pot shape', 'Pot color', 'Companion', 'Visitors', 'Weather', 'Special']); // traits that carry a `from` day
function minShares() {
  if (shareCache) return shareCache;
  const names = A.traitNames(), all = [...A.byId().values()], cnt = new Map();
  const use = (k) => !HIDE.has(names[k]) && !KINDT.has(names[k]) && !LATER.has(names[k]);
  for (const p of all) for (const [k, v] of p.a || []) if (use(k)) cnt.set(k + '|' + v, (cnt.get(k + '|' + v) || 0) + 1);
  return (shareCache = all.map((p) => Math.min(...(p.a || []).filter(([k]) => use(k)).map(([k, v]) => cnt.get(k + '|' + v) / all.length), 1)));
}
function standing(p, I) {
  const all = [...A.byId().values()], out = {};
  const rev = all.filter((q) => q.seg === 'reveal' && q.dn != null);
  if (I.seg === 'reveal' && I.dn != null) {
    // Pocket Pad gives spirit rank = 2501 - deathOrdinal, so a later rise means a better (lower) rank.
    const n = Math.max(rev.length, I.dn), earlier = rev.filter((q) => q.dn < I.dn).length; // spirits it out-ranks
    out.rev = { n, pct: midPct(earlier, 1, n) };
    const w = I.wd ?? 0; out.wdPct = midPct(rev.filter((q) => (q.wd ?? 0) < w).length, rev.filter((q) => (q.wd ?? 0) === w).length, rev.length);
  }
  const kn = (q) => attr(q, 'Kind') ?? attr(q, 'Grew from');
  if (I.kind) { if (!kindCache) { const counts = new Map(), ks = all.map(kn); for (const k of ks) if (k) counts.set(k, (counts.get(k) || 0) + 1); kindCache = { counts, per: ks.map((k) => counts.get(k)).filter((c) => c != null) }; }
    const mine = kindCache.counts.get(I.kind) || 1; out.kindCount = mine;
    let rarer = 0, same = 0; for (const c of kindCache.per) { if (c > mine) rarer++; else if (c === mine) same++; }
    out.kindPct = midPct(rarer, same, all.length); }
  if (I.seg === 'plant') { const pl = all.filter((q) => q.seg === 'plant'), f = (key, v) => midPct(pl.filter((q) => (q[key] ?? 0) < v).length, pl.filter((q) => (q[key] ?? 0) === v).length, pl.length);
    out.streakPct = f('sk', I.streak); out.wdPct = f('wd', I.wd ?? 0); out.plants = pl.length; }
  if (I.rarity) { const order = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'One of One'], mine = order.indexOf(I.rarity), rs = all.map((q) => order.indexOf(attr(q, 'Plant rarity'))).filter((r) => r >= 0);
    if (mine >= 0) out.rarityPct = midPct(rs.filter((r) => r < mine).length, rs.filter((r) => r === mine).length, rs.length); }
  const t0 = I.traits.find((t) => !KINDT.has(t.trait)); out.trait = t0 || null;
  if (t0) { const ms = minShares(), v = t0.share; out.traitPct = midPct(ms.filter((x) => x > v + 1e-9).length, ms.filter((x) => Math.abs(x - v) <= 1e-9).length, ms.length); }
  return out;
}

// ---------------- images ----------------
const imgCache = new Map(), cropCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => { imgCache.delete(src); res(null); }; im.src = src; }));
  return imgCache.get(src);
}
async function spriteOf(id, night) {
  const p = A.byId().get(id), at = A.atlas(), sg = at?.segments?.[p.seg], c = sg?.cells?.[id];
  const crop = async (n) => { const key = `${p.seg}:${id}:${n}:${c[4]}`; if (cropCache.has(key)) return cropCache.get(key);
    const im = await loadImg(`/atlas/${n ? sg.night : sg.day}?v=${at.v}`); if (!im) return null;
    const cv = document.createElement('canvas'); cv.width = c[2]; cv.height = c[3]; cv.getContext('2d').drawImage(im, c[0], c[1], c[2], c[3], 0, 0, c[2], c[3]); cropCache.set(key, cv); return cv; };
  if (c && c[4] === p.c && (!night || c[5])) { const cv = await crop(night); if (cv) return cv; }
  if (p.c) { const im = await loadImg(`/api/img?id=${id}&kind=sprite&stem=${encodeURIComponent(p.c)}${night ? '&night=1' : ''}`); if (im) return im; }
  if (c) return crop(false);
  return null;
}
async function cardOf(id, night) { const p = A.byId().get(id); if (!p?.c) return null; return loadImg(`/api/img?id=${id}&stem=${encodeURIComponent(p.c)}${night ? '&night=1' : ''}`); }
async function full(id, night) {
  await loadLive(id);
  const I = info(id); const [sprite, card] = await Promise.all([spriteOf(id, night), I.seg === 'reveal' ? null : cardOf(id, night)]);
  I.sprite = sprite; I.card = card; I.night = night; return I;
}
let texCache = {};
async function tex(night) {
  const k = night ? 'n' : 'd'; if (texCache[k]) return texCache[k];
  const load = (u) => loadImg(u);
  const s = textures('soil', night), g = textures('garden', night), h = textures('heaven', night);
  const [soil, garden, heaven, hedge, fence, wingL, wingR, halo, hybridBase, hybridMask] = await Promise.all([
    Promise.all([0, 1, 2, 3].map((i) => load(s['t' + i]))), Promise.all([0, 1, 2, 3].map((i) => load(g['t' + i]))), Promise.all([0, 1, 2, 3].map((i) => load(h['t' + i]))),
    load(g.hedge), load(g.fence), load(h.wingL), load(h.wingR), load(h.halo), load('/hybrid/base.png?v=1'), load('/hybrid/mask.png?v=1')]);
  return (texCache[k] = { soil, garden, heaven, hedge, fence, wingL, wingR, halo, hybridBase, hybridMask, night });
}
let fontsReady = null;
function fonts() { return fontsReady || (fontsReady = Promise.all(['400 60px Anton', '700 60px Fraunces', '900 60px Fraunces', 'italic 600 40px Fraunces', '600 30px "Pixelify Sans"', '600 30px Inter', '700 30px Inter'].map((f) => document.fonts.load(f).catch(() => null)))); }

// ---------------- jokes ----------------
function facts(I) {
  const r = I.traits[0];
  let maxDn = 0; if (I.seg === 'reveal') for (const q of A.byId().values()) if (q.dn > maxDn) maxDn = q.dn;
  return { wd: I.wd, streak: I.streak, hs: I.hstate, left: I.leftMs, since: I.sinceMs, listed: !!I.listing, ratio: I.listing && I.floorNum ? I.listing.num / I.floorNum : null, share: r?.share ?? null, rarity: I.rarity, dn: I.dn,
    past: I.leftMs != null && I.leftMs <= 0, intact: I.sinceMs != null && I.sinceMs < 48 * 36e5, healing: I.healing, newest: I.dn != null && maxDn > 0 && I.dn > maxDn - 10 };
}
// Pocket Pad's own art marks a plant that is healing after a lapse with -h1-/-h2- in its image stem
// ("first water back", "second water back"). A brand-new plant (watered under 3 days) isn't healing back from anything.
export function isHealing(I) { return I.seg === 'plant' && (I.wd ?? 0) >= 3 && /-h[12]-/.test(I.stem || ''); }
// Health as pocketpad.io itself words it (its JS: hours since lastWateredAt >= 60 "critical", >= 48 "wilting",
// >= 24 "thirsty", else "fresh"; labels fresh "Healthy", thirsty "Thirsty", wilting "Wilting", critical "Dying";
// art states heal1 "first water back", heal2 "second water back"). The API's numeric `health` is never shown.
// Past 72h the site still says "Dying" until the chain marks it dead; by the rules it has died, so we say so.
export const HLABEL = { fresh: 'Healthy', heal1: 'Healing', heal2: 'Healing', thirsty: 'Thirsty', wilting: 'Wilting', critical: 'Dying', past: 'Past 72h' };
export const HDETAIL = { heal1: 'first water back', heal2: 'second water back', past: 'past its 72h clock' };
function healthState(I) {
  if (I.seg !== 'plant' || I.sinceMs == null) return { hstate: null, hword: null, hdetail: null };
  const h = I.sinceMs / 36e5;
  let st = I.leftMs != null && I.leftMs <= 0 ? 'past' : h >= 60 ? 'critical' : h >= 48 ? 'wilting' : h >= 24 ? 'thirsty' : 'fresh';
  if (st === 'fresh' && I.healing) st = /-h1-/.test(I.stem) ? 'heal1' : 'heal2';
  return { hstate: st, hword: HLABEL[st], hdetail: HDETAIL[st] || null };
}
const an = (w) => /^[aeiou]/i.test(w || '') && !/^one\b/i.test(w) ? 'an' : 'a'; // "a One of One", "an Uncommon"
const ordinal = (n) => n == null ? null : n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function fill(t, I) {
  const r = I.traits[0];
  const v = { aRarity: I.rarity ? `${an(I.rarity)} ${I.rarity}` : null, aKind: I.kind ? `${an(I.kind)} ${I.kind}` : null, aName: I.spirit?.name ? `${an(I.spirit.name)} ${I.spirit.name}` : null, dnOrd: ordinal(I.dn), rkFmt: I.rk != null ? I.rk.toLocaleString('en-US') : null, wdDays: I.wd != null ? `${I.wd} day${I.wd === 1 ? '' : 's'}` : null, id: I.id, streak: I.streak, hword: I.hword ? I.hword.toLowerCase() : null, healWord: I.hstate === 'heal1' || I.hstate === 'heal2' ? I.hdetail : null, left: I.leftMs > 0 ? fmtLeft(I.leftMs) : null, since: I.sinceMs != null ? fmtAgo(I.sinceMs) : null, kind: I.kind, name: I.spirit?.name, dn: I.dn, rk: I.rk, wd: I.wd,
    trait: r?.value, sharePct: r ? pct(r.share) : null, price: I.listing?.eth, floor: I.floor, rarity: I.rarity };
  let ok = true; const s = t.replace(/\{(\w+)\}/g, (_, k) => { const x = v[k]; if (x == null || x === '') { ok = false; return ''; } return x; });
  return ok ? s : null;
}
function jokesFor(I) {
  const f = facts(I);
  return JOKES.map((j, n) => ({ j, n })).filter(({ j }) => j.k.includes(K[I.seg]) && !(j.a && f.past) && j.w(f)).map(({ j, n }) => ({ n, tag: j.tag, p: j.p, text: fill(j.t, I) })).filter((x) => x.text && !BANNED[K[I.seg]].test(x.text)).sort((a, b) => b.p - a.p || a.n - b.n);
}

function capText(c, I) { const a = fill(c[0], I), b = fill(c[1], I); return a == null || b == null ? null : [a, b]; }
function capsFor(I) { const f = facts(I), k = K[I.seg]; return CAPTIONS.map((c, i) => i).filter((i) => { const c = CAPTIONS[i]; if (!c[2].includes(k) || (c[3] && !c[3](f))) return false; const t = capText(c, I); return t && !BANNED[k].test(t.join(' ')); }); }
function syncCaption(I, force) {
  const ok = capsFor(I); const el = $('#mmCapCount'); if (el) el.textContent = `${ok.length} presets fit this ${I.stage.toLowerCase()}`;
  if (M.cap.edited && !force) return;
  if (!force && ok.includes(M.cap.i)) { [M.cap.top, M.cap.bot] = capText(CAPTIONS[M.cap.i], I); }
  else { const pool = ok.filter((i) => i !== M.cap.i); M.cap.i = (pool.length ? pool : ok)[Math.floor(Math.random() * (pool.length || ok.length))]; [M.cap.top, M.cap.bot] = capText(CAPTIONS[M.cap.i], I); M.cap.edited = false; }
  const t = $('#mmTop'), b = $('#mmBot'); if (t && document.activeElement !== t) t.value = M.cap.top; if (b && document.activeElement !== b) b.value = M.cap.bot;
}

// ---------------- stat card ----------------
const THEME = {
  seed: { day: { panel: '#2a1c13', panel2: '#3b291d', ink: '#f6e8d0', muted: '#c4a684', accent: '#e9a55a', bub: '#f6e8d0', bubInk: '#2a1c13', line: 'rgba(233,165,90,.3)' },
    night: { panel: '#1d1724', panel2: '#2b2234', ink: '#f0e6f6', muted: '#a998bb', accent: '#c9a0ff', bub: '#efe6f6', bubInk: '#1d1724', line: 'rgba(201,160,255,.3)' } },
  plant: { day: { panel: '#fbf7e9', panel2: '#eef3dc', ink: '#1f3a24', muted: '#5f7f5c', accent: '#3f8a32', bub: '#1f3a24', bubInk: '#f4fbe6', line: 'rgba(30,70,30,.16)' },
    night: { panel: '#122b26', panel2: '#1b3a33', ink: '#e6f5ea', muted: '#8fb8a8', accent: '#c8f169', bub: '#e6f5ea', bubInk: '#122b26', line: 'rgba(200,241,105,.22)' } },
  reveal: { day: { panel: 'rgba(255,255,255,.9)', panel2: '#f0ecff', ink: '#2a2552', muted: '#6d6895', accent: '#b9801c', bub: '#2a2552', bubInk: '#fff8e8', line: 'rgba(120,110,190,.2)' },
    night: { panel: 'rgba(28,24,62,.93)', panel2: '#2c2763', ink: '#f1edff', muted: '#aaa4d8', accent: '#ffd45e', bub: '#f1edff', bubInk: '#1c183e', line: 'rgba(255,212,94,.25)' } },
};
function frame(x, I, T) {
  const N = T.night;
  if (I.seg === 'seed') { tileRect(x, T.soil, 0, 0, W, H, 4, 11); x.fillStyle = rad(x, W / 2, H / 2, 300, 800, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); x.fillRect(0, 0, W, H); }
  else if (I.seg === 'plant') { tileRect(x, T.garden, 0, 0, W, H, 4, 5); if (T.hedge) { x.save(); x.imageSmoothingEnabled = false; const hw = T.hedge.width * 4, hh = T.hedge.height * 4; for (let xx = 0; xx < W; xx += hw) { x.drawImage(T.hedge, xx, 0, hw, hh); } x.restore(); } x.fillStyle = rad(x, W / 2, H / 2, 300, 800, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,30,10,.35)']]); x.fillRect(0, 0, W, H); }
  else {
    x.fillStyle = lin(x, 0, 0, 0, H, N ? [[0, '#141036'], [1, '#3b2f7a']] : [[0, '#b7c0ff'], [.6, '#efe4ff'], [1, '#ffe4b8']]); x.fillRect(0, 0, W, H);
    if (N) stars(x, I.id, 120, 0, 0, W, H);
    for (const [cx, cy, s] of [[60, 120, 120], [1010, 200, 130], [40, 980, 150], [1040, 1000, 140], [540, 1070, 160], [300, 20, 90], [800, 30, 100]]) cloud(x, cx, cy, s, N ? '#ddd6ff' : '#fff', N ? 'rgba(80,70,160,.5)' : 'rgba(170,160,230,.4)');
  }
}
function drawCard(x, I, joke, T) {
  const th = THEME[I.seg][T.night ? 'night' : 'day'], rc = RHEX[I.rarity] || '#a9b0b4';
  frame(x, I, T);
  const PX = 48, PY = 48, PW = W - 96, PH = H - 48 - 72;
  x.save(); shadow(x, 50, 20, 'rgba(0,0,0,.45)'); box(x, PX, PY, PW, PH, 40, th.panel); x.restore();
  box(x, PX + 10, PY + 10, PW - 20, PH - 20, 32, null, th.line, 3);
  // joke bubble
  const bx = 88, by = 84, bw = W - 176, bh = 168;
  bubble(x, bx, by, bw, bh, 230, by + bh + 12, th.bub, null);
  text(x, joke, W / 2, by + bh / 2, { fam: 'serif', weight: 800, max: 60, min: 26, maxW: bw - 70, maxH: bh - 34, color: th.bubInk, lh: 1.08 });
  // art
  const ax = 88, ay = 290, AS = 400;
  x.save(); shadow(x, 30, 14, 'rgba(0,0,0,.35)'); box(x, ax, ay, AS + 20, AS + 20, 22, th.panel2); x.restore();
  scene(x, I, ax + 10, ay + 10, AS, { round: 14 });
  if (I.rarity) { const lbl = (I.seg === 'reveal' ? `from ${an(I.rarity)} ${I.rarity} plant` : I.rarity).toUpperCase(); x.font = '600 24px "Pixelify Sans", monospace'; const w = x.measureText(lbl).width + 56;
    x.save(); shadow(x, 14, 6, 'rgba(0,0,0,.3)'); box(x, ax - 8, ay - 22, w, 46, 23, rc); x.restore(); star(x, ax + 18, ay + 1, 11, '#fff', 4, .4); oneLine(x, lbl, ax + 34, ay + 2, { fam: 'pixel', size: 24, color: '#1a1408' }); }
  if (I.listing) { const lbl = `FOR SALE ${I.listing.eth} ETH`; x.font = '600 24px "Pixelify Sans", monospace'; const w = x.measureText(lbl).width + 36;
    x.save(); shadow(x, 14, 6, 'rgba(0,0,0,.3)'); box(x, ax + AS + 28 - w, ay + AS - 4, w, 46, 23, '#ffd75e'); x.restore(); oneLine(x, lbl, ax + AS + 28 - w / 2, ay + AS + 20, { fam: 'sans', weight: 800, size: 22, color: '#3a2a00', align: 'center' }); }
  // right column
  const rx = 540, rw = 992 - rx;
  oneLine(x, `POCKET · ${I.stage.toUpperCase()}`, rx, 312, { fam: 'pixel', size: 26, color: th.accent });
  const big = I.seg === 'reveal' ? 118 : 150;
  text(x, `#${I.id}`, rx, 336, { fam: 'serif', weight: 900, max: big, min: 60, maxW: rw, maxH: big, color: th.ink, align: 'left', valign: 'top', lh: 1 });
  let y = 520;
  if (I.seg === 'reveal') {
    y = 490; oneLine(x, I.spirit?.name || 'Spirit', rx, y, { fam: 'serif', weight: 800, size: 52, color: th.ink, maxW: rw }); y += 44;
    if (I.kind) { oneLine(x, `grew from ${I.kind}`, rx, y, { fam: 'sans', weight: 600, size: 23, color: th.muted, maxW: rw }); y += 22; }
    if (I.spirit?.lore) { const r = text(x, I.spirit.lore, rx, y, { fam: 'serif', weight: 500, italic: true, max: 22, min: 17, maxW: rw, maxH: 56, color: th.muted, align: 'left', valign: 'top', lh: 1.22, maxLines: 2 }); y += r.h - 4; }
  } else {
    oneLine(x, I.kind || I.stage, rx, y, { fam: 'serif', weight: 800, size: 50, color: th.ink, maxW: rw }); y += 50;
    oneLine(x, I.seg === 'seed' ? 'unplanted seed' : `${I.stageNum != null ? `stage ${I.stageNum} ` : ''}plant${I.leftMs != null && I.leftMs <= 0 ? ' · past its 72h clock' : ''}`, rx, y, { fam: 'sans', weight: 600, size: 24, color: th.muted, maxW: rw }); y += 36;
  }
  const tr = I.traits.slice(0, I.seg === 'reveal' ? 2 : 3);
  if (tr.length) { y = Math.max(y + 22, I.seg === 'reveal' ? 0 : 600); oneLine(x, 'RAREST TRAITS', rx, y, { fam: 'pixel', size: 20, color: th.muted }); y += 34;
    for (const t of tr) { if (y > 712) break; oneLine(x, t.value, rx, y, { fam: 'sans', weight: 700, size: 26, color: th.ink, maxW: rw - 120 }); oneLine(x, pct(t.share), 992, y, { fam: 'sans', weight: 700, size: 26, color: t.share < .05 ? th.accent : th.muted, align: 'right' }); y += 36; } }
  // stats row
  let stats;
  if (I.seg === 'plant') stats = [[I.sinceMs < 48 * 36e5 ? 'Streak' : 'Last streak', `${I.streak} day${I.streak === 1 ? '' : 's'}`], ['Health', I.hword || '–', false, I.hstate === 'heal1' || I.hstate === 'heal2' ? I.hdetail : null], ['Watered', fmtAgo(I.sinceMs) || '–'], I.leftMs > 0 ? ['Dies in', fmtLeft(I.leftMs), true] : ['Spirit', 'pending', false]];
  else if (I.seg === 'reveal') stats = [['Rose to heaven', I.dn != null ? ordinal(I.dn) : '–'], ['Watered as a plant', I.wd != null ? `${I.wd} day${I.wd === 1 ? '' : 's'}` : '–'], ['Spirit rank', I.rk != null ? `#${I.rk.toLocaleString('en-US')}` : '–'], ['Tier', I.spirit?.tier || '–']];
  else stats = [['Rarity', I.rarity || '–'], ['Rarest trait', I.traits[0] ? pct(I.traits[0].share) : '–'], ['Stage', 'Unplanted'], [I.listing ? 'Listed' : 'Market', I.listing ? `${I.listing.eth} ETH` : 'not listed']];
  const sy = 730, sh = 150, gap = 16, sw = (W - 176 - gap * 3) / 4;
  stats.forEach(([k, v, bar, sub], i) => { const sx = 88 + i * (sw + gap); box(x, sx, sy, sw, sh, 22, th.panel2);
    oneLine(x, k.toUpperCase(), sx + 22, sy + 34, { fam: 'pixel', size: 21, color: th.muted, maxW: sw - 40 });
    text(x, v, sx + sw / 2, sy + 92, { fam: 'serif', weight: 800, max: 46, min: 20, maxW: sw - 30, maxH: 60, color: th.ink, maxLines: 1 });
    if (sub) oneLine(x, sub, sx + sw / 2, sy + sh - 22, { fam: 'sans', weight: 600, size: 18, color: th.muted, align: 'center', maxW: sw - 24 });
    if (bar && I.leftMs != null) { const f = Math.max(0, Math.min(1, I.leftMs / CLOCK)); box(x, sx + 22, sy + sh - 26, sw - 44, 10, 5, th.line); box(x, sx + 22, sy + sh - 26, Math.max(10, (sw - 44) * f), 10, 5, f < 1 / 6 ? '#e5484d' : f < 2 / 3 ? '#f2b033' : '#5cc65a'); } });
  // footer
  oneLine(x, I.owner ? `owner ${I.ownerShort}${I.chainOwner ? ' ✓ on-chain' : ''}` : '', 92, 935, { fam: 'sans', weight: 600, size: 22, color: th.muted });
  const when = I.at ? new Date(I.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
  oneLine(x, `${I.live ? 'live stats' : 'snapshot stats'} · ${when}`, 988, 935, { fam: 'sans', weight: 600, size: 22, color: th.muted, align: 'right' });
}

// ---------------- classic captions ----------------
function drawCaption(x, I, T) {
  const c = M.cap;
  if (c.bg === 'scene') { if (I.card && I.seg !== 'reveal') { x.save(); x.imageSmoothingEnabled = false; x.drawImage(I.card, -20, -20, W + 40, H + 40); x.restore(); } else scene(x, I, 0, 0, W); }
  else if (c.bg === 'world') { frame(x, I, T); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 0, W, H); pocket(x, I, W / 2, 840, 520, { glow: 'rgba(255,255,255,.35)' }); }
  else { x.fillStyle = rad(x, W / 2, H * .55, 60, 760, T.night ? [[0, '#3b2f7a'], [1, '#0e0b22']] : [[0, '#fff1c9'], [1, '#f08a5d']]); x.fillRect(0, 0, W, H); x.save(); x.globalAlpha = .18; for (let i = 0; i < 18; i++) { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(W / 2, H * .55); x.arc(W / 2, H * .55, 900, i * Math.PI / 9, i * Math.PI / 9 + Math.PI / 18); x.fill(); } x.restore(); pocket(x, I, W / 2, 860, 560, { shadowCol: 'rgba(0,0,0,.3)' }); }
  const col = c.color, stroke = col === '#111111' ? '#ffffff' : '#111111';
  const max = c.size || 110;
  text(x, c.top, W / 2, 34, { fam: 'anton', weight: 400, upper: true, color: col, stroke, max, min: 28, maxW: W - 70, maxH: 330, valign: 'top', lh: 1.04 });
  text(x, c.bot, W / 2, H - 76, { fam: 'anton', weight: 400, upper: true, color: col, stroke, max, min: 28, maxW: W - 70, maxH: 330, valign: 'bottom', lh: 1.04 });
}

// ---------------- templates ----------------
const tplById = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
const kindOf = (id) => K[A.byId().get(id)?.seg];
// Which kinds a template accepts as the main Pocket, and which slot that Pocket takes.
function tplKinds(t) { return t.kinds || [...new Set((t.roles || []).filter((r) => r && r !== 'same').join(''))].join('') || 'spr'; }
function primarySlot(t, k) { if (!t.roles) return 0; const exact = t.roles.findIndex((r) => r && r !== 'same' && r.includes(k)); return exact >= 0 ? exact : t.roles.findIndex((r) => r === null); }
function allowed(t, k) { return tplKinds(t).includes(k) && primarySlot(t, k) >= 0; }
function randomId(kinds, exclude) {
  const all = [...A.byId().values()]; let pool = kinds ? all.filter((p) => kinds.includes(K[p.seg])) : all;
  if (exclude != null) pool = pool.filter((p) => p.i !== exclude);
  if (!pool.length) pool = all; return pool[Math.floor(Math.random() * pool.length)].i;
}
function slotRole(t, s) { return t.roles?.[s] ?? null; }
function extraFor(tid, s, pid) {
  const t = tplById[tid], r = slotRole(t, s), key = tid + ':' + s, cur = M.extra[key];
  const ok = cur != null && A.byId().has(cur) && cur !== pid && (!r || r.includes(kindOf(cur)));
  if (!ok) M.extra[key] = randomId(r || t.prefer?.[s] || null, pid);
  return M.extra[key];
}
function slotIds(tid = M.tpl, pid = M.id) {
  const t = tplById[tid], ps = Math.max(0, primarySlot(t, kindOf(pid))), ids = [];
  for (let s = 0; s < t.n; s++) ids.push(s === ps || slotRole(t, s) === 'same' ? pid : extraFor(tid, s, pid));
  return ids;
}
function fieldVals(t, P) { const st = (M.fields[t.id] ||= {}); const out = {}; for (const f of t.fields) out[f.k] = st[f.k]?.dirty ? st[f.k].v : f.def(P); return out; }
function syncTplGrid() {
  const k = kindOf(M.id);
  document.querySelectorAll('.mm-tpl').forEach((el) => { const t = tplById[el.dataset.t], ok = allowed(t, k);
    el.setAttribute('aria-pressed', String(t.id === M.tpl)); el.classList.toggle('off', !ok);
    const em = el.querySelector('em'); if (em) em.textContent = ok ? (t.n > 1 ? `${t.n} Pockets` : '') : `${kindsLabel(tplKinds(t))} · tap to roll one`; });
}

// ---------------- render ----------------
let seq = 0, raf = 0;
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render()); }
async function render(depth = 0) {
  if (M.id == null) return;
  const my = ++seq, cv = $('#mmCanvas');
  const ids = M.mode === 'tpl' ? slotIds() : [M.id];
  const slow = setTimeout(() => { if (my === seq) $('#mmLoading').hidden = false; }, 150);
  const [T, , ...P] = await Promise.all([tex(M.night), fonts(), ...ids.map((id) => full(id, M.night))]);
  clearTimeout(slow); if (my !== seq) return;
  // A Pocket's kind can change between the morning snapshot and now (a plant can die and be revealed),
  // so template eligibility and slot roles are checked again with live data before drawing.
  if (M.mode === 'tpl' && depth < 4) {
    const t = tplById[M.tpl], k = kindOf(M.id);
    if (!allowed(t, k)) { const nt = TEMPLATES.find((x) => allowed(x, k)); M.note = `\u201c${t.name}\u201d is for ${kindsLabel(tplKinds(t)).toLowerCase()}, so this ${SEGNAME[A.byId().get(M.id).seg].toLowerCase()} got \u201c${nt.name}\u201d instead.`; M.tpl = nt.id; const o = $('#mmTplOpts'); if (o) o.innerHTML = tplOptsHTML(nt); syncTplGrid(); return render(depth + 1); }
    if (slotIds().join() !== ids.join()) return render(depth + 1);
  }
  $('#mmLoading').hidden = true;
  const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.imageSmoothingEnabled = true; noShadow(x); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  const I = P[Math.max(0, ids.indexOf(M.id))]; // the main Pocket (in some templates it isn't slot 0)
  try {
    if (M.mode === 'card') { syncJokes(I); drawCard(x, I, currentJoke(), T); }
    else if (M.mode === 'cap') { syncCaption(I); drawCaption(x, I, T); }
    else { const t = tplById[M.tpl]; t.draw(x, P, fieldVals(t, P), { night: M.night, tex: T }); syncFieldInputs(t, P); syncTplGrid(); }
  } catch (e) { console.error('meme render failed', e); }
  M.last = { I, P };
  status(I); shareLinks(I);
  if (M.mode === 'tpl') thumbs(P[0], T);
}
function status(I) {
  const name = I.seg === 'reveal' ? (I.spirit?.name || '') : (I.kind || '');
  const when = I.at ? new Date(I.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const notes = [];
  if (I.changed) notes.push(`This morning\u2019s snapshot had it as a ${SEGNAME[I.changed[0]].toLowerCase()}; live data says it\u2019s now a ${SEGNAME[I.changed[1]].toLowerCase()}.`);
  if (I.seg === 'plant' && I.leftMs != null && I.leftMs <= 0) notes.push('Past its 72h clock but not marked dead by Pocket Pad yet.');
  if (I.seg === 'reveal' && !I.spirit) notes.push('This plant died and Pocket Pad hasn\u2019t published the spirit under it yet. Try again in a minute.');
  if (M.note) { notes.push(M.note); M.note = ''; }
  $('#mmStatus').innerHTML = `<b>${I.stage}</b>${name ? ' · ' + esc(name) : ''}${I.hword ? ` · ${esc(I.hword)}${I.hdetail && I.hstate !== 'past' ? ` (${esc(I.hdetail)})` : ''}` : ''}${I.rarity ? ` · <span class="mm-r" style="--c:${RHEX[I.rarity]}">${I.seg === 'reveal' ? `grew from ${an(I.rarity)} ` : ''}${esc(I.rarity)}${I.seg === 'reveal' ? ' plant' : ''}</span>` : ''}<br><span class="${I.live ? 'ok' : 'warn'}">${I.live ? `✓ Live stats from ${when}` : `Live stats unavailable right now, showing the ${when} snapshot`}</span>${notes.map((n) => `<br><span class="note">${esc(n)}</span>`).join('')}`;
}
function syncJokes(I) {
  const list = jokesFor(I), sig = list.map((j) => j.n).join(',');
  if (M.joke.sig !== sig || M.joke.forId !== I.id) { M.joke.list = list; M.joke.sig = sig; if (M.joke.forId !== I.id) M.joke.i = 0; M.joke.forId = I.id; M.joke.i = Math.max(0, Math.min(M.joke.i, list.length - 1)); }
  const cur = list[M.joke.i]; const el = $('#mmJoke'); if (!el) return;
  el.querySelector('.mm-jtext').textContent = M.joke.custom.trim() ? 'Using your own line ↓' : (cur?.text || '');
  el.querySelector('.mm-jtag').textContent = M.joke.custom.trim() ? 'Custom' : (cur ? `${cur.tag} · ${M.joke.i + 1} of ${list.length} that fit this ${I.stage.toLowerCase()}` : '');
}
function currentJoke() { return M.joke.custom.trim() || M.joke.list[M.joke.i]?.text || `pocket #${M.id}`; }
function shareText(I) {
  const who = `Pocket #${I.id}${I.seg === 'reveal' && I.spirit?.name ? ` (${I.spirit.name})` : I.kind ? ` (${I.kind}${I.seg === 'plant' && /\bplant$/i.test(I.kind) ? '' : ' ' + I.stage.toLowerCase()})` : ''}`;
  if (M.mode === 'card') return `${currentJoke()}\n\n${who} stat card, made with Pocket Almanac`;
  if (M.mode === 'cap') return `${[M.cap.top, M.cap.bot].filter((t) => t && t.trim()).join(' / ')}\n\n${who} meme, made with Pocket Almanac`;
  return `${who} in the "${tplById[M.tpl].name}" meme, made with Pocket Almanac`;
}
function shareLinks(I) { $('#mmX').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(I))}&url=${encodeURIComponent(SITE)}`; }
function blob() { return new Promise((res) => $('#mmCanvas').toBlob(res, 'image/png')); }
const fname = () => `pocket-${M.id}-${M.mode === 'tpl' ? M.tpl : M.mode === 'cap' ? 'caption' : 'statcard'}.png`;

// ---------------- thumbnails ----------------
let thumbSig = '', thumbJob = 0;
function thumbs(I, T) {
  const sig = I.id + ':' + I.seg + ':' + M.night; if (sig === thumbSig) return; thumbSig = sig; const job = ++thumbJob;
  const off = document.createElement('canvas'); off.width = W; off.height = H; const ox = off.getContext('2d');
  let i = 0; const step = async () => {
    if (job !== thumbJob || i >= TEMPLATES.length) return; const t = TEMPLATES[i++];
    const c = document.querySelector(`.mm-tpl[data-t="${t.id}"] canvas`);
    if (!allowed(t, K[I.seg])) { if (c) { const cx = c.getContext('2d'); cx.fillStyle = '#1c1024'; cx.fillRect(0, 0, c.width, c.height); cx.fillStyle = 'rgba(255,255,255,.55)'; cx.font = '600 15px Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(kindsLabel(tplKinds(t)), c.width / 2, c.height / 2); } setTimeout(step, 0); return; }
    const P = []; for (const id of slotIds(t.id, I.id)) P.push(id === I.id ? I : await full(id, M.night).catch(() => I));
    if (job !== thumbJob) return;
    try { ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, W, H); noShadow(ox); ox.globalAlpha = 1; t.draw(ox, P, fieldVals(t, P), { night: M.night, tex: T }); } catch (e) { console.error(e); }
    if (c) { const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(off, 0, 0, c.width, c.height); }
    setTimeout(step, 16);
  }; step();
}

// ---------------- UI ----------------
const ICON = {
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8C14.3 16 15.5 17 17.5 17H21M3 17h3.5c1.3 0 2.3-.4 3.1-1.2M21 7h-3.5c-1.3 0-2.3.4-3.1 1.2M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z" fill="currentColor"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5m0 0L7.5 8M12 3.5 16.5 8M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const SWATCH = [['#ffffff', 'White'], ['#ffe14d', 'Yellow'], ['#c8f169', 'Lime'], ['#ff8fc8', 'Pink'], ['#8fe3ff', 'Sky'], ['#111111', 'Black']];
function controlsHTML() {
  if (M.mode === 'card') return `
    <div class="mm-box"><div class="mm-h">Joke line <small>picked from this Pocket's real stats</small></div>
      <div class="mm-joke" id="mmJoke"><button class="mm-icon" data-j="-1" aria-label="Previous line">${ICON.l}</button><div><p class="mm-jtext"></p><p class="mm-jtag"></p></div><button class="mm-icon" data-j="1" aria-label="Next line">${ICON.r}</button></div>
      <div class="mm-row"><button class="mm-btn sm" id="mmJShuffle">${ICON.shuffle}Shuffle</button></div>
      <label class="mm-field"><span>Or write your own</span><input id="mmJCustom" maxlength="140" placeholder="e.g. more consistent than my sleep schedule" value="${esc(M.joke.custom)}"></label></div>`;
  if (M.mode === 'cap') return `
    <div class="mm-box"><div class="mm-h">Captions <small id="mmCapCount">${CAPTIONS.length} presets</small></div>
      <label class="mm-field"><span>Top text</span><textarea id="mmTop" rows="2" maxlength="120">${esc(M.cap.top)}</textarea></label>
      <label class="mm-field"><span>Bottom text</span><textarea id="mmBot" rows="2" maxlength="120">${esc(M.cap.bot)}</textarea></label>
      <div class="mm-row"><button class="mm-btn sm" id="mmCShuffle">${ICON.shuffle}Shuffle caption</button></div></div>
    <div class="mm-box"><div class="mm-h">Style</div>
      <label class="mm-field"><span>Text size <b id="mmSizeV">${M.cap.size ? M.cap.size + 'px' : 'Auto'}</b></span><input type="range" id="mmSize" min="0" max="150" step="5" value="${M.cap.size}"></label>
      <div class="mm-field"><span>Text colour</span><div class="mm-swatches">${SWATCH.map(([c, n]) => `<button style="--c:${c}" data-c="${c}" aria-label="${n}" aria-pressed="${M.cap.color === c}"></button>`).join('')}<label class="mm-pick" aria-label="Custom colour"><input type="color" id="mmColor" value="${M.cap.color}"></label></div></div>
      <div class="mm-field"><span>Background</span><div class="mm-seg" id="mmBg">${[['scene', 'Card scene'], ['world', 'Its world'], ['spot', 'Spotlight']].map(([k, l]) => `<button data-bg="${k}" aria-pressed="${M.cap.bg === k}">${l}</button>`).join('')}</div></div></div>`;
  const t = tplById[M.tpl];
  return `
    <div class="mm-box"><div class="mm-h">Template <small>${TEMPLATES.length} scenes, all drawn in code</small></div>
      <div class="mm-tpls" id="mmTpls">${TEMPLATES.map((x) => `<button class="mm-tpl" data-t="${x.id}" aria-pressed="${x.id === M.tpl}"><canvas width="216" height="216"></canvas><span>${esc(x.name)}<em></em></span></button>`).join('')}</div></div>
    <div id="mmTplOpts">${tplOptsHTML(t)}</div>`;
}
const ROLE = { s: 'a seed', p: 'a plant', r: 'a spirit', sp: 'a seed or plant', sr: 'a seed or spirit', pr: 'a plant or spirit' };
function otherSlots(t) { const ps = Math.max(0, primarySlot(t, kindOf(M.id))); return Array.from({ length: t.n }, (_, s) => s).filter((s) => s !== ps && slotRole(t, s) !== 'same'); }
function tplOptsHTML(t) {
  const others = otherSlots(t);
  return `${others.length ? `<div class="mm-box"><div class="mm-h">Other Pockets in this scene</div>${others.map((s) => { const r = slotRole(t, s); return `<div class="mm-idrow sm"><span>#</span><input data-slot="${s}" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${extraFor(t.id, s, M.id)}" aria-label="Pocket in slot ${s + 1}"><button class="mm-btn sm" data-rslot="${s}">${ICON.dice}Random</button></div>${r ? `<p class="mm-slotnote">Needs ${ROLE[r] || 'a Pocket'}</p>` : ''}<p class="mm-err" data-slot-err="${s}" hidden></p>`; }).join('')}</div>` : ''}
    ${t.fields.length ? `<div class="mm-box"><div class="mm-h">Text <button class="mm-link" id="mmReset">Reset</button></div><div id="mmFields">${t.fields.map((f) => `<label class="mm-field"><span>${esc(f.label)}</span><input data-f="${f.k}" maxlength="140"></label>`).join('')}</div></div>` : ''}`;
}
function syncFieldInputs(t, P) {
  const vals = fieldVals(t, P);
  document.querySelectorAll('#mmFields [data-f]').forEach((el) => { if (document.activeElement !== el && el.value !== vals[el.dataset.f]) el.value = vals[el.dataset.f]; });
  const want = otherSlots(t).join(), have = [...document.querySelectorAll('[data-slot]')].map((el) => el.dataset.slot).join();
  if (want !== have) { const o = $('#mmTplOpts'); if (o) { o.innerHTML = tplOptsHTML(t); return syncFieldInputs(t, P); } }
  document.querySelectorAll('[data-slot]').forEach((el) => { if (document.activeElement !== el) el.value = extraFor(t.id, Number(el.dataset.slot), M.id); });
}
function buildControls() {
  $('#mmControls').innerHTML = controlsHTML();
  document.querySelectorAll('.mm-modes button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.m === M.mode)));
  thumbSig = '';
}
function setMode(m) { M.mode = m; buildControls(); schedule(); }
// Accepts "123", "#123" or a number. Anything else (0, 2501, letters, decimals) is rejected with a message.
function parseId(v) { const m = String(v ?? '').trim().match(/^#?\s*(\d{1,4})$/); const n = m ? Number(m[1]) : NaN; return n >= 1 && n <= 2500 ? n : null; }
function setId(v, { push = true } = {}) {
  const id = parseId(v), err = $('#mmIdErr');
  if (id == null || !A.byId().has(id)) { err.textContent = String(v ?? '').trim() === '' ? 'Type a Pocket number from 1 to 2500.' : `\u201c${String(v).slice(0, 12)}\u201d isn\u2019t a Pocket. Numbers go from 1 to 2500.`; err.hidden = false; if (M.id != null) $('#mmId').value = M.id; return false; }
  err.hidden = true; M.id = id; $('#mmId').value = id;
  if (push) history.replaceState(null, '', `#/meme/${id}`);
  thumbSig = ''; schedule(); return true;
}
function shuffleCaption() { const I = M.last?.I && M.last.I.id === M.id ? M.last.I : info(M.id); syncCaption(I, true); schedule(); }
// Random respects the kind chips, and in template mode also the kinds the current template accepts.
function rollKinds() { const f = M.kindFilter; if (M.mode !== 'tpl') return f; const tk = tplKinds(tplById[M.tpl]); const both = f ? [...f].filter((k) => tk.includes(k)).join('') : tk; return both || f; }

let mounted = false;
function mount() {
  const root = $('#meme');
  root.innerHTML = `
  <div class="mm-stage">
    <div class="mm-canvas"><canvas id="mmCanvas" width="${W}" height="${H}" role="img" aria-label="Meme preview"></canvas><div class="mm-loading" id="mmLoading" hidden><i></i></div></div>
    <div class="mm-actions">
      <button class="mm-btn primary" id="mmDownload">${ICON.dl}Download PNG</button>
      <a class="mm-btn" id="mmX" href="#" target="_blank" rel="noopener">${ICON.x}Post on X</a>
      <button class="mm-btn" id="mmShare" hidden>${ICON.share}Share</button>
    </div>
    <p class="mm-hint">Post on X opens a ready-made post with the site link. Links can't carry images, so download the PNG and attach it${navigator.share ? ', or use Share to send the image straight from your phone' : ''}.</p>
  </div>
  <div class="mm-panel">
    <div class="mm-modes" role="tablist" aria-label="Meme type">
      <button role="tab" data-m="card"><b>Stat card</b><small>real stats + a joke</small></button>
      <button role="tab" data-m="cap"><b>Captions</b><small>classic top / bottom</small></button>
      <button role="tab" data-m="tpl"><b>Templates</b><small>${TEMPLATES.length} scenes</small></button>
    </div>
    <div class="mm-box">
      <div class="mm-h">Pocket</div>
      <div class="mm-idrow"><span>#</span><input id="mmId" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="1–2500" aria-label="Pocket id"><button class="mm-btn sm" id="mmRandom">${ICON.dice}Random</button></div>
      <div class="mm-seg" id="mmKinds" aria-label="Random picks from">${[['', 'Any'], ['s', 'Seed'], ['p', 'Plant'], ['r', 'Spirit']].map(([k, l]) => `<button data-k="${k}" aria-pressed="${M.kindFilter === k}">${l}</button>`).join('')}</div>
      <p class="mm-err" id="mmIdErr" role="alert" hidden></p>
      <p class="mm-status" id="mmStatus">Loading…</p>
      <div class="mm-row"><div class="mm-seg" id="mmDN"><button data-dn="0">Day art</button><button data-dn="1">Night art</button></div></div>
    </div>
    <div id="mmControls"></div>
  </div>`;
  if (navigator.share) $('#mmShare').hidden = false;
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
  $('#mmId').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setId(e.target.value); } });
  $('#mmId').addEventListener('blur', (e) => { if (String(e.target.value).trim() !== String(M.id)) setId(e.target.value); });
  mounted = true;
}
function syncDN() { document.querySelectorAll('#mmDN button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.dn === '1') === M.night))); }
async function onClick(e) {
  const b = e.target.closest('button, a'); if (!b) return;
  if (b.dataset.m) return setMode(b.dataset.m);
  if (b.id === 'mmRandom') return setId(randomId(rollKinds(), M.id));
  if (b.dataset.k != null && b.closest('#mmKinds')) { M.kindFilter = b.dataset.k; document.querySelectorAll('#mmKinds button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return setId(randomId(rollKinds(), M.id)); }
  if (b.dataset.dn != null) { M.night = b.dataset.dn === '1'; syncDN(); thumbSig = ''; return schedule(); }
  if (b.dataset.j) { const n = M.joke.list.length; if (!n) return; M.joke.custom = ''; const ci = $('#mmJCustom'); if (ci) ci.value = ''; M.joke.i = (M.joke.i + Number(b.dataset.j) + n) % n; return schedule(); }
  if (b.id === 'mmJShuffle') { const n = M.joke.list.length; if (n < 2) return; M.joke.custom = ''; $('#mmJCustom').value = ''; let i; do { i = Math.floor(Math.random() * n); } while (i === M.joke.i); M.joke.i = i; return schedule(); }
  if (b.id === 'mmCShuffle') return shuffleCaption();
  if (b.dataset.c) { M.cap.color = b.dataset.c; document.querySelectorAll('.mm-swatches button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('#mmColor').value = b.dataset.c; return schedule(); }
  if (b.dataset.bg) { M.cap.bg = b.dataset.bg; document.querySelectorAll('#mmBg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return schedule(); }
  if (b.dataset.t) {
    const t = tplById[b.dataset.t]; M.tpl = t.id;
    if (!allowed(t, kindOf(M.id))) { M.note = `${t.name} is for ${kindsLabel(tplKinds(t)).toLowerCase()}, so I rolled one for you.`; $('#mmTplOpts').innerHTML = ''; syncTplGrid(); setId(randomId(rollKinds(), M.id)); return; }
    $('#mmTplOpts').innerHTML = tplOptsHTML(t); syncTplGrid(); schedule(); return;
  }
  if (b.dataset.rslot) { const s = Number(b.dataset.rslot), t = tplById[M.tpl]; M.extra[M.tpl + ':' + s] = randomId(slotRole(t, s) || t.prefer?.[s] || null, M.id); return schedule(); }
  if (b.id === 'mmReset') { M.fields[M.tpl] = {}; document.querySelectorAll('#mmFields [data-f]').forEach((el) => { el.value = ''; }); return schedule(); }
  if (b.id === 'mmDownload') { const bl = await blob(); if (!bl) return; const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = fname(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return; }
  if (b.id === 'mmShare') {
    const bl = await blob(); const file = bl && new File([bl], fname(), { type: 'image/png' }); const txt = shareText(M.last.I);
    try { if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${txt}\n${SITE}` }); else await navigator.share({ text: txt, url: SITE }); } catch (err) { /* user cancelled */ }
    return;
  }
}
function onInput(e) {
  const el = e.target;
  if (el.id === 'mmJCustom') { M.joke.custom = el.value; return schedule(); }
  if (el.id === 'mmTop') { M.cap.top = el.value; M.cap.edited = true; return schedule(); }
  if (el.id === 'mmBot') { M.cap.bot = el.value; M.cap.edited = true; return schedule(); }
  if (el.id === 'mmSize') { M.cap.size = Number(el.value); $('#mmSizeV').textContent = M.cap.size ? M.cap.size + 'px' : 'Auto'; return schedule(); }
  if (el.id === 'mmColor') { M.cap.color = el.value; document.querySelectorAll('.mm-swatches button').forEach((x) => x.setAttribute('aria-pressed', 'false')); return schedule(); }
  if (el.dataset.f) { (M.fields[M.tpl] ||= {})[el.dataset.f] = { v: el.value, dirty: true }; return schedule(); }
}
function onChange(e) {
  const el = e.target;
  if (el.dataset.slot) {
    const s = Number(el.dataset.slot), t = tplById[M.tpl], r = slotRole(t, s), n = parseId(el.value), errEl = document.querySelector(`[data-slot-err="${s}"]`);
    const bad = n == null ? 'Numbers go from 1 to 2500.' : n === M.id ? 'Pick a different Pocket from the main one.' : r && !r.includes(kindOf(n)) ? `#${n} is a ${SEGNAME[A.byId().get(n).seg].toLowerCase()}; this spot needs ${ROLE[r]}.` : '';
    if (errEl) { errEl.textContent = bad; errEl.hidden = !bad; }
    if (bad) { el.value = extraFor(M.tpl, s, M.id); return; }
    M.extra[M.tpl + ':' + s] = n; schedule();
  }
}

// ---------------- entry points ----------------
export function openMeme(app, id) {
  A = app;
  if (!mounted) { mount(); M.night = !!A.night(); }
  syncDN(); buildControls();
  const want = id && A.byId().has(id) ? id : M.id ?? randomId('r');
  setId(want, { push: !id });
  window.__meme = { M, TEMPLATES, CAPTIONS, render, setMode, setId, info, jokesFor, capsFor, allowed: (tid, id) => allowed(tplById[tid], kindOf(id)), slotIds, kindOf,
    _byId: () => A.byId(), select: (t) => { M.mode = 'tpl'; M.tpl = t; buildControls(); return render(); } };
}
