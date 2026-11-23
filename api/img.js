import { SUPPLY } from '../lib/pp.js';
// One Pocket image, same-origin, so the Meme Maker can draw it on a canvas and export a PNG.
// Pocket Pad's image host sends no CORS headers (a cross-origin image would taint the canvas).
// One request per meme; images are immutable (the stem changes when the art does), so cache hard.
const STEM = /^v\d+-(\d+)-[a-z0-9-]+$/;
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const id = Number(q.get('id')), stem = q.get('stem') || '', kind = q.get('kind') === 'sprite' ? 'sprite' : 'card', night = q.get('night') === '1';
  const m = stem.match(STEM);
  if (!Number.isInteger(id) || id < 1 || id > SUPPLY || !m || Number(m[1]) !== id) return new Response('bad request', { status: 400 });
  try {
    const r = await fetch(`https://api.pocketpad.io/img/pocket/${id}/${kind}/${stem}${night ? '-night' : ''}.png`, { headers: { 'user-agent': 'pocket-viewer meme maker (unofficial fan viewer)' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return new Response('upstream ' + r.status, { status: r.status === 404 ? 404 : 502, headers: { 'cache-control': 'no-store' } });
    return new Response(await r.arrayBuffer(), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable' } });
  } catch (e) {
    return new Response('upstream error', { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
