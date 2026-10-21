// L-3-QA scenario 1 (and 6 for the sample lecture's captions button): sample lecture without a token, chromium 1280
// by default; `node s1.mjs webkit` runs it once on WebKit.
import { BASE, launch, consoleCollector, save, shot, sleep, video } from './lib.mjs';

const engine = process.argv[2] ?? 'chromium';
const b = await launch(engine);
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = consoleCollector(page);
const r = { engine, steps: {} };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };
const panel = page.getByRole('region', { name: '강의 진도와 자료' });
const percent = async () => Number((await panel.locator('strong').first().textContent()).match(/\d+/)[0]);
const waitTime = async (cond, ms = 8000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await video(page); if (v && cond(v)) return v; await sleep(150); } return v; };

try {
  await page.goto(`${BASE}/examples/lecture.html`);
  await page.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
  await sleep(800);
  await page.evaluate(() => { const v = document.querySelector('#player video') ?? null; });
  await page.getByRole('button', { name: '재생', exact: true }).click();
  await sleep(6000);
  const p1 = await percent();
  const store = await panel.getByText(/이 브라우저에만 저장돼요/).count();
  const ls = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^solad-lms:v1:/.test(k)));
  step('1 progress rises, store line says this browser', p1 > 0 && store === 1, { percent: p1, storeLine: store, lsKeysAt6s: ls });

  await panel.getByRole('tab', { name: '목차' }).click();
  await panel.getByRole('button', { name: /^3\. 진도와 완료 기준/ }).click();
  const c3 = await waitTime((v) => v.t >= 20 && v.t < 22);
  step('2 chapter click seeks', c3.t >= 20 && c3.t < 22, { t: c3.t });

  await panel.getByRole('tab', { name: '스크립트' }).click();
  const cues = panel.getByRole('tabpanel', { name: '스크립트' }).locator('li button, li [role=button], button[data-time]');
  const cueCount = await cues.count();
  const target = cues.nth(Math.min(cueCount - 1, Math.floor(cueCount / 2)));
  const label = (await target.getAttribute('aria-label')) ?? (await target.textContent());
  await target.click();
  await sleep(800);
  const tc = await video(page);
  const m = String(label).match(/(\d+):(\d{2})/);
  const want = m ? Number(m[1]) * 60 + Number(m[2]) : null;
  step('3 transcript click seeks', want !== null && Math.abs(tc.t - want) < 1.6, { label: String(label).slice(0, 80), t: tc.t, want, cueCount });

  await panel.getByRole('tab', { name: '자료' }).click();
  await page.locator('button[data-time="29"]').click();
  await waitTime((v) => v.t >= 31);
  const mat = panel.getByRole('tabpanel', { name: '자료' });
  const slideA = (await mat.innerText()).match(/(\d+)\s*\/\s*(\d+)/)?.[0];
  await page.locator('button[data-time="0"]').click();
  await sleep(300);
  await page.evaluate(() => {}); 
  await panel.getByRole('tab', { name: '목차' }).click();
  await panel.getByRole('button', { name: /^6\. 스크립트 찾기/ }).click();
  await panel.getByRole('tab', { name: '자료' }).click();
  await waitTime((v) => v.t >= 51);
  const slideB = (await mat.innerText()).match(/(\d+)\s*\/\s*(\d+)/)?.[0];
  step('4 slide follows chapter', /^4\s*\/\s*8$/.test(slideA ?? '') && /^6\s*\/\s*8$/.test(slideB ?? ''), { at31: slideA, at51: slideB });
  await page.locator('#stage').screenshot({ path: `${(await import('./lib.mjs')).EV}/s1-${engine}-materials.png` });

  await panel.getByRole('tab', { name: /메모/ }).click();
  const notes = panel.getByRole('tabpanel', { name: /메모/ });
  await notes.getByRole('textbox').fill('QA 메모 하나');
  await notes.getByRole('button', { name: '저장' }).click();
  await sleep(500);
  const added = await notes.getByText('QA 메모 하나').count();
  await notes.getByRole('button', { name: /지우기/ }).first().click();
  await sleep(300);
  await notes.locator('[data-role="confirm-delete"]').click();
  await sleep(500);
  const removed = await notes.getByText('QA 메모 하나').count();
  step('5 note add and delete', added === 1 && removed === 0, { added, removed });

  const before = await notes.locator('.note').count();
  await page.getByRole('button', { name: '북마크 추가' }).focus();
  await page.getByRole('slider', { name: '탐색' }).focus();
  await page.keyboard.press('b');
  await sleep(600);
  const after = await notes.locator('.note').count();
  const toast = await page.getByText(/북마크를 추가했어요/).count();
  step('6 B key bookmark', after === before + 1, { before, after, toast });

  await page.locator('button[data-time="29"]').click();
  await sleep(4000);
  await page.getByRole('slider', { name: '탐색' }).focus();
  await page.keyboard.press('k');
  await sleep(300);
  const saved = (await video(page)).t;
  await sleep(800);
  const lsAfterPause = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^solad-lms:v1:/.test(k)));
  step('1b local copy written after pause', lsAfterPause.length === 1, { lsAfterPause });
  await page.reload();
  const resume = page.getByRole('button', { name: '이어서 보기' });
  await resume.waitFor({ timeout: 15000 });
  const fromStart = await page.getByRole('group', { name: '미디어 플레이어' }).getByRole('button', { name: '처음부터' }).count();
  const overlayText = await page.getByText(/지난번 .*까지 봤어요/).first().textContent().catch(() => null);
  await shot(page, `s1-${engine}-resume.png`);
  await resume.click();
  const rv = await waitTime((v) => v.t > 5, 6000);
  step('7 resume overlay after reload', Boolean(overlayText) && fromStart >= 1 && Math.abs(rv.t - saved) < 4, { overlayText, fromStartButtons: fromStart, saved, resumedAt: rv.t });
} catch (e) {
  r.error = String(e).slice(0, 800);
  console.log('ERROR', r.error);
  await shot(page, `s1-${engine}-error.png`);
}
r.consoleErrors = errors;
save(`s1-${engine}.json`, r);
await b.close();
