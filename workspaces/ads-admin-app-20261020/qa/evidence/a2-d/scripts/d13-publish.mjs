// A2-D-QA D13 schedule publish disabled: one 광고 제거 click makes the site default draft dirty on screen only (no save),
// then 저장한 초안 게시 is read for disabled, contrast, and whether the reason text is visible on screen. The built-in
// list buttons' reason visibility is read too. The context is closed without saving.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const posts = [];
context.on('request', (r) => { if (r.method() !== 'GET' && r.url().includes('/api/')) posts.push(`${r.method()} ${r.url().replace(/^.*action=/, '')}`); });
const result = {};
const read = (loc) => loc.evaluate((el) => {
  const why = el.closest('.sa-btn-why')?.querySelector('.sa-help');
  const r = why?.getBoundingClientRect();
  const s = getComputedStyle(el);
  return { text: el.textContent.trim(), disabled: el.disabled, color: s.color, bg: s.backgroundColor, reason: why?.textContent.trim() ?? null, reasonVisible: Boolean(why && r.width > 1 && r.height > 1 && getComputedStyle(why).visibility !== 'hidden' && getComputedStyle(why).clip !== 'rect(0px, 0px, 0px, 0px)'), reasonColor: why && getComputedStyle(why).color, reasonFont: why && getComputedStyle(why).fontSize };
});
try {
  await login(page);
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('table').first().waitFor();
  await sleep(800);
  result.listEdit = await read(page.getByRole('button', { name: '기본 수정', exact: true }));
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(1000);
  const publish = page.getByRole('button', { name: '저장한 초안 게시' });
  result.before = await read(publish);
  await page.getByRole('button', { name: '광고 제거' }).first().click();
  await sleep(600);
  result.after = await read(publish);
  result.savebar = (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ');
  await publish.scrollIntoViewIfNeeded();
  await shot(page, 'D13/schedule-publish-disabled.png');
} catch (error) {
  result.error = String(error).slice(0, 1200);
}
result.writes = posts;
await context.close();
save('D13/publish.json', result);
await browser.close();
