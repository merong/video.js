// HL01: top-right action order, "도움말" before "집행 만들기", opens #/help with focus on the "도움말" heading, no menu item.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep, apiCalls, deepActive } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 900 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
try {
  await login(page);
  await page.goto(`${BASE}/#/creatives`);
  await sleep(1200);
  const banner = page.getByRole('banner');
  result.bannerControls = await banner.locator('a, button').filter({ visible: true }).evaluateAll((els) => els.map((e) => `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 40)}${e.getAttribute('href') ? ` (${e.getAttribute('href')})` : ''}`));
  result.menuLinks = await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link').allInnerTexts();
  result.menuHasHelp = result.menuLinks.some((t) => /도움말/.test(t));
  const t = net.length ? net[net.length - 1].t + 1 : 0;
  await banner.getByRole('link', { name: '도움말' }).or(banner.getByRole('button', { name: '도움말' })).first().click();
  await sleep(1200);
  result.hash = new URL(page.url()).hash;
  result.active = await deepActive(page);
  result.activeHeading = await page.evaluate(() => ({ tag: document.activeElement?.tagName, level: document.activeElement?.tagName.match(/^H(\d)$/)?.[1] ?? null, text: document.activeElement?.textContent.trim().slice(0, 40), tabindex: document.activeElement?.getAttribute('tabindex') }));
  result.apiAfterClick = apiCalls(net, t);
  await page.screenshot({ path: `${EV}/HL01/help-top.png` });
  save('HL01/help.aria.yml', await page.locator('main').filter({ visible: true }).ariaSnapshot());
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
result.console = logs;
save('HL01/result.json', result);
await browser.close();
