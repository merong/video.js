// A1-QA-DELTA-2 video ID (Value::videoId): public schedule rejects C0/C1, bidi controls and JS-trim-blank values with
// 422 validation fields.videoId and never echoes the input; admin endpoints reject the same values (no write happens
// because validation fails first). Screens (install-code generator, schedule target/play test) are observed only.
// Token values stay inside the page; only status, code and fields are recorded.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const MUST_REJECT = {
  rlo: 'a1‮qa',
  'lri-pdi': 'a1⁦qa⁩',
  'ideographic-space-only': '　',
  'ideographic-spaces': '　　　',
  'nbsp-only': ' ',
  'bom-only': '﻿',
  'c1-nel': 'a1\u0085qa',
  'c1-csi': 'a1\u009Bqa',
  'c0-bell': 'a1\u0007qa',
  'too-long-129': 'a'.repeat(129),
};
const OBSERVE = {
  valid: 'a1-qa-video-1',
  'angle-bad': '<bad>',
  'len-128': 'b'.repeat(128),
  lrm: 'a1‎qa',
  alm: 'a1؜qa',
  'zwsp-only': '​',
  empty: '',
};
const codepoints = (s) => [...s].filter((c) => c.codePointAt(0) > 0x7e || c.codePointAt(0) < 0x20).map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

function echoes(text, value) {
  if (!value) return false;
  const lower = [...value].map((c) => (c.codePointAt(0) > 0x7e || c.codePointAt(0) < 0x20 ? `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}` : c)).join('');
  const escapedSlash = value.replace(/\//g, '\\/');
  return text.includes(value) || text.includes(lower) || text.toLowerCase().includes(lower.toLowerCase()) || text.includes(escapedSlash) || text.includes(value.replace(/</g, '\\u003C'));
}

const result = { public: {}, admin: {}, screens: {} };

// Public schedule, no cookies.
for (const [key, value] of Object.entries({ ...MUST_REJECT, ...OBSERVE })) {
  const res = await fetch(`${BASE}/api/index.php?action=schedule&videoId=${encodeURIComponent(value)}`);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  result.public[key] = {
    group: key in MUST_REJECT ? 'must-reject' : 'observe',
    codepoints: codepoints(value),
    length: [...value].length,
    status: res.status,
    contentType: res.headers.get('content-type'),
    nosniff: res.headers.get('x-content-type-options'),
    setCookie: res.headers.get('set-cookie') ? 'present' : 'none',
    ok: body?.ok ?? null,
    code: body?.error?.code ?? null,
    fields: body?.error?.fields ?? null,
    message: body?.error?.message ?? null,
    echoesInput: echoes(text, value),
    bodyBytes: text.length,
  };
}

// Admin endpoints in a logged-in page; the CSRF token is read and used inside the page only.
const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
try {
  await login(page);
  await page.goto(`${BASE}/#/creatives`);
  await sleep(800);
  const adminCall = (spec) => page.evaluate(async ({ spec }) => {
    const boot = await fetch('/api/index.php?action=bootstrap', { credentials: 'same-origin' });
    const token = boot.headers.get('x-csrf-token');
    const init = spec.body ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(spec.body) } : { credentials: 'same-origin' };
    const res = await fetch(`/api/index.php?${spec.query}`, init);
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* text */ }
    return { status: res.status, ok: body?.ok ?? null, code: body?.error?.code ?? null, fields: body?.error?.fields ?? null, text };
  }, { spec });
  const record = async (endpoint, key, value, spec) => {
    const r = await adminCall(spec);
    (result.admin[endpoint] ??= {})[key] = { status: r.status, ok: r.ok, code: r.code, fields: r.fields, echoesInput: echoes(r.text, value) };
  };
  for (const [key, value] of Object.entries(MUST_REJECT)) {
    await record('schedule-draft(target video)', key, value, { query: `action=schedule-draft&targetType=video&targetId=${encodeURIComponent(value)}` });
    await record('video-context-save', key, value, { query: 'action=video-context-save', body: { videoId: value, label: 'QA 거부 확인', boardId: 'notice', categoryId: null } });
    await record('schedule-preview(videoId)', key, value, { query: 'action=schedule-preview', body: { target: { type: 'site', id: 'site-local' }, mode: 'disabled', revision: 0, breaks: [], videoId: value } });
    await record('schedule-save(target.id)', key, value, { query: 'action=schedule-save', body: { target: { type: 'video', id: value }, mode: 'inherit', revision: 0, breaks: [] } });
  }
  // Read-only controls with valid values (no saves).
  await record('schedule-draft(target video)', 'valid', 'a1-qa-video-1', { query: 'action=schedule-draft&targetType=video&targetId=a1-qa-video-1' });
  await record('schedule-preview(videoId)', 'valid', 'a1-qa-video-1', { query: 'action=schedule-preview', body: { target: { type: 'site', id: 'site-local' }, mode: 'disabled', revision: 0, breaks: [], videoId: 'a1-qa-video-1' } });
  result.adminWritesAccepted = apiCalls(net).filter((c) => /save|archive|publish|upload|delete|default/.test(c.action) && c.status === 200).map((c) => `${c.method} ${c.action} ${c.status}`);

  // Screen observation 1: install-code generator.
  await page.goto(`${BASE}/#/players/setup`);
  const region = page.getByRole('region', { name: '설치 코드 만들기' });
  await region.waitFor();
  await sleep(800);
  const codeText = () => region.locator('pre, textarea, code').filter({ visible: true }).evaluateAll((els) => els.map((e) => (e.tagName === 'TEXTAREA' ? e.value : e.textContent)).sort((a, b) => b.length - a.length)[0] ?? '');
  for (const key of ['rlo', 'ideographic-space-only', 'c1-nel']) {
    const value = MUST_REJECT[key];
    const box = region.getByRole('textbox', { name: '영상 ID' });
    await box.fill(value);
    await page.keyboard.press('Tab');
    await sleep(500);
    const code = await codeText();
    const line = code.split('\n').find((l) => /video-id|videoId|video=/.test(l)) ?? null;
    result.screens[`setup:${key}`] = {
      invalid: await box.getAttribute('aria-invalid'),
      describedBy: await box.evaluate((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim())),
      alerts: (await region.getByRole('alert').allInnerTexts()).filter(Boolean),
      status: (await region.getByRole('status').allInnerTexts()).filter(Boolean),
      codeShown: Boolean(code),
      videoIdLineCodepoints: line ? codepoints(line) : null,
      videoIdLineLength: line?.length ?? null,
    };
    await page.locator('main').filter({ visible: true }).screenshot({ path: `${(await import('./lib.mjs')).EV}/VID/setup-${key}.png` });
  }

  // Screen observation 2: schedule target with the same values (load uses schedule-draft → 422).
  for (const key of ['rlo', 'ideographic-space-only', 'c1-nel']) {
    await page.goto(`${BASE}/#/schedule`);
    const target = page.getByRole('form', { name: '편집할 대상' });
    await target.waitFor();
    await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
    const idBox = target.getByLabel('고정 대상 ID', { exact: true });
    await idBox.fill(MUST_REJECT[key]);
    const t = net.length ? net[net.length - 1].t + 1 : 0;
    await target.getByRole('button', { name: '편성 불러오기' }).click();
    await sleep(1500);
    result.screens[`schedule-target:${key}`] = {
      api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ` ${c.error.code}` : ''}`),
      alerts: (await page.getByRole('alert').allInnerTexts()).filter(Boolean),
      idInvalid: await idBox.getAttribute('aria-invalid'),
      idDescribedBy: await idBox.evaluate((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim())),
      editorShown: await page.getByRole('form', { name: '광고 편성 편집' }).count(),
      playLinks: await page.getByRole('group', { name: '게시본 재생 테스트' }).getByRole('link').count(),
    };
    await shot(page, `VID/schedule-target-${key}.png`, { fullPage: true });
  }

  // Screen observation 3: the published example page opened directly with a rejected video id.
  const tab = await context.newPage();
  const tabLogs = consoleCollector(tab);
  const t = net.length ? net[net.length - 1].t + 1 : 0;
  await tab.goto(`${BASE}/examples/player.html?video=${encodeURIComponent(MUST_REJECT.rlo)}&content=${encodeURIComponent(`${BASE}/demo-media/grok-20261018/content-scene-01.mp4`)}`);
  await sleep(3000);
  result.screens['example-player:rlo'] = {
    api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ` ${c.error.code}` : ''}`),
    text: (await tab.locator('body').innerText()).slice(0, 600),
    console: tabLogs,
  };
  await tab.screenshot({ path: `${(await import('./lib.mjs')).EV}/VID/example-player-rlo.png` });
  await tab.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'VID/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('VID/result.json', result);
await browser.close();
