// Probe: aria structure of the new preset form (no writes).
import { BASE, launch, newContext, login, recordNetwork, save, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const page = await context.newPage();
await login(page);
await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '플레이어', exact: true }).click();
await sleep(800);
await page.getByRole('button', { name: '새 프리셋 만들기' }).click();
await sleep(2500);
save('PL02/probe-form.aria.yml', await page.locator('main').filter({ visible: true }).ariaSnapshot());
save('PL02/probe-form.json', { hash: new URL(page.url()).hash, api: apiCalls(net), frames: page.frames().map((f) => f.url()) });
await browser.close();
