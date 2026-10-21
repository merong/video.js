// PL02: create P-A from #/players/new, check the save notice, reload, CSRF header on save.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { captureBodies, gotoList, listRows, listJson, readForm, fill, liveTexts, presetForm, idOf } from './presets.mjs';

const P_A = { 이름: 'QA Video.js 중립', '플레이어 종류': 'Video.js', 스킨: '뉴트럴 (모서리 12px)', 강조색: '#0a3d91', '강조 글자색': '#ffffff', '모서리 둥글기 (px)': '12', '광고 문구 언어': 'English', '건너뛰기 문구': 'Skip ad', '광고 글자 크기 (px)': '15' };
const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);

try {
  await login(page);
  if (idOf(await listJson(page), P_A.이름)) throw new Error('P-A already exists; refusing to create a duplicate');
  await page.goto(`${BASE}/#/players/new`);
  await presetForm(page).waitFor();
  await sleep(1000);
  await fill(page, P_A);
  result.beforeSave = await readForm(page);
  result.notice = await page.getByText('저장하면 재생 테스트 페이지에 바로 적용돼요. 이미 붙여 넣은 설치 코드는 다시 복사해야 바뀌어요.', { exact: true }).filter({ visible: true }).count();
  await shot(page, 'PL02/before-save.png', { fullPage: true });
  const t = mark();
  await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(2000);
  result.saveApi = apiCalls(net, t);
  result.afterSave = { hash: new URL(page.url()).hash, live: await liveTexts(page).catch((e) => String(e)) };
  await shot(page, 'PL02/after-save.png', { fullPage: true });
  const json = await listJson(page);
  result.id = idOf(json, P_A.이름);
  result.idPattern = /^p-[a-z0-9]{10}$/.test(result.id ?? '');
  await gotoList(page);
  result.listRows = await listRows(page);
  await shot(page, 'PL02/list.png', { fullPage: true });
  await page.reload();
  await gotoList(page);
  result.listRowsAfterReload = await listRows(page);
  await page.goto(`${BASE}/#/players/${result.id}`);
  await presetForm(page).waitFor();
  await sleep(1000);
  result.editHash = new URL(page.url()).hash;
  result.afterReload = await readForm(page);
  result.sameAfterReload = JSON.stringify(result.afterReload) === JSON.stringify(result.beforeSave);
  await shot(page, 'PL02/edit-after-reload.png', { fullPage: true });
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL02/error.png', { fullPage: true }).catch(() => {});
}
result.bodies = bodies.filter((b) => b.method === 'POST');
result.console = logs;
save('PL02/result.json', result);
await browser.close();
