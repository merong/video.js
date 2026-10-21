// A2-D-QA D03 demo options (signed out, site preset = QA 강조색 복제): each change is read back from the player, the
// query, the reset line and the code. Then the address is opened in a new tab and compared. The thumbnails VTT is
// served by a Playwright route (the server has no VTT); nothing is saved.
import { launch, newContext, consoleCollector, save, shot, sleep } from './lib.mjs';
import { demoState, openDemo, player, requestLog, waitPlayer } from './demo.mjs';

const VTT = '/demo-media/qa-a2d-thumbs.vtt';
const browser = await launch();
const result = { steps: [] };
const look = (p) => p && { tree: p.tree, lang: p.i18nLang, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, media: p.media && { tag: p.media.tag, src: p.media.src, preload: p.media.preload, autoplay: p.media.autoplayAttr, muted: p.media.mutedProp, loop: p.media.loop, paused: p.media.paused, tracks: p.media.tracks }, contentTitle: p.playerAttrs?.contentTitle, poster: p.playerAttrs?.poster, ads: p.ads?.attrs, buttons: p.buttonLabels?.slice(0, 12), text: p.visibleText?.filter((t) => !t.startsWith('@')).slice(0, 14) };

const context = await newContext(browser, { width: 1280, height: 1100 });
await context.route((url) => url.pathname === VTT, (route) => route.fulfill({ status: 200, contentType: 'text/vtt', body: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n/demo-media/ad.png#xywh=0,0,160,90\n\n00:00:05.000 --> 00:00:10.000\n/demo-media/ad.png#xywh=0,0,160,90\n' }));
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const toggle = (key) => page.locator(`button.sa-toggle[data-key="${key}"]`);

async function step(label, act, { wait = 2200, extra } = {}) {
  await act();
  await sleep(400);
  await waitPlayer(page);
  await sleep(wait);
  const s = await demoState(page);
  const r = { label, query: s.query, reset: s.reset, toggles: s.toggles, preload: s.preload, lang: s.lang, pageLang: s.pageLang, pageLangShown: s.pageLangShown, media: s.media, engine: s.engine, engineShown: s.engineShown, posterHelp: s.posterHelp, vttHelp: s.vttHelp, status: s.stageStatus, now: s.now, codeHtml: s.codeHtml, player: look(await player(page)) };
  if (extra) r.extra = await extra();
  result.steps.push(r);
  await shot(page, `D03/${String(result.steps.length).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`);
  return r;
}

async function clickPlayer() {
  const box = await page.locator('#player').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

try {
  await openDemo(page);
  await step('start', async () => {});
  await step('autoplay-on', () => toggle('autoplay').click(), { wait: 4000 });
  await step('autoplay-off', () => toggle('autoplay').click());
  await step('muted-on', () => toggle('muted').click());
  await step('loop-on', () => toggle('loop').click());
  await step('preload-none', () => page.locator('input[name="preload"][value="none"]').check());
  await step('preload-auto', () => page.locator('input[name="preload"][value="auto"]').check());
  await step('lang-ja', () => page.locator('#lang').selectOption('ja'));
  await step('lang-ja-ad', async () => { await clickPlayer(); }, { wait: 4500 });
  await step('lang-empty-page-en', async () => { await page.locator('#lang').selectOption(''); await sleep(1500); await page.locator('#page-lang').selectOption('en'); });
  await step('page-fr', () => page.locator('#page-lang').selectOption('fr'));
  await step('page-ja', () => page.locator('#page-lang').selectOption('ja'));
  await step('poster-url', async () => { await page.locator('#poster-url').fill('/demo-media/ad.png'); await page.locator('#poster-url').press('Tab'); });
  await step('poster-off', () => page.locator('#poster').uncheck());
  await step('poster-bad-url', async () => { await page.locator('#poster-url').fill('poster.png'); await page.locator('#poster-url').press('Tab'); });
  await step('poster-on', async () => { await page.locator('#poster-url').fill('/demo-media/ad.png'); await page.locator('#poster-url').press('Tab'); await page.locator('#poster').check(); });
  await step('title-text', async () => { await page.locator('#title-text').fill('QA 데모 제목'); await page.locator('#title-text').press('Tab'); });
  await step('title-off', () => page.locator('#title').uncheck());
  await step('title-on', () => page.locator('#title').check());
  await step('thumbnails', async () => { await page.locator('#vtt').fill(VTT); await page.locator('#vtt').press('Tab'); }, {
    extra: async () => {
      // Hover the time slider so the thumbnail popup shows.
      const slider = page.locator('#player').locator('[role="slider"]').first();
      const box = await slider.boundingBox().catch(() => null);
      if (box) await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
      await sleep(800);
      await shot(page, 'D03/thumbnail-hover.png');
      return page.evaluate(() => {
        const deep = (root, sel) => [...root.querySelectorAll(sel)].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => deep(n.shadowRoot, sel)));
        return { thumbs: deep(document.querySelector('#player'), 'img, [class*="thumbnail"]').map((n) => ({ tag: n.tagName, cls: String(n.className).slice(0, 40), src: (n.getAttribute('src') || '').replace(location.origin, ''), w: Math.round(n.getBoundingClientRect().width) })).slice(0, 6) };
      });
    },
  });
  await step('media-hls', () => page.locator('input[name="media"][value="hls"]').check(), { wait: 3500 });
  await step('engine-hlsjs', () => page.locator('input[name="engine"][value="hlsjs"]').check(), { wait: 3500 });

  // Address state: open the same query in a new tab and compare.
  const before = await demoState(page);
  const beforePlayer = look(await player(page));
  const tab = await context.newPage();
  await openDemo(tab, before.query);
  await sleep(1500);
  const after = await demoState(tab);
  const afterPlayer = look(await player(tab));
  const pick = (s) => ({ query: s.query, preset: s.preset.value, toggles: Object.fromEntries(Object.entries(s.toggles).map(([k, v]) => [k, `${v.checked}${v.disabled ? '/locked' : ''}`])), preload: s.preload, lang: s.lang, pageLang: s.pageLang, poster: s.poster, posterUrl: s.posterUrl, title: s.title, titleText: s.titleText, vtt: s.vtt, media: s.media, engine: s.engine, reset: s.reset.text, codeHtml: s.codeHtml });
  const strip = (p) => ({ ...p, media: p?.media && { ...p.media, paused: undefined }, text: undefined, buttons: undefined });
  result.address = { before: pick(before), after: pick(after), sameState: JSON.stringify(pick(before)) === JSON.stringify(pick(after)), samePlayer: JSON.stringify(strip(beforePlayer)) === JSON.stringify(strip(afterPlayer)), beforePlayer: strip(beforePlayer), afterPlayer: strip(afterPlayer) };
  await shot(tab, 'D03/address-new-tab.png', { fullPage: true });
  await tab.close();

  await step('reset', () => page.locator('#reset').click());
  result.resetFocus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D03/error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions();
result.events = req.events();
result.console = logs;
await context.close();
save('D03/result.json', result);
await browser.close();
