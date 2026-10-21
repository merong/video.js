// A2-E-QA-DELTA F05 play-test as in A2-E-QA E06 (`?video=grok-demo-scene-01&type=videojs`) at 1280×900 and 390×844:
// click the player, wait for an ad to play, then count events, 4xx and console errors. The events go to the isolated
// QA database only.
import { BASE, launch, newContext, login, consoleCollector, recordNetwork, save, sleep, overflow, shot } from './lib.mjs';

const result = {};
const browser = await launch();
for (const [W, H] of [[1280, 900], [390, 844]]) {
  const context = await newContext(browser, { width: W, height: H });
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = {};
  try {
    await login(page);
    const from = net.length;
    await page.goto(`${BASE}/examples/play-test.html?video=grok-demo-scene-01&type=videojs`);
    await sleep(3500);
    const b = await page.locator('#player').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    const end = Date.now() + 20000;
    while (Date.now() < end && !/재생 중/.test(await page.locator('#now').innerText())) await sleep(300);
    await sleep(3000);
    r.now = (await page.locator('#now').innerText()).replace(/\s+/g, ' ');
    r.skin = await page.evaluate(() => document.querySelector('#player solad-video-skin, #player video-skin')?.localName ?? null);
    const mine = net.slice(from);
    r.events = mine.filter((e) => e.action === 'events').map((e) => `${e.method} ${e.status} ok=${e.ok}`);
    r.bad = mine.filter((e) => (e.status ?? 0) >= 400 || (e.failed && !/ERR_ABORTED/.test(e.failed))).map((e) => `${e.method} ${e.url.replace(BASE, '')} ${e.status ?? ''} ${e.failed ?? ''}`.trim());
    r.aborted = mine.filter((e) => e.failed && /ERR_ABORTED/.test(e.failed)).length;
    r.overflow = await overflow(page);
    await shot(page, `F05/play-test-${W}.png`);
  } catch (e) { r.error = String(e).slice(0, 800); }
  r.console = logs;
  result[`${W}x${H}`] = r;
  await context.close();
}
await browser.close();
save('F05/play-test.json', result);
console.log(JSON.stringify(result, null, 1));
