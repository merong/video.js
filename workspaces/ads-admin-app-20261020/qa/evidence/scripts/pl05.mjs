// PL05: set P-A as default, reload, public player-preset without cookies, first selected preset in setup generator and schedule test area.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls, redact } from './lib.mjs';
import { captureBodies, gotoList, listRows, listJson, liveTexts } from './presets.mjs';

const P_A_ID = 'p-wkepup6b7d';
const NAME = 'QA Video.js 중립 v2';
const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);

const selects = (scope) => scope.locator('select').filter({ visible: true }).evaluateAll((els) => els.map((s) => ({
  label: s.labels?.[0]?.textContent.trim() || s.getAttribute('aria-label'),
  value: s.value,
  selected: s.selectedOptions[0]?.textContent.trim(),
  options: [...s.options].map((o) => `${o.value}|${o.textContent.trim()}${o.disabled ? '|disabled' : ''}`),
})));

try {
  await login(page);
  await gotoList(page);
  const t = mark();
  await page.getByRole('button', { name: `${NAME} 기본으로 지정`, exact: true }).click();
  await sleep(1500);
  result.setDefaultApi = apiCalls(net, t);
  result.live = await page.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts();
  result.dialog = await page.getByRole('dialog').filter({ visible: true }).count();
  result.rowsAfter = await listRows(page);
  await shot(page, 'PL05/list-after-default.png', { fullPage: true });
  await page.reload();
  await gotoList(page);
  result.rowsAfterReload = await listRows(page);
  result.defaultButtons = await page.getByRole('table', { name: '플레이어 프리셋' }).filter({ visible: true }).getByRole('button', { name: /기본으로 지정$/ }).evaluateAll((els) => els.map((b) => ({ name: b.getAttribute('aria-label'), disabled: b.disabled })));
  result.listDefault = (await listJson(page)).data.defaultPresetId;

  const anon = await browser.newContext();
  const res = await anon.request.get(`${BASE}/api/index.php?action=player-preset`);
  result.publicNoCookie = { status: res.status(), cookieHeaderSent: false, body: redact(await res.json()) };
  await anon.close();

  await page.goto(`${BASE}/#/players/setup`);
  await sleep(2000);
  result.setup = { hash: new URL(page.url()).hash, selects: await selects(page.locator('main').filter({ visible: true })) };
  save('PL05/setup.aria.yml', await page.locator('main').filter({ visible: true }).ariaSnapshot());
  await shot(page, 'PL05/setup.png', { fullPage: true });

  await page.goto(`${BASE}/#/schedule`);
  await sleep(1500);
  const testForm = page.getByRole('form', { name: '재생 확인' });
  result.scheduleTest = { visible: await testForm.isVisible().catch(() => false), selects: await selects(testForm).catch((e) => String(e)) };
  save('PL05/schedule-test.aria.yml', await testForm.ariaSnapshot().catch((e) => String(e)));
  await testForm.screenshot({ path: `${(await import('./lib.mjs')).EV}/PL05/schedule-test.png` }).catch(() => {});
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL05/error.png', { fullPage: true }).catch(() => {});
}
result.bodies = bodies.filter((b) => b.method === 'POST').map((b) => ({ action: b.action, status: b.status, sent: b.sent, defaultPresetId: b.body?.data?.defaultPresetId, revision: b.body?.data?.revision, error: b.body?.error }));
result.console = logs;
save('PL05/result.json', result);
await browser.close();
