// PL21 options reference page (API 0, tables, columns, warnings); PL23 "준비 중" items on player screens.
import { BASE, EV, launch, newContext, login, recordNetwork, apiCalls, consoleCollector, save, sleep } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';
const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { PL21: {}, PL23: {} };
const main = () => page.locator('main').filter({ visible: true });
const pending = () => main().evaluate((m) => {
  const out = [];
  const w = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!/준비 중/.test(n.textContent)) continue;
    const el = n.parentElement;
    const block = el.closest('label, li, tr, p, option, .sa-field, fieldset, section, div');
    const control = block?.querySelector('input, select, button, a') ?? (el.tagName === 'OPTION' ? el : null);
    out.push({ tag: el.tagName, text: block?.textContent.replace(/\s+/g, ' ').trim().slice(0, 140), control: control ? `${control.tagName}${control.disabled ? ' [disabled]' : ''}${control.getAttribute('aria-disabled') === 'true' ? ' [aria-disabled]' : ''}` : null });
  }
  return out;
});
try {
  await login(page);
  await gotoList(page);
  result.PL23.list = await pending();
  const t = net.length ? net[net.length - 1].t + 1 : 0;
  const subnav = main().getByRole('navigation').first();
  result.PL21.subnav = await subnav.getByRole('link').evaluateAll((as) => as.map((a) => `${a.textContent.trim()} ${a.getAttribute('href')}${a.getAttribute('aria-current') ? ` [aria-current=${a.getAttribute('aria-current')}]` : ''}`));
  await subnav.getByRole('link', { name: '옵션 설명' }).click();
  await sleep(1500);
  result.PL21.hash = new URL(page.url()).hash;
  result.PL21.api = apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`);
  result.PL21.tables = await main().locator('table').evaluateAll((ts) => ts.map((tb) => ({
    caption: tb.caption?.textContent.trim() ?? tb.closest('section')?.querySelector('h2,h3')?.textContent.trim() ?? null,
    columns: [...tb.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
    rows: tb.querySelectorAll('tbody tr').length,
    names: [...tb.querySelectorAll('tbody tr')].map((tr) => tr.cells[0]?.textContent.trim()).slice(0, 40),
    scroller: (() => { const p = tb.parentElement; const cs = getComputedStyle(p); return { overflowX: cs.overflowX, scrollable: p.scrollWidth > p.clientWidth }; })(),
  })));
  result.PL21.mediaAlt = await main().locator('tr').filter({ hasText: 'media-alt' }).allInnerTexts();
  const text = await main().innerText();
  result.PL21.notes = {
    adsDirect: text.split('\n').filter((l) => /--ads-/.test(l) && /(직접|무효|적용되지|덮어)/.test(l)).slice(0, 4),
    small280: text.split('\n').filter((l) => /280/.test(l)).slice(0, 3),
    timeout5: text.split('\n').filter((l) => /5초/.test(l)).slice(0, 4),
  };
  await page.screenshot({ path: `${EV}/PL21/options.png`, fullPage: true });
  result.PL23.options = await pending();
  await page.goto(`${BASE}/#/players/setup`);
  await sleep(1200);
  result.PL23.setup = await pending();
  await gotoList(page);
  await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(800);
  result.PL23.edit = await pending();
  result.PL23.skinOptions = await presetForm(page).getByRole('combobox', { name: '스킨', exact: true }).evaluate((s) => [...s.options].map((o) => `${o.textContent.trim()}${o.disabled ? ' [disabled]' : ''}`)).catch((e) => String(e).slice(0, 200));
  result.PL23.writes = net.filter((e) => e.method === 'POST' && e.action !== 'login').map((e) => e.action);
} catch (error) {
  result.error = String(error).slice(0, 1200);
  await page.screenshot({ path: `${EV}/PL21/error.png`, fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL21-23/result.json', result);
console.log(JSON.stringify(result, null, 1).slice(0, 9000));
await browser.close();
