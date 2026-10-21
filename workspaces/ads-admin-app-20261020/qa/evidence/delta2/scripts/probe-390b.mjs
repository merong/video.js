// A1-QA-DELTA probe (read-only): elements reaching the 560px page edge on 390px #/creatives.
import { BASE, launch, login, save, sleep } from './lib.mjs';
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await login(page);
await page.goto(`${BASE}/#/creatives`);
await sleep(1500);
const out = await page.evaluate(() => {
  const sw = document.documentElement.scrollWidth;
  const hits = [...document.querySelectorAll('body *')].map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width && r.right >= sw - 60).slice(0, 15);
  return { sw, hits: hits.map(({ e, r }) => ({ tag: e.tagName, cls: String(e.className).slice(0, 50), left: Math.round(r.left), right: Math.round(r.right), pos: getComputedStyle(e).position, ovx: getComputedStyle(e).overflowX, chain: (() => { const c = []; for (let p = e.parentElement; p && c.length < 6; p = p.parentElement) c.push(`${p.tagName}.${String(p.className).split(' ')[0]}:${getComputedStyle(p).overflowX}:${getComputedStyle(p).position}`); return c; })() })) };
});
save('B14-390/probe-overflow-b.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 3500));
await browser.close();
