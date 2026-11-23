// Hand-drawn (procedural) pixel-art tile textures for the three worlds. Everything here is
// generated on a canvas at runtime; no external assets.
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
const px = (x, X, Y, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
const pick = (r, a) => a[Math.floor(r() * a.length)];

const PAL = {
  soil: {
    day: { base: ['#6a4428', '#5e3b22', '#744b2d', '#553520'], dark: '#3f2716', furrow: '#4a2e1a', light: '#8a5d38', hole: '#2a180d', holeRim: '#3a2313', pebble: ['#9a8f84', '#7d7268', '#b5aba0'], root: '#b48a58', worm: ['#e39a8f', '#c97a70'] },
    night: { base: ['#2e2433', '#28202e', '#342839', '#241c29'], dark: '#18121c', furrow: '#1e1722', light: '#41344a', hole: '#0e0a10', holeRim: '#171119', pebble: ['#5a5868', '#4a4858', '#6c6a7c'], root: '#5e5068', worm: ['#7d5a6e', '#6a4a5c'] },
  },
  garden: {
    day: { grass: ['#5fb04a', '#55a243', '#69bb52', '#4e9a3e'], blade: '#7fcc5c', shade: '#3f8434', bed: ['#7a4f2c', '#6e4527', '#855833'], furrow: '#5a381e', flower: ['#ffe36b', '#ff8fb1', '#ffffff', '#9fd0ff'] },
    night: { grass: ['#1f4a3e', '#1b4338', '#235244', '#183d33'], blade: '#2c6352', shade: '#123029', bed: ['#33283a', '#2d2333', '#3a2e40'], furrow: '#211a27', flower: ['#d8d07a', '#c88fb0', '#c9d3f0', '#8fb0e0'] },
  },
  heaven: {
    day: { c1: '#ffffff', c2: '#f3efff', c3: '#d9d2f5', c4: '#bfb5e8', halo: '#ffd45e', haloD: '#e3a72e', wing: '#ffffff', wingS: '#dcd6f2', wingO: '#b8afe0' },
    night: { c1: '#e9e4ff', c2: '#c9c0f0', c3: '#9d93d4', c4: '#776db5', halo: '#ffe08a', haloD: '#f0b84a', wing: '#f2efff', wingS: '#c4bce8', wingO: '#8d84c4' },
  },
};

function soilTile(v, P) {
  const [c, x] = canvas(16, 16), r = rng(101 + v * 977);
  for (let y = 0; y < 16; y++) for (let X = 0; X < 16; X++) px(x, X, y, pick(r, P.base));
  for (let i = 0; i < 18; i++) px(x, Math.floor(r() * 16), Math.floor(r() * 16), r() < .5 ? P.light : P.dark);
  // tilled furrows
  for (let X = 0; X < 16; X++) { if (r() < .8) px(x, X, 5, P.furrow); if (r() < .8) px(x, X, 10, P.furrow); px(x, X, 15, P.dark); }
  for (let y = 0; y < 16; y++) px(x, 15, y, P.dark);
  // pebbles
  const peb = v === 1 ? 3 : 1 + (v % 2);
  for (let i = 0; i < peb; i++) { const X = 1 + Math.floor(r() * 12), Y = 1 + Math.floor(r() * 12); px(x, X, Y, P.pebble[0], 2, 1); px(x, X, Y + 1, P.pebble[1], 2, 1); px(x, X, Y, P.pebble[2]); }
  if (v === 2) { let X = 2, Y = 1; for (let i = 0; i < 10; i++) { px(x, X, Y, P.root); Y += 1; X += r() < .5 ? 0 : (r() < .5 ? -1 : 1); X = Math.max(0, Math.min(14, X)); } }
  if (v === 3) { const W = P.worm; [[10, 2], [11, 2], [12, 3], [12, 4], [11, 5], [10, 5]].forEach(([a, b], i) => px(x, a, b, W[i % 2])); }
  // burrow where the seed rests
  px(x, 4, 12, P.holeRim, 8, 1); px(x, 3, 13, P.hole, 10, 2); px(x, 5, 12, P.hole, 6, 1);
  return c.toDataURL();
}
function surface(P, night) {
  const [c, x] = canvas(16, 12), r = rng(55);
  const g = night ? ['#1f4a3e', '#235244', '#183d33'] : ['#5fb04a', '#69bb52', '#4e9a3e'];
  for (let y = 0; y < 12; y++) for (let X = 0; X < 16; X++) px(x, X, y, y < 6 ? pick(r, g) : pick(r, P.base));
  for (let X = 0; X < 16; X++) { const h = 1 + Math.floor(r() * 3); px(x, X, 6 - h, g[1], 1, h); px(x, X, 6, P.dark); if (r() < .3) px(x, X, 7, g[2]); }
  return c.toDataURL();
}
function gardenTile(v, P) {
  const [c, x] = canvas(16, 16), r = rng(303 + v * 313);
  for (let y = 0; y < 16; y++) for (let X = 0; X < 16; X++) px(x, X, y, pick(r, P.grass));
  for (let i = 0; i < 14; i++) { const X = Math.floor(r() * 16), Y = Math.floor(r() * 16); px(x, X, Y, P.blade); if (Y < 15) px(x, X, Y + 1, P.shade); }
  // raised bed
  px(x, 2, 7, P.shade, 12, 8);
  for (let y = 7; y < 14; y++) for (let X = 3; X < 13; X++) px(x, X, y, pick(r, P.bed));
  for (let X = 3; X < 13; X++) { px(x, X, 9, P.furrow); px(x, X, 12, P.furrow); px(x, X, 7, P.bed[2]); }
  px(x, 2, 14, P.shade, 12, 1);
  const fl = v === 0 ? 0 : v;
  for (let i = 0; i < fl; i++) { const X = r() < .5 ? Math.floor(r() * 2) : 14 + Math.floor(r() * 2), Y = 1 + Math.floor(r() * 13); px(x, X, Y, pick(r, P.flower)); }
  if (v === 3) { px(x, 6, 2, P.flower[0]); px(x, 7, 1, P.flower[1]); px(x, 9, 3, P.flower[2]); }
  return c.toDataURL();
}
function pathTex(night) {
  const [c, x] = canvas(8, 8), r = rng(9);
  const s = night ? ['#3a3646', '#34303f', '#403b4d', '#2e2a38'] : ['#d8c49a', '#ccb68b', '#e2cfa6', '#c2ab80'];
  for (let y = 0; y < 8; y++) for (let X = 0; X < 8; X++) px(x, X, y, pick(r, s));
  return c.toDataURL();
}
function hedgeTex(night) {
  const [c, x] = canvas(16, 16), r = rng(77);
  const h = night ? ['#0f2a22', '#14352b', '#0b211b', '#1a3f33'] : ['#2f6e2c', '#3a8035', '#255a24', '#4a933f'];
  for (let y = 0; y < 16; y++) for (let X = 0; X < 16; X++) px(x, X, y, pick(r, h));
  for (let i = 0; i < 10; i++) px(x, Math.floor(r() * 16), Math.floor(r() * 16), night ? '#2a5a48' : '#69b552');
  return c.toDataURL();
}
function fenceTex(night) {
  const [c, x] = canvas(16, 12);
  const w = night ? '#6b6276' : '#f3ead2', s = night ? '#4a4354' : '#c9bb98', o = night ? '#2a2530' : '#7d6a4a';
  [[2, 0], [10, 0]].forEach(([X]) => { px(x, X, 1, o, 4, 11); px(x, X + 1, 0, o, 2, 1); px(x, X + 1, 1, w, 2, 10); px(x, X + 2, 2, s, 1, 9); });
  px(x, 0, 3, o, 16, 3); px(x, 0, 4, w, 16, 1); px(x, 0, 8, o, 16, 3); px(x, 0, 9, s, 16, 1);
  return c.toDataURL();
}
function cloudTile(v, P) {
  const [c, x] = canvas(24, 24), r = rng(707 + v * 59);
  const blobs = [[12, 17, 8], [5 + v % 3, 18.5, 5], [19 - v % 2, 18.5, 5], [9, 13.5, 4.5 + (v % 2) * .5], [15.5, 14, 4.5]];
  const inside = (X, Y, sh = 0) => blobs.some(([a, b, rad]) => (X - a) ** 2 + (Y - b - sh) ** 2 <= rad * rad);
  for (let Y = 0; Y < 24; Y++) for (let X = 0; X < 24; X++) {
    if (!inside(X + .5, Y + .5)) { if (inside(X + .5, Y - .5) ) px(x, X, Y, P.c4); continue; }
    const top = !inside(X + .5, Y - .5), low = !inside(X + .5, Y + 2.5);
    px(x, X, Y, top ? P.c1 : low ? P.c3 : (Y > 18 ? P.c2 : P.c1));
  }
  for (let i = 0; i < 4; i++) { const X = 6 + Math.floor(r() * 12), Y = 12 + Math.floor(r() * 4); if (inside(X, Y)) px(x, X, Y, '#ffffff'); }
  return c.toDataURL();
}
function wing(P, right) {
  const [c, x] = canvas(12, 12);
  const L = ['oo..........', 'owoo........', 'owwwoo......', '.owwwwoo....', '.owswwwwo...', '..owsswwwo..', '..owwsswwwo.', '...owwssswo.', '....owwwwo..', '.....oooo...'];
  L.forEach((row, y) => [...row].forEach((ch, X) => { if (ch === '.') return; const col = ch === 'o' ? P.wingO : ch === 's' ? P.wingS : P.wing; px(x, right ? 11 - X : X, y + 1, col); }));
  return c.toDataURL();
}
function halo(P) {
  const [c, x] = canvas(16, 6);
  px(x, 4, 1, P.haloD, 8, 1); px(x, 2, 2, P.haloD, 2, 1); px(x, 12, 2, P.haloD, 2, 1); px(x, 2, 3, P.haloD, 2, 1); px(x, 12, 3, P.haloD, 2, 1); px(x, 4, 4, P.haloD, 8, 1);
  px(x, 4, 0, P.halo, 8, 1); px(x, 2, 1, P.halo, 2, 1); px(x, 12, 1, P.halo, 2, 1); px(x, 1, 2, P.halo, 1, 2); px(x, 14, 2, P.halo, 1, 2); px(x, 2, 4, P.halo, 2, 1); px(x, 12, 4, P.halo, 2, 1); px(x, 4, 5, P.halo, 8, 1);
  return c.toDataURL();
}
const cache = {};
export function textures(view, night) {
  const key = view + night; if (cache[key]) return cache[key];
  const t = night ? 'night' : 'day', out = {};
  if (view === 'soil') { const P = PAL.soil[t]; for (let v = 0; v < 4; v++) out['t' + v] = soilTile(v, P); out.surface = surface(P, night); }
  if (view === 'garden') { const P = PAL.garden[t]; for (let v = 0; v < 4; v++) out['t' + v] = gardenTile(v, P); out.path = pathTex(night); out.hedge = hedgeTex(night); out.fence = fenceTex(night); }
  if (view === 'heaven') { const P = PAL.heaven[t]; for (let v = 0; v < 4; v++) out['t' + v] = cloudTile(v, P); out.wingL = wing(P, false); out.wingR = wing(P, true); out.halo = halo(P); }
  return (cache[key] = out);
}
