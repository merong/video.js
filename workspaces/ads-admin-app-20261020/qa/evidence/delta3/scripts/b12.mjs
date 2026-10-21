// B12: mock screens opened by menu click send no API request; write buttons are disabled with a reason (D2 counting).
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 900 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { screens: [], reloads: [] };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const nav = () => page.getByRole('navigation', { name: '주 메뉴' });

async function inspect(label) {
  const main = page.locator('main');
  const live = async () => (await page.getByRole('status').allInnerTexts()).concat(await page.getByRole('alert').allInnerTexts()).filter(Boolean);
  const r = { label, hash: new URL(page.url()).hash, mainCount: await page.locator('main').count(), visibleH1: await page.locator('h1').filter({ visible: true }).allInnerTexts() };
  r.badge = await main.getByText('목업 · 아직 동작하지 않아요', { exact: true }).filter({ visible: true }).count();
  r.notBuiltCards = await main.getByText('아직 만들지 않은 화면').filter({ visible: true }).count();
  r.specRefs = await main.locator('code').filter({ visible: true }).allInnerTexts();
  r.disabledButtons = await main.locator('button:disabled').filter({ visible: true }).evaluateAll((els) => els.map((b) => ({
    name: b.getAttribute('aria-label') || b.textContent.trim(),
    reason: (b.getAttribute('aria-describedby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(' | ') || b.nextElementSibling?.textContent.trim().slice(0, 60) || null,
  })));
  r.enabledButtons = await main.locator('button:enabled').filter({ visible: true }).evaluateAll((els) => els.map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
  const before = await live();
  const t = mark();
  for (const button of await main.locator('button:disabled').filter({ visible: true }).all()) {
    await button.click({ force: true, timeout: 2000 }).catch(() => {});
    await button.focus().catch(() => {});
    await page.keyboard.press('Enter');
  }
  await sleep(600);
  r.afterDisabledClicks = { api: apiCalls(net, t), liveBefore: before, liveAfter: await live(), hash: new URL(page.url()).hash };
  return r;
}

try {
  await login(page);
  result.loginApi = apiCalls(net);
  for (const name of ['대시보드', '캠페인', '승인함', '리포트', '설정']) {
    const t = mark();
    await nav().getByRole('link', { name, exact: true }).click();
    await sleep(1500);
    const r = await inspect(name);
    r.apiAfterMenuClick = apiCalls(net, t);
    await shot(page, `B12/${encodeURIComponent(name)}.png`, { fullPage: true });
    result.screens.push(r);
    if (name === '캠페인') {
      const t2 = mark();
      await page.getByRole('button', { name: '예시 캠페인 A 열기' }).click();
      await sleep(1000);
      const d = await inspect('캠페인 상세');
      d.tables = await page.locator('main table').filter({ visible: true }).evaluateAll((els) => els.map((t) => t.querySelector('caption')?.textContent ?? t.rows[0]?.innerText.slice(0, 80)));
      d.apiAfterOpen = apiCalls(net, t2);
      await shot(page, 'B12/campaign-detail.png', { fullPage: true });
      result.screens.push(d);
    }
  }
  const t = mark();
  await page.getByRole('banner').getByRole('link', { name: '집행 만들기' }).click();
  await sleep(1500);
  const lineItem = await inspect('집행 만들기');
  lineItem.apiAfterClick = apiCalls(net, t);
  await shot(page, 'B12/new-line-item.png', { fullPage: true });
  result.screens.push(lineItem);

  // D2: a hash reload of a mock screen may only request bootstrap once.
  for (const hash of ['#/dashboard', '#/campaigns', '#/approvals', '#/settings', '#/new-line-item']) {
    await page.goto(`${BASE}/${hash}`);
    const t3 = mark();
    await page.reload();
    await sleep(1800);
    result.reloads.push({ hash, landed: new URL(page.url()).hash, api: apiCalls(net, t3).map((c) => `${c.method} ${c.action} ${c.status}`) });
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'B12/error.png', { fullPage: true }).catch(() => {});
}

result.console = logs;
save('B12/result.json', result);
await browser.close();
