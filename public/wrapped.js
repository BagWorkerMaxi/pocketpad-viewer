// Pocket Wrapped: swipeable story cards for one Pocket (#/wrapped/<id>) or a whole wallet (#/wrapped/wallet/<0x…>).
// Every number comes from the snapshot / live state the site already loads (nothing is invented).
// Each card is a small data spec (blocks) drawn twice: as DOM for the story, and on a canvas for the PNG download.
const SITE = 'https://pocket-viewer.vercel.app/';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => Math.round(Number(n)).toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const short = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
const pctTxt = (sh) => (sh * 100).toFixed(sh < 0.01 ? 2 : sh < 0.1 ? 1 : 0) + '%';
const DAY = 864e5, CLOCK = 3 * DAY, CARD_MS = 6500;
const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'One of One'];
const THEMES = {
  seed: { name: 'Seed', acc: '#f0b36a', grad: ['#150d08', '#3a2415', '#6b4426'], ink: '#fbefdc', dim: '#d2b894' },
  plant: { name: 'Plant', acc: '#c8f169', grad: ['#0c2417', '#1f5a31', '#79b84e'], ink: '#f6fbe9', dim: '#bfdcb0' },
  spirit: { name: 'Spirit', acc: '#ffd98a', grad: ['#1c1442', '#5a46b0', '#c4a9f2'], ink: '#fffaf0', dim: '#d8cdf5' },
  wallet: { name: 'Wallet', acc: '#ffcf7a', grad: ['#150d08', '#2f4a2a', '#5a3f9c'], ink: '#fff6e6', dim: '#d6c9b0' },
};
const STAGE_OF = { seed: 'Seed', plant: 'Plant', reveal: 'Spirit' };
const THEME_OF = { seed: 'seed', plant: 'plant', reveal: 'spirit' };

// ---------------- stats over all 2,500 Pockets ----------------
const SKIP = new Set(['Stage', 'Spirit rank', 'Tier', 'Day', 'Streak']);
let ST = null, STsig = '';
function traitsOf(app, p) { // [[trait, value]], "Grew from" is the same thing as "Kind"
  const names = app.traitNames(), out = [];
  for (const [k, v] of p.a || []) { let n = names[k]; if (!n || SKIP.has(n)) continue; if (n === 'Grew from') n = 'Kind'; out.push([n, String(v)]); }
  return out;
}
function stats(app) {
  const byId = app.byId(), sig = byId.size + '|' + app.stateAt();
  if (ST && STsig === sig) return ST; STsig = sig;
  const cnt = new Map(), tot = new Map(); // trait -> Map(value -> n); trait -> pockets having it
  const per = new Map();
  for (const p of byId.values()) {
    const t = traitsOf(app, p); per.set(p.i, t); const seen = new Set();
    for (const [n, v] of t) { if (!cnt.has(n)) cnt.set(n, new Map()); const m = cnt.get(n); m.set(v, (m.get(v) || 0) + 1); seen.add(n); }
    for (const n of seen) tot.set(n, (tot.get(n) || 0) + 1);
  }
  const info = new Map(); const byStage = { seed: [], plant: [], reveal: [] };
  for (const p of byId.values()) {
    const list = per.get(p.i).map(([n, v]) => { const c = cnt.get(n).get(v), T = tot.get(n); return { t: n, v, n: c, tot: T, share: c / T }; }).sort((a, b) => a.share - b.share);
    const score = list.reduce((s, x) => s + -Math.log(x.share), 0);
    const o = { list, score, p }; info.set(p.i, o); byStage[p.seg].push(o);
  }
  for (const k of Object.keys(byStage)) { const arr = byStage[k]; arr.sort((a, b) => b.score - a.score); arr.forEach((o, i) => { o.rank = i; }); for (let i = 0; i < arr.length; i++) { let j = i; while (j > 0 && arr[j - 1].score === arr[i].score) j--; arr[i].rank = j + 1; } }
  const plants = byStage.plant.map((o) => o.p);
  const rankBy = (p, f) => 1 + plants.filter((q) => f(q) > f(p)).length;
  ST = { cnt, tot, info, byStage, plants, rankBy, died: [...byId.values()].filter((p) => p.d).length };
  return ST;
}

// ---------------- personality (derived from real traits, just for fun) ----------------
const P_WEATHER = { 'Soft rain': 'Dreamy', Snowfall: 'Chill', Sunbeams: 'Radiant', 'Leaf breeze': 'Breezy', 'Drifting petals': 'Romantic', Butterflies: 'Fluttery' };
const P_WEATHER_TXT = { 'Soft rain': 'wears its heart on its leaves, and cries a little at sunsets', Snowfall: 'stays cool when everything gets frosty', Sunbeams: 'wakes up bright and glows at everyone', 'Leaf breeze': 'goes wherever the wind goes, and loves the ride', 'Drifting petals': 'scatters little romantic gestures everywhere', Butterflies: 'is always in a flutter about something new' };
const P_COMP = { 'Watering can': ['Caretaker', 'always has a drink ready for a friend'], 'Mossy stone': ['Rock', 'is solid, patient and very hard to rattle'], Signpost: ['Navigator', 'knows the way and will tell you twice'], Lantern: ['Night-owl', 'comes alive after dark and lights the way'], Bench: ['Lounger', 'has mastered the art of sitting down'], Gnome: ['Trickster', 'is up to some harmless mischief'], Birdbath: ['Splasher', 'loves a good splash and a good gossip'], Telescope: ['Stargazer', 'keeps one eye on the far horizon'], 'Treasure chest': ['Hoarder', 'quietly keeps the shiny things safe'], 'Golden gnome': ['Legend', 'is the golden prankster of the whole garden'] };
const P_VIS = { Locals: 'Neighbours drop by all day', Songbirds: 'Songbirds bring the soundtrack', 'Pond folk': 'Pond folk keep it entertained', Woodland: 'Woodland friends keep it company', Moths: 'Moths circle its lantern light', Dragonling: 'A dragonling is its bold sidekick' };
const P_SKY = { Clear: 'keeps a clear, open mind', 'Golden hour': 'lives in permanent golden hour', 'Pink dawn': 'always starts the day gently', 'Cotton clouds': 'daydreams under cotton clouds', Rainbow: 'sees a rainbow in everything', Comet: 'dreams big, with comets overhead' };
const P_BODY = { Pond: 'Serene', Moss: 'Cozy', Blossom: 'Sweet', Fungus: 'Mysterious', Root: 'Grounded', Stone: 'Steady', Tide: 'Flowing', Hive: 'Buzzy', Ember: 'Fiery', Star: 'Shining' };
const P_BODY_TXT = { Pond: 'is calm like still water', Moss: 'is soft, cozy and comes with a hug', Blossom: 'is sweet and smells lovely', Fungus: 'is a little mysterious, and proud of it', Root: 'is deeply grounded', Stone: 'is steady and does not move for anyone', Tide: 'comes and goes like the tide', Hive: 'is buzzing with ideas', Ember: 'is warm, bright and a bit fiery', Star: 'was made to shine' };
const P_POSE = { 'Hand in pocket': ['Cool Cat', 'plays it cool with a hand in its pocket'], Waving: ['Greeter', 'waves at everyone it meets'], Resting: ['Napper', 'is taking a well-earned rest'], Thinking: ['Thinker', 'is deep in thought'], Crouching: ['Sneak', 'stays low and keeps an eye out'] };
function personality(p, tr) {
  const v = (n) => tr.find(([t]) => t === n)?.[1];
  const w = v('Weather'), c = v('Companion'), vis = v('Visitors'), sky = v('Sky'), body = v('Body'), pose = v('Pose'), keeps = v('Keeps'), eyes = v('Eyes');
  const lines = [];
  if (p.seg === 'reveal' && (body || pose)) {
    const t = `The ${P_BODY[body] || 'Quiet'} ${P_POSE[pose]?.[0] || 'Spirit'}`;
    if (body) lines.push([`Body: ${body}`, `It ${P_BODY_TXT[body] || 'has a body of its own'}.`]);
    if (pose) lines.push([`Pose: ${pose}`, `It ${P_POSE[pose]?.[1] || 'strikes a pose'}.`]);
    if (keeps) lines.push([`Keeps: ${keeps}`, `${Cap(an(keeps))} ${keeps.toLowerCase()} in its pocket, just in case.`]);
    if (eyes && lines.length < 3) lines.push([`Eyes: ${eyes}`, `${eyes} eyes that miss nothing.`]);
    return { title: t, lines };
  }
  if (!w && !c && !sky && !vis) return null;
  const t = `The ${P_WEATHER[w] || (sky ? ({ Clear: 'Clear-headed', 'Golden hour': 'Golden', 'Pink dawn': 'Gentle', 'Cotton clouds': 'Dreamy', Rainbow: 'Cheerful', Comet: 'Cosmic' }[sky]) : 'Quiet')} ${P_COMP[c]?.[0] || 'Plant'}`;
  if (w) lines.push([`Weather: ${w}`, `It ${P_WEATHER_TXT[w] || 'has its own weather'}.`]);
  if (c) lines.push([`Companion: ${c}`, `It ${P_COMP[c]?.[1] || 'keeps a companion close'}.`]);
  if (vis) lines.push([`Visitors: ${vis}`, `${P_VIS[vis] || vis + ' come to visit'}.`]);
  if (sky && lines.length < 4) lines.push([`Sky: ${sky}`, `It ${P_SKY[sky] || 'has a sky of its own'}.`]);
  return { title: t, lines };
}

// ---------------- Pocket cards ----------------
const an = (w) => (/^one\b/i.test(String(w)) ? 'a' : /^([aeiou]|8|11$|18$)/i.test(String(w)) ? 'an' : 'a'); // 'an Uncommon', 'a One of One'
const Cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, w, ws) => `${fmtN(n)} ${n === 1 ? w : (ws || w + 's')}`;
const dateTxt = (t, withTime) => new Date(t).toLocaleString(undefined, withTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });
const art = (p, o = {}) => ({ t: 'art', id: p.i, stem: p.c, ...o });
const kindTxt = (p, tr) => tr.find(([t]) => t === 'Kind')?.[1] || p.kind || null;
const tname = (p, t) => (t === 'Kind' && p.seg === 'reveal' ? 'Grew from' : t);
const groupTxt = (x, S) => x.tot >= 2500 ? 'Pockets' : x.tot === S.byStage.reveal.length ? 'revealed spirits' : x.tot === S.byStage.seed.length + S.byStage.plant.length ? 'seeds and plants' : `Pockets that show a ${x.t} trait`;
const haveTxt = (x, S) => { const g = groupTxt(x, S), all = x.tot >= 2500 ? 'all 2,500 Pockets' : `all ${fmtN(x.tot)} ${g}`; return x.n === 1 ? `The only one in ${all}.` : `${fmtN(x.n)} of ${x.tot >= 2500 ? '2,500' : 'the ' + fmtN(x.tot)} ${g} have it.`; };
function pocketCards(app, p, X) {
  const S = stats(app), inf = S.info.get(p.i), tr = traitsOf(app, p), th = THEME_OF[p.seg];
  const kind = kindTxt(p, tr), rar = p.rarity || tr.find(([t]) => t === 'Plant rarity')?.[1] || null;
  const list = inf.list, now = Date.now(), seg = p.seg;
  const N = { seed: S.byStage.seed.length, plant: S.byStage.plant.length, reveal: S.byStage.reveal.length };
  const spirit = p.s || null, cards = [], wd = p.wd ?? 0, sk = p.sk ?? 0;
  const add = (id, blocks, share) => cards.push({ id, theme: th, blocks, share, file: `pocket-${p.i}-wrapped-${id}` });
  const rk = p.rk != null ? p.rk : null, dn = p.dn != null ? p.dn : null;
  const kr = `${rar ? rar + ' ' : ''}${kind || 'plant'}`; // "Common Meadow Fern"

  // 1. intro
  const introText = seg === 'seed' ? `Still a seed, destined to be ${an(kr)} ${kr}`
    : seg === 'plant' ? `${Cap(an(kr))} ${kr}, growing in the garden`
    : spirit ? `${spirit.name}, a spirit that grew from ${an(kr)} ${kr}` : 'A spirit waiting to be revealed';
  add('intro', [art(p, { big: true }), { t: 'eyebrow', text: 'Pocket Wrapped' }, { t: 'title', text: `Pocket #${p.i}`, size: 'xl' }, { t: 'text', text: introText, strong: true },
    { t: 'chips', items: [STAGE_OF[seg], ...(seg === 'seed' && rar ? ['Destined: ' + rar] : seg === 'plant' && rar ? [rar] : seg === 'reveal' && spirit?.tier ? [spirit.tier + ' tier'] : [])] },
    { t: 'text', text: 'Tap, swipe or use ← → to see its story', dim: true }],
    seg === 'seed' ? `Pocket #${p.i} Wrapped 🎁 ${Cap(an(kr))} ${kr}, still a seed 🌱`
      : seg === 'plant' ? `Pocket #${p.i} Wrapped 🎁 ${Cap(an(kr))} ${kr} with ${an(sk)} ${sk}-day streak 🌿`
      : spirit ? `Pocket #${p.i} Wrapped 🎁 ${spirit.name}, a spirit that grew from ${an(kr)} ${kr} 👻` : `Pocket #${p.i} Wrapped 🎁 A spirit waiting for its reveal 👻`);

  // 2. journey (a seed only shows what it is destined for)
  const dayTxt = `${plural(wd, 'day')} watered`;
  const nodes = seg === 'seed'
    ? [{ icon: 'seed', label: 'Seed', state: 'now', detail: 'Asleep in the soil. Not planted yet, so no days or streak' }, { icon: 'plant', label: 'Plant', state: 'todo', detail: `Destined to grow into ${an(kr)} ${kr}` }]
    : [{ icon: 'seed', label: 'Seed', state: 'done', detail: 'Planted' },
      { icon: 'plant', label: 'Plant', state: seg === 'plant' ? 'now' : 'done', detail: seg === 'plant' ? `${dayTxt} so far` : `${dayTxt} before it died` },
      { icon: 'spirit', label: 'Spirit', state: seg === 'reveal' ? 'now' : 'todo', detail: seg === 'reveal' ? (spirit ? `Revealed as ${spirit.name}` : 'Died, not revealed yet') : 'Rises if it goes 72 hours without water' }];
  add('journey', [{ t: 'eyebrow', text: 'Its journey' }, { t: 'title', text: seg === 'seed' ? 'Still underground' : seg === 'plant' ? 'Growing in the garden' : 'From seed to spirit', size: 'l' }, { t: 'journey', nodes },
    { t: 'text', text: seg === 'seed' ? 'Days and streaks start once it is planted.' : seg === 'plant' ? 'A plant has no spirit yet. That only happens if it dies.' : 'A spirit is revealed once and never changes.', dim: true }],
    seg === 'seed' ? `Pocket #${p.i} is still a seed, destined to be ${an(kr)} ${kr} 🌱` : seg === 'plant' ? `Pocket #${p.i} is a plant with ${plural(wd, 'day')} watered so far 🌿` : `Pocket #${p.i} grew from seed to plant to spirit, with ${plural(wd, 'day')} watered 👻`);

  // 3. plant: the clock
  if (seg === 'plant' && p.diesAt) {
    const left = Math.min(CLOCK, p.diesAt - now), mins = Math.max(0, Math.floor(left / 6e4)), showM = left > 0 && left < 36e5, danger = left < 12 * 36e5;
    const lastW = p.w ? dateTxt(p.w, true) : null;
    add('clock', left > 0
      ? [{ t: 'eyebrow', text: 'The 72 hour clock' }, { t: 'big', to: showM ? mins : Math.floor(left / 36e5), suffix: showM ? 'm' : 'h', label: danger ? 'left before it dies. It needs water soon!' : 'left before it dies, unless it gets water' },
        { t: 'bars', rows: [{ label: 'Clock', value: showM ? `${mins}m of 72h` : `${Math.floor(left / 36e5)}h of 72h`, pct: clamp(left / CLOCK, 0, 1) }] },
        { t: 'facts', rows: [...(lastW ? [['Last watered', lastW]] : []), ['It dies at', dateTxt(p.diesAt, true) + ' if not watered']] },
        { t: 'text', text: 'A plant dies 72 hours after its last watering.', dim: true }]
      : [{ t: 'eyebrow', text: 'The 72 hour clock' }, { t: 'title', text: 'Its clock ran out', size: 'xl' }, { t: 'facts', rows: [...(lastW ? [['Last watered', lastW]] : []), ['Clock ended', dateTxt(p.diesAt, true)]] },
        { t: 'text', text: 'A plant dies 72 hours after its last watering.', dim: true }],
      left > 0 ? `Pocket #${p.i} has ${showM ? mins + ' minutes' : Math.floor(left / 36e5) + 'h'} left on its 72h watering clock ⏳` : `Pocket #${p.i}'s 72h watering clock has run out ⏳`);
  }

  // spirit: place in history (death order and rank are the same ordering, so they share one card)
  if (seg === 'reveal' && spirit && dn != null) {
    add('history', [{ t: 'eyebrow', text: 'Its place in history' }, { t: 'big', to: dn, prefix: '#', label: `the ${ord(dn)} Pocket to die` },
      { t: 'facts', rows: [...(rk != null ? [['Spirit rank', `#${fmtN(rk)} of 2,500 (1 is the rarest)`]] : []), ['Pockets that have died', `${fmtN(S.died)} of 2,500 so far`], ...(p.w ? [['Last watered', dateTxt(p.w)]] : [])] },
      { t: 'text', text: 'Its 72 hour clock ran out, and its spirit rose.', dim: true }],
      `Pocket #${p.i} was the ${ord(dn)} Pocket to die${rk != null ? ' and is spirit rank #' + fmtN(rk) + ' of 2,500' : ''} 👻`);
  }
  if (seg === 'reveal' && spirit) {
    add('spirit', [art(p), { t: 'eyebrow', text: 'Its spirit' }, { t: 'title', text: spirit.name, size: 'xl' }, ...(spirit.tier ? [{ t: 'chips', items: [spirit.tier + ' tier'] }] : []),
      ...(spirit.lore ? [{ t: 'quote', text: spirit.lore }] : [])],
      `Pocket #${p.i} is ${spirit.name}${spirit.tier ? ', ' + an(spirit.tier) + ' ' + spirit.tier + ' spirit' : ', a spirit'} 👻`);
    if (inf.rank && N.reveal > 1) {
      const R = N.reveal, tierN = spirit.tier ? S.byStage.reveal.filter((o) => o.p.s?.tier === spirit.tier).length : 0;
      add('standing', [{ t: 'eyebrow', text: 'Among revealed spirits' }, { t: 'big', to: inf.rank, prefix: '#', label: `of ${fmtN(R)} revealed spirits by trait rarity` },
        { t: 'bars', rows: [{ label: 'Rarer than', value: Math.round((R - inf.rank) / R * 100) + '% of them', pct: clamp(1 - (inf.rank - 1) / R, 0, 1) }, ...(tierN ? [{ label: 'Tier', value: spirit.tier, pct: clamp(1 - tierN / R, 0.04, 1), note: `${fmtN(tierN)} of ${fmtN(R)} revealed spirits are ${spirit.tier}` }] : [])] },
        { t: 'text', text: 'Trait rarity adds up how rare each of its traits is across all 2,500 Pockets. #1 is the rarest.', dim: true }],
        `Pocket #${p.i} (${spirit.name}) is #${fmtN(inf.rank)} of ${fmtN(R)} revealed spirits by trait rarity 👻`);
    }
  }
  if (seg === 'reveal' && !spirit) {
    add('wait', [{ t: 'eyebrow', text: 'Waiting for the reveal' }, ...(dn != null ? [{ t: 'big', to: dn, prefix: '#', label: `the ${ord(dn)} Pocket to die` }] : [{ t: 'title', text: 'Not revealed yet', size: 'xl' }]),
      { t: 'text', text: 'Its spirit has not been revealed on Pocket Pad yet. Its name, tier and rank will show up here once it is.', dim: true }],
      `Pocket #${p.i} has died and is waiting for its spirit reveal 👻`);
  }

  // plant ranks / seed rank
  if (seg === 'plant') {
    const M = S.plants.length, rs = S.rankBy(p, (q) => q.sk ?? 0), rd = S.rankBy(p, (q) => q.wd ?? 0);
    const top = (r) => `#${fmtN(r)} of ${fmtN(M)}`, pc = (r) => clamp(1 - (r - 1) / Math.max(1, M), 0, 1);
    add('streak', [{ t: 'eyebrow', text: 'Its watering streak' }, { t: 'big', to: sk, label: sk === 1 ? 'day in a row' : 'days in a row' },
      { t: 'bars', rows: [{ label: 'Streak', value: top(rs), pct: pc(rs) }, { label: 'Days watered', value: top(rd), pct: pc(rd) }, ...(inf.rank ? [{ label: 'Trait rarity', value: top(inf.rank), pct: pc(inf.rank) }] : [])] },
      { t: 'text', text: `Ranked against the ${fmtN(M)} plants in the garden right now. #1 is the highest.`, dim: true }],
      `Pocket #${p.i} has ${an(sk)} ${sk}-day watering streak, #${fmtN(rs)} of ${fmtN(M)} garden plants 🌿`);
  }
  if (seg === 'seed' && inf.rank) {
    const M = N.seed, rr = rar ? S.cnt.get('Plant rarity')?.get(rar) : null;
    add('rank', [{ t: 'eyebrow', text: 'Among seeds' }, { t: 'big', to: inf.rank, prefix: '#', label: `of ${fmtN(M)} seeds by trait rarity` },
      { t: 'bars', rows: [{ label: 'Rarer than', value: Math.round((M - inf.rank) / M * 100) + '% of seeds', pct: clamp(1 - (inf.rank - 1) / M, 0, 1) }, ...(rar && rr ? [{ label: 'Destined rarity', value: rar, pct: clamp(1 - rr / 2500, 0.04, 1), note: `${fmtN(rr)} of 2,500 Pockets are ${rar}` }] : [])] },
      { t: 'text', text: 'Trait rarity adds up how rare each of its traits is across all 2,500 Pockets. #1 is the rarest seed.', dim: true }],
      `Pocket #${p.i} is #${fmtN(inf.rank)} of ${fmtN(M)} seeds by trait rarity 🌱`);
  }

  // traits
  if (list.length) {
    const top = list[0], rest = list.filter((x) => x !== top).slice(0, 4);
    add('traits', [{ t: 'eyebrow', text: 'Its rarest trait' }, { t: 'big', to: Math.round(1 / top.share), prefix: '1 in ', label: `${tname(p, top.t)}: ${top.v}` }, { t: 'text', text: haveTxt(top, S), dim: true },
      { t: 'bars', rows: rest.map((x) => ({ label: tname(p, x.t), value: x.v, pct: clamp(1 - x.share, 0.04, 1), note: `${pctTxt(x.share)} have it · ${fmtN(x.n)} of ${fmtN(x.tot)}` })) }],
      `Pocket #${p.i}'s rarest trait is ${tname(p, top.t)}: ${top.v}, 1 in ${fmtN(Math.round(1 / top.share))} ✨`);
  }

  // Pocket Run
  const ri = X.run, best = X.best, lb = X.lb;
  {
    const rows = [];
    if (ri) {
    if (ri.power) rows.push([`${seg === 'reveal' ? 'Spirit power' : seg === 'plant' ? 'Companion power' : 'Seed power'}: ${ri.power.name}`, `${ri.power.desc}.${ri.power.note ? ' ' + ri.power.note + '.' : ''}`]);
    if (seg === 'plant' && ri.helper) rows.push([`Helper: ${ri.helper.name}`, `${ri.helper.desc}.${ri.helper.note ? ' ' + ri.helper.note + '.' : ''}`]);
    if (seg === 'plant' && ri.weather) rows.push([`Weather: ${ri.weather.name}`, ri.weather.desc]);
    if (seg === 'reveal' && ri.keeps) rows.push([`Keeps: ${ri.keeps.name}`, ri.keeps.desc]);
    if (seg !== 'reveal' && ri.rarityPerk) rows.push([`${seg === 'seed' ? 'Destined ' : ''}${ri.rarity} rarity perk`, ri.rarityPerk]);
    if (seg === 'reveal' && ri.halo) rows.push(['Halo', 'A top 250 spirit starts with a halo shield']);
    rows.push([seg === 'reveal' ? 'Run starts with' : 'Run starts at', seg === 'plant' ? `${ri.start}h on the clock, day ${ri.startDay}` : seg === 'seed' ? '100% moisture' : ri.start + '% light']);
    }
    const lbs = (lb || []).map((e) => `${Cap(e.stage)} leaderboard: #${e.rank} · ${e.name} · ${fmtN(e.score)}`);
    const blocks = [{ t: 'eyebrow', text: 'In Pocket Run' }];
    if (best) blocks.push({ t: 'big', to: best.score, label: 'your best score on this device' });
    else blocks.push({ t: 'title', text: 'No run yet', size: 'xl' }, { t: 'text', text: 'Play it in Pocket Run to set a score.', dim: true });
    if (rows.length) blocks.push({ t: 'facts', rows });
    if (lbs.length) blocks.push({ t: 'chips', items: lbs.slice(0, 2) });
    blocks.push({ t: 'link', text: 'Play as #' + p.i, href: '#/play/' + p.i });
    add('run', blocks, best ? `Pocket #${p.i} scored ${fmtN(best.score)} in Pocket Run 🎮${ri?.power ? ' Power: ' + ri.power.name : ''}` : `Pocket #${p.i} is ready for Pocket Run 🎮${ri?.power ? ' Power: ' + ri.power.name : ''}`);
  }

  // personality (seeds describe what they are destined for)
  const pers = personality(p, tr);
  if (pers && pers.lines.length) {
    if (seg === 'seed') pers.lines = pers.lines.map(([k, v]) => ['Destined ' + k.charAt(0).toLowerCase() + k.slice(1), v]);
    add('personality', [{ t: 'eyebrow', text: seg === 'seed' ? 'Its personality, once grown' : 'Its personality' }, { t: 'title', text: pers.title, size: 'xl' }, { t: 'quotes', rows: pers.lines }, { t: 'text', text: 'Just for fun, worked out from its real traits.', dim: true }],
      `Pocket #${p.i} is ${pers.title} 😄 (worked out from its traits)`);
  }

  // summary
  const facts = [['Stage', STAGE_OF[seg]]];
  if (seg === 'reveal') { if (spirit) facts.push(['Spirit', spirit.name]); if (kind) facts.push(['Grew from', `${rar ? rar + ' ' : ''}${kind}`]); if (dn != null) facts.push(['Died', `${ord(dn)}${rk != null ? ' · rank #' + fmtN(rk) : ''}`]); facts.push(['Days watered', fmtN(wd)]); }
  else { if (kind) facts.push([seg === 'seed' ? 'Destined kind' : 'Kind', kind]); if (rar) facts.push([seg === 'seed' ? 'Destined rarity' : 'Plant rarity', rar]); if (seg === 'plant') facts.push(['Streak', plural(sk, 'day')], ['Days watered', fmtN(wd)]); }
  if (list[0]) facts.push(['Rarest trait', `${list[0].v} (1 in ${fmtN(Math.round(1 / list[0].share))})`]);
  add('summary', [art(p), { t: 'eyebrow', text: 'Pocket Wrapped' }, { t: 'title', text: `Pocket #${p.i}`, size: 'xl' }, { t: 'facts', rows: facts.slice(0, 6), compact: true }, { t: 'poster' }, { t: 'link', text: 'Make a meme', href: '#/meme/' + p.i }, { t: 'link', text: 'Play as #' + p.i, href: '#/play/' + p.i }],
    seg === 'seed' ? `Pocket #${p.i}: a seed destined to be ${an(kr)} ${kr}${list[0] ? '. Rarest trait: ' + list[0].v + ' (1 in ' + fmtN(Math.round(1 / list[0].share)) + ')' : ''} 🎁`
      : seg === 'plant' ? `Pocket #${p.i}: ${an(kr)} ${kr} plant, ${sk}-day streak, ${plural(wd, 'day')} watered 🎁`
      : `Pocket #${p.i}: ${spirit ? spirit.name + ', a spirit' : 'a spirit'} that grew from ${an(kr)} ${kr}${dn != null ? ', the ' + ord(dn) + ' to die' : ''} 🎁`);

  // celebrations, only for genuinely rare facts
  const mark = (id, c) => { const k = cards.find((x) => x.id === id); if (k && c) k.celebrate = true; };
  const rs = seg === 'plant' ? S.rankBy(p, (q) => q.sk ?? 0) : 0;
  mark('intro', rar === 'Legendary' || rar === 'One of One');
  mark('traits', list[0] && list[0].share <= 0.002); // 1 in 500 or rarer
  mark('rank', seg === 'seed' && inf.rank && inf.rank <= Math.max(1, Math.ceil(N.seed * 0.05)));
  mark('streak', seg === 'plant' && sk > 0 && rs <= 10);
  mark('standing', seg === 'reveal' && inf.rank && inf.rank <= Math.max(1, Math.ceil(N.reveal * 0.05)));
  mark('spirit', !!spirit?.tier && spirit.tier !== 'Common');
  // particles: soil dust for seeds, the plant's real Weather, stars in Heaven
  const weather = tr.find(([t]) => t === 'Weather')?.[1];
  cards.fx = seg === 'seed' ? 'dust' : seg === 'reveal' ? 'stars' : ({ 'Soft rain': 'rain', Snowfall: 'snow', Sunbeams: 'sun', 'Leaf breeze': 'leaf', 'Drifting petals': 'petal', Butterflies: 'butterfly' }[weather] || 'leaf');
  // one poster with every key stat
  const tiles = [];
  if (seg === 'seed') { if (kind) tiles.push(['Destined kind', kind]); if (rar) tiles.push(['Destined rarity', rar]); if (inf.rank) tiles.push(['Seed rank', `#${fmtN(inf.rank)} of ${fmtN(N.seed)}`]); }
  else if (seg === 'plant') {
    if (kind) tiles.push(['Kind', kind]); if (rar) tiles.push(['Plant rarity', rar]);
    tiles.push(['Streak', `${plural(sk, 'day')} · rank #${fmtN(rs)}`], ['Days watered', fmtN(wd)]);
    if (p.diesAt) { const left = Math.min(CLOCK, p.diesAt - now); tiles.push(['Water clock', left > 0 ? `${Math.floor(left / 36e5)}h of 72h left` : 'Ran out']); }
  } else {
    if (spirit) tiles.push(['Spirit', spirit.name]); if (spirit?.tier) tiles.push(['Tier', spirit.tier]);
    if (dn != null) tiles.push(['Died', ord(dn) + ' of 2,500']); if (rk != null) tiles.push(['Spirit rank', '#' + fmtN(rk)]);
    if (kind) tiles.push(['Grew from', kr]); tiles.push(['Days watered', fmtN(wd)]);
  }
  if (list[0]) tiles.push(['Rarest trait', `${list[0].v} · 1 in ${fmtN(Math.round(1 / list[0].share))}`]);
  if (best) tiles.push(['Pocket Run best', fmtN(best.score)]); else if (pers) tiles.push(['Personality', pers.title.replace(/^The /, '')]);
  cards.poster = { theme: th, art: { id: p.i, stem: p.c }, title: `Pocket #${p.i}`, sub: introText, tiles: tiles.slice(0, 8), file: `pocket-${p.i}-wrapped-poster`, celebrate: cards.some((c) => c.celebrate) };
  return cards;
}

// ---------------- Wallet cards ----------------
function walletCards(app, addr, X) {
  const S = stats(app), mine = [...app.byId().values()].filter((p) => (p.o || '').toLowerCase() === addr);
  const cards = []; if (!mine.length) return { cards, mine };
  const add = (id, blocks, share) => cards.push({ id, theme: 'wallet', blocks, share, file: `wallet-${addr.slice(2, 8)}-wrapped-${id}` });
  const n = mine.length, by = { seed: [], plant: [], reveal: [] }; for (const p of mine) by[p.seg].push(p);
  const rarIdx = (p) => Math.max(0, RAR.indexOf(p.rarity || 'Common'));
  const pctOf = (p) => { const inf = S.info.get(p.i), M = S.byStage[p.seg].length; return inf ? 1 - (inf.rank - 1) / M : 0; };
  const rarest = [...mine].sort((a, b) => rarIdx(b) - rarIdx(a) || pctOf(b) - pctOf(a) || a.i - b.i);
  const top = rarest[0], ids = rarest.slice(0, 5), label = short(addr), PK = plural(n, 'Pocket');
  add('intro', [{ t: 'eyebrow', text: 'Wallet Wrapped' }, { t: 'title', text: label, size: 'xl' }, { t: 'big', to: n, label: n === 1 ? 'Pocket' : 'Pockets' }, { t: 'strip', ids: ids.map((p) => ({ id: p.i, stem: p.c })) }, { t: 'text', text: 'Tap, swipe or use ← → to see what this wallet holds', dim: true }],
    `${label} holds ${PK}. Wallet Wrapped 🎁`);
  add('split', [{ t: 'eyebrow', text: 'The stage split' }, { t: 'title', text: n === 1 ? 'One Pocket' : `${n} Pockets across three layers`, size: 'l' },
    { t: 'bars', rows: [['Seeds', 'seed', 'in the Soil'], ['Plants', 'plant', 'in the Garden'], ['Spirits', 'reveal', 'in Heaven']].map(([l, k, w]) => ({ label: l, value: String(by[k].length), pct: by[k].length / n, note: w })) },
    ...(by.plant.length ? [{ t: 'text', text: 'Plants die if they go 72 hours without water.', dim: true }] : [])],
    `${label}: ${(() => { const q = [[by.seed.length, 'seed', '🌱'], [by.plant.length, 'plant', '🌿'], [by.reveal.length, 'spirit', '👻']].filter((x) => x[0] > 0); const t = q.map((x) => plural(x[0], x[1])); return (t.length > 1 ? t.slice(0, -1).join(', ') + ' and ' + t[t.length - 1] : t[0] || '0 Pockets') + ' ' + q.map((x) => x[2]).join(''); })()}`);
  const days = mine.reduce((s, p) => s + (p.seg === 'seed' ? 0 : p.wd ?? 0), 0), bestSk = by.plant.reduce((m, p) => Math.max(m, p.sk ?? 0), 0), bestSkP = by.plant.find((p) => (p.sk ?? 0) === bestSk);
  if (by.plant.length || by.reveal.length) add('days', [{ t: 'eyebrow', text: 'Days watered' }, { t: 'big', to: days, label: days === 1 ? 'day watered, added up across its Pockets' : 'days watered, added up across its Pockets' },
    { t: 'facts', rows: [...(by.plant.length ? [['Longest watering streak', `${plural(bestSk, 'day')} (Pocket #${bestSkP.i})`], ['Plants', String(by.plant.length)]] : []), ...(by.reveal.length ? [['Spirits', String(by.reveal.length)]] : [])] },
    { t: 'text', text: by.seed.length ? 'Seeds have not been watered yet, so they add nothing.' : 'Every day a plant or spirit was watered, added up.', dim: true }],
    `${label}'s Pockets have ${plural(days, 'day')} watered in total 💧`);
  const inf = S.info.get(top.i), M = S.byStage[top.seg].length, sw = { seed: 'seeds', plant: 'plants', reveal: 'spirits' }[top.seg];
  const rcl = top.rarity || 'Common';
  add('rarest', [art(top), { t: 'eyebrow', text: n === 1 ? 'The Pocket' : 'The rarest one' }, { t: 'title', text: '#' + top.i, size: 'xl' },
    { t: 'chips', items: [STAGE_OF[top.seg], ...(top.s ? [top.s.name] : []), ...(top.s?.tier ? [top.s.tier + ' tier'] : []), ...(top.rk != null ? ['Rank #' + fmtN(top.rk)] : [])] },
    { t: 'text', text: `${top.seg === 'seed' ? 'Destined to be ' + rcl : top.seg === 'plant' ? rcl + ' plant' : 'Grew from ' + an(rcl) + ' ' + rcl + ' plant'}${inf ? `. #${fmtN(inf.rank)} of ${fmtN(M)} ${top.seg === 'reveal' && M === 1 ? 'spirit' : sw} by trait rarity.` : '.'}`, dim: true },
    { t: 'link', text: 'Open its Wrapped', href: `#/wrapped/${top.i}?from=${addr}` }],
    n === 1 ? `${label}'s Pocket is #${top.i}, ${Cap(an(rcl))} ${rcl}${top.s ? ' · ' + top.s.name : ''} ✨` : `The rarest Pocket in ${label} is #${top.i}${top.s ? ' (' + top.s.name + ')' : ''}, ${rcl} plant rarity ✨`);
  let bt = null; for (const p of mine) for (const x of S.info.get(p.i)?.list || []) if (x.t !== 'Plant rarity' && (!bt || x.share < bt.x.share)) bt = { x, p };
  if (bt) add('trait', [{ t: 'eyebrow', text: 'Its rarest trait' }, { t: 'big', to: Math.round(1 / bt.x.share), prefix: '1 in ', label: `${tname(bt.p, bt.x.t)}: ${bt.x.v}` }, { t: 'text', text: `On Pocket #${bt.p.i}. ${haveTxt(bt.x, S)}`, dim: true }, ...(bt.p.i !== top.i ? [art(bt.p)] : [])],
    `${label}'s rarest trait: ${tname(bt.p, bt.x.t)} ${bt.x.v}, 1 in ${fmtN(Math.round(1 / bt.x.share))} 🔥`);
  if (by.reveal.length) {
    const best = by.reveal.filter((p) => p.rk != null).sort((a, b) => a.rk - b.rk)[0];
    if (best && best.i !== top.i) add('spirits', [art(best), { t: 'eyebrow', text: by.reveal.length === 1 ? 'Its spirit' : 'Its best spirit' }, { t: 'title', text: best.s?.name || '#' + best.i, size: 'xl' }, { t: 'big', to: best.rk, prefix: '#', label: 'spirit rank of 2,500 (1 is the rarest)' },
      { t: 'text', text: `Pocket #${best.i}${by.reveal.length > 1 ? ` · ${by.reveal.length} spirits in this wallet` : ''}`, dim: true }],
      `${label}'s ${by.reveal.length === 1 ? 'spirit' : 'best spirit'} is ${best.s?.name || '#' + best.i}, rank #${fmtN(best.rk)} of 2,500 👻`);
  }
  if (by.plant.length) {
    const now = Date.now(), live = by.plant.filter((p) => p.diesAt).sort((a, b) => a.diesAt - b.diesAt), soon = live.filter((p) => p.diesAt - now < DAY && p.diesAt > now), over = live.filter((p) => p.diesAt <= now), first = live.find((p) => p.diesAt > now);
    const hrs = (p) => Math.max(0, Math.floor((p.diesAt - now) / 36e5));
    add('thirsty', [{ t: 'eyebrow', text: 'The garden right now' },
      soon.length ? { t: 'big', to: soon.length, label: soon.length === 1 ? 'plant has under 24h left on its clock' : 'plants have under 24h left on their clocks' } : first ? { t: 'big', to: hrs(first), suffix: 'h', label: `until the next plant's clock runs out (Pocket #${first.i})` } : { t: 'title', text: 'All clocks ran out', size: 'xl' },
      { t: 'facts', rows: [['Plants', String(by.plant.length)], ...(soon.length && first ? [['Closest to dying', `Pocket #${first.i}, in ${hrs(first)}h`]] : []), ...(over.length ? [['Clock already ran out', plural(over.length, 'plant')]] : [])] },
      { t: 'text', text: 'A plant dies 72 hours after its last watering.', dim: true }],
      soon.length ? `${label} has ${plural(soon.length, 'plant')} with under 24h left on the watering clock 💧` : first ? `${label}'s next plant runs out of time in ${hrs(first)}h 💧` : `${label}'s plants have all run out of time 💧`);
  }
  const share = (k) => by[k].length / n;
  const type = share('seed') >= .5 ? ['Seed Keeper', 'Most of this wallet is still asleep in the soil. Patient. Mysterious.'] : share('plant') >= .5 ? ['Garden Tender', 'Most of this wallet is growing in the garden, one watering at a time.'] : share('reveal') >= .5 ? ['Spirit Collector', 'Most of this wallet has already made it to Heaven.'] : ['The Full Cycle', 'A bit of everything: seeds, plants and spirits. A true almanac.'];
  const lift = (() => { if (n < 8) return null; let b = null; const own = new Map(); for (const p of mine) for (const x of S.info.get(p.i).list) { if (['Plant rarity', 'Kind', 'Palette', 'Colorway'].includes(x.t)) continue; const k = x.t + '|' + x.v; const o = own.get(k) || { x, c: 0 }; o.c++; own.set(k, o); }
    for (const o of own.values()) { const exp = o.x.share * n; if (o.c >= 4 && (!b || o.c / exp > b.l)) b = { ...o, l: o.c / exp }; } return b && b.l >= 1.5 ? b : null; })();
  if (n >= 3) add('type', [{ t: 'eyebrow', text: 'Collector type' }, { t: 'title', text: type[0], size: 'xl' }, { t: 'text', text: type[1], strong: true }, ...(lift ? [{ t: 'facts', rows: [['Signature trait', `${lift.x.t}: ${lift.x.v} (on ${lift.c} of its ${n})`]] }] : []), { t: 'text', text: 'Just for fun, worked out from the stage split.', dim: true }],
    `${label} is ${/^The /.test(type[0]) ? 'the ' + type[0].slice(4) : an(type[0]) + ' ' + type[0]} 😄 (${PK})`);
  add('summary', [{ t: 'eyebrow', text: 'Wallet Wrapped' }, { t: 'title', text: label, size: 'xl' }, { t: 'facts', compact: true, rows: [['Pockets', String(n)], ['Seeds · Plants · Spirits', `${by.seed.length} · ${by.plant.length} · ${by.reveal.length}`], ...(by.plant.length || by.reveal.length ? [['Days watered', fmtN(days)]] : []), ...(n > 1 ? [['Rarest', `#${top.i} (${rcl})`]] : []), ...(bt ? [['Rarest trait', `${bt.x.v} (1 in ${fmtN(Math.round(1 / bt.x.share))})`]] : []), ...(n >= 3 ? [['Type', type[0]]] : [])] },
    { t: 'poster' }, { t: 'text', text: `Ownership as of ${X.ownersAgo}.`, dim: true }], `${label} Wallet Wrapped: ${PK}${days ? ', ' + plural(days, 'day') + ' watered' : ''}${n >= 3 ? ', ' + type[0] : ''} 🎁`);
  const mark = (id, c) => { const k = cards.find((x) => x.id === id); if (k && c) k.celebrate = true; };
  mark('rarest', rcl === 'Legendary' || rcl === 'One of One'); mark('trait', bt && bt.x.share <= 0.002);
  cards.fx = 'motes';
  const bs = by.reveal.filter((p) => p.rk != null).sort((a, b) => a.rk - b.rk)[0];
  const tiles = [['Pockets', fmtN(n)], ['Seeds · Plants · Spirits', `${by.seed.length} · ${by.plant.length} · ${by.reveal.length}`]];
  if (by.plant.length || by.reveal.length) tiles.push(['Days watered', fmtN(days)]);
  if (by.plant.length) tiles.push(['Longest streak', `${plural(bestSk, 'day')} · Pocket #${bestSkP.i}`]);
  tiles.push([n > 1 ? 'Rarest Pocket' : 'Its Pocket', `#${top.i} · ${rcl}`]);
  if (bt) tiles.push(['Rarest trait', `${bt.x.v} · 1 in ${fmtN(Math.round(1 / bt.x.share))}`]);
  if (bs) tiles.push(['Best spirit', `${bs.s?.name || '#' + bs.i} · #${fmtN(bs.rk)}`]);
  if (n >= 3) tiles.push(['Collector type', type[0]]);
  cards.poster = { theme: 'wallet', strip: ids.map((p) => ({ id: p.i, stem: p.c })), title: label, sub: `Wallet Wrapped · ${PK}`, tiles: tiles.slice(0, 8), file: `wallet-${addr.slice(2, 8)}-wrapped-poster`, celebrate: cards.some((c) => c.celebrate) };
  return { cards, mine };
}

// ---------------- canvas drawing (PNG) ----------------
const CW = 1080, CH = 1920, U = 10.8;
const imgCache = new Map();
function loadImg(src) { if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => { imgCache.delete(src); res(null); }; setTimeout(() => { if (!im.complete) { imgCache.delete(src); res(null); } }, 9000); im.src = src; })); return imgCache.get(src); }
const artSrc = (a) => a.stem ? `/api/img?id=${a.id}&kind=sprite&stem=${encodeURIComponent(a.stem)}` : '';
function glyph(c, kind, x, y, r, col) {
  c.save(); c.translate(x, y); c.fillStyle = col;
  if (kind === 'seed') { c.beginPath(); c.ellipse(0, 0, r * .62, r * .85, -.4, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = r * .1; c.beginPath(); c.moveTo(-r * .2, r * .5); c.quadraticCurveTo(r * .1, 0, r * .3, -r * .5); c.stroke(); }
  else if (kind === 'plant') { c.strokeStyle = col; c.lineWidth = r * .16; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, r * .9); c.lineTo(0, -r * .1); c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * .5, -r * .3, r * .55, r * .26, s * -.6, 0, 7); c.fill(); } }
  else { c.beginPath(); c.arc(0, -r * .1, r * .62, Math.PI, 0); c.lineTo(r * .62, r * .8); for (let i = 0; i < 3; i++) { const x1 = r * .62 - (i + .5) * r * .41, x2 = r * .62 - (i + 1) * r * .41; c.quadraticCurveTo(x1, (i % 2 ? r * .55 : r * 1.0), x2, r * .8); } c.closePath(); c.fill(); c.fillStyle = 'rgba(30,20,70,.7)'; c.beginPath(); c.ellipse(-r * .22, -r * .1, r * .09, r * .14, 0, 0, 7); c.ellipse(r * .22, -r * .1, r * .09, r * .14, 0, 0, 7); c.fill(); }
  c.restore();
}
function wrapLines(c, text, w) { const out = []; for (const para of String(text).split('\n')) { let line = ''; for (const word of para.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (c.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } out.push(line); } return out; }
const F = { serif: 'Fraunces, Georgia, serif', sans: 'Inter, system-ui, sans-serif', pix: '"Pixelify Sans", ui-monospace, monospace' };
function bgCanvas(c, th, seed) {
  const T = THEMES[th], g = c.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, T.grad[0]); g.addColorStop(.55, T.grad[1]); g.addColorStop(1, T.grad[2]); c.fillStyle = g; c.fillRect(0, 0, CW, CH);
  let s = seed >>> 0 || 7; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const glow = c.createRadialGradient(CW / 2, 360, 20, CW / 2, 360, 760); glow.addColorStop(0, th === 'plant' ? 'rgba(230,255,160,.28)' : th === 'spirit' ? 'rgba(255,240,200,.3)' : th === 'seed' ? 'rgba(240,170,90,.22)' : 'rgba(255,220,150,.2)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 46; i++) { const x = rnd() * CW, y = rnd() * CH, r = 2 + rnd() * 5; c.fillStyle = th === 'seed' ? `rgba(255,214,160,${.08 + rnd() * .14})` : th === 'plant' ? `rgba(230,255,170,${.1 + rnd() * .25})` : `rgba(255,255,255,${.12 + rnd() * .3})`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
}
async function drawBlocks(c, card, scale, dry) {
  const T = THEMES[card.theme]; let y = 0; const W = CW - 180, X0 = 90;
  const gap = (n) => { y += n; };
  const text = (str, font, color, o = {}) => { c.font = font; const lh = o.lh || 1.3, size = parseFloat(font.match(/(\d+(\.\d+)?)px/)[1]); const lines = wrapLines(c, str, o.w || W); c.fillStyle = color; c.textAlign = o.align || 'center'; c.textBaseline = 'alphabetic'; const x = o.x ?? (o.align === 'left' ? X0 : CW / 2); for (const ln of lines) { y += size; if (!dry) c.fillText(ln, x, y); y += size * (lh - 1); } return lines.length; };
  for (const b of card.blocks) {
    if (b.t === 'art') { const im = b.stem ? await loadImg(artSrc(b)) : null; const bh = b.big ? 520 : 400; if (im) { const k = Math.min(bh / im.height, 760 / im.width), w = im.width * k, h = im.height * k; if (!dry) { c.save(); const gg = c.createRadialGradient(CW / 2, y + h * .6, 10, CW / 2, y + h * .6, h * .8); gg.addColorStop(0, 'rgba(255,255,255,.22)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gg; c.fillRect(0, y - 40, CW, h + 120); c.imageSmoothingEnabled = false; c.drawImage(im, (CW - w) / 2, y, w, h); c.restore(); } y += h + 40; } }
    else if (b.t === 'eyebrow') { text(b.text.toUpperCase(), `500 34px ${F.pix}`, T.acc, { lh: 1.2 }); gap(22); }
    else if (b.t === 'title') { const xl = b.size === 'xl'; text(b.text, `700 ${xl ? 124 : 86}px ${F.serif}`, T.ink, { lh: 1.08 }); gap(24); }
    else if (b.t === 'big') { const val = (b.prefix || '') + fmtN(b.to) + (b.suffix || ''); let fs = 250; c.font = `700 ${fs}px ${F.serif}`; while (c.measureText(val).width > W && fs > 90) { fs -= 10; c.font = `700 ${fs}px ${F.serif}`; } text(val, `700 ${fs}px ${F.serif}`, T.acc, { lh: 1.0 }); gap(14); if (b.label) { text(b.label, `600 46px ${F.sans}`, T.ink, { lh: 1.3 }); } gap(26); }
    else if (b.t === 'text') { text(b.text, `${b.strong ? 600 : 500} ${b.strong ? 50 : 42}px ${F.sans}`, b.dim ? T.dim : T.ink, { lh: 1.35 }); gap(22); }
    else if (b.t === 'quote') { text('“' + b.text + '”', `italic 500 48px ${F.serif}`, T.ink, { lh: 1.35, w: W - 40 }); gap(26); }
    else if (b.t === 'chips') { c.font = `600 38px ${F.sans}`; const ws = b.items.map((s) => c.measureText(s).width + 56); let rows = [[]], rw = 0; b.items.forEach((s, i) => { if (rw + ws[i] > W && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(i); rw += ws[i] + 16; });
      for (const r of rows) { const tw = r.reduce((s, i) => s + ws[i] + 16, -16); let x = (CW - tw) / 2; for (const i of r) { if (!dry) { c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.roundRect(x, y, ws[i], 68, 34); c.fill(); c.fillStyle = T.ink; c.textAlign = 'center'; c.font = `600 38px ${F.sans}`; c.fillText(b.items[i], x + ws[i] / 2, y + 46); } x += ws[i] + 16; } y += 84; } gap(16); }
    else if (b.t === 'bars') { for (const r of b.rows) { c.font = `500 34px ${F.pix}`; if (!dry) { c.textAlign = 'left'; c.fillStyle = T.dim; c.fillText(String(r.label).toUpperCase(), X0, y + 34); c.textAlign = 'right'; c.font = `700 44px ${F.sans}`; c.fillStyle = T.ink; c.fillText(String(r.value), X0 + W, y + 38); } y += 62; if (!dry) { c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.roundRect(X0, y, W, 24, 12); c.fill(); c.fillStyle = T.acc; c.beginPath(); c.roundRect(X0, y, Math.max(24, W * clamp(r.pct, 0, 1)), 24, 12); c.fill(); } y += 24; if (r.note) { y += 8; text(r.note, `500 32px ${F.sans}`, T.dim, { align: 'left', x: X0, lh: 1.2 }); } y += 38; } }
    else if (b.t === 'journey') { for (const n of b.nodes) { const col = n.state === 'todo' ? 'rgba(255,255,255,.35)' : n.state === 'now' ? T.acc : T.ink; if (!dry) { c.fillStyle = n.state === 'now' ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.09)'; c.beginPath(); c.roundRect(X0, y, W, 190, 36); c.fill(); if (n.state === 'now') { c.strokeStyle = T.acc; c.lineWidth = 4; c.stroke(); } glyph(c, n.icon, X0 + 90, y + 95, 52, col); c.textAlign = 'left'; c.fillStyle = col; c.font = `700 56px ${F.serif}`; c.fillText(n.label + (n.state === 'now' ? ' · now' : ''), X0 + 180, y + 78); } c.font = `500 36px ${F.sans}`; const ls = wrapLines(c, n.detail, W - 220); if (!dry) { c.fillStyle = n.state === 'todo' ? 'rgba(255,255,255,.5)' : T.dim; ls.slice(0, 2).forEach((l, i) => c.fillText(l, X0 + 180, y + 126 + i * 42)); } y += 190 + 26; } }
    else if (b.t === 'facts') { for (const [k, v] of b.rows) { const sz = b.compact ? 46 : 44; if (!dry) { c.textAlign = 'center'; } text(String(k).toUpperCase(), `500 30px ${F.pix}`, T.dim, { lh: 1.15 }); gap(4); text(String(v), `600 ${sz}px ${F.sans}`, T.ink, { lh: 1.25 }); gap(b.compact ? 20 : 26); } }
    else if (b.t === 'quotes') { for (const [k, v] of b.rows) { text(k.toUpperCase(), `500 30px ${F.pix}`, T.acc, { lh: 1.15 }); gap(4); text(v, `500 42px ${F.sans}`, T.ink, { lh: 1.3 }); gap(26); } }
    else if (b.t === 'strip') { const ims = await Promise.all(b.ids.map((a) => artSrc(a) ? loadImg(artSrc(a)) : null)); const n = ims.length, cell = Math.min(190, W / Math.max(1, n)), x0 = (CW - cell * n) / 2; if (!dry) { c.imageSmoothingEnabled = false; ims.forEach((im, i) => { if (!im) return; const k = Math.min((cell - 16) / im.width, (cell - 16) / im.height); c.drawImage(im, x0 + i * cell + (cell - im.width * k) / 2, y + (cell - im.height * k), im.width * k, im.height * k); }); } y += cell + 30; }
  }
  return y;
}
async function renderPNG(card, extra) {
  try { await Promise.all([document.fonts.load(`700 40px Fraunces`), document.fonts.load('500 40px Inter'), document.fonts.load('600 40px Inter'), document.fonts.load('500 30px "Pixelify Sans"'), document.fonts.load('italic 500 40px Fraunces')]); } catch {}
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
  bgCanvas(c, card.theme, [...card.file].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7));
  const avail = CH - 2 * 210, total = await drawBlocks(c, card, 1, true), s = Math.min(1, avail / total);
  c.save(); const top = 210 + Math.max(0, (avail - total * s) / 2); c.translate(CW / 2 * (1 - s), top); c.scale(s, s);
  await drawBlocks(c, card, s, false); c.restore();
  c.textAlign = 'center'; c.fillStyle = THEMES[card.theme].acc; c.font = `500 34px ${F.pix}`; c.fillText('POCKET WRAPPED' + (extra ? ' · ' + extra : ''), CW / 2, 120);
  c.fillStyle = THEMES[card.theme].dim; c.font = `500 34px ${F.sans}`; c.fillText('pocket-viewer.vercel.app', CW / 2, CH - 100);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}
// drawBlocks draws relative to y=0 with the translate above; text() above is shared by the dry and real pass.

// ---------------- poster: every key stat on one 1080x1350 image ----------------
const PW = 1080, PH = 1350;
async function renderPoster(spec, extra) {
  try { await Promise.all([document.fonts.load('700 40px Fraunces'), document.fonts.load('600 40px Fraunces'), document.fonts.load('500 40px Inter'), document.fonts.load('500 30px "Pixelify Sans"')]); } catch {}
  const T = THEMES[spec.theme], cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, T.grad[0]); g.addColorStop(.55, T.grad[1]); g.addColorStop(1, T.grad[2]); c.fillStyle = g; c.fillRect(0, 0, PW, PH);
  const glow = c.createRadialGradient(PW / 2, 330, 20, PW / 2, 330, 620); glow.addColorStop(0, 'rgba(255,240,200,.25)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(0, 0, PW, PH);
  let s = [...spec.file].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${.06 + rnd() * .2})`; c.beginPath(); c.arc(rnd() * PW, rnd() * PH, 2 + rnd() * 4, 0, 7); c.fill(); }
  if (spec.celebrate) { const cols = ['#ffd84d', '#ff7aa8', '#7fd3ff', '#c8f169', '#b48cff']; for (let i = 0; i < 60; i++) { const x = rnd() < .5 ? rnd() * 230 : PW - rnd() * 230, y = 30 + rnd() * 520; c.save(); c.translate(x, y); c.rotate(rnd() * 6.3); c.fillStyle = cols[i % 5]; c.globalAlpha = .75; c.fillRect(-7, -3.5, 14, 7); c.restore(); } }
  c.textAlign = 'center'; c.fillStyle = T.acc; c.font = `500 30px ${F.pix}`; c.fillText('POCKET WRAPPED' + (extra ? ' · ' + extra : ''), PW / 2, 78);
  c.imageSmoothingEnabled = false;
  if (spec.art) { const im = spec.art.stem ? await loadImg(artSrc(spec.art)) : null; if (im) { const k = Math.min(380 / im.height, 560 / im.width), w = im.width * k, h = im.height * k; c.drawImage(im, (PW - w) / 2, 110 + (380 - h) / 2, w, h); } }
  else if (spec.strip) { const ims = await Promise.all(spec.strip.map((a) => artSrc(a) ? loadImg(artSrc(a)) : null)); const n = ims.length, cell = Math.min(260, 900 / Math.max(1, n)), x0 = (PW - cell * n) / 2; ims.forEach((im, i) => { if (!im) return; const k = Math.min((cell - 14) / im.width, (cell - 14) / im.height), w = im.width * k, h = im.height * k; c.drawImage(im, x0 + i * cell + (cell - w) / 2, 110 + (380 - h) / 2, w, h); }); }
  c.imageSmoothingEnabled = true;
  const fitFont = (txt, weight, size, min, fam, maxW) => { let fs = size; c.font = `${weight} ${fs}px ${fam}`; while (c.measureText(txt).width > maxW && fs > min) { fs -= 2; c.font = `${weight} ${fs}px ${fam}`; } if (c.measureText(txt).width > maxW) { let t = txt; while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; } return txt; };
  c.fillStyle = T.ink; c.fillText(fitFont(spec.title, 700, 80, 44, F.serif, 940), PW / 2, 572);
  c.font = `500 32px ${F.sans}`; c.fillStyle = T.dim; const sub = wrapLines(c, spec.sub, 920).slice(0, 2); sub.forEach((ln, i) => c.fillText(ln, PW / 2, 624 + i * 42));
  const tiles = spec.tiles, rows = Math.ceil(tiles.length / 2), th = 112, gp = 16, tw = (PW - 140 - gp) / 2, top = 624 + sub.length * 42 + 14 + Math.max(0, (4 - rows) * (th + gp) / 2);
  tiles.forEach(([k, v], i) => { const x = 70 + (i % 2) * (tw + gp), y = top + Math.floor(i / 2) * (th + gp), full = tiles.length % 2 && i === tiles.length - 1, w = full ? PW - 140 : tw;
    c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.roundRect(x, y, w, th, 24); c.fill();
    c.textAlign = 'left'; c.fillStyle = T.acc; c.font = `500 22px ${F.pix}`; c.fillText(fitFont(String(k).toUpperCase(), 500, 22, 16, F.pix, w - 48), x + 24, y + 38);
    c.fillStyle = T.ink; c.fillText(fitFont(String(v), 600, 38, 22, F.serif, w - 48), x + 24, y + 88); });
  c.textAlign = 'center'; c.fillStyle = T.dim; c.font = `500 26px ${F.sans}`; c.fillText('pocket-viewer.vercel.app', PW / 2, PH - 34);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

// ---------------- particles: stage-themed, plants follow their real Weather; confetti for rare facts ----------------
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FX = { cv: null, c: null, type: '', ps: [], conf: [], w: 0, h: 0, t: 0,
  attach(cv, type) { this.cv = cv; this.c = cv.getContext('2d'); this.type = type; this.ps = []; this.conf = []; this.t = 0; this.size(); const n = { rain: 70, snow: 60, sun: 26, leaf: 16, petal: 24, butterfly: 7, dust: 34, stars: 40, motes: 34 }[type] || 30; for (let i = 0; i < n; i++) this.ps.push(this.spawn(true)); },
  size() { const cv = this.cv; if (!cv || !cv.isConnected) return; const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); this.w = r.width; this.h = r.height; cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); this.c.setTransform(d, 0, 0, d, 0, 0); },
  spawn(any) { const R = Math.random, t = this.type, w = this.w, h = this.h, up = t === 'dust' || t === 'stars' || t === 'motes' || t === 'sun';
    const p = { x: R() * w, y: any ? R() * h : up ? h + 12 : -16, r: R(), a: R() * 6.3, s: .55 + R() * .9 };
    if (!any && t === 'leaf') { p.x = -16; p.y = R() * h; } return p; },
  stop() { this.cv = null; this.c = null; this.ps = []; this.conf = []; },
  burst() { if (!this.cv || RM()) return; const R = Math.random, cols = ['#ffd84d', '#ff7aa8', '#7fd3ff', '#c8f169', '#b48cff', '#ffffff'];
    for (let i = 0; i < 130; i++) this.conf.push({ x: this.w * (.3 + R() * .4), y: this.h * .32, vx: (R() - .5) * this.w * 1.7, vy: -(.35 + R() * .75) * this.h, rot: R() * 6, vr: (R() - .5) * 14, col: cols[i % cols.length], life: 2.4 + R() * .8, sz: 5 + R() * 5 }); },
  step(dt) {
    const c = this.c; if (!c || !this.cv.isConnected) return; const { w, h } = this; if (!w || !h) { this.size(); return; } this.t += dt; c.clearRect(0, 0, w, h); const t = this.t, ty = this.type;
    if (ty === 'sun') { c.save(); c.translate(w * .1, -h * .05); c.rotate(.5); for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(255,236,170,${.05 + .035 * Math.sin(t * .7 + i * 2)})`; c.fillRect(i * w * .22, -h * .2, w * .09, h * 1.6); } c.restore(); }
    for (let k = 0; k < this.ps.length; k++) { const p = this.ps[k];
      if (ty === 'rain') { p.y += h * 1.05 * p.s * dt; p.x -= h * .07 * dt; c.strokeStyle = 'rgba(200,230,255,.42)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2, p.y + 12 * p.s); c.stroke(); }
      else if (ty === 'snow') { p.y += h * .055 * p.s * dt; p.x += Math.sin(t * 1.2 + p.a) * 14 * dt; c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(p.x, p.y, 1.4 + p.r * 2.6, 0, 7); c.fill(); }
      else if (ty === 'leaf' || ty === 'petal') { const lf = ty === 'leaf'; if (lf) { p.x += h * .1 * p.s * dt; p.y += (h * .025 + Math.sin(t * 2 + p.a) * h * .04) * dt; } else { p.y += h * .06 * p.s * dt; p.x += Math.sin(t * 1.4 + p.a) * h * .03 * dt; } p.a += dt * (1 + p.r) * 2;
        c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(1, Math.abs(Math.cos(p.a * .7)) * .8 + .2); c.fillStyle = lf ? ['#8fd45a', '#5fae48', '#c9e86a'][Math.floor(p.r * 3)] : ['#ffb6d2', '#ff9cc6', '#ffd6e6'][Math.floor(p.r * 3)]; c.globalAlpha = .85; c.beginPath(); c.ellipse(0, 0, lf ? 8 : 6, lf ? 3.6 : 4, 0, 0, 7); c.fill(); c.restore(); }
      else if (ty === 'butterfly') { p.a += (Math.random() - .5) * dt * 4; p.x += Math.cos(p.a) * h * .07 * dt; p.y += Math.sin(p.a) * h * .045 * dt - Math.sin(t * 3 + p.r * 9) * 6 * dt; if (p.x < -20) p.x = w + 18; if (p.x > w + 20) p.x = -18; if (p.y < 10) p.a = Math.abs(p.a); if (p.y > h * .9) p.a = -Math.abs(p.a);
        const fl = .25 + .75 * Math.abs(Math.sin(t * 11 + p.r * 20)), col = ['#ffd84d', '#ff9cc6', '#9fd3ff', '#ffffff'][Math.floor(p.r * 4)]; c.save(); c.translate(p.x, p.y); c.fillStyle = col; c.globalAlpha = .9; c.beginPath(); c.ellipse(-5 * fl, 0, 6 * fl, 4.5, -.4, 0, 7); c.ellipse(5 * fl, 0, 6 * fl, 4.5, .4, 0, 7); c.fill(); c.fillStyle = '#2a1a10'; c.fillRect(-1, -4, 2, 8); c.restore(); }
      else if (ty === 'stars') { p.y -= h * .012 * p.s * dt; const al = .25 + .75 * Math.abs(Math.sin(t * 1.3 + p.a)), r = 2 + p.r * 3.5; c.fillStyle = `rgba(255,246,214,${al})`; c.beginPath(); c.moveTo(p.x, p.y - r * 2); c.quadraticCurveTo(p.x, p.y, p.x + r * 2, p.y); c.quadraticCurveTo(p.x, p.y, p.x, p.y + r * 2); c.quadraticCurveTo(p.x, p.y, p.x - r * 2, p.y); c.quadraticCurveTo(p.x, p.y, p.x, p.y - r * 2); c.fill(); }
      else { p.y -= h * (ty === 'sun' ? .02 : .025) * p.s * dt; p.x += Math.sin(t + p.a) * 8 * dt; const al = ty === 'dust' ? .14 + .2 * p.r : .25 + .45 * Math.abs(Math.sin(t * 1.6 + p.a)); c.fillStyle = ty === 'dust' ? `rgba(255,205,140,${al})` : `rgba(255,232,160,${al})`; c.beginPath(); c.arc(p.x, p.y, 1.2 + p.r * (ty === 'dust' ? 2.4 : 2), 0, 7); c.fill(); }
      if (ty !== 'butterfly' && (p.y > h + 20 || p.y < -24 || p.x > w + 24 || p.x < -30)) this.ps[k] = this.spawn(false);
    }
    if (this.conf.length) { const gr = h * 1.5; this.conf = this.conf.filter((q) => (q.life -= dt) > 0); for (const q of this.conf) { q.vy += gr * dt; q.vx *= 1 - dt * .9; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.globalAlpha = Math.min(1, q.life); c.fillStyle = q.col; c.fillRect(-q.sz / 2, -q.sz / 4, q.sz, q.sz / 2); c.restore(); } }
  } };

// ---------------- sound: quiet generative ambience per stage (WebAudio, no files). Off until you tap the speaker. ----------------
const AMB = { ctx: null, out: null, on: false, next: 0, step: 0, theme: '', pad: null,
  SC: { seed: [130.8, 146.8, 164.8, 196, 220], plant: [523.3, 587.3, 659.3, 784, 880], spirit: [659.3, 784, 987.8, 1174.7, 1318.5], wallet: [392, 440, 523.3, 587.3, 659.3] },
  ROOT: { seed: 65.4, plant: 98, spirit: 130.8, wallet: 87.3 },
  want() { try { return localStorage.getItem('wrapped:sound') === '1'; } catch { return false; } },
  set(on) { this.on = on; try { localStorage.setItem('wrapped:sound', on ? '1' : '0'); } catch {} if (on) this.wake(); else this.sleep(); },
  wake() { if (!this.on) return; if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { this.ctx = new AC(); } catch { return; } this.out = this.ctx.createGain(); this.out.gain.value = .55; this.out.connect(this.ctx.destination); }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); this.padOn(); },
  sleep() { this.padOff(); this.next = 0; if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
  setTheme(th) { if (th === this.theme) return; this.theme = th; if (this.pad) { this.padOff(); this.padOn(); } },
  padOn() { const c = this.ctx; if (!c || this.pad || !this.theme) return; const t = c.currentTime, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + 2.5);
    const r = this.ROOT[this.theme] || 98, os = [r, r * 1.5, r * 2.005].map((fr, i) => { const o = c.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine'; o.frequency.value = fr; o.connect(f); o.start(t); return o; }); f.connect(g); g.connect(this.out); this.pad = { g, os }; },
  padOff() { const p = this.pad; if (!p || !this.ctx) return; this.pad = null; const t = this.ctx.currentTime; try { p.g.gain.cancelScheduledValues(t); p.g.gain.setTargetAtTime(.0001, t, .25); p.os.forEach((o) => o.stop(t + 1.2)); } catch {} },
  tone(f, d, type, v, at) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(v, at + .02); g.gain.exponentialRampToValueAtTime(.0001, at + d); o.connect(g); g.connect(this.out); o.start(at); o.stop(at + d + .05); },
  tick() { const c = this.ctx; if (!this.on || !c || c.state !== 'running' || !this.theme) { this.next = 0; return; }
    if (!this.next || this.next < c.currentTime) this.next = c.currentTime + .1; const th = this.theme, sc = this.SC[th] || this.SC.plant;
    while (this.next < c.currentTime + .35) { const i = this.step++, f = sc[(i * 3 + (i >> 2)) % sc.length], at = this.next;
      if (th === 'seed') { if (i % 2 === 0) this.tone(f, 1.1, 'sine', .07, at); this.next += .8; }
      else if (th === 'plant') { if (i % 4 !== 3) this.tone(f, .35, 'triangle', .045, at); this.next += .42; }
      else if (th === 'spirit') { this.tone(f, 2.2, 'sine', .04, at); if (i % 3 === 0) this.tone(f * 2, 1.4, 'sine', .015, at + .02); this.next += .9; }
      else { if (i % 3 !== 2) this.tone(f, .6, 'triangle', .04, at); this.next += .55; } } },
  chime() { const c = this.ctx; if (!this.on || !c || c.state !== 'running') return; const t = c.currentTime + .05; [784, 987.8, 1174.7, 1568].forEach((f, i) => this.tone(f, .6, 'triangle', .07, t + i * .09)); },
};

// ---------------- DOM ----------------
const root = () => $('#wrapped');
const W = { open: false, cards: [], i: 0, t0: 0, elapsed: 0, paused: false, hold: false, raf: 0, key: '', app: null, nav: null, pid: null, close: null, extra: '' };
function blockHTML(b, ix) {
  const d = `style="--i:${ix}"`;
  switch (b.t) {
    case 'art': return `<div class="wr-b wr-art${b.big ? ' big' : ''}" ${d}>${b.stem ? `<img alt="" src="${esc(artSrc(b))}">` : ''}</div>`;
    case 'eyebrow': return `<p class="wr-b wr-eye" ${d}>${esc(b.text)}</p>`;
    case 'title': return `<h2 class="wr-b wr-title ${b.size || ''}" ${d}>${esc(b.text)}</h2>`;
    case 'big': return `<div class="wr-b wr-big" ${d}><b data-to="${b.to}" data-pre="${esc(b.prefix || '')}" data-suf="${esc(b.suffix || '')}">${esc((b.prefix || '') + fmtN(b.to) + (b.suffix || ''))}</b>${b.label ? `<span>${esc(b.label)}</span>` : ''}</div>`;
    case 'text': return `<p class="wr-b wr-text${b.dim ? ' dim' : ''}${b.strong ? ' strong' : ''}" ${d}>${esc(b.text)}</p>`;
    case 'quote': return `<blockquote class="wr-b wr-quote" ${d}>${esc(b.text)}</blockquote>`;
    case 'chips': return `<div class="wr-b wr-chips" ${d}>${b.items.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`;
    case 'bars': return `<div class="wr-b wr-bars-b" ${d}>${b.rows.map((r) => `<div class="wr-row"><div class="wr-rh"><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div><i class="wr-track"><u style="--w:${clamp(r.pct, 0, 1)}"></u></i>${r.note ? `<small>${esc(r.note)}</small>` : ''}</div>`).join('')}</div>`;
    case 'journey': return `<div class="wr-b wr-journey" ${d}>${b.nodes.map((n) => `<div class="wr-node ${n.state}"><canvas width="96" height="96" data-g="${n.icon}"></canvas><div><b>${esc(n.label)}${n.state === 'now' ? ' · now' : ''}</b><span>${esc(n.detail)}</span></div></div>`).join('')}</div>`;
    case 'facts': return `<dl class="wr-b wr-facts${b.compact ? ' compact' : ''}" ${d}>${b.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    case 'quotes': return `<div class="wr-b wr-quotes" ${d}>${b.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</div>`;
    case 'strip': return `<div class="wr-b wr-strip" ${d}>${b.ids.map((a) => `<img alt="" src="${esc(artSrc(a))}">`).join('')}</div>`;
    case 'link': return `<a class="wr-b wr-link" data-ctl href="${esc(b.href)}" ${d}>${esc(b.text)}</a>`;
    case 'poster': return W.poster ? `<button type="button" class="wr-b wr-btn wr-poster" data-ctl ${d}>Download poster · every stat</button>` : '';
    default: return '';
  }
}
// The tweet links to /w/… (a tiny function that adds a preview image, then opens this exact card).
function shareURL(card) { return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(card.share) + '&url=' + encodeURIComponent(SITE + W.sharePath + (W.i ? '/' + (W.i + 1) : '')); }
function paintGlyphs(el) { el.querySelectorAll('canvas[data-g]').forEach((cv) => { const c = cv.getContext('2d'), st = cv.closest('.wr-node'), col = getComputedStyle(cv).color; c.clearRect(0, 0, 96, 96); glyph(c, cv.dataset.g, 48, 48, 30, col); }); }
function tickCounters(el) {
  el.querySelectorAll('.wr-big b[data-to]').forEach((b) => {
    const to = Number(b.dataset.to), pre = b.dataset.pre, suf = b.dataset.suf; if (matchMedia('(prefers-reduced-motion: reduce)').matches || to === 0) return; b.textContent = pre + '0' + suf;
    const t0 = performance.now(), my = (b._tk = (b._tk || 0) + 1); const step = (t) => { if (b._tk !== my) return; const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3); b.textContent = pre + fmtN(to * e) + suf; if (k < 1) requestAnimationFrame(step); else b.textContent = pre + fmtN(to) + suf; }; requestAnimationFrame(step);
  });
}
function show(i, dir) {
  const n = W.cards.length; i = clamp(i, 0, n - 1); const card = W.cards[i]; if (!card) return;
  W.i = i; W.elapsed = 0; W.t0 = performance.now();
  const st = $('.wr-stage', root()), body = $('.wr-card', st); st.dataset.theme = card.theme; st.dataset.id = card.id;
  body.className = 'wr-card ' + (dir < 0 ? 'back' : 'fwd'); body.innerHTML = `<div class="wr-inner">${card.blocks.map(blockHTML).join('')}</div>`;
  void body.offsetWidth; body.classList.add('in'); paintGlyphs(body); tickCounters(body);
  const bars = $('.wr-prog', st); [...bars.children].forEach((b, k) => { b.firstElementChild.style.transform = `scaleX(${k < i ? 1 : 0})`; b.classList.toggle('done', k < i); });
  $('.wr-share', st).href = shareURL(card);
  $('.wr-prev', root()).disabled = i === 0; $('.wr-next', root()).disabled = i === n - 1;
  st.classList.toggle('last', i === n - 1); st.setAttribute('aria-label', `Card ${i + 1} of ${n}`);
  const h = W.pageHash + (i ? '/' + (i + 1) : '') + (W.from ? '?from=' + W.from : ''); if (location.hash !== h) try { history.replaceState(history.state, '', h); } catch {}
  if (card.celebrate && !W.seen.has(i)) { W.seen.add(i); FX.burst(); AMB.chime(); }
  fit(body); const me = i; document.fonts?.ready?.then(() => { if (W.open && W.i === me) fit(); });
}
// Long names, lore or small screens: shrink the whole card (everything is sized in --u) until it fits between the top bar and the buttons.
function fit(body) {
  body = body || $('.wr-card', root()); const inner = $('.wr-inner', body); if (!inner) return; body.style.setProperty('--k', '1');
  const cs = getComputedStyle(body), avail = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  for (let i = 0; i < 4 && inner.offsetHeight > avail + 1; i++) { const k = Math.max(.5, (parseFloat(body.style.getPropertyValue('--k')) || 1) * (avail / inner.offsetHeight) * .97); body.style.setProperty('--k', k.toFixed(3)); }
}
const next = () => { if (W.i < W.cards.length - 1) show(W.i + 1, 1); }, prev = () => { if (W.i > 0) show(W.i - 1, -1); };
function loop(t) {
  if (!W.open) return; W.raf = requestAnimationFrame(loop);
  const st = $('.wr-stage', root()); if (!st || !W.cards.length) return;
  const last = W.i === W.cards.length - 1, stopped = W.paused || W.hold || document.hidden || last;
  if (!stopped) W.elapsed += Math.min(100, t - (W.tl || t)); W.tl = t;
  const k = last ? 1 : clamp(W.elapsed / CARD_MS, 0, 1), cur = $('.wr-prog', st).children[W.i]; if (cur) cur.firstElementChild.style.transform = `scaleX(${k})`;
  const dt = Math.min(.05, (t - (W.ft || t)) / 1000); W.ft = t; if (!document.hidden) { try { FX.step(dt); } catch { FX.stop(); } try { AMB.tick(); } catch { AMB.on = false; AMB.sleep(); sndBtn(); } }
  if (!last && W.elapsed >= CARD_MS) next();
}
function keydown(e) {
  if (!W.open) return; const tag = (e.target.tagName || '').toLowerCase();
  if (e.key === 'Escape') { e.preventDefault(); closeNow(); return; }
  if (tag === 'input' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
  else if (e.key === ' ' && tag !== 'button' && tag !== 'a') { e.preventDefault(); setPaused(!W.paused); }
  else if (e.key === 'Home') { e.preventDefault(); show(0, -1); } else if (e.key === 'End') { e.preventDefault(); show(W.cards.length - 1, 1); }
}
function setPaused(p) { W.paused = p; const b = $('.wr-pause', root()); if (b) { b.setAttribute('aria-pressed', String(p)); b.setAttribute('aria-label', p ? 'Play' : 'Pause'); b.classList.toggle('paused', p); } }
function closeNow() { if (W.close) W.close(); }
let docWired = false;
function wire() {
  if (!docWired) { docWired = true; const r0 = root();
    r0.addEventListener('click', (e) => { if (e.target === r0 || e.target.classList.contains('wr-shell')) closeNow(); else { const pb = e.target.closest('.wr-poster'); if (pb) downloadPoster(pb); } });
    document.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', () => { W.tl = 0; W.ft = 0; if (!W.open) return; if (document.hidden) AMB.sleep(); else if (AMB.on && W.cards.length) AMB.wake(); }); window.addEventListener('resize', () => { if (W.open) { FX.size(); fit(); } }); }
  const r = root();
  $('.wr-prev', r).addEventListener('click', prev); $('.wr-next', r).addEventListener('click', next);
  $('.wr-close', r).addEventListener('click', closeNow); $('.wr-pause', r).addEventListener('click', () => setPaused(!W.paused));
  $('.wr-dl', r).addEventListener('click', download); $('.wr-snd', r).addEventListener('click', () => { AMB.set(!AMB.on); sndBtn(); });

  // tap zones, swipe, hold-to-pause
  const st = $('.wr-stage', r); let d = null;
  for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown']) st.addEventListener(ev, () => { if (AMB.on && W.cards.length && AMB.ctx?.state !== 'running' && !document.hidden) AMB.wake(); }, true);
  st.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-ctl],button,a,input,form')) return; d = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; W.hold = true; try { st.setPointerCapture(e.pointerId); } catch {} });
  const end = (e, cancel) => { if (!d) return; const q = d; d = null; W.hold = false; if (cancel) return; const dx = e.clientX - q.x, dy = e.clientY - q.y, dt = performance.now() - q.t;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx < 0 ? next() : prev(); return; }
    if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) { closeNow(); return; }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 450) { const b = st.getBoundingClientRect(); (e.clientX - b.left) < b.width * .34 ? prev() : next(); } };
  st.addEventListener('pointerup', (e) => end(e)); st.addEventListener('pointercancel', (e) => end(e, true)); st.addEventListener('lostpointercapture', (e) => end(e, true));
  st.addEventListener('contextmenu', (e) => { if (d) e.preventDefault(); });
}
// Saving an image: phones get the share sheet (Save Image / Photos), desktops a normal download.
// If neither works (older iOS, in-app browsers that ignore downloads) show the image so it can be long-pressed and saved.
async function saveBlob(blob, name) {
  const file = new File([blob], name, { type: 'image/png' }), coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; } }
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios || /; wv\)|FBAN|FBAV|Instagram|Twitter/i.test(navigator.userAgent)) { previewImage(blob); return 'preview'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); return 'saved';
}
function previewImage(blob) {
  const r = root(); if (!r) return; const old = $('.wr-pv', r); if (old) old.remove(); const url = URL.createObjectURL(blob);
  const d = document.createElement('div'); d.className = 'wr-pv'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Your image');
  d.innerHTML = `<img alt="Your Pocket Wrapped image" src="${url}"><p>Press and hold the image, then choose Save Image.</p><button type="button" class="wr-btn" data-ctl>Done</button>`;
  d.addEventListener('click', (e) => { if (e.target.closest('button') || e.target === d) { d.remove(); URL.revokeObjectURL(url); } }); d.addEventListener('pointerdown', (e) => e.stopPropagation());
  $('.wr-stage', r).appendChild(d); d.querySelector('button').focus({ preventScroll: true });
}
const doneTxt = { shared: 'Shared ✓', saved: 'Saved ✓', preview: 'Hold the image to save', cancelled: null };
function sndBtn() { const b = $('.wr-snd', root()); if (!b) return; b.setAttribute('aria-pressed', String(AMB.on)); b.setAttribute('aria-label', AMB.on ? 'Turn sound off' : 'Turn sound on'); b.classList.toggle('on', AMB.on); }
async function downloadPoster(btn) {
  if (!W.poster || btn.disabled) return; const lab = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering poster…';
  try { const blob = await renderPoster(W.poster, W.extra); if (!blob) throw new Error('no blob'); const r = await saveBlob(blob, W.poster.file + '.png'); btn.textContent = doneTxt[r] ?? lab; }
  catch { btn.textContent = 'Could not render'; }
  setTimeout(() => { if (btn.isConnected) { btn.textContent = lab; btn.disabled = false; } }, 1600);
}
async function download() {
  const btn = $('.wr-dl', root()), card = W.cards[W.i]; if (!card || btn.disabled) return; const lab = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
  try { const blob = await renderPNG(card, W.extra); if (!blob) throw new Error('no blob'); const r = await saveBlob(blob, card.file + '.png'); btn.textContent = doneTxt[r] ?? lab; }
  catch (e) { btn.textContent = 'Could not render'; }
  setTimeout(() => { btn.textContent = lab; btn.disabled = false; }, 1600);
}

// ---------------- screens ----------------
function shell(theme) {
  return `<div class="wr-shell"><button class="wr-nav wr-prev" aria-label="Previous card" disabled><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="wr-stage" data-theme="${theme}" tabindex="-1"><div class="wr-bg" aria-hidden="true"><i></i><i></i><i></i></div><canvas class="wr-fx" aria-hidden="true"></canvas>
      <div class="wr-prog" aria-hidden="true"></div>
      <div class="wr-top"><span class="wr-brand">Pocket Wrapped</span><span class="wr-sp"></span><button class="wr-ic wr-snd" data-ctl aria-label="Turn sound on" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="on" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.7 7.7 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="off" d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><button class="wr-ic wr-pause" data-ctl aria-label="Pause" aria-pressed="false"><svg viewBox="0 0 24 24"><path class="pp" d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path class="pl" d="M8 5l11 7-11 7z" fill="currentColor"/></svg></button><button class="wr-ic wr-close" data-ctl aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>
      <div class="wr-card" aria-live="polite"></div>
      <div class="wr-actions"><button class="wr-btn wr-dl" data-ctl>Download card</button><a class="wr-btn ghost wr-share" data-ctl target="_blank" rel="noopener" href="#">Share on X</a></div></div>
    <button class="wr-nav wr-next" aria-label="Next card"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
}
function simple(theme, html, close) { // a non-story screen inside the same stage (form, loading, not found)
  const r = root(); cancelAnimationFrame(W.raf); W.raf = 0; r.innerHTML = shell(theme); W.cards = []; W.close = close; wire();
  const st = $('.wr-stage', r); st.classList.add('plain'); $('.wr-prog', st).innerHTML = ''; $('.wr-card', st).className = 'wr-card in'; $('.wr-card', st).innerHTML = `<div class="wr-inner">${html}</div>`; $('.wr-actions', st).hidden = true; $('.wr-pause', st).hidden = true; $('.wr-snd', st).hidden = true; FX.stop(); AMB.sleep(); W.poster = null;
  $('.wr-prev', r).hidden = true; $('.wr-next', r).hidden = true;
}
function formHTML(msg) {
  return `<p class="wr-b wr-eye" style="--i:0">Pocket Wrapped</p><h2 class="wr-b wr-title l" style="--i:1">Whose story?</h2><p class="wr-b wr-text dim" style="--i:2">Type a Pocket number (1 to 2,500) to wrap one Pocket, or paste a wallet address to wrap everything it holds. Ownership comes from the same on-chain data as the rest of the site.</p>
  <form class="wr-b wr-form" id="wrForm" data-ctl style="--i:3"><input id="wrAddr" name="addr" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" placeholder="577 or 0x…" aria-label="Pocket number or wallet address"><button class="wr-btn" type="submit">Show Wrapped</button><a class="wr-link" data-ctl href="#/wrapped/random">Surprise me</a></form><p class="wr-b wr-err" id="wrErr" style="--i:4">${esc(msg || '')}</p>`;
}
async function withTimeout(p, ms) { return Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]); }
async function lbFor(id) {
  const out = []; await Promise.all(['seed', 'plant', 'spirit'].map(async (st) => { try { const r = await fetch('/api/scores?stage=' + st); if (!r.ok) return; const j = await r.json(); for (const e of j.entries || []) if (e.id === id) out.push(e); } catch {} }));
  return out.sort((a, b) => b.score - a.score);
}
function bestFor(id) { try { const b = JSON.parse(localStorage.getItem('pocketrun:best') || '{}')[id]; return b && Number.isFinite(b.score) ? b : null; } catch { return null; } }
const agoTxt = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 90 ? 'just now' : s < 3600 ? plural(Math.floor(s / 60), 'minute') + ' ago' : s < 86400 ? plural(Math.floor(s / 3600), 'hour') + ' ago' : plural(Math.floor(s / 86400), 'day') + ' ago'; };
let seq = 0;
function start(cards, key, theme, hash, extra, close, o = {}) {
  const r = root(); W.poster = cards.poster || null; r.innerHTML = shell(theme); wire(); W.cards = cards; W.close = close; W.pageHash = hash; W.sharePath = o.share || ''; W.from = o.from || ''; W.extra = extra; W.key = key; W.paused = RM(); W.hold = false; W.tl = 0; W.ft = 0; W.seen = new Set();
  const st = $('.wr-stage', r); $('.wr-prog', st).innerHTML = cards.map(() => '<i><b></b></i>').join(''); setPaused(W.paused);
  if (!RM()) FX.attach($('.wr-fx', st), cards.fx || { seed: 'dust', plant: 'leaf', spirit: 'stars', wallet: 'motes' }[theme]); else FX.stop();
  AMB.on = AMB.want(); AMB.setTheme(theme); if (AMB.on) AMB.wake(); sndBtn();
  const at = clamp((o.card || 1) - 1, 0, cards.length - 1); show(at, 1); cancelAnimationFrame(W.raf); W.raf = requestAnimationFrame(loop);
  st.focus({ preventScroll: true });
}
export async function openWrapped(app, params, hooks) {
  const my = ++seq;
  try { await openInner(app, params, hooks, my); }
  catch (e) { if (my !== seq || !W.open) return; try { simple('seed', `<p class="wr-b wr-eye" style="--i:0">Pocket Wrapped</p><h2 class="wr-b wr-title l" style="--i:1">Something went wrong</h2><p class="wr-b wr-text dim" style="--i:2">That one would not load. Try again in a moment.</p><a class="wr-b wr-link" data-ctl style="--i:3" href="#/wrapped">Try another</a>`, hooks.close); } catch {} }
}
async function openInner(app, params, hooks, my) {
  W.open = true; W.app = app; const r = root();
  const key = JSON.stringify(params);
  if (params.mode === 'form') { simple('wallet', formHTML(params.msg), hooks.close); wireForm(app, hooks); return; }
  simple(params.mode === 'wallet' ? 'wallet' : 'plant', '<p class="wr-b wr-eye" style="--i:0">Pocket Wrapped</p><p class="wr-b wr-text dim" style="--i:1">Wrapping it up…</p>', hooks.close);
  if (params.mode === 'wallet') {
    const addr = params.addr.toLowerCase(); await withTimeout(Promise.resolve(app.ready?.()).catch(() => {}), 3500);
    if (my !== seq) return;
    const { cards, mine } = walletCards(app, addr, { ownersAgo: agoTxt(app.stateAt()) });
    if (!mine.length) { simple('wallet', `<p class="wr-b wr-eye" style="--i:0">Wallet Wrapped</p><h2 class="wr-b wr-title l" style="--i:1">${esc(short(addr))}</h2><p class="wr-b wr-text dim" style="--i:2">This wallet does not hold any Pockets right now. Check the address, or try another one.</p><a class="wr-b wr-link" data-ctl style="--i:3" href="#/wrapped">Try another</a>`, hooks.close); wireForm(app, hooks); return; }
    start(cards, key, 'wallet', '#/wrapped/wallet/' + addr, short(addr), hooks.close, { card: params.card, share: 'w/wallet/' + addr }); return;
  }
  const id = params.id; const p = app.byId().get(id);
  if (!p) { simple('seed', `<p class="wr-b wr-eye" style="--i:0">Pocket Wrapped</p><h2 class="wr-b wr-title l" style="--i:1">${Number.isInteger(id) ? `No Pocket #${esc(String(id))}` : 'That is not a Pocket number'}</h2><p class="wr-b wr-text dim" style="--i:2">There are 2,500 Pockets, numbered 1 to 2,500.</p><a class="wr-b wr-link" data-ctl style="--i:3" href="#/wrapped/${1 + Math.floor(Math.random() * 2500)}">Surprise me</a>`, hooks.close); return; }
  // live state, the game module (for Pocket Run facts) and the leaderboards load side by side
  const [, g, lb] = await Promise.all([withTimeout(Promise.allSettled([app.refresh(id)]), 2800), withTimeout(import('./game.js').catch(() => null), 6000), withTimeout(lbFor(id), 2500)]); if (my !== seq) return;
  const q = app.byId().get(id); let run = null;
  try { if (g?.runInfo) run = g.runInfo(app, id); } catch {}
  const cards = pocketCards(app, q, { run, best: bestFor(id), lb: lb || [] });
  start(cards, key, THEME_OF[q.seg], '#/wrapped/' + id, '#' + id, hooks.close, { card: params.card, share: 'w/' + id, from: params.from });
}
function wireForm(app, hooks) {
  const f = $('#wrForm'); if (!f) return; const inp = $('#wrAddr'); setTimeout(() => inp.focus({ preventScroll: true }), 60);
  f.addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value.trim().replace(/^#/, ''); if (/^0x[0-9a-f]{40}$/i.test(v)) { location.hash = '#/wrapped/wallet/' + v.toLowerCase(); return; } if (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 2500) { location.hash = '#/wrapped/' + Number(v); return; } $('#wrErr').textContent = 'Enter a Pocket number from 1 to 2500, or a wallet address (0x followed by 40 characters).'; });
}
export function closeWrapped() { W.open = false; ++seq; cancelAnimationFrame(W.raf); W.raf = 0; FX.stop(); AMB.sleep(); W.cards = []; W.poster = null; const r = root(); if (r) r.innerHTML = ''; }
export const __test = { stats, pocketCards, walletCards, renderPNG, renderPoster, W, FX, AMB };
