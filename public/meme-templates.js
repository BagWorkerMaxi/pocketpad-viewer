// Meme Maker templates: every scene is drawn in code (no meme photos). Captions are editable;
// any default that shows a number reads it from the Pocket's real data.
import { W, H, RHEX, box, rr, text, oneLine, pocket, scene, cloud, drop, flame, star, rays, stars, wateringCan, candle, sweat, badge, bubble, tileRect, lin, rad, shadow, noShadow, rng, fmtLeft, pct } from './meme-draw.js';
import { buddy } from './meme-hybrid.js';

const nm = (I) => I.seg === 'reveal' ? (I.spirit?.name || 'Spirit') : (I.kind || 'Pocket');
// Kinds: s seed, p plant, r spirit. by(I, {s, p, r}) picks the per-kind value.
const by = (I, o) => o[{ seed: 's', plant: 'p', reveal: 'r' }[I.seg]];
export const leftPhrase = (I) => I.leftMs == null ? '' : I.leftMs > 0 ? `${fmtLeft(I.leftMs)} left` : 'past its 72h clock';
const days = (n) => `${n ?? 0} day${n === 1 ? '' : 's'}`;
const ord = (n) => n == null ? '?' : n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const rkS = (I) => I.rk != null ? `#${I.rk.toLocaleString('en-US')}` : '–';
const past = (I) => I.leftMs != null && I.leftMs <= 0;
// The API keeps the old streak number until the next water, so a streak only counts as current
// while the last water was under 48h ago; after that it is shown as the last (broken) streak.
const intact = (I) => I.sinceMs != null && I.sinceMs < 48 * 36e5;
const streakPhrase = (I) => past(I) ? `streak ended at ${days(I.streak)}` : intact(I) ? `${I.streak}-day streak` : `last streak ${days(I.streak)}`;
const hw = (I) => I.hstate === 'heal1' || I.hstate === 'heal2' ? `healing, ${I.hdetail}` : (I.hword || '').toLowerCase();
const realLine = (I) => by(I, { p: past(I) ? `${streakPhrase(I)} · ${leftPhrase(I)}` : `${streakPhrase(I)} · ${hw(I)} · ${leftPhrase(I)}`,
  r: `${ord(I.dn)} spirit to rise · rank ${rkS(I)}`, s: `${I.rarity || ''} ${I.kind || 'seed'} · not planted yet`.trim() });
const caps = { fam: 'anton', weight: 400, color: '#fff', stroke: '#111', upper: true };

export const TEMPLATES = [
  // ---------------------------------------------------------------- game-flavored
  { id: 'wanted', name: 'Wanted poster', n: 1, kinds: 'spr', fields: [
      { k: 'crime', label: 'Wanted for', def: (P) => by(P[0], { p: past(P[0]) ? 'letting its 72h clock run out' : 'making me check the watering clock every hour', r: 'escaping to heaven without telling anyone', s: 'refusing to be planted' }) },
      { k: 'sub', label: 'Subtitle', def: (P) => by(P[0], { p: past(P[0]) ? 'last seen at 72h' : 'dead or watered', r: 'last seen ascending', s: 'planted or not' }) },
      { k: 'reward', label: 'Reward', def: (P) => by(P[0], { p: past(P[0]) ? 'reward: one (1) spirit reveal' : 'reward: one (1) watering can', r: 'reward: one (1) halo polish', s: 'reward: one (1) bag of soil' }) }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = '#3b2615'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#4a301b' : '#422a17'; x.fillRect(0, i * 120, W, 120); }
      x.save(); shadow(x, 40, 18, 'rgba(0,0,0,.6)'); x.translate(W / 2, H / 2); x.rotate(-.015);
      const pw = 800, ph = 960; x.beginPath(); const r = rng(I.id); x.moveTo(-pw / 2, -ph / 2);
      for (let i = 0; i <= 20; i++) x.lineTo(-pw / 2 + i * pw / 20, -ph / 2 + (r() - .5) * 10);
      for (let i = 0; i <= 24; i++) x.lineTo(pw / 2 + (r() - .5) * 10, -ph / 2 + i * ph / 24);
      for (let i = 20; i >= 0; i--) x.lineTo(-pw / 2 + i * pw / 20, ph / 2 + (r() - .5) * 10);
      for (let i = 24; i >= 0; i--) x.lineTo(-pw / 2 + (r() - .5) * 10, -ph / 2 + i * ph / 24);
      x.fillStyle = '#ecd6a4'; x.fill(); noShadow(x);
      x.fillStyle = rad(x, 0, 0, 200, 620, [[0, 'rgba(255,240,200,0)'], [1, 'rgba(140,80,30,.45)']]); x.fill();
      x.restore();
      x.save(); x.translate(W / 2, H / 2); x.rotate(-.015); x.translate(-W / 2, -H / 2);
      text(x, 'WANTED', W / 2, 150, { fam: 'serif', weight: 900, max: 150, maxW: 680, maxH: 150, color: '#4a2410' });
      oneLine(x, String(F.sub || '').toUpperCase(), W / 2, 238, { fam: 'serif', weight: 700, size: 34, color: '#6b3a18', align: 'center', maxW: 660 });
      const S = 400; box(x, W / 2 - S / 2 - 14, 272, S + 28, S + 28, 6, '#5a3517'); scene(x, I, W / 2 - S / 2, 286, S);
      x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(210,160,90,.45)'; x.fillRect(W / 2 - S / 2, 286, S, S); x.restore();
      oneLine(x, `POCKET #${I.id} · ${nm(I).toUpperCase()}`, W / 2, 735, { fam: 'serif', weight: 800, size: 40, color: '#4a2410', align: 'center', maxW: 700 });
      text(x, F.crime, W / 2, 830, { fam: 'serif', weight: 700, italic: true, max: 44, maxW: 680, maxH: 110, color: '#5a2d12' });
      text(x, F.reward, W / 2, 930, { fam: 'serif', weight: 900, max: 46, maxW: 680, maxH: 60, color: '#8a2a12', upper: true, maxLines: 1 });
      for (const [a, b] of [[160, 100], [920, 100], [160, 1000], [920, 1000]]) { x.fillStyle = '#6f6f6f'; x.beginPath(); x.arc(a, b, 11, 0, 7); x.fill(); x.fillStyle = '#bdbdbd'; x.beginPath(); x.arc(a - 3, b - 3, 4, 0, 7); x.fill(); }
      x.restore();
    } },
  // Image only (Shreyas): just the character and its Pocket hat, centred on plain white. No text.
  { id: 'buddy', name: 'Pocket Buddy', n: 1, kinds: 'spr', fields: [],
    draw(x, P, F, T) {
      const I = P[0], b = buddy(I, T.tex?.hybridBase, T.tex?.hybridMask);
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      if (!b) { pocket(x, I, W / 2, H * .8, 600); return; }
      // Centre the drawn pixels (not the 256px work canvas), at the largest whole-pixel scale (max 4x, which every Pocket fits) with at least a 28px margin.
      const [x0, y0, x1, y1] = b.bbox, bw = x1 - x0, bh = y1 - y0, S = Math.max(1, Math.min(4, Math.floor((W - 56) / Math.max(bw, bh))));
      x.save(); x.imageSmoothingEnabled = false;
      x.drawImage(b.art, x0, y0, bw, bh, Math.round((W - bw * S) / 2), Math.round((H - bh * S) / 2), bw * S, bh * S); x.restore();
    } },
  { id: 'countdown', name: 'Countdown sweat', n: 1, kinds: 'p', fields: [
      { k: 'clock', label: 'Clock', def: (P) => past(P[0]) ? '00:00' : '00:01' },
      { k: 'top', label: 'Caption', def: (P) => past(P[0]) ? 'me at 72h without water' : 'me at 71h 59m without water' },
      { k: 'sub', label: 'Small print', def: (P) => `real clock for #${P[0].id}: ${leftPhrase(P[0])}` }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = lin(x, 0, 0, 0, H, [[0, '#2b0d10'], [1, '#120607']]); x.fillRect(0, 0, W, H);
      x.fillStyle = rad(x, W / 2, 330, 40, 560, [[0, 'rgba(255,60,50,.35)'], [1, 'rgba(255,60,50,0)']]); x.fillRect(0, 0, W, H);
      text(x, F.top, W / 2, 110, { ...caps, max: 84, maxW: 960, maxH: 170 });
      box(x, 170, 210, 740, 250, 36, '#0b0b0d', '#3a3a40', 10);
      box(x, 196, 236, 688, 198, 22, '#160404');
      text(x, F.clock, W / 2, 338, { fam: 'pixel', weight: 600, max: 190, maxW: 640, maxH: 190, color: '#ff3b30', glow: 'rgba(255,40,30,.9)', maxLines: 1 });
      const p = pocket(x, I, W / 2, 920, 380, { glow: 'rgba(255,80,60,.25)' });
      sweat(x, W / 2, p.top + p.h * .35, Math.max(p.w, 180) * .62, 5);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 930, W, 4);
      text(x, F.sub, W / 2, 975, { fam: 'sans', weight: 600, max: 30, maxW: 900, maxH: 40, color: 'rgba(255,220,210,.85)', maxLines: 1 });
    } },
  { id: 'heaven', name: 'Made it to Heaven', n: 1, kinds: 'pr', fields: [
      { k: 'top', label: 'Title', def: (P) => by(P[0], { r: 'made it to heaven', p: past(P[0]) ? 'heaven is loading…' : 'heaven can wait' }) },
      { k: 'sub', label: 'Subtitle', def: (P) => by(P[0], { r: `${P[0].spirit?.name || 'spirit'} · ${ord(P[0].dn)} to rise · rank ${rkS(P[0])}`, p: `${streakPhrase(P[0])} · ${leftPhrase(P[0])}` }) }],
    draw(x, P, F, T) {
      const I = P[0], N = T.night;
      x.fillStyle = lin(x, 0, 0, 0, H, N ? [[0, '#17123a'], [.6, '#3b2f7a'], [1, '#7a63b8']] : [[0, '#b9c3ff'], [.55, '#f3e6ff'], [1, '#ffe2b0']]); x.fillRect(0, 0, W, H);
      if (N) stars(x, 7, 140, 0, 0, W, 600);
      x.save(); x.globalAlpha = N ? .18 : .35; rays(x, W / 2, 470, 24, 900, N ? '#fff1c4' : '#fffbe8', .05); x.restore();
      x.fillStyle = rad(x, W / 2, 470, 20, 420, [[0, 'rgba(255,240,190,.95)'], [1, 'rgba(255,240,190,0)']]); x.fillRect(0, 0, W, H);
      // gates
      x.save(); x.strokeStyle = N ? '#f3e9ff' : '#ffffff'; x.lineWidth = 14; x.globalAlpha = .9;
      x.beginPath(); x.arc(W / 2, 520, 300, Math.PI, 0); x.stroke(); x.lineWidth = 6;
      for (let i = -4; i <= 4; i++) { if (Math.abs(i) < 2) continue; const gx = W / 2 + i * 62; x.beginPath(); x.moveTo(gx, 820); x.lineTo(gx, 520 - Math.sqrt(Math.max(0, 300 * 300 - (i * 62) ** 2)) + 12); x.stroke(); }
      box(x, W / 2 - 340, 470, 40, 360, 8, N ? '#e9e2ff' : '#fff'); box(x, W / 2 + 300, 470, 40, 360, 8, N ? '#e9e2ff' : '#fff'); x.restore();
      for (const [cx, cy, s] of [[120, 860, 150], [360, 900, 170], [640, 880, 190], [930, 860, 160], [W / 2, 820, 210]]) cloud(x, cx, cy, s, N ? '#e6e0ff' : '#fff', N ? 'rgba(90,80,170,.5)' : 'rgba(170,160,230,.45)');
      const p = pocket(x, I, W / 2, 790, 320, { shadow: false, glow: 'rgba(255,240,180,.7)' });
      // only spirits get the halo and wings; a living plant is just visiting ("heaven can wait")
      if (I.seg === 'reveal') {
      const hx = W / 2, hy = p.top - 30; x.save(); x.lineWidth = 16; x.strokeStyle = '#ffd45e'; x.shadowColor = 'rgba(255,200,60,.9)'; x.shadowBlur = 24; x.beginPath(); x.ellipse(hx, hy, Math.max(70, p.w * .32), 22, 0, 0, 7); x.stroke(); x.restore();
      for (const s of [-1, 1]) { x.save(); x.translate(W / 2 + s * (p.w / 2 + 10), p.top + p.h * .45); x.scale(s, 1); x.fillStyle = 'rgba(255,255,255,.95)'; x.strokeStyle = 'rgba(150,140,210,.8)'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(0, -30); x.quadraticCurveTo(110, -120, 170, -60); x.quadraticCurveTo(140, -40, 150, -10); x.quadraticCurveTo(110, 0, 120, 30); x.quadraticCurveTo(60, 40, 0, 30); x.closePath(); x.fill(); x.stroke(); x.restore(); }
      } else sweat(x, W / 2, p.top + p.h * .35, Math.max(p.w, 180) * .62, 4);
      text(x, F.top, W / 2, 110, { fam: 'serif', weight: 800, max: 104, maxW: 940, maxH: 170, color: N ? '#fff6dc' : '#3b2f7a', glow: N ? 'rgba(255,220,140,.6)' : null });
      if (F.sub && F.sub.trim()) { x.save(); x.fillStyle = N ? 'rgba(28,20,64,.72)' : 'rgba(255,255,255,.6)'; x.beginPath(); x.roundRect(110, 930, W - 220, 70, 35); x.fill(); x.restore(); }
      text(x, F.sub, W / 2, 965, { fam: 'serif', weight: 600, italic: true, max: 40, maxW: 820, maxH: 60, color: N ? '#fff' : '#4a3f8f', maxLines: 1 });
    } },
  { id: 'seedvspirit', name: 'Seed holders vs spirit holders', n: 2, roles: ['s', 'r'], fields: [
      { k: 'l', label: 'Left title', def: () => 'seed holders' }, { k: 'ls', label: 'Left caption', def: () => 'still waiting for their moment' },
      { k: 'r', label: 'Right title', def: () => 'spirit holders' }, { k: 'rs', label: 'Right caption', def: () => 'already living their afterlife' }],
    draw(x, P, F, T) {
      const [A, B] = P, N = T.night;
      tileRect(x, T.tex.soil, 0, 0, W / 2, H, 5, 3); x.fillStyle = 'rgba(20,10,5,.25)'; x.fillRect(0, 0, W / 2, H);
      x.fillStyle = lin(x, 0, 0, 0, H, N ? [[0, '#1b1640'], [1, '#4a3c8c']] : [[0, '#c7cdfb'], [1, '#fff1d6']]); x.fillRect(W / 2, 0, W / 2, H);
      if (N) stars(x, 3, 60, W / 2, 0, W / 2, H * .6);
      for (const [cx, cy, s] of [[640, 860, 110], [800, 900, 130], [980, 870, 120], [W * .75, 830, 150]]) cloud(x, cx, cy, s, N ? '#e6e0ff' : '#fff');
      x.fillStyle = '#111'; x.fillRect(W / 2 - 4, 0, 8, H);
      text(x, F.l, W / 4, 120, { ...caps, max: 76, maxW: 470, maxH: 170 }); text(x, F.r, W * .75, 120, { ...caps, max: 76, maxW: 470, maxH: 170 });
      pocket(x, A, W / 4, 760, 330, { shadowCol: 'rgba(0,0,0,.4)' });
      const pb = pocket(x, B, W * .75, 790, 330, { shadow: false, glow: 'rgba(255,240,180,.55)' });
      x.save(); x.lineWidth = 12; x.strokeStyle = '#ffd45e'; x.beginPath(); x.ellipse(W * .75, pb.top - 24, Math.max(60, pb.w * .3), 18, 0, 0, 7); x.stroke(); x.restore();
      oneLine(x, `#${A.id}`, W / 4, 805, { fam: 'pixel', size: 34, color: '#f3e6cf', align: 'center' }); oneLine(x, `#${B.id}`, W * .75, 832, { fam: 'pixel', size: 34, color: '#3b2f7a', align: 'center' });
      text(x, F.ls, W / 4, 905, { ...caps, max: 50, maxW: 470, maxH: 120 }); text(x, F.rs, W * .75, 950, { ...caps, max: 50, maxW: 470, maxH: 120 });
    } },
  { id: 'ritual', name: 'Watering can ritual', n: 1, kinds: 'p', fields: [
      { k: 'top', label: 'Top', def: () => 'the daily watering ritual' },
      { k: 'bot', label: 'Bottom', def: (P) => past(P[0]) ? `the streak ended at ${days(P[0].streak)}. the ritual is over.` : P[0].sinceMs >= 48 * 36e5 ? `last streak: ${days(P[0].streak)}. water it today.` : P[0].streak >= 1 ? `streak: ${days(P[0].streak)}. do not break it.` : 'do not break the streak' }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = lin(x, 0, 0, 0, H, [[0, '#1a1030'], [1, '#2d1636']]); x.fillRect(0, 0, W, H); stars(x, 11, 80, 0, 0, W, 520, '#d8ccff');
      x.fillStyle = '#24152c'; x.beginPath(); x.ellipse(W / 2, 830, 470, 150, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(200,150,255,.55)'; x.lineWidth = 5; x.beginPath(); x.ellipse(W / 2, 830, 400, 118, 0, 0, 7); x.stroke();
      star(x, W / 2, 830, 100, 'rgba(200,150,255,.18)', 5, .45);
      x.fillStyle = rad(x, W / 2, 680, 20, 400, [[0, 'rgba(255,200,120,.35)'], [1, 'rgba(255,200,120,0)']]); x.fillRect(0, 0, W, H);
      const cs = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .2; cs.push([W / 2 + Math.cos(a) * 400, 830 + Math.sin(a) * 118]); }
      cs.filter(([, y]) => y < 830).forEach(([cx, cy]) => candle(x, cx, cy, 64));
      const p = pocket(x, I, W / 2, 850, 300, { glow: 'rgba(255,210,140,.35)' });
      wateringCan(x, W / 2 + 120, p.top - 120, 130, -.55);
      for (let i = 0; i < 6; i++) drop(x, W / 2 + 10 + (i % 3) * 26 - 10, p.top - 70 + i * 22, 13);
      cs.filter(([, y]) => y >= 830).forEach(([cx, cy]) => candle(x, cx, cy, 64));
      text(x, F.top, W / 2, 110, { ...caps, max: 84, maxW: 960, maxH: 170, color: '#fff3d6' });
      text(x, F.bot, W / 2, 1000 - 30, { ...caps, max: 60, maxW: 960, maxH: 120, color: '#fff3d6' });
    } },
  { id: 'rip', name: 'Graveyard RIP', n: 1, kinds: 'p', fields: [
      { k: 'top', label: 'Top', def: (P) => past(P[0]) ? 'the clock ran out. pre-writing the epitaph' : P[0].leftMs != null && P[0].leftMs < 24 * 36e5 ? 'pre-writing the epitaph, just in case' : 'pre-writing the epitaph anyway' },
      { k: 'ep', label: 'Epitaph', def: (P) => `here lies my\n${P[0].streak}-day streak\n(${leftPhrase(P[0])})` }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = lin(x, 0, 0, 0, H, [[0, '#0f1530'], [1, '#2b3560']]); x.fillRect(0, 0, W, H); stars(x, 5, 120, 0, 0, W, 600);
      x.fillStyle = '#f6f1d0'; x.beginPath(); x.arc(860, 170, 70, 0, 7); x.fill(); x.fillStyle = '#e3dcb0'; x.beginPath(); x.arc(840, 160, 12, 0, 7); x.arc(885, 195, 9, 0, 7); x.fill();
      x.fillStyle = '#1b2a2a'; x.beginPath(); x.moveTo(0, 860); x.quadraticCurveTo(300, 800, 560, 850); x.quadraticCurveTo(820, 900, W, 830); x.lineTo(W, H); x.lineTo(0, H); x.fill();
      for (const [gx, gs] of [[150, .55], [930, .6]]) { box(x, gx - 70 * gs * 2, 860 - 300 * gs, 140 * gs * 2, 320 * gs, 70 * gs, '#4a5168'); }
      x.save(); shadow(x, 40, 16, 'rgba(0,0,0,.5)');
      x.beginPath(); x.moveTo(300, 960); x.lineTo(300, 520); x.arc(W / 2, 520, 240, Math.PI, 0); x.lineTo(780, 960); x.closePath(); x.fillStyle = lin(x, 0, 280, 0, 960, [[0, '#a9aec2'], [1, '#6f7590']]); x.fill(); noShadow(x);
      x.strokeStyle = 'rgba(40,45,70,.5)'; x.lineWidth = 4; x.beginPath(); x.moveTo(768, 560); x.lineTo(748, 610); x.lineTo(770, 650); x.stroke(); x.restore();
      text(x, 'R.I.P.', W / 2, 410, { fam: 'serif', weight: 900, max: 110, maxW: 400, maxH: 120, color: '#3a3f58' });
      oneLine(x, `POCKET #${I.id}`, W / 2, 500, { fam: 'serif', weight: 800, size: 46, color: '#3a3f58', align: 'center', maxW: 420 });
      text(x, F.ep, W / 2, 640, { fam: 'serif', weight: 700, italic: true, max: 46, maxW: 400, maxH: 200, color: '#2f3449' });
      x.fillStyle = '#2c4a2a'; for (let i = 0; i < 40; i++) { const gx = 300 + i * 12; x.fillRect(gx, 940 - (i % 3) * 8, 6, 30); }
      const p = pocket(x, I, W / 2 - 340, 900, 230, { shadowCol: 'rgba(0,0,0,.45)' }); sweat(x, W / 2 - 340, p.top + p.h * .35, Math.min(95, Math.max(p.w, 120) * .55), 3);
      text(x, F.top, W / 2, 110, { ...caps, max: 84, maxW: 700, maxH: 170 });
    } },
  { id: 'report', name: 'Report card', n: 1, kinds: 'spr', fields: [
      { k: 'comment', label: 'Teacher\u2019s comment', def: (P) => P[0].seg === 'plant' ? (P[0].leftMs != null && P[0].leftMs <= 0 ? 'missed the deadline. results pending.' : P[0].hstate === 'critical' ? 'dying at the back of the class. water it now.' : P[0].hstate === 'wilting' ? 'wilting in the back row. water it today.' : P[0].hstate === 'thirsty' ? 'talented but thirsty. needs to apply itself.' : P[0].hstate === 'heal1' || P[0].hstate === 'heal2' ? 'recovering well. keep showing up.' : P[0].streak >= 5 ? 'a joy to water. shows up every single day.' : 'solid start. keep showing up.') : P[0].seg === 'reveal' ? `${ord(P[0].dn)} to rise. left class early, now haunts the staff room.` : 'has not started the course yet.' }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = '#2f5a3a'; x.fillRect(0, 0, W, H);
      x.save(); shadow(x, 30, 14); x.translate(W / 2, H / 2); x.rotate(.012); box(x, -440, -470, 880, 920, 10, '#fffdf3'); x.restore();
      x.save(); x.translate(W / 2, H / 2); x.rotate(.012); x.translate(-W / 2, -H / 2);
      x.strokeStyle = 'rgba(80,140,220,.25)'; x.lineWidth = 2; for (let y = 300; y < 980; y += 44) { x.beginPath(); x.moveTo(110, y); x.lineTo(970, y); x.stroke(); }
      x.strokeStyle = 'rgba(230,80,80,.45)'; x.beginPath(); x.moveTo(170, 80); x.lineTo(170, 1000); x.stroke();
      oneLine(x, 'POCKET ACADEMY', 200, 120, { fam: 'pixel', size: 28, color: '#2f5a3a' });
      oneLine(x, 'Report Card', 200, 175, { fam: 'serif', weight: 800, size: 64, color: '#1d2b20' });
      oneLine(x, `Student: Pocket #${I.id} · ${nm(I)}`, 200, 240, { fam: 'sans', weight: 600, size: 28, color: '#3a4a3c', maxW: 500 });
      box(x, 740, 100, 220, 220, 8, '#e9e2cc'); scene(x, I, 750, 110, 200);
      // Every grade comes from data. Percentile grades (pg) compare this Pocket with the rest of the collection; see meme.js standing().
      const S = I.standing || {}, days = (n) => `${n} day${n === 1 ? '' : 's'}`;
      const pg = (q) => q == null ? '–' : q >= .9 ? 'A+' : q >= .75 ? 'A' : q >= .6 ? 'B+' : q >= .4 ? 'B' : q >= .2 ? 'C' : q >= .05 ? 'D' : 'F';
      // Pocket Pad's own spirit tier ladder (rank cut-offs 10 / 100 / 500 / 1050 / 2500): rarest tier = A+.
      const TIER = { Legend: 'A+', Ancient: 'A', Mythic: 'B+', Rare: 'B', Common: 'C' };
      // The Kind trait has its own row, so this row is the rarest trait besides Kind; label it that way when Kind is rarer.
      const trLbl = S.trait && I.traits[0] && I.traits[0] !== S.trait ? 'Rarest other trait' : 'Rarest trait';
      let rows;
      if (I.seg === 'plant') { const left = I.leftMs ?? 0; rows = [
        intact(I) ? ['Watering streak', days(I.streak), pg(S.streakPct)] : ['Last streak', `${days(I.streak)}, broken`, 'F'],
        // Graded on Pocket Pad's own health words (time since last water), not the API's number.
        ['Health', I.hword || '–', { fresh: 'A', heal1: 'B', heal2: 'B', thirsty: 'C', wilting: 'D', critical: 'F', past: 'F' }[I.hstate] || '–'],
        ['Days watered', String(I.wd ?? 0), pg(S.wdPct)],
        ['Time left on clock', left > 0 ? fmtLeft(left) : 'past 72h', left <= 0 ? 'F' : left >= 48 * 36e5 ? 'A' : left >= 24 * 36e5 ? 'B' : left >= 12 * 36e5 ? 'C' : 'D'],
        ['Rarity', I.rarity || '–', pg(S.rarityPct)]]; }
      else if (I.seg === 'reveal') rows = [
        // Spirit rank is graded on Pocket Pad's own tier ladder (rank 1 = best), not on rise order:
        // ranks are handed out from #2,500 down as plants die, so grading rank by rise order would just
        // punish the first spirits. Rise order is shown, ungraded, in the teacher's comment.
        ['Watered as a plant', days(I.wd ?? 0), pg(S.wdPct)],
        ['Spirit rank', I.spirit?.tier ? `${rkS(I)} · ${I.spirit.tier}` : rkS(I), TIER[I.spirit?.tier] || '–'],
        ['Grew from', I.kind ? `${I.rarity ? I.rarity + ' ' : ''}${I.kind}` : '–', pg(S.rarityPct)],
        [trLbl, S.trait ? `${S.trait.value} (${pct(S.trait.share)})` : '–', pg(S.traitPct)]];
      else { const ratio = I.listing && I.floorNum ? I.listing.num / I.floorNum : null; rows = [
        ['Rarity', I.rarity || '–', pg(S.rarityPct)],
        ['Kind', I.kind ? `${I.kind} (${S.kindCount ?? '?'} of 2,500)` : '–', pg(S.kindPct)],
        [trLbl, S.trait ? `${S.trait.value} (${pct(S.trait.share)})` : '–', pg(S.traitPct)],
        ['Market', I.listing ? `listed ${I.listing.eth} ETH` : 'not listed', ratio == null ? '–' : ratio <= 1.05 ? 'A' : ratio <= 1.25 ? 'B+' : ratio <= 1.5 ? 'B' : ratio <= 2 ? 'C' : ratio <= 4 ? 'D' : 'F']]; }
      oneLine(x, 'SUBJECT', 200, 380, { fam: 'pixel', size: 24, color: '#7a8a7c' }); oneLine(x, 'RESULT', 800, 380, { fam: 'pixel', size: 24, color: '#7a8a7c', align: 'right' }); oneLine(x, 'GRADE', 900, 380, { fam: 'pixel', size: 24, color: '#7a8a7c', align: 'center' });
      rows.forEach(([s, v, gr], i) => { const y = 440 + i * 88;
        oneLine(x, s, 200, y, { fam: 'serif', weight: 700, size: 36, color: '#1d2b20', maxW: 280 });
        oneLine(x, v, 800, y, { fam: 'sans', weight: 600, size: 28, color: '#3a4a3c', align: 'right', maxW: 300 });
        x.save(); x.lineWidth = 5; x.strokeStyle = '#d63b3b'; x.beginPath(); x.ellipse(900, y, 58, 36, -.1, 0, 7); x.stroke(); x.restore();
        oneLine(x, gr, 900, y + 2, { fam: 'serif', weight: 900, size: gr.length > 2 ? 30 : 48, color: '#d63b3b', align: 'center' }); });
      oneLine(x, 'Teacher\u2019s comment:', 200, 890, { fam: 'pixel', size: 24, color: '#7a8a7c' });
      text(x, F.comment, 200, 950, { fam: 'serif', weight: 600, italic: true, max: 38, maxW: 760, maxH: 90, color: '#c03030', align: 'left' });
      x.restore();
    } },
  { id: 'tcg', name: 'Trading card', n: 1, kinds: 'spr', fields: [
      { k: 'name', label: 'Card name', def: (P) => nm(P[0]) },
      { k: 'm1', label: 'Move 1', def: (P) => by(P[0], { p: `Photosynthesis — ${intact(P[0]) ? 'streak' : 'last streak'} ${P[0].streak}`, r: `Haunt — rank ${rkS(P[0])}`, s: 'Lie Dormant — unplanted' }) },
      { k: 'm2', label: 'Move 2', def: (P) => by(P[0], { p: `Clock — ${P[0].leftMs > 0 ? fmtLeft(P[0].leftMs) + ' left' : 'past 72h'}`, r: `Ascend — ${ord(P[0].dn)} to rise`, s: P[0].traits[0] ? `${P[0].traits[0].value} — ${pct(P[0].traits[0].share)}` : 'Wait — forever' }) }],
    draw(x, P, F, T) {
      const I = P[0], N = T.night, rc = RHEX[I.rarity] || '#a9b0b4';
      x.fillStyle = N ? '#14112a' : '#251a3a'; x.fillRect(0, 0, W, H);
      x.fillStyle = rad(x, W / 2, H / 2, 50, 700, [[0, 'rgba(180,140,255,.35)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, W, H);
      const cx0 = 230, cy0 = 60, cw = 620, ch = 900;
      x.save(); shadow(x, 50, 24, 'rgba(0,0,0,.6)'); x.save(); x.translate(W / 2, H / 2); x.rotate(-.03); x.translate(-W / 2, -H / 2);
      let holo; try { holo = x.createConicGradient(0, W / 2, H / 2); [[0, '#ff9ad5'], [.17, '#ffe27a'], [.34, '#9dffb0'], [.5, '#8fd8ff'], [.67, '#b49bff'], [.84, '#ff9ad5'], [1, '#ff9ad5']].forEach(([o, c]) => holo.addColorStop(o, c)); } catch { holo = lin(x, cx0, cy0, cx0 + cw, cy0 + ch, [[0, '#ff9ad5'], [.5, '#8fd8ff'], [1, '#ffe27a']]); }
      box(x, cx0, cy0, cw, ch, 34, holo); noShadow(x);
      const typeCol = { seed: '#c98a4d', plant: '#7fcf6a', reveal: '#b8b0ff' }[I.seg];
      box(x, cx0 + 22, cy0 + 22, cw - 44, ch - 44, 22, lin(x, 0, cy0, 0, cy0 + ch, [[0, typeCol], [1, '#fff6dc']]));
      oneLine(x, F.name, cx0 + 50, cy0 + 72, { fam: 'serif', weight: 800, size: 46, color: '#1d1a2a', maxW: 340 });
      oneLine(x, by(I, { p: (I.hword || 'PLANT').toUpperCase(), r: (I.spirit?.tier || 'SPIRIT').toUpperCase(), s: 'SEED' }), cx0 + cw - 50, cy0 + 74, { fam: 'sans', weight: 800, size: 32, color: by(I, { p: '#c0262d', r: '#6a4fc0', s: '#8a5a2b' }), align: 'right', maxW: 150 });
      box(x, cx0 + 46, cy0 + 116, cw - 92, 400, 10, '#d9c27a'); scene(x, I, cx0 + 56 + (cw - 112 - 380) / 2, cy0 + 126, 380);
      x.save(); x.globalAlpha = .18; x.fillStyle = lin(x, cx0, cy0 + 126, cx0 + cw, cy0 + 506, [[0, '#fff'], [.5, 'rgba(255,255,255,0)'], [1, '#fff']]); x.fillRect(cx0 + 56, cy0 + 126, cw - 112, 380); x.restore();
      box(x, cx0 + 60, cy0 + 530, cw - 120, 40, 20, 'rgba(255,255,255,.6)');
      oneLine(x, `${I.stage} Pocket · ${I.seg === 'reveal' ? (I.rarity ? `from ${/^[aeiou]/i.test(I.rarity) && !/^one\b/i.test(I.rarity) ? 'an' : 'a'} ${I.rarity} plant` : '') : (I.rarity || '')} · #${I.id}`.replace(' ·  ·', ' ·'), cx0 + cw / 2, cy0 + 551, { fam: 'sans', weight: 600, size: 22, color: '#3a2f4a', align: 'center', maxW: cw - 150 });
      [F.m1, F.m2].forEach((m, i) => { const y = cy0 + 630 + i * 100; const [a, b] = String(m).split(/\s+—\s+|\s+-\s+/);
        x.fillStyle = '#1d1a2a'; x.beginPath(); x.arc(cx0 + 80, y, 22, 0, 7); x.fill(); star(x, cx0 + 80, y, 15, '#ffd45e', i ? 5 : 4, i ? .45 : .3);
        oneLine(x, a || '', cx0 + 120, y, { fam: 'serif', weight: 800, size: 36, color: '#1d1a2a', maxW: 260 });
        if (b) oneLine(x, b, cx0 + cw - 50, y, { fam: 'sans', weight: 700, size: 28, color: '#3a2f4a', align: 'right', maxW: 200 });
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(cx0 + 60, y + 44, cw - 120, 2); });
      oneLine(x, `${I.id} / 2500`, cx0 + 50, cy0 + ch - 50, { fam: 'sans', weight: 700, size: 22, color: '#3a2f4a' });
      x.fillStyle = rc; x.beginPath(); x.arc(cx0 + cw - 60, cy0 + ch - 52, 14, 0, 7); x.fill();
      x.restore(); x.restore();
    } },
  { id: 'news', name: 'Newspaper headline', n: 1, kinds: 'spr', fields: [
      { k: 'head', label: 'Headline', def: (P) => by(P[0], { p: !(P[0].leftMs > 0) ? 'local plant’s clock runs out, reveal pending' : P[0].hstate === 'critical' ? 'local plant clings to life' : P[0].hstate === 'wilting' ? 'local plant wilting, sources say' : P[0].hstate === 'thirsty' ? 'local plant thirsty, sources confirm' : 'local plant survives another day', r: `${P[0].spirit?.name || 'spirit'} ascends, garden in awe`, s: 'seed still a seed, sources confirm' }) },
      { k: 'deck', label: 'Sub-headline', def: (P) => realLine(P[0]) }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = '#5a5246'; x.fillRect(0, 0, W, H);
      x.save(); shadow(x, 30, 14); x.translate(W / 2, H / 2); x.rotate(-.02); box(x, -470, -480, 940, 960, 4, '#f3ecd9'); x.restore();
      x.save(); x.translate(W / 2, H / 2); x.rotate(-.02); x.translate(-W / 2, -H / 2);
      oneLine(x, 'The Pocket Times', W / 2, 120, { fam: 'serif', weight: 900, size: 86, color: '#1b1814', align: 'center', maxW: 860 });
      x.fillStyle = '#1b1814'; x.fillRect(90, 172, 900, 4); x.fillRect(90, 220, 900, 2);
      const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      oneLine(x, d.toUpperCase(), 100, 197, { fam: 'sans', weight: 700, size: 18, color: '#3b352c' }); oneLine(x, 'FAN EDITION · FREE', 980, 197, { fam: 'sans', weight: 700, size: 18, color: '#3b352c', align: 'right' });
      text(x, F.head, W / 2, 330, { fam: 'serif', weight: 900, max: 92, maxW: 880, maxH: 190, color: '#111', upper: true, lh: 1.02 });
      text(x, F.deck, W / 2, 458, { fam: 'serif', weight: 500, italic: true, max: 34, maxW: 860, maxH: 50, color: '#3b352c', maxLines: 1 });
      const S = 400; scene(x, I, 100, 500, S); x.save(); x.globalCompositeOperation = 'saturation'; x.fillStyle = 'rgba(128,128,128,.85)'; x.fillRect(100, 500, S, S); x.restore();
      x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(230,215,180,.6)'; x.fillRect(100, 500, S, S); x.restore();
      oneLine(x, `Pocket #${I.id}, pictured, ${I.seg === 'reveal' ? 'shortly after ascending' : I.seg === 'seed' ? 'still underground' : 'declined to comment'}.`, 100, 925, { fam: 'serif', italic: true, weight: 500, size: 20, color: '#3b352c', maxW: S });
      const r = rng(I.id); for (let col = 0; col < 2; col++) for (let i = 0; i < 17; i++) { const lx = 540 + col * 230, ly = 510 + i * 25, lw = i % 6 === 5 ? 120 : 200 + r() * 10; x.fillStyle = 'rgba(40,35,28,.55)'; x.fillRect(lx, ly, lw - (col ? 0 : 10), 9); }
      oneLine(x, 'GARDEN', 540, 950, { fam: 'sans', weight: 800, size: 20, color: '#1b1814' }); oneLine(x, 'Continued on page B3', 990, 950, { fam: 'serif', italic: true, size: 20, color: '#3b352c', align: 'right' });
      x.restore();
    } },
  // ---------------------------------------------------------------- redrawn classic layouts
  { id: 'approve', name: 'Nah / Yeah (approve-reject)', n: 2, kinds: 'spr', roles: [null, 'same'], fields: [
      { k: 'no', label: 'Reject', def: (P) => by(P[0], { p: 'selling my plant at floor', s: 'selling my seed at floor', r: 'selling my spirit at floor' }) },
      { k: 'yes', label: 'Approve', def: (P) => by(P[0], { p: past(P[0]) ? 'waiting for the spirit reveal' : 'watering it every single day', s: 'holding it until the perfect planting day', r: P[0].spirit?.name ? `reading ${P[0].spirit.name}\u2019s lore one more time` : 'reading its lore one more time' }) }],
    draw(x, P, F, T) {
      const [A, B] = P;
      for (let r = 0; r < 2; r++) { x.fillStyle = r ? '#ffd27a' : '#ffb35c'; x.fillRect(0, r * 540, 520, 540); x.fillStyle = '#fffaf0'; x.fillRect(520, r * 540, 560, 540); }
      x.fillStyle = '#1d1d1d'; x.fillRect(0, 537, W, 6); x.fillRect(517, 0, 6, H);
      pocket(x, A, 260, 470, 320, { flip: true, shadowCol: 'rgba(120,50,0,.25)' }); badge(x, 420, 120, 54, false);
      pocket(x, B, 260, 1010, 320, { shadowCol: 'rgba(120,50,0,.25)', glow: 'rgba(255,255,255,.55)' }); badge(x, 420, 660, 54, true);
      star(x, 90, 640, 26, '#fff'); star(x, 440, 900, 20, '#fff'); star(x, 120, 930, 16, '#fff');
      text(x, F.no, 800, 270, { fam: 'serif', weight: 800, max: 70, maxW: 480, maxH: 420, color: '#1d1d1d' });
      text(x, F.yes, 800, 810, { fam: 'serif', weight: 800, max: 70, maxW: 480, maxH: 420, color: '#1d1d1d' });
    } },
  { id: 'buttons', name: 'Two buttons', n: 1, kinds: 'spr', fields: [
      { k: 'a', label: 'Button 1', def: (P) => by(P[0], { p: past(P[0]) ? 'wait for the reveal' : 'water', s: 'plant it', r: 'hold forever' }) }, { k: 'b', label: 'Button 2', def: () => 'flip' }, { k: 'who', label: 'Who\u2019s sweating', def: () => 'me' }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = lin(x, 0, 0, 0, 540, [[0, '#cfe8ff'], [1, '#a9d3f5']]); x.fillRect(0, 0, W, 540);
      x.fillStyle = '#f2c79a'; x.fillRect(0, 540, W, 540);
      x.save(); shadow(x, 30, 16); box(x, 120, 90, 840, 380, 30, '#8c96a8'); x.restore(); box(x, 140, 110, 800, 340, 22, '#a7b0c0');
      for (const [bx, lbl, rot] of [[350, F.a, -.08], [730, F.b, .08]]) {
        x.save(); x.translate(bx, 300); x.rotate(rot);
        box(x, -150, -170, 300, 90, 16, '#fffaf0', '#1d1d1d', 4);
        text(x, lbl, 0, -125, { fam: 'serif', weight: 800, max: 46, maxW: 270, maxH: 80, color: '#1d1d1d' });
        x.fillStyle = '#6b7385'; x.beginPath(); x.ellipse(0, 70, 120, 42, 0, 0, 7); x.fill();
        x.fillStyle = '#9e1c1c'; x.beginPath(); x.ellipse(0, 52, 100, 40, 0, 0, 7); x.fill();
        x.fillStyle = '#e53935'; x.beginPath(); x.ellipse(0, 30, 100, 40, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(-30, 20, 34, 12, -.2, 0, 7); x.fill(); x.restore(); }
      const p = pocket(x, I, W / 2, 1000, 380, { shadowCol: 'rgba(120,60,10,.3)' }); sweat(x, W / 2, p.top + p.h * .35, Math.max(p.w, 200) * .62, 5);
      x.save(); x.strokeStyle = 'rgba(120,60,10,.5)'; x.lineWidth = 6; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(W / 2 + s * (p.w / 2 + 40), p.top + 40); x.lineTo(W / 2 + s * (p.w / 2 + 80), p.top); x.stroke(); } x.restore();
      text(x, F.who, 170, 640, { ...caps, max: 80, maxW: 300, maxH: 160 });
    } },
  { id: 'distracted', name: 'Distracted three-way', n: 3, kinds: 'spr', roles: [null, 'r', 'p'], fields: [
      { k: 'me', label: 'Middle (looking)', def: () => 'me' }, { k: 'new', label: 'Right (the distraction)', def: () => 'a shiny new spirit' }, { k: 'old', label: 'Left (not impressed)', def: (P) => `my plant (${leftPhrase(P[2])})` }],
    draw(x, P, F, T) {
      const [A, B, C] = P;
      x.fillStyle = lin(x, 0, 0, 0, H, [[0, '#ffe9c7'], [.62, '#ffd59b'], [.62, '#c7b299'], [1, '#a8957d']]); x.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(80 + i * 170, 230, 110, 300); x.fillStyle = 'rgba(160,110,60,.18)'; x.fillRect(80 + i * 170, 520, 110, 10); }
      x.fillStyle = 'rgba(80,60,40,.25)'; for (let i = 0; i < 12; i++) x.fillRect(i * 100, 820, 60, 6);
      const pc = pocket(x, C, 190, 800, 260, { maxW: 320 });
      const pa = pocket(x, A, 540, 820, 300, { flip: true, maxW: 320 });
      const pb = pocket(x, B, 880, 790, 280, { maxW: 320, glow: 'rgba(255,190,220,.6)' });
      x.save(); x.strokeStyle = '#e5484d'; x.lineWidth = 7; x.setLineDash([18, 14]); x.lineCap = 'round';
      x.beginPath(); x.moveTo(600, pa.top + 40); x.quadraticCurveTo(720, pa.top - 110, pb.left - 10, pb.top + 50); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#e5484d'; x.beginPath(); const ex = pb.left - 10, ey = pb.top + 50; x.moveTo(ex, ey); x.lineTo(ex - 34, ey - 22); x.lineTo(ex - 22, ey + 16); x.closePath(); x.fill(); x.restore();
      for (let i = 0; i < 3; i++) { const hx = 880 + (i - 1) * 70, hy = pb.top - 50 - (i % 2) * 30; x.fillStyle = '#ff5c8a'; x.beginPath(); x.moveTo(hx, hy + 14); x.bezierCurveTo(hx - 28, hy - 8, hx - 14, hy - 30, hx, hy - 14); x.bezierCurveTo(hx + 14, hy - 30, hx + 28, hy - 8, hx, hy + 14); x.fill(); }
      text(x, '!?', 190, pc.top - 50, { fam: 'anton', weight: 400, max: 90, maxW: 200, maxH: 100, color: '#e5484d', stroke: '#fff', strokeW: 10 });
      for (const [cx, t, y] of [[190, F.old, 900], [540, F.me, 920], [880, F.new, 900]]) text(x, t, cx, y, { ...caps, max: 58, maxW: 330, maxH: 150 });
    } },
  { id: 'fine', name: 'This is fine (fire room)', n: 1, kinds: 'spr', fields: [
      { k: 'say', label: 'Speech bubble', def: () => 'this is fine.' }, { k: 'top', label: 'Caption', def: (P) => by(P[0], { p: P[0].leftMs > 24 * 36e5 ? `me worrying about a plant with ${fmtLeft(P[0].leftMs)} left` : P[0].leftMs > 0 ? `my plant with ${fmtLeft(P[0].leftMs)} left` : 'my plant, past its 72h clock', s: 'me holding a seed while everyone’s clocks tick', r: 'me in heaven watching everyone’s 72h clocks' }) }],
    draw(x, P, F, T) {
      const I = P[0];
      x.fillStyle = lin(x, 0, 0, 0, H, [[0, '#ff8a3c'], [1, '#d94a1f']]); x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(80,40,30,.55)'; x.beginPath(); x.ellipse(300, 120, 360, 130, 0, 0, 7); x.ellipse(760, 90, 420, 120, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,230,180,.25)'; x.fillRect(720, 260, 220, 260); x.strokeStyle = 'rgba(120,50,20,.6)'; x.lineWidth = 10; x.strokeRect(720, 260, 220, 260);
      x.fillStyle = '#8a4a2a'; x.fillRect(0, 860, W, 220); x.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < 12; i++) x.fillRect(i * 96, 860, 4, 220);
      const r = rng(9); for (let i = 0; i < 16; i++) flame(x, r() * W, 880 + r() * 40, 90 + r() * 120, .95);
      for (let i = 0; i < 6; i++) flame(x, 60 + i * 190 + r() * 40, 300 + r() * 300, 70 + r() * 70, .8);
      box(x, 520, 700, 340, 30, 8, '#6b3b22'); x.fillStyle = '#5a3019'; x.fillRect(560, 730, 20, 150); x.fillRect(800, 730, 20, 150);
      box(x, 740, 640, 60, 62, 10, '#fff', '#5a3019', 4); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(806, 670, 18, -1.2, 1.2); x.stroke();
      const p = pocket(x, I, 420, 880, 320, { shadowCol: 'rgba(60,20,0,.35)' });
      bubble(x, 120, 300, 520, 170, 380, Math.max(480, p.top + 30), '#fff', '#1d1d1d', 6);
      text(x, F.say, 380, 385, { fam: 'serif', weight: 800, max: 68, maxW: 460, maxH: 140, color: '#1d1d1d' });
      for (let i = 0; i < 8; i++) flame(x, 40 + i * 140 + r() * 30, 1060, 110 + r() * 80, .95);
      text(x, F.top, W / 2, 110, { ...caps, max: 76, maxW: 960, maxH: 160 });
    } },
  { id: 'brain', name: 'Expanding brain tiers', n: 1, kinds: 'spr', fields: [
      { k: 'a', label: 'Tier 1', def: (P) => by(P[0], { p: 'buying a seed', s: 'buying a seed', r: 'holding a seed' }) },
      { k: 'b', label: 'Tier 2', def: (P) => by(P[0], { p: 'planting it', s: 'keeping it unplanted', r: 'growing a plant' }) },
      { k: 'c', label: 'Tier 3', def: (P) => by(P[0], { p: past(P[0]) ? 'watering it every day (until it stopped)' : 'watering it every day', s: 'calling it \u201cpatience\u201d', r: 'watching it rise to heaven' }) },
      { k: 'd', label: 'Tier 4', def: (P) => by(P[0], { p: 'letting it go on purpose for the spirit reveal', s: 'becoming one with the soil', r: P[0].spirit?.name ? `knowing ${P[0].spirit.name}\u2019s lore by heart` : 'knowing its lore by heart' }) }],
    draw(x, P, F, T) {
      const I = P[0], rows = [F.a, F.b, F.c, F.d], rh = H / 4;
      rows.forEach((t, i) => { const y = i * rh;
        x.fillStyle = '#fffaf0'; x.fillRect(0, y, 560, rh);
        const bg = [['#2b2b33', '#1b1b20'], ['#2a3a5a', '#1a2440'], ['#5a3aa0', '#2a1a60'], ['#ffe9a8', '#ff8ad8']][i];
        x.fillStyle = lin(x, 560, y, 1080, y + rh, [[0, bg[0]], [1, bg[1]]]); x.fillRect(560, y, 520, rh);
        if (i >= 2) { x.save(); x.globalAlpha = i === 3 ? .6 : .3; rays(x, 820, y + rh / 2, 20, 420, '#fff', i * .3); x.restore(); }
        if (i === 3) stars(x, 21, 40, 560, y, 520, rh, '#fff');
        x.save(); x.beginPath(); x.rect(560, y, 520, rh); x.clip();
        pocket(x, I, 820, y + rh - 16, rh * .82, { shadow: false, glow: ['rgba(0,0,0,0)', 'rgba(140,180,255,.35)', 'rgba(220,170,255,.6)', 'rgba(255,255,255,.95)'][i] });
        if (i === 3 && I.seg === 'reveal') { x.lineWidth = 9; x.strokeStyle = '#ffd45e'; x.beginPath(); x.ellipse(820, y + 34, 70, 14, 0, 0, 7); x.stroke(); }
        x.restore();
        text(x, t, 280, y + rh / 2, { fam: 'serif', weight: 800, max: 56, maxW: 500, maxH: rh - 40, color: '#1d1d1d' });
        x.fillStyle = '#1d1d1d'; x.fillRect(0, y + rh - 3, W, 6); });
      x.fillRect(557, 0, 6, H);
    } },
  { id: 'tape', name: 'Tale of the tape', n: 2, kinds: 'spr', roles: [null, null], prefer: ['p', 'p'], fields: [
      { k: 'top', label: 'Title', def: () => 'tale of the tape' }],
    draw(x, P, F, T) {
      const [A, B] = P;
      x.fillStyle = lin(x, 0, 0, W / 2, 0, [[0, '#7a1020'], [1, '#c4243a']]); x.fillRect(0, 0, W / 2, H);
      x.fillStyle = lin(x, W / 2, 0, W, 0, [[0, '#1e48b8'], [1, '#0f2a70']]); x.fillRect(W / 2, 0, W / 2, H);
      x.save(); x.globalAlpha = .12; rays(x, W / 2, 470, 28, 900, '#fff'); x.restore();
      text(x, F.top, W / 2, 90, { ...caps, max: 80, maxW: 960, maxH: 130, color: '#ffd45e' });
      const stat = (I) => I.seg === 'plant' ? [[intact(I) ? 'Streak' : 'Last streak', `${I.streak} d`], ['Health', I.hword || '–'], ['Clock', I.leftMs > 0 ? fmtLeft(I.leftMs) : 'ran out'], ['Rarity', I.rarity || '–']]
        : I.seg === 'reveal' ? [['Rose', ord(I.dn)], ['Watered as a plant', `${I.wd ?? 0} d`], ['Rank', rkS(I)], ['Tier', I.spirit?.tier || '–']]
        : [['Stage', 'Seed'], ['Kind', I.kind || '–'], ['Rarity', I.rarity || '–'], ['Rarest', I.traits[0] ? pct(I.traits[0].share) : '–']];
      [[A, W / 4], [B, W * .75]].forEach(([I, cx], s) => {
        pocket(x, I, cx, 520, 300, { flip: s === 1, shadowCol: 'rgba(0,0,0,.35)', maxW: 370 });
        oneLine(x, `#${I.id}`, cx, 570, { fam: 'pixel', size: 44, color: '#fff', align: 'center' });
        oneLine(x, nm(I), cx, 615, { fam: 'serif', weight: 700, size: 32, color: 'rgba(255,255,255,.85)', align: 'center', maxW: 420 });
        stat(I).forEach(([k, v], i) => { const y = 690 + i * 70; box(x, cx - 210, y - 28, 420, 56, 14, 'rgba(0,0,0,.25)');
          oneLine(x, k.toUpperCase(), cx - 190, y, { fam: 'pixel', size: 24, color: 'rgba(255,255,255,.7)' }); oneLine(x, v, cx + 190, y, { fam: 'serif', weight: 800, size: 32, color: '#fff', align: 'right', maxW: 240 }); }); });
      x.save(); shadow(x, 30, 8, 'rgba(0,0,0,.5)'); x.fillStyle = '#ffd45e'; x.beginPath(); x.arc(W / 2, 470, 78, 0, 7); x.fill(); x.restore();
      text(x, 'VS', W / 2, 474, { fam: 'anton', weight: 400, max: 90, maxW: 140, maxH: 100, color: '#1d1d1d' });
    } },
];
