// A2-1-QA probe: the 초기 설정 screen as it first opens (form defaults, code blocks, notes) and the player list.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
try {
  await login(page);
  await page.goto(`${BASE}/#/players/setup`);
  await page.getByRole('heading', { name: '설치 코드' }).first().waitFor();
  await sleep(1200);
  result.inputs = await page.locator('main input, main select, main textarea').evaluateAll((els) => els.map((e) => ({ tag: e.tagName, label: e.labels?.[0]?.textContent?.trim() ?? e.getAttribute('aria-label'), value: e.value, visible: e.offsetParent !== null })));
  result.codes = await page.locator('main pre').evaluateAll((els) => els.map((e) => ({ visible: e.offsetParent !== null, text: e.textContent })));
  result.headings = await page.locator('main h2, main h3, main summary').allInnerTexts();
  result.aria = await page.locator('main').ariaSnapshot();
  await shot(page, 'probe/setup.png', { fullPage: true });
  await page.goto(`${BASE}/#/players`);
  await sleep(1200);
  result.listAria = await page.locator('main').ariaSnapshot();
  await shot(page, 'probe/list.png', { fullPage: true });
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
result.console = logs;
save('probe/setup.json', result);
await browser.close();
