// A2-D-QA-DELTA X01 race 2: gap-0 double toggles (포스터 표시 then 제목 표시), 20 rounds, up to 40 s each. For every round
// the frame requests and the parent's stage status lines are logged with times, to see what a slow rebuild waits on.
import { BASE, launch, newContext, login, save, sleep, EV } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
let t0 = Date.now();
let reqs = [];
context.on('request', (r) => { const f = r.frame()?.url() ?? ''; if (f.includes('preview.html')) reqs.push(`+${Date.now() - t0} ${r.method()} ${new URL(r.url()).pathname}${new URL(r.url()).search.slice(0, 40)}`); });
context.on('requestfinished', (r) => { const f = r.frame()?.url() ?? ''; if (f.includes('preview.html') && /mp4|schedule|preset/.test(r.url())) reqs.push(`+${Date.now() - t0} done ${new URL(r.url()).pathname.split('/').pop()}`); });
context.on('requestfailed', (r) => reqs.push(`+${Date.now() - t0} FAILED ${new URL(r.url()).pathname.split('/').pop()} ${r.failure()?.errorText}`));
const lines = [];
page.on('console', (m) => lines.push(`+${Date.now() - t0} ${m.type()}: ${m.text().slice(0, 200)}`));
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const state = () => frame()?.evaluate(() => ({ video: Boolean(document.querySelector('#player video')), html: (document.querySelector('#player')?.innerHTML ?? '').length })).catch((e) => ({ err: String(e).slice(0, 80) }));
const result = { rounds: [] };
try {
  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(3500);
  for (let i = 0; i < 20; i++) {
    reqs = [];
    lines.length = 0;
    t0 = Date.now();
    await page.locator('#aa-preset-display-poster').click();
    await page.locator('#aa-preset-display-title').click();
    const samples = [];
    let s = await state();
    while (!s?.video && Date.now() - t0 < 40000) { await sleep(250); s = await state(); if (samples.length < 6 || !s?.video) samples.push(`+${Date.now() - t0} ${JSON.stringify(s)}`); }
    const ms = Date.now() - t0;
    const r = { i, ms, ok: Boolean(s?.video) };
    if (ms > 3000) { r.reqs = reqs.slice(); r.console = lines.slice(); r.samples = samples.filter((_, k) => k % 8 === 0).slice(0, 12); r.stage = (await page.locator('aside.aa-editor-preview').innerText()).replace(/\s+/g, ' ').slice(0, 160); }
    result.rounds.push(r);
    await sleep(1500);
  }
} catch (error) {
  result.error = String(error).slice(0, 1200);
}
result.ms = result.rounds.map((r) => r.ms);
save('X01/race2.json', result);
await browser.close();
