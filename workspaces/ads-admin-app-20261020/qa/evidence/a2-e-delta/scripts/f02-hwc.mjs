// A2-E-QA-DELTA F02 follow-up: hideWithControls at 1280×900 traced over time (container controls state, logo opacity and
// visibility) while the controls hide and show again, with a playing video. Nothing is saved.
import { launch, newContext, login, consoleCollector, save, sleep } from './lib.mjs';
import { openDemo } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
const logs = consoleCollector(page);
const out = { trace: [] };
const read = (label) => page.evaluate((label) => {
  const root = document.querySelector('#player solad-video-skin').shadowRoot;
  const c = root.querySelector('media-container');
  const s = root.querySelector('.solad-logo');
  const v = document.querySelector('#player video');
  return { label, controls: c.hasAttribute('data-controls-visible'), opacity: getComputedStyle(s).opacity, visibility: getComputedStyle(s).visibility, attr: s.hasAttribute('data-hide-with-controls'), hda: s.hasAttribute('data-hide-during-ads'), ads: Boolean(c.querySelector(':scope > [data-ads-overlay]')), now: document.querySelector('#now')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), paused: v.paused, t: Math.round(v.currentTime * 10) / 10 };
}, label);
try {
  await login(page);
  await openDemo(page, '?logo=sample-png&logoWidth=120&logoPosition=bottom-left');
  await sleep(1200);
  await page.locator('button.sa-toggle[data-key="loop"]').click();
  await sleep(1500);
  await page.locator('button.sa-toggle[data-key="logoHideWithControls"]').click();
  await sleep(1000);
  out.playClick = await page.evaluate(async () => { const v = document.querySelector('#player video'); v.muted = true; await v.play().catch(() => {}); await new Promise((r) => setTimeout(r, 800)); return { paused: v.paused, t: v.currentTime }; });
  out.trace.push(await read('after toggle'));
  const end = Date.now() + 60000;
  while (Date.now() < end) { const f = await read('wait'); if (!f.ads && !f.paused && f.t > 5.6) break; await sleep(300); }
  out.trace.push(await read('content playing'));
  await page.mouse.move(2, 2);
  for (let i = 0; i < 8; i++) { await sleep(500); out.trace.push(await read(`away ${i * 0.5 + 0.5}s`)); }
  await page.locator('#player').hover();
  await page.mouse.move(640, 300);
  for (let i = 0; i < 8; i++) { await sleep(250); out.trace.push(await read(`hover ${(i + 1) * 0.25}s`)); }
  await page.mouse.move(700, 320);
  await sleep(600);
  out.trace.push(await read('moved again'));
} catch (e) { out.error = String(e).slice(0, 800); }
out.console = logs;
save('F02/hwc-trace.json', out);
for (const t of out.trace) console.log(JSON.stringify(t));
console.log(out.error ?? '');
await browser.close();
