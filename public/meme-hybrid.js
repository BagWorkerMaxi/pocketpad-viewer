// "Pocket Buddy": Shreyas's pixel seed character, body tinted with the Pocket's own colour and the
// Pocket's sprite worn on its head as a hat. The eyes stay exactly as in the original art.
// Port of the approved prototype (distort-test/make_samples.py). The base art is pre-cut once into
// /hybrid/base.png (256x256 work canvas, sprout removed) and /hybrid/mask.png (R = body, G = soil).
const WORK = 256;
const GEO = { headCx: 126, headTop: 104, bodyLeft: 59, bodyRight: 195 };
const FALLBACK = [194, 126, 79];

// Python round(): ties go to the even neighbour, so the port lands on the same pixels.
const pyRound = (v) => { const f = Math.floor(v), d = v - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };
const lumOf = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn; let h = 0;
  if (df) h = mx === r ? (((g - b) / df) % 6 + 6) % 6 * 60 : mx === g ? ((b - r) / df + 2) * 60 : ((r - g) / df + 4) * 60;
  return [h, mx ? df / mx : 0, mx];
}
function fromHsv(H, S, V) {
  S = Math.max(0, Math.min(1, S)); V = Math.max(0, Math.min(1, V));
  const C = V * S, X = C * (1 - Math.abs((H / 60) % 2 - 1)), m = V - C;
  const [r, g, b] = H < 60 ? [C, X, 0] : H < 120 ? [X, C, 0] : H < 180 ? [0, C, X] : H < 240 ? [0, X, C] : H < 300 ? [X, 0, C] : [C, 0, X];
  return [r, g, b].map((c) => Math.max(0, Math.min(255, pyRound((c + m) * 255))));
}
export function shades(rgb) {
  const [h, s, v] = hsv(...rgb);
  return [fromHsv(h, Math.min(1, s * 1.15), Math.max(0.12, v * 0.42)), fromHsv(h, s, v), fromHsv(h, Math.max(0, s * 0.72), Math.min(1, v * 1.18 + 0.12))];
}
// Characteristic colours of a sprite: dull wood/pot browns down-weighted, upper pixels favoured.
function spriteColors(d, w, h, n = 5) {
  const weights = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2]; if (d[i + 3] < 200) continue;
    const l = lumOf(r, g, b); if (!(l > 0.12 && l < 0.95)) continue;
    const [hu, sa] = hsv(r, g, b), yn = 1 - y / Math.max(1, h - 1);
    const key = [r, g, b].map((c) => (c >> 4) * 16 + 8).join(',');
    const dull = hu >= 15 && hu <= 45 && sa < 0.55;
    weights.set(key, (weights.get(key) || 0) + (0.25 + sa) * (1.15 + 0.55 * yn) * (dull ? 0.28 : 1));
  }
  const ranked = [...weights].sort((a, b) => b[1] - a[1]), picked = [];
  for (const [k] of ranked) { const c = k.split(',').map(Number);
    if (picked.some((p) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2 < 1600)) continue;
    picked.push(c); if (picked.length >= n) break; }
  return picked.length ? picked : [FALLBACK];
}
function percentile(sorted, q) { const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); }
// Luminance-preserving map onto dark / mid / light shades of one colour. Returns new RGB per masked pixel.
function tint(src, idx, colour) {
  const pal = shades(colour), lums = idx.map((i) => lumOf(src[i], src[i + 1], src[i + 2])), s = [...lums].sort((a, b) => a - b);
  const lo = percentile(s, 0.05), hi = percentile(s, 0.95);
  return idx.map((i, k) => { const t = hi - lo < 0.05 ? Math.max(0, Math.min(1, lums[k])) : Math.max(0, Math.min(1, (lums[k] - lo) / (hi - lo)));
    const [a, b, u] = t <= 0.5 ? [pal[0], pal[1], t / 0.5] : [pal[1], pal[2], (t - 0.5) / 0.5];
    return [0, 1, 2].map((c) => Math.max(0, Math.min(255, Math.floor(a[c] + (b[c] - a[c]) * u)))); });
}

const prep = new WeakMap();
function basePrep(base, mask) {
  if (prep.has(base)) return prep.get(base);
  const read = (im) => { const c = document.createElement('canvas'); c.width = c.height = WORK; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, WORK, WORK).data; };
  const px = read(base), mk = read(mask), body = [], soil = [];
  for (let i = 0; i < px.length; i += 4) { if (mk[i] > 127) body.push(i); else if (mk[i + 1] > 127) soil.push(i); }
  const out = { px, body, soil }; prep.set(base, out); return out;
}
function nnFit(w, h, maxW, maxH) {
  let s = Math.max(1, Math.min(Math.floor(maxW / w), Math.floor(maxH / h)));
  if (w * s > maxW || h * s > maxH) { const f = Math.min(maxW / w, maxH / h); return [Math.max(1, pyRound(w * f)), Math.max(1, pyRound(h * f))]; }
  return [w * s, h * s];
}
const cache = new Map();
// Returns { art: 256x256 canvas, accent: [r,g,b] } for one Pocket. Cached per sprite.
export function buddy(I, base, mask) {
  const sp = I && I.sprite; if (!sp || !base || !mask) return null;
  const key = `${I.id}:${I.seg}:${I.stem}:${I.night ? 1 : 0}`; if (cache.has(key) && cache.get(key).sp === sp) return cache.get(key);
  const sw = sp.naturalWidth || sp.width, sh = sp.naturalHeight || sp.height;
  const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh; const sx = sc.getContext('2d', { willReadFrequently: true }); sx.drawImage(sp, 0, 0);
  // Seeds and plants: the pot or shelf drowns out the seed skin and foliage, so sample the top 60%.
  const sampleH = I.seg !== 'reveal' && sh >= 16 ? Math.floor(sh * 0.6) : sh;
  const palette = spriteColors(sx.getImageData(0, 0, sw, sampleH).data, sw, sampleH);
  const ok = (c, vmin) => { const [h, s, v] = hsv(...c); return v >= vmin && !(h >= 15 && h <= 45 && s < 0.62); };
  const bodyCol = palette.find((c) => ok(c, 0.5)) || palette.find((c) => ok(c, 0.38)) || palette[0];
  const darkCol = palette.reduce((m, c) => (lumOf(...c) < lumOf(...m) ? c : m), palette[0]);

  const B = basePrep(base, mask), px = new Uint8ClampedArray(B.px);
  tint(B.px, B.body, bodyCol).forEach((c, k) => { const i = B.body[k]; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; });
  if (B.soil.length) tint(B.px, B.soil, darkCol).forEach((c, k) => { const i = B.soil[k];
    for (let j = 0; j < 3; j++) px[i + j] = Math.floor(Math.fround(Math.fround(B.px[i + j] * Math.fround(0.45)) + Math.fround(c[j] * Math.fround(0.55)))); });
  const art = document.createElement('canvas'); art.width = art.height = WORK; const ax = art.getContext('2d', { willReadFrequently: true }); ax.putImageData(new ImageData(px, WORK, WORK), 0, 0);
  // The hat: the Pocket's own sprite, nearest-neighbour, sitting on the head and overlapping the scalp a little.
  const headW = Math.max(8, GEO.bodyRight - GEO.bodyLeft), [cw, ch] = nnFit(sw, sh, Math.floor(headW * 0.85), Math.floor(WORK * 0.42));
  const cx = pyRound(GEO.headCx - cw / 2); let cy = pyRound(GEO.headTop + 4 - ch); if (cy < 2) cy = 2;
  ax.imageSmoothingEnabled = false; ax.drawImage(sc, 0, 0, sw, sh, cx, cy, cw, ch);
  // Bounding box of everything that isn't the white background, for centring.
  const d = ax.getImageData(0, 0, WORK, WORK).data; let bx0 = WORK, by0 = WORK, bx1 = 0, by1 = 0;
  for (let y = 0; y < WORK; y++) for (let x = 0; x < WORK; x++) { const i = (y * WORK + x) * 4;
    if (d[i + 3] > 16 && !(d[i] >= 245 && d[i + 1] >= 245 && d[i + 2] >= 245)) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
  const bbox = bx1 >= bx0 ? [bx0, by0, bx1 + 1, by1 + 1] : [0, 0, WORK, WORK];
  const out = { art, accent: shades(palette[0])[1], bbox, sp, body: px, lid: shades(bodyCol), hat: { sc, sw, sh, cx, cy, cw, ch } }; cache.set(key, out); if (cache.size > 60) cache.delete(cache.keys().next().value); return out;
}

// ---------------- "Make it move" (animated GIF frames) ----------------
// /hybrid/eyes.png marks the inside of each big eye (R 255 = left, R 128 = right), cut from base.png.
const OUTLINE = [3, 2, 3]; // the art's own outline colour
export const PAD = 16;     // frame canvases are WORK + 2*PAD square, so the hop and the hat sway never clip
const eyeMemo = new WeakMap();
function eyeInfo(eyes) {
  if (eyeMemo.has(eyes)) return eyeMemo.get(eyes);
  const c = document.createElement('canvas'); c.width = c.height = WORK; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(eyes, 0, 0);
  const d = x.getImageData(0, 0, WORK, WORK).data, E = [[], []];
  for (let i = 0; i < d.length; i += 4) { const r = d[i]; if (r > 200) E[0].push(i); else if (r > 100 && r < 160) E[1].push(i); }
  const out = E.filter((e) => e.length).map((idx) => { let x0 = WORK, y0 = WORK, x1 = 0, y1 = 0; const set = new Set(idx);
    for (const i of idx) { const p = i / 4, xx = p % WORK, yy = (p - xx) / WORK; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    return { idx, set, x0, y0, x1, y1 }; });
  eyeMemo.set(eyes, out); return out;
}
// Body pixels with the eyes half shut (lid 1) or shut (lid 2): lids in the body's mid tone, a pixel line in the outline colour.
function lidded(b, eyes, lid) {
  const key = 'lid' + lid; if (b[key]) return b[key];
  const px = new Uint8ClampedArray(b.body), L = b.lid[1], put = (i, c) => { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (const e of eyeInfo(eyes)) {
    const cy = Math.round((e.y0 + e.y1) / 2), cx = (e.x0 + e.x1) / 2, hw = (e.x1 - e.x0) / 2;
    if (lid === 1) { // upper lid down to the middle, with a straight 6px lash line
      for (const i of e.idx) { const p = i / 4, y = (p - p % WORK) / WORK; if (y < cy - 3) put(i, L); else if (y < cy + 3) put(i, OUTLINE); }
    } else {          // fully shut: lid fills the eye, a 6px line sagging gently in the middle (a happy closed eye)
      for (const i of e.idx) put(i, L);
      for (let x = Math.ceil(e.x0 + 6); x <= e.x1 - 6; x++) { const u = (x - cx) / (hw - 6), yc = cy - 4 + 2 * Math.round(2.5 * (1 - u * u));
        for (let y = yc - 3; y < yc + 3; y++) { const i = (y * WORK + x) * 4; if (e.set.has(i)) put(i, OUTLINE); } }
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = WORK; c.getContext('2d').putImageData(new ImageData(px, WORK, WORK), 0, 0);
  return (b[key] = c);
}
function bodyCanvas(b) { if (b.lid0) return b.lid0; const c = document.createElement('canvas'); c.width = c.height = WORK; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(b.body), WORK, WORK), 0, 0); return (b.lid0 = c); }
// One animation frame on a (WORK + 2*PAD)^2 canvas: dy = whole-pixel hop (<= 0), lid = 0/1/2, tilt = hat sway in px at its top.
// The sway is a per-row shear (the hat's bottom row stays on the head), so every pixel stays a crisp square.
let fc = null;
export function buddyFrame(b, eyes, { dy = 0, lid = 0, tilt = 0 } = {}) {
  const S = WORK + 2 * PAD; if (!fc) { fc = document.createElement('canvas'); fc.width = fc.height = S; }
  const x = fc.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, S, S); x.imageSmoothingEnabled = false;
  x.drawImage(lid && eyes ? lidded(b, eyes, lid) : bodyCanvas(b), PAD, PAD + dy);
  const { sc, sw, sh, cx, cy, cw, ch } = b.hat;
  for (let r = 0; r < sh; r++) { const y0 = Math.round(r * ch / sh), y1 = Math.round((r + 1) * ch / sh); if (y1 <= y0) continue;
    const dx = Math.round(tilt * (1 - (r + 0.5) / sh));
    x.drawImage(sc, 0, r, sw, 1, PAD + cx + dx, PAD + cy + y0 + dy, cw, y1 - y0); }
  return fc;
}
