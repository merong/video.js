// PL22 follow-up 2: real keyboard focus on the colour picker input; is any focus indicator drawn?
import { BASE, EV, launch, login, save, sleep } from './lib.mjs';
import { gotoList, presetForm, field } from './presets.mjs';
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await login(page);
await gotoList(page);
await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
await presetForm(page).waitFor();
await sleep(1500);
await field(page, '이름').focus();
const out = { hits: [] };
for (let i = 0; i < 30 && out.hits.length < 2; i++) {
  await page.keyboard.press('Tab');
  const a = await page.evaluate(() => {
    const el = document.activeElement;
    if (el.type !== 'color') return null;
    const sw = el.closest('.sa-color-swatch');
    const cs = getComputedStyle(el);
    const ss = getComputedStyle(sw);
    return { name: el.getAttribute('aria-label') || el.title || el.labels?.[0]?.textContent.trim() || null, ariaLabelledby: el.getAttribute('aria-labelledby'), title: el.title, focusVisible: el.matches(':focus-visible'), input: `${cs.outlineStyle} ${cs.outlineWidth} / shadow ${cs.boxShadow} / opacity ${cs.opacity}`, swatch: `${ss.outlineStyle} ${ss.outlineWidth} / shadow ${ss.boxShadow} / border ${ss.borderColor} ${ss.borderWidth}` };
  });
  if (a) {
    out.hits.push(a);
    await page.locator('input[type=color]:focus').locator('xpath=ancestor::*[contains(@class,"sa-color")][1]/..').screenshot({ path: `${EV}/PL22/color-focus-${out.hits.length}.png` });
  }
}
const unfocused = await page.evaluate(() => {
  const sw = document.querySelector('.sa-color-swatch');
  const ss = getComputedStyle(sw);
  return `${ss.outlineStyle} ${ss.outlineWidth} / shadow ${ss.boxShadow} / border ${ss.borderColor} ${ss.borderWidth}`;
});
out.swatchUnfocused = unfocused;
save('PL22/color-focus.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
