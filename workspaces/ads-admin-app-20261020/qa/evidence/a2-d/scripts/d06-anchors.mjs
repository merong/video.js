// A2-D-QA D06 anchors: every "?" link of #/players/options and #/players/setup is opened by script in one help tab
// (target row exists, is :target, its cells take the highlight colour, is in view); three are clicked by mouse.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1000 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { script: [], clicks: [] };
const readTarget = (tab) => tab.evaluate(() => {
  const id = location.hash.slice(1);
  const el = document.getElementById(id);
  if (!el) return { id, found: false };
  const tr = el.closest('tr') ?? el;
  const cell = tr.querySelector('td, th') ?? tr;
  const plain = document.querySelector('.sa-optt tbody tr:not(:target) > *');
  const r = tr.getBoundingClientRect();
  return { id, found: true, target: el.matches(':target'), cellBg: getComputedStyle(cell).backgroundColor, plainBg: plain ? getComputedStyle(plain).backgroundColor : null, inView: r.top >= 0 && r.bottom <= innerHeight + 2, top: Math.round(r.top) };
});
try {
  await login(page);
  const hrefs = [];
  for (const route of ['options', 'setup']) {
    await page.goto(`${BASE}/#/players/${route}`);
    await page.locator('main a.sa-help-link:visible').first().waitFor();
    await sleep(800);
    for (const h of await page.locator('main a.sa-help-link:visible').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), name: a.getAttribute('aria-label') || a.textContent.trim(), target: a.getAttribute('target') })))) if (h.href.includes('help.html')) hrefs.push({ route, ...h });
  }
  const tab = await context.newPage();
  for (const h of hrefs) {
    await tab.goto(`${BASE}${h.href}`);
    await tab.locator('.sa-optt tbody tr').first().waitFor();
    await sleep(250);
    result.script.push({ ...h, ...(await readTarget(tab)) });
  }
  await tab.close();

  await page.goto(`${BASE}/#/players/options`);
  await page.locator('main a.sa-help-link:visible').first().waitFor();
  await sleep(800);
  const links = page.locator('main a.sa-help-link:visible');
  const count = await links.count();
  for (const index of [5, Math.floor(count / 2), count - 3]) {
    const link = links.nth(index);
    await link.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 10000 }), link.click()]);
    await popup.waitForLoadState();
    await sleep(1200);
    result.clicks.push({ index, href: await link.getAttribute('href'), ...(await readTarget(popup)) });
    await shot(popup, `D06/click-${index}.png`);
    await popup.close();
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
result.console = logs;
save('D06/anchors.json', result);
await browser.close();
