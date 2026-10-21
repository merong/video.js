// A1-QA-DELTA-3: screenshot of the blocked 편성 불러오기 state (RLO in 고정 대상 ID) before the value is fixed.
import { BASE, EV, launch, newContext, login, recordNetwork, save, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const result = {};
try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  await page.reload();
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await sleep(600);
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await target.getByLabel('고정 대상 ID', { exact: true }).fill('a1‮qa');
  const t = net.length ? net[net.length - 1].t + 1 : 0;
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await sleep(1200);
  result.api = apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`);
  result.alerts = (await page.getByRole('alert').allInnerTexts()).filter(Boolean);
  await page.screenshot({ path: `${EV}/VID/schedule-rlo-blocked.png` });
} catch (error) {
  result.error = String(error).slice(0, 800);
}
save('VID/result-shot.json', result);
await browser.close();
