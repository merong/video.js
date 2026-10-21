// A2-1-QA-DELTA D-MSG: the full [solad] warning text and the example-page notice after the wording change (the value
// moves into parentheses at the end). Loader cases use paste pages; the other-player warning needs `playerType`, so it
// is shown through the native example page (a Video.js preset there) and once through mount() directly. Only
// player-preset is routed, for the 500 cases.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, openPage, placeholder, waitQa, writePaste } from './a2.mjs';
import { BASE } from './lib.mjs';

const NATIVE = 'p-i22c0n5b8p';
const isPreset = (url) => new URL(url).searchParams.get('action') === 'player-preset';
const fail500 = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":{"code":"server_error","message":"QA 500"}}' });
const example = (file, preset) => `${BASE}/examples/${file}?video=a1-qa-video-1&media=mp4&content=${encodeURIComponent(CONTENT)}${preset ? `&preset=${preset}` : ''}`;
const loaderPage = (name, extra) => writePaste(name, `${placeholder({ id: name, 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT, ...extra })}\n${LOADER_TAG}`);
const mountPage = writePaste('msg-mount-videojs', `<div id="m"></div>
<script type="module">
import { mount } from '/player/loader.js';
const el = document.getElementById('m');
mount(el, { videoId: 'a1-qa-video-1', src: '${CONTENT}', preset: '${NATIVE}', playerType: 'videojs', onError: (e) => { window.__qaMountErrors = (window.__qaMountErrors || []).concat({ code: e.code, message: e.message }); } })
  .then((h) => { window.__qaMount = { presetId: h.presetId, fallback: h.fallback, media: h.media.localName }; }, (e) => { window.__qaMount = { error: String(e) }; });
</script>`);

const CASES = {
  'loader-e-404': { url: loaderPage('msg-404', { 'data-preset': 'p-zzzzzzzzzz' }) },
  'loader-500': { url: loaderPage('msg-500', {}), route: fail500 },
  'loader-native-data-preset': { url: loaderPage('msg-native', { 'data-preset': NATIVE }) },
  'mount-playerType-videojs-native-preset': { url: mountPage },
  'example-player-accent': { url: example('player.html', 'accent'), example: true },
  'example-player-site-videojs-preset': { url: example('player.html', 'p-lbelw4d2xx'), example: true },
  'example-videojs-missing': { url: example('videojs.html', 'p-zzzzzzzzzz'), example: true },
  'example-player-missing': { url: example('player.html', 'p-zzzzzzzzzz'), example: true },
  'example-videojs-500': { url: example('videojs.html'), example: true, route: fail500 },
};

const browser = await launch();
const result = {};
for (const [key, c] of Object.entries(CASES)) {
  const context = await newContext(browser);
  const r = { url: c.url.replace(BASE, '') };
  try {
    const routed = [];
    const { page, solad, all } = await openPage(context, 'about:blank', {
      routes: async (p) => {
        if (c.route) await p.route((url) => isPreset(url.href), (route) => { routed.push(route.request().url().replace(/^https?:\/\/[^/]+/, '')); return c.route(route); });
      },
    });
    await page.goto(c.url);
    const s = await waitQa(page, (q) => q.ready.length || q.errors.length, 10000);
    await sleep(2500);
    r.routed = routed;
    r.ready = s.ready;
    r.soladErrors = s.errors;
    r.mount = await page.evaluate(() => ({ result: window.__qaMount ?? null, errors: window.__qaMountErrors ?? null }));
    r.media = await page.evaluate(() => {
      const all = (root) => [...root.querySelectorAll('video, hls-video, video-player, video-skin')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
      return [...new Set(all(document).map((n) => n.localName))];
    });
    if (c.example) {
      r.pageText = (await page.locator('body').innerText()).split('\n').map((l) => l.trim()).filter((l) => /프리셋/.test(l));
    }
    r.soladWarnings = solad.map((l) => `${l.type}: ${l.text}`);
    r.otherConsole = all.filter((l) => ['error', 'warning'].includes(l.type) && !l.text.startsWith('[solad]')).map((l) => `${l.type}: ${l.text}`);
    await shot(page, `D-MSG/${key}.png`, { fullPage: true });
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  result[key] = r;
  await context.close();
}
save('D-MSG/result.json', result);
await browser.close();
