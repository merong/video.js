// A2-1-QA L09 poster, title and thumbnails. The thumbnails VTT is served by a Playwright route at /__qa/thumbs.vtt
// (the QA router serves only .html), pointing at /demo-media/ad.png tiles with #xywh.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const DISPLAY_ON = 'p-vhpyxtqv36';
const DISPLAY_OFF = 'p-5opxze3ep0';
const NATIVE = 'p-dz06hj5w17';
const POSTER = '/demo-media/ad.png';
const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
/demo-media/ad.png#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
/demo-media/ad.png#xywh=0,0,160,90
`;
const attrs = { 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT, 'data-poster': POSTER, 'data-title': 'QA 제목 표시', 'data-thumbnails': '/__qa/thumbs.vtt' };

const CASES = {
  'a-display-on': { preset: DISPLAY_ON },
  'b-display-off': { preset: DISPLAY_OFF },
  'c-native': { preset: NATIVE },
  'd-bad-poster': { preset: DISPLAY_ON, extra: { 'data-poster': 'javascript:alert(1)', 'data-thumbnails': 'ftp://example.com/t.vtt' } },
};

const deep = (page) => page.evaluate(() => {
  const all = (root, sel) => [...root.querySelectorAll(sel)].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot, sel)));
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
  const video = document.querySelector('[data-solad-player] video');
  return {
    videoPoster: video?.getAttribute('poster') ?? null,
    tracks: video ? [...video.textTracks].map((t) => ({ kind: t.kind, label: t.label, mode: t.mode, cues: t.cues?.length ?? null })) : [],
    trackEls: video ? [...video.querySelectorAll('track')].map((t) => ({ src: t.getAttribute('src'), readyState: t.readyState })) : [],
    posterImgs: all(document, 'img, media-poster').filter((el) => /ad\.png/.test(el.getAttribute('src') || el.currentSrc || '') || el.tagName === 'MEDIA-POSTER').map((el) => ({ tag: el.tagName, cls: el.className?.baseVal ?? el.className, visible: visible(el), src: (el.currentSrc || el.getAttribute('src') || '').replace(location.origin, '') })),
    thumbnails: all(document, '[class*="thumbnail"], media-slider-thumbnail').map((el) => ({ tag: el.tagName, cls: String(el.className?.baseVal ?? el.className).slice(0, 60), visible: visible(el), bg: getComputedStyle(el).backgroundImage.replace(location.origin, '').slice(0, 80) })),
    titleText: all(document, '*').filter((el) => el.children.length === 0 && /QA 제목 표시/.test(el.textContent)).map((el) => ({ tag: el.tagName, visible: visible(el) })),
  };
});

const browser = await launch();
const result = {};
for (const [key, c] of Object.entries(CASES)) {
  const name = `l09-${key}`;
  const url = writePaste(name, `${placeholder({ ...attrs, 'data-preset': c.preset, ...c.extra })}\n${LOADER_TAG}`);
  const context = await newContext(browser);
  const vttRequests = [];
  const r = {};
  try {
    const { page, solad } = await openPage(context, 'about:blank', {
      routes: async (p) => p.route('**/__qa/thumbs.vtt', (route) => { vttRequests.push(route.request().url().replace(/^https?:\/\/[^/]+/, '')); return route.fulfill({ status: 200, contentType: 'text/vtt', body: VTT }); }),
    });
    await page.goto(url);
    r.ready = (await waitQa(page, (q) => q.ready.length || q.errors.length, 12000)).ready;
    await sleep(1500);
    const p = (await players(page))[0];
    r.playerAttrs = p.playerAttrs;
    r.tree = p.tree;
    r.before = await deep(page);
    await shot(page, `L09/${name}-poster.png`);
    // Hover the time slider to ask for a thumbnail.
    const slider = page.locator('[data-solad-player]').locator('media-time-slider, [role="slider"]').first();
    const sliderCount = await slider.count();
    if (sliderCount) {
      const ph = await page.locator('[data-solad-player]').boundingBox();
      await page.mouse.move(ph.x + ph.width / 2, ph.y + ph.height / 2);
      await sleep(400);
      const box = await slider.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
        await sleep(400);
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
        await sleep(800);
      }
      r.hover = await deep(page);
      await shot(page, `L09/${name}-hover.png`);
    }
    r.sliderFound = sliderCount;
    r.vttRequests = vttRequests;
    r.solad = solad;
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  result[key] = r;
  await context.close();
}
save('L09/result.json', result);
await browser.close();
