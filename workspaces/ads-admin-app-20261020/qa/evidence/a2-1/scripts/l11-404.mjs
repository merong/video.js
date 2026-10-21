// A2-1-QA L11 follow-up: which URLs answer 404 on the legacy pages (paths only).
import { BASE, launch, newContext, save, sleep } from './lib.mjs';
const browser = await launch();
const out = {};
for (const f of ['pl16-videojs-mp4', 'pl16-native-mp4', 'a2-1-l11-legacy-videojs']) {
  const context = await newContext(browser);
  const page = await context.newPage();
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await page.goto(`${BASE}/__qa/paste/${f}.html`);
  await sleep(2500);
  const box = await page.locator('video').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(3000);
  out[f] = bad;
  await context.close();
}
save('L11/http-errors.json', out);
console.log(JSON.stringify(out));
await browser.close();
