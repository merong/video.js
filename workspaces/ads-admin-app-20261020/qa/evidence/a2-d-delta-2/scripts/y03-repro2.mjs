// A2-D-QA-DELTA-2 Y03 repro, second split at 1280×800 (fresh page load per case). y03-repro.mjs showed scenes work again
// when the postroll had ended before the preset changed; y03.mjs and y03-scenes.mjs changed the preset while the postroll
// was playing. Cases:
// (I) rounded 끝 직전 → while 포스트롤 1/1 재생 중, hash → accent → wait 끝남 → 미드롤 앞 (40s) → 끝 직전 (40s) →
//     다시 불러오기 → 미드롤 앞 (40s) → page reload → 미드롤 앞 (40s);
// (J) one preset (accent): 끝 직전 → while 포스트롤 재생 중 click 미드롤 앞 → 40s → 끝 직전 40s;
// (K) rounded 미드롤 앞 → while 미드롤 1/1 재생 중, hash → accent → 40s → 끝 직전 40s.
// The frame document is tagged in-page to tell reuse from rebuild. Nothing is saved.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { cases: [] };
const context = await newContext(browser, { width: 1280, height: 800 });
const req = requestLog(context);
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 200)} @${(m.location()?.url ?? '').replace(BASE, '')}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e).slice(0, 200)}`));
const card = () => page.locator('.sa-ppv').first().locator('xpath=ancestor-or-self::*[contains(@class,"sa-card")]').first();
const now = () => card().locator('.sa-stage-now').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const tagFrame = (name) => frame()?.evaluate((n) => { window.__qaTag = n; return true; }, name).catch(() => false);
const frameState = () => frame()?.evaluate(() => {
  const v = document.querySelector('#player video');
  const vp = document.querySelector('#player video-player');
  return { tag: window.__qaTag ?? null, t: v ? Math.round(v.currentTime * 10) / 10 : null, paused: v?.paused ?? null, ended: v?.ended ?? null, videos: document.querySelectorAll('#player video').length, accent: vp ? getComputedStyle(vp).getPropertyValue('--media-color-primary').trim() || null : null };
}).catch(() => null) ?? Promise.resolve(null);

// A match must be a line different from the one shown when the wait started (the line carries a time).
async function until(test, seconds = 40) {
  const trace = [];
  const before = await now();
  for (let i = 0; i < seconds; i++) {
    const n = await now();
    if (i % 5 === 0) { const f = await frameState(); trace.push([i, n, f?.t, f?.paused]); }
    if (test.test(n ?? '') && n !== before) return { ok: true, at: i, now: n, trace };
    await sleep(1000);
  }
  return { ok: false, now: await now(), frame: await frameState(), trace };
}
async function scene(name) {
  const b = card().locator('.sa-stage-tools button', { hasText: name });
  const end = Date.now() + 20000;
  while (Date.now() < end && !(await b.isEnabled().catch(() => false))) await sleep(300);
  await b.click();
}
async function fresh(id) {
  await page.goto(`${BASE}/#/players/edit/${id}`);
  await page.reload();
  await page.locator('.sa-stage-tools').first().waitFor({ timeout: 20000 });
  await sleep(2500);
}
async function hash(id) {
  await page.evaluate((id) => { location.hash = `#/players/edit/${id}`; }, id);
  await page.waitForFunction((id) => location.hash.endsWith(id), id);
  await sleep(1000);
}
async function run(label, fn) {
  const c = { label };
  const from = logs.length;
  try { await fn(c); } catch (error) { c.error = String(error).slice(0, 800); }
  c.console = logs.slice(from);
  result.cases.push(c);
}

await login(page);

await run('I rounded 포스트롤 재생 중 → hash accent → 끝남 → 미드롤 앞 / 끝 직전 / 다시 불러오기 / reload', async (c) => {
  await fresh('rounded');
  await tagFrame('rounded');
  await scene('끝 직전');
  c.postPlaying = await until(/포스트롤 1\/1 재생 중/, 50);
  await hash('accent');
  c.afterHash = { now: await now(), frame: await frameState() };
  c.ended = await until(/끝남/, 30);
  await scene('미드롤 앞');
  c.mid = await until(/미드롤 1\/1 재생 중/, 40);
  await shot(page, 'Y03/repro2-I-mid.png');
  await scene('끝 직전');
  c.end = await until(new RegExp(`포스트롤 1/1 재생 중`), 40);
  await scene('다시 불러오기');
  await sleep(3000);
  c.afterReloadButton = { now: await now(), frame: await frameState() };
  await scene('미드롤 앞');
  c.midAfterReloadButton = await until(/미드롤 1\/1 재생 중/, 40);
  await page.reload();
  await page.locator('.sa-stage-tools').first().waitFor({ timeout: 20000 });
  await sleep(2500);
  c.afterPageReload = { now: await now(), frame: await frameState() };
  await scene('미드롤 앞');
  c.midAfterPageReload = await until(/미드롤 1\/1 재생 중/, 40);
});

await run('J accent only: 포스트롤 재생 중 → 미드롤 앞 → 끝 직전', async (c) => {
  await fresh('accent');
  await scene('끝 직전');
  c.postPlaying = await until(/포스트롤 1\/1 재생 중/, 50);
  await scene('미드롤 앞');
  c.mid = await until(/미드롤 1\/1 재생 중/, 40);
  await scene('끝 직전');
  c.end = await until(/포스트롤 1\/1 재생 중/, 40);
});

await run('K rounded 미드롤 재생 중 → hash accent → 끝 직전', async (c) => {
  await fresh('rounded');
  await scene('미드롤 앞');
  c.midPlaying = await until(/미드롤 1\/1 재생 중/, 50);
  await hash('accent');
  c.afterHash = { now: await now(), frame: await frameState() };
  c.settle = await until(/끝남|오류/, 30);
  await scene('끝 직전');
  c.end = await until(/포스트롤 1\/1 재생 중/, 40);
  await scene('미드롤 앞');
  c.mid = await until(/미드롤 1\/1 재생 중/, 40);
});

result.events = req.events().length;
await context.close();
save('Y03/repro2.json', result);
await browser.close();
