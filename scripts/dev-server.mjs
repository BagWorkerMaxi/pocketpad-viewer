// Local stand-in for Vercel: serves /public and runs /api/*.js Web handlers.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../public/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const cache = new Map();
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
      const key = url.pathname + url.search, hit = cache.get(key);
      let r;
      if (hit && Date.now() - hit.t < 30000) r = hit.r.clone();
      else { const mod = await import(`../api/${name}.js`); r = await mod.GET(new Request(url)); cache.set(key, { t: Date.now(), r: r.clone() }); }
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(root)) throw 0;
    if ((await stat(p).catch(() => null))?.isDirectory()) p = join(p, 'index.html');
    const buf = await readFile(p).catch(() => readFile(join(root, 'index.html')));
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(buf);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(process.env.PORT || 8787, () => console.log('dev on', process.env.PORT || 8787));
