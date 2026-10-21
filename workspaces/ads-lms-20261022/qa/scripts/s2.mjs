// L-3-QA scenario 2: "본 곳까지만" + max rate 1.5 + completion 50 (demo options), no token. `node s2.mjs webkit` once.
import { BASE, launch, consoleCollector, save, shot, sleep, video } from './lib.mjs';

const engine = process.argv[2] ?? 'chromium';
const b = await launch(engine);
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = consoleCollector(page);
const r = { engine, steps: {} };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };
const player = page.getByRole('group', { name: '미디어 플레이어' });
const panel = page.getByRole('region', { name: '강의 진도와 자료' });
const blockedToast = () => page.getByText(/아직 보지 않은 구간이에요/).count();
const blockedEvents = () => page.evaluate(() => window.__qaBlocked.length);

try {
  await page.addInitScript(() => { window.__qaBlocked = []; document.addEventListener('solad-lms-seek-blocked', (e) => window.__qaBlocked.push(e.detail), true); });
  await page.goto(`${BASE}/examples/lecture.html`);
  await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
  await page.locator('input[name=seekLimit][value=watched]').check();
  await page.locator('input[name=maxRate][value="1.5"]').check();
  await page.locator('#completion').fill('50');
  await page.locator('#completion').dispatchEvent('change');
  await sleep(2000);
  await player.getByRole('button', { name: '재생', exact: true }).click();
  await sleep(500);

  // Rate: the menu lists nothing above 1.5 and ">" stops at 1.5.
  await player.getByRole('button', { name: '설정' }).click();
  await player.getByRole('menuitem', { name: /속도/ }).click();
  await sleep(400);
  const rates = (await player.getByRole('menuitemradio').allTextContents()).map((s) => s.replace(/\s+/g, ''));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await player.getByRole('slider', { name: '탐색' }).focus();
  const seen = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Shift+Period'); await sleep(150); seen.push((await video(page)).rate); }
  step('rate menu has no value above 1.5 and ">" stops at 1.5', rates.length > 0 && !rates.some((x) => /^(1\.7|2)×?$/.test(x)) && Math.max(...seen) === 1.5 && seen.at(-1) === 1.5, { rates, seen });

  await sleep(3000);
  // Each attempt 2.2 s apart: the notice and the event share a 2 s throttle (lms.js blocked()).
  const attempts = [];
  const attempt = async (label, act) => {
    await sleep(2200);
    const before = await video(page);
    const ev0 = await blockedEvents();
    await player.hover({ position: { x: 300, y: 100 } }); await sleep(300);
    await act();
    await sleep(500);
    const after = await video(page);
    const evs = await page.evaluate((n) => window.__qaBlocked.slice(n), ev0);
    attempts.push({ label, before: before.t, after: after.t, jump: Math.round((after.t - before.t) * 10) / 10, event: evs[0] ?? null, toast: await blockedToast() });
  };
  await attempt('slider click 85%', async () => { const bx = await player.locator('media-time-slider').first().boundingBox(); await page.mouse.click(bx.x + bx.width * 0.85, bx.y + bx.height / 2); });
  await shot(page, `s2-${engine}-blocked.png`);
  await attempt('→ key', async () => { await player.getByRole('button', { name: '음소거' }).focus(); await page.keyboard.press('ArrowRight'); });
  await attempt('+10s button', () => player.getByRole('button', { name: '10초 앞으로 탐색' }).click());
  step('seek past watched stops at the limit (slider, →, +10s) with a notice and event', attempts.every((a) => a.event && a.after - a.event.allowed <= 1.5 && a.event && a.event.requested > a.event.allowed && a.toast > 0), attempts);

  // Completion at 50% of 80 s at 1.5×.
  const percent = async () => Number((await panel.locator('strong').first().textContent()).match(/\d+/)[0]);
  const end = Date.now() + 90000;
  while (Date.now() < end && (await percent()) < 50) await sleep(1000);
  await sleep(800);
  const head = (await panel.innerText()).split('\n').slice(0, 4).join(' | ');
  const ev1 = await blockedEvents();
  await player.hover({ position: { x: 300, y: 100 } }); await sleep(300);
  const bx = await player.locator('media-time-slider').first().boundingBox();
  await page.mouse.click(bx.x + bx.width * 0.9, bx.y + bx.height / 2);
  await sleep(800);
  const unlocked = await video(page);
  const ev2 = await blockedEvents();
  step('limit lifts after completion', /완료/.test(head.replace('완료 기준', '')) && unlocked.t > 65 && ev2 === ev1, { head, afterSliderTo90pct: unlocked.t, blockedEventsAfterCompletion: ev2 - ev1 });
} catch (e) {
  r.error = String(e).slice(0, 800);
  console.log('ERROR', r.error);
  await shot(page, `s2-${engine}-error.png`);
}
r.consoleErrors = errors;
save(`s2-${engine}.json`, r);
await b.close();
