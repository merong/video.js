// A1-QA-DELTA HL07 (R3-12): pausing shows one finished picture (no animation, base markup visible) even when paused
// in the near-empty start of the cycle; pressing again restarts from the beginning; offscreen pauses in place.
// Also forced-colors: the pressed pause button gets an outline. Read-only.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 900 });
const page = await context.newPage();
const result = { terms: {} };
const fig = (id) => page.locator(`article[aria-labelledby="sa-help-${id}"] figure`);
const read = (id) => page.evaluate((termId) => {
  const f = document.querySelector(`article[aria-labelledby="sa-help-${termId}"] figure`);
  const stage = f.querySelector('.sa-motion-stage');
  const anims = f.getAnimations({ subtree: true });
  const shown = [...stage.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  }).length;
  return {
    cls: f.className.replace('sa-motion ', ''),
    anims: anims.length,
    states: [...new Set(anims.map((a) => a.playState))],
    t: anims.slice(0, 3).map((a) => Math.round(a.currentTime ?? -1)),
    shownElements: shown,
    totalElements: stage.querySelectorAll('*').length,
    pressed: f.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed') ?? null,
  };
}, id);

try {
  await login(page);
  await page.goto(`${BASE}/#/help`);
  await sleep(1500);
  for (const id of ['ad-break', 'mid-roll', 'skip-offset']) {
    const r = {};
    await fig(id).scrollIntoViewIfNeeded();
    const group = fig(id).getByRole('group');
    // Restart, then pause right away (0-3% of the 8s cycle is the near-empty frame).
    await group.getByRole('button', { name: '다시 보기' }).click();
    await sleep(80);
    r.justRestarted = await read(id);
    await group.getByRole('button', { name: '일시정지' }).click();
    await sleep(150);
    r.pausedEarly = await read(id);
    await fig(id).screenshot({ path: `${process.env.EV_DIR}/HL07/${id}-paused-early.png` });
    await sleep(1500);
    r.pausedLater = await read(id);
    // Press again: plays from the start.
    await group.getByRole('button', { name: '일시정지' }).click();
    await sleep(100);
    r.resumed = await read(id);
    await sleep(2500);
    r.resumedLater = await read(id);
    // Pause mid-cycle too.
    await group.getByRole('button', { name: '일시정지' }).click();
    await sleep(150);
    r.pausedMid = await read(id);
    await fig(id).screenshot({ path: `${process.env.EV_DIR}/HL07/${id}-paused-mid.png` });
    await group.getByRole('button', { name: '일시정지' }).click();
    result.terms[id] = r;
  }

  // Offscreen: pauses in place, resumes from there.
  const id = 'ad-break';
  await fig(id).scrollIntoViewIfNeeded();
  await sleep(1200);
  const off = { visible: await read(id) };
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(500);
  off.off1 = await read(id);
  await sleep(2000);
  off.off2 = await read(id);
  await fig(id).scrollIntoViewIfNeeded();
  await sleep(300);
  off.back = await read(id);
  result.offscreen = off;

  // Forced colors: pressed pause gets a Highlight outline.
  await page.emulateMedia({ forcedColors: 'active' });
  await fig(id).scrollIntoViewIfNeeded();
  const pause = fig(id).getByRole('group').getByRole('button', { name: '일시정지' });
  const style = () => pause.evaluate((b) => ({ pressed: b.getAttribute('aria-pressed'), outline: getComputedStyle(b).outlineStyle + ' ' + getComputedStyle(b).outlineWidth + ' ' + getComputedStyle(b).outlineColor }));
  result.forcedColors = { matches: await page.evaluate(() => matchMedia('(forced-colors: active)').matches), before: await style() };
  await pause.click();
  await page.mouse.move(0, 0);
  await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
  await sleep(200);
  result.forcedColors.pressed = await style();
  await fig(id).screenshot({ path: `${process.env.EV_DIR}/HL07/forced-colors-pressed.png` });
  await pause.click();
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('HL07/result.json', result);
await browser.close();
