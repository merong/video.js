// A2-D-QA D06: why the middle "?" click opened no window. Reads the link's attributes and what is under the pointer,
// then clicks and records popups and the main page URL.
import { BASE, launch, newContext, login, save, sleep, shot } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1000 });
const page = await context.newPage();
const result = { tries: [] };
try {
  await login(page);
  await page.goto(`${BASE}/#/players/options`);
  await page.locator('main a.sa-help-link:visible').first().waitFor();
  await sleep(800);
  const links = page.locator('main a.sa-help-link:visible');
  const count = await links.count();
  result.count = count;
  result.targets = [...new Set(await links.evaluateAll((as) => as.map((a) => a.getAttribute('target'))))];
  for (const index of [Math.floor(count / 2), count - 3, 40, 20]) {
    const link = links.nth(index);
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    const hit = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName}.${String(el.className).slice(0, 40)} ${el.closest('a')?.getAttribute('href') ?? ''}` : null; }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const popups = [];
    const on = (p) => popups.push(p);
    context.on('page', on);
    await link.click();
    await sleep(2500);
    context.off('page', on);
    const t = { index, href: await link.getAttribute('href').catch(() => null), box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, hit, popups: popups.map((p) => p.url().replace(BASE, '')), mainUrl: page.url().replace(BASE, '') };
    if (!popups.length) await shot(page, `D06/click-miss-${index}.png`);
    for (const p of popups) await p.close();
    result.tries.push(t);
  }
} catch (error) {
  result.error = String(error).slice(0, 1200);
}
save('D06/click-debug.json', result);
await browser.close();
