// A2-D-QA D06 help vs admin: every table row of #/players/options (name, values, default, the "?" link) and every row of
// help.html (id, name, values, default, phase tag) are read; each admin "?" anchor must exist on the help page with the
// same name and default. A few "?" links are clicked (new tab) and the target row's highlight is read. Phase tags of
// the preset field table are listed for the contract 4 comparison. The setup and options pages' 데모·설명서·도움말
// links are read too.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};

const tables = (p, scope) => p.evaluate((scope) => {
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  return [...document.querySelectorAll(`${scope} table`)].filter((x) => x.getClientRects().length).map((table) => {
    const heads = [...table.querySelectorAll('thead th')].map(t);
    return {
      caption: t(table.querySelector('caption')) || t(table.closest('section')?.querySelector('h2, h3')),
      heads,
      rows: [...table.querySelectorAll('tbody tr')].map((tr) => ({
        id: tr.id || tr.querySelector('[id]')?.id || null,
        cells: [...tr.children].map(t),
        help: tr.querySelector('a.sa-help-link')?.getAttribute('href') ?? null,
        helpName: tr.querySelector('a.sa-help-link')?.getAttribute('aria-label') ?? (tr.querySelector('a.sa-help-link') ? t(tr.querySelector('a.sa-help-link')) : null),
        phase: t(tr.querySelector('.sa-tag, [class*="phase"]')) || null,
      })),
    };
  });
}, scope);

try {
  await login(page);
  await page.goto(`${BASE}/#/players/options`);
  await page.locator('main table:visible').first().waitFor();
  await sleep(1000);
  result.admin = await tables(page, 'main');
  result.adminLinks = await page.locator('main a').evaluateAll((as) => as.filter((a) => a.getClientRects().length && /데모|설명서|도움말/.test(a.textContent) && !a.classList.contains('sa-help-link')).map((a) => ({ text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.getAttribute('target') })));
  await shot(page, 'D06/admin-options.png', { fullPage: true });
  await page.goto(`${BASE}/#/players/setup`);
  await sleep(2500);
  result.setupLinks = await page.locator('main a').evaluateAll((as) => as.filter((a) => a.getClientRects().length && /데모|설명서|도움말/.test(a.textContent) && !a.classList.contains('sa-help-link')).map((a) => ({ text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.getAttribute('target') })));
  result.setupHelpLinks = await page.locator('main a.sa-help-link:visible').evaluateAll((as) => as.map((a) => a.getAttribute('href')));

  const help = await context.newPage();
  await help.goto(`${BASE}/examples/help.html`);
  await help.locator('table tbody tr').first().waitFor();
  await sleep(800);
  result.help = await tables(help, 'main');
  result.helpIds = await help.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  result.helpSections = await help.evaluate(() => [...document.querySelectorAll('main h2')].map((h) => ({ id: h.id || h.closest('[id]')?.id, text: h.textContent.trim().slice(0, 40) })));

  // Click four "?" links on the options screen and read the target row on the opened help page.
  await page.goto(`${BASE}/#/players/options`);
  await page.locator('main table:visible').first().waitFor();
  await sleep(800);
  const all = page.locator('main a.sa-help-link:visible');
  const count = await all.count();
  result.clicks = [];
  for (const index of [0, Math.floor(count / 3), Math.floor((2 * count) / 3), count - 1]) {
    const link = all.nth(index);
    const href = await link.getAttribute('href');
    await link.scrollIntoViewIfNeeded();
    const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await tab.waitForLoadState();
    await sleep(1200);
    const hash = new URL(tab.url()).hash.slice(1);
    const row = await tab.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const tr = el.closest('tr') ?? el;
      const r = tr.getBoundingClientRect();
      return { tag: tr.tagName, matchesTarget: el.matches(':target'), bg: getComputedStyle(tr).backgroundColor, outline: getComputedStyle(tr).outlineStyle, boxShadow: getComputedStyle(tr).boxShadow.slice(0, 60), inView: r.top >= 0 && r.top < innerHeight, text: tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) };
    }, hash);
    const plain = await tab.evaluate(() => getComputedStyle(document.querySelector('tbody tr:not(:target)')).backgroundColor);
    result.clicks.push({ index, href, tab: tab.url().replace(BASE, ''), row, plainRowBg: plain });
    await shot(tab, `D06/click-${index}.png`);
    await tab.close();
  }
  await help.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D06/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('D06/result.json', result);
await browser.close();
