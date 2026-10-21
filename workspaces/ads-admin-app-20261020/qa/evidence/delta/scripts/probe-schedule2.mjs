// Read-only: switch the draft form to replace and add one break in memory only (no save), then snapshot.
import { BASE, launch, newContext, login, recordNetwork, save, apiCalls, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser);
const net = recordNetwork(context);
const page = await context.newPage();
await login(page);
await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '지면 편성' }).click();
await page.getByRole('button', { name: '편성 불러오기' }).click();
await sleep(1200);
await page.getByLabel('이 대상의 광고', { exact: true }).selectOption({ label: '직접 편성 · 전체 대체' });
await sleep(300);
save('00-env/probe/schedule-replace.aria.yml', await page.getByRole('form', { name: '광고 편성 편집' }).ariaSnapshot());
const g = page.getByRole('group', { name: '광고 구간 추가' });
console.log('add group', await g.count());
if (await g.count()) { await g.getByRole('button', { name: '프리롤' }).click(); await sleep(300); }
const pre = page.getByRole('article', { name: /프리롤/ });
await pre.getByLabel('추가할 소재', { exact: true }).selectOption({ label: 'QA 커피 프리롤 v2 · v2 · 영상' });
await pre.getByRole('button', { name: '광고 추가' }).click();
await pre.getByLabel('추가할 소재', { exact: true }).selectOption({ label: 'QA 포스트롤 이미지 · v1 · 이미지' });
await pre.getByRole('button', { name: '광고 추가' }).click();
await g.getByRole('button', { name: '미드롤' }).click();
await sleep(300);
save('00-env/probe/schedule-pre.aria.yml', await page.getByRole('form', { name: '광고 편성 편집' }).ariaSnapshot());
const writes = apiCalls(net).filter((c) => c.method === 'POST' && c.action !== 'login');
console.log('writes', writes.length);
await browser.close();
