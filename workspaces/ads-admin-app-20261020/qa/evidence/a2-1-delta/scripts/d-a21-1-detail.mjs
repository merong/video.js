// A2-1-QA-DELTA D-A21-1 detail: two things from the first run. (1) At 390 the second 광고 화면 pick did not scroll:
// Playwright's selectOption left focus on the already-focused 광고 화면 heading, so focus() had nothing to do. Here the
// select is focused first, as a tap or Tab would. (2) One wheel notch after a pick: the observer band (15%–40% from the
// top) and every section's rect are recorded so a stale current mark can be told from a section still in the band.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const SITE = 'p-lbelw4d2xx';
const browser = await launch();
const result = {};

const state = (page) => page.evaluate(() => {
  const nav = document.querySelector('.aa-editor-nav');
  const select = nav.querySelector('select');
  const current = select ? select.selectedOptions[0]?.textContent.trim() : nav.querySelector('[aria-current="true"]')?.textContent.trim() ?? null;
  const zoneTop = innerHeight * 0.15;
  const zoneBottom = innerHeight * 0.4;
  const sections = [...document.querySelectorAll('section[id^="aa-preset-section-"]')].map((s) => {
    const r = s.getBoundingClientRect();
    return { label: s.querySelector('h2')?.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), inZone: r.bottom > zoneTop && r.top < zoneBottom, onScreen: r.bottom > 0 && r.top < innerHeight };
  });
  const el = document.activeElement;
  return {
    current,
    focus: el?.tagName === 'H2' ? `H2 ${el.textContent.trim()}` : `${el?.tagName} ${el?.id || ''}`.trim(),
    scrollY: Math.round(scrollY),
    maxScroll: document.documentElement.scrollHeight - innerHeight,
    zone: [Math.round(zoneTop), Math.round(zoneBottom)],
    inZone: sections.filter((s) => s.inZone).map((s) => s.label),
    onScreen: sections.filter((s) => s.onScreen).map((s) => s.label),
    sections,
  };
});

async function pick(page, kind, label) {
  if (kind === 'select') {
    const select = page.locator('.aa-editor-nav select');
    await select.focus();
    await select.selectOption({ label });
  } else {
    await page.locator('.aa-editor-nav nav a', { hasText: label }).click();
  }
  await sleep(1500);
}

for (const width of [1280, 768, 390]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { wheelAfterPick: {}, repick: {}, keys: [] };
  try {
    await login(page);
    await page.goto(`${BASE}/#/players/edit/${SITE}`);
    await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
    await sleep(1000);
    const kind = await page.evaluate(() => (document.querySelector('.aa-editor-nav select') ? 'select' : 'links'));
    r.kind = kind;

    // One wheel notch after each end pick.
    for (const label of ['언어', '광고 화면']) {
      await pick(page, kind, label);
      const afterPick = await state(page);
      const box = await page.locator('.aa-editor-main').boundingBox();
      await page.mouse.move(box.x + 20, 450);
      await page.mouse.wheel(0, -350);
      await sleep(800);
      const notch1 = await state(page);
      await sleep(1200);
      const notch1Later = await state(page);
      await page.mouse.wheel(0, -350);
      await sleep(800);
      const notch2 = await state(page);
      r.wheelAfterPick[label] = { afterPick, notch1, notch1Later, notch2 };
      await shot(page, `D-A21-1/detail-${width}-wheel-${label === '언어' ? 'lang' : 'ads'}.png`);
    }

    // Re-pick from the top of the page after the heading kept focus (390: select focused first).
    await page.mouse.wheel(0, -5000);
    await sleep(1000);
    r.repick.before = await state(page);
    await pick(page, kind, '광고 화면');
    r.repick.after = await state(page);
    await shot(page, `D-A21-1/detail-${width}-repick.png`);

    // Keyboard from there (focus is on the heading).
    for (const key of ['PageUp', 'PageUp', 'PageUp', 'Home', 'End']) {
      await page.keyboard.press(key);
      await sleep(900);
      const s = await state(page);
      r.keys.push({ key, current: s.current, scrollY: s.scrollY, inZone: s.inZone, onScreen: s.onScreen, focus: s.focus });
    }
    await shot(page, `D-A21-1/detail-${width}-keys.png`);
  } catch (error) {
    r.error = String(error).slice(0, 1500);
    await shot(page, `D-A21-1/detail-error-${width}.png`, { fullPage: true }).catch(() => {});
  }
  r.console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
  result[width] = r;
  await context.close();
}
save('D-A21-1/result-detail.json', result);
await browser.close();
