// Shared fetch logic for the snapshot (Node script) and the Vercel function.
export const CONTRACT = '0x3a98de41a0df554f6b69ca1b5a1ad93a745ab1f2';
export const API = 'https://api.pocketpad.io';
export const META = 'https://pocketpad.io/api/pocket';
export const RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const SUPPLY = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function getJSON(url, opts = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'user-agent': 'pocket-viewer-snapshot (unofficial fan viewer)', ...(opts.headers || {}) }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = true; throw e; }
      return await r.json();
    } catch (e) {
      if (e.fatal || i === tries - 1) throw e;
      await sleep(800 * 2 ** i + Math.random() * 400);
    }
  }
}
export async function pool(items, n, fn) {
  const out = new Array(items.length); let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } }));
  return out;
}
export async function owners(ids) {
  const res = {};
  const chunks = []; for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  await pool(chunks, 1, async (c) => {
    const body = c.map((id) => ({ jsonrpc: '2.0', id, method: 'eth_call', params: [{ to: CONTRACT, data: '0x6352211e' + id.toString(16).padStart(64, '0') }, 'latest'] }));
    const j = await getJSON(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 8);
    await sleep(250);
    for (const x of j) if (x.result && x.result.length >= 66) res[x.id] = '0x' + x.result.slice(-40);
  });
  return res;
}
// Compact a /pockets/pocket/<id> response. Only fields the API actually returns.
export function compactState(j) {
  const p = j.pocket, l = j.listing;
  const o = {
    dead: p.dead, seed: p.seed, streak: p.streak, wateredDays: p.wateredDays, stage: p.stage, wilt: p.wilt, health: p.health,
    lastWateredAt: p.lastWateredAt, revealedRank: p.revealedRank, deathOrdinal: p.deathOrdinal, speciesId: p.speciesId,
    spirit: p.spirit, owner: p.ownerAddress || null,
    img: { card: p.cardUrl, cardN: p.cardNightUrl, sprite: p.spriteUrl, spriteN: p.spriteNightUrl, portrait: p.portraitUrl, hero: p.heroUrl, reveal: p.revealUrl },
    listing: l && l.status === 'active' ? { priceWei: l.priceWei, seller: l.seller, listedAt: l.listedAt } : null,
  };
  return o;
}

// Compact per-token state for the browser. Keys:
// i id, d dead, w lastWateredAt, sk streak, wd wateredDays, sg stage, wl wilt, h health,
// rk revealedRank, dn deathOrdinal, sp speciesId, s spirit, o owner, c image stem, l listing
export function toClient(id, st) {
  const stem = st.img && st.img.card ? st.img.card.split('/card/')[1].replace(/\.png$/, '') : null;
  const o = { i: id, d: !!st.dead, w: st.lastWateredAt || null, sk: st.streak, wd: st.wateredDays, sg: st.stage, wl: st.wilt, h: st.health, sp: st.speciesId, o: st.owner, c: stem };
  if (st.revealedRank != null) o.rk = st.revealedRank;
  if (st.deathOrdinal != null) o.dn = st.deathOrdinal;
  if (st.spirit) o.s = st.spirit;
  if (st.listing) o.l = { p: st.listing.priceWei, at: st.listing.listedAt };
  return o;
}
export async function fetchStates(ids, conc = 8) {
  return pool(ids, conc, async (id) => toClient(id, compactState(await getJSON(`${API}/pockets/pocket/${id}`))));
}
export async function fetchAllListings() {
  const out = []; let cursor = '';
  for (let n = 0; n < 30; n++) {
    const j = await getJSON(`${API}/market/pocket/listings?limit=100&cursor=${encodeURIComponent(cursor)}`);
    out.push(...j.listings); if (!j.nextCursor || !j.listings.length) break; cursor = j.nextCursor;
  }
  return out;
}
