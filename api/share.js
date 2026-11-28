import { API, SUPPLY } from '../lib/pp.js';
// Share links for Pocket Wrapped: /w/<id>[/<card>] and /w/wallet/<0x…>[/<card>].
// Social sites do not run JavaScript, so this returns a tiny page with a real title and preview image,
// then sends people on to the story card (#/wrapped/…) in the app.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page({ title, desc, image, hash, origin, square }) {
  const url = origin + hash; // canonical; the redirect itself stays relative
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Pocket Almanac">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="${square ? 'summary' : 'summary_large_image'}"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(url)}"><meta http-equiv="refresh" content="0;url=${esc(hash)}">
<script>location.replace(${JSON.stringify(hash).replace(/</g, '\\u003c')})</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#150d08;color:#fbefdc;font:16px system-ui,sans-serif}a{color:#ffd98a}</style></head>
<body><p><a href="${esc(hash)}">Open ${esc(title)}</a></p></body></html>`;
}
export async function GET(request) {
  const u = new URL(request.url), q = u.searchParams, origin = u.origin;
  const card = Math.min(20, Math.max(1, Math.floor(Number(q.get('card')) || 1))), cs = card > 1 ? '/' + card : '';
  const generic = `${origin}/og-wrapped.jpg`;
  const html = (o) => new Response(page({ origin, ...o }), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': o.retry ? 'public, max-age=0, s-maxage=60' : 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400' } });
  const addr = (q.get('addr') || '').toLowerCase();
  if (addr) {
    if (!/^0x[0-9a-f]{40}$/.test(addr)) return html({ title: 'Pocket Wrapped', desc: 'Swipeable story cards for any Pocket or wallet.', image: generic, hash: '/#/wrapped' });
    const s = addr.slice(0, 6) + '…' + addr.slice(-4);
    return html({ title: `Wallet Wrapped · ${s}`, desc: `Everything wallet ${s} holds in Pockets, as swipeable story cards made from live on-chain data.`, image: generic, hash: `/#/wrapped/wallet/${addr}${cs}` });
  }
  const id = Number(q.get('id'));
  if (!Number.isInteger(id) || id < 1 || id > SUPPLY) return html({ title: 'Pocket Wrapped', desc: 'Swipeable story cards for any Pocket or wallet.', image: generic, hash: '/#/wrapped' });
  let title = `Pocket #${id} · Pocket Wrapped`, desc = `The story of Pocket #${id}, as swipeable cards made from live on-chain data.`, image = generic, square = false, retry = false;
  try {
    const r = await fetch(`${API}/pockets/pocket/${id}`, { headers: { 'user-agent': 'pocket-viewer share preview (unofficial fan viewer)' }, signal: AbortSignal.timeout(6500) }); if (!r.ok) throw new Error(r.status); const p = (await r.json()).pocket || {};
    // the 80x80 card image is too small for link previews (X ignores it), so use the big portrait
    if (p.portraitUrl) { image = p.portraitUrl; square = true; }
    if (p.dead && p.spirit?.name) title = `${p.spirit.name} (Pocket #${id}) · Pocket Wrapped`;
    else if (p.dead) title = `Pocket #${id}, a spirit · Pocket Wrapped`;
    else if (p.lastWateredAt) title = `Pocket #${id}, a plant${p.streak ? ` on ${/^(8|11$|18$)/.test(String(p.streak)) ? 'an' : 'a'} ${p.streak}-day streak` : ''} · Pocket Wrapped`;
    else title = `Pocket #${id}, still a seed · Pocket Wrapped`;
  } catch { retry = true; /* the generic preview is fine, but do not cache it for long */ }
  return html({ title, desc, image, square, retry, hash: `/#/wrapped/${id}${cs}` });
}
