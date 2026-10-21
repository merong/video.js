// A2-D-QA D13 L11 rerun: the legacy static-code pastes (no [data-solad-player]) are clicked on the player itself and the
// ad events are read from the document recorder.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { openPage, waitQa } from './a2.mjs';

const PASTE = 'http://127.0.0.1:18781/__qa/paste';
const browser = await launch();
const result = {};
for (const name of ['a2-1-l11-legacy-videojs', 'a2-1-l11-legacy-native', 'pl16-native-mp4']) {
  const context = await newContext(browser, { height: 1000 });
  const r = {};
  try {
    const { page, solad } = await openPage(context, `${PASTE}/${name}.html`);
    await sleep(3000);
    const target = page.locator('video').first();
    const box = await target.boundingBox();
    r.box = box && { w: Math.round(box.width), h: Math.round(box.height) };
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(1500);
    // As in A2-1 L11: when the click did not start playback, play() is called.
    if (await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.paused))) r.fallbackPlay = await page.evaluate(() => document.querySelector('video').play().then(() => 'played', (e) => String(e)));
    const s = await waitQa(page, (q) => q.ads.some((a) => a.type === 'start'), 20000);
    await sleep(1500);
    r.videos = await page.evaluate(() => { const all = (root) => [...root.querySelectorAll('video')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot))); return all(document).map((v) => `${(v.currentSrc || v.src).split('/').pop()}:${v.paused ? 'paused' : 'playing'}@${v.currentTime.toFixed(1)}`); });
    r.ads = s.ads.map((a) => `${a.type}@${a.contentTime}`).slice(0, 6);
    r.text = await page.evaluate(() => { const out = []; const walk = (root) => { for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) walk(el.shadowRoot); if (!el.children.length && el.textContent.trim() && el.getClientRects().length) out.push(el.textContent.trim()); } }; walk(document); return out.filter((t) => /광고|Ad/.test(t)).slice(0, 6); });
    r.solad = solad.map((l) => l.text);
    await shot(page, `D13/L11-${name}.png`);
  } catch (error) {
    r.error = String(error).slice(0, 600);
  }
  result[name] = r;
  await context.close();
}
save('D13/l11.json', result);
await browser.close();
