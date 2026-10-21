// A1-QA-DELTA-3 video ID screen checks: 지면 편성 고정 대상 ID, 설치 코드 생성기 영상 ID and 재생 확인 고정 영상 ID block
// RLO, C1, U+3000-only and 129 characters before any request (videoIdProblem). Records requests, aria-invalid,
// describedby text, focus and alerts (a repeated sentence is the VID-1 regression). LRM, ALM and ZWSP are observed only.
// Valid a1-qa-video-1 must still load, build code and links; schedule save focus returns to 초안 저장.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep, apiCalls, deepActive } from './lib.mjs';

// '-forced' sets the value through the native setter plus an input event, past maxlength=128 (no user can type it).
const BLOCK = { rlo: 'a1‮qa', 'c1-nel': 'a1\u0085qa', 'ideographic-space-only': '　', 'too-long-129': 'a'.repeat(129), 'too-long-129-forced': 'a'.repeat(129) };
const OBSERVE = { lrm: 'a1‎qa', alm: 'a1؜qa', 'zwsp-only': '​' };
const VALID = { valid: 'a1-qa-video-1' };
const ALL = { ...BLOCK, ...OBSERVE, ...VALID };
const group = (key) => (key in BLOCK ? 'block' : key in OBSERVE ? 'observe' : 'valid');
const cps = (s) => [...(s ?? '')].filter((c) => c.codePointAt(0) > 0x7e || c.codePointAt(0) < 0x20).map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

const browser = await launch();
const context = await newContext(browser, { height: 1100 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { schedule: {}, setup: {}, playTest: {}, focus: {} };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const calls = (t) => apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ` ${c.error.code}` : ''}`);
async function setValue(locator, key, value) {
  if (!key.endsWith('-forced')) return locator.fill(value);
  await locator.focus();
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function fresh(hash) {
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
}
const fieldState = (locator) => locator.evaluate((el) => ({
  valueLength: [...el.value].length,
  maxLength: el.maxLength,
  readOnly: el.readOnly,
  invalid: el.getAttribute('aria-invalid'),
  describedBy: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? `(missing #${id})`),
  errormessage: el.getAttribute('aria-errormessage') ? document.getElementById(el.getAttribute('aria-errormessage'))?.textContent?.trim() ?? null : null,
}));
// A sentence that appears twice inside one alert is the VID-1 symptom.
const repeated = (texts) => texts.some((text) => {
  const sentences = text.split(/(?<=[.?!요])\s+/u).map((s) => s.trim()).filter(Boolean);
  return new Set(sentences).size !== sentences.length;
});

try {
  await login(page);

  // 1. 지면 편성 → 개별 영상 → 고정 대상 ID → 편성 불러오기.
  for (const [key, value] of Object.entries(ALL)) {
    await fresh('#/schedule');
    const target = page.getByRole('form', { name: '편집할 대상' });
    await target.waitFor();
    await sleep(600);
    await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
    const idBox = target.getByLabel('고정 대상 ID', { exact: true });
    await setValue(idBox, key, value);
    const t = mark();
    await target.getByRole('button', { name: '편성 불러오기' }).click();
    await sleep(1500);
    const alerts = (await page.getByRole('alert').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
    result.schedule[key] = {
      group: group(key),
      codepoints: cps(value),
      length: [...value].length,
      api: calls(t),
      ...(await fieldState(idBox)),
      focus: await deepActive(page),
      alerts,
      repeatedSentence: repeated(alerts),
      editorShown: await page.getByRole('form', { name: '광고 편성 편집' }).count(),
    };
    if (key in BLOCK) {
      // Fixing the value clears the error and loads.
      await idBox.fill('a1-qa-video-1');
      const t2 = mark();
      await target.getByRole('button', { name: '편성 불러오기' }).click();
      await sleep(1500);
      result.schedule[key].afterFix = { api: calls(t2), ...(await fieldState(idBox)), editorShown: await page.getByRole('form', { name: '광고 편성 편집' }).count() };
    }
    if (key === 'rlo' || key === 'too-long-129' || key === 'valid') await page.screenshot({ path: `${EV}/VID/schedule-${key}.png`, fullPage: true });
  }

  // 2a. 설치 코드 생성기.
  await fresh('#/players/setup');
  const region = page.getByRole('region', { name: '설치 코드 만들기' });
  await region.waitFor();
  await sleep(1000);
  const codeText = () => region.locator('pre, textarea, code').filter({ visible: true }).evaluateAll((els) => els.map((e) => (e.tagName === 'TEXTAREA' ? e.value : e.textContent)).sort((a, b) => b.length - a.length)[0] ?? '');
  const setupBox = region.getByRole('textbox', { name: '영상 ID' });
  for (const [key, value] of Object.entries(ALL)) {
    const t = mark();
    await setValue(setupBox, key, value);
    await page.keyboard.press('Tab');
    await sleep(600);
    const code = await codeText();
    const line = code.split('\n').find((l) => /video-id|videoId|video=/.test(l)) ?? null;
    result.setup[key] = {
      group: group(key),
      api: calls(t),
      ...(await fieldState(setupBox)),
      alerts: (await region.getByRole('alert').allInnerTexts()).filter(Boolean),
      status: (await region.getByRole('status').allInnerTexts()).filter(Boolean),
      codeShown: Boolean(code),
      copyButtons: await region.getByRole('button', { name: /복사/ }).evaluateAll((els) => els.map((b) => `${b.textContent.trim()}${b.disabled ? ' [disabled]' : ''}`)),
      videoIdLine: line ? line.trim().replace(/[^\x20-\x7e]/g, (c) => `<U+${c.codePointAt(0).toString(16).toUpperCase()}>`).slice(0, 200) : null,
    };
    if (['rlo', 'too-long-129', 'valid'].includes(key)) await page.locator('main').filter({ visible: true }).screenshot({ path: `${EV}/VID/setup-${key}.png` });
  }

  // 2b. 지면 편성 → 재생 확인 → 고정 영상 ID.
  for (const [key, value] of Object.entries(ALL)) {
    await fresh('#/schedule');
    await page.getByRole('heading', { name: '재생 확인' }).waitFor();
    await sleep(800);
    const box = page.getByLabel('고정 영상 ID', { exact: true }).last();
    const t = mark();
    await setValue(box, key, value);
    await page.keyboard.press('Tab');
    await sleep(800);
    const links = await page.getByRole('group', { name: '게시본 재생 테스트' }).getByRole('link').evaluateAll((els) => els.filter((a) => !/^#\/help\//.test(a.getAttribute('href') || '')).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') })));
    result.playTest[key] = {
      group: group(key),
      api: calls(t),
      ...(await fieldState(box)),
      playLinks: links.map((l) => ({ text: l.text, videoParamCodepoints: cps(decodeURIComponent((l.href.split('video=')[1] || '').split('&')[0])), videoParamAscii: decodeURIComponent((l.href.split('video=')[1] || '').split('&')[0]).replace(/[^\x20-\x7e]/g, '?') })),
      previewButton: await page.getByRole('button', { name: /미리보기 준비|미리보기 시작/ }).first().evaluate((b) => ({ text: b.textContent.trim(), disabled: b.disabled })).catch(() => null),
      alerts: (await page.getByRole('alert').allInnerTexts()).filter(Boolean),
      notes: (await page.getByRole('heading', { name: '재생 확인' }).locator('xpath=ancestor::section[1]').innerText().catch(() => '')).split('\n').filter((l) => /영상 ID|입력|확인해|128/.test(l)).slice(0, 8),
    };
    if (['rlo', 'too-long-129', 'valid'].includes(key)) await page.screenshot({ path: `${EV}/VID/play-test-${key}.png`, fullPage: true });
  }

  // 3. Focus after a mouse schedule save (FOCUS subset).
  await fresh('#/schedule');
  await page.getByRole('button', { name: '편성 불러오기' }).click();
  const editor = page.getByRole('form', { name: '광고 편성 편집' });
  await editor.waitFor();
  await sleep(800);
  await editor.getByLabel('클릭 목적지 URL', { exact: true }).first().fill('https://example.com/qa-delta3-focus');
  const saveButton = editor.getByRole('button', { name: '초안 저장' });
  const t = mark();
  await saveButton.click();
  await sleep(1500);
  result.focus = { api: calls(t), focus: await deepActive(page), starterDisabled: await saveButton.isDisabled(), status: (await page.getByRole('status').allInnerTexts()).filter(Boolean).slice(-2) };
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await page.screenshot({ path: `${EV}/VID/error.png`, fullPage: true }).catch(() => {});
}
result.console = logs;
save('VID/result.json', result);
await browser.close();
