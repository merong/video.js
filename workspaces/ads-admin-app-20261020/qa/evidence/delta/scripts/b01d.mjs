// A1-QA-DELTA B01: wrong-password 401 text (App.tsx WRONG_LOGIN) is distinct from the session-expired text.
import { BASE, USER, launch, newContext, login, recordNetwork, consoleCollector, save, shot, apiCalls, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser);
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const live = async () => ({
  alert: (await page.getByRole('alert').allInnerTexts()).filter(Boolean),
  status: (await page.getByRole('status').allInnerTexts()).filter(Boolean),
});

try {
  await page.goto(`${BASE}/`);
  await page.getByLabel('아이디', { exact: true }).fill(USER);
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong-password-for-qa');
  let t = mark();
  await page.getByRole('button', { name: '로그인' }).click();
  await sleep(1500);
  result.wrong = {
    api: apiCalls(net, t),
    live: await live(),
    expiredTextShown: await page.getByText('만료').count(),
    passwordDescribedBy: await page.getByLabel('비밀번호', { exact: true }).evaluate((el) => ({ invalid: el.getAttribute('aria-invalid'), describedBy: (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()) })),
  };
  await shot(page, 'B01/wrong-login.png');

  // Session expiry: log in, drop the session cookie, then trigger an authenticated request.
  await login(page);
  await page.goto(`${BASE}/#/creatives`);
  await page.getByRole('heading', { name: '소재', level: 1 }).waitFor();
  await context.clearCookies();
  t = mark();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '지면 편성' }).click();
  await sleep(800);
  const load = page.getByRole('button', { name: '편성 불러오기' });
  if (await load.count()) await load.click();
  await sleep(1500);
  result.expired = { api: apiCalls(net, t), live: await live(), loginVisible: await page.getByRole('button', { name: '로그인' }).isVisible().catch(() => false), wrongTextShown: await page.getByText('아이디나 비밀번호가 맞지 않아요').count() };
  await shot(page, 'B01/expired.png', { fullPage: true });

  // Logout and reload still behave.
  await login(page);
  await page.goto(`${BASE}/#/creatives`);
  await page.reload();
  await page.getByRole('heading', { name: '소재', level: 1 }).waitFor();
  result.reloadHash = new URL(page.url()).hash;
  t = mark();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('button', { name: '로그인' }).waitFor();
  await page.reload();
  await sleep(1000);
  result.logout = { api: apiCalls(net, t), loginVisible: await page.getByRole('button', { name: '로그인' }).isVisible(), protectedHeading: await page.getByRole('heading', { name: '소재', level: 1 }).count() };
} catch (error) {
  result.error = String(error).slice(0, 1200);
  await shot(page, 'B01/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('B01/result.json', result);
await browser.close();
