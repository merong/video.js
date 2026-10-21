// A2-1-QA L09 follow-up: hover the time slider itself (found through the skin's shadow root) and look for the thumbnail popup.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { openPage, waitQa } from './a2.mjs';

const VTT = `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n/demo-media/ad.png#xywh=0,0,160,90\n\n00:00:05.000 --> 00:00:10.000\n/demo-media/ad.png#xywh=0,0,160,90\n`;
const browser = await launch();
const context = await newContext(browser);
const r = {};
const { page } = await openPage(context, 'about:blank', { routes: async (p) => p.route('**/__qa/thumbs.vtt', (route) => route.fulfill({ status: 200, contentType: 'text/vtt', body: VTT })) });
await page.goto('http://127.0.0.1:18781/__qa/paste/a2-1-l09-a-display-on.html');
await waitQa(page, (q) => q.ready.length, 12000);
await sleep(1500);
const sliders = await page.evaluate(() => {
  const all = (root, sel) => [...root.querySelectorAll(sel)].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot, sel)));
  return all(document, '[role="slider"]').map((el) => { const b = el.getBoundingClientRect(); return { tag: el.tagName, label: el.getAttribute('aria-label'), x: b.x, y: b.y, w: b.width, h: b.height }; });
});
r.sliders = sliders;
const t = sliders.reduce((a, b) => (b.w > a.w ? b : a));
await page.mouse.move(t.x + t.w * 0.2, t.y + t.h / 2, { steps: 5 });
await sleep(300);
await page.mouse.move(t.x + t.w * 0.7, t.y + t.h / 2, { steps: 10 });
await sleep(800);
r.popup = await page.evaluate(() => {
  const all = (root, sel) => [...root.querySelectorAll(sel)].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot, sel)));
  return all(document, 'media-slider-thumbnail, .media-slider-thumbnail-image').map((el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return { tag: el.tagName, w: Math.round(b.width), h: Math.round(b.height), opacity: s.opacity, visibility: s.visibility, src: (el.currentSrc || '').replace(location.origin, ''), complete: el.complete ?? null, natural: el.naturalWidth ?? null }; });
});
await shot(page, 'L09/l09-a-display-on-hover-slider.png');
save('L09/hover-probe.json', r);
await browser.close();
