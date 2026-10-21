// PL15: install code generator. Four codes, native has no HLS, absolute or root paths, escaping, copy status.
// The system clipboard is never touched: navigator.clipboard.writeText is stubbed (D4) and records the call.
import fs from 'node:fs';
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1600 });
await context.addInitScript(() => {
  window.__qaClipboard = [];
  window.__qaClipboardMode = 'resolve';
  const stub = async (text) => {
    window.__qaClipboard.push({ length: String(text).length, mode: window.__qaClipboardMode });
    if (window.__qaClipboardMode === 'reject') throw new DOMException('denied by QA stub', 'NotAllowedError');
  };
  try {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: stub, write: stub } });
  } catch {
    /* keep default */
  }
});
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { codes: {} };
const region = () => page.getByRole('region', { name: '설치 코드 만들기' });

async function code() {
  return region().locator('pre, textarea, code').filter({ visible: true }).evaluateAll((els) => els.map((e) => (e.tagName === 'TEXTAREA' ? e.value : e.textContent)).sort((a, b) => b.length - a.length)[0] ?? null);
}
async function state() {
  return {
    media: await region().getByRole('radio').evaluateAll((els) => els.map((r) => `${r.closest('label')?.textContent.trim() || r.value}${r.checked ? ' [checked]' : ''}${r.disabled ? ' [disabled]' : ''}`)),
    status: (await region().getByRole('status').allInnerTexts()).filter(Boolean),
    alert: (await region().getByRole('alert').allInnerTexts()).filter(Boolean),
  };
}
async function make(key, { preset, videoId, media }) {
  if (preset) await region().getByRole('combobox', { name: '프리셋' }).selectOption({ label: preset });
  if (videoId !== undefined) await region().getByRole('textbox', { name: '영상 ID' }).fill(videoId);
  if (media) {
    const radio = region().getByRole('radio', { name: media, exact: true });
    if (await radio.isEnabled()) await radio.check();
  }
  await sleep(500);
  const text = await code();
  const s = await state();
  if (text) fs.writeFileSync(`${EV}/PL15/code-${key}.html`, text);
  result.codes[key] = { ...s, saved: Boolean(text), length: text?.length ?? 0 };
  return text;
}

try {
  await login(page);
  await page.goto(`${BASE}/#/players/setup`);
  await region().waitFor();
  await sleep(1000);
  result.initial = { selectedPreset: await region().getByRole('combobox', { name: '프리셋' }).evaluate((s) => s.selectedOptions[0].textContent), contentUrl: await region().getByRole('textbox', { name: '본편 URL' }).inputValue(), ...(await state()), code: await code() };
  if (process.env.EXTRA) {
    await make('native-mp4-escape', { preset: 'QA 기본 video', videoId: 'qa"<x>&1', media: 'MP4' });
    await make('builtin-default-mp4', { preset: '기본', videoId: 'a1-qa-preset-1', media: 'MP4' });
    result.langNotice = (await region().innerText()).split('\n').filter((l) => /lang/.test(l));
    await page.locator('main').filter({ visible: true }).screenshot({ path: `${EV}/PL15/builtin-default.png` });
    throw new Error('EXTRA done');
  }
  await make('videojs-mp4', { preset: 'QA Video.js 중립 v2 (기본 프리셋)', videoId: 'a1-qa-preset-1', media: 'MP4' });
  await make('videojs-hls-spf', { media: 'HLS · SPF' });
  await make('videojs-hls-hlsjs', { media: 'HLS · hls.js' });
  await make('native-mp4', { preset: 'QA 기본 video', media: 'MP4' });
  result.nativeHlsTry = await (async () => {
    const radio = region().getByRole('radio', { name: 'HLS · SPF', exact: true });
    return { count: await radio.count(), enabled: (await radio.count()) ? await radio.isEnabled() : null };
  })();
  await page.locator('main').filter({ visible: true }).screenshot({ path: `${EV}/PL15/native.png` });
  await make('videojs-mp4-escape', { preset: 'QA Video.js 중립 v2 (기본 프리셋)', videoId: 'qa"<x>&1', media: 'MP4' });
  await page.locator('main').filter({ visible: true }).screenshot({ path: `${EV}/PL15/escape.png` });

  // Copy: success path, then a rejected clipboard.
  const copy = region().getByRole('button', { name: /복사/ });
  result.copyButtons = await copy.allInnerTexts();
  await copy.first().click();
  await sleep(600);
  result.copyResolve = { calls: await page.evaluate(() => window.__qaClipboard), ...(await state()), pageStatus: (await page.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts()).filter(Boolean) };
  await page.evaluate(() => (window.__qaClipboardMode = 'reject'));
  await copy.first().click();
  await sleep(600);
  result.copyReject = { calls: await page.evaluate(() => window.__qaClipboard), ...(await state()), pageStatus: (await page.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts()).filter(Boolean) };
  await page.locator('main').filter({ visible: true }).screenshot({ path: `${EV}/PL15/copy-reject.png` });
  result.api = apiCalls(net).map((c) => `${c.method} ${c.action} ${c.status}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await page.screenshot({ path: `${EV}/PL15/error.png`, fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL15/result.json', result);
await browser.close();
