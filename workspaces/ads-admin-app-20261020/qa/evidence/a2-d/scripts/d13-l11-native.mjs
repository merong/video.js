// A2-D-QA D13 L11 native legacy debug: console, /api and media requests, the payload shape, and video state over time,
// once without any click (the controller is created after the schedule fetch) and once with a click after 4 s.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { openPage } from './a2.mjs';

const PASTE = 'http://127.0.0.1:18781/__qa/paste';
const browser = await launch();
const result = {};
for (const [name, delay] of [['a2-1-l11-legacy-native', 4000], ['pl16-native-mp4', 4000]]) {
  const context = await newContext(browser, { height: 1000 });
  const req = [];
  context.on('response', async (res) => { const u = new URL(res.url()); if (/api|\.mp4|ads\.js/.test(u.pathname + u.search)) req.push(`${res.request().method()} ${u.pathname}${u.search.replace(/token=[^&]+/, 'token=…')} ${res.status()}${/action=schedule/.test(u.search) ? ' ' + (await res.text().catch(() => '')).replace(/"(token|sig|signature)":"[^"]+"/g, '"$1":"…"').slice(0, 300) : ''}`); });
  const r = {};
  try {
    const { page, all } = await openPage(context, `${PASTE}/${name}.html`);
    await sleep(delay);
    r.beforeClick = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => `${(v.currentSrc || v.src).split('/').pop()}:${v.paused}`));
    await page.evaluate(() => document.querySelector('video').play().then(() => 'played', (e) => String(e)));
    await sleep(6000);
    r.after = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => `${(v.currentSrc || v.src).split('/').pop()}:${v.paused ? 'paused' : 'playing'}@${v.currentTime.toFixed(1)}`));
    r.dom = await page.evaluate(() => document.querySelector('[id^="ads-player"]')?.innerHTML.replace(/\s+/g, ' ').slice(0, 400));
    r.console = all.map((l) => `${l.type}: ${l.text}`);
    await shot(page, `D13/L11-debug-${name}.png`);
  } catch (error) {
    r.error = String(error).slice(0, 600);
  }
  r.requests = req;
  result[name] = r;
  await context.close();
}
save('D13/l11-native-debug.json', result);
await browser.close();
