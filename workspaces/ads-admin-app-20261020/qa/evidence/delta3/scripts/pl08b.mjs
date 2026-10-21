// PL08 follow-up: after B's 409, "프리셋 목록 다시 불러오기" brings A's values (A restores 건너뛰기 버튼 모서리 to blank).
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { gotoList, readForm, fill, liveTexts, presetForm, field } from './presets.mjs';

const P_A = 'QA Video.js 중립 v2';
const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const net = recordNetwork(context);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const openEdit = async (page) => {
  await gotoList(page);
  await page.getByRole('button', { name: `${P_A} 수정`, exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(1000);
};
const a = await context.newPage();
const b = await context.newPage();
const logs = { a: consoleCollector(a), b: consoleCollector(b) };
try {
  await login(a);
  await openEdit(a);
  await openEdit(b);
  await field(a, '건너뛰기 버튼 모서리 (px)').fill('');
  await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.tabA = { live: await liveTexts(a), values: await readForm(a) };
  await b.bringToFront();
  await fill(b, { '모서리 둥글기 (px)': '20' });
  let t = mark();
  await presetForm(b).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.tabBSave = { api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status} ${c.error?.code ?? ''}`), live: await liveTexts(b) };
  t = mark();
  await b.getByRole('button', { name: '프리셋 목록 다시 불러오기' }).click();
  await sleep(800);
  const dlg = b.getByRole('dialog').filter({ visible: true });
  if (await dlg.count()) {
    result.reloadDialog = { text: (await dlg.innerText()).slice(0, 300), buttons: await dlg.getByRole('button').allInnerTexts() };
    await shot(b, 'PL08/reload-dialog.png');
    await dlg.getByRole('button').filter({ hasText: /버리|불러오기|확인/ }).first().click();
    await sleep(1500);
  }
  result.reloadApi = apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`);
  result.afterReloadHash = new URL(b.url()).hash;
  if (!(await presetForm(b).isVisible())) await openEdit(b);
  result.tabBValuesAfterReload = await readForm(b);
  result.matchesA = JSON.stringify(result.tabBValuesAfterReload) === JSON.stringify(result.tabA.values);
  await shot(b, 'PL08/tab-b-after-reload.png', { fullPage: true });
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(b, 'PL08/error-b.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL08/result-reload.json', result);
await browser.close();
