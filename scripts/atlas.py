"""Build sprite atlases (one PNG per segment x day/night) from the official per-token sprites.
Pocket Pad's image host allows ~240 requests/min per IP, so a browser can't load 1,520 sprites at once.
Sprite URLs are immutable (content-addressed stems), so downloads are cached in data/sprites/ and
only new/changed stems are fetched on later runs."""
import json, os, sys, time, urllib.request, urllib.error
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw.json'); CACHE = os.path.join(ROOT, 'data', 'sprites'); OUT = os.path.join(ROOT, 'public', 'atlas')
IMG = 'https://api.pocketpad.io/img/pocket'
os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
raw = json.load(open(RAW))
def seg(p): return 'reveal' if p['dead'] else ('plant' if p.get('lastWateredAt') else 'seed')
def stem(p): return p['img']['card'].split('/card/')[1][:-4]
jobs = []
for p in raw['pockets']:
    for night in (False, True):
        s = stem(p) + ('-night' if night else '')
        path = os.path.join(CACHE, f"{p['id']}-{s}.png")
        if not os.path.exists(path): jobs.append((f"{IMG}/{p['id']}/sprite/{s}.png", path))
print('to fetch', len(jobs), flush=True)
import threading
from concurrent.futures import ThreadPoolExecutor
lock = threading.Lock(); next_slot = [time.time()]; done = [0]
GAP = 60 / 210  # global pacing: at most ~210 requests/min, under the 240/min limit
def fetch(job):
    url, path = job
    for attempt in range(8):
        with lock:
            now = time.time(); wait = max(0, next_slot[0] - now); next_slot[0] = max(now, next_slot[0]) + GAP
        time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={'user-agent': 'pocket-viewer-atlas (unofficial fan viewer)'})
            with urllib.request.urlopen(req, timeout=30) as r: data = r.read()
            open(path + '.tmp', 'wb').write(data); os.replace(path + '.tmp', path); break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                with lock: next_slot[0] = time.time() + int(e.headers.get('x-ratelimit-reset') or 30) + 1
                continue
            if e.code == 404: print('404', url, flush=True); break
            time.sleep(2 ** attempt)
        except Exception: time.sleep(2 ** attempt)
    with lock:
        done[0] += 1
        if done[0] % 250 == 0: print('fetched', done[0], flush=True)
with ThreadPoolExecutor(12) as ex: list(ex.map(fetch, jobs))
manifest = {'generatedAt': raw['generatedAt'], 'segments': {}}
for sg in ('seed', 'plant', 'reveal'):
    ps = sorted([p for p in raw['pockets'] if seg(p) == sg], key=lambda p: p['id'])
    if not ps: continue
    ims = {}
    for p in ps:
        for night in (False, True):
            path = os.path.join(CACHE, f"{p['id']}-{stem(p)}{'-night' if night else ''}.png")
            if os.path.exists(path): ims[(p['id'], night)] = Image.open(path).convert('RGBA')
    cw = max(im.width for im in ims.values()); ch = max(im.height for im in ims.values())
    cols = 40 if len(ps) > 200 else 10; rows = -(-len(ps) // cols)
    cells = {}
    sheets = {False: Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0)), True: Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0))}
    for k, p in enumerate(ps):
        x, y = (k % cols) * cw, (k // cols) * ch
        d = ims.get((p['id'], False)); n = ims.get((p['id'], True))
        if d is None: continue
        sheets[False].paste(d, (x, y)); cells[p['id']] = [x, y, d.width, d.height, stem(p), 1 if n is not None and n.size == d.size else 0]
        if n is not None: sheets[True].paste(n, (x, y))
    for night, im in sheets.items():
        im.save(os.path.join(OUT, f"{sg}-{'night' if night else 'day'}.png"), optimize=True)
    manifest['segments'][sg] = {'w': cols * cw, 'h': rows * ch, 'day': f'{sg}-day.png', 'night': f'{sg}-night.png', 'cells': cells}
    print(sg, len(cells), 'cells', cols * cw, 'x', rows * ch)
v = str(int(time.time()))
manifest['v'] = v
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))
print('done')
