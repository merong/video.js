// B16: offline draft save fails without automatic retry; B18: /?ui=v1 still works beside the new app.
import { BASE, launch, newContext, login, password, USER, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const result = {};

// B16 ---------------------------------------------------------------
{
  const context = await newContext(browser, { height: 1000 });
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const saves = [];
  context.on('request', (req) => {
    if (/action=schedule-save/.test(req.url())) saves.push({ at: Date.now(), method: req.method() });
  });
  const r = {};
  try {
    await login(page);
    await page.goto(`${BASE}/#/schedule`);
    await page.getByRole('button', { name: '편성 불러오기' }).click();
    const editor = page.getByRole('form', { name: '광고 편성 편집' });
    await editor.waitFor();
    await sleep(800);
    const url = editor.getByRole('article', { name: /프리롤/ }).getByRole('group', { name: /^1\. QA 커피/ }).getByLabel('클릭 목적지 URL', { exact: true });
    await url.fill('https://example.com/qa-coffee-offline');
    await context.setOffline(true);
    const t0 = Date.now();
    await editor.getByRole('button', { name: '초안 저장' }).click();
    await sleep(2000);
    r.offline = {
      alerts: await page.getByRole('alert').allInnerTexts(),
      statuses: (await page.getByRole('status').allInnerTexts()).filter(Boolean),
      inputKept: await url.inputValue(),
      saveRequests: saves.filter((s) => s.at >= t0).length,
    };
    await shot(page, 'B16/offline-fail.png', { fullPage: true });
    await context.setOffline(false);
    const t1 = Date.now();
    await sleep(8000);
    r.afterOnlineNoAction = { saveRequests: saves.filter((s) => s.at >= t1).length, inputKept: await url.inputValue() };
    const t2 = Date.now();
    await editor.getByRole('button', { name: '초안 저장' }).click();
    await sleep(2000);
    r.manualRetry = { saveRequests: saves.filter((s) => s.at >= t2).length, status: await editor.getByRole('status').last().innerText(), api: apiCalls(net).filter((c) => c.action === 'schedule-save').slice(-2) };
    await shot(page, 'B16/after-manual-retry.png', { fullPage: true });
  } catch (error) {
    r.error = String(error).slice(0, 1200);
    await shot(page, 'B16/error.png', { fullPage: true }).catch(() => {});
  }
  r.console = logs;
  result.B16 = r;
  await context.close();
}

// B18 ---------------------------------------------------------------
{
  const context = await newContext(browser);
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = {};
  try {
    await page.goto(`${BASE}/?ui=v1`);
    await sleep(1500);
    r.title = await page.title();
    r.assets = net.filter((e) => e.type === 'script' || e.type === 'stylesheet').map((e) => e.url.replace(BASE, ''));
    save('B18/v1-start.aria.yml', await page.locator('body').ariaSnapshot());
    await shot(page, 'B18/v1-start.png', { fullPage: true });
    const user = page.getByLabel(/아이디/).first();
    if (await user.count()) {
      await user.fill(USER);
      await page.getByLabel(/비밀번호/).first().fill(password());
      await page.getByRole('button', { name: /로그인/ }).first().click();
      await sleep(2000);
    }
    r.afterLogin = (await page.locator('body').innerText()).slice(0, 1500);
    r.creativesVisible = await page.getByText('QA 이어버드 프리롤').count();
    r.api = apiCalls(net).map((c) => `${c.method} ${c.action} ${c.status}`);
    r.url = page.url();
    save('B18/v1-after-login.aria.yml', await page.locator('body').ariaSnapshot());
    await shot(page, 'B18/v1-after-login.png', { fullPage: true });
    // The new app in the same session still opens on its own route.
    await page.goto(`${BASE}/#/creatives`);
    await sleep(1500);
    r.newAppAfterV1 = { h1: await page.locator('h1').filter({ visible: true }).allInnerTexts(), assets: net.filter((e) => /admin-app/.test(e.url)).length };
    await shot(page, 'B18/new-app-after-v1.png');
  } catch (error) {
    r.error = String(error).slice(0, 1200);
    await shot(page, 'B18/error.png', { fullPage: true }).catch(() => {});
  }
  r.console = logs;
  result.B18 = r;
  await context.close();
}

save('B16-B18/result.json', result);
await browser.close();
