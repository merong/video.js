// A2-D-QA D13 short loader regression of A2-1 L01–L11 on this QA DB (site preset p-i0aecb28w3 QA 강조색 복제,
// autoplay preset p-lc3i8eidb4, native preset p-pchm59hhyv). New pastes go to qa/fixtures/paste/a2d-r-*.html; A2-1
// pastes without old preset ids (l07, l08, l11 legacy, pl16) are reopened unchanged. L10 (v1 document migration by DB
// UPDATE) is not rerun. Nothing is saved or applied in the admin.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, cdpNetwork, clickPlay, openPage, placeholder, players, qaState, waitQa, writePaste } from './a2.mjs';

const SITE = 'p-i0aecb28w3';
const AUTOPLAY = 'p-lc3i8eidb4';
const NATIVE = 'p-pchm59hhyv';
const PASTE = 'http://127.0.0.1:18781/__qa/paste';
const browser = await launch();
const result = {};
const slot = (attrs) => placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT, ...attrs });
const brief = (p) => p && { tree: p.tree, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, lang: p.ads?.lang, title: p.playerAttrs?.contentTitle, poster: p.playerAttrs?.poster ?? p.media?.poster, media: p.media && { autoplay: p.media.autoplayAttr, muted: p.media.mutedProp, loop: p.media.loop, preload: p.media.preload, paused: p.media.paused } };

async function run(key, url, { click = true, routes, wait = 20000, after } = {}) {
  const context = await newContext(browser, { height: 1000 });
  const r = {};
  try {
    const { page, solad } = await openPage(context, url, { routes });
    const s = await waitQa(page, (q) => q.ready.length || q.errors.length, 15000);
    await sleep(1200);
    r.ready = s.ready;
    r.errors = s.errors;
    r.players = (await players(page)).map(brief);
    if (click === 'none') {
      await sleep(6000);
      r.adsWithoutClick = (await qaState(page)).ads.map((a) => `${a.type}@${a.contentTime}`);
    } else if (click) {
      await clickPlay(page, 0);
    }
    if (click !== 'none') {
      const ad = await waitQa(page, (q) => q.ads.some((a) => a.type === 'start'), wait);
      await sleep(1200);
      r.ads = ad.ads.map((a) => `${a.target}:${a.type}@${a.contentTime}`).slice(0, 8);
      r.adMuted = await page.evaluate(() => [...document.querySelectorAll('video')].map((v) => `${v.id || v.src.split('/').pop()}:${v.muted}`));
    }
    if (after) r.after = await after(page);
    r.solad = solad.map((l) => `${l.type}: ${l.text}`);
    await shot(page, `D13/${key}.png`);
  } catch (error) {
    r.error = String(error).slice(0, 800);
  }
  await context.close();
  result[key] = r;
}

// L01 + L02: site preset; then unchanged reloads revalidate to 304.
{
  const url = writePaste('r-l01', `${slot({})}\n${LOADER_TAG}`);
  await run('L01', url);
  const context = await newContext(browser);
  const { page } = await openPage(context, 'about:blank');
  const net = await cdpNetwork(page);
  await page.goto(url);
  await waitQa(page, (q) => q.ready.length, 15000);
  const first = net.presets().length;
  for (const n of [1, 2]) {
    await page.reload();
    await waitQa(page, (q) => q.ready.length, 15000);
    await sleep(800);
  }
  result.L02 = { first: net.presets().slice(0, first), reloads: net.presets().slice(first), fill: (await players(page))[0]?.skin?.fillBefore };
  await context.close();
}

// L03: player-preset 500 and a 4 s delay fall back to defaults; the schedule is not intercepted.
const url01 = `${PASTE}/a2d-r-l01.html`;
await run('L03-500', url01, { routes: (p) => p.route(/action=player-preset/, (r) => r.fulfill({ status: 500, body: '{}' })) });
await run('L03-delay', url01, { routes: (p) => p.route(/action=player-preset/, async (r) => { await sleep(4000); r.continue(); }) });

// L04: autoplay preset starts the pre-roll without a click, muted.
await run('L04', writePaste('r-l04', `${slot({ 'data-preset': AUTOPLAY })}\n${LOADER_TAG}`), { click: false });
// L05: data-autoplay=false turns it off; data-muted=false on autoplay forces muted with a warning; overrides beat data-*.
await run('L05-off', writePaste('r-l05-off', `${slot({ 'data-preset': AUTOPLAY, 'data-autoplay': 'false' })}\n${LOADER_TAG}`), { click: 'none' });
await run('L05-muted', writePaste('r-l05-muted', `${slot({ 'data-preset': AUTOPLAY, 'data-muted': 'false' })}\n${LOADER_TAG}`), { click: false });
await run('L05-overrides', `${PASTE}/a2-1-l05-d.html`, { click: false, after: (p) => p.evaluate(() => window.__mount) });
// L06: empty-language site preset on an English page, and the native preset.
await run('L06-page-en', writePaste('r-l06-en', `${slot({})}\n${LOADER_TAG}`, { lang: 'en' }), { click: true });
await run('L06-native', writePaste('r-l06-native', `${slot({ 'data-preset': NATIVE })}\n${LOADER_TAG}`, { lang: 'en' }), { click: true });
// L07: invalid placeholders stay empty, the valid one plays.
await run('L07', `${PASTE}/a2-1-l07.html`, { click: false, wait: 3000, after: (p) => p.evaluate(() => [...document.querySelectorAll('[data-solad-player]')].map((el) => `${el.id}:children=${el.children.length}:h=${Math.round(el.getBoundingClientRect().height)}`)) });
// L08: manual placeholder skipped; mount twice keeps one player; destroy empties the slot.
await run('L08', `${PASTE}/a2-1-l08.html`, {
  click: false, wait: 2000,
  after: (p) => p.evaluate(async () => {
    const manual = document.getElementById('manual');
    const before = manual.children.length;
    const a = await window.__qaMount(manual);
    const b = await window.__qaMount(manual);
    const twice = manual.children.length;
    b.destroy();
    let again = 'ok';
    try { b.destroy(); } catch (e) { again = String(e); }
    return { manualBefore: before, afterTwoMounts: twice, afterDestroy: manual.children.length, destroyAgain: again, first: document.getElementById('first').children.length, aDetached: !a.player?.isConnected };
  }),
});
// L09: poster and title from data-* (shown only when the preset's display options are on).
await run('L09-site', writePaste('r-l09', `${slot({ 'data-poster': '/demo-media/ad.png', 'data-title': 'QA 제목 표시' })}\n${LOADER_TAG}`), { click: false, wait: 1000 });
await run('L09-native', writePaste('r-l09-native', `${slot({ 'data-preset': NATIVE, 'data-poster': '/demo-media/ad.png' })}\n${LOADER_TAG}`), { click: false, wait: 1000 });
// L11: A1/A2-1 legacy static code and the pl16 native paste still play ads.
await run('L11-legacy-videojs', `${PASTE}/a2-1-l11-legacy-videojs.html`);
await run('L11-legacy-native', `${PASTE}/a2-1-l11-legacy-native.html`);
await run('L11-pl16-native', `${PASTE}/pl16-native-mp4.html`);

save('D13/regress.json', result);
await browser.close();
