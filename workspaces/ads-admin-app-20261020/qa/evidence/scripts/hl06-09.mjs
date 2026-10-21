// HL06 API 0 on help, HL07 pause/replay, HL08 offscreen pause, HL09 reduced motion.
import { BASE, EV, launch, newContext, login, recordNetwork, apiCalls, consoleCollector, save, sleep } from './lib.mjs';

const browser = await launch();
const result = { HL06: {}, HL07: {}, HL08: {}, HL09: {} };

const fig = (page, id) => page.locator(`article[aria-labelledby="sa-help-${id}"] figure`);
const times = (page, id) => page.evaluate((termId) => {
  const f = document.querySelector(`article[aria-labelledby="sa-help-${termId}"] figure`);
  return { cls: f.className, anims: f.getAnimations({ subtree: true }).map((a) => ({ t: Math.round(a.currentTime ?? -1), s: a.playState })) };
}, id);
const sum = (r) => ({ cls: r.cls, n: r.anims.length, states: [...new Set(r.anims.map((a) => a.s))], t: r.anims.slice(0, 3).map((a) => a.t) });

// HL06 + HL07 + HL08 share one session.
{
  const context = await newContext(browser, { height: 900 });
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  try {
    await login(page);
    await page.goto(`${BASE}/#/dashboard`);
    await sleep(1500);
    const mark = net.length ? net[net.length - 1].t + 1 : 0;
    await page.getByRole('banner').getByRole('link', { name: '도움말', exact: true }).click();
    await sleep(1000);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(800);
    const filters = page.getByRole('group', { name: '용어 분류' }).getByRole('button');
    const fcount = await filters.count();
    result.HL06.filterPressed = [];
    for (let i = 1; i < fcount; i++) {
      await filters.nth(i).click();
      await sleep(250);
      result.HL06.filterPressed.push({ label: await filters.nth(i).innerText(), pressed: await filters.nth(i).getAttribute('aria-pressed'), visibleTerms: await page.locator('article.sa-term').filter({ visible: true }).count() });
    }
    await filters.nth(0).click();
    await sleep(300);

    // HL07 (1)(2) on three looping motions, measured inside the same HL06 window.
    for (const id of ['ad-break', 'mid-roll', 'skip-offset']) {
      await fig(page, id).scrollIntoViewIfNeeded();
      await sleep(600);
      const ctrl = page.getByRole('group', { name: new RegExp(`그림 조작$`) }).filter({ has: page.locator('xpath=.') });
      const group = fig(page, id).getByRole('group');
      const r = { group: await group.getAttribute('aria-label') };
      r.running = sum(await times(page, id));
      await group.getByRole('button', { name: '일시정지' }).click();
      await sleep(200);
      r.pressedAfterPause = await group.getByRole('button', { name: '일시정지' }).getAttribute('aria-pressed').catch(() => null);
      r.pausedLabel = await group.getByRole('button').first().innerText();
      r.paused1 = sum(await times(page, id));
      await sleep(2000);
      r.paused2 = sum(await times(page, id));
      await group.getByRole('button').first().click();
      await sleep(1000);
      r.pressedAfterResume = await group.getByRole('button').first().getAttribute('aria-pressed');
      r.resumed = sum(await times(page, id));
      await sleep(1500);
      r.beforeReplay = sum(await times(page, id));
      await group.getByRole('button', { name: '다시 보기' }).click();
      await sleep(50);
      r.afterReplay = sum(await times(page, id));
      void ctrl;
      result.HL07[id] = r;
    }
    // HL07 (3): once figures have replay only.
    result.HL07.onceControls = await page.locator('figure.sa-motion.is-once').evaluateAll((fs) => fs.map((f) => ({ group: f.querySelector('[role=group]')?.getAttribute('aria-label'), buttons: [...f.querySelectorAll('button')].map((b) => b.textContent.trim()) })));
    result.HL07.loopControls = await page.locator('figure.sa-motion:not(.is-once)').evaluateAll((fs) => fs.map((f) => ({ group: f.querySelector('[role=group]')?.getAttribute('aria-label'), buttons: [...f.querySelectorAll('button')].map((b) => b.textContent.trim()) })));
    result.HL07.animDurations = await page.evaluate(() => [...document.querySelectorAll('figure.sa-motion')].map((f) => {
      const a = f.getAnimations({ subtree: true });
      const timing = a[0]?.effect?.getComputedTiming();
      return { term: f.closest('article')?.getAttribute('aria-labelledby')?.replace('sa-help-', ''), once: f.classList.contains('is-once'), iterations: timing?.iterations ?? null, durationMs: timing?.duration ?? null, endTime: timing?.endTime ?? null };
    }));

    // HL06: five term links, then count API after the menu entry.
    const flow = page.getByRole('list', { name: '기본 작업 순서' }).getByRole('link');
    for (let i = 0; i < 5; i++) {
      await flow.nth(i).click();
      await sleep(500);
    }
    result.HL06.hashAfterLinks = new URL(page.url()).hash;
    result.HL06.apiAfterMenuEntry = apiCalls(net, mark).map((c) => `${c.method} ${c.action} ${c.status}`);

    // HL08: ad-break offscreen.
    await page.goto(`${BASE}/#/help/ad-break`);
    await sleep(1200);
    result.HL08.visible = sum(await times(page, 'ad-break'));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(800);
    result.HL08.off1 = sum(await times(page, 'ad-break'));
    await sleep(2000);
    result.HL08.off2 = sum(await times(page, 'ad-break'));
    await fig(page, 'ad-break').scrollIntoViewIfNeeded();
    await sleep(300);
    result.HL08.back1 = sum(await times(page, 'ad-break'));
    await sleep(1200);
    result.HL08.back2 = sum(await times(page, 'ad-break'));

    // HL06 reload rule.
    const mark2 = net.length ? net[net.length - 1].t + 1 : 0;
    await page.reload();
    await sleep(2000);
    result.HL06.apiAfterReload = apiCalls(net, mark2).map((c) => `${c.method} ${c.action} ${c.status}`);
    result.HL06.focusAfterReload = await page.evaluate(() => document.activeElement?.id);
    save('HL06/network-all.json', net.map((e) => ({ t: e.t, method: e.method, type: e.type, status: e.status, url: e.url.replace(BASE, '') })));
  } catch (error) {
    result.error = String(error).slice(0, 1500);
    await page.screenshot({ path: `${EV}/HL07/error.png` }).catch(() => {});
  }
  result.console = logs;
  await context.close();
}

// HL09: reduced motion.
{
  const context = await newContext(browser, { height: 900 });
  const page = await context.newPage();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page);
    await page.goto(`${BASE}/#/help`);
    await sleep(1500);
    const read = () => page.evaluate(() => {
      const figs = [...document.querySelectorAll('figure.sa-motion')];
      return {
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        figures: figs.length,
        running: document.getAnimations().filter((a) => a.playState === 'running').length,
        allAnims: document.getAnimations().length,
        controls: figs.reduce((n, f) => n + [...f.querySelectorAll('button')].filter((b) => b.getClientRects().length).length, 0),
        emptyStages: figs.filter((f) => !f.querySelector('.sa-motion-stage')?.getBoundingClientRect().height).length,
        bodies: document.querySelectorAll('article.sa-term p.sa-body').length,
        sampleFill: getComputedStyle(document.querySelector('.sa-mo-fill5') ?? document.body).transform + ' / ' + getComputedStyle(document.querySelector('.sa-mo-fill5') ?? document.body).width,
      };
    });
    result.HL09.reduce = await read();
    await page.locator('article[aria-labelledby="sa-help-ad-break"]').screenshot({ path: `${EV}/HL09/reduce-ad-break.png` });
    await page.locator('article[aria-labelledby="sa-help-creative-source"]').screenshot({ path: `${EV}/HL09/reduce-creative-source.png` });
    await page.screenshot({ path: `${EV}/HL09/reduce-help.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await sleep(1200);
    result.HL09.switchedToNoPreference = await read();
  } catch (error) {
    result.HL09.error = String(error).slice(0, 1200);
  }
  await context.close();
}

save('HL06-09/result.json', result);
await browser.close();
