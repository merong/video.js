// A2-D-QA-DELTA-2 Y03 repro split at 1280×800 — each case starts from a fresh page load (page.reload after the hash):
// (D) one built-in (accent): 끝 직전 → wait until 포스트롤 · 끝남 → 미드롤 앞; (E) then 다시 불러오기 → 미드롤 앞;
// (F) rounded 끝 직전 until 끝남 → hash to accent: the line, the frame document (same or new) and 미드롤 앞;
// (G) editor p-i0aecb28w3 끝 직전 until 끝남 → hash to p-lc3i8eidb4 (QA 자동재생) → 미드롤 앞;
// (H) editor p-i0aecb28w3 → hash to built-in accent (no ads played) → 미드롤 앞 (control).
// The frame document is tagged in-page to tell reuse from rebuild. Nothing is saved.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { cases: [] };
const context = await newContext(browser, { width: 1280, height: 800 });
const req = requestLog(context);
const page = await context.newPage();
const card = () => page.locator('.sa-ppv').first().locator('xpath=ancestor-or-self::*[contains(@class,"sa-card")]').first();
const now = () => card().locator('.sa-stage-now').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const tagFrame = (name) => frame()?.evaluate((n) => { window.__qaTag = n; return true; }, name).catch(() => false);
const frameState = () => frame()?.evaluate(() => {
  const v = document.querySelector('#player video');
  return { tag: window.__qaTag ?? null, q: location.search.replace(/[?&](sig|token|csrf)=[^&]*/g, ''), t: v ? Math.round(v.currentTime * 10) / 10 : null, paused: v?.paused ?? null, ended: v?.ended ?? null };
}).catch(() => null) ?? Promise.resolve(null);

async function until(test, seconds = 40) {
  const trace = [];
  for (let i = 0; i < seconds; i++) {
    const n = await now();
    if (i % 4 === 0) trace.push([i, n, (await frameState())?.t]);
    if (test.test(n ?? '')) return { ok: true, at: i, now: n, trace };
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
  await sleep(2500);
}

async function run(label, fn) {
  const c = { label };
  try { await fn(c); } catch (error) { c.error = String(error).slice(0, 800); }
  result.cases.push(c);
}

await login(page);

await run('D/E accent: 끝 직전 → 끝남 → 미드롤 앞, then 다시 불러오기 → 미드롤 앞', async (c) => {
  await fresh('accent');
  c.initial = await now();
  await scene('끝 직전');
  c.endPlaying = await until(/포스트롤 1\/1 재생 중/);
  c.ended = await until(/포스트롤 1\/1 · 끝남/);
  await scene('미드롤 앞');
  c.midAfterEnd = await until(/미드롤 1\/1 재생 중/, 30);
  await shot(page, 'Y03/repro-D-mid-after-end.png');
  await tagFrame('before-reload');
  await scene('다시 불러오기');
  await sleep(2500);
  c.afterReload = { now: await now(), frame: await frameState() };
  await scene('미드롤 앞');
  c.midAfterReload = await until(/미드롤 1\/1 재생 중/, 40);
});

await run('F rounded 끝남 → hash accent → 미드롤 앞', async (c) => {
  await fresh('rounded');
  await scene('끝 직전');
  c.ended = await until(/포스트롤 1\/1 · 끝남/, 50);
  await tagFrame('rounded');
  await hash('accent');
  c.afterHash = { now: await now(), frame: await frameState(), note: await page.locator('.aa-builtin .sa-note').first().innerText().catch(() => null) };
  await scene('미드롤 앞');
  c.mid = await until(/미드롤 1\/1 재생 중/, 30);
  await shot(page, 'Y03/repro-F-accent.png');
});

await run('G editor p-i0aecb28w3 끝남 → hash p-lc3i8eidb4 → 미드롤 앞', async (c) => {
  await fresh('p-i0aecb28w3');
  await scene('끝 직전');
  c.ended = await until(/포스트롤 1\/1 · 끝남/, 50);
  await tagFrame('p-i0aecb28w3');
  await hash('p-lc3i8eidb4');
  c.afterHash = { now: await now(), frame: await frameState(), name: await page.locator('#aa-preset-name').inputValue().catch(() => null) };
  await scene('미드롤 앞');
  c.mid = await until(/미드롤 1\/1 재생 중/, 40);
});

await run('H control: editor p-i0aecb28w3 (no ads) → hash accent → 미드롤 앞', async (c) => {
  await fresh('p-i0aecb28w3');
  await tagFrame('editor');
  await hash('accent');
  c.afterHash = { now: await now(), frame: await frameState() };
  await scene('미드롤 앞');
  c.mid = await until(/미드롤 1\/1 재생 중/, 40);
});

result.events = req.events().length;
await context.close();
save('Y03/repro.json', result);
await browser.close();
