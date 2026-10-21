// Probe: help term markup (ad-break and a once figure) and animation inventory.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
await login(page);
await page.goto(`${BASE}/#/help/ad-break`);
await sleep(1200);
const out = await page.evaluate(() => {
  const h = document.getElementById('sa-help-ad-break');
  const term = h.parentElement.parentElement;
  const once = document.getElementById('sa-help-creative-source')?.parentElement.parentElement;
  return {
    termTag: term.tagName, termClass: term.className, adBreak: term.outerHTML.slice(0, 3000),
    once: once?.outerHTML.slice(0, 2000),
    figures: document.querySelectorAll('figure').length,
    anims: document.getAnimations().length,
    filters: [...document.querySelectorAll('[role=group][aria-label="용어 분류"] button')].map((b) => b.textContent.trim()),
  };
});
save('HL07/probe-markup.json', out);
console.log(out.termTag, out.termClass, out.figures, out.anims, out.filters);
console.log(out.adBreak);
console.log('---ONCE---');
console.log(out.once);
await browser.close();
