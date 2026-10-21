// A2-D-QA-DELTA X03 (A2D-01): on the demo, a click starts the pre-roll until 최근 광고 진행 reads 프리롤 1/2 재생 중.
// A preset change that only restyles (same playback/display options → handle.restyle) must keep the line and the same
// player element; a loop toggle (a mount option → remount) must reset the line to 아직 광고가 나오지 않았어요 while the
// progress log keeps its rows. The player element is tagged in-page to tell restyle from remount.
import { launch, newContext, consoleCollector, save, shot, sleep } from './lib.mjs';
import { demoState, openDemo, requestLog } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const now = () => page.locator('#now').innerText().then((t) => t.replace(/\s+/g, ' ').trim());
const logRows = () => page.locator('#log li').allInnerTexts().then((r) => r.map((t) => t.replace(/\s+/g, ' ').trim()));
const tag = (name) => page.evaluate((name) => { const el = document.querySelector('#player video-player, #player video'); if (el) el.dataset.qaTag = name; return Boolean(el); }, name);
const tagged = () => page.evaluate(() => document.querySelector('#player video-player, #player video')?.dataset.qaTag ?? null);
const snap = async (label) => ({ label, now: await now(), log: await logRows(), tag: await tagged(), preset: await page.locator('#preset').inputValue(), loop: await page.locator('[data-key="loop"]').getAttribute('aria-checked'), accent: await page.evaluate(() => getComputedStyle(document.querySelector('#player video-player') ?? document.body).getPropertyValue('--media-color-primary').trim() || null) });

async function startPreroll() {
  const box = await page.locator('#player').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const end = Date.now() + 20000;
  while (Date.now() < end && !/프리롤 1\/2 재생 중/.test(await now())) await sleep(300);
}

try {
  await openDemo(page);
  result.options = (await demoState(page)).preset.options.map((o) => `${o.value}:${o.label}${o.selected ? '*' : ''}`);
  result.initial = await snap('initial');

  // Restyle: site preset (QA 강조색 복제, #2563eb) → 강조색 built-in; both keep every playback/display option at defaults.
  await startPreroll();
  await tag('before-restyle');
  result.playing = await snap('playing');
  await shot(page, 'X03/playing.png');
  const accent = result.options.find((o) => /강조색$|:강조색/.test(o) && !/QA/.test(o))?.split(':')[0] ?? 'accent';
  await page.locator('#preset').selectOption(accent);
  await sleep(1500);
  result.afterRestyle = await snap(`restyle → ${accent}`);
  result.afterRestyleStatus = (await demoState(page)).stageStatus;
  await shot(page, 'X03/after-restyle.png');

  // Rebuild: the loop toggle changes the mount options.
  await page.locator('[data-key="loop"]').click();
  await sleep(2500);
  result.afterLoop = await snap('loop toggle');
  await shot(page, 'X03/after-loop.png');

  // The same pair once more from the rebuilt player: start again, then a restyle back to the site preset.
  await startPreroll();
  await tag('before-restyle-2');
  result.playing2 = await snap('playing again');
  const site = result.options.find((o) => o.endsWith('*'))?.split(':')[0];
  if (site) await page.locator('#preset').selectOption(site);
  await sleep(1500);
  result.afterRestyle2 = await snap(`restyle → ${site}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'X03/error.png', { fullPage: true }).catch(() => {});
}
result.events = req.events().length;
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
save('X03/result.json', result);
await browser.close();
