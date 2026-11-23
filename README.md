# Pocket Almanac (unofficial)

Live viewer for all 2,500 Pocket Pad "Pockets" (Robinhood Chain, chainId 4663, contract `0x3a98de41a0df554f6b69ca1b5a1ad93a745ab1f2`).
Not affiliated with Pocket Pad. No wallet connect, no sign-in.

## How data flows
- `public/data/snapshot.json`: built-in snapshot (all 2,500 per-token states + metadata traits + on-chain `ownerOf`), so the page renders instantly.
- `api/live.js`: proxies `collections/pocket`, `market/pocket/stats`, all `market/pocket/listings` pages and recent activity. Edge-cached 30s. The browser polls it every 60s.
- `api/state.js?part=0..4`: re-fetches every token's state from `api.pocketpad.io/pockets/pocket/<id>` (500 ids per part). Edge-cached 10 min. The browser polls it every 10 min.
- `api/pocket.js?id=N`: live state + listing + trait shares for the detail panel. The browser also reads token metadata (`pocketpad.io/api/pocket/<id>`) and `ownerOf` from the public RPC directly; both allow CORS.
- A proxy is needed because `api.pocketpad.io` only allows the `https://pocketpad.io` origin.

## Meme Maker (`#/meme`, `#/meme/<id>`)
`public/meme.js` (UI, data, stat cards, captions), `meme-templates.js` (15 code-drawn scenes), `meme-text.js`
(56 joke lines with real-data conditions, 76 captions), `meme-draw.js` (canvas helpers). Art comes from the atlas
sprite sheets (cropped on a canvas) plus one same-origin card image per Pocket via `api/img.js` (validated id + stem,
cached immutable), so the canvas stays untainted for PNG export. Stats come live from `/api/pocket` when a meme is made.

## Sprite atlases
Pocket Pad's image host allows ~240 requests/min per visitor, so the tile worlds draw sprites from
pre-built atlases (`public/atlas/{seed,plant,reveal}-{day,night}.png` + `manifest.json`), built by
`scripts/atlas.py` (needs Pillow; caches immutable sprites in `data/sprites/`). Any Pocket whose live
image changed since the atlas was built is fetched individually, throttled to ~150/min.

## Commands
```
npm run dev        # local server on :8787 (serves public/ and runs api/*.js)
npm run snapshot   # refetch everything into data/raw.json and rebuild public/data/snapshot.json (~6 min) + rebuild atlases
vercel deploy --prod   # deploy (Vercel Hobby, free). api/*.js become serverless functions.
```
