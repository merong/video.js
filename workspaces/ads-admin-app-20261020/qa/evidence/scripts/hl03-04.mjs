// HL03: direct #/help/<term> entry, reload, filter reset, heading in view with focus. HL04: invalid termIds show the help start.
import { BASE, EV, launch, newContext, login, consoleCollector, save, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 900 });
const page0 = await context.newPage();
await login(page0);
const result = { HL03: [], HL04: [] };
const where = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const r = a?.getBoundingClientRect();
  return {
    hash: location.hash,
    activeId: a?.id || null,
    activeTag: a?.tagName,
    activeText: a?.textContent.trim().slice(0, 40),
    activeRect: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
    inViewport: r ? r.top >= 0 && r.bottom <= innerHeight : null,
    scrollY: Math.round(scrollY),
    pressedFilter: [...document.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent.trim()).filter((t) => !/일시정지/.test(t)),
    highlighted: [...document.querySelectorAll('[class*="highlight"], [class*="is-target"], [data-highlight], :target')].map((e) => e.id || e.className).slice(0, 5),
  };
});

// HL03 ---------------------------------------------------------------
{
  const page = await context.newPage();
  const logs = consoleCollector(page);
  await page.goto(`${BASE}/#/help/mid-roll`);
  await sleep(1500);
  result.HL03.push({ step: '(1) new tab #/help/mid-roll', ...(await where(page)) });
  await page.reload();
  await sleep(1500);
  result.HL03.push({ step: '(1) reload', ...(await where(page)) });
  await page.screenshot({ path: `${EV}/HL03/1-mid-roll-after-reload.png` });
  await page.getByRole('group', { name: '용어 분류' }).getByRole('button', { name: /^통계/ }).click();
  await sleep(500);
  result.HL03.push({ step: '(2) filter 통계', ...(await where(page)), visibleArticles: await page.locator('article').filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.querySelector('h4')?.textContent).slice(0, 8)) });
  await page.evaluate(() => (location.hash = '#/help/pre-roll'));
  await sleep(1200);
  result.HL03.push({ step: '(2) hash → pre-roll', ...(await where(page)) });
  await page.screenshot({ path: `${EV}/HL03/2-pre-roll-after-filter.png` });
  await page.evaluate(() => (location.hash = '#/help/stats-csv'));
  await sleep(1200);
  result.HL03.push({ step: '(3) hash → stats-csv', ...(await where(page)) });
  await page.screenshot({ path: `${EV}/HL03/3-stats-csv.png` });
  result.HL03console = logs;
  await page.close();
}

// HL04 ---------------------------------------------------------------
{
  const page = await context.newPage();
  const logs = consoleCollector(page);
  await page.addInitScript(() => {
    window.__qaXss = 0;
    window.alert = () => (window.__qaXss += 1);
  });
  for (const [key, hash] of [['not-a-term', '#/help/not-a-term'], ['house-ad', '#/help/house-ad'], ['empty', '#/help/'], ['xss', '#/help/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E']]) {
    await page.goto(`${BASE}/${hash}`);
    await page.reload();
    await sleep(1500);
    const r = { key, ...(await where(page)) };
    r.h1 = await page.locator('h1').filter({ visible: true }).allInnerTexts();
    r.mainTextStart = (await page.locator('main').filter({ visible: true }).innerText()).slice(0, 120);
    r.imgFromHash = await page.locator('img[src="x"]').count();
    r.xssCalls = await page.evaluate(() => window.__qaXss);
    r.houseAdHeading = await page.locator('#sa-help-house-ad').count();
    await page.screenshot({ path: `${EV}/HL04/${key}.png` });
    result.HL04.push(r);
  }
  result.HL04console = logs;
  await page.close();
}
save('HL03-04/result.json', result);
await browser.close();
