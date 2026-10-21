// A1-QA-DELTA probe (read-only): which elements push the 390px page wider than the viewport.
import { BASE, launch, login, save, sleep, shot } from './lib.mjs';
const browser = await launch();
const out = {};
for (const [w, h] of [[390, 844], [768, 1024]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  await login(page);
  for (const hash of ['#/creatives', '#/campaigns', '#/schedule', '#/players', '#/help', '#/reports']) {
    await page.goto(`${BASE}/${hash}`);
    await sleep(1500);
    out[`${w}${hash}`] = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || r.right <= vw + 0.5) return false;
        for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p !== document.documentElement && p !== document.body) return false;
        return true;
      });
      return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: wide.slice(0, 8).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), right: Math.round(e.getBoundingClientRect().right), pos: getComputedStyle(e).position, text: e.textContent.trim().slice(0, 30) })) };
    });
    if (w === 390 && hash === '#/creatives') await shot(page, 'B14-390/creatives-viewport.png');
  }
  await context.close();
}
save('B14-390/probe-overflow.json', out);
await browser.close();
