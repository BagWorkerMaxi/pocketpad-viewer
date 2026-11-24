// Pocket Run leaderboard. Free storage: one private JSON file in a Vercel Blob store (Hobby: hard-capped, never bills).
// POST {action:'start', id}            -> signed run token (server time, live stage of the Pocket)
// POST {action:'submit', token, name, run} -> validates, stores best per nickname+Pocket, returns ranks
// GET  ?stage=seed|plant|spirit -> top 20 of that stage's all-time board
// A browser game can never be fully cheat-proof; these checks just make casual cheating hard.
import { get, put } from '@vercel/blob';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { API, SUPPLY } from '../lib/pp.js';

const FILE = (process.env.LB_PREFIX || 'lb/') + 'board.json';
const TOP = 100, SHOW = 20, MIN_S = 6, MAX_S = 15 * 60, IP_DAY = 20, IP_GAP = 8e3, START_MIN = 30;
const STAGES = ['seed', 'plant', 'spirit'];
const SEC = () => createHash('sha256').update('pocketrun-lb|' + (process.env.BLOB_READ_WRITE_TOKEN || 'dev')).digest();
const today = () => new Date().toISOString().slice(0, 10);
const nope = (error) => json({ ok: false, error }); // a rejected run is a normal answer, not a server error
const json = (o, status = 200, cache = 'no-store') => Response.json(o, { status, headers: { 'cache-control': cache } });
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (s) => b64(createHmac('sha256', SEC()).update(s).digest());
const ipOf = (req) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
const ipHash = (ip) => createHmac('sha256', SEC()).update('ip|' + ip).digest('base64url').slice(0, 16);

// ---- best-effort per-instance limits (the per-day IP cap below is stored, so it holds across instances) ----
const mem = new Map();
function tooFast(key, gap, max = 1) {
  const now = Date.now(), a = (mem.get(key) || []).filter((t) => now - t < gap);
  if (a.length >= max) { mem.set(key, a); return true; }
  a.push(now); mem.set(key, a); if (mem.size > 5000) mem.clear(); return false;
}

// ---- nickname filter: short, plain text, no links, no obvious slurs/profanity ----
const BAD = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'porn', 'dick', 'cock', 'pussy', 'whore', 'slut', 'retard', 'kys', 'asshole', 'wank', 'twat'];
export function cleanName(raw) {
  const s = String(raw ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 16) return { error: 'Nickname must be 2 to 16 characters' };
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(s)) return { error: 'Letters, numbers, spaces, _ . - only' };
  const flat = s.toLowerCase().replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
  if (/(https?|www|\.(com|net|org|io|xyz|gg|ly|me|app|dev|co)\b)/i.test(s) || /(http|www)/.test(flat)) return { error: 'No links in nicknames' };
  const squash = flat.replace(/(.)\1+/g, '$1');
  if (BAD.some((w) => flat.includes(w) || squash.includes(w.replace(/(.)\1+/g, '$1')))) return { error: 'Please pick a different nickname' };
  return { name: s };
}

// ---- plausibility: what a real run of this length could produce ----
export function check(run, stage, secs) {
  const n = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
  const r = run || {};
  if (!n(r.score, 0, 3000 + 260 * secs)) return 'Score is not possible for a run that short';
  if (!n(r.dur, MIN_S - 1, secs + 3)) return 'Run length does not match';
  if (!n(r.bestCombo, 0, 8 * secs + 5)) return 'Combo is not possible';
  if (stage === 'seed') {
    if (!n(r.sips, 0, 10) || !n(r.depth, 0, 3 * secs + 3)) return 'Seed stats are not possible';
    if (r.sprouted && (r.sips !== 10 || !n(r.hours, 0, 6 * secs + 6))) return 'Sprout stats are not possible';
    if (!r.sprouted && r.hours) return 'A seed has no hours';
  } else if (stage === 'plant') {
    if (!n(r.hours, 0, 6 * secs + 6) || !n(r.days, 0, Math.floor((6 * secs + 6) / 24))) return 'Plant stats are not possible';
  } else if (!n(r.seconds, 0, secs + 3) || !n(r.stars, 0, 4 * secs + 10)) return 'Spirit stats are not possible';
  return null;
}
// the one stat each stage is about
const statOf = (r, st) => st === 'seed' ? (r.sprouted ? { sp: 1, si: 10, hr: r.hours | 0, dy: r.days | 0 } : { sp: 0, si: r.sips | 0, dp: r.depth | 0 }) : st === 'plant' ? { hr: r.hours | 0, dy: r.days | 0 } : { s: r.seconds | 0 };

// ---- storage: one JSON file, optimistic write with ETag ----
async function load() {
  const r = await get(FILE, { access: 'private', useCache: false }).catch((e) => { if (/not.?found/i.test(String(e?.message || e))) return null; throw e; });
  if (!r || r.statusCode !== 200) return { data: { v: 1, boards: {}, nonces: [], ips: {} }, etag: null };
  return { data: await new Response(r.stream).json(), etag: r.blob.etag };
}
async function save(data, etag) {
  return put(FILE, JSON.stringify(data), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60, ...(etag ? { ifMatch: etag } : {}) });
}
const sortB = (a) => a.sort((x, y) => y.sc - x.sc || x.at - y.at);
const pub = (e, i) => ({ rank: i + 1, name: e.n, id: e.id, stage: e.st, score: e.sc, stat: e.x, spirit: e.sn || null, at: e.at });

let cache = { t: 0, data: null };
async function boardData() { if (Date.now() - cache.t < 10e3 && cache.data) return cache.data; const { data } = await load(); cache = { t: Date.now(), data }; return data; }

export async function GET(req) {
  const st = new URL(req.url).searchParams.get('stage');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Leaderboard storage is not connected on this deployment', offline: true }, 503);
  if (!STAGES.includes(st)) return json({ error: 'bad stage' }, 400);
  const key = 'all:' + st;
  try {
    const data = await boardData(), list = data.boards[key] || [];
    return json({ board: key, stage: st, total: list.length, entries: list.slice(0, SHOW).map(pub) }, 200, 'public, s-maxage=15, stale-while-revalidate=45');
  } catch (e) { return json({ error: 'Leaderboard is unavailable right now' }, 503); }
}

export async function POST(req) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Leaderboard storage is not connected on this deployment', offline: true }, 503);
  const ip = ipOf(req), ih = ipHash(ip);
  let body; try { const t = await req.text(); if (t.length > 4000) throw 0; body = JSON.parse(t); } catch { return json({ error: 'Bad request' }, 400); }
  if (body?.action === 'start') {
    if (tooFast('start|' + ih, 60e3, START_MIN)) return json({ error: 'Too many runs started, slow down a little' }, 429);
    const id = Number(body.id); if (!Number.isInteger(id) || id < 1 || id > SUPPLY) return json({ error: 'bad id' }, 400);
    let st = STAGES.includes(body.stage) ? body.stage : 'seed', sn = null, live = 0;
    try { const res = await fetch(`${API}/pockets/pocket/${id}`, { headers: { 'user-agent': 'pocket-viewer game (unofficial fan viewer)' }, signal: AbortSignal.timeout(4000) }); const p = res.ok ? (await res.json())?.pocket : null; if (p) { st = p.dead ? 'spirit' : p.lastWateredAt ? 'plant' : 'seed'; sn = p.spirit?.name || null; live = 1; } } catch {}
    const pl = b64(JSON.stringify({ id, st, sn, live, t: Date.now(), n: randomBytes(9).toString('base64url') }));
    return json({ token: pl + '.' + sign(pl), stage: st });
  }
  if (body?.action !== 'submit') return json({ error: 'Bad request' }, 400);
  // token
  const parts = String(body.token || '').split('.'), [pl, sig] = parts.length === 2 ? parts : [];
  let tk; try { const a = Buffer.from(sign(pl || '')), b = Buffer.from(sig || ''); if (!pl || a.length !== b.length || !timingSafeEqual(a, b)) throw 0; tk = JSON.parse(Buffer.from(pl, 'base64url').toString()); } catch { return nope('This run was not started properly, so it cannot be submitted'); }
  const secs = (Date.now() - tk.t) / 1000;
  if (secs < MIN_S) return nope('Run too short to count');
  if (secs > MAX_S) return nope('This run is too old to submit');
  const nm = cleanName(body.name); if (nm.error) return nope(nm.error);
  if (!(body.run?.score > 0)) return nope('Score some points first');
  const bad = check(body.run, tk.st, secs); if (bad) return nope(bad);
  if (tooFast('sub|' + ih, IP_GAP)) return json({ error: 'One submit every few seconds, please' }, 429);
  const r = body.run, d = today();
  for (let attempt = 0; attempt < 3; attempt++) {
    let data, etag;
    try { ({ data, etag } = await load()); } catch { return json({ error: 'Leaderboard is unavailable right now' }, 503); }
    data.ips = { [d]: (data.ips || {})[d] || {} };
    if ((data.ips[d][ih] || 0) >= IP_DAY) return json({ error: `Submit limit reached (${IP_DAY} per day), try again tomorrow` }, 429);
    if ((data.nonces || []).includes(tk.n)) return nope('This run was already submitted');
    data.ips[d][ih] = (data.ips[d][ih] || 0) + 1;
    data.nonces = [tk.n, ...(data.nonces || [])].slice(0, 3000);
    for (const k of Object.keys(data.boards)) if (!k.startsWith('all:')) delete data.boards[k];
    const entry = { n: nm.name, id: tk.id, st: tk.st, sc: Math.round(r.score), x: statOf(r, tk.st), sn: tk.sn, lv: tk.live, at: Date.now() };
    const key = 'all:' + tk.st, who = nm.name.toLowerCase() + '|' + tk.id, same = (e) => e.n.toLowerCase() + '|' + e.id === who;
    const list = data.boards[key] || [], i = list.findIndex(same);
    let improved = true;
    if (i >= 0) { if (list[i].sc >= entry.sc) improved = false; else list.splice(i, 1); }
    if (improved) list.push(entry);
    data.boards[key] = sortB(list).slice(0, TOP);
    const pos = data.boards[key].findIndex(same);
    const all = { rank: pos >= 0 ? pos + 1 : null, improved, best: pos >= 0 ? data.boards[key][pos].sc : null, total: data.boards[key].length };
    try { await save(data, etag); cache = { t: 0, data: null }; return json({ ok: true, stage: tk.st, all }); }
    catch (e) { if (attempt === 2 || !/precondition|etag|412|match/i.test(String(e?.message || e))) return json({ error: 'Could not save right now, try again' }, 503); }
  }
}
