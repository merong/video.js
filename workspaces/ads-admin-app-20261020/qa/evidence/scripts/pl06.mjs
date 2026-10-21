// PL06: delete through the app Dialog (Esc, 취소, confirm), delete of the default copy falls back to built-in, P-A default restored.
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls, deepActive } from './lib.mjs';
import { captureBodies, gotoList, listRows, listJson } from './presets.mjs';

const P_A = 'QA Video.js 중립 v2';
const browser = await launch();
const context = await newContext(browser, { height: 1200 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { steps: [] };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const dialog = () => page.getByRole('dialog').filter({ visible: true });

async function dialogState() {
  const d = dialog();
  await d.waitFor({ timeout: 5000 });
  return {
    count: await d.count(),
    tag: await d.evaluate((el) => el.tagName),
    modal: await d.evaluate((el) => el.getAttribute('aria-modal') ?? (el.tagName === 'DIALOG' ? String(el.matches(':modal')) : null)),
    name: await d.evaluate((el) => el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim() : null)),
    text: (await d.innerText()).slice(0, 300),
    buttons: await d.getByRole('button').allInnerTexts(),
    focusInside: await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"],dialog'))),
    active: await deepActive(page),
  };
}

async function step(label, fn) {
  if (!(process.env.STEPS ?? '1,2,3,4,5').split(',').includes(label[1])) return;
  const s = { label };
  const t = mark();
  try {
    await fn(s);
  } catch (error) {
    s.error = String(error).slice(0, 800);
  }
  s.api = apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`);
  result.steps.push(s);
}

try {
  await login(page);
  await gotoList(page);
  const only = (process.env.STEPS ?? '1,2,3,4,5').split(',');
  const del = (name) => page.getByRole('button', { name: `${name} 삭제`, exact: true });
  await step('(1) 기본 복사본 삭제 → Esc', async (s) => {
    await del('기본 복사본').click();
    s.dialog = await dialogState();
    await shot(page, 'PL06/dialog-open.png');
    await page.keyboard.press('Escape');
    await sleep(500);
    s.dialogAfter = await dialog().count();
    s.focusAfter = await deepActive(page);
    s.rows = (await listRows(page)).map((r) => r[0]);
  });
  await step('(2) 기본 복사본 삭제 → 취소', async (s) => {
    await del('기본 복사본').click();
    s.dialog = await dialogState();
    await dialog().getByRole('button', { name: '취소', exact: true }).click();
    await sleep(500);
    s.dialogAfter = await dialog().count();
    s.focusAfter = await deepActive(page);
    s.rows = (await listRows(page)).map((r) => r[0]);
  });
  await step('(3) 기본 복사본 삭제 → 확인', async (s) => {
    await del('기본 복사본').click();
    s.dialog = await dialogState();
    const confirm = dialog().getByRole('button', { name: '삭제', exact: true });
    s.confirmLabel = await confirm.innerText();
    await confirm.click();
    await sleep(1500);
    s.dialogAfter = await dialog().count();
    s.focusAfter = await deepActive(page);
    s.live = await page.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts();
    s.rows = (await listRows(page)).map((r) => r[0]);
    await shot(page, 'PL06/after-delete.png', { fullPage: true });
    await page.reload();
    await gotoList(page);
    s.rowsAfterReload = (await listRows(page)).map((r) => r[0]);
  });
  await step('(4) P-A 복제본 기본 지정 → 삭제 → 새로고침', async (s) => {
    const copy = `${P_A} 복사본`;
    await page.getByRole('button', { name: `${copy} 기본으로 지정`, exact: true }).click();
    await sleep(1200);
    s.defaultBefore = (await listJson(page)).data.defaultPresetId;
    s.dialogText = await (async () => {
      await del(copy).click();
      return dialogState();
    })();
    await dialog().getByRole('button', { name: '삭제', exact: true }).click();
    await sleep(1500);
    s.live = await page.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts();
    await page.reload();
    await gotoList(page);
    s.rowsAfterReload = await listRows(page);
    s.defaultAfter = (await listJson(page)).data.defaultPresetId;
    await shot(page, 'PL06/after-delete-default.png', { fullPage: true });
  });
  await step('(5) P-A 다시 기본 지정', async (s) => {
    await page.getByRole('button', { name: `${P_A} 기본으로 지정`, exact: true }).click();
    await sleep(1200);
    await page.reload();
    await gotoList(page);
    s.rows = await listRows(page);
    s.defaultAfter = (await listJson(page)).data.defaultPresetId;
  });
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL06/error.png', { fullPage: true }).catch(() => {});
}
result.bodies = bodies.filter((b) => b.method === 'POST').map((b) => ({ action: b.action, status: b.status, sent: b.sent, defaultPresetId: b.body?.data?.defaultPresetId, revision: b.body?.data?.revision, error: b.body?.error }));
result.console = logs;
save('PL06/result.json', result);
await browser.close();
