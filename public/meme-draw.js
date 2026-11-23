// Canvas drawing helpers shared by the Meme Maker modes. Everything is drawn in code.
export const W = 1080, H = 1080;
export const RHEX = { Common: '#a9b0b4', Uncommon: '#6fd27e', Rare: '#55aaff', Epic: '#b77cff', Legendary: '#ffb72e', 'One of One': '#ff6fae' };
export const FONTS = { serif: 'Fraunces, Georgia, serif', anton: 'Anton, Impact, "Arial Narrow Bold", sans-serif', pixel: '"Pixelify Sans", ui-monospace, monospace', sans: 'Inter, system-ui, sans-serif' };

export function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function rr(x, x0, y0, w, h, r) {
  r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath();
}
export function box(x, x0, y0, w, h, r, fill, stroke, lw = 4) { rr(x, x0, y0, w, h, r); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.stroke(); } }
export function shadow(x, blur = 30, oy = 12, col = 'rgba(0,0,0,.35)') { x.shadowColor = col; x.shadowBlur = blur; x.shadowOffsetY = oy; x.shadowOffsetX = 0; }
export function noShadow(x) { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; x.shadowOffsetX = 0; }
export function lin(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
export function rad(x, cx, cy, r0, r1, stops) { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

const fontStr = (fam, weight, size, italic) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONTS[fam] || fam}`;
export function wrap(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean); if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) { const t = line + ' ' + words[i]; if (x.measureText(t).width <= maxW) line = t; else { out.push(line); line = words[i]; } }
    out.push(line);
  }
  // break single words that are still too long
  return out.flatMap((l) => { if (x.measureText(l).width <= maxW || l.length < 2) return [l]; const parts = []; let cur = ''; for (const ch of l) { if (x.measureText(cur + ch).width > maxW && cur) { parts.push(cur); cur = ch; } else cur += ch; } parts.push(cur); return parts; });
}
// Fit text into a box: largest size (<= max) whose wrapped lines fit maxW x maxH.
export function fit(x, text, { fam = 'serif', weight = 700, max = 80, min = 14, maxW, maxH, lh = 1.12, italic = false, maxLines = 99 }) {
  let size = max, lines;
  for (; size >= min; size -= 2) { x.font = fontStr(fam, weight, size, italic); lines = wrap(x, text, maxW); if (lines.length <= maxLines && lines.length * size * lh <= maxH) break; }
  if (size < min) {
    size = min; x.font = fontStr(fam, weight, size, italic); const all = wrap(x, text, maxW);
    const fitN = Math.max(1, Math.min(maxLines, Math.floor(maxH / (size * lh)))); lines = all.slice(0, fitN);
    if (all.length > fitN) { let l = lines[fitN - 1]; while (l.length > 1 && x.measureText(l + '\u2026').width > maxW) l = l.slice(0, -1); lines[fitN - 1] = l.replace(/\s+$/, '') + '\u2026'; }
  }
  return { size, lines };
}
// Draw (wrapped, fitted) text. cx/cy is the anchor; valign: middle | top | bottom.
export function text(x, str, cx, cy, o = {}) {
  str = String(str ?? ''); if (!str.trim()) return { h: 0, size: 0 };
  if (o.upper) str = str.toUpperCase();
  const { fam = 'serif', weight = 700, max = 60, min = 14, maxW = 900, maxH = 400, lh = 1.12, color = '#fff', stroke, strokeW, align = 'center', valign = 'middle', italic = false, maxLines, glow } = o;
  const { size, lines } = fit(x, str, { fam, weight, max, min, maxW, maxH, lh, italic, maxLines });
  x.font = fontStr(fam, weight, size, italic); x.textAlign = align; x.textBaseline = 'middle';
  const total = lines.length * size * lh;
  let y = valign === 'top' ? cy + size * lh / 2 : valign === 'bottom' ? cy - total + size * lh / 2 : cy - total / 2 + size * lh / 2;
  for (const l of lines) {
    if (glow) { x.save(); x.shadowColor = glow; x.shadowBlur = size * .5; x.fillStyle = color; x.fillText(l, cx, y); x.restore(); }
    if (stroke) { x.lineJoin = 'round'; x.miterLimit = 2; x.lineWidth = strokeW ?? Math.max(3, size * .16); x.strokeStyle = stroke; x.strokeText(l, cx, y); }
    x.fillStyle = color; x.fillText(l, cx, y); y += size * lh;
  }
  return { h: total, size, lines };
}
export function oneLine(x, str, X, Y, { fam = 'sans', weight = 600, size = 24, color = '#fff', align = 'left', maxW, italic = false, base = 'middle' } = {}) {
  let s = size; x.font = fontStr(fam, weight, s, italic);
  str = String(str ?? '');
  if (maxW) { const floor = Math.max(10, Math.round(size * .6)); while (s > floor && x.measureText(str).width > maxW) { s -= 1; x.font = fontStr(fam, weight, s, italic); }
    if (x.measureText(str).width > maxW) { while (str.length > 1 && x.measureText(str + '\u2026').width > maxW) str = str.slice(0, -1); str = str.replace(/\s+$/, '') + '\u2026'; } }
  x.textAlign = align; x.textBaseline = base; x.fillStyle = color; x.fillText(str, X, Y); return x.measureText(str).width;
}

// Pixel-art sprite, scaled by an integer, bottom-centred at (cx, by), at most h tall and maxW wide
// (default 1.45 h, so short, wide sprites such as low pots or wilting plants don't spill into the next panel).
export function pocket(x, I, cx, by, h, o = {}) {
  const img = I && I.sprite;
  if (!img) { box(x, cx - h * .4, by - h * .8, h * .8, h * .8, 24, 'rgba(255,255,255,.25)', 'rgba(0,0,0,.25)'); oneLine(x, I ? '#' + I.id : '?', cx, by - h * .4, { size: h * .16, align: 'center', color: '#333', weight: 700 }); return { w: h * .8, h: h * .8, top: by - h * .8 }; }
  const iw = img.width, ih = img.height;
  const k = o.exact ? h / ih : Math.max(1, Math.floor(Math.min(h / ih, (o.maxW ?? h * 1.45) / iw))) * (o.shrink || 1);
  const w = iw * k, hh = ih * k, x0 = Math.round(cx - w / 2), y0 = Math.round(by - hh);
  if (o.shadow !== false) { x.save(); x.fillStyle = o.shadowCol || 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx, by - 2, w * .38, Math.max(6, w * .07), 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  if (o.glow) { x.save(); x.fillStyle = rad(x, cx, y0 + hh / 2, 0, Math.max(w, hh) * .85, [[0, o.glow], [1, 'rgba(255,255,255,0)']]); x.fillRect(cx - w * 1.2, y0 - hh * .6, w * 2.4, hh * 2.2); x.restore(); }
  x.save(); x.imageSmoothingEnabled = false; if (o.alpha != null) x.globalAlpha = o.alpha;
  if (o.rot) { x.translate(cx, y0 + hh / 2); x.rotate(o.rot); x.translate(-cx, -(y0 + hh / 2)); }
  if (o.flip) { x.translate(x0 + w / 2, 0); x.scale(-1, 1); x.translate(-(x0 + w / 2), 0); }
  x.drawImage(img, x0, y0, w, hh); x.restore();
  return { w, h: hh, top: y0, left: x0, k };
}
// Pocket's square card scene (80x80 pixel art) or a fallback.
export function scene(x, I, X, Y, S, o = {}) {
  x.save(); x.imageSmoothingEnabled = false;
  if (o.round) rr(x, X, Y, S, S, o.round); else { x.beginPath(); x.rect(X, Y, S, S); }
  x.clip(); // keep the spirit's clouds and glow inside the frame
  if (I && I.seg === 'reveal') { // official spirit cards are near-black; draw a little heaven instead
    const N = I.night; x.fillStyle = lin(x, 0, Y, 0, Y + S, N ? [[0, '#17123a'], [1, '#4a3c8c']] : [[0, '#b9c3ff'], [.6, '#efe6ff'], [1, '#ffe6bd']]); x.fillRect(X, Y, S, S);
    if (N) stars(x, I.id, Math.round(S / 8), X, Y, S, S * .6);
    x.fillStyle = rad(x, X + S / 2, Y + S * .5, S * .05, S * .55, [[0, 'rgba(255,240,190,.85)'], [1, 'rgba(255,240,190,0)']]); x.fillRect(X, Y, S, S);
    for (const [a, b, c] of [[.12, .92, .2], [.4, .98, .22], [.7, .95, .24], [.95, .9, .2], [.5, .9, .2]]) cloud(x, X + a * S, Y + b * S, c * S, N ? '#e2dcff' : '#fff', N ? 'rgba(90,80,170,.5)' : 'rgba(170,160,230,.45)');
    const p = pocket(x, I, X + S / 2, Y + S * .86, S * .62, { shadow: false });
    x.save(); x.lineWidth = Math.max(4, S * .022); x.strokeStyle = '#ffd45e'; x.shadowColor = 'rgba(255,200,60,.9)'; x.shadowBlur = S * .04; x.beginPath(); x.ellipse(X + S / 2, p.top - S * .045, Math.max(S * .1, p.w * .3), S * .028, 0, 0, 7); x.stroke(); x.restore();
  } else if (I && I.card) x.drawImage(I.card, X, Y, S, S);
  else { x.fillStyle = lin(x, 0, Y, 0, Y + S, [[0, '#9fd3ff'], [.7, '#d8f0ff'], [.7, '#79c25a'], [1, '#4e9a3e']]); x.fillRect(X, Y, S, S); if (I) pocket(x, I, X + S / 2, Y + S * .9, S * .7); }
  x.restore();
}
// ---------- props ----------
export function cloud(x, cx, cy, s, fill = '#fff', shade = 'rgba(160,150,220,.35)') {
  const puffs = [[-.55, .1, .42], [-.2, -.18, .55], [.25, -.1, .5], [.6, .12, .38], [0, .18, .5]];
  x.save(); x.fillStyle = shade; for (const [a, b, r] of puffs) { x.beginPath(); x.arc(cx + a * s, cy + b * s + s * .08, r * s, 0, 7); x.fill(); }
  x.fillStyle = fill; for (const [a, b, r] of puffs) { x.beginPath(); x.arc(cx + a * s, cy + b * s, r * s, 0, 7); x.fill(); } x.restore();
}
export function drop(x, cx, cy, s, col = '#5ec8ff') {
  x.save(); x.beginPath(); x.moveTo(cx, cy - s); x.bezierCurveTo(cx + s * .15, cy - s * .55, cx + s * .62, cy - s * .1, cx + s * .62, cy + s * .3);
  x.arc(cx, cy + s * .3, s * .62, 0, Math.PI); x.bezierCurveTo(cx - s * .62, cy - s * .1, cx - s * .15, cy - s * .55, cx, cy - s); x.closePath();
  x.fillStyle = col; x.fill(); x.lineWidth = Math.max(2, s * .1); x.strokeStyle = 'rgba(10,60,110,.55)'; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(cx - s * .22, cy + s * .2, s * .12, s * .2, -.4, 0, 7); x.fill(); x.restore();
}
export function flame(x, cx, by, s, a = 1) {
  x.save(); x.globalAlpha = a;
  const layer = (k, c1, c2) => { x.beginPath(); x.moveTo(cx - s * .5 * k, by); x.bezierCurveTo(cx - s * .62 * k, by - s * .5 * k, cx - s * .18 * k, by - s * .62 * k, cx - s * .05 * k, by - s * 1.25 * k); x.bezierCurveTo(cx + s * .12 * k, by - s * .82 * k, cx + s * .7 * k, by - s * .62 * k, cx + s * .5 * k, by); x.closePath(); x.fillStyle = lin(x, 0, by - s * 1.25 * k, 0, by, [[0, c1], [1, c2]]); x.fill(); };
  layer(1, '#ff8a1e', '#e5341b'); layer(.68, '#ffd23f', '#ff8a1e'); layer(.36, '#fff6b8', '#ffd23f'); x.restore();
}
export function star(x, cx, cy, r, col, pts = 4, inner = .38) {
  x.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = i * Math.PI / pts - Math.PI / 2, rr2 = i % 2 ? r * inner : r; x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } x.closePath(); x.fillStyle = col; x.fill();
}
export function rays(x, cx, cy, n, r, col, rot = 0) {
  x.save(); x.fillStyle = col; for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n, b = a + Math.PI / n; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); x.closePath(); x.fill(); } x.restore();
}
export function stars(x, seed, n, x0, y0, w, h, col = '#fff') { const r = rng(seed); for (let i = 0; i < n; i++) { const s = r() < .15 ? 4 : 2; x.fillStyle = col; x.globalAlpha = .4 + r() * .6; x.fillRect(Math.round(x0 + r() * w), Math.round(y0 + r() * h), s, s); } x.globalAlpha = 1; }
export function wateringCan(x, cx, cy, s, tilt = -.35, col = '#6cc1e8') {
  x.save(); x.translate(cx, cy); x.rotate(tilt); x.lineJoin = 'round';
  const dk = 'rgba(20,50,80,.75)';
  x.lineWidth = s * .09; x.strokeStyle = col; x.beginPath(); x.arc(-s * .05, -s * .42, s * .34, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
  x.beginPath(); x.moveTo(s * .4, -s * .05); x.lineTo(s * 1.0, -s * .5); x.lineTo(s * 1.07, -s * .38); x.lineTo(s * .45, s * .18); x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = s * .04; x.strokeStyle = dk; x.stroke();
  box(x, s * .98, -s * .62, s * .2, s * .3, s * .05, col, dk, s * .04);
  box(x, -s * .5, -s * .3, s * .95, s * .7, s * .14, col, dk, s * .05);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(-s * .4, -s * .2, s * .12, s * .45); x.restore();
}
export function candle(x, cx, by, s) {
  box(x, cx - s * .18, by - s, s * .36, s, s * .06, '#f5ead2', 'rgba(90,60,30,.5)', 3);
  x.fillStyle = 'rgba(255,200,90,.25)'; x.beginPath(); x.arc(cx, by - s * 1.15, s * .6, 0, 7); x.fill();
  flame(x, cx, by - s + 2, s * .34);
}
export function sweat(x, cx, cy, s, n = 3) { s = Math.min(s, 190); /* wide sprites: keep drops off nearby text */ const pos = [[-1, -.2], [1.05, -.35], [-1.2, .35], [1.25, .3], [0, -.75]]; for (let i = 0; i < n; i++) drop(x, cx + pos[i][0] * s, cy + pos[i][1] * s, s * .17, '#7fd4ff'); }
export function badge(x, cx, cy, r, ok) {
  x.save(); shadow(x, 14, 6); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = ok ? '#3fbf5a' : '#e5484d'; x.fill(); noShadow(x);
  x.lineWidth = r * .22; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.beginPath();
  if (ok) { x.moveTo(cx - r * .45, cy + r * .02); x.lineTo(cx - r * .1, cy + r * .38); x.lineTo(cx + r * .5, cy - r * .35); } else { x.moveTo(cx - r * .38, cy - r * .38); x.lineTo(cx + r * .38, cy + r * .38); x.moveTo(cx + r * .38, cy - r * .38); x.lineTo(cx - r * .38, cy + r * .38); }
  x.stroke(); x.restore();
}
export function bubble(x, x0, y0, w, h, tailX, tailY, fill = '#fff', stroke = '#1d1d1d', lw = 5) {
  x.save(); x.beginPath(); const r = Math.min(40, h / 2);
  x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  const mid = Math.max(x0 + r + 30, Math.min(x0 + w - r - 30, tailX));
  x.lineTo(mid + 26, y0 + h); x.lineTo(tailX, tailY); x.lineTo(mid - 20, y0 + h);
  x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath();
  x.fillStyle = fill; x.fill(); if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.lineJoin = 'round'; x.stroke(); } x.restore();
}
// Tile a 16px procedural texture at k x scale over a rect, picking variants by position.
export function tileRect(x, tiles, X, Y, w, h, k = 4, seed = 1) {
  if (!tiles || !tiles.length) return; const t0 = tiles[0], tw = t0.width * k, th = t0.height * k;
  x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip(); x.imageSmoothingEnabled = false;
  for (let yy = Y, j = 0; yy < Y + h; yy += th, j++) for (let xx = X, i = 0; xx < X + w; xx += tw, i++) { const v = (Math.imul(i * 73856093 ^ j * 19349663 ^ seed, 2654435761) >>> 0) % 10; x.drawImage(tiles[[0, 0, 1, 0, 2, 0, 3, 1, 0, 2][v] % tiles.length], xx, yy, tw, th); }
  x.restore();
}
export const fmtLeft = (ms) => { if (ms == null) return ''; if (ms <= 0) return 'past its clock'; const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4); return `${h}h ${String(m).padStart(2, '0')}m`; };
export const fmtAgo = (ms) => { if (ms == null) return ''; const s = Math.max(0, ms / 1000); if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };
// 2 decimals under 10% so a share just under a threshold (e.g. 4.96%) never displays as 5.0%.
export const pct = (s) => (s * 100).toFixed(s < 0.1 ? 2 : 1) + '%';
