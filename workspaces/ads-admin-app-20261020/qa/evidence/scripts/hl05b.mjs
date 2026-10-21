// HL05 follow-up: links not seen in the first pass (stats KPI term links, video-context paragraph, hidden links).
import { BASE, EV, launch, newContext, login, consoleCollector, save, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const all = () => page.locator('main').filter({ visible: true }).locator('a[href^="#/help/"]').evaluateAll((els) => els.map((a) => ({ termId: a.getAttribute('href').slice(7), name: a.getAttribute('aria-label') || a.textContent.trim(), visible: a.getClientRects().length > 0, inDetails: Boolean(a.closest('details:not([open])')) })));
try {
  await login(page);
  await page.goto(`${BASE}/#/reports`);
  await sleep(1500);
  result.reportsBefore = await all();
  const run = page.getByRole('button', { name: /조회/ }).first();
  result.reportsQueryButton = await run.count() ? await run.innerText() : null;
  if (await run.count()) { await run.click(); await sleep(2000); }
  result.reportsAfter = await all();
  result.reportsKpiText = (await page.locator('main').filter({ visible: true }).innerText()).match(/지표 설명[^\n]*/g);
  await page.screenshot({ path: `${EV}/HL05/reports.png`, fullPage: true });

  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await target.getByLabel('고정 대상 ID', { exact: true }).fill('a1-qa-video-1');
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('form', { name: '광고 편성 편집' }).waitFor();
  await sleep(1000);
  result.videoBefore = await all();
  const ctx = page.getByText('독립 설치 영상의 게시판·분류 연결');
  result.videoContextToggle = await ctx.count();
  if (await ctx.count()) { await ctx.first().click(); await sleep(800); }
  result.videoAfterOpen = await all();
  result.videoContextParagraph = await page.locator('a[href="#/help/video-context"]').evaluateAll((els) => els.map((a) => a.parentElement?.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)));
  // Mode links: switch radio to 광고 비활성화 to see the disabled term link (no save).
  const mode = page.getByRole('radio', { name: /광고 비활성화/ });
  if (await mode.count()) { await mode.check(); await sleep(500); }
  result.modeDisabledLinks = (await all()).filter((l) => ['inherit', 'replace', 'disabled'].includes(l.termId));
} catch (error) {
  result.error = String(error).slice(0, 1200);
}
result.console = logs;
save('HL05/result-followup.json', result);
await context.close();
await browser.close();
