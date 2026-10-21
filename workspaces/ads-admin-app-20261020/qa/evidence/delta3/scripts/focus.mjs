// A1-QA-DELTA-2 focus return: after a write finishes, focus goes back to the button that started it, or to the page
// heading when that button is gone or disabled. Mouse flows for schedule save/publish/cancel, video context save,
// creative save/new version/archive, stats query and CSV. Records document.activeElement and the starter's state.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const calls = (t) => apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ` ${c.error.code}` : ''}`);

const active = () => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName,
    id: el.id || null,
    name: (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent || '').trim().slice(0, 50),
    tabindex: el.getAttribute('tabindex'),
    disabled: el.disabled ?? null,
    ariaDisabled: el.getAttribute('aria-disabled'),
    focusVisible: el.matches(':focus-visible'),
    ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
  };
});
const state = async (locator) => (await locator.count()) ? { exists: true, disabled: await locator.first().isDisabled(), ariaDisabled: await locator.first().getAttribute('aria-disabled') } : { exists: false };

async function step(label, starter, run) {
  const t = mark();
  await run();
  await sleep(1500);
  const r = { label, api: calls(t), focus: await active(), starter: await state(starter), live: (await page.getByRole('status').allInnerTexts()).filter(Boolean).slice(-2), alerts: (await page.getByRole('alert').allInnerTexts()).filter(Boolean) };
  (result.steps ??= []).push(r);
  return r;
}

try {
  await login(page);

  // Schedule: mouse save, publish cancel, publish confirm.
  await page.goto(`${BASE}/#/schedule`);
  await page.getByRole('button', { name: '편성 불러오기' }).click();
  const editor = page.getByRole('form', { name: '광고 편성 편집' });
  await editor.waitFor();
  await sleep(800);
  await editor.getByLabel('클릭 목적지 URL', { exact: true }).first().fill('https://example.com/qa-coffee-focus');
  const saveButton = editor.getByRole('button', { name: '초안 저장' });
  await step('편성 초안 저장(마우스)', saveButton, () => saveButton.click());
  await shot(page, 'FOCUS/schedule-save.png');
  const publishButton = editor.getByRole('button', { name: '저장한 초안 게시' });
  await step('게시 → 대화상자 취소', publishButton, async () => {
    await publishButton.click();
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  });
  await step('게시 → 대화상자 게시', publishButton, async () => {
    await publishButton.click();
    await page.getByRole('dialog').getByRole('button', { name: '게시', exact: true }).click();
  });
  await shot(page, 'FOCUS/schedule-publish.png');

  // Video context save (same values as B08).
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await page.getByText('독립 설치 영상의 게시판·분류 연결').click();
  const ctx = page.getByRole('form', { name: '영상 소속 연결' });
  await ctx.getByLabel('영상 ID', { exact: true }).fill('a1-qa-video-1');
  await ctx.getByLabel('영상 이름', { exact: true }).fill('QA 영상 1');
  await ctx.getByLabel('게시판 ID', { exact: true }).fill('notice');
  await ctx.getByLabel('분류 ID', { exact: true }).fill('1');
  const ctxButton = ctx.getByRole('button', { name: '영상 소속 저장' });
  await step('영상 소속 저장', ctxButton, () => ctxButton.click());

  // Creatives: new URL creative, new version, archive.
  await page.goto(`${BASE}/#/creatives`);
  await page.getByRole('heading', { name: '소재', level: 1 }).waitFor();
  const form = page.locator('form', { has: page.getByRole('button', { name: '소재 저장' }) });
  await page.getByRole('button', { name: '새 소재 등록' }).click();
  await sleep(300);
  await form.getByLabel('소재 이름', { exact: true }).fill('QA 초점 확인');
  await form.getByLabel('등록 방식', { exact: true }).selectOption({ label: '외부 URL' });
  await form.getByLabel('소재 URL', { exact: true }).fill('/demo-media/grok-20261018/ad-coffee-6s.mp4');
  await form.getByLabel('파일 형식', { exact: true }).selectOption({ label: 'MP4 영상' });
  const creativeSave = form.getByRole('button', { name: '소재 저장' });
  await step('새 소재 저장', creativeSave, () => creativeSave.click());
  await shot(page, 'FOCUS/creative-save.png');
  const row = () => page.getByRole('row', { name: /QA 초점 확인/ });
  await row().getByRole('button', { name: '새 버전으로 수정' }).click();
  await sleep(300);
  await form.getByLabel('소재 이름', { exact: true }).fill('QA 초점 확인 v2');
  await step('새 버전 저장', creativeSave, () => creativeSave.click());
  const archive = row().getByRole('button', { name: '보관' });
  await step('보관 → 대화상자 보관', archive, async () => {
    await archive.click();
    await page.getByRole('dialog').getByRole('button', { name: '보관' }).click();
  });
  await shot(page, 'FOCUS/creative-archive.png');

  // Stats query and CSV.
  await page.goto(`${BASE}/#/reports`);
  const stats = page.getByRole('form', { name: '기본 통계' });
  await stats.waitFor();
  await stats.getByLabel('영상 ID', { exact: true }).fill('a1-qa-video-1');
  const query = stats.getByRole('button', { name: '통계 조회' });
  await step('통계 조회', query, () => query.click());
  const csv = stats.getByRole('button', { name: '현재 조건 CSV 다운로드' });
  await step('CSV 다운로드', csv, async () => {
    await Promise.all([page.waitForEvent('download', { timeout: 15000 }), csv.click()]);
  });
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'FOCUS/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('FOCUS/result.json', result);
await browser.close();
