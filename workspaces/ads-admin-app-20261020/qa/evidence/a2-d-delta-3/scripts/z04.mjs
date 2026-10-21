// A2-D-QA-DELTA-3 Z04 built-in screen layout (rounded) at 1280×800, 768×1024, 1280×600 and 768×600: two columns at 1280,
// stacked at 768, the card's computed position (no sticky), where the card top lands after scrolling, whether 데모에서 열기
// is fully inside the viewport after scrolling to the end (768 opens the card first), horizontal overflow. The editor
// preview of p-i0aecb28w3 at 1280×800 is read for its computed position (stays sticky). Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { screens: [] };
const box = (loc) => loc.boundingBox().then((b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.y + b.height), right: Math.round(b.x + b.width) }).catch(() => null);

for (const [width, height] of [[1280, 800], [768, 1024], [1280, 600], [768, 600]]) {
  const context = await newContext(browser, { width, height });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { size: `${width}x${height}` };
  try {
    await login(page);
    await page.goto(`${BASE}/#/players/edit/rounded`);
    const card = page.locator('section.aa-builtin-preview');
    await card.waitFor({ timeout: 15000 });
    await sleep(2000);
    r.layoutClass = await page.locator('.aa-builtin').getAttribute('class');
    r.note = await box(page.locator('.aa-builtin .sa-note').first());
    r.card = await box(card);
    r.twoColumns = Boolean(r.card && r.note && r.card.x >= r.note.right && r.card.y < r.note.bottom);
    r.stacked = Boolean(r.card && r.note && r.card.y >= r.note.bottom);
    r.css = await card.evaluate((el) => { const s = getComputedStyle(el); return { position: s.position, top: s.top }; });
    const opener = card.locator('.sa-ppv-h button[aria-expanded]');
    if ((await opener.count()) && (await opener.getAttribute('aria-expanded')) === 'false') { await opener.click(); await sleep(2000); }
    r.overflowOpen = await overflow(page);
    r.scroll = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight }));
    r.steps = [];
    for (const y of [150, 100000]) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await sleep(300);
      const demo = await box(card.getByRole('link', { name: /데모에서 열기/ }));
      r.steps.push({ scrollY: await page.evaluate(() => Math.round(scrollY)), cardTop: (await box(card))?.y, noteTop: (await box(page.locator('.aa-builtin .sa-note').first()))?.y, demo, demoInView: Boolean(demo && demo.y >= 0 && demo.bottom <= height) });
    }
    await shot(page, `Z04/rounded-${width}x${height}-scrolled.png`);
    // Keyboard reach: focus the link and check it is scrolled into view.
    await page.evaluate(() => window.scrollTo(0, 0));
    await card.getByRole('link', { name: /데모에서 열기/ }).focus();
    await sleep(300);
    const d = await box(card.getByRole('link', { name: /데모에서 열기/ }));
    r.focusDemo = { demo: d, inView: Boolean(d && d.y >= 0 && d.bottom <= height) };
    r.overflow = await overflow(page);
    if (width === 1280 && height === 800) {
      await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
      const aside = page.locator('aside.aa-editor-preview');
      await aside.waitFor({ timeout: 15000 });
      await sleep(1500);
      r.editorAside = await aside.evaluate((el) => { const s = getComputedStyle(el); return { position: s.position, top: s.top }; });
    }
  } catch (error) {
    r.error = String(error).slice(0, 1200);
    await shot(page, `Z04/error-${width}x${height}.png`, { fullPage: true }).catch(() => {});
  }
  r.events = req.events().length;
  r.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
  result.screens.push(r);
  await context.close();
}
save('Z04/result.json', result);
await browser.close();
