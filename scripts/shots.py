import sys, asyncio
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8787'
OUT = '/workspace/pocketpad/screenshots'
DETAIL = {'soil': 1385, 'garden': 101, 'heaven': 949}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        for name, vp in [('desktop', {'width': 1440, 'height': 900}), ('mobile', {'width': 390, 'height': 844})]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if name == 'mobile' else 1, is_mobile=name == 'mobile', has_touch=name == 'mobile')
            pg = await ctx.new_page()
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            for v in ['soil', 'garden', 'heaven']:
                await pg.goto('about:blank'); await pg.goto(f'{BASE}/#/{v}', wait_until='networkidle')
                await pg.wait_for_timeout(2500)
                await pg.screenshot(path=f'{OUT}/{name}-{v}.png')
                await pg.evaluate('window.scrollTo(0, 620)'); await pg.wait_for_timeout(1500)
                await pg.screenshot(path=f'{OUT}/{name}-{v}-grid.png')
                await pg.goto(f'{BASE}/#/{v}/{DETAIL[v]}'); await pg.wait_for_timeout(3500)
                await pg.screenshot(path=f'{OUT}/{name}-{v}-detail.png')
            await ctx.close()
        await b.close()
        print('errors:', errs[:10])
asyncio.run(main())
