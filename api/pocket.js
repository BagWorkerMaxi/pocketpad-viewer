import { API, getJSON, compactState, toClient, SUPPLY } from '../lib/pp.js';
// One Pocket's live state + listing + trait shares (for the detail panel).
export async function GET(request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1 || id > SUPPLY) return Response.json({ error: 'bad id' }, { status: 400 });
  try {
    const [p, traits] = await Promise.all([
      getJSON(`${API}/pockets/pocket/${id}`, {}, 3),
      getJSON(`${API}/pockets/pocket/${id}/traits`, {}, 2).catch(() => null),
    ]);
    return Response.json({ fetchedAt: new Date().toISOString(), pocket: toClient(id, compactState(p)), traits: traits ? traits.traits : null },
      { headers: { 'cache-control': 'public, s-maxage=20, stale-while-revalidate=60' } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
