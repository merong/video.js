// PL22 follow-up: inputs that showed no focus ring, and form controls overlapping the preview iframe at 768px.
import { BASE, EV, launch, login, save, sleep } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
const page = await context.newPage();
await login(page);
await gotoList(page);
await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
await presetForm(page).waitFor();
await sleep(2500);
const out = {};
out.overlapWithIframe = await page.evaluate(() => {
  const i = document.querySelector('iframe[title="플레이어 테마 미리보기"]').getBoundingClientRect();
  const f = [...document.querySelectorAll('main form')].find((x) => x.getClientRects().length);
  return [...f.querySelectorAll('input, select, button, a, label, p')].filter((el) => {
    const b = el.getBoundingClientRect();
    return b.width && b.left < i.right - 1 && i.left < b.right - 1 && b.top < i.bottom - 1 && i.top < b.bottom - 1;
  }).map((el) => (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 40));
});
await page.locator('iframe[title="플레이어 테마 미리보기"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${EV}/PL22/768-edit-preview-area.png` });
out.unnamedInputs = await page.evaluate(() => {
  const f = [...document.querySelectorAll('main form')].find((x) => x.getClientRects().length);
  return [...f.querySelectorAll('input')].filter((el) => !el.getAttribute('aria-label') && !el.labels?.length).map((el) => {
    el.focus({ focusVisible: true });
    const cs = getComputedStyle(el);
    const lb = el.getAttribute('aria-labelledby');
    return { type: el.type, labelledby: lb ? document.getElementById(lb)?.textContent.trim() : null, outline: `${cs.outlineStyle} ${cs.outlineWidth}`, boxShadow: cs.boxShadow, opacity: cs.opacity, size: [el.offsetWidth, el.offsetHeight], parentClass: el.parentElement.className };
  });
});
// Keyboard focus ring on a colour input (real Tab focus, :focus-visible).
const color = page.locator('main form input[type=color]').first();
if (await color.count()) {
  await color.evaluate((el) => el.previousElementSibling?.focus?.());
  await page.keyboard.press('Tab');
  out.colorTabFocus = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    const p = el.parentElement;
    const pcs = getComputedStyle(p);
    return { tag: el.tagName, type: el.type, name: el.getAttribute('aria-label') || el.labels?.[0]?.textContent.trim(), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, parentOutline: `${pcs.outlineStyle} ${pcs.outlineWidth}`, parentShadow: pcs.boxShadow, matchesFocusVisible: el.matches(':focus-visible') };
  });
  await page.locator('main form input[type=color]').first().locator('xpath=..').screenshot({ path: `${EV}/PL22/color-input-focus.png` });
}
save('PL22/followup.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
