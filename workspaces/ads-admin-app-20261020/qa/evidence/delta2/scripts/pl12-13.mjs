// PL12: unsaved values reach the preview without reloading its document; only skin/type reload it; CSS vars reach shadow tree and ad panel.
// PL13: full preview playback (pre, mid, post, content end) makes zero /api requests in admin page and iframe.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep } from './lib.mjs';
import { gotoList, presetForm, fill } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
await context.addInitScript(() => {
  if (window.top !== window) return;
  window.__qaMsgs = [];
  window.addEventListener('message', (e) => window.__qaMsgs.push({ t: Date.now(), type: e.data?.type ?? null, status: e.data?.status ?? null, message: e.data?.message ?? null }));
});
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { PL12: { steps: [] }, PL13: {} };
const previewDocs = () => net.filter((e) => /player-preview\.html/.test(e.url) && e.type === 'document').map((e) => `${e.t} ${e.url.replace(BASE, '')}`);
const frame = () => page.frames().find((f) => /player-preview/.test(f.url()));
const iframe = () => page.frameLocator('iframe[title="플레이어 테마 미리보기"]');

const measure = () => frame().evaluate(() => {
  const deep = (pred) => {
    let hit = null;
    const scan = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (hit) return;
        if (pred(el)) hit = el;
        else if (el.shadowRoot) scan(el.shadowRoot);
      }
    };
    scan(document);
    return hit;
  };
  const vars = (el, names) => el && Object.fromEntries(names.map((n) => [n, getComputedStyle(el).getPropertyValue(n).trim()]));
  const names = ['--media-accent-color', '--media-accent-text-color', '--media-border-radius', '--media-font-family', '--ads-font-size', '--ads-accent-color', '--ads-skip-radius'];
  const styled = document.querySelector('video-neutral-skin, video-skin');
  const container = deep((el) => el.tagName === 'MEDIA-CONTAINER');
  const panel = deep((el) => el.getAttribute?.('part') === 'panel');
  const host = panel?.getRootNode()?.host ?? null;
  const texts = [];
  if (panel) {
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (!el.children.length && el.textContent.trim()) texts.push(el.textContent.trim().slice(0, 50));
        if (el.getAttribute('aria-label')) texts.push(`[aria] ${el.getAttribute('aria-label')}`);
      }
    };
    walk(panel);
  }
  const videos = [];
  const collect = (root) => {
    for (const v of root.querySelectorAll('video')) videos.push({ src: (v.currentSrc || v.src).split('/').pop(), t: Math.round(v.currentTime * 10) / 10, paused: v.paused, ended: v.ended });
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) collect(el.shadowRoot);
  };
  collect(document);
  const ads = document.querySelector('media-ads');
  const cs = (el) => el && { fontFamily: getComputedStyle(el).fontFamily, fontSize: getComputedStyle(el).fontSize, borderRadius: getComputedStyle(el).borderRadius };
  return {
    skinTag: styled?.tagName.toLowerCase() ?? null,
    skinStyle: styled?.getAttribute('style') ?? null,
    adsAttrs: ads ? Object.fromEntries([...ads.attributes].map((a) => [a.name, a.value.slice(0, 60)])) : null,
    containerVars: vars(container, names),
    containerBox: cs(container),
    panelHostVars: vars(host, names),
    panelVars: vars(panel, names),
    panelBox: cs(panel),
    panelTexts: texts,
    lang: document.documentElement.lang,
    videos,
  };
});

try {
  await login(page);
  await gotoList(page);
  await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(3000);
  const docsAtOpen = previewDocs();
  const t0 = Date.now();
  await iframe().locator('media-play-button').click();
  await sleep(7500);
  result.PL12.steps.push({ label: 'baseline (earbuds preroll)', docs: previewDocs().length, m: await measure() });
  await page.locator('iframe[title="플레이어 테마 미리보기"]').screenshot({ path: `${EV}/PL12/1-baseline.png` });
  for (const [label, values] of [
    ['accent #c2185b', { 강조색: '#c2185b' }],
    ['radius 20', { '모서리 둥글기 (px)': '20' }],
    ['ads.locale ko', { '광고 문구 언어': '한국어' }],
    ['skip label', { '건너뛰기 문구': '광고 넘기기' }],
    ['fontFamily system', { 글꼴: '시스템 글꼴' }],
  ]) {
    await fill(page, values);
    await sleep(700);
    result.PL12.steps.push({ label, docs: previewDocs().length, m: await measure() });
  }
  await page.locator('iframe[title="플레이어 테마 미리보기"]').screenshot({ path: `${EV}/PL12/2-after-unsaved-changes.png` });
  await fill(page, { 글꼴: '스킨 기본 (Inter 우선)' });
  await sleep(700);
  result.PL12.steps.push({ label: 'fontFamily skin default (U-P5 compare)', docs: previewDocs().length, m: await measure() });
  await fill(page, { 글꼴: '시스템 글꼴' });
  await sleep(500);
  result.PL12.playedSecondsBeforeSkin = Math.round((Date.now() - t0) / 1000);
  await fill(page, { 스킨: '기본 (모서리 28px)' });
  await sleep(3500);
  result.PL12.steps.push({ label: 'skin → default', docs: previewDocs().length, m: await measure() });
  await fill(page, { 스킨: '뉴트럴 (모서리 12px)' });
  await sleep(3500);
  result.PL12.steps.push({ label: 'skin → neutral', docs: previewDocs().length, m: await measure() });
  result.PL12.previewDocs = previewDocs();
  result.PL12.docsAtOpen = docsAtOpen;
  result.PL12.messages = await page.evaluate(() => window.__qaMsgs);

  // PL13 ------------------------------------------------------------
  const start = net.length ? net[net.length - 1].t + 1 : 0;
  const m0 = await page.evaluate(() => window.__qaMsgs.length);
  await iframe().locator('media-play-button').click();
  const timeline = [];
  for (let i = 0; i < 75; i++) {
    await sleep(1000);
    const m = await measure();
    const playing = m.videos.filter((v) => !v.paused).map((v) => `${v.src}@${v.t}`);
    timeline.push(`${i + 1}s ${playing.join(',') || 'none playing'} | ${m.videos.find((v) => /content/.test(v.src))?.t ?? '?'}${m.videos.find((v) => /content/.test(v.src))?.ended ? ' ended' : ''}`);
    if ([3, 20, 26].includes(i)) await page.locator('iframe[title="플레이어 테마 미리보기"]').screenshot({ path: `${EV}/PL13/play-${i + 1}s.png` }).catch(() => {});
    const content = m.videos.find((v) => /content/.test(v.src));
    if (content?.ended && !m.videos.some((v) => /ad-/.test(v.src) && !v.paused) && i > 30) {
      await sleep(2000);
      break;
    }
  }
  await page.locator('iframe[title="플레이어 테마 미리보기"]').screenshot({ path: `${EV}/PL13/end.png` }).catch(() => {});
  const during = net.filter((e) => e.t >= start);
  result.PL13 = {
    timeline,
    apiRequests: during.filter((e) => /\/api\//.test(e.url)).map((e) => `${e.method} ${e.url.replace(BASE, '')} frame=${e.frame?.replace(BASE, '')}`),
    requests: during.map((e) => `${e.method} ${e.status ?? e.failed ?? '-'} ${e.type} ${e.url.replace(BASE, '').replace(/\?.*$/, '')} frame=${(e.frame ?? '').replace(BASE, '').replace(/\?.*$/, '')}`),
    messages: (await page.evaluate(() => window.__qaMsgs)).slice(m0),
  };
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL12/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL12-13/result.json', result);
await browser.close();
