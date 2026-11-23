// Turns the raw snapshot (public/data/pockets.json) into the compact file the site loads.
import { readFileSync, writeFileSync } from 'node:fs';
import { toClient } from '../lib/pp.js';
const raw = JSON.parse(readFileSync(new URL('../data/raw.json', import.meta.url)));
const traitNames = [];
const tIdx = (n) => { let k = traitNames.indexOf(n); if (k < 0) { k = traitNames.length; traitNames.push(n); } return k; };
const pockets = raw.pockets.map((p) => {
  const c = toClient(p.id, p);
  if (p.chainOwner) c.o = p.chainOwner; // on-chain ownerOf is authoritative
  c.a = p.meta.attributes.map((a) => [tIdx(a.trait_type), a.value]);
  return c;
});
const out = { generatedAt: raw.generatedAt, collection: raw.collection, stats: raw.stats, traitNames, pockets };
writeFileSync(new URL('../public/data/snapshot.json', import.meta.url), JSON.stringify(out));
console.log('snapshot.json', JSON.stringify(out).length, 'bytes');
