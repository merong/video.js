// A2-1-QA-DELTA D-A21-1: SectionNav at 1280/768/390. Pick 재생 동작 → 언어 → 광고 화면 (390: the select) and check the
// focused heading and the current mark; then scroll by wheel and by keyboard and check the mark follows the section in
// the observer band (15%–40% of the viewport from the top, the editor's rootMargin). Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const SITE = 'p-lbelw4d2xx';
const PICKS = ['재생 동작', '언어', '광고 화면'];
const browser = await launch();
const result = {};

const state = (page) => page.evaluate(() => {
  const nav = document.querySelector('.aa-editor-nav');
  const select = nav.querySelector('select');
  const current = select ? select.selectedOptions[0]?.textContent.trim() : nav.querySelector('[aria-current="true"]')?.textContent.trim() ?? null;
  const top = innerHeight * 0.15;
  const bottom = innerHeight * 0.4;
  const sections = [...document.querySelectorAll('section[id^="aa-preset-section-"]')].map((s) => {
    const r = s.getBoundingClientRect();
    return { label: s.querySelector('h2')?.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  const inBand = sections.filter((s) => s.bottom > top && s.top < bottom).sort((a, b) => a.top - b.top)[0]?.label ?? null;
  const el = document.activeElement;
  return {
    current,
    focus: el?.tagName === 'H2' ? `H2 ${el.textContent.trim()}` : `${el?.tagName} ${el?.id || ''}`.trim(),
    inBand,
    scrollY: Math.round(scrollY),
    maxScroll: document.documentElement.scrollHeight - innerHeight,
    hash: location.hash,
  };
});

for (const width of [1280, 768, 390]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { picks: [], wheel: [], keys: [] };
  try {
    await login(page);
    await page.goto(`${BASE}/#/players/edit/${SITE}`);
    await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
    await sleep(1000);
    r.editorClass = await page.locator('form.aa-editor').getAttribute('class');
    r.navKind = await page.evaluate(() => (document.querySelector('.aa-editor-nav select') ? 'select' : document.querySelector('.aa-editor-nav nav')?.className));
    r.start = await state(page);
    for (const label of PICKS) {
      if (r.navKind === 'select') {
        await page.locator('.aa-editor-nav select').selectOption({ label });
      } else {
        await page.locator('.aa-editor-nav nav a', { hasText: label }).click();
      }
      await sleep(700);
      const at700 = await state(page);
      await sleep(1500);
      const at2200 = await state(page);
      r.picks.push({ pick: label, at700, at2200 });
      await shot(page, `D-A21-1/${width}-pick-${PICKS.indexOf(label) + 1}.png`);
    }

    // Wheel up in steps from the page end.
    const box = await page.locator('.aa-editor-main').boundingBox();
    await page.mouse.move(box.x + 20, Math.min(450, box.y + box.height - 20));
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, -350);
      await sleep(700);
      r.wheel.push(await state(page));
    }
    await shot(page, `D-A21-1/${width}-after-wheel.png`);

    // Pick again, then scroll with the keyboard (focus is on the heading, so the keys scroll the page).
    if (r.navKind === 'select') {
      await page.locator('.aa-editor-nav select').selectOption({ label: '광고 화면' });
    } else {
      await page.locator('.aa-editor-nav nav a', { hasText: '광고 화면' }).click();
    }
    await sleep(700);
    r.keysStart = await state(page);
    for (const key of ['PageUp', 'PageUp', 'Home', 'PageDown', 'End']) {
      await page.keyboard.press(key);
      await sleep(700);
      r.keys.push({ key, ...(await state(page)) });
    }
    await shot(page, `D-A21-1/${width}-after-keys.png`);
  } catch (error) {
    r.error = String(error).slice(0, 1500);
    await shot(page, `D-A21-1/error-${width}.png`, { fullPage: true }).catch(() => {});
  }
  r.console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
  result[width] = r;
  await context.close();
}
save('D-A21-1/result.json', result);
await browser.close();
