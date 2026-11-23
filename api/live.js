import { API, getJSON, fetchAllListings } from '../lib/pp.js';
// Live market + totals. Pocket Pad's API only allows its own origin via CORS, so this proxies it,
// cached at the edge for 30s so visitors never hammer the upstream.
export async function GET() {
  try {
    const [collection, stats, listings, activity] = await Promise.all([
      getJSON(`${API}/collections/pocket`, {}, 3),
      getJSON(`${API}/market/pocket/stats`, {}, 3),
      fetchAllListings(),
      getJSON(`${API}/collections/pocket/activity?limit=20`, {}, 3).catch(() => null),
    ]);
    const body = {
      fetchedAt: new Date().toISOString(), collection, stats,
      listings: listings.filter((l) => l.status === 'active').map((l) => [l.tokenId, l.priceWei, l.listedAt]),
      activity: activity ? activity.items : [],
    };
    return Response.json(body, { headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
