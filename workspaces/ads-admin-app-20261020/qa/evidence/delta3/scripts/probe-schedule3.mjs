// Read-only: video and board scope editors (no save).
import { BASE, launch, newContext, login, recordNetwork, save, apiCalls, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser);
const net = recordNetwork(context);
const page = await context.newPage();
await login(page);
await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '지면 편성' }).click();
const target = page.getByRole('form', { name: '편집할 대상' });
await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
await sleep(400);
save('00-env/probe/schedule-video-target.aria.yml', await page.locator('main').ariaSnapshot());
await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '게시판' });
await sleep(400);
save('00-env/probe/schedule-board-target.aria.yml', await target.ariaSnapshot());
console.log('writes', apiCalls(net).filter((c) => c.method === 'POST' && c.action !== 'login').length, JSON.stringify(apiCalls(net).map((c) => c.action)));
await browser.close();
