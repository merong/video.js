// A2-E-QA E05: a click on a decorative logo (no link) during content playback does what a click at the same point does
// without a logo (the video pauses). The "미드롤 앞" scene runs to content after the midroll first. Nothing is saved.
import { EV, launch, newContext, login, save, sleep } from './lib.mjs';
import { openDemo, waitPlayer } from './demo.mjs';
import { logoFacts, nowText } from './e05-lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
const result = {};

async function toContent() {
  await page.locator('[data-scene="before-midroll"]').click();
  const end = Date.now() + 40000;
  let sawMidroll = false;
  while (Date.now() < end) {
    if (/미드롤 1\/1 재생 중/.test(await nowText(page))) sawMidroll = true;
    const f = await logoFacts(page);
    if (sawMidroll && !f.adsOverlay && !f.paused && f.t > 5.2) return true;
    await sleep(120);
  }
  return false;
}

await login(page);
for (const [label, query] of [['decorativeLogo', '?logo=sample-png&logoPosition=bottom-left&logoWidth=120&loop=true'], ['noLogo', '?loop=true']]) {
  await openDemo(page, query);
  await waitPlayer(page);
  const reached = await toContent();
  // The logo's place, measured with the logo, is reused for the run without one.
  if (label === 'decorativeLogo') {
    result.point = await page.evaluate(() => { const s = document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.solad-logo').getBoundingClientRect(); return { x: Math.round(s.x + s.width / 2), y: Math.round(s.y + s.height / 2) }; });
  }
  const before = await logoFacts(page);
  await page.mouse.click(result.point.x, result.point.y);
  await sleep(700);
  const after = await logoFacts(page);
  result[label] = { reached, before: { t: before.t, paused: before.paused, ads: before.adsOverlay, logo: Boolean(before.slot), alt: before.slot?.img?.alt ?? null, pointerEvents: before.slot?.pointerEvents ?? null }, after: { t: after.t, paused: after.paused } };
  await page.locator('#stage-view').screenshot({ path: `${EV}/E05/click-${label}-1280.png` });
}
await context.close();
save('E05/click-1280.json', result);
await browser.close();
