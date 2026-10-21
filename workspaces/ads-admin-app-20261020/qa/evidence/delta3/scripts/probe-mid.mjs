// Read-only: repeat the B06 mid-roll steps in memory (no save) and record field values after each step.
import { BASE, launch, newContext, login, save, sleep, shot } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const page = await context.newPage();
await login(page);
await page.goto(`${BASE}/#/schedule`);
await page.getByRole('button', { name: '편성 불러오기' }).click();
await sleep(1000);
const editor = page.getByRole('form', { name: '광고 편성 편집' });
await editor.getByLabel('이 대상의 광고', { exact: true }).selectOption({ label: '직접 편성 · 전체 대체' });
const add = editor.getByRole('group', { name: '광고 구간 추가' });
const mid = editor.getByRole('article', { name: /미드롤/ });
const steps = [];
const snap = async (step) => steps.push({
  step,
  active: await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.labels?.[0]?.textContent ?? null, value: document.activeElement?.value ?? null })),
  position: await mid.getByLabel('본편 재생 위치 (초)', { exact: true }).inputValue({ timeout: 1000 }).catch(() => null),
  wait: await mid.getByLabel('스킵 대기 (초)', { exact: true }).inputValue({ timeout: 1000 }).catch(() => null),
  articles: await editor.getByRole('article').count(),
  statuses: (await page.getByRole('status').allInnerTexts()).filter(Boolean),
});
await add.getByRole('button', { name: '미드롤' }).click();
await snap('미드롤 추가');
await mid.getByLabel('본편 재생 위치 (초)', { exact: true }).fill('5');
await snap('위치 fill 5');
await mid.getByLabel('추가할 소재', { exact: true }).selectOption({ label: 'QA 생수 미드롤 · v1 · 영상' });
await snap('소재 선택');
await mid.getByRole('button', { name: '광고 추가' }).click();
await snap('광고 추가');
await mid.getByLabel('이 광고의 스킵', { exact: true }).selectOption({ label: 'N초 후 현재 광고만 스킵' });
await snap('스킵 모드');
await mid.getByLabel('스킵 대기 (초)', { exact: true }).fill('3');
await snap('대기 fill 3');
await add.getByRole('button', { name: '포스트롤' }).click();
await sleep(300);
await snap('포스트롤 클릭');
await shot(page, 'B06/probe-mid.png', { fullPage: true });
save('B06/probe-mid.json', steps);
console.log(JSON.stringify(steps, null, 1));
await browser.close();
