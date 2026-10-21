// A2-D-QA-DELTA-2 Y01 built-in screen layout: #/players/edit/{default,rounded,accent} at 1280×800, 1100×800, 768×1024 and
// 390×844. Read: the card's landmark (role region, name), its box against the Note and 복제해서 새로 만들기 (two columns or
// stacked), its width, position sticky and where its top lands after window scrolls, the fold button, at 1280×800 the bottom
// edges of the stage, 장면 바로가기 and 최근 광고 진행 (and 페이지 언어), horizontal overflow. Below wide the card must start
// folded and open with 열기. A 1280×600 pass checks sticky where the page can scroll. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { requestLog } from './demo.mjs';

const SIZES = [[1280, 800], [1100, 800], [768, 1024], [390, 844], [1280, 600]];
const IDS = ['default', 'rounded', 'accent'];
const browser = await launch();
const result = { screens: [] };
const box = (loc) => loc.boundingBox().then((b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.y + b.height), right: Math.round(b.x + b.width) }).catch(() => null);

for (const [width, height] of SIZES) {
  const context = await newContext(browser, { width, height });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  try {
    await login(page);
    for (const id of IDS) {
      if (height === 600 && id !== 'rounded') continue;
      await page.goto(`${BASE}/#/players/edit/${id}`);
      const region = page.getByRole('region', { name: '플레이어 미리보기' });
      await region.waitFor({ timeout: 15000 });
      await sleep(2500);
      const card = page.locator('.aa-builtin-preview');
      const r = { size: `${width}x${height}`, id };
      r.landmark = { regions: await region.count(), tag: await region.evaluate((el) => el.tagName), cls: await region.getAttribute('class'), asides: await page.locator('aside.sa-ppv').count() };
      r.layoutClass = await page.locator('.aa-builtin').getAttribute('class');
      r.note = await box(page.locator('.aa-builtin .sa-note').first());
      r.dup = await box(page.getByRole('button', { name: '복제해서 새로 만들기' }));
      r.card = await box(card);
      r.twoColumns = Boolean(r.card && r.note && r.card.x >= r.note.right && r.card.y < r.note.bottom);
      r.css = await card.evaluate((el) => { const s = getComputedStyle(el); return { position: s.position, top: s.top }; });
      const opener = card.locator('.sa-ppv-h button[aria-expanded]');
      r.opener = (await opener.count()) ? { text: await opener.innerText(), expanded: await opener.getAttribute('aria-expanded'), bodyHidden: await card.locator('div.sa-ppv').evaluate((el) => el.hidden) } : null;
      r.overflowStart = await overflow(page);
      if (r.opener) {
        await opener.click();
        await sleep(2500);
        r.openerAfter = { text: await opener.innerText(), expanded: await opener.getAttribute('aria-expanded'), bodyHidden: await card.locator('div.sa-ppv').evaluate((el) => el.hidden) };
      }
      r.parts = {
        stage: await box(card.locator('.sa-stage-frame').first()),
        scenes: await box(card.locator('.sa-stage-tools').first()),
        now: await box(card.locator('.sa-stage-now').first()),
        pageLang: await box(card.getByLabel('페이지 언어')),
        demo: await box(card.getByRole('link', { name: /데모에서 열기/ })),
      };
      if (width === 1280 && height === 800) r.firstScreen = Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, v ? v.bottom <= height : null]));
      r.scroll = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight }));
      if (r.scroll.scrollHeight > r.scroll.innerHeight) {
        r.sticky = [];
        for (const y of [100, 300, 2000]) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await sleep(300);
          r.sticky.push({ scrollY: await page.evaluate(() => Math.round(scrollY)), cardTop: (await box(card))?.y, noteTop: (await box(page.locator('.aa-builtin .sa-note').first()))?.y });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      r.overflow = await overflow(page);
      await shot(page, `Y01/${id}-${width}x${height}.png`);
      result.screens.push(r);
    }
  } catch (error) {
    result[`error${width}x${height}`] = String(error).slice(0, 1500);
    await shot(page, `Y01/error-${width}x${height}.png`, { fullPage: true }).catch(() => {});
  }
  result[`events${width}x${height}`] = req.events().length;
  result[`console${width}x${height}`] = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
  await context.close();
}
save('Y01/result.json', result);
await browser.close();
