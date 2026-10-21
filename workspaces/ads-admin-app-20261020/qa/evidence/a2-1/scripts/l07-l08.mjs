// A2-1-QA L07 placeholder errors (skipped with solad-error, nothing shown to visitors, the valid one still plays) and
// L08 late placeholders, data-solad-manual, mount twice on one element and destroy().
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, clickPlay, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const ok = { 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT };
const deepCount = (page) => page.evaluate(() => {
  const all = (root, sel) => [...root.querySelectorAll(sel)].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot, sel)));
  return { videos: all(document, 'video').length, playingVideos: all(document, 'video').filter((v) => !v.paused).length, mediaAds: document.querySelectorAll('media-ads').length, players: document.querySelectorAll('video-player').length };
});

const result = {};
const browser = await launch();

// L07 -----------------------------------------------------------------
{
  const url = writePaste('l07', [
    placeholder({ id: 'no-id', 'data-solad-player': true, 'data-src': CONTENT }),
    placeholder({ id: 'no-src', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1' }),
    placeholder({ id: 'js-src', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': 'javascript:alert(1)' }),
    placeholder({ id: 'relative-src', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': 'demo-media/grok-20261018/content-scene-01.mp4' }),
    placeholder({ id: 'ftp-src', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': 'ftp://example.com/a.mp4' }),
    `<p>QA 본문 문단</p>`,
    placeholder({ id: 'ok', ...ok }),
    LOADER_TAG,
  ].join('\n'));
  const context = await newContext(browser);
  const r = {};
  try {
    const { page, solad, logs } = await openPage(context, url);
    const q = await waitQa(page, (s) => s.ready.length >= 1 && s.errors.length >= 5, 12000);
    await sleep(1000);
    r.errors = q.errors;
    r.ready = q.ready;
    r.placeholders = await page.evaluate(() => [...document.querySelectorAll('[data-solad-player]')].map((el) => ({ id: el.id, children: el.children.length, text: el.innerText.trim().slice(0, 80), height: Math.round(el.getBoundingClientRect().height) })));
    r.bodyText = await page.evaluate(() => document.body.innerText.trim());
    await clickPlay(page, 5);
    const a = await waitQa(page, (s) => s.ads.some((x) => x.type === 'start'), 15000);
    r.okAdEvents = a.ads.map((x) => `${x.target}:${x.type}`);
    r.solad = solad;
    r.nativeDialogs = logs.filter((l) => l.type === 'native-dialog');
    await shot(page, 'L07/page.png', { fullPage: true });
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  result.L07 = r;
  await context.close();
}

if (process.env.ONLY !== 'L07') {
// L08 -----------------------------------------------------------------
{
  const url = writePaste('l08', `${placeholder({ id: 'first', ...ok })}
${placeholder({ id: 'manual', ...ok, 'data-solad-manual': true })}
${LOADER_TAG}
<script type="module">
  import { mount } from '/player/loader.js';
  window.__qaMount = mount;
</script>`);
  const context = await newContext(browser);
  const r = {};
  try {
    const { page, solad } = await openPage(context, url);
    await waitQa(page, (s) => s.ready.length >= 1, 12000);
    await sleep(800);
    r.initial = { ready: (await page.evaluate(() => window.__qa.ready)).map((x) => x.target), manualChildren: await page.locator('#manual').evaluate((el) => el.children.length) };

    // Late placeholders: one nested inside a new wrapper, one manual.
    await page.evaluate(({ CONTENT }) => {
      const wrap = document.createElement('section');
      wrap.innerHTML = `<div id="late" data-solad-player data-video-id="a1-qa-video-2" data-src="${CONTENT}"></div><div id="late-manual" data-solad-player data-solad-manual data-video-id="a1-qa-video-2" data-src="${CONTENT}"></div>`;
      document.body.append(wrap);
    }, { CONTENT });
    await waitQa(page, (s) => s.ready.some((x) => x.target === 'late'), 10000);
    await sleep(800);
    r.late = { ready: (await page.evaluate(() => window.__qa.ready)).map((x) => x.target), lateChildren: await page.locator('#late').evaluate((el) => el.children.length), lateManualChildren: await page.locator('#late-manual').evaluate((el) => el.children.length) };

    // mount twice on the manual element (awaited), then twice without waiting.
    r.twice = await page.evaluate(async () => {
      const el = document.getElementById('manual');
      const h1 = await window.__qaMount(el);
      const firstPlayer = h1.player;
      const h2 = await window.__qaMount(el);
      return { children: el.children.length, i18n: el.querySelectorAll('media-i18n').length, firstPlayerConnected: firstPlayer.isConnected, secondPlayerConnected: h2.player.isConnected, same: firstPlayer === h2.player };
    });
    r.concurrent = await page.evaluate(async () => {
      const el = document.getElementById('late-manual');
      const p1 = window.__qaMount(el);
      const p2 = window.__qaMount(el);
      const [s1, s2] = await Promise.allSettled([p1, p2]);
      return { first: s1.status === 'rejected' ? `rejected ${s1.reason?.name}` : 'fulfilled', second: s2.status, children: el.children.length, i18n: el.querySelectorAll('media-i18n').length };
    });
    r.countsBeforeDestroy = await deepCount(page);

    // destroy() during an ad: start the manual player's pre-roll, then destroy it.
    await page.evaluate(async () => {
      const el = document.getElementById('manual');
      window.__qaHandle = await window.__qaMount(el, { onEvent: (e) => (window.__qaManualEvents ??= []).push(e.type) });
    });
    await sleep(800);
    await page.locator('#manual').scrollIntoViewIfNeeded();
    const box = await page.locator('#manual').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitQa(page, (s) => s.ads.some((x) => x.target === 'manual' && x.type === 'start'), 15000);
    await sleep(1000);
    r.duringAd = { counts: await deepCount(page), manualEvents: await page.evaluate(() => window.__qaManualEvents) };
    await shot(page, 'L08/before-destroy.png', { fullPage: true });
    const adsBefore = (await page.evaluate(() => window.__qa.ads)).length;
    await page.evaluate(() => window.__qaHandle.destroy());
    await sleep(4000);
    r.afterDestroy = {
      manualChildren: await page.locator('#manual').evaluate((el) => el.children.length),
      counts: await deepCount(page),
      adEventsAfter: (await page.evaluate(() => window.__qa.ads)).slice(adsBefore).map((x) => `${x.target}:${x.type}`),
      manualEventsAfter: await page.evaluate(() => window.__qaManualEvents),
      destroyAgain: await page.evaluate(() => { try { window.__qaHandle.destroy(); return 'ok'; } catch (e) { return String(e); } }),
    };
    await shot(page, 'L08/after-destroy.png', { fullPage: true });
    r.solad = solad;
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  result.L08 = r;
  await context.close();
}
}
save(process.env.ONLY === 'L07' ? 'L07-L08/result-L07-rerun.json' : 'L07-L08/result.json', result);
await browser.close();
