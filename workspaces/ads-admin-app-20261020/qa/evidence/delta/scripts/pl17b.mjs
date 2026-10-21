// PL17 (1) follow-up: overlay text inside the player only, event requests by any transport, console error locations.
import { BASE, EV, launch, newContext, save, sleep } from './lib.mjs';
const Q = 'video=a1-qa-preset-1&media=mp4&content=/demo-media/grok-20261018/content-scene-01.mp4';
const browser = await launch();
const context = await newContext(browser, { height: 900 });
const page = await context.newPage();
const out = { texts: [], events: [], console: [] };
context.on('request', (req) => { if (/action=events/.test(req.url())) out.events.push({ method: req.method(), type: req.resourceType() }); });
context.on('response', (res) => { if (/action=events/.test(res.url())) out.events.push({ status: res.status() }); });
page.on('console', (m) => { if (m.type() === 'error') out.console.push({ text: m.text().slice(0, 160), url: m.location().url }); });
await page.goto(`${BASE}/examples/videojs.html?${Q}&preset=p-vym1rjw052`);
await sleep(2500);
const box = await page.locator('video').first().boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
const seen = new Set();
for (let i = 0; i < 70; i++) {
  const t = await page.evaluate(() => {
    const skin = document.querySelector('video-neutral-skin');
    const walk = (root) => {
      const out = [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const p = n.parentElement;
        if (p && !['STYLE', 'SCRIPT'].includes(p.tagName) && n.textContent.trim() && p.getClientRects().length) out.push(n.textContent.trim());
      }
      for (const h of root.querySelectorAll('*')) if (h.shadowRoot) out.push(...walk(h.shadowRoot));
      return out;
    };
    void skin;
    return walk(document.body).filter((s) => /Skip|Advertisement|Visit|광고|건너/.test(s)).join(' | ');
  });
  const norm = t.replace(/\d+/g, '#');
  if (!seen.has(norm)) {
    seen.add(norm);
    out.texts.push(t);
    if (/Skip ad/.test(t) && !out.skipShot) {
      out.skipShot = true;
      await page.locator('video-neutral-skin').screenshot({ path: `${EV}/PL17/PL17-1-skip-ad.png` });
    }
  }
  await sleep(400);
}
save('PL17/followup-videojs-PA.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
await browser.close();
