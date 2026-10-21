// A2-1-QA L04 autoplay (allowed, and blocked with --autoplay-policy=document-user-activation-required) and L05 data-*
// and mount() overrides precedence. Presets: A = autoplay only (muted empty), B = autoplay + muted (see presets/).
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';
import { createRequire } from 'node:module';

const A = 'p-aiw4nv0npm';
const B = 'p-tbxfsls2it';
const base = { 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT };
const mountPage = (name, attrs, options) =>
  writePaste(name, `${placeholder({ id: 'm', ...base, 'data-solad-manual': true, ...attrs })}
<script type="module">
  import { mount } from '/player/loader.js';
  window.__mount = { errors: [], handle: null, threw: null };
  const options = ${options};
  try {
    const handle = await mount(document.getElementById('m'), { ...options, onError: (e) => window.__mount.errors.push(e) });
    window.__mount.handle = { presetId: handle.presetId, fallback: handle.fallback, player: handle.player?.tagName };
  } catch (error) {
    window.__mount.threw = String(error);
  }
</script>`);

const PAGES = {
  'L04-autoplay': { url: writePaste('l04', `${placeholder({ ...base, 'data-preset': A })}\n${LOADER_TAG}`) },
  'L05-a-preset-autoplay+data-autoplay-false': { url: writePaste('l05-a', `${placeholder({ ...base, 'data-preset': A, 'data-autoplay': 'false' })}\n${LOADER_TAG}`) },
  'L05-b-preset-autoplay-muted+data-autoplay-false': { url: writePaste('l05-b', `${placeholder({ ...base, 'data-preset': B, 'data-autoplay': 'false' })}\n${LOADER_TAG}`) },
  'L05-c-preset-autoplay+data-muted-false': { url: writePaste('l05-c', `${placeholder({ ...base, 'data-preset': A, 'data-muted': 'false' })}\n${LOADER_TAG}`) },
  'L05-d-overrides-beat-data': { url: mountPage('l05-d', { 'data-autoplay': 'false', 'data-loop': 'false', 'data-preload': 'none' }, `{ overrides: { playback: { autoplay: true, loop: true, preload: 'auto' } } }`), mount: true },
  'L05-e-bad-overrides-dropped': { url: mountPage('l05-e', { 'data-preload': 'none' }, `{ overrides: { playback: { loop: true, autoplay: 'yes' } } }`), mount: true },
  'L05-e2-overrides-with-id': { url: mountPage('l05-e2', {}, `{ overrides: { id: 'accent', playback: { loop: true } } }`), mount: true },
  'L05-f-one-bad-data-attr': { url: writePaste('l05-f', `${placeholder({ ...base, 'data-preload': 'bogus', 'data-loop': 'true', 'data-muted': 'yes' })}\n${LOADER_TAG}`) },
};

// Every <video> in the page including the ad's, through shadow roots.
const videos = (page) => page.evaluate(() => {
  const all = (root) => [...root.querySelectorAll('video')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
  return all(document).map((v) => ({ src: (v.currentSrc || v.getAttribute('src') || '').replace(location.origin, ''), muted: v.muted, paused: v.paused, t: Math.round(v.currentTime * 10) / 10, autoplay: v.autoplay }));
});

async function visit(context, key, c, { wait = 8000 } = {}) {
  const r = {};
  const { page, solad, all } = await openPage(context, c.url);
  const s = await waitQa(page, (q) => q.ready.length || q.errors.length, 12000);
  r.ready = s.ready;
  // No click: anything that plays here started by itself.
  await sleep(wait);
  const q = await page.evaluate(() => window.__qa);
  r.adEvents = q.ads.map((a) => `${a.type}@${a.contentTime}`);
  const p = (await players(page))[0];
  r.media = p.media;
  r.videos = await videos(page);
  r.visibleText = p.visibleText.filter((t) => !t.startsWith('@'));
  r.buttons = p.buttonLabels;
  if (c.mount) r.mount = await page.evaluate(() => window.__mount);
  r.solad = solad;
  r.console = all.filter((l) => ['error', 'warning'].includes(l.type) && !/favicon/.test(l.text));
  await shot(page, `L04-L05/${key}.png`);
  r.page = page;
  return r;
}

const result = {};
const browser = await launch();
for (const [key, c] of Object.entries(PAGES)) {
  const context = await newContext(browser);
  try {
    const r = await visit(context, key, c);
    delete r.page;
    result[key] = r;
  } catch (error) {
    result[key] = { error: String(error).slice(0, 1200) };
  }
  await context.close();
}
await browser.close();

// L04 blocked: a separate Chrome whose autoplay policy needs a user activation.
const require = createRequire('/Users/brian/works/tools/videojs/video.js/apps/e2e/package.json');
const { chromium } = require('@playwright/test');
const blocked = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=HardwareMediaKeyHandling,GlobalMediaControls', '--autoplay-policy=document-user-activation-required'] });
{
  const context = await blocked.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const r = await visit(context, 'L04-autoplay-blocked', PAGES['L04-autoplay'], { wait: 8000 });
    const page = r.page;
    delete r.page;
    r.playButtonVisible = await page.evaluate(() => {
      const all = (root) => [...root.querySelectorAll('button')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
      return all(document).filter((b) => {
        const rect = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        return rect.width > 0 && rect.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
      }).map((b) => ({ label: b.getAttribute('aria-label') || b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), opacity: getComputedStyle(b).opacity })).filter((b) => /재생|계속/.test(b.label));
    });
    await shot(page, 'L04-L05/L04-autoplay-blocked-full.png', { fullPage: true });
    // A click after the block should start the ad.
    const box = await page.locator('[data-solad-player]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(3000);
    r.afterClick = { adEvents: (await page.evaluate(() => window.__qa.ads)).map((a) => `${a.type}@${a.contentTime}`), videos: await videos(page) };
    await shot(page, 'L04-L05/L04-autoplay-blocked-after-click.png');
    result['L04-autoplay-blocked'] = r;
  } catch (error) {
    result['L04-autoplay-blocked'] = { error: String(error).slice(0, 1200) };
  }
  result.blockedBrowserVersion = blocked.version();
}
await blocked.close();
save('L04-L05/result.json', result);
