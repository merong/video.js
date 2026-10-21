// L-3-QA scenario 4: editor "강의(LMS)" section on a new preset: values survive save and reopen, native blocks the
// section, the preview shows the progress line and the limit marker. Chromium 1280. Creates one preset (deleted at end).
import { BASE, launch, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const NAME = 'QA 강의 L3';
const b = await launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = consoleCollector(page);
const r = { steps: {} };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };
const lms = () => page.getByRole('region', { name: '강의(LMS)' });
const values = async () => {
  const s = lms();
  const checked = async (group) => (await s.getByRole('radiogroup', { name: group }).getByRole('radio', { checked: true }).getAttribute('aria-label')) ?? (await s.getByRole('radiogroup', { name: group }).locator('input:checked').evaluate((i) => i.labels?.[0]?.textContent ?? i.value));
  return {
    enabled: await s.getByRole('checkbox', { name: '강의 기능 사용' }).isChecked(),
    resume: await checked('이어보기'),
    seekLimit: await checked('앞으로 건너뛰기'),
    maxRate: await checked('최대 배속'),
    completion: await s.getByRole('spinbutton', { name: '완료 기준 (%)' }).inputValue(),
    transcript: await s.getByRole('switch', { name: '스크립트' }).getAttribute('aria-checked'),
    ads: await checked('광고'),
  };
};
// The preview player may sit in an iframe: look in every frame.
const previewFacts = async () => {
  // The editor's PlayerMock draws the lecture layers (sa-pm-watched, sa-pm-limit, sa-pm-lms); the real preview iframe
  // draws no panel (loader lectureLayout returns null for previews).
  const mock = await page.evaluate(() => ({
    line: document.querySelector('.sa-pm-lms')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    watched: Boolean(document.querySelector('.sa-pm-watched')),
    limit: Boolean(document.querySelector('.sa-pm-limit')),
    note: [...document.querySelectorAll('[role=note], .sa-note')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()).find((t) => t.includes('샘플 강의')) ?? null,
  }));
  for (const f of page.frames()) {
    const facts = await f.evaluate(() => {
      const deep = (root, sel, out = []) => { out.push(...root.querySelectorAll(sel)); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) deep(el.shadowRoot, sel, out); return out; };
      const panel = deep(document, 'solad-lms-panel')[0];
      const text = panel ? (panel.shadowRoot ?? panel).textContent.replace(/\s+/g, ' ').trim() : null;
      const slider = deep(document, '[data-solad-lms-limit]')[0];
      return { hasPanel: Boolean(panel), text: text?.slice(0, 200) ?? null, limitMarker: Boolean(slider), limitVar: slider ? getComputedStyle(slider).getPropertyValue('--solad-lms-limit') : null };
    }).catch(() => null);
    if (facts?.hasPanel || facts?.limitMarker) return { mock, frame: f.url().replace(BASE, ''), ...facts };
  }
  return { mock };
};

try {
  await login(page);
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('button', { name: '새 프리셋 만들기' }).click();
  await page.getByRole('textbox', { name: '이름' }).fill(NAME);
  const s = lms();
  await s.getByRole('checkbox', { name: '강의 기능 사용' }).check();
  await s.getByRole('radio', { name: '본 곳까지만' }).check();
  await s.getByRole('radio', { name: '1.5×' }).check();
  await s.getByRole('spinbutton', { name: '완료 기준 (%)' }).fill('80');
  await s.getByRole('switch', { name: '스크립트' }).click();
  await s.getByRole('radio', { name: '프리롤만' }).check();
  await sleep(2500);
  const set = await values();
  const preview = await previewFacts();
  await page.getByRole('region', { name: '플레이어 미리보기' }).scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, 's4-editor-preview.png');
  step('preview shows progress line and limit marker (no save)', Boolean(/진도 \d+%/.test(preview.mock.line ?? '') && preview.mock.limit && preview.limitMarker), preview);

  await page.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(2000);
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('button', { name: `${NAME} 수정` }).click();
  await sleep(2000);
  const reopened = await values();
  step('values kept after save and reopen', JSON.stringify(set) === JSON.stringify(reopened) && set.enabled && set.completion === '80', { set, reopened, url: page.url().replace(BASE, '') });

  await page.getByRole('combobox', { name: '플레이어 종류' }).selectOption({ label: '기본 video' });
  await sleep(800);
  const sec = lms();
  const reason = await sec.getByText('강의 기능은 Video.js 플레이어에서만 써요.').count();
  const enabledBox = await sec.getByRole('checkbox', { name: '강의 기능 사용' }).isDisabled();
  const anyEnabled = await sec.locator('input:not([disabled]), button:not([disabled])').count();
  step('native blocks the section with a reason', reason >= 1 && enabledBox, { reason, checkboxDisabled: enabledBox, enabledControlsLeft: anyEnabled });
  r.presetId = page.url().match(/edit\/([^/?#]+)/)?.[1] ?? null;
} catch (e) {
  r.error = String(e).slice(0, 800);
  console.log('ERROR', r.error);
  await shot(page, 's4-error.png');
}
r.consoleErrors = errors;
save('s4-chromium.json', r);
await b.close();
