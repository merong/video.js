// PL14: leaving the edit screen during preview playback removes the iframe and stops media; coming back prepares a fresh preview.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { runs: [] };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const previewFrames = () => page.frames().filter((f) => /player-preview/.test(f.url())).map((f) => f.url().replace(BASE, ''));
const iframe = () => page.frameLocator('iframe[title="플레이어 테마 미리보기"]');
const videoState = () => page.frames().find((f) => /player-preview/.test(f.url()))?.evaluate(() => {
  const out = [];
  const collect = (root) => {
    for (const v of root.querySelectorAll('video')) out.push({ src: (v.currentSrc || v.src).split('/').pop(), t: Math.round(v.currentTime * 10) / 10, paused: v.paused });
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) collect(el.shadowRoot);
  };
  collect(document);
  return out;
});
const openEdit = async () => {
  await gotoList(page);
  await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(2500);
};

try {
  await login(page);
  for (const [label, leave] of [
    ['메뉴 소재', () => page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '소재', exact: true }).click()],
    ['하위 탐색 옵션 설명', () => page.getByRole('navigation', { name: '플레이어 화면' }).getByRole('link', { name: '옵션 설명' }).click()],
  ]) {
    const r = { label };
    await openEdit();
    await iframe().locator('media-play-button').click();
    await sleep(4000);
    r.playingBeforeLeave = await videoState();
    await leave();
    const tLeave = mark();
    await sleep(300);
    r.afterLeave = { hash: new URL(page.url()).hash, iframeElements: await page.locator('iframe').count(), previewFrames: previewFrames() };
    await sleep(5000);
    r.requestsFromPreviewAfterLeave = net.filter((e) => e.t >= tLeave && /player-preview|demo-media|assets\/videojs|ads\.js/.test(`${e.url} ${e.frame}`)).map((e) => `${e.t - tLeave}ms ${e.method} ${e.type} ${e.url.replace(BASE, '')}`);
    await page.screenshot({ path: `${EV}/PL14/${label === '메뉴 소재' ? 'creatives' : 'options'}-after-leave.png` });
    const tBack = mark();
    await openEdit();
    r.afterReturn = { previewFrames: previewFrames(), newDocRequests: net.filter((e) => e.t >= tBack && /player-preview\.html/.test(e.url) && e.type === 'document').length, videos: await videoState() };
    result.runs.push(r);
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await page.screenshot({ path: `${EV}/PL14/error.png`, fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL14/result.json', result);
await browser.close();
