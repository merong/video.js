// PL08 consequence: after 409 + "프리셋 목록 다시 불러오기", B saves again. Does B's stale field overwrite A's change?
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { gotoList, readForm, fill, liveTexts, presetForm, field, listJson } from './presets.mjs';

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
const pa = async (page) => (await listJson(page)).data.presets.find((p) => p.name === P_A);
const a = await context.newPage();
const b = await context.newPage();
const logs = { a: consoleCollector(a), b: consoleCollector(b) };
try {
  await login(a);
  await openEdit(a);
  await openEdit(b);
  result.serverAtOpen = await pa(a);
  await fill(a, { '광고 음량 막대 색': '#ff8800' });
  await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.serverAfterA = await pa(a);
  await b.bringToFront();
  await fill(b, { '광고 글자 크기 (px)': '16' });
  let t = mark();
  await presetForm(b).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.firstB = apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status} ${c.error?.code ?? ''}`);
  await b.getByRole('button', { name: '프리셋 목록 다시 불러오기' }).click();
  await sleep(1500);
  result.bFormAfterReload = await readForm(b);
  await shot(b, 'PL08/c-tab-b-after-reload.png', { fullPage: true });
  t = mark();
  await presetForm(b).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.secondB = { api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status} ${c.error?.code ?? ''}`), live: await liveTexts(b) };
  result.serverAfterSecondB = await pa(b);
  result.aChangeLost = result.serverAfterA.ads.accentColor === '#ff8800' && result.serverAfterSecondB.ads.accentColor !== '#ff8800';
  await shot(b, 'PL08/c-tab-b-second-save.png', { fullPage: true });

  // Restore P-A to the PL03 values (모서리 12, 광고 음량 막대 색 비움, 광고 글자 크기 15, 건너뛰기 버튼 모서리 비움).
  await a.bringToFront();
  await openEdit(a);
  await a.reload();
  await openEdit(a);
  await fill(a, { '모서리 둥글기 (px)': '12', '광고 음량 막대 색': '', '광고 글자 크기 (px)': '15', '건너뛰기 버튼 모서리 (px)': '' });
  await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.restore = { live: await liveTexts(a), server: await pa(a) };
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(b, 'PL08/c-error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL08/result-overwrite.json', result);
await browser.close();
