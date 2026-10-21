// A2-D-QA-DELTA X08 short regressions: (1) the demo's install code (HTML and JS API, Video.js and 기본 video, and with the
// poster/title options toggled) must not carry the preview-only title "Grok 해안 도시 장면" or examples/sample-poster.svg;
// (2) every 4xx response and console error on the changed screens (editor, built-in screen, schedule preview, demo,
// play-test) is collected with its URL; (3) action=events per page. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { demoState, openDemo, requestLog } from './demo.mjs';

const browser = await launch();
const result = { code: [], pages: [] };
const context = await newContext(browser, { width: 1280, height: 1100 });
const req = requestLog(context);
const bad = [];
context.on('response', (res) => { if (res.status() >= 400) bad.push({ status: res.status(), url: res.url().replace(BASE, ''), frame: (() => { try { return new URL(res.request().frame().url()).pathname; } catch { return null; } })() }); });
const page = await context.newPage();
const logs = consoleCollector(page);
const leaks = (s) => ({ title: /Grok 해안 도시 장면/.test(s ?? ''), poster: /sample-poster/.test(s ?? ''), dataTitle: /data-title|title:/.test(s ?? ''), dataPoster: /data-poster|poster:/.test(s ?? '') });

async function visit(label, fn) {
  const from = { bad: bad.length, logs: logs.length, req: req.all().length };
  try { await fn(); } catch (error) { result.pages.push({ label, error: String(error).slice(0, 600) }); return; }
  result.pages.push({
    label,
    bad: bad.slice(from.bad).map((b) => `${b.status} ${b.url} @${b.frame}`),
    console: logs.slice(from.logs).map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`),
    events: req.all().slice(from.req).filter((x) => /action=events/.test(x.path)).length,
  });
}

await visit('demo videojs (install code)', async () => {
  await openDemo(page);
  const s = await demoState(page);
  result.code.push({ label: 'videojs default', poster: s.poster, title: s.title, titleText: s.titleText, posterUrl: s.posterUrl, html: leaks(s.codeHtml), js: leaks(s.codeJs) });
  await page.locator('#poster').check().catch(() => {});
  await page.locator('#title').check().catch(() => {});
  await sleep(800);
  const t = await demoState(page);
  result.code.push({ label: 'videojs poster+title on', poster: t.poster, title: t.title, titleText: t.titleText, posterUrl: t.posterUrl, html: leaks(t.codeHtml), js: leaks(t.codeJs), htmlSample: (t.codeHtml ?? '').slice(0, 600) });
  const frameAttrs = await page.evaluate(() => { const vp = document.querySelector('#player video-player'); return vp && { contentTitle: vp.getAttribute('content-title'), poster: vp.getAttribute('poster') }; });
  result.code.push({ label: 'demo stage player attributes (poster+title on)', frameAttrs });
  await shot(page, 'X08/demo-code-poster-title-on.png', { fullPage: true });
});
await visit('demo native (install code)', async () => {
  await openDemo(page, '?type=native');
  const s = await demoState(page);
  result.code.push({ label: 'native default', poster: s.poster, posterUrl: s.posterUrl, html: leaks(s.codeHtml), js: leaks(s.codeJs) });
});
await visit('play-test', async () => {
  await page.goto(`${BASE}/examples/play-test.html?video=grok-demo-scene-01&type=videojs`);
  await sleep(3500);
});
await visit('guide + help', async () => {
  for (const p of ['/examples/guide.html', '/examples/help.html']) { await page.goto(`${BASE}${p}`); await sleep(1500); }
});
await visit('admin login', async () => { await login(page); });
await visit('editor p-i0aecb28w3', async () => {
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(4000);
});
await visit('editor native p-pchm59hhyv', async () => {
  await page.goto(`${BASE}/#/players/edit/p-pchm59hhyv`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(4000);
});
await visit('built-in rounded', async () => {
  await page.goto(`${BASE}/#/players/edit/rounded`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(4000);
});
await visit('schedule preview', async () => {
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await page.getByRole('textbox', { name: '고정 영상 ID' }).fill('grok-demo-scene-01');
  await page.getByRole('button', { name: '미리보기 준비' }).click();
  await sleep(5000);
});
await visit('demo while logged in', async () => { await openDemo(page); });

result.allBad = [...new Set(bad.map((b) => `${b.status} ${b.url} @${b.frame}`))];
result.eventsTotal = req.events().length;
await context.close();
save('X08/misc.json', result);
await browser.close();
