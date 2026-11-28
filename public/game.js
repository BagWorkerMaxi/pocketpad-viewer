// Pocket Run: a 30-90 second arcade life, shaped by one real Pocket's live state.
// Each stage plays by its own rules:
//   SEED (soil): moisture, not hours. 10 sips and it sprouts into a young plant on day 1 with a full clock.
//   PLANT (garden): the real 72h watering clock, real streak and watered day. Weather sets the hazards,
//     Companion is the power (from day 10), Visitors is the helper (from day 18). When it dies, it ascends.
//   SPIRIT (heaven): no water, no clock, no days. Its Light fades; stars refill it. Powers come from its
//     real spirit traits (Body, Keeps, Pose, Charms, rank), and it plays as its real revealed art.
// No wallet, no sign-in, no server state: best scores live in this browser (localStorage).
const W = 480, H = 720, GROUND = H - 96, PY = GROUND + 8;
const SITE = 'https://pocket-viewer.vercel.app/';
const CLOCK = 72, HPS = 6; // Pocket Pad's 72h clock; in the garden 1s = 6h, so a day passes every 4s
const SIPS = 10, CM_PER_S = 3;
const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'One of One'];
const RHEX = { Common: '#a9b0b4', Uncommon: '#6fd27e', Rare: '#55aaff', Epic: '#b77cff', Legendary: '#ffb72e', 'One of One': '#ff6fae' };
const UNLOCK = { power: 10, ally: 18 }; // Pocket Pad shows Companion from day 10, Visitors from day 18
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const todayUTC = () => new Date().toISOString().slice(0, 10);
function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// The one resource bar, per stage.
const METER = {
  soil: { max: 100, unit: '%', label: 'Moisture', drain: 4.2, gain: 14 },
  garden: { max: CLOCK, unit: 'h', label: 'Water clock', drain: HPS, gain: 12 },
  heaven: { max: 100, unit: '%', label: 'Light', drain: 6.5, gain: 12 },
};
const LOSS = { rock: 14, grub: 12, mole: 18, crack: 18, dust: 16, beetle: 16, aphid: 14, bolt: 20, beam: 20, comet: 16, bomb: 18, wisp: 16, feather: 10, rift: 20 };
const HITTXT = { rock: 'Bonk!', grub: 'Grub nibble', mole: 'Mole!', crack: 'Drought crack', dust: 'Drought cloud', beetle: 'Beetle', aphid: 'Aphids', bolt: 'Lightning', beam: 'Heat beam', comet: 'Comet', bomb: 'Titan dust', wisp: 'Shadow wisp', feather: 'Shadow feather', rift: 'Void rift' };

// ---- seed power: every seed has the same one, seeds have no companions yet ----
const SEED_POWER = { name: 'Root burst', cd: 10, tag: 'Root burst', desc: 'Roots lash out: smash hazards near you and pull water in for 3s', go: (g) => { g.clearHazards('smash', 200); g.magnetT = 3; g.roots = .6; } };
// ---- plant powers: the Companion trait (unlocks on day 10) ----
const POWERS = {
  'Watering can': { cd: 11, tag: 'Refill', desc: 'Pour +36h straight onto your clock', go: (g) => { g.addRes(36); g.burst(g.px, PY - 40, '#7cc8ff', 26); } },
  'Mossy stone': { cd: 13, tag: 'Stone skin', desc: 'Grow a shield that eats the next hit', go: (g) => { g.shield = Math.min(4, g.shield + 1); } },
  Signpost: { cd: 11, tag: 'This way!', desc: 'Every drop on screen heads straight to you for 5s', go: (g) => { g.magnetT = 5; } },
  Lantern: { cd: 13, tag: 'Slow glow', desc: 'The whole world slows to half speed for 4s', go: (g) => { g.slowT = 4; } },
  Bench: { cd: 13, tag: 'Sit down', desc: 'Your clock stops draining for 5s', go: (g) => { g.restT = 5; } },
  Gnome: { cd: 15, tag: 'Gnome smash', desc: 'Smash every hazard on screen', go: (g) => g.clearHazards('smash') },
  Birdbath: { cd: 12, tag: 'Splash', desc: 'Eight drops rain down right around you', go: (g) => g.shower('drop', 8) },
  Telescope: { cd: 11, tag: 'Foresight', desc: 'Hazards crawl at 40% speed for 5s', go: (g) => { g.scopeT = 5; } },
  'Treasure chest': { cd: 15, tag: 'Midas', desc: 'Every hazard on screen turns into gold coins', go: (g) => g.clearHazards('gold') },
  'Golden gnome': { cd: 13, tag: 'Golden smash', desc: 'Smash every hazard, then double points for 6s', go: (g) => { g.clearHazards('smash'); g.doubleT = 6; } },
};
// ---- spirit powers: from the spirit's real Body trait ----
const SPIRIT_POWERS = {
  Pond: { name: 'Tidepool', cd: 12, desc: 'Eight stars spill down around you', go: (g) => g.shower('spark', 8) },
  Moss: { name: 'Moss cloak', cd: 13, desc: 'A mossy shield eats the next hit', go: (g) => { g.shield = Math.min(4, g.shield + 1); } },
  Blossom: { name: 'Bloom call', cd: 11, desc: 'Every star on screen floats to you for 5s', go: (g) => { g.magnetT = 5; } },
  Fungus: { name: 'Spore haze', cd: 13, desc: 'Your light stops fading for 5s', go: (g) => { g.restT = 5; } },
  Stone: { name: 'Stone skin', cd: 13, desc: 'A stone shield eats the next hit', go: (g) => { g.shield = Math.min(4, g.shield + 1); } },
  Tide: { name: 'Riptide', cd: 14, desc: 'A wave washes every shadow off the screen', go: (g) => g.clearHazards('smash') },
  Root: { name: 'Deep roots', cd: 11, desc: 'Shadows crawl at 40% speed for 5s', go: (g) => { g.scopeT = 5; } },
  Hive: { name: 'Swarm', cd: 15, desc: 'Bees turn every shadow into a star', go: (g) => g.clearHazards('gold') },
  Ember: { name: 'Flare', cd: 14, desc: 'Burn every shadow on screen', go: (g) => g.clearHazards('smash') },
  Star: { name: 'Supernova', cd: 14, desc: 'Wipe every shadow, then double points for 6s', go: (g) => { g.clearHazards('smash'); g.doubleT = 6; } },
};
const GLIMMER = { name: 'Glimmer', cd: 12, desc: 'Every star on screen floats to you for 5s', go: (g) => { g.magnetT = 5; } };
// ---- spirit perks from Keeps (what it keeps in its pocket) and Pose ----
const KEEPS = {
  water: { items: ['Drop of rain', 'Little fish', 'Jar with a tadpole', 'Shell', 'Lily bud', 'Snowflake'], desc: 'Stars give 25% more light' },
  warm: { items: ['Warm coal', 'Firefly'], desc: 'Its warm glow burns a shadow every 4s' },
  light: { items: ['Feather'], desc: 'Light as a feather: moves 15% faster' },
  token: { items: ['Pebble', 'Button', 'Acorn', 'Pinecone', 'Seed'], desc: 'Starts with a keepsake shield' },
  friend: { items: ['Buzzing fly', 'Worm'], desc: 'A tiny friend fetches a star every 4s' },
  snack: { items: ['Leaf', 'Clover', 'Berry', 'Honey pot', 'Carrot top'], desc: 'Light fades 15% slower' },
};
const keepsGroup = (k) => Object.keys(KEEPS).find((g) => KEEPS[g].items.includes(k)) || null;
const POSE = { 'Hand in pocket': 'Cool and steady: no change', Waving: 'Waves its way: moves 10% faster', Resting: 'Calm: light fades 10% slower', Thinking: 'Sees it coming: void rifts warn 0.4s earlier', Crouching: 'Small target: hazards must get closer to hit' };
// ---- helpers (the Visitors trait for plants, some Keeps for spirits) ----
const ALLIES = {
  Locals: { every: 4.5, col: '#e9c38a', act: 'drop', desc: 'A neighbour tosses you a water drop every few seconds' },
  Songbirds: { every: 3.2, col: '#ffd34d', act: 'fetch', desc: 'A songbird fetches the nearest drop for you', wings: true },
  'Pond folk': { every: 3.4, col: '#6fd27e', act: 'zap', range: 260, desc: 'A frog tongue snaps up the nearest hazard' },
  Woodland: { every: 16, col: '#b07a4a', act: 'shield', desc: 'A hedgehog lends you a shield every 16s' },
  Moths: { every: 0, col: '#d9cfa8', act: 'slow', desc: 'Moths swarm the hazards, so they fall 15% slower', wings: true },
  Dragonling: { every: 2.6, col: '#ff7a45', act: 'zap', range: 900, desc: 'A dragonling torches a hazard every 2.6s', wings: true },
};
const KEEP_ALLY = { warm: { every: 4, col: '#ffb347', act: 'zap', range: 900 }, friend: { every: 4, col: '#c9e86a', act: 'fetch', wings: true } };
const WEATHER = {
  'Soft rain': { name: 'a Soft-rain storm', desc: '30% more drops, but lightning strikes', drops: 1.3, bolts: true },
  Snowfall: { name: 'a Snowfall storm', desc: 'Icy ground makes you slide, snowflakes freeze you', ice: true, snow: true },
  Sunbeams: { name: 'a Sunbeam heatwave', desc: 'Heat beams sweep in and the clock drains 20% faster', drain: 1.2, beams: true },
  'Leaf breeze': { name: 'a Leaf-breeze gale', desc: 'Gusts shove everything sideways, you too', wind: true },
  'Drifting petals': { name: 'a Petal storm', desc: 'Petals pump your combo, aphids rain down', petals: true },
  Butterflies: { name: 'a Butterfly swarm', desc: 'Butterflies loop around carrying water', flies: true },
};
const SKY = {
  Clear: { desc: 'Clear sky, no tricks', c: ['#64aee6', '#cfeeff'] },
  'Golden hour': { desc: 'Golden light: every point x1.2', c: ['#e9894a', '#ffe0a0'] },
  'Pink dawn': { desc: 'Gentle start: the clock drains at half speed for 10s', c: ['#e58fb6', '#ffe1d2'] },
  'Cotton clouds': { desc: 'Big clouds drift by and hide what is falling', c: ['#8fb9dc', '#eef6ff'] },
  Rainbow: { desc: 'Rainbow drops (full refill) come 3x as often', c: ['#6fb8ea', '#e6f6ff'] },
  Comet: { desc: 'Comets crash down and leave stardust to grab', c: ['#141b45', '#45488a'] },
};
const SPECIAL = { 'Morning dew': 'Starts with +8h of dew on the clock', 'Second visitor': 'Your helper works 30% faster', Moss: 'Starts with a moss shield', 'Variegated leaves': 'Combos last twice as long', 'Golden pot': 'Every point x1.25', 'Double bloom': 'Every drop scores double' };
const GROUNDC = { Meadow: ['#6aae4a', '#3f7a2f'], Wildflowers: ['#72b04e', '#447e37'], Dunes: ['#e6c583', '#bf9452'], Frost: ['#e4f1f7', '#9fbfd2'], 'Autumn leaves': ['#cf7f3c', '#8a4b22'], 'Moss garden': ['#4a7d40', '#2a4f2a'] };
const RPERK = ['Underdog: every point x1.15', 'Quick roots: move 12% faster', 'Starts with a shield', 'Drops hold 30% more water', 'Magnet aura pulls nearby drops', 'Every perk above, at once'];
const FRENZY = { soil: ['Root frenzy!', 'Roots everywhere: double points, nothing can hurt you'], garden: ['Overgrowth!', 'The plant goes wild: double points, nothing can hurt you'], heaven: ['Supernova!', 'You blaze: double points, nothing can hurt you'], afterlife: ['Radiant!', 'Double points'] };
// sprout colours from the seed's real Palette trait, e.g. "Pink on spring green"
const LEAF = { 'Forest green': '#2f7d3a', 'Spring green': '#79c94a', 'Blue green': '#2f9a86', Sage: '#97b98a', Straw: '#cdb56a' };
const BLOOM = { White: '#ffffff', Pink: '#ff9cc6', Yellow: '#ffd84d', Orange: '#ff9a3c', Red: '#ff5a4a', Violet: '#b48cff', Blue: '#6fb6ff' };
function sproutColors(pal) { const s = String(pal || ''), m = s.match(/^(\w+) on (.+)$/), base = m ? m[2] : s; const leaf = Object.keys(LEAF).find((k) => base.includes(k)); return { leaf: LEAF[leaf] || '#79c94a', bloom: m ? BLOOM[m[1]] || '#ffd84d' : null }; }

// ---------------- sound: tiny WebAudio synth, no files ----------------
const SND = {
  ctx: null, out: null, on: localStorage.getItem('pocketrun:mute') !== '1',
  init() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = .45; this.out.connect(this.ctx.destination); },
  tone(f, d = .12, type = 'triangle', v = .22, f2 = 0, delay = 0) {
    if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + .03);
  },
  noise(d = .2, v = .3, freq = 600) {
    if (!this.on || !this.ctx) return; const c = this.ctx, n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(this.out); s.start();
  },
  catch(combo) { const sc = [0, 2, 4, 7, 9], n = sc[combo % 5] + 12 * (Math.floor(combo / 5) % 3); this.tone(523 * 2 ** (n / 12), .11, 'triangle', .18); },
  hit() { this.noise(.28, .45, 380); this.tone(190, .3, 'sawtooth', .14, 55); },
  block() { this.tone(1400, .09, 'square', .07, 700); this.tone(900, .12, 'triangle', .1); },
  power() { this.tone(320, .32, 'square', .08, 1100); this.tone(640, .4, 'triangle', .12, 1600, .05); },
  day() { this.tone(880, .14, 'sine', .14); this.tone(1320, .2, 'sine', .12, 0, .09); },
  up() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, .22, 'triangle', .16, 0, i * .07)); },
  death() { [440, 392, 330, 262].forEach((f, i) => this.tone(f, .5, 'sine', .16, 0, i * .16)); },
  zap() { this.noise(.18, .25, 1800); },
  strike() { this.noise(.4, .5, 900); this.tone(90, .35, 'sawtooth', .12, 40); },
  end() { [784, 659, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, .16, 'triangle', .13, 0, i * .09)); },
};

// Quiet stage music: a low heartbeat underground, plucks in the garden, slow chimes in Heaven.
const MUSIC = { next: 0, step: 0,
  SC: { soil: [98, 110, 130.8, 146.8], garden: [523.3, 587.3, 659.3, 784, 880], titan: [440, 466.2, 523.3, 622.3], heaven: [659.3, 784, 987.8, 1174.7, 1318.5], afterlife: [784, 987.8, 1174.7, 1568] },
  tick(run, stop) {
    const c = SND.ctx; if (!c || !SND.on || stop || c.state !== 'running') { this.next = 0; return; }
    if (!this.next || this.next < c.currentTime) this.next = c.currentTime + .05;
    const ph = run.phase === 'garden' && run.titan && !run.titan.gone ? 'titan' : run.phase, sc = this.SC[ph] || this.SC.garden;
    while (this.next < c.currentTime + .3) {
      const i = this.step++, f = sc[(i * 3 + (i >> 2)) % sc.length], dl = this.next - c.currentTime;
      if (ph === 'soil') { if (i % 2 === 0) SND.tone(f, .45, 'sine', .06, 0, dl); this.next += .6; }
      else if (ph === 'garden' || ph === 'titan') { if (i % 4 !== 3) SND.tone(f, .22, ph === 'titan' ? 'sawtooth' : 'triangle', ph === 'titan' ? .018 : .035, 0, dl); this.next += ph === 'titan' ? .3 : .4; }
      else { SND.tone(f, 1.2, 'sine', .03, 0, dl); this.next += .75; }
    }
  } };
// Phone haptics: only on touch screens, and only while sound is on (the mute button silences both).
const buzz = (p) => { try { if (SND.on && matchMedia('(pointer: coarse)').matches) navigator.vibrate?.(p); } catch {} };

// ---------------- drawing helpers ----------------
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function dropPath(c, x, y, r) { const a = 34 * Math.PI / 180; c.beginPath(); c.moveTo(x, y - r * 1.8); c.lineTo(x + r * Math.cos(-a), y + r * Math.sin(-a)); c.arc(x, y, r, -a, Math.PI + a); c.closePath(); }
function drop(c, x, y, r, c1 = '#8fd8ff', c2 = '#2f86d6') { dropPath(c, x, y, r); const g = c.createLinearGradient(x, y - r * 1.8, x, y + r); g.addColorStop(0, c1); g.addColorStop(1, c2); c.fillStyle = g; c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - r * .35, y - r * .15, r * .2, r * .34, -.4, 0, 7); c.fill(); }
function cloud(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); for (const [dx, dy, r] of [[-28, 6, 18], [-8, -6, 24], [16, 0, 20], [32, 8, 14], [0, 10, 20]]) { c.moveTo(x + dx * s + r * s, y + dy * s); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); } c.fill(); }
function eyes(c, x, y, s, angry) { c.fillStyle = '#1a0f08'; c.beginPath(); c.arc(x - 6 * s, y, 2.6 * s, 0, 7); c.arc(x + 6 * s, y, 2.6 * s, 0, 7); c.fill(); if (angry) { c.strokeStyle = '#1a0f08'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(x - 10 * s, y - 6 * s); c.lineTo(x - 3 * s, y - 3 * s); c.moveTo(x + 10 * s, y - 6 * s); c.lineTo(x + 3 * s, y - 3 * s); c.stroke(); } }
function star(c, x, y, r, rot = 0) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, r2 = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); } c.closePath(); c.fill(); }
function wrap(c, txt, maxW) { const words = String(txt).split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

// ---------------- one run ----------------
class Run {
  constructor(P, sprite, seed, idle, night) {
    Object.assign(this, { P, sprite, idle, night });
    this.rng = mulberry(hash(seed));
    this.phase = { seed: 'soil', plant: 'garden', reveal: 'heaven' }[P.seg]; this.bgA = this.phase; this.bgB = null; this.blend = 0;
    this.form = { seed: 'seed', plant: 'plant', reveal: P.unrevealed ? 'ghost' : 'spirit' }[P.seg];
    this.t = 0; this.pt = 0; this.res = P.start; this.score = 0; this.combo = 0; this.bestCombo = 0; this.comboT = 0;
    this.sips = 0; this.drops = 0; this.stars = 0; this.hours = 0; this.day = 0; this.gStart = P.seg === 'plant' ? P.startDay : 1;
    this.soilT = 0; this.shineT = 0; this.sproutT = 0; this.titans = 0; this.sprouted = false;
    this.px = W / 2; this.vx = 0; this.target = null; this.keys = 0; this.squash = 0; this.shield = P.shield0; this.inv = 0; this.freeze = 0; this.roots = 0;
    this.slowT = 0; this.restT = 0; this.magnetT = 0; this.scopeT = 0; this.doubleT = 0; this.cd = 0; this.allyT = 2; this.after = 0;
    this.frenzyT = 0; this.nextFrenzy = 15; this.titan = null; this.titanAt = 28; this.freak = null; this.freakDone = false; this.eclipseT = 0; this.eclipseAt = 24; this.quakeT = 0; this.quakeDone = false; this.shrugT = 0;
    this.items = []; this.parts = []; this.texts = []; this.strikes = []; this.zaps = []; this.deco = []; this.banner = null;
    this.shake = 0; this.flash = 0; this.flashC = '#fff'; this.hitstop = 0; this.wind = 0;
    this.tm = { good: .5, bad: 1.6, s1: 4.5, s2: 8, rain: P.sky === 'Rainbow' ? 8 : 24, comet: 7, wind: 1, gold: 16 + this.rng() * 8 };
    this.state = idle ? 'idle' : 'play'; this.unlocked = { power: this.powerOn(), ally: !!this.ally() };
    const r = Math.random; this.stars0 = Array.from({ length: 40 }, () => [r() * W, r() * H * .55, r() * 1.6 + .4]);
    this.pebbles = Array.from({ length: 34 }, () => [r() * W, r() * H, r() * 5 + 2, r() < .5 ? '#5a3c25' : '#6e4a2e']);
    this.clouds = Array.from({ length: 7 }, (_, i) => [r() * W, i * 120, .7 + r() * .8, 8 + r() * 14]);
    this.fog = Array.from({ length: 3 }, (_, i) => [r() * W, 170 + i * 120, 1.6 + r() * .8, 14 + r() * 10]);
  }
  get water() { return this.res; } set water(v) { this.res = v; } // test hook alias
  get M() { return METER[this.phase === 'afterlife' ? 'heaven' : this.phase]; }
  get Wx() { return this.phase === 'garden' ? (WEATHER[this.freak ? this.freak.w : this.P.weather] || {}) : {}; }
  get dayNow() { return this.gStart + this.day; }
  power() { const ph = this.phase; if (ph === 'soil') return SEED_POWER; if (ph === 'garden') return POWERS[this.P.companion] ? { name: this.P.companion, ...POWERS[this.P.companion] } : null; if (ph === 'heaven') return this.P.spiritPower; return null; }
  powerOn() { return !!this.power() && (this.phase !== 'garden' || this.dayNow >= UNLOCK.power); }
  ally() {
    if (this.phase === 'garden' && this.dayNow >= UNLOCK.ally && ALLIES[this.P.visitors]) return { name: this.P.visitors, ...ALLIES[this.P.visitors] };
    if (this.phase === 'heaven' && this.P.keepAlly) return this.P.keepAlly;
    return null;
  }
  mult() {
    const g = this.phase === 'garden', base = g && this.P.seg === 'plant' ? this.P.comboBase : 1;
    return base * (1 + Math.min(8, Math.floor(this.combo / 5)) * .25) * this.P.rarityMul * (g && this.P.sky === 'Golden hour' ? 1.2 : 1) * (g && this.P.special === 'Golden pot' ? 1.25 : 1) * (this.doubleT > 0 || this.frenzyT > 0 ? 2 : 1);
  }
  addRes(v) { this.res = Math.min(this.M.max, this.res + v); }
  fmtRes(v) { return `${Math.round(v)}${this.M.unit}`; }
  add(k, x, y, vy, extra) {
    const R = { drop: 11, spark: 10, fly: 12, petal: 10, rainbow: 14, star: 10, coin: 10, gold: 14, dust: 22, beetle: 13, rock: 17, grub: 14, snow: 13, aphid: 11, comet: 15, bomb: 14, wisp: 16, feather: 13 };
    const bad = ['dust', 'beetle', 'rock', 'grub', 'snow', 'aphid', 'comet', 'bomb', 'wisp', 'feather'].includes(k);
    const it = Object.assign({ k, x, y, vy, vx: 0, r: R[k] || 12, bad, ph: Math.random() * 6, rot: 0, life: 0 }, extra); this.items.push(it); return it;
  }
  shower(k, n) { for (let i = 0; i < n; i++) this.add(k, clamp(this.px + (i - (n - 1) / 2) * 30, 20, W - 20), PY - 300 - i * 26, 150); }
  burst(x, y, col, n = 14, sp = 220) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = sp * (.3 + Math.random() * .8); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: .5 + Math.random() * .5, t: 0, col, r: 2 + Math.random() * 3 }); } }
  say(x, y, txt, col = '#fff', big) { this.texts.push({ x, y, txt, col, t: 0, life: big ? 1.4 : .9, big }); }
  say2(txt, sub, col = '#fff', life = 2.6) { this.banner = { txt, sub, col, t: 0, life }; }
  clearHazards(mode, radius) {
    let n = 0; const cy = PY - 34;
    for (const it of this.items) if (it.bad && !it.dead && it.y > -40 && (!radius || Math.hypot(it.x - this.px, it.y - cy) < radius)) {
      it.dead = true; n++;
      if (mode === 'gold') this.add(this.phase === 'heaven' ? 'spark' : 'coin', it.x, it.y, 110); else { this.burst(it.x, it.y, this.phase === 'heaven' ? '#6b5a9a' : '#8a6a4a', 10); this.score += 10 * this.mult(); }
    }
    if (!radius) this.strikes.length = 0;
    this.shake = Math.max(this.shake, 7); this.flash = .2; this.flashC = mode === 'gold' ? '#ffd34d' : '#fff';
    if (n) this.say(W / 2, PY - 200, mode === 'gold' ? `${n} turned to ${this.phase === 'heaven' ? 'stars' : 'gold'}` : `${n} smashed`, '#ffe08a');
  }
  usePower() {
    if (this.state !== 'play') return;
    const p = this.power(); if (!p) return;
    if (!this.powerOn()) { this.say(this.px, PY - 120, `${p.name} joins on day ${UNLOCK.power} (now day ${this.dayNow})`, '#ffd9a0'); return; }
    if (this.cd > 0) return;
    p.go(this); this.cd = p.cd; SND.power(); this.say(this.px, PY - 130, (p.tag || p.name) + '!', '#ffe08a', true); this.squash = .25;
  }
  update(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    if (this.blend < 1 && this.bgB) { this.blend += dt / 1.2; if (this.blend >= 1) { this.bgA = this.bgB; this.bgB = null; this.blend = 0; } }
    this.decoTick(dt);
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const x of this.texts) x.t += dt; this.texts = this.texts.filter((x) => x.t < x.life);
    for (const z of this.zaps) z.t += dt; this.zaps = this.zaps.filter((z) => z.t < .25);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    this.shake = Math.max(this.quakeT > 0 ? 3 : 0, this.shake - dt * 30); this.flash = Math.max(0, this.flash - dt * 2.2); this.squash *= Math.pow(.002, dt);
    if (this.form === 'sprout') this.sproutT = Math.min(1, this.sproutT + dt / 1.2);
    if (this.ascT != null && this.ascT < 2) this.ascT += dt;
    if (this.state !== 'play') { this.px += (W / 2 - this.px) * Math.min(1, dt * 3); return; }
    const slow = this.slowT > 0 ? .5 : 1, wdt = dt * slow;
    this.pt += dt; const d = Math.min(1, this.pt / 80), ph = this.phase;
    for (const k of ['slowT', 'restT', 'magnetT', 'scopeT', 'doubleT', 'inv', 'freeze', 'cd', 'frenzyT', 'roots', 'eclipseT', 'quakeT', 'shrugT']) this[k] = Math.max(0, this[k] - dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; this.nextFrenzy = 15; } }
    const W2 = this.Wx, sp = 340 * this.P.speed * (this.freeze > 0 ? .3 : 1);
    let want = 0;
    if (this.keys && (this.ctl !== 'ptr' || this.target == null)) want = this.keys * sp; else if (this.target != null) want = clamp((this.target - this.px) * 9, -sp, sp);
    this.vx += (want - this.vx) * Math.min(1, dt * (W2.ice ? 3.2 : 20));
    this.px = clamp(this.px + (this.vx + (W2.wind ? this.wind * .35 : 0)) * dt, 26, W - 26);
    // the resource bar
    if (ph === 'afterlife') { this.after -= dt; if (this.after <= 0) return this.finish('ascended'); }
    else {
      let drain = this.M.drain * (this.restT > 0 ? 0 : 1);
      if (ph === 'soil') { drain *= 1 + .5 * d; this.soilT += dt; }
      if (ph === 'garden') {
        drain *= (1 + .8 * d) * (W2.drain || 1) * (this.P.sky === 'Pink dawn' && this.pt < 10 ? .5 : 1) * (this.titan && !this.titan.gone ? 1.3 : 1);
        this.hours += HPS * wdt;
        const day = Math.floor(this.hours / 24);
        if (day > this.day) {
          this.day = day; this.score += 50 * this.mult(); SND.day(); this.say(W / 2, 150, `Day ${this.dayNow}`, '#fff6d8');
          if (!this.unlocked.power && this.powerOn()) { this.unlocked.power = true; this.say2(`${this.P.companion} joined!`, `Day ${UNLOCK.power}: your Companion is now your power. Tap the button or press Space`, '#ffe08a'); SND.up(); }
          if (!this.unlocked.ally && this.ally()) { this.unlocked.ally = true; this.say2(`${this.P.visitors} arrived!`, `Day ${UNLOCK.ally}: your Visitors now help you`, '#c8f169'); SND.up(); }
        }
      }
      if (ph === 'heaven') { drain *= (1 + .6 * d) * this.P.fadeMul * (this.eclipseT > 0 ? 1.5 : 1); this.shineT += dt; }
      this.res -= drain * wdt;
      if (this.res <= 0) { this.res = 0; return this.die(); }
    }
    this.events(wdt);
    this.spawn(wdt, d);
    this.allyTick(dt);
    const cy = PY - 34, A = this.ally(), slowA = A?.act === 'slow';
    for (const it of this.items) {
      if (it.dead) continue;
      it.life += wdt;
      const hs = it.bad ? (this.scopeT > 0 ? .4 : 1) * (slowA ? .85 : 1) : 1;
      if (it.fetch) { const dx = this.px - it.x, dy = cy - it.y, L = Math.hypot(dx, dy) || 1; it.x += dx / L * 640 * dt; it.y += dy / L * 640 * dt; }
      else {
        it.y += it.vy * wdt * hs; it.x += (it.vx + (W2.wind ? this.wind * (it.bad ? .5 : .8) : 0)) * wdt * hs;
        if (it.k === 'dust') it.x += Math.sin(this.t * 2.4 + it.ph) * 26 * wdt;
        if (it.k === 'grub') it.x += Math.sin(this.t * 4 + it.ph) * 90 * wdt;
        if (it.k === 'fly') it.x += Math.cos(this.t * 3.5 + it.ph) * 150 * wdt;
        if (it.k === 'petal' || it.k === 'feather') it.x += Math.sin(this.t * 3 + it.ph) * (it.k === 'feather' ? 90 : 50) * wdt;
        if (it.k === 'wisp') it.x += clamp(this.px - it.x, -1, 1) * 45 * wdt * hs + Math.sin(this.t * 5 + it.ph) * 30 * wdt;
        if (it.k === 'star') { it.vy *= Math.pow(.2, wdt); if (it.life > 3.5) it.dead = true; }
        if (it.k === 'rock') it.rot += wdt * 3;
        if (!it.bad && (this.magnetT > 0 || this.P.magnet)) { const dx = this.px - it.x, dy = cy - it.y, L = Math.hypot(dx, dy) || 1; if (this.magnetT > 0 || L < this.P.magnet + 40) { const f = this.magnetT > 0 ? 520 : 260; it.x += dx / L * f * dt; it.y += dy / L * f * dt * .6; } }
        it.x = clamp(it.x, 12, W - 12);
      }
      if (it.k === 'comet' && it.y > GROUND - 8) { it.dead = true; this.burst(it.x, GROUND, '#ffd98a', 22, 300); this.shake = 9; SND.strike(); for (let i = 0; i < 3; i++) this.add('star', clamp(it.x + (i - 1) * 46, 20, W - 20), PY - 30, -60 - i * 20); continue; }
      const hitR = it.bad ? (it.r * .8 + 16) * this.P.hitMul : it.r + 30;
      if (Math.hypot(it.x - this.px, it.y - cy) < hitR && !(it.bad && ph === 'afterlife')) { it.dead = true; it.bad ? this.hurt(it.k) : this.collect(it); }
      if (it.y > H + 50 || it.y < -400) it.dead = true;
    }
    this.items = this.items.filter((it) => !it.dead);
    for (const s of this.strikes) {
      s.t += wdt;
      if (!s.hit && s.t >= s.warn) { s.hit = true; this.shake = Math.max(this.shake, 8); SND.strike(); this.burst(s.x, s.kind === 'mole' || s.kind === 'crack' ? PY : GROUND, s.col, 16, 260); if (Math.abs(this.px - s.x) < s.w / 2 + 10 * this.P.hitMul && ph !== 'afterlife') this.hurt(s.kind); }
    }
    this.strikes = this.strikes.filter((s) => s.t < s.warn + .4);
  }
  events(wdt) {
    const ph = this.phase;
    // Earthquake: once, underground
    if (ph === 'soil' && !this.quakeDone && this.pt >= 11) { this.quakeDone = true; this.quakeT = 3.5; this.say2('Earthquake!', 'Rocks are shaking loose. Dodge!', '#ffcf9a'); SND.strike(); }
    // Drought Titan: a garden boss
    if (ph === 'garden' && !this.titan && this.pt >= this.titanAt) {
      this.titan = { x: W / 2, y: -100, hp: 10, max: 10, t: 0, life: 22, bomb: 1.4, gone: false };
      this.say2('Drought Titan!', 'A giant drought cloud is drinking your sky. Catch 10 drops to rain it away', '#ffd0a0', 3); this.shake = 12; SND.strike(); SND.death();
    }
    const T = this.titan;
    if (T) {
      T.t += wdt; T.y += ((T.gone ? -200 : 135) - T.y) * Math.min(1, wdt * 1.4); T.x = W / 2 + Math.sin(T.t * .8) * 140;
      if (!T.gone) {
        T.bomb -= wdt; if (T.bomb <= 0) { T.bomb = lerp(1.1, .6, Math.min(1, T.t / 15)); this.add('bomb', clamp(T.x + (Math.random() - .5) * 140, 20, W - 20), T.y + 40, 250); }
        if (T.t > T.life) { T.gone = true; this.say2('The Titan drifts off', 'You outlasted it', '#ffe3c0'); }
      } else if (T.y < -180) { this.titan = null; this.titanAt = this.pt + 40; }
    }
    // Freak front: the weather changes for 10s, once
    if (ph === 'garden' && !this.freakDone && this.pt >= 52) {
      const opts = Object.keys(WEATHER).filter((w) => w !== this.P.weather); const w = opts[Math.floor(this.rng() * opts.length)];
      this.freakDone = true; this.freak = { w, t: 10 }; this.say2('Freak front!', `${w} rolls in for 10 seconds`, '#cfe8ff'); SND.strike();
    }
    if (this.freak) { this.freak.t -= wdt; if (this.freak.t <= 0 || ph !== 'garden') { this.freak = null; if (ph === 'garden') this.say(W / 2, 210, `Back to ${this.P.weather}`, '#e8f6d0', true); } }
    // Eclipse: in heaven, the light dims
    if (ph === 'heaven' && this.pt >= this.eclipseAt) { this.eclipseAt += 40; this.eclipseT = 6; this.say2('Eclipse!', 'The light dims and fades faster. Catch stars fast', '#d8c8ff'); SND.death(); }
  }
  spawn(wdt, d) {
    const tm = this.tm, ph = this.phase, W2 = this.Wx, R = this.rng, x = () => 26 + R() * (W - 52), fz = this.frenzyT > 0 ? 3 : 1;
    tm.good -= wdt * fz;
    if (tm.good <= 0) {
      tm.good = (ph === 'afterlife' ? .2 : ph === 'soil' ? .7 : ph === 'heaven' ? lerp(.55, .8, d) : lerp(.6, .85, d) / (W2.drops || 1)) * (.8 + R() * .4);
      const v = ph === 'soil' ? 150 + R() * 60 : 190 + R() * 70 + d * 60;
      if (ph === 'heaven' || ph === 'afterlife') this.add('spark', x(), -20, v * .85);
      else if (W2.flies && R() < .3) this.add('fly', x(), -20, v * .7);
      else if (W2.petals && R() < .28) this.add('petal', x(), -20, v * .8);
      else this.add('drop', x(), -20, v);
    }
    if (ph === 'afterlife') return;
    tm.gold -= wdt; if (tm.gold <= 0) { tm.gold = 22 + R() * 10; this.add('gold', x(), -20, ph === 'soil' ? 160 : 210); }
    tm.bad -= wdt * (this.titan && !this.titan.gone ? .6 : 1);
    if (this.quakeT > 0 && ph === 'soil') { if (tm.bad > .2) tm.bad = .2; }
    if (tm.bad <= 0) {
      tm.bad = this.quakeT > 0 ? .2 : (ph === 'heaven' ? lerp(1.3, .45, d) : ph === 'soil' ? lerp(1.2, .5, d) : lerp(1.15, .36, d)) * (.75 + R() * .5);
      const v = lerp(170, 330, d) * (.85 + R() * .3), r = R();
      if (ph === 'soil') this.add(this.quakeT > 0 || r < .55 ? 'rock' : 'grub', x(), -30, v * (this.quakeT > 0 ? 1.1 : .85));
      else if (ph === 'heaven') this.add(r < .6 ? 'wisp' : 'feather', x(), -30, r < .6 ? v * .7 : v * .55);
      else if (W2.snow && r < .35) this.add('snow', x(), -30, v * .9);
      else if (W2.petals && r < .4) this.add('aphid', x(), -30, v);
      else this.add(r < .65 ? 'dust' : 'beetle', x(), -30, r < .65 ? v * .85 : v * 1.15);
    }
    // telegraphed strikes, one family per stage
    const warnPlus = ph === 'heaven' && this.P.pose === 'Thinking' ? .4 : 0;
    if (ph === 'soil' && this.pt > 4) {
      tm.s1 -= wdt; if (tm.s1 <= 0) { tm.s1 = lerp(5.5, 3, d) * (.8 + R() * .4); this.strikes.push({ kind: 'mole', x: x(), w: 64, warn: .95, t: 0, col: '#8a5a3a' }); }
      tm.s2 -= wdt; if (tm.s2 <= 0 && this.pt > 8) { tm.s2 = lerp(7, 4, d) * (.8 + R() * .4); this.strikes.push({ kind: 'crack', x: x(), w: 44, warn: 1.05, t: 0, col: '#c9a27a' }); }
    }
    if (ph === 'garden' && W2.bolts && this.pt > 6) { tm.s1 -= wdt; if (tm.s1 <= 0) { tm.s1 = lerp(7, 3.6, d) * (.8 + R() * .4); this.strikes.push({ kind: 'bolt', x: x(), w: 46, warn: .95, t: 0, col: '#fff7a8' }); } }
    if (ph === 'garden' && W2.beams && this.pt > 5) { tm.s2 -= wdt; if (tm.s2 <= 0) { tm.s2 = lerp(6.5, 3.4, d) * (.8 + R() * .4); this.strikes.push({ kind: 'beam', x: x(), w: 92, warn: 1.15, t: 0, col: '#ffb347' }); } }
    if (ph === 'heaven' && this.pt > 6) { tm.s1 -= wdt; if (tm.s1 <= 0) { tm.s1 = lerp(7, 3.6, d) * (.8 + R() * .4); this.strikes.push({ kind: 'rift', x: x(), w: 50, warn: .95 + warnPlus, t: 0, col: '#9a7ad8' }); } }
    if (W2.wind) { tm.wind -= wdt; if (tm.wind <= 0) { tm.wind = 3 + R() * 2; this.wind = (R() * 2 - 1) * 130; this.say(W / 2, 200, this.wind > 0 ? 'Gust →' : '← Gust', '#e8f6d0'); } }
    if (ph === 'garden') {
      tm.rain -= wdt; if (tm.rain <= 0) { tm.rain = (this.P.sky === 'Rainbow' ? 8 : 24) * (.8 + R() * .4); this.add('rainbow', x(), -20, 200); }
      if (this.P.sky === 'Comet') { tm.comet -= wdt; if (tm.comet <= 0) { tm.comet = 7 + R() * 4; this.add('comet', x(), -30, 380, { vx: (R() * 2 - 1) * 120 }); } }
    }
  }
  allyTick(dt) {
    const A = this.ally(); if (!A || !A.every) return;
    this.allyT -= dt; if (this.allyT > 0) return;
    this.allyT = A.every * (this.phase === 'garden' && this.P.special === 'Second visitor' ? .7 : 1);
    const ax = this.px + Math.cos(this.t * 2) * 46, ay = PY - 110, cy = PY - 34;
    const nearest = (bad, maxD) => { let best = null, bd = maxD; for (const it of this.items) { if (it.dead || it.bad !== bad || it.fetch || it.y < 0) continue; const dd = Math.hypot(it.x - this.px, it.y - cy); if (dd < bd) { bd = dd; best = it; } } return best; };
    if (A.act === 'drop') { this.add('drop', clamp(this.px + (Math.random() - .5) * 120, 20, W - 20), PY - 260, 170); this.zaps.push({ x1: ax, y1: ay, x2: this.px, y2: PY - 260, t: 0, col: A.col }); }
    else if (A.act === 'fetch') { const it = nearest(false, 900); if (it) { it.fetch = true; this.zaps.push({ x1: ax, y1: ay, x2: it.x, y2: it.y, t: 0, col: A.col }); } }
    else if (A.act === 'shield') { if (this.shield < 3) { this.shield++; this.say(this.px, PY - 120, '+shield', '#e9d3b0'); SND.block(); } }
    else if (A.act === 'zap') { const it = nearest(true, A.range); if (it) { it.dead = true; this.zaps.push({ x1: ax, y1: ay, x2: it.x, y2: it.y, t: 0, col: A.col, w: 6 }); this.burst(it.x, it.y, A.col, 14); this.score += 10 * this.mult(); SND.zap(); } }
  }
  collect(it) {
    const ph = this.phase, af = ph === 'afterlife', k = it.k;
    let pts = 10, gain = 0, col = '#9fdcff';
    if (k === 'drop') { gain = this.M.gain * this.P.dropMul; pts = 10 * (ph === 'garden' && this.P.special === 'Double bloom' ? 2 : 1); }
    if (k === 'spark') { gain = this.M.gain * this.P.lightMul; col = '#ffe08a'; }
    if (k === 'fly') { gain = 8 * this.P.dropMul; pts = 20; col = '#ffb3e0'; }
    if (k === 'petal') { pts = 15; col = '#ffb3cf'; }
    if (k === 'rainbow') { gain = CLOCK; pts = 100; col = '#fff'; this.flash = .3; this.flashC = '#fff'; SND.up(); this.say2('Rainbow drop!', 'Clock refilled to 72h', '#fff', 1.6); }
    if (k === 'star') { pts = 30; col = '#ffe08a'; }
    if (k === 'coin') { pts = 25; col = '#ffd34d'; }
    if (k === 'gold') { gain = this.M.max; pts = 150; col = '#ffd34d'; this.magnetT = Math.max(this.magnetT, 3); this.flash = .35; this.flashC = '#ffe08a'; SND.up(); this.say2(ph === 'heaven' ? 'Golden star!' : 'Golden drop!', `${ph === 'soil' ? 'Moisture' : ph === 'heaven' ? 'Light' : 'Clock'} full, everything good flies to you`, '#ffe08a', 1.8); }
    if (af) { gain = 0; pts = 25; }
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.comboT = 2.3 * (ph === 'garden' && this.P.special === 'Variegated leaves' ? 2 : 1);
    const got = pts * this.mult(); this.score += got;
    if (gain) this.addRes(gain);
    if (ph === 'soil' && (k === 'drop' || k === 'gold')) this.sips = Math.min(SIPS, this.sips + (k === 'gold' ? 2 : 1));
    if (ph === 'garden' && ['drop', 'fly', 'rainbow', 'gold'].includes(k)) this.drops++;
    if ((ph === 'heaven' || af) && (k === 'spark' || k === 'gold')) this.stars++;
    this.burst(it.x, it.y, col, 9, 160); this.squash = .18; SND.catch(this.combo);
    this.say(it.x, it.y - 20, gain && !af ? `+${Math.round(Math.min(gain, this.M.max))}${this.M.unit}` : `+${Math.round(got)}`, col);
    if (this.titan && !this.titan.gone && ['drop', 'fly', 'rainbow', 'gold'].includes(k)) this.hitTitan();
    if (this.combo >= this.nextFrenzy && this.frenzyT <= 0) { this.nextFrenzy = this.combo + 15; this.frenzyT = 6; const [a, b] = FRENZY[ph]; this.say2(a, b, '#c8f169', 2); SND.up(); this.flash = .3; this.flashC = '#e9ffb0'; this.burst(this.px, PY - 40, '#c8f169', 30, 320); }
    else if (this.combo % 10 === 0) this.say(W / 2, PY - 220, `${this.combo} combo!`, '#ffe08a', true);
    if (ph === 'soil' && this.sips >= SIPS) this.sprout();
  }
  hitTitan() {
    const T = this.titan; T.hp--; this.zaps.push({ x1: this.px, y1: PY - 60, x2: T.x, y2: T.y, t: 0, col: '#8fd8ff', w: 8 }); this.burst(T.x, T.y + 20, '#8fd8ff', 14, 260); SND.zap();
    if (T.hp > 0) return;
    this.burst(T.x, T.y, '#bfe9ff', 60, 420); this.burst(T.x, T.y, '#8a6f55', 30, 300); this.shake = 18; this.flash = .5; this.flashC = '#dff4ff';
    this.score += 300 * this.mult(); this.res = this.M.max; this.titans++; this.titan = null; this.titanAt = this.pt + 45;
    for (const it of this.items) if (it.k === 'bomb') it.dead = true;
    this.shower('drop', 6); this.add('rainbow', W / 2, -20, 200);
    this.say2('Drought Titan defeated!', 'Its stolen rain pours back: clock full', '#bfe9ff', 2.6); SND.up();
  }
  hurt(k) {
    if (this.inv > 0 || this.state !== 'play') return;
    if (this.frenzyT > 0) { if (this.shrugT <= 0) { this.say(this.px, PY - 120, 'Shrugged off!', '#e9ffb0'); this.shrugT = .8; } return; }
    if (this.shield > 0) { this.shield--; this.inv = .5; this.burst(this.px, PY - 40, '#bfefff', 16); SND.block(); buzz(15); this.say(this.px, PY - 120, 'Blocked!', '#bfefff'); return; }
    this.combo = 0; this.nextFrenzy = 15;
    if (k === 'snow') { this.freeze = 1.3; this.inv = .6; this.burst(this.px, PY - 40, '#e6f6ff', 14); SND.block(); this.say(this.px, PY - 120, 'Frozen!', '#e6f6ff'); return; }
    const loss = LOSS[k] ?? 16;
    this.res -= loss; this.inv = .9; this.shake = 12; this.hitstop = .05; this.flash = .3; this.flashC = '#ff5a4a';
    this.burst(this.px, PY - 40, '#ff8a6a', 16); SND.hit(); buzz(45); this.say(this.px, PY - 120, `${HITTXT[k] || 'Ouch'} -${loss}${this.M.unit}`, '#ff9b8a', true);
    if (this.res <= 0) { this.res = 0; this.die(); }
  }
  sprout() {
    this.phase = 'garden'; this.bgB = 'garden'; this.blend = 0; this.sprouted = true; this.form = 'sprout'; this.sproutT = 0;
    this.pt = 0; this.res = CLOCK; this.hours = 0; this.day = 0; this.gStart = 1; this.cd = 0; this.quakeT = 0;
    this.score += 200 * this.mult(); this.unlocked = { power: this.powerOn(), ally: !!this.ally() }; this.strikes.length = 0;
    for (const it of this.items) if (it.bad) { it.dead = true; this.burst(it.x, it.y, '#7a5a3a', 6); }
    this.say2('Sprouted!', `Day 1 as a young plant. The real 72h watering clock starts now, in ${WEATHER[this.P.weather]?.name || 'the garden'}`, '#c8f169', 3.2);
    this.flash = .5; this.flashC = '#fff'; this.shake = 10; SND.up(); buzz([30, 40, 60]); this.burst(this.px, PY - 30, '#9be36a', 44, 380);
  }
  die() {
    const ph = this.phase;
    if (ph === 'soil') { this.say2('The seed went dormant', 'It dried out before it could sprout', '#ffe3b0'); return this.finish('dormant'); }
    if (ph === 'heaven') { this.say2('The light faded', `${this.P.spirit?.name || 'The spirit'} rests among the stars`, '#fff6d8'); return this.finish('faded'); }
    this.endDay = this.dayNow; this.phase = 'afterlife'; this.bgB = 'heaven'; this.blend = 0; this.after = 8; this.prevForm = this.form; this.deadX = this.px; this.ascT = 0; this.form = 'ghost'; buzz([60, 80, 120]); this.strikes.length = 0; this.combo = 0; this.titan = null; this.freak = null; this.frenzyT = 0;
    for (const it of this.items) { it.dead = true; this.burst(it.x, it.y, '#ffffff', 4); }
    this.say2('Your plant died', 'An unrevealed spirit rises (its real reveal happens on Pocket Pad). Catch the light for bonus points', '#fff', 3.4);
    this.flash = .7; this.flashC = '#fff'; this.hitstop = .25; SND.death();
  }
  finish(cause) {
    if (this.state !== 'play') return;
    this.state = 'over'; this.cause = cause; SND.end(); this.onEnd?.(this.result());
  }
  result() {
    return { id: this.P.id, seg: this.P.seg, cause: this.cause, sprouted: this.sprouted, score: Math.round(this.score), bestCombo: this.bestCombo,
      sips: this.sips, depth: Math.round(this.soilT * CM_PER_S), drops: this.drops, stars: this.stars, days: this.day, hours: Math.floor(this.hours),
      fromDay: this.gStart, toDay: this.endDay ?? this.dayNow, seconds: Math.round(this.shineT), titans: this.titans, dur: Math.round(this.t * 10) / 10 };
  }
  decoTick(dt) {
    const ph = this.bgB || this.bgA, w = ph === 'garden' ? (WEATHER[this.freak ? this.freak.w : this.P.weather] || {}) : {}, D = this.deco;
    const want = ph === 'garden' ? (w.snow || w.bolts ? 60 : 26) : 22;
    if (D.length < want && Math.random() < dt * 40) {
      const k = ph === 'soil' ? 'dirt' : ph === 'heaven' ? 'spark' : w.bolts ? 'rain' : w.snow ? 'snowd' : w.petals ? 'petd' : w.wind ? 'leaf' : w.flies ? 'bfly' : 'mote';
      D.push({ k, x: Math.random() * W, y: k === 'spark' ? H + 10 : -10, v: k === 'rain' ? 600 + Math.random() * 200 : k === 'spark' ? -30 - Math.random() * 40 : 30 + Math.random() * 50, ph: Math.random() * 6, s: .6 + Math.random() * .8 });
    }
    for (const p of D) { p.y += p.v * dt; p.x += (Math.sin(this.t * 1.5 + p.ph) * 14 + (w.wind ? this.wind * .6 : 0)) * dt; }
    this.deco = D.filter((p) => p.y < H + 20 && p.y > -30);
  }
  // ---------- draw ----------
  draw(c, hud = true) {
    c.save();
    if (this.shake > 0) c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
    this.drawBg(c, this.bgA);
    if (this.bgB) { c.globalAlpha = Math.min(1, this.blend); this.drawBg(c, this.bgB); c.globalAlpha = 1; }
    this.drawDeco(c);
    if (this.titan) this.drawTitan(c);
    for (const s of this.strikes) this.drawStrike(c, s);
    for (const it of this.items) if (!it.dead) this.drawItem(c, it);
    if (this.P.sky === 'Cotton clouds' && this.phase === 'garden') for (const f of this.fog) { const x = ((f[0] + this.t * f[3]) % (W + 260)) - 130; cloud(c, x, f[1], f[2], 'rgba(255,255,255,.82)'); }
    for (const z of this.zaps) { c.strokeStyle = z.col; c.globalAlpha = Math.max(0, 1 - z.t / .25); c.lineWidth = z.w || 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(z.x1, z.y1); c.lineTo(z.x2, z.y2); c.stroke(); c.globalAlpha = 1; }
    this.drawPlayer(c);
    if (this.eclipseT > 0) { const k = Math.min(1, this.eclipseT, (6 - this.eclipseT) * 2); const g = c.createRadialGradient(this.px, PY - 40, 50, this.px, PY - 40, 300); g.addColorStop(0, 'rgba(12,6,30,0)'); g.addColorStop(1, `rgba(12,6,30,${.82 * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    for (const p of this.parts) { c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.col; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); } c.globalAlpha = 1;
    c.textAlign = 'center';
    for (const x of this.texts) { const k = x.t / x.life; c.globalAlpha = Math.max(0, 1 - k * k); c.font = `600 ${x.big ? 26 : 20}px "Pixelify Sans", monospace`; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.55)'; const tx = clamp(x.x, 90, W - 90); c.strokeText(x.txt, tx, x.y - k * 40); c.fillStyle = x.col; c.fillText(x.txt, tx, x.y - k * 40); } c.globalAlpha = 1;
    c.restore();
    if (this.flash > 0) { c.globalAlpha = Math.min(.6, this.flash); c.fillStyle = this.flashC; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (hud && this.state !== 'idle') this.drawHud(c);
    if (this.banner) this.drawBanner(c);
  }
  drawBg(c, kind) {
    const t = this.t;
    if (kind === 'soil') {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4a3020'); g.addColorStop(.5, '#2c1c11'); g.addColorStop(1, '#170e08'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) { const y = ((i * 96 + t * 22) % (H + 96)) - 48; c.fillStyle = i % 2 ? 'rgba(255,220,180,.035)' : 'rgba(0,0,0,.12)'; c.fillRect(0, y, W, 40 + (i % 3) * 14); }
      for (const [x, y0, r, col] of this.pebbles) { const y = (y0 + t * 22) % H; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r * 1.3, r, 0, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(190,140,90,.25)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const x = 60 + i * 120; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 30, 120, x - 40, 200, x + 10 + Math.sin(t + i) * 8, 300); c.stroke(); }
      const lg = c.createLinearGradient(0, 0, 0, 160); lg.addColorStop(0, 'rgba(255,230,160,.25)'); lg.addColorStop(1, 'rgba(255,230,160,0)'); c.fillStyle = lg; c.fillRect(0, 0, W, 160);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(this.px, PY + 4, 46, 12, 0, 0, 7); c.fill();
      return;
    }
    if (kind === 'heaven') {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#aeb6fa'); g.addColorStop(.55, '#d9d4fb'); g.addColorStop(1, '#fde5f0'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const hg = c.createRadialGradient(W / 2, 40, 10, W / 2, 40, 260); hg.addColorStop(0, 'rgba(255,240,190,.9)'); hg.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = hg; c.fillRect(0, 0, W, 320);
      for (const [x, y0, s, v] of this.clouds) { const y = ((y0 + t * (v + 30)) % (H + 160)) - 80; cloud(c, x, y, s, 'rgba(255,255,255,.55)'); }
      cloud(c, this.px, PY + 10, 1.7, '#ffffff');
      return;
    }
    const sky = SKY[this.P.sky] || SKY.Clear, g = c.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, sky.c[0]); g.addColorStop(1, sky.c[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const nightish = this.night || this.P.sky === 'Comet', w = WEATHER[this.freak ? this.freak.w : this.P.weather] || {};
    if (nightish) { if (this.night && this.P.sky !== 'Comet') { c.fillStyle = 'rgba(14,18,52,.5)'; c.fillRect(0, 0, W, GROUND); } c.fillStyle = '#fff'; for (const [x, y, r] of this.stars0) { c.globalAlpha = .4 + .4 * Math.sin(t * 2 + x); c.fillRect(x, y, r, r); } c.globalAlpha = 1; }
    if (this.P.sky === 'Comet') { const x = (t * 60) % (W + 300) - 150; const cg = c.createLinearGradient(x - 120, 40, x, 110); cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(255,240,200,.9)'); c.strokeStyle = cg; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 120, 40); c.lineTo(x, 110); c.stroke(); }
    else { c.fillStyle = nightish ? '#f4f1dc' : 'rgba(255,246,200,.95)'; c.beginPath(); c.arc(W - 90, 110, 34, 0, 7); c.fill(); if (!nightish) { c.fillStyle = 'rgba(255,246,200,.25)'; c.beginPath(); c.arc(W - 90, 110, 58, 0, 7); c.fill(); } }
    if (this.P.sky === 'Rainbow') { ['#ff6b6b', '#ffb347', '#ffe066', '#7bd389', '#6bb6ff', '#a78bfa'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = .45; c.lineWidth = 9; c.beginPath(); c.arc(W / 2, GROUND + 80, 330 - i * 9, Math.PI, 0); c.stroke(); }); c.globalAlpha = 1; }
    if (w.beams) { c.fillStyle = 'rgba(255,240,180,.12)'; for (let i = 0; i < 4; i++) { const x = 40 + i * 120 + Math.sin(t * .5 + i) * 20; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x + 140, GROUND); c.lineTo(x + 70, GROUND); c.fill(); } }
    if (w.bolts) { c.fillStyle = 'rgba(60,70,100,.28)'; c.fillRect(0, 0, W, GROUND); cloud(c, 120, 70, 2.2, 'rgba(90,100,130,.7)'); cloud(c, 360, 50, 2.6, 'rgba(90,100,130,.7)'); }
    if (this.titan) { c.fillStyle = `rgba(120,80,40,${.18 * Math.min(1, this.titan.t)})`; c.fillRect(0, 0, W, GROUND); }
    const gc = GROUNDC[this.P.ground] || GROUNDC.Meadow;
    c.fillStyle = gc[1]; c.globalAlpha = .55; c.beginPath(); c.moveTo(0, GROUND); for (let x = 0; x <= W; x += 20) c.lineTo(x, GROUND - 70 - Math.sin(x / 70) * 26 - Math.sin(x / 31) * 8); c.lineTo(W, GROUND); c.fill(); c.globalAlpha = 1;
    const gg = c.createLinearGradient(0, GROUND, 0, H); gg.addColorStop(0, gc[0]); gg.addColorStop(1, gc[1]); c.fillStyle = gg; c.fillRect(0, GROUND, W, H - GROUND);
    c.strokeStyle = gc[1]; c.lineWidth = 2; for (let x = 6; x < W; x += 14) { c.beginPath(); c.moveTo(x, GROUND + 2); c.lineTo(x + Math.sin(t * 2 + x) * 2 - 3, GROUND - 7); c.stroke(); }
    if (this.P.ground === 'Wildflowers') for (let x = 20; x < W; x += 37) { c.fillStyle = ['#ff8fb1', '#ffd84d', '#fff'][x % 3]; c.beginPath(); c.arc(x, GROUND + 14 + (x % 5) * 6, 3.5, 0, 7); c.fill(); }
    if (this.P.ground === 'Autumn leaves') for (let x = 14; x < W; x += 29) { c.fillStyle = ['#e2683a', '#f0a43a', '#b24d26'][x % 3]; c.beginPath(); c.ellipse(x, GROUND + 18 + (x % 7) * 6, 5, 3, x, 0, 7); c.fill(); }
    if (this.night && this.P.sky !== 'Comet') { c.fillStyle = 'rgba(14,18,52,.35)'; c.fillRect(0, GROUND, W, H - GROUND); }
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(this.px, PY + 2, 40, 9, 0, 0, 7); c.fill();
  }
  drawDeco(c) {
    for (const p of this.deco) {
      if (p.k === 'rain') { c.strokeStyle = 'rgba(200,225,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 3, p.y + 14); c.stroke(); }
      else if (p.k === 'snowd') { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(p.x, p.y, 2.2 * p.s, 0, 7); c.fill(); }
      else if (p.k === 'petd') { c.fillStyle = 'rgba(255,170,200,.8)'; c.beginPath(); c.ellipse(p.x, p.y, 4 * p.s, 2.4 * p.s, this.t * 2 + p.ph, 0, 7); c.fill(); }
      else if (p.k === 'leaf') { c.fillStyle = p.ph > 3 ? 'rgba(140,190,80,.8)' : 'rgba(230,150,60,.8)'; c.beginPath(); c.ellipse(p.x, p.y, 5 * p.s, 2.6 * p.s, this.t * 3 + p.ph, 0, 7); c.fill(); }
      else if (p.k === 'bfly') { const f = Math.abs(Math.sin(this.t * 10 + p.ph)) * 4; c.fillStyle = 'rgba(255,200,240,.7)'; c.fillRect(p.x - f - 1, p.y, f, 4); c.fillRect(p.x + 1, p.y, f, 4); }
      else if (p.k === 'dirt') { c.fillStyle = 'rgba(200,160,110,.35)'; c.fillRect(p.x, p.y, 2, 2); }
      else { c.fillStyle = p.k === 'spark' ? 'rgba(255,240,180,.85)' : 'rgba(255,255,220,.5)'; c.fillRect(p.x, p.y, 2.5, 2.5); }
    }
  }
  drawStrike(c, s) {
    const warn = s.t < s.warn, k = Math.min(1, s.t / s.warn), x0 = s.x - s.w / 2;
    if (s.kind === 'mole') {
      if (warn) { c.fillStyle = '#5a3a22'; c.beginPath(); c.ellipse(s.x, PY + 4, s.w / 2 * k + 6, 6 + 14 * k, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(200,160,110,.8)'; for (let i = 0; i < 4; i++) c.fillRect(s.x + Math.sin(s.t * 30 + i) * s.w / 2, PY - 6 - Math.random() * 18 * k, 3, 3); this.bang(c, s.x, PY - 60); return; }
      const a = Math.max(0, 1 - (s.t - s.warn) / .4), up = Math.min(1, (s.t - s.warn) / .12) * 46;
      c.globalAlpha = a; c.fillStyle = '#4a3428'; c.beginPath(); c.arc(s.x, PY - up + 20, 26, Math.PI, 0); c.fillRect(s.x - 26, PY - up + 20, 52, up); c.fill(); c.fillStyle = '#ff9fb2'; c.beginPath(); c.arc(s.x, PY - up + 8, 6, 0, 7); c.fill(); eyes(c, s.x, PY - up, .8); c.fillStyle = '#e8d6c0'; c.fillRect(s.x - 30, PY - up + 18, 10, 6); c.fillRect(s.x + 20, PY - up + 18, 10, 6); c.globalAlpha = 1; return;
    }
    if (s.kind === 'crack') {
      c.strokeStyle = warn ? `rgba(30,18,10,${.4 + .5 * k})` : '#120a05'; c.lineWidth = warn ? 3 : 10;
      const len = warn ? (GROUND + 60) * k : H; c.beginPath(); c.moveTo(s.x, 0); for (let y = 0; y < len; y += 36) c.lineTo(s.x + ((y / 36) % 2 ? 9 : -9), y + 36); c.stroke();
      if (warn) { c.fillStyle = `rgba(255,210,150,${.08 + .12 * k})`; c.fillRect(x0, 0, s.w, H); this.bang(c, s.x, PY - 60); }
      return;
    }
    if (warn) {
      const on = Math.sin(s.t * 26) > 0;
      c.fillStyle = s.kind === 'beam' ? `rgba(255,150,60,${.1 + .2 * k})` : s.kind === 'rift' ? `rgba(40,20,80,${.12 + .3 * k})` : `rgba(255,255,170,${on ? .12 + .25 * k : .06})`; c.fillRect(x0, 0, s.w, GROUND + 10);
      c.strokeStyle = s.kind === 'beam' ? 'rgba(255,140,50,.7)' : s.kind === 'rift' ? 'rgba(80,50,150,.8)' : 'rgba(255,250,170,.7)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.strokeRect(x0, -2, s.w, GROUND + 12); c.setLineDash([]);
      this.bang(c, s.x, GROUND - 20); return;
    }
    const a = Math.max(0, 1 - (s.t - s.warn) / .4); c.globalAlpha = a;
    if (s.kind === 'beam') { const g = c.createLinearGradient(x0, 0, x0 + s.w, 0); g.addColorStop(0, 'rgba(255,170,60,0)'); g.addColorStop(.5, 'rgba(255,230,150,1)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.fillRect(x0, 0, s.w, GROUND + 10); }
    else if (s.kind === 'rift') { const g = c.createLinearGradient(x0, 0, x0 + s.w, 0); g.addColorStop(0, 'rgba(20,8,50,0)'); g.addColorStop(.5, 'rgba(20,8,50,.95)'); g.addColorStop(1, 'rgba(20,8,50,0)'); c.fillStyle = g; c.fillRect(x0, 0, s.w, H); c.fillStyle = '#b9a2ff'; for (let i = 0; i < 6; i++) c.fillRect(s.x + Math.sin(i * 7 + s.t * 20) * 14, (i * 120 + s.t * 300) % H, 3, 3); }
    else { c.strokeStyle = '#fffbd0'; c.lineWidth = 6; c.beginPath(); c.moveTo(s.x, 0); for (let y = 0; y < GROUND; y += 40) c.lineTo(s.x + (Math.random() - .5) * 30, y + 40); c.stroke(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
    c.globalAlpha = 1;
  }
  bang(c, x, y) { c.font = '600 24px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.5)'; c.strokeText('!', x, y); c.fillStyle = '#fff'; c.fillText('!', x, y); }
  drawItem(c, it) {
    const { x, y, r } = it, t = this.t;
    switch (it.k) {
      case 'drop': drop(c, x, y, r); break;
      case 'gold': { c.fillStyle = 'rgba(255,215,90,.35)'; c.beginPath(); c.arc(x, y - 4, r * 2.2 + Math.sin(t * 8) * 3, 0, 7); c.fill(); if (this.phase === 'heaven') { c.fillStyle = '#ffd34d'; star(c, x, y, r + 6, t * 2); c.fillStyle = '#fff6c8'; star(c, x, y, r - 2, t * 2); } else drop(c, x, y, r, '#fff3b0', '#e0a21a'); break; }
      case 'spark': { const g = c.createRadialGradient(x, y, 1, x, y, r * 2.2); g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(.35, 'rgba(255,214,110,.85)'); g.addColorStop(1, 'rgba(255,214,110,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, 7); c.fill(); c.fillStyle = '#fffbe6'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t, rr2 = i % 2 ? 3 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill(); break; }
      case 'rainbow': ['#ff6b6b', '#ffb347', '#ffe066', '#7bd389', '#6bb6ff', '#a78bfa'].forEach((col, i) => { dropPath(c, x, y, r + 6 - i); c.fillStyle = col; c.fill(); }); drop(c, x, y, r - 5, '#fff', '#cfe9ff'); break;
      case 'fly': { const f = Math.abs(Math.sin(t * 12 + it.ph)); c.fillStyle = '#ff9bd2'; c.beginPath(); c.ellipse(x - 7 * f - 2, y, 8 * f + 1, 9, 0, 0, 7); c.ellipse(x + 7 * f + 2, y, 8 * f + 1, 9, 0, 0, 7); c.fill(); c.fillStyle = '#3a2440'; c.fillRect(x - 1.5, y - 8, 3, 16); drop(c, x, y + 16, 5); break; }
      case 'petal': c.fillStyle = '#ffa9c8'; c.beginPath(); c.ellipse(x, y, r, r * .55, t * 2 + it.ph, 0, 7); c.fill(); c.fillStyle = '#ffe1ec'; c.beginPath(); c.ellipse(x, y, r * .45, r * .22, t * 2 + it.ph, 0, 7); c.fill(); break;
      case 'coin': c.fillStyle = '#ffcd3c'; c.beginPath(); c.ellipse(x, y, r * Math.abs(Math.cos(t * 5 + it.ph)) + 2, r, 0, 0, 7); c.fill(); c.strokeStyle = '#c98a12'; c.lineWidth = 2; c.stroke(); break;
      case 'star': c.fillStyle = '#fff2a8'; star(c, x, y, r + 3, t * 3); break;
      case 'dust': cloud(c, x, y, .85, '#8a6f55'); cloud(c, x - 2, y - 3, .7, '#a88a6a'); eyes(c, x, y + 2, 1, true); break;
      case 'bomb': cloud(c, x, y, .55, '#6f5642'); c.fillStyle = 'rgba(200,160,110,.6)'; c.fillRect(x - 2 + Math.sin(t * 20) * 6, y - 18, 3, 3); break;
      case 'wisp': { const f = Math.sin(t * 9 + it.ph) * 3; const g = c.createLinearGradient(x, y - 30, x, y + 14); g.addColorStop(0, 'rgba(60,30,100,0)'); g.addColorStop(.4, '#3a2357'); g.addColorStop(1, '#160b28'); c.fillStyle = g; c.beginPath(); c.moveTo(x + f, y - 32); c.quadraticCurveTo(x + 18, y - 8, x + 14, y + 6); c.arc(x, y + 4, 14, 0, Math.PI); c.quadraticCurveTo(x - 18, y - 8, x + f, y - 32); c.fill(); c.fillStyle = '#d8c8ff'; c.beginPath(); c.arc(x - 5, y, 2.4, 0, 7); c.arc(x + 5, y, 2.4, 0, 7); c.fill(); break; }
      case 'feather': c.save(); c.translate(x, y); c.rotate(Math.sin(t * 3 + it.ph) * .6); c.fillStyle = '#4b3f66'; c.beginPath(); c.ellipse(0, 0, 7, 18, 0, 0, 7); c.fill(); c.strokeStyle = '#2a2140'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -18); c.lineTo(0, 24); c.stroke(); c.restore(); break;
      case 'beetle': case 'aphid': { const s = it.k === 'aphid' ? .8 : 1; c.fillStyle = it.k === 'aphid' ? '#7fbf4a' : '#2b2236'; c.beginPath(); c.ellipse(x, y, 12 * s, 14 * s, 0, 0, 7); c.fill(); c.strokeStyle = c.fillStyle; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x - 10 * s, y + i * 6); c.lineTo(x - 17 * s, y + i * 7 + Math.sin(t * 20) * 2); c.moveTo(x + 10 * s, y + i * 6); c.lineTo(x + 17 * s, y + i * 7 - Math.sin(t * 20) * 2); c.stroke(); } c.fillStyle = it.k === 'aphid' ? '#a8e07a' : '#5a4a72'; c.fillRect(x - .8, y - 12 * s, 1.6, 24 * s); eyes(c, x, y + 8 * s, .55, true); break; }
      case 'rock': c.save(); c.translate(x, y); c.rotate(it.rot); c.fillStyle = '#7d7a74'; c.beginPath(); [[-16, -6], [-6, -16], [10, -13], [17, 2], [8, 15], [-10, 13]].forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); c.fill(); c.fillStyle = '#9c988f'; c.beginPath(); c.arc(-4, -5, 5, 0, 7); c.fill(); c.restore(); break;
      case 'grub': c.fillStyle = '#efe0c2'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - 12 + i * 8, y + Math.sin(t * 8 + i) * 2, 7 - i * .6, 0, 7); c.fill(); } c.fillStyle = '#b9895a'; c.beginPath(); c.arc(x - 14, y, 5, 0, 7); c.fill(); break;
      case 'snow': c.strokeStyle = '#eaf7ff'; c.lineWidth = 3; c.save(); c.translate(x, y); c.rotate(t + it.ph); for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke(); } c.restore(); c.fillStyle = 'rgba(160,215,255,.35)'; c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.fill(); break;
      case 'comet': { const g = c.createLinearGradient(x - it.vx * .3, y - 110, x, y); g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(1, 'rgba(255,220,150,.95)'); c.strokeStyle = g; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - it.vx * .3, y - 110); c.lineTo(x, y); c.stroke(); c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); break; }
    }
  }
  drawTitan(c) {
    const T = this.titan, x = T.x, y = T.y, wob = Math.sin(this.t * 3) * 4;
    cloud(c, x, y + wob, 3.3, '#5e4634'); cloud(c, x - 8, y - 12 + wob, 2.8, '#7a5f48'); cloud(c, x + 10, y - 6 + wob, 2.2, '#8a6f55');
    eyes(c, x, y + 4 + wob, 2.6, true); c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(x, y + 34 + wob, 22, 10 + Math.abs(Math.sin(this.t * 4)) * 6, 0, 0, 7); c.fill();
    if (T.gone) return;
    c.fillStyle = 'rgba(12,10,8,.55)'; rr(c, W / 2 - 130, 80, 260, 30, 12); c.fill();
    c.font = '600 14px "Pixelify Sans", monospace'; c.textAlign = 'left'; c.fillStyle = '#ffd0a0'; c.fillText('DROUGHT TITAN', W / 2 - 120, 100);
    c.fillStyle = 'rgba(255,255,255,.2)'; rr(c, W / 2 - 4, 90, 124, 10, 5); c.fill(); c.fillStyle = '#ff9b5a'; if (T.hp > 0) { rr(c, W / 2 - 4, 90, 124 * T.hp / T.max, 10, 5); c.fill(); }
  }
  drawPlayer(c) {
    if (this.hidePlayer) return;
    const t = this.t, moving = Math.abs(this.vx) > 30, floaty = this.form === 'ghost' || this.form === 'spirit';
    const bob = floaty ? Math.sin(t * 3) * 6 - 10 : moving ? -Math.abs(Math.sin(t * 14)) * 5 : Math.sin(t * 3) * 1.5;
    if (this.roots > 0) { c.strokeStyle = `rgba(150,105,60,${this.roots / .6})`; c.lineWidth = 6; c.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = -Math.PI + i * Math.PI / 8, L = 200 * (1 - this.roots / .6 * .5); c.beginPath(); c.moveTo(this.px, PY - 20); c.quadraticCurveTo(this.px + Math.cos(a) * L * .5 + 20, PY - 20 + Math.sin(a) * L * .5, this.px + Math.cos(a) * L, PY - 20 + Math.sin(a) * L); c.stroke(); } }
    let rise = 0, ga = 1;
    if (this.form === 'ghost' && this.ascT != null && this.ascT < 2) {
      // ascension: the plant fades where it died while its spirit lifts out of it
      const k = this.ascT / 2; c.save(); c.globalAlpha = Math.max(0, 1 - k * 1.4); c.translate(this.deadX, PY);
      drawForm(c, this.prevForm, this.sprite, this.prevForm === 'seed' ? 80 : 96, t, { grow: 1, day: this.day, colors: this.P.sproutColors }); c.restore();
      rise = (1 - Math.min(1, this.ascT / 1.4)) * 70; ga = Math.min(1, this.ascT / .7);
      if (Math.random() < .5) this.parts.push({ x: this.px + (Math.random() - .5) * 50, y: PY - 20, vx: 0, vy: -140, life: .7, t: 0, col: '#fff6c8', r: 3 });
    }
    if (!(this.inv > 0 && this.form !== 'ghost' && Math.floor(t * 18) % 2)) {
      c.save(); c.globalAlpha = ga; c.translate(this.px, PY + bob + rise); c.rotate(clamp(this.vx / 2600, -.12, .12));
      const fz = this.frenzyT > 0 ? 1.25 : 1; c.scale((1 + this.squash) * fz, (1 - this.squash) * fz);
      if (this.frenzyT > 0 || this.P.rIdx >= 5 && this.phase !== 'heaven' || this.doubleT > 0) { c.fillStyle = this.frenzyT > 0 ? `rgba(200,241,105,${.25 + .1 * Math.sin(t * 12)})` : 'rgba(255,215,90,.25)'; c.beginPath(); c.arc(0, -40, 54 + Math.sin(t * 6) * 4, 0, 7); c.fill(); }
      if (this.form === 'ghost') { const g = c.createRadialGradient(0, -44, 4, 0, -44, 70); g.addColorStop(0, 'rgba(255,250,220,.9)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -44, 70, 0, 7); c.fill(); }
      const S = this.form === 'spirit' ? 86 : this.form === 'seed' ? 80 : 96;
      const hh = drawForm(c, this.form, this.sprite, S, t, { grow: this.sproutT, day: this.day, colors: this.P.sproutColors });
      if (this.form === 'ghost' || (this.form === 'spirit' && this.P.halo)) { c.strokeStyle = '#ffd34d'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, -hh - 12, 22, 6, 0, 0, 7); c.stroke(); }
      if (this.freeze > 0) { c.fillStyle = 'rgba(170,220,255,.38)'; c.beginPath(); c.arc(0, -36, 46, 0, 7); c.fill(); }
      if (this.shield > 0) { c.strokeStyle = `rgba(160,235,255,${.55 + .2 * Math.sin(t * 8)})`; c.lineWidth = 3; c.beginPath(); c.arc(0, -40, 52, 0, 7); c.stroke(); }
      c.restore();
    }
    const A = this.ally();
    if (A) { const ax = this.px + Math.cos(t * 2) * 46, ay = PY - 110 + Math.sin(t * 4) * 6; c.fillStyle = A.col; if (A.wings) { const f = Math.abs(Math.sin(t * 16)) * 4; c.beginPath(); c.ellipse(ax - 11, ay - 3, 9, 3 + f, -.4, 0, 7); c.ellipse(ax + 11, ay - 3, 9, 3 + f, .4, 0, 7); c.fill(); } c.beginPath(); c.arc(ax, ay, 10, 0, 7); c.fill(); eyes(c, ax, ay - 1, .45); }
  }
  drawHud(c) {
    const ph = this.phase, M = this.M;
    c.fillStyle = 'rgba(12,10,8,.42)'; rr(c, 10, 10, W - 20, 62, 16); c.fill();
    c.textAlign = 'left';
    if (ph === 'afterlife') {
      c.font = '600 18px "Pixelify Sans", monospace'; c.fillStyle = '#fff3c4'; c.fillText(`Ascending · ${Math.max(0, Math.ceil(this.after))}s`, 26, 40);
      c.fillStyle = 'rgba(255,255,255,.2)'; rr(c, 26, 50, 170, 8, 4); c.fill(); if (this.after > 0) { c.fillStyle = '#ffe08a'; rr(c, 26, 50, Math.max(8, 170 * clamp(this.after / 8, 0, 1)), 8, 4); c.fill(); }
      c.font = '500 15px "Pixelify Sans", monospace'; c.fillStyle = 'rgba(255,245,225,.85)'; c.fillText('Unrevealed spirit', 206, 58);
    } else {
      const k = clamp(this.res / M.max, 0, 1), low = k < .25;
      if (ph === 'heaven') { c.fillStyle = '#ffe08a'; star(c, 30, 40, 11); } else if (ph === 'soil') drop(c, 30, 46, 9, '#b6e0ff', '#5a8fb0'); else drop(c, 30, 46, 9);
      c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, 48, 31, 170, 16, 8); c.fill();
      c.fillStyle = low ? (Math.sin(this.t * 14) > 0 ? '#ff5a4a' : '#ff9b8a') : ph === 'heaven' ? '#ffd34d' : ph === 'soil' ? '#7fb4d8' : '#5fb8ff'; if (k > 0) { rr(c, 48, 31, Math.max(16, 170 * k), 16, 8); c.fill(); }
      if (this.restT > 0) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(48, 31, 170 * k, 3); }
      c.font = '600 17px "Pixelify Sans", monospace'; c.fillStyle = '#fff'; c.fillText(this.fmtRes(Math.ceil(this.res)), 226, 45);
      c.font = '500 15px "Pixelify Sans", monospace'; c.fillStyle = 'rgba(255,245,225,.85)';
      const sub = ph === 'soil' ? `Moisture · sips ${this.sips}/${SIPS} · roots ${Math.round(this.soilT * CM_PER_S)}cm`
        : ph === 'heaven' ? `Light · shining ${Math.floor(this.shineT)}s`
        : `Day ${this.dayNow}${this.sprouted ? ' · young plant' : ''}${this.restT > 0 ? ' · resting' : ''}`;
      c.fillText(sub, 48, 64);
    }
    c.textAlign = 'right'; c.font = '600 28px "Pixelify Sans", monospace'; c.fillStyle = '#fff'; c.fillText(fmt(this.score), W - 24, 44);
    c.font = '500 15px "Pixelify Sans", monospace'; c.fillStyle = this.combo >= 5 ? '#ffe08a' : 'rgba(255,245,225,.85)'; c.fillText(`x${this.mult().toFixed(2)}${this.combo ? ' · ' + this.combo : ''}`, W - 24, 64);
    let fy = 100;
    if (this.shield > 0 && ph !== 'afterlife') { c.fillStyle = 'rgba(12,10,8,.42)'; rr(c, 10, 80, 30 + this.shield * 22, 28, 12); c.fill(); for (let i = 0; i < this.shield; i++) { const x = 28 + i * 22, y = 94; c.fillStyle = '#bfefff'; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 8, y - 6); c.quadraticCurveTo(x + 8, y + 5, x, y + 10); c.quadraticCurveTo(x - 8, y + 5, x - 8, y - 6); c.closePath(); c.fill(); } fy = 130; }
    const fx = [[this.frenzyT, FRENZY[ph][0].replace('!', '')], [this.slowT, 'Slow'], [this.restT, ph === 'heaven' ? 'Light held' : ph === 'soil' ? 'Rest' : 'Clock paused'], [this.magnetT, 'Magnet'], [this.scopeT, 'Slowed hazards'], [this.doubleT, 'x2 points'], [this.freeze, 'Frozen'], [this.eclipseT, 'Eclipse'], [this.freak?.t || 0, this.freak ? this.freak.w : ''], [this.quakeT, 'Earthquake']].filter((f) => f[0] > 0);
    c.textAlign = 'left'; c.font = '600 16px "Pixelify Sans", monospace'; fx.forEach(([v, n], i) => { const s = `${n} ${v.toFixed(1)}s`; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.5)'; c.strokeText(s, 16, fy + i * 20); c.fillStyle = '#ffe08a'; c.fillText(s, 16, fy + i * 20); });
  }
  drawBanner(c) {
    const b = this.banner, k = b.t / b.life, a = k < .1 ? k / .1 : k > .8 ? (1 - k) / .2 : 1, s = k < .1 ? .7 + 3 * k : 1;
    c.save(); c.globalAlpha = clamp(a, 0, 1); c.translate(W / 2, H * .34); c.scale(s, s); c.textAlign = 'center';
    c.font = '700 38px Fraunces, Georgia, serif'; c.lineWidth = 7; c.strokeStyle = 'rgba(20,12,8,.6)'; c.strokeText(b.txt, 0, 0); c.fillStyle = b.col; c.fillText(b.txt, 0, 0);
    c.font = '600 18px Inter, system-ui, sans-serif'; wrap(c, b.sub, W - 60).forEach((l, i) => { c.lineWidth = 5; c.strokeText(l, 0, 34 + i * 23); c.fillStyle = '#fff'; c.fillText(l, 0, 34 + i * 23); });
    c.restore();
  }
}
// The Pocket itself, drawn with its feet at (0,0). Returns its height.
function drawForm(c, form, sprite, S, t, o = {}) {
  const s = S / 96;
  if (form === 'sprout') {
    const g = o.grow ?? 1, col = o.colors || { leaf: '#79c94a' }, h = (30 + Math.min(40, (o.day || 0) * 5)) * s * (.3 + .7 * g), sway = Math.sin(t * 2) * 3 * s;
    c.fillStyle = '#6b4a2e'; c.beginPath(); c.ellipse(0, 0, 30 * s, 9 * s, 0, Math.PI, 0); c.fill();
    c.strokeStyle = '#4f8a35'; c.lineWidth = 5 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -2 * s); c.quadraticCurveTo(-4 * s, -h * .5, sway, -h); c.stroke();
    c.fillStyle = col.leaf; for (const [yy, sz, side] of [[.45, 1, -1], [.45, 1, 1], [.95, .75, -1], [.95, .75, 1]]) { c.beginPath(); c.ellipse(side * 13 * s * sz + sway * yy, -h * yy, 14 * s * sz * g, 6 * s * sz * g, side * -.5, 0, 7); c.fill(); }
    if (col.bloom && (o.day || 0) >= 3) { c.fillStyle = col.bloom; c.beginPath(); c.arc(sway, -h - 6 * s, 6 * s, 0, 7); c.fill(); }
    return h + 10 * s;
  }
  if (form === 'ghost') {
    c.fillStyle = 'rgba(250,248,255,.94)'; c.beginPath(); c.arc(0, -60 * s, 28 * s, Math.PI, 0); c.lineTo(28 * s, -12 * s);
    for (let i = 0; i < 4; i++) { const x1 = 28 * s - (i + .5) * 14 * s, x2 = 28 * s - (i + 1) * 14 * s; c.quadraticCurveTo(x1, (i % 2 ? -4 : -22) * s + Math.sin(t * 6 + i) * 3 * s, x2, -12 * s); }
    c.closePath(); c.fill(); c.fillStyle = '#3a2f5a'; c.beginPath(); c.ellipse(-9 * s, -60 * s, 4 * s, 6 * s, 0, 0, 7); c.ellipse(9 * s, -60 * s, 4 * s, 6 * s, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(120,110,170,.7)'; c.font = `600 ${16 * s}px "Pixelify Sans", monospace`; c.textAlign = 'center'; c.fillText('?', 0, -38 * s);
    return 90 * s;
  }
  if (sprite) { const k = S / Math.max(sprite.width, sprite.height), w = sprite.width * k, h = sprite.height * k; c.imageSmoothingEnabled = false; c.drawImage(sprite, -w / 2, -h, w, h); return h; }
  c.fillStyle = '#9be36a'; c.beginPath(); c.arc(0, -30 * s, 26 * s, 0, 7); c.fill(); eyes(c, 0, -32 * s, s); return 56 * s;
}

// ---------------- the Pocket → game profile ----------------
let A = null;
function attr(p, name) { const k = A.traitNames().indexOf(name); if (k < 0 || !p.a) return undefined; const f = p.a.find((x) => x[0] === k); return f ? f[1] : undefined; }
function profile(id) {
  const p = A.byId().get(id), at = (n) => attr(p, n);
  const rarity = at('Plant rarity') || 'Common', rIdx = Math.max(0, RAR.indexOf(rarity));
  const dead = !!p.d || p.seg === 'reveal';
  const P = { id, seg: dead ? 'reveal' : p.seg === 'plant' ? 'plant' : 'seed', kind: at('Kind') ?? at('Grew from') ?? 'Pocket', rarity, rIdx,
    sky: at('Sky') || 'Clear', ground: at('Ground') || 'Meadow', weather: at('Weather') || 'Drifting petals', companion: at('Companion') || 'Watering can', visitors: at('Visitors') || 'Locals', special: at('Special') || null, palette: at('Palette') || null,
    body: at('Body') || null, keeps: at('Keeps') || null, pose: at('Pose') || null, charms: Number(at('Charms')) || 0, spirit: p.s || null, rk: p.rk ?? (Number(at('Spirit rank')) || null), sk: p.sk ?? 0, wd: p.wd ?? 0, w: p.w ? Date.parse(p.w) : null };
  P.unrevealed = P.seg === 'reveal' && !P.spirit;
  P.sproutColors = sproutColors(P.palette);
  P.speed = 1; P.dropMul = 1; P.magnet = 0; P.lightMul = 1; P.fadeMul = 1; P.hitMul = 1; P.shield0 = 0; P.halo = false; P.keepAlly = null; P.spiritPower = null; P.comboBase = 1; P.rarityMul = 1; P.startDay = 1;
  if (P.seg === 'reveal') {
    if (P.unrevealed) { P.spiritPower = GLIMMER; P.start = 80; }
    else {
      const g = keepsGroup(P.keeps);
      P.spiritPower = SPIRIT_POWERS[P.body] || GLIMMER;
      P.halo = P.rk != null && P.rk <= 250;
      P.start = Math.round(70 + 30 * (1 - clamp(P.rk || 2500, 1, 2500) / 2500));
      P.shield0 = Math.min(4, P.charms + (g === 'token' ? 1 : 0) + (P.halo ? 1 : 0));
      P.speed = (g === 'light' ? 1.15 : 1) * (P.pose === 'Waving' ? 1.1 : 1);
      P.lightMul = g === 'water' ? 1.25 : 1;
      P.fadeMul = (g === 'snack' ? .85 : 1) * (P.pose === 'Resting' ? .9 : 1);
      P.hitMul = P.pose === 'Crouching' ? .75 : 1;
      if (KEEP_ALLY[g]) P.keepAlly = { name: P.keeps, ...KEEP_ALLY[g] };
    }
  } else {
    P.speed = rIdx >= 1 ? 1.12 : 1; P.dropMul = rIdx >= 3 ? 1.3 : 1; P.magnet = rIdx >= 4 ? 70 : 0;
    P.shield0 = rIdx >= 2 ? 1 : 0; P.rarityMul = rIdx === 0 ? 1.15 : 1;
    if (P.seg === 'seed') P.start = METER.soil.max;
    else {
      P.startDay = Math.max(1, P.wd); P.comboBase = 1 + Math.min(P.sk, 60) / 60;
      P.realLeft = P.w ? (P.w + CLOCK * 36e5 - Date.now()) / 36e5 : null;
      P.start = clamp(Math.round(P.realLeft ?? 36), 6, CLOCK);
      if (P.special === 'Morning dew') P.start = Math.min(CLOCK, P.start + 8);
      if (P.special === 'Moss') P.shield0++;
    }
  }
  return P;
}
const unlockNote = (P, need, what) => {
  if (P.seg === 'seed') return ` <em class="gm-lock">${what} on day ${need} after sprouting (about ${Math.round((need - 1) * 24 / HPS)}s in)</em>`;
  return P.startDay >= need ? ' <em class="gm-lock">Ready from the start (real day ' + P.startDay + ')</em>' : ` <em class="gm-lock">${what} on day ${need}. Real day now ${P.startDay}, so about ${Math.round((need - P.startDay) * 24 / HPS)}s into the run</em>`;
};
function dnaRows(P) {
  const rows = [];
  if (P.seg === 'seed') {
    rows.push(['Real state', 'Seed in the soil', `Underground there are no days yet, only Moisture. Catch ${SIPS} drops of seeping water to break the surface.`]);
    rows.push(['Seed power', SEED_POWER.name, SEED_POWER.desc + '.']);
    rows.push(['Destined plant', P.kind, `What it sprouts into. Leaves${P.palette ? ' in ' + P.palette : ''}.`]);
    rows.push(['Destined rarity', P.rarity, RPERK[P.rIdx] + '.', RHEX[P.rarity]]);
    rows.push(['Weather', P.weather, `Once sprouted, the garden plays as ${WEATHER[P.weather]?.name || 'the garden'}: ${WEATHER[P.weather]?.desc || ''}.`]);
    rows.push(['Sky', P.sky, (SKY[P.sky]?.desc || '') + ' (in the garden).']);
    rows.push(['Companion', P.companion, `Garden power: ${POWERS[P.companion]?.desc || ''}.${unlockNote(P, UNLOCK.power, 'Joins')}`]);
    rows.push(['Visitors', P.visitors, `Garden helper: ${ALLIES[P.visitors]?.desc || ''}.${unlockNote(P, UNLOCK.ally, 'Arrive')}`]);
    if (P.special && SPECIAL[P.special]) rows.push(['Special', P.special, SPECIAL[P.special] + (['Morning dew', 'Moss'].includes(P.special) ? ' (for grown plants; a fresh sprout already starts full).' : ' (once it is a plant).')]);
    return rows;
  }
  if (P.seg === 'plant') {
    rows.push(['Real clock', P.realLeft == null ? 'unknown' : P.realLeft > 0 ? `${Math.floor(P.realLeft)}h left right now` : 'past its 72h clock', P.realLeft != null && P.realLeft <= 0 ? 'It is overdue for water, so it starts on a last-stand 6h.' : `You start with ${P.start}h: its live clock${P.special === 'Morning dew' ? ' plus 8h of dew' : ''}, sped up (1 second = 6 hours).`]);
    rows.push(['Watered day', `Day ${P.startDay}`, 'The run starts on its real day. Every 4 seconds is one more day.']);
    rows.push(['Streak', `${P.sk}-day streak`, `x${P.comboBase.toFixed(2)} on every point.`]);
    rows.push(['Rarity', P.rarity, RPERK[P.rIdx] + '.', RHEX[P.rarity]]);
    rows.push(['Weather', P.weather, `Hazards: ${WEATHER[P.weather]?.desc || ''}.`]);
    rows.push(['Sky', P.sky, (SKY[P.sky]?.desc || '') + '.']);
    rows.push(['Companion', P.companion, `Your power: ${POWERS[P.companion]?.desc || ''}.${unlockNote(P, UNLOCK.power, 'Joins')}`]);
    rows.push(['Visitors', P.visitors, `Your helper: ${ALLIES[P.visitors]?.desc || ''}.${unlockNote(P, UNLOCK.ally, 'Arrive')}`]);
    if (P.special && SPECIAL[P.special]) rows.push(['Special', P.special, SPECIAL[P.special] + '.']);
    rows.push(['When it dies', 'It ascends', 'Your run continues for 8s as an unrevealed spirit. Its real reveal happens on Pocket Pad.']);
    return rows;
  }
  if (P.unrevealed) {
    rows.push(['Real state', 'Died, not yet revealed', 'This Pocket has passed on, but its spirit has not been revealed on Pocket Pad yet, so it plays as a plain unrevealed spirit.']);
    rows.push(['Power', GLIMMER.name, GLIMMER.desc + '.']);
    rows.push(['Light', `${P.start}%`, 'No water, no clock in Heaven. Light fades; stars refill it.']);
    return rows;
  }
  const g = keepsGroup(P.keeps);
  rows.push(['Spirit', P.spirit.name, P.spirit.lore || '']);
  rows.push(['Rank', P.rk ? `#${fmt(P.rk)} of 2,500` : 'unranked', `Starts with ${P.start}% light.${P.halo ? ' Top 250: a halo shield.' : ' Top 250 would add a halo shield.'}`]);
  rows.push(['Body', P.body || '–', `Power: ${P.spiritPower.name}. ${P.spiritPower.desc}.`]);
  rows.push(['Keeps', P.keeps || '–', g ? KEEPS[g].desc + '.' : 'A keepsake, no effect.']);
  rows.push(['Pose', P.pose || '–', (POSE[P.pose] || 'No effect') + '.']);
  rows.push(['Charms', String(P.charms), P.charms ? `${plural(P.charms, 'charm shield')} to start.` : 'No charm shields.']);
  rows.push(['Grew from', `${P.kind} · ${P.rarity}`, 'Its plant life. In Heaven there is no water, clock or days.']);
  return rows;
}

// ---------------- art (same-origin only, so the score card can be exported) ----------------
const imgCache = new Map();
function loadImg(src) { if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => { imgCache.delete(src); res(null); }; im.src = src; })); return imgCache.get(src); }
async function spriteOf(id, night) {
  const p = A.byId().get(id), at = A.atlas(), sg = at?.segments?.[p.seg], c = sg?.cells?.[id];
  if (p.seg === 'reveal' && !p.s) return null; // unrevealed spirit: drawn procedurally
  const crop = async (n) => { const im = await loadImg(`/atlas/${n ? sg.night : sg.day}?v=${at.v}`); if (!im) return null; const cv = document.createElement('canvas'); cv.width = c[2]; cv.height = c[3]; cv.getContext('2d').drawImage(im, c[0], c[1], c[2], c[3], 0, 0, c[2], c[3]); return cv; };
  if (c && c[4] === p.c && (!night || c[5])) { const cv = await crop(night && c[5]); if (cv) return cv; }
  if (p.c) { const im = await loadImg(`/api/img?id=${id}&kind=sprite&stem=${encodeURIComponent(p.c)}${night ? '&night=1' : ''}`); if (im) return im; }
  if (c) return crop(false);
  return null;
}
async function loadLive(id) {
  try {
    const r = await Promise.race([fetch(`/api/pocket?id=${id}`), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
    if (!r.ok) return false; const j = await r.json(); if (!j?.pocket) return false;
    const p = A.byId().get(id), a = p.a; for (const k of ['l', 'rk', 'dn', 's']) delete p[k]; Object.assign(p, j.pocket, { a }); A.decorate(p); return true;
  } catch { return false; }
}

// ---------------- score card (1200x675 PNG) ----------------
const aliveTxt = (res) => res.days > 0 ? plural(res.days, 'day') : plural(Math.max(1, res.hours), 'hour');
function headline(res, P) {
  res = { days: 0, hours: 0, sips: 0, depth: 0, seconds: 0, ...res };
  if (P.seg === 'reveal') return `${P.unrevealed ? 'Spirit #' + P.id : `${P.spirit.name} (#${P.id})`} shone for ${plural(res.seconds, 'second')} in Heaven`;
  if (P.seg === 'seed' && !res.sprouted) return `Seed #${P.id} grew roots ${res.depth} cm deep`;
  if (P.seg === 'seed') return `Pocket #${P.id} sprouted after ${res.sips} sips and kept its plant alive ${aliveTxt(res)}`;
  return `Pocket #${P.id} kept its plant alive ${aliveTxt(res)} in ${WEATHER[P.weather]?.name || 'the garden'}`;
}
function cardForm(P, res) {
  if (P.seg === 'reveal') return { scene: 'heaven', form: P.unrevealed ? 'ghost' : 'spirit' };
  if (P.seg === 'seed') return res.sprouted ? { scene: 'garden', form: 'sprout' } : { scene: 'soil', form: 'seed' };
  return { scene: 'garden', form: 'plant' };
}
async function drawCard(res, P, sprite, night) {
  if (document.fonts) await Promise.all(['700 52px Fraunces', '600 22px "Pixelify Sans"', '600 20px Inter', '500 20px Inter'].map((f) => document.fonts.load(f).catch(() => {})));
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 675; const c = cv.getContext('2d');
  const sc = document.createElement('canvas'); sc.width = W; sc.height = H; const R = new Run(P, sprite, 'card', true, night), F = cardForm(P, res);
  R.phase = R.bgA = F.scene;
  for (let i = 0; i < 40; i++) R.update(1 / 20);
  R.hidePlayer = true; R.draw(sc.getContext('2d'), false);
  c.drawImage(sc, 0, 0, W, H, 0, 0, 450, 675);
  const by = PY * 675 / H; c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(225, by, 100, 16, 0, 0, 7); c.fill();
  c.save(); c.translate(225, by + 6 - (F.scene === 'heaven' ? 20 : 0));
  const hh = drawForm(c, F.form, sprite, F.form === 'sprout' ? 260 : 230, 0, { grow: 1, day: res.days || 0, colors: P.sproutColors });
  if (F.form === 'ghost' || P.halo) { c.strokeStyle = '#ffd34d'; c.lineWidth = 6; c.beginPath(); c.ellipse(0, -hh - 18, 46, 12, 0, 0, 7); c.stroke(); }
  c.restore(); c.imageSmoothingEnabled = true;
  const g = c.createLinearGradient(450, 0, 1200, 675); g.addColorStop(0, '#13291e'); g.addColorStop(1, '#22150d'); c.fillStyle = g; c.fillRect(450, 0, 750, 675);
  c.fillStyle = 'rgba(255,255,255,.035)'; const rnd = mulberry(res.score + 7); for (let i = 0; i < 260; i++) c.fillRect(450 + rnd() * 750, rnd() * 675, 2, 2);
  const X = 500; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.font = '600 22px "Pixelify Sans", monospace'; c.fillStyle = '#c8f169'; c.fillText('POCKET RUN', X, 74);
  c.font = '700 48px Fraunces, Georgia, serif'; c.fillStyle = '#fbf3df'; const lines = wrap(c, headline(res, P), 650).slice(0, 3); lines.forEach((l, i) => c.fillText(l, X, 136 + i * 56));
  let y = 136 + lines.length * 56 - 10;
  c.font = '500 20px Inter, system-ui, sans-serif'; c.fillStyle = '#c9b89a';
  const sub = P.seg === 'reveal' ? (P.unrevealed ? 'Passed on, spirit not yet revealed on Pocket Pad' : `${P.spirit.lore || ''} Rank #${P.rk ? fmt(P.rk) : '–'}.`)
    : P.seg === 'seed' ? (res.sprouted ? `A ${P.rarity} ${P.kind} seed. Broke the surface, then lived ${res.toDay > 1 ? 'day 1 → day ' + res.toDay : 'through day 1'} in ${WEATHER[P.weather]?.name || 'the garden'}.` : `A ${P.rarity} ${P.kind} seed. Dried out after ${res.sips} of ${SIPS} sips.`)
    : `${P.kind} · ${P.rarity} · ${res.toDay > res.fromDay ? `real day ${res.fromDay} → day ${res.toDay}` : `on real day ${res.fromDay}`}${P.realLeft != null && P.realLeft <= 0 ? ' · started overdue for water' : ''}`;
  wrap(c, sub, 650).slice(0, 2).forEach((l, i) => c.fillText(l, X, y + 14 + i * 26)); y += 70;
  const alive = res.days > 0 ? ['Days alive', String(res.days)] : ['Hours alive', String(res.hours)];
  const stats = P.seg === 'reveal' ? [['Score', fmt(res.score)], ['Seconds', String(res.seconds)], ['Stars', String(res.stars)], ['Best combo', String(res.bestCombo)]]
    : P.seg === 'seed' && !res.sprouted ? [['Score', fmt(res.score)], ['Sips', `${res.sips}/${SIPS}`], ['Roots (cm)', String(res.depth)], ['Best combo', String(res.bestCombo)]]
    : P.seg === 'seed' ? [['Score', fmt(res.score)], ['Sips', `${res.sips}/${SIPS}`], alive, ['Drops', String(res.drops)]]
    : [['Score', fmt(res.score)], alive, ['Drops', String(res.drops)], ['Best combo', String(res.bestCombo)]];
  stats.forEach(([k, v], i) => { const bx = X + i * 162; c.fillStyle = 'rgba(255,255,255,.06)'; rr(c, bx, y, 148, 100, 16); c.fill(); c.strokeStyle = 'rgba(200,241,105,.22)'; c.lineWidth = 1.5; c.stroke(); c.font = '600 38px "Pixelify Sans", monospace'; c.fillStyle = '#fff'; c.fillText(v, bx + 16, y + 52); c.font = '500 16px Inter, system-ui, sans-serif'; c.fillStyle = '#a99a80'; c.fillText(k, bx + 16, y + 80); });
  y += 128;
  const reached = (n) => res.toDay >= n;
  const chips = (P.seg === 'reveal' ? [`Power: ${P.spiritPower.name}`, P.body ? `Body: ${P.body}` : null, P.keeps ? `Keeps: ${P.keeps}` : null, P.pose ? `Pose: ${P.pose}` : null]
    : P.seg === 'seed' && !res.sprouted ? [`Power: ${SEED_POWER.name}`, `Destined: ${P.kind}`]
    : [res.sprouted ? 'Sprouted from seed' : `${P.sk}-day streak`, reached(UNLOCK.power) ? `Companion: ${P.companion}` : null, reached(UNLOCK.ally) ? `Visitors: ${P.visitors}` : null, `Sky: ${P.sky}`, res.cause === 'ascended' ? 'Ascended' : null])
    .concat(res.titans ? [`Beat the Drought Titan${res.titans > 1 ? ' x' + res.titans : ''}`] : []).filter(Boolean);
  let cx = X, cy = y; c.font = '600 17px Inter, system-ui, sans-serif';
  for (const t of chips) { const w = c.measureText(t).width + 28; if (cx + w > 1160) { if (cy > y) break; cx = X; cy += 44; } c.fillStyle = t.startsWith('Beat') ? 'rgba(255,180,90,.18)' : 'rgba(255,236,210,.08)'; rr(c, cx, cy, w, 36, 18); c.fill(); c.fillStyle = t.startsWith('Beat') ? '#ffcf8a' : '#eadcc0'; c.fillText(t, cx + 14, cy + 24); cx += w + 10; }
  c.font = '600 22px Inter, system-ui, sans-serif'; c.fillStyle = '#fbf3df'; c.fillText('Can your Pocket beat it?', X, 612);
  c.font = '600 20px "Pixelify Sans", monospace'; c.fillStyle = '#c8f169'; c.fillText(`pocket-viewer.vercel.app/#/play/${P.id}`, X, 642);
  c.textAlign = 'right'; c.font = '500 14px Inter, system-ui, sans-serif'; c.fillStyle = '#7d6e58'; c.fillText('Unofficial fan game', 1170, 642);
  return cv;
}
// ---------------- UI ----------------
const G = { id: null, P: null, sprite: null, run: null, card: null, cardBlob: null, cardUrl: null, res: null, night: false, raf: 0, last: 0, open: false, loadTok: 0 };
let mounted = false, cv = null, ctx = null;
const bests = () => { try { return JSON.parse(localStorage.getItem('pocketrun:best') || '{}'); } catch { return {}; } };
const keys = new Set(), keyDir = () => (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
const KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
function mount() {
  mounted = true;
  $('#game').innerHTML = `
  <div class="gm-stage">
    <div class="gm-box">
    <div class="gm-canvas" id="gmWrap">
      <canvas id="gmCanvas" width="${W}" height="${H}" aria-label="Pocket Run game"></canvas>
      <div class="gm-ov" id="gmOv"></div>
    </div>
      <button class="gm-power" id="gmPower" hidden><i></i><b id="gmPowName"></b><small id="gmPowTag"></small></button>
      <button class="gm-mute" id="gmMute" aria-label="Sound on or off"></button>
      <button class="gm-quit" id="gmQuit" aria-label="Pause" hidden><svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
    </div>
    <p class="mm-hint">Move with ← → (or A D), or drag anywhere on the game. Use your power (Root burst, Companion or spirit power) with Space or the round button.</p>
  </div>
  <div class="gm-panel">
    <div class="mm-box">
      <h3 class="mm-h">Pick a Pocket <small>any of 2,500, no wallet</small></h3>
      <div class="mm-idrow"><span>#</span><input id="gmId" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Pocket number"><button class="mm-btn sm" id="gmRand">Random</button></div>
      <p class="gm-best" id="gmBest"></p>
    </div>
    <div class="mm-box">
      <h3 class="mm-h">Pocket DNA <small id="gmLive"></small></h3>
      <div class="gm-dna" id="gmDna"></div>
    </div>
    <div class="mm-box gm-lb" id="gmLb">
      <h3 class="mm-h">Leaderboard <small id="gmLbNote">best run per nickname + Pocket</small></h3>
      <div class="gm-lbtabs" role="tablist">${[['seed', 'Seeds'], ['plant', 'Plants'], ['spirit', 'Spirits']].map(([k, n]) => `<button class="mm-btn sm" role="tab" data-lb="${k}">${n}</button>`).join('')}</div>
      <p class="gm-lbinfo" id="gmLbInfo"></p>
      <ol class="gm-lblist" id="gmLbList"></ol>
    </div>
    <div class="mm-box gm-how">
      <h3 class="mm-h">How a run works</h3>
      <p><b>Seeds</b> start underground. There are no days in the soil, only Moisture: catch water seeping down, dodge rocks, grubs, moles and drought cracks. After ${SIPS} sips the seed breaks the surface and becomes a young plant on day 1 with a full 72h clock.</p>
      <p><b>Plants</b> live in the garden on Pocket Pad's real 72h watering clock (1 second = 6 hours, a day every 4 seconds), starting from their real clock and real day. Their Weather sets the hazards, their Companion is the power (from day ${UNLOCK.power}) and their Visitors help out (from day ${UNLOCK.ally}). When the clock hits zero the plant dies and ascends for a short bonus round.</p>
      <p><b>Spirits</b> live in Heaven: no water, no clock, no days. Their Light fades; catch stars to refill it and dodge shadow wisps, shadow feathers and void rifts. Their power and perks come from their real spirit traits.</p>
      <p>Watch for the Drought Titan, freak weather, eclipses, golden drops and combo frenzies.</p>
      <p>Your personal bests are saved in this browser. To go on the online leaderboard, submit a nickname on the end screen: there is an all-time board for each stage (Seeds, Plants and Spirits score differently).</p>
    </div>
  </div>`;
  cv = $('#gmCanvas'); ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const toX = (e) => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; };
  const wrapEl = $('#gmWrap');
  wrapEl.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .gm-ov-card, a')) return; SND.init(); if (G.run?.state === 'play') { G.run.target = toX(e); G.run.ctl = 'ptr'; try { wrapEl.setPointerCapture(e.pointerId); } catch {} } });
  wrapEl.addEventListener('pointermove', (e) => {
    if (G.run?.state !== 'play' || G.paused) return;
    // the mouse steers only when it really moves (browsers also fire zero-distance moves on layout changes); touch/pen only while held
    if (e.pointerType === 'mouse' ? (e.movementX === 0 && e.movementY === 0) : !e.buttons) return;
    G.run.target = toX(e); G.run.ctl = 'ptr';
  });
  wrapEl.addEventListener('pointerup', (e) => { if (G.run && e.pointerType !== 'mouse') G.run.target = null; });
  wrapEl.addEventListener('pointercancel', () => { if (G.run) G.run.target = null; });
  wrapEl.addEventListener('pointerleave', (e) => { if (G.run && e.pointerType === 'mouse') G.run.target = null; });
  $('#gmPower').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); SND.init(); G.run?.usePower(); });
  $('#gmQuit').addEventListener('click', (e) => { e.currentTarget.blur(); pause(); });
  $('#gmMute').addEventListener('click', (e) => { e.currentTarget.blur(); SND.on = !SND.on; localStorage.setItem('pocketrun:mute', SND.on ? '0' : '1'); SND.init(); syncMute(); });
  const inp = $('#gmId'), pick = () => { const n = Number(inp.value); if (Number.isInteger(n) && n >= 1 && n <= 2500 && n !== G.id) go(n); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
  inp.addEventListener('change', pick);
  $('#gmRand').addEventListener('click', () => go(1 + Math.floor(Math.random() * 2500)));
  $('#gmLb').addEventListener('click', (e) => { const b = e.target.closest('[data-lb]'); if (b) lbShow(b.dataset.lb); });
  $('#gmOv').addEventListener('submit', (e) => { if (e.target.id === 'gmLbForm') { e.preventDefault(); lbSubmit(); } });
  $('#gmOv').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
  const dir = keyDir;
  window.addEventListener('keydown', (e) => {
    if (!G.open || e.target.closest?.('input, select, textarea')) return;
    const k = KEYMAP[e.key];
    if (k) { keys.add(k); if (G.run) { G.run.keys = dir(); G.run.ctl = 'key'; G.run.target = null; } if (G.run?.state === 'play') e.preventDefault(); }
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && G.run?.state === 'play') { e.preventDefault(); G.paused ? resume() : pause(); return; }
    if (G.paused) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resume(); } return; }
    if ([' ', 'ArrowUp', 'w', 'W', 'e', 'E'].includes(e.key) && G.run?.state === 'play') { e.preventDefault(); G.run.usePower(); }
    else if ((e.key === 'Enter' || e.key === ' ') && G.run && G.run.state !== 'play' && G.P && !e.target.closest?.('button, a')) { e.preventDefault(); start(); }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ' && G.open && G.run?.state === 'play') e.preventDefault(); const k = KEYMAP[e.key]; if (k) { keys.delete(k); if (G.run) G.run.keys = dir(); } });
  window.addEventListener('blur', () => { keys.clear(); if (G.run) G.run.keys = 0; });
  document.addEventListener('visibilitychange', () => { G.last = 0; if (document.hidden && G.run?.state === 'play') pause(); });
  syncMute();
}
function syncMute() { $('#gmMute').innerHTML = SND.on ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
function syncBest() { const b = bests()[G.id]; $('#gmBest').innerHTML = b ? `Your best with #${G.id}: <b>${fmt(b.score)}</b>${b.line ? ` (${esc(b.line)})` : ''}` : `No runs with #${G.id} on this browser yet.`; }
async function go(id) {
  if (G.run?.state === 'play') abort();
  G.id = id; $('#gmId').value = id;
  if (location.hash !== `#/play/${id}`) history.replaceState(null, '', `#/play/${id}`);
  const tok = ++G.loadTok;
  G.P = profile(id); G.sprite = null; renderPanel(null); idle(); syncBest(); overlay('loading');
  const live = loadLive(id), soon = Promise.race([live, new Promise((r) => setTimeout(() => r(null), 1200))]);
  const [ok, spr] = await Promise.all([soon, spriteOf(id, G.night)]);
  if (tok !== G.loadTok) return;
  G.sprite = spr; G.P = profile(id); renderPanel(ok); idle(); overlay('start');
  lbShow(LB.tab || stageKey(G.P.seg));
  // live data that lands late still counts, as long as no run has started yet
  if (ok == null) live.then((v) => { if (v && tok === G.loadTok && G.run?.state === 'idle') { G.P = profile(id); renderPanel(true); idle(); overlay('start'); } });
}
function abort() { if (G.run) G.run.state = 'idle'; G.paused = false; full(false); }
function full(on) { document.body.classList.toggle('gm-full', !!on && matchMedia('(max-width: 760px), (max-height: 500px), (pointer: coarse)').matches); }
function pause() { if (G.run?.state !== 'play' || G.paused) return; G.paused = true; overlay('paused'); }
function resume() { if (!G.paused) return; G.paused = false; G.last = 0; if (G.run) { G.run.target = null; G.run.keys = keyDir(); } overlay(null); }
function quit() { abort(); idle(); overlay('start'); }
function renderPanel(live) {
  $('#gmLive').textContent = live == null ? 'loading…' : live ? 'live, just now' : 'from this morning’s snapshot';
  $('#gmDna').innerHTML = dnaRows(G.P).map(([k, v, eff, col]) => `<div class="gm-row"><span class="gm-k">${esc(k)}</span><b class="gm-v"${col ? ` style="color:${col}"` : ''}>${esc(v)}</b><p class="gm-e">${eff}</p></div>`).join('');
}
function idle() { G.paused = false; G.run = new Run(G.P, G.sprite, `${G.id}|${todayUTC()}`, true, G.night); syncPower(); loop(); }
function start() {
  if (!G.P || G.run?.state === 'play') return; SND.init();
  const r = new Run(G.P, G.sprite, `${G.id}|${todayUTC()}`, false, G.night);
  r.onEnd = (res) => setTimeout(() => { if (G.run === r) { full(false); ended(res); } }, 900);
  r.keys = keyDir(); if (r.keys) r.ctl = 'key';
  r.lbTok = lbStart(G.id, G.P.seg);
  G.run = r; G.paused = false; overlay(null); syncPower(); full(true); loop();
  try { const seen = JSON.parse(localStorage.getItem('pocketrun:seen') || '{}'); seen[G.P.seg] = 1; localStorage.setItem('pocketrun:seen', JSON.stringify(seen)); } catch {}
  if (G.P.seg === 'seed') r.say2('Underground', `Catch ${SIPS} drops of water to sprout`, '#ffe3b0');
  else if (G.P.seg === 'reveal') r.say2('Heaven', 'Your light fades. Catch stars, dodge the shadows', '#fff6d8');
  else r.say2(`Day ${G.P.startDay}`, `${G.P.start}h left on the clock. Keep it alive.`, '#fff6d8');
  if (document.body.classList.contains('gm-full')) return;
  const wr = $('#gmWrap').getBoundingClientRect(); if (wr.top < 0 || wr.bottom > innerHeight + 40) $('#gmWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
let powSig = '';
function syncPower() {
  const b = $('#gmPower'), r = G.run, P = G.P;
  const q = $('#gmQuit'), playing = !!r && r.state === 'play' && !G.paused; if (q.hidden === playing) q.hidden = !playing;
  if (!r || r.state !== 'play' || r.phase === 'afterlife') { if (!b.hidden) b.hidden = true; powSig = ''; return; }
  const def = r.power(); if (!def) { if (!b.hidden) b.hidden = true; powSig = ''; return; }
  const on = r.powerOn(), tag = on ? (r.cd > 0 ? Math.ceil(r.cd) + 's' : 'Ready') : `Day ${UNLOCK.power}`, p = on ? clamp(1 - r.cd / def.cd, 0, 1).toFixed(2) : '0';
  const sig = def.name + tag + p; if (sig === powSig) return; powSig = sig;
  b.hidden = false; $('#gmPowName').textContent = def.name; $('#gmPowTag').textContent = tag;
  b.style.setProperty('--p', p); b.classList.toggle('ready', on && r.cd <= 0); b.classList.toggle('locked', !on);
}
function loop() {
  if (G.raf) return;
  const step = (ts) => {
    G.raf = 0; if (!G.open || !G.run) return;
    const dt = G.last ? Math.min(1 / 30, Math.max(0, (ts - G.last) / 1000)) : 1 / 60; G.last = ts;
    if (!G.paused) G.run.update(dt); G.run.draw(ctx); syncPower(); MUSIC.tick(G.run, G.paused || G.run.state !== 'play');
    G.raf = requestAnimationFrame(step);
  };
  G.raf = requestAnimationFrame(step);
}
async function ended(res) {
  const all = bests(), prev = all[res.id], isNew = !prev || res.score > prev.score;
  const line = stageLine(res, G.P);
  if (isNew) all[res.id] = { score: res.score, line, at: Date.now() };
  try { localStorage.setItem('pocketrun:best', JSON.stringify(all)); } catch {}
  G.res = { ...res, isNew, prev: prev?.score ?? null, head: headline(res, G.P), tok: G.run?.lbTok || null }; G.cardBlob = null;
  overlay('end'); syncBest();
  const wr = $('#gmWrap').getBoundingClientRect(); if (wr.top < 0 || wr.bottom > innerHeight + 40) $('#gmWrap').scrollIntoView({ block: 'center' });
  const mine = G.run;
  G.card = await drawCard(res, G.P, G.sprite, G.night);
  if (G.run !== mine) return;
  G.card.toBlob((b) => { if (G.run !== mine || !b) return; if (G.cardUrl) URL.revokeObjectURL(G.cardUrl); G.cardBlob = b; G.cardUrl = URL.createObjectURL(b); const im = $('#gmCardPrev'); if (im) { im.src = G.cardUrl; im.hidden = false; } const s = $('[data-act=save]'); if (s) s.disabled = false; }, 'image/png');
}
function overlay(kind) {
  const ov = $('#gmOv'), P = G.P;
  ov.className = 'gm-ov' + (kind ? ' on ' + kind : '');
  $('#gmMute').hidden = kind === 'end' || kind === 'paused' || kind === 'loading';
  if (!kind) { ov.innerHTML = ''; return; }
  if (kind === 'loading') { ov.innerHTML = `<div class="gm-ov-card sm"><div class="gm-spin"></div><p class="gm-eye">Reading Pocket #${G.id} live…</p></div>`; return; }
  if (kind === 'paused') { ov.innerHTML = `<div class="gm-ov-card sm"><p class="gm-eye">Paused</p><h2>Take a breath</h2><div class="gm-acts one"><button class="mm-btn primary" data-act="resume">Resume</button><button class="mm-btn" data-act="quit">Quit run</button></div></div>`; return; }
  if (kind === 'start') {
    const name = P.seg === 'reveal' ? (P.unrevealed ? 'Unrevealed spirit' : P.spirit.name) : P.kind;
    const pw = P.seg === 'seed' ? SEED_POWER.name : P.seg === 'reveal' ? P.spiritPower.name : P.companion;
    const h = P.seg === 'seed' ? 'Sprout, then survive' : P.seg === 'reveal' ? `Shine as ${name}` : `Keep it alive in ${WEATHER[P.weather]?.name || 'the garden'}`;
    const lockNote = P.startDay >= UNLOCK.power ? `${P.companion} ready` : `${P.companion} joins on day ${UNLOCK.power}`;
    const sub = P.seg === 'plant' ? `${P.start}h on the clock (${P.realLeft == null ? 'real clock unknown' : P.realLeft > 0 ? Math.floor(P.realLeft) + 'h left for real' : 'overdue for real, last stand'}${P.special === 'Morning dew' ? ' + dew' : ''}) · day ${P.startDay} · ${P.sk}-day streak x${P.comboBase.toFixed(2)} · ${lockNote}`
      : P.seg === 'seed' ? `Underground, ${P.start}% moisture. Catch ${SIPS} drops to sprout into a ${P.kind}. Power: ${SEED_POWER.name}`
      : P.unrevealed ? 'This Pocket has passed on, but its spirit is not revealed on Pocket Pad yet. Catch stars to keep your light.'
      : `${P.spirit.lore || ''} ${P.start}% light · ${P.body} power: ${pw}${P.halo ? ' · halo shield' : ''}`;
    const best = bests()[P.id], seen = (() => { try { return JSON.parse(localStorage.getItem('pocketrun:seen') || '{}'); } catch { return {}; } })()[P.seg];
    const how = P.seg === 'seed' ? ['Move to catch the water seeping down through the soil', 'Rocks, grubs, moles and drought cracks cost moisture', `${SIPS} sips and you sprout into a young plant. ${SEED_POWER.name} smashes hazards near you`]
      : P.seg === 'plant' ? ['Catch drops to refill the 72h clock. A day passes every 4 seconds', `${WEATHER[P.weather]?.desc || 'Dodge the hazards'}`, `${P.companion} becomes your power on day ${UNLOCK.power}, ${P.visitors} help from day ${UNLOCK.ally}`]
      : ['Catch stars so your light does not fade', 'Dodge shadow wisps, shadow feathers and void rifts', `${pw}: ${P.spiritPower.desc}`];
    ov.innerHTML = `<div class="gm-ov-card"><p class="gm-eye">Pocket #${P.id} · ${({ seed: 'Seed', plant: 'Plant', reveal: 'Spirit' })[P.seg]} · ${esc(name)}</p><h2>${esc(h)}</h2><p class="gm-sub">${esc(sub)}</p>${seen ? '' : `<ol class="gm-how3">${how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`}${best ? `<p class="gm-bestline">Your best with #${P.id}: <b>${fmt(best.score)}</b>${best.line ? ` · ${esc(best.line)}` : ''}</p>` : ''}<button class="mm-btn primary gm-go" data-act="start">Start run</button><p class="gm-keys">${matchMedia('(pointer: coarse)').matches ? `Drag anywhere to move · tap the round button for ${esc(pw)}` : `← → or drag to move · Space or the button for ${esc(pw)}`}</p></div>`;
    return;
  }
  const r = G.res, url = `${SITE}#/play/${r.id}`, text = `${r.head} on Pocket Run. Score ${fmt(r.score)}. Can your Pocket beat it?`;
  ov.innerHTML = `<div class="gm-ov-card"><p class="gm-eye">Run over · Pocket #${r.id}</p><h2>${esc(r.head)}</h2>
    <p class="gm-sub"><b>${fmt(r.score)}</b> points · best combo ${r.bestCombo} · ${esc(stageLine(r, P))}${r.titans ? ' · beat the Drought Titan' : ''}${r.isNew ? ' · <span class="gm-new">New best!</span>' : ` · your best ${fmt(r.prev)}`}</p>
    <form class="gm-lbform" id="gmLbForm"${LB.offline ? ' hidden' : ''}><label for="gmNick">Put it on the leaderboard</label><div class="gm-lbrow"><input id="gmNick" maxlength="16" autocomplete="nickname" enterkeyhint="send" placeholder="Nickname" value="${esc(localStorage.getItem('pocketrun:nick') || '')}"><button class="mm-btn primary sm" type="submit">Submit</button></div><p class="gm-lbmsg" id="gmLbMsg"></p></form>
    <img class="gm-cardprev" id="gmCardPrev" alt="Score card preview" hidden>
    <div class="gm-acts"><button class="mm-btn primary" data-act="start">Play again</button><button class="mm-btn" data-act="save" disabled>Save score card</button>
    <a class="mm-btn" href="https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Post on X</a><button class="mm-btn" data-act="link">Copy play link</button></div></div>`;
}
async function act(a) {
  if (a === 'start') return start();
  if (a === 'resume') return resume();
  if (a === 'quit') return quit();
  if (a === 'save') {
    if (!G.cardBlob) return; const f = `pocket-run-${G.res.id}-${G.res.score}.png`, file = new File([G.cardBlob], f, { type: 'image/png' });
    if (matchMedia('(pointer:coarse)').matches && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: G.res.head }); return; } catch {} }
    const l = document.createElement('a'); l.href = G.cardUrl; l.download = f; document.body.appendChild(l); l.click(); l.remove(); return;
  }
  if (a === 'lb') return lbShow(stageKey(G.P.seg), true);
  if (a === 'link') { try { await navigator.clipboard.writeText(`${SITE}#/play/${G.res.id}`); } catch {} const b = $('[data-act=link]'); if (b) { b.textContent = 'Link copied'; setTimeout(() => { b.textContent = 'Copy play link'; }, 1600); } }
}
export function openGame(app, id) {
  A = app; G.open = true; G.last = 0;
  const h = new Date().getHours(); G.night = h >= 19 || h < 6;
  if (!mounted) mount();
  const want = id && A.byId().has(id) ? id : (G.id ?? 1 + Math.floor(Math.random() * 2500));
  if (want !== G.id || !G.run) go(want);
  else { if (G.run.state !== 'over') { idle(); overlay('start'); } loop(); }
  window.__game = { G, start, go, pause, resume, quit, profile, dnaRows, headline, POWERS, SPIRIT_POWERS, SEED_POWER, power: () => G.run?.usePower(), finish: () => { if (G.run) { G.run.water = 0; } } };
}
export function closeGame() { G.open = false; if (G.raf) { cancelAnimationFrame(G.raf); G.raf = 0; } if (G.run?.state === 'play') abort(); full(false); }
function stageLine(r, P) {
  if (P.seg === 'reveal') return `shone ${plural(r.seconds, 'second')} · ${plural(r.stars, 'star')}`;
  if (P.seg === 'seed' && !r.sprouted) return `${r.sips}/${SIPS} sips · roots ${r.depth} cm`;
  return `${P.seg === 'seed' ? 'sprouted, then ' : ''}alive ${r.days > 0 ? plural(r.days, 'day') : plural(Math.max(1, r.hours), 'hour')} · ${plural(r.drops, 'drop')}`;
}

// ---------------- leaderboard (free: one private file in a Vercel Blob store) ----------------
const LB = { tab: null, offline: false, tok: 0 };
const LBN = { seed: 'Seed', plant: 'Plant', spirit: 'Spirit' };
const stageKey = (seg) => ({ seed: 'seed', plant: 'plant', reveal: 'spirit' })[seg] || 'seed';
function lbStart(id, seg) {
  const stage = ({ seed: 'seed', plant: 'plant', reveal: 'spirit' })[seg];
  return fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'start', id, stage }) })
    .then((r) => r.json().catch(() => ({}))).then((j) => { if (j.offline) LB.offline = true; return j.token || null; }).catch(() => null);
}
function lbStat(e) {
  const x = e.stat || {}, alive = x.dy > 0 ? plural(x.dy, 'day') : plural(Math.max(1, x.hr || 0), 'hour');
  if (e.stage === 'seed') return x.sp ? `sprouted, then alive ${alive}` : `${x.si || 0}/${SIPS} sips · roots ${x.dp || 0} cm`;
  if (e.stage === 'plant') return `kept alive ${alive}`;
  return `shone ${plural(x.s || 0, 'second')}`;
}
const thumbs = new Map();
function lbThumb(id) {
  if (!thumbs.has(id)) thumbs.set(id, spriteOf(id, false).then((sp) => { if (!sp) return null; const c = document.createElement('canvas'); c.width = c.height = 44; const x = c.getContext('2d'), k = 40 / Math.max(sp.width, sp.height); x.imageSmoothingEnabled = false; x.drawImage(sp, 22 - sp.width * k / 2, 42 - sp.height * k, sp.width * k, sp.height * k); return c.toDataURL(); }).catch(() => null));
  return thumbs.get(id);
}
async function lbShow(tab, scroll) {
  if (!mounted) return; LB.tab = tab; const tok = ++LB.tok;
  document.querySelectorAll('[data-lb]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lb === tab)));
  const info = $('#gmLbInfo'), list = $('#gmLbList');
  info.textContent = `All-time · ${LBN[tab]} runs score differently, so each stage has its own board`;
  list.innerHTML = '<li class="gm-lbempty">Loading…</li>';
  if (scroll) $('#gmLb').scrollIntoView({ behavior: 'smooth', block: 'start' });
  let j; try { const r = await fetch(`/api/scores?stage=${tab}`); j = await r.json(); } catch { j = { error: 'Could not reach the leaderboard' }; }
  if (tok !== LB.tok) return;
  if (j.offline) LB.offline = true;
  if (!j.entries) { list.innerHTML = `<li class="gm-lbempty">${esc(j.offline ? 'The leaderboard is not connected on this copy of the site.' : j.error || 'Unavailable')}</li>`; return; }
  if (!j.entries.length) { list.innerHTML = `<li class="gm-lbempty">No ${LBN[tab].toLowerCase()} runs yet. Be the first.</li>`; return; }
  const me = (localStorage.getItem('pocketrun:nick') || '').toLowerCase();
  list.innerHTML = j.entries.map((e) => `<li class="gm-lbe${e.name.toLowerCase() === me ? ' me' : ''}"><b class="gm-lbr">${e.rank}</b><span class="gm-lbart" data-id="${e.id}"></span><span class="gm-lbwho"><b>${esc(e.name)}</b><small>${e.spirit ? esc(e.spirit) + ' · ' : ''}#${e.id} · ${LBN[e.stage]} · ${esc(lbStat(e))}</small></span><span class="gm-lbsc">${fmt(e.score)}<a href="#/play/${e.id}" aria-label="Play as #${e.id}">Play</a></span></li>`).join('');
  list.querySelectorAll('.gm-lbart').forEach(async (el) => { const u = await lbThumb(Number(el.dataset.id)); if (u && tok === LB.tok) el.style.backgroundImage = `url(${u})`; else if (!u) el.textContent = '?'; });
}
async function lbSubmit() {
  const r = G.res, msg = $('#gmLbMsg'), inp = $('#gmNick'), btn = $('#gmLbForm button'); if (!r || !msg) return;
  const name = inp.value.trim(); if (name.length < 2) { msg.textContent = 'Pick a nickname (2 to 16 characters)'; msg.className = 'gm-lbmsg bad'; return; }
  btn.disabled = true; msg.className = 'gm-lbmsg'; msg.textContent = 'Submitting…';
  const token = await r.tok;
  if (!token) { msg.textContent = LB.offline ? 'The leaderboard is not connected on this copy of the site.' : 'This run could not be registered (offline?), so it cannot be submitted.'; msg.className = 'gm-lbmsg bad'; btn.disabled = false; return; }
  const run = { score: r.score, dur: r.dur, bestCombo: r.bestCombo, sips: r.sips, depth: r.depth, sprouted: r.sprouted, hours: r.hours, days: r.days, seconds: r.seconds, stars: r.stars };
  let j; try { const res = await fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, name, run }) }); j = await res.json(); } catch { j = { error: 'Could not reach the leaderboard' }; }
  if (G.res !== r) return;
  if (!j.ok) { msg.textContent = j.error || 'Could not submit'; msg.className = 'gm-lbmsg bad'; btn.disabled = !!/already/.test(j.error || ''); return; }
  localStorage.setItem('pocketrun:nick', name);
  const part = (b, what) => b ? (b.improved ? `#${b.rank} of ${b.total} ${what}` : `your best here stays ${fmt(b.best)} (#${b.rank} ${what})`) : null;
  msg.innerHTML = `${esc(part(j.all, `all-time ${LBN[j.stage]}s`) || 'Saved')} · <button type="button" class="gm-lblink" data-act="lb">See the board</button>`; msg.className = 'gm-lbmsg good';
  inp.disabled = true; r.tok = Promise.resolve(null);
  if (LB.tab) lbShow(LB.tab);
}

// Plain facts about how a Pocket plays, for Pocket Wrapped (same profile() the game itself uses).
export function runInfo(app, id) {
  A = app; const P = profile(id), out = { seg: P.seg, unrevealed: P.unrevealed, rarity: P.rarity, rarityPerk: RPERK[P.rIdx], start: P.start, startDay: P.startDay, halo: P.halo, comboBase: P.comboBase };
  if (P.seg === 'seed') { out.power = { name: SEED_POWER.name, desc: SEED_POWER.desc, note: 'Charged from the start' }; out.unit = '% moisture'; }
  else if (P.seg === 'plant') {
    const pw = POWERS[P.companion], al = ALLIES[P.visitors];
    out.unit = 'h on the clock';
    out.power = pw ? { name: P.companion, desc: pw.desc, note: P.startDay >= UNLOCK.power ? `Ready from the start (day ${P.startDay})` : `Joins on day ${UNLOCK.power}` } : null;
    out.helper = al ? { name: P.visitors, desc: al.desc, note: P.startDay >= UNLOCK.ally ? `Ready from the start (day ${P.startDay})` : `Arrives on day ${UNLOCK.ally}` } : null;
    out.weather = WEATHER[P.weather] ? { name: P.weather, desc: WEATHER[P.weather].desc } : null;
    out.sky = SKY[P.sky] ? { name: P.sky, desc: SKY[P.sky].desc } : null;
    out.special = P.special && SPECIAL[P.special] ? { name: P.special, desc: SPECIAL[P.special] } : null;
  } else {
    out.unit = '% light';
    out.power = P.spiritPower ? { name: P.spiritPower.name, desc: P.spiritPower.desc, note: P.unrevealed ? 'Plain unrevealed spirit' : `From its ${P.body} body` } : null;
    const g = keepsGroup(P.keeps);
    out.keeps = g ? { name: P.keeps, desc: KEEPS[g].desc } : null;
    out.pose = P.pose && POSE[P.pose] ? { name: P.pose, desc: POSE[P.pose] } : null;
    out.charms = P.charms;
  }
  return out;
}
