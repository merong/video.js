// Read-only: load the site-default schedule and snapshot the editor (no writes).
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, apiCalls, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser);
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
await login(page);
await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '지면 편성' }).click();
await page.getByRole('button', { name: '편성 불러오기' }).click();
await sleep(1500);
save('00-env/probe/schedule-loaded.aria.yml', await page.locator('main').ariaSnapshot());
const mode = page.getByLabel('이 대상의 광고', { exact: true });
console.log('mode count', await mode.count());
if (await mode.count()) console.log(await mode.locator('option').allInnerTexts().catch(() => 'n/a'));
save('00-env/probe/schedule-loaded.json', { api: apiCalls(net), logs });
await browser.close();
