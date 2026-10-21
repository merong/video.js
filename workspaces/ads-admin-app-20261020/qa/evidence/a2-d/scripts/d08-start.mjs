// A2-D-QA D03/D08 "처음부터" after the content and postroll have ended (the first run clicked it during the postroll):
// the content must go back to 0 and play. Demo only; the editor preview uses the same handle.seek.
import { launch, newContext, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openDemo, requestLog } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const media = () => page.evaluate(() => { const m = document.querySelector('#player video'); return m && { t: Math.round(m.currentTime * 10) / 10, paused: m.paused, ended: m.ended }; });
const now = () => page.locator('#now').innerText().then((t) => t.replace(/\s+/g, ' '));
try {
  await openDemo(page);
  await page.locator('[data-scene]', { hasText: '끝 직전' }).click();
  const end = Date.now() + 60000;
  while (Date.now() < end && !/포스트롤 1\/1 · 끝남/.test(await now())) await sleep(500);
  await sleep(1500);
  result.afterPostroll = { now: await now(), media: await media() };
  await page.locator('[data-scene]', { hasText: '처음부터' }).click();
  await sleep(2500);
  result.afterStart = { now: await now(), media: await media() };
  await shot(page, 'D08/scene-demo-start-after-end.png');
} catch (error) {
  result.error = String(error).slice(0, 1000);
}
result.events = req.events().length;
result.console = logs;
save('D08/start-after-end.json', result);
await browser.close();
