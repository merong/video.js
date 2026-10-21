// A2-E-QA-DELTA F04 (copy): the logo.href and ads.labels.newWindow rows in help.html, the demo page and the admin
// #/players/options table, and every "새 창" / "새 탭" occurrence on those pages with its context. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, sleep, shot } from './lib.mjs';

const IDS = ['field-logo-href', 'field-ads-labels-newWindow', 'opt-query-logohref'];

// Every text node (hidden or not, screen-reader spans included) and aria-label mentioning 새 창 / 새 탭.
const mentions = (page) => page.evaluate(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/새 (창|탭)/.test(n.textContent)) continue;
    const host = n.parentElement;
    const ctx = host.closest('tr, li, p, section, dd, td, .sa-field, a, button') ?? host;
    out.push({ word: n.textContent.match(/새 (창|탭)/)[0], text: n.textContent.trim().slice(0, 120), context: ctx.textContent.replace(/\s+/g, ' ').trim().slice(0, 200), visible: Boolean(host.getClientRects().length), cls: host.className || null });
  }
  for (const el of document.querySelectorAll('[aria-label]')) {
    const v = el.getAttribute('aria-label');
    if (/새 (창|탭)/.test(v)) out.push({ word: v.match(/새 (창|탭)/)[0], ariaLabel: v.slice(0, 120), tag: el.localName, href: el.getAttribute('href') });
  }
  return out;
});
const rows = (page, ids) => page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const el = document.getElementById(id);
  if (!el) return [id, null];
  const box = el.closest('tr, section, article, li, div') ?? el;
  return [id, { tag: el.localName, text: box.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) }];
})), ids);

const result = {};
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
const logs = consoleCollector(page);
try {
  await page.goto(`${BASE}/examples/help.html#field-logo-href`);
  await sleep(1000);
  result.help = { rows: await rows(page, IDS), mentions: await mentions(page) };
  await page.locator('#field-logo-href').scrollIntoViewIfNeeded();
  await shot(page, 'F04/help-logo-href.png');
  await page.locator('#field-ads-labels-newWindow').scrollIntoViewIfNeeded();
  await shot(page, 'F04/help-newWindow.png');

  await login(page);
  await page.goto(`${BASE}/examples/index.html`);
  await page.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 });
  await sleep(1200);
  result.demo = { tables: await page.evaluate(() => document.querySelectorAll('table').length), rows: await rows(page, IDS), mentions: await mentions(page) };

  await page.goto(`${BASE}/#/players/options`);
  await page.locator('a[href*="help.html#"]').first().waitFor({ state: 'attached', timeout: 15000 });
  await sleep(1000);
  result.admin = {
    rows: await page.evaluate(() => [...document.querySelectorAll('a[href*="help.html#field-logo-href"], a[href*="help.html#field-ads-labels-newWindow"], a[href*="help.html#opt-query-logohref"]')].map((l) => ({ href: l.getAttribute('href'), aria: l.getAttribute('aria-label'), visible: Boolean(l.getClientRects().length), row: l.closest('tr, li, [role=row], article')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) ?? null }))),
    mentions: await mentions(page),
  };
  const link = page.locator('a[href*="help.html#field-logo-href"]').first();
  if (await link.isVisible()) { await link.scrollIntoViewIfNeeded(); await shot(page, 'F04/admin-logo-href.png'); }
} catch (e) {
  result.error = String(e).slice(0, 1200);
}
result.console = logs;
await browser.close();
save('F04/result.json', result);
console.log(JSON.stringify(result, null, 1));
