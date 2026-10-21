// A2-E-QA E04 extra: a frame with the sample cue shown (captions turned on with c after the scene shortcut), and the
// URL of each console 404 (location), at 1280.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';
import { openDemo } from './demo.mjs';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
const notFound = [];
page.on('console', (m) => { if (m.type() === 'error') notFound.push(`${m.text().slice(0, 100)} @${(m.location()?.url ?? '').replace(BASE, '')}`); });
const out = {};
await login(page);
await openDemo(page, '?captionsUrl=%2Fexamples%2Fsample-captions.vtt');
await page.locator('[data-scene="before-midroll"]').click();
const end = Date.now() + 25000;
while (Date.now() < end && (await page.evaluate(() => document.querySelector('#player video')?.currentTime ?? 0)) < 3.4) await sleep(100);
await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button').focus());
await page.keyboard.press('c');
await page.evaluate(() => document.querySelector('#player video').pause());
await sleep(800);
out.track = await page.evaluate(() => { const t = document.querySelector('#player video').textTracks[0]; return { mode: t.mode, cue: t.activeCues?.[0]?.text ?? null, time: document.querySelector('#player video').currentTime }; });
out.button = await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('media-captions-button').getAttribute('aria-label'));
await shot(page, 'E04/sample-cue-shown-1280.png', { clip: await page.locator('#stage-view').boundingBox() });
out.console = notFound;
save('E04/cue.json', out);
console.log(JSON.stringify(out));
await browser.close();
