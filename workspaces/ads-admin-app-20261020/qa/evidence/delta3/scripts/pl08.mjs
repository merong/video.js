// PL08: two tabs on P-A. A saves; B's save and B's default change get 409 revision_conflict, input kept, no retry, reload shows A.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { captureBodies, gotoList, listJson, readForm, fill, liveTexts, presetForm, field } from './presets.mjs';

const P_A = 'QA Video.js 중립 v2';
const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const writes = () => net.filter((e) => e.method === 'POST' && /player-preset/.test(e.action ?? ''));
const openEdit = async (page) => {
  await gotoList(page);
  await page.getByRole('button', { name: `${P_A} 수정`, exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(1000);
};

const a = await context.newPage();
const b = await context.newPage();
const c = await context.newPage();
const logs = { a: consoleCollector(a), b: consoleCollector(b), c: consoleCollector(c) };
try {
  await login(a);
  await openEdit(a);
  await openEdit(b);
  await gotoList(c);
  result.revisionAtOpen = (await listJson(a)).data.revision;

  await fill(a, { '건너뛰기 버튼 모서리 (px)': '8' });
  let t = mark();
  await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.tabA = { api: apiCalls(net, t), live: await liveTexts(a), values: await readForm(a) };

  await b.bringToFront();
  await fill(b, { '모서리 둥글기 (px)': '20' });
  const wB = writes().length;
  t = mark();
  await presetForm(b).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.tabBSave = { api: apiCalls(net, t), live: await liveTexts(b), inputKept: await field(b, '모서리 둥글기 (px)').inputValue(), buttons: await presetForm(b).getByRole('button').allInnerTexts() };
  await shot(b, 'PL08/tab-b-409.png', { fullPage: true });
  await sleep(6000);
  result.tabBSave.writesWithin7s = writes().length - wB;

  // B moves to the list through the sub navigation (does the list refetch?).
  t = mark();
  await b.getByRole('navigation', { name: '플레이어 화면' }).getByRole('link', { name: '프리셋 목록' }).click();
  const leave = b.getByRole('dialog').filter({ visible: true });
  if (await leave.count()) {
    result.tabBLeaveDialog = (await leave.innerText()).slice(0, 300);
    await shot(b, 'PL08/tab-b-leave-dialog.png');
    await leave.getByRole('button', { name: '취소', exact: true }).click().catch(() => {});
  }
  await sleep(1500);
  result.tabBList = { hash: new URL(b.url()).hash, apiOnEnter: apiCalls(net, t) };

  // C opened the list before A's save; its default change is the stale write.
  await c.bringToFront();
  const wC = writes().length;
  t = mark();
  await c.getByRole('button', { name: '기본 기본으로 지정', exact: true }).click();
  await sleep(1500);
  result.tabCDefault = { api: apiCalls(net, t), live: (await c.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts()).concat(await c.locator('main').filter({ visible: true }).getByRole('alert').allInnerTexts()).filter(Boolean), buttons: await c.locator('main').filter({ visible: true }).getByRole('button').filter({ hasText: /불러오기/ }).allInnerTexts() };
  await shot(c, 'PL08/tab-c-default-409.png', { fullPage: true });
  await sleep(6000);
  result.tabCDefault.writesWithin7s = writes().length - wC;

  // Back on B: reload server state and see A's values.
  await b.bringToFront();
  await openEdit(b).catch(() => {});
  result.tabBReloaded = await readForm(b);
  result.defaultAfter = (await listJson(a)).data.defaultPresetId;
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(b, 'PL08/error.png', { fullPage: true }).catch(() => {});
}
result.bodies = bodies.filter((x) => x.method === 'POST').map((x) => ({ action: x.action, status: x.status, sent: x.sent && { revision: x.sent.revision, id: x.sent.id ?? x.sent.preset?.id }, revision: x.body?.data?.revision, error: x.body?.error }));
result.console = logs;
save('PL08/result.json', result);
await browser.close();
