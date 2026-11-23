import { fetchStates, SUPPLY } from '../lib/pp.js';
// Full per-token state, in 5 parts of 500 ids. Cached 10 min at the edge, so upstream sees
// at most ~2,500 requests per 10 minutes no matter how many people visit.
export const PARTS = 5;
export async function GET(request) {
  const part = Number(new URL(request.url).searchParams.get('part'));
  if (!Number.isInteger(part) || part < 0 || part >= PARTS) return Response.json({ error: 'part must be 0-4' }, { status: 400 });
  const size = SUPPLY / PARTS, ids = Array.from({ length: size }, (_, i) => part * size + i + 1);
  try {
    const pockets = await fetchStates(ids, 20);
    return Response.json({ fetchedAt: new Date().toISOString(), part, pockets }, { headers: { 'cache-control': 'public, s-maxage=600, stale-while-revalidate=1800' } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
