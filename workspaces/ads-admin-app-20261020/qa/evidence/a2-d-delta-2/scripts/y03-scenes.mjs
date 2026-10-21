// A2-D-QA-DELTA-2 Y03 follow-up: in y03.mjs 미드롤 앞 on accent (reached from rounded after its 끝 직전 and demo popup)
// left 최근 광고 진행 at 포스트롤 1/1 · 끝남 for 30s. Repeat at 1280×800: (A) accent loaded directly, (B) the same order as
// y03 (rounded 미드롤 앞 → 끝 직전 → popup → accent 미드롤 앞), (C) rounded 끝 직전 → accent by hash. Each step reads the line
// and the frame's URL/media state every second. Console 404s keep their location URL. Nothing is saved.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { runs: [] };
const context = await newContext(browser, { width: 1280, height: 800 });
const req = requestLog(context);
const page = await context.newPage();
const consoleLog = [];
page.on('console', (m) => { if (m.type() === 'error') consoleLog.push({ text: m.text().slice(0, 160), url: m.location()?.url?.replace(BASE, '') ?? null }); });
const card = page.locator('section.aa-builtin-preview');
const now = () => card.locator('.sa-stage-now').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null);
const frameInfo = () => page.frames().find((f) => f.url().includes('/examples/preview.html'))?.evaluate(() => {
  const v = document.querySelector('#player video');
  return { q: location.search.slice(0, 120), t: v ? Math.round(v.currentTime * 10) / 10 : null, paused: v?.paused ?? null, dur: v ? Math.round(v.duration) : null };
}).catch(() => null) ?? Promise.resolve(null);

async function watch(label, seconds, until) {
  const trace = [];
  for (let i = 0; i < seconds; i++) {
    const n = await now();
    trace.push({ s: i, now: n, frame: await frameInfo() });
    if (until?.test(n ?? '')) break;
    await sleep(1000);
  }
  return { label, last: trace.at(-1)?.now, steps: trace.length, trace: trace.filter((_, i) => i % 3 === 0 || i === trace.length - 1) };
}
async function scene(name) {
  const b = card.locator('.sa-stage-tools button', { hasText: name });
  const end = Date.now() + 20000;
  while (Date.now() < end && !(await b.isEnabled().catch(() => false))) await sleep(300);
  await b.click();
}
async function open(id, how = 'goto') {
  if (how === 'goto') await page.goto(`${BASE}/#/players/edit/${id}`);
  else await page.evaluate((id) => { location.hash = `#/players/edit/${id}`; }, id);
  await card.waitFor({ timeout: 15000 });
  await page.waitForFunction((id) => location.hash.endsWith(id), id);
  await sleep(2000);
}

try {
  await login(page);
  // (A) accent direct.
  await open('accent');
  const a = { run: 'A accent direct', initial: await now() };
  await scene('미드롤 앞');
  a.mid = await watch('미드롤 앞', 40, /미드롤/);
  await scene('끝 직전');
  a.end = await watch('끝 직전', 40, /포스트롤 1\/1 재생 중/);
  result.runs.push(a);

  // (B) y03 order.
  await open('rounded');
  const b = { run: 'B rounded → popup → accent (goto)', initial: await now() };
  await scene('미드롤 앞');
  b.roundedMid = await watch('rounded 미드롤 앞', 40, /미드롤/);
  await scene('끝 직전');
  b.roundedEnd = await watch('rounded 끝 직전', 40, /포스트롤 1\/1 재생 중/);
  const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 10000 }), card.getByRole('link', { name: /데모에서 열기/ }).click()]);
  await popup.waitForLoadState();
  await sleep(1500);
  await popup.close();
  await open('accent');
  b.accentInitial = await now();
  await scene('미드롤 앞');
  b.accentMid = await watch('accent 미드롤 앞', 40, /미드롤/);
  await shot(page, 'Y03/scenes-B-accent.png');
  result.runs.push(b);

  // (C) rounded 끝 직전 → accent by hash, no popup.
  await open('rounded');
  const c = { run: 'C rounded 끝 직전 → accent (hash)' };
  await scene('끝 직전');
  c.roundedEnd = await watch('rounded 끝 직전', 40, /포스트롤 1\/1 재생 중/);
  await open('accent', 'hash');
  c.accentInitial = await now();
  await scene('미드롤 앞');
  c.accentMid = await watch('accent 미드롤 앞', 40, /미드롤/);
  await shot(page, 'Y03/scenes-C-accent.png');
  result.runs.push(c);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'Y03/scenes-error.png', { fullPage: true }).catch(() => {});
}
result.console = consoleLog;
result.events = req.events().length;
await context.close();
save('Y03/scenes-followup.json', result);
await browser.close();
