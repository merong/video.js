// PL10: videojs+neutral+theme values → native hides skin/theme, shows notice and timeouts; save P-B with null skin/theme; switch back unsaved.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { captureBodies, liveTexts, presetForm, field, fill, readForm, listJson } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const NOTICE = '기본 video는 브라우저 컨트롤을 써서 스킨 테마가 적용되지 않아요';

try {
  await login(page);
  if ((await listJson(page)).data.presets.some((p) => p.name === 'QA 기본 video')) throw new Error('P-B already exists');
  await page.goto(`${BASE}/#/players/new`);
  await presetForm(page).waitFor();
  await sleep(1000);
  await fill(page, { 이름: 'QA PL10 전환', '플레이어 종류': 'Video.js', 스킨: '뉴트럴 (모서리 12px)', 강조색: '#0a3d91', '모서리 둥글기 (px)': '12' });
  result.videojs = await readForm(page);
  const frameReq = () => net.filter((e) => /player-preview\.html/.test(e.url)).map((e) => e.url.replace(BASE, ''));
  result.previewDocsBeforeSwitch = frameReq();
  await fill(page, { '플레이어 종류': '기본 video' });
  await sleep(1500);
  result.native = await readForm(page);
  result.noticeExact = await page.getByText(NOTICE).filter({ visible: true }).allInnerTexts();
  result.mainTextHasNotice = (await presetForm(page).innerText()).includes(NOTICE);
  result.previewDocsAfterSwitch = frameReq();
  save('PL10/native.aria.yml', await presetForm(page).ariaSnapshot());
  await shot(page, 'PL10/native-form.png', { fullPage: true });
  result.timeoutFields = await presetForm(page).getByRole('spinbutton').filter({ visible: true }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || el.labels?.[0]?.textContent.trim()));

  // P-B: the same form (theme values entered before the switch stay hidden) is saved as native.
  await fill(page, { 이름: 'QA 기본 video', '광고 문구 언어': '한국어', '광고 로드 시간 제한 (초)': '8' });
  const t = mark();
  await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1800);
  result.save = { api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status} ${c.error?.code ?? ''}`), live: await liveTexts(page), hash: new URL(page.url()).hash };
  const stored = (await listJson(page)).data.presets.find((p) => p.name === 'QA 기본 video');
  result.stored = stored;
  result.skinAndThemeNull = stored && stored.skin === null && Object.values(stored.theme).every((v) => v === null);
  await shot(page, 'PL10/after-save.png', { fullPage: true });
  // Switch back to Video.js without saving: record whether the hidden values come back, then leave.
  await fill(page, { '플레이어 종류': 'Video.js' });
  await sleep(1200);
  result.backToVideojs = await readForm(page);
  await shot(page, 'PL10/back-to-videojs.png', { fullPage: true });
  const t2 = mark();
  await page.getByRole('navigation', { name: '플레이어 화면' }).getByRole('link', { name: '프리셋 목록' }).click();
  await sleep(1200);
  result.leave = { hash: new URL(page.url()).hash, dialog: await page.getByRole('dialog').filter({ visible: true }).count(), api: apiCalls(net, t2).map((c) => `${c.method} ${c.action} ${c.status}`) };
  result.storedAfterLeave = (await listJson(page)).data.presets.find((p) => p.name === 'QA 기본 video');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL10/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
result.bodies = bodies.filter((b) => b.method === 'POST').map((b) => ({ action: b.action, status: b.status, sent: b.sent, error: b.body?.error }));
save('PL10/result.json', result);
await browser.close();
