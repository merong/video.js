// A1-QA-DELTA PL14-PL15 CodeBlock copy (failure path only, D4: the system clipboard is never used).
// navigator.clipboard.writeText is replaced by a stub that always rejects with NotAllowedError. Each failed copy must
// add a new announcement node (repeat announced again), move focus to the code region, select the code, and describe
// the region with the result. Changing the code clears the old result.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1600 });
await context.addInitScript(() => {
  window.__qaClipboard = [];
  const stub = async (text) => {
    window.__qaClipboard.push({ length: String(text).length });
    throw new DOMException('denied by QA stub', 'NotAllowedError');
  };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: stub, write: stub } });
});
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { clicks: [] };
const region = () => page.getByRole('region', { name: '설치 코드 만들기' });

const snapshot = () => page.evaluate(() => {
  const el = document.activeElement;
  const pre = document.querySelector('.sa-codeblock pre');
  const status = document.getElementById(pre?.closest('.sa-codeblock')?.querySelector('[role="status"], .sa-status, output')?.id ?? '') ?? pre?.closest('.sa-codeblock')?.querySelector('[role="status"]');
  const sel = window.getSelection()?.toString() ?? '';
  return {
    focus: el === pre ? 'code region (pre)' : `${el?.tagName} ${el?.textContent?.trim().slice(0, 30)}`,
    preDescribedBy: (pre?.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()),
    selectionLength: sel.length,
    codeLength: pre?.textContent?.length ?? 0,
    status: status ? { role: status.getAttribute('role'), live: status.getAttribute('aria-live'), text: status.textContent.trim() } : null,
    added: window.__qaAdded,
    clipboardCalls: window.__qaClipboard.length,
  };
});

try {
  await login(page);
  await page.goto(`${BASE}/#/players/setup`);
  await region().waitFor();
  await sleep(1000);
  await region().getByRole('textbox', { name: '영상 ID' }).fill('a1-qa-preset-1');
  await sleep(500);
  // Count every node added inside the copy result area.
  await page.evaluate(() => {
    window.__qaAdded = [];
    const block = document.querySelector('.sa-codeblock');
    const status = block.querySelector('[role="status"]') ?? block.lastElementChild;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) window.__qaAdded.push(`${n.nodeName}:${n.textContent.trim().slice(0, 60)}`);
    }).observe(status, { childList: true, subtree: true });
  });
  const copy = region().getByRole('button', { name: /복사/ }).first();
  result.copyButtonName = await copy.evaluate((el) => (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).join(' '));
  for (let i = 1; i <= 3; i++) {
    if (i === 3) {
      await copy.focus();
      await page.keyboard.press('Enter');
    } else {
      await copy.click();
    }
    await sleep(600);
    result.clicks.push({ n: i, via: i === 3 ? 'keyboard Enter' : 'click', ...(await snapshot()) });
  }
  await shot(page, 'PL15/delta-copy-reject.png', { fullPage: true });

  // Changing the code clears the stale result.
  await region().getByRole('textbox', { name: '영상 ID' }).fill('a1-qa-preset-2');
  await sleep(500);
  result.afterCodeChange = await snapshot();
  result.repeatAnnounced = result.clicks[1].added.length > result.clicks[0].added.length && result.clicks[2].added.length > result.clicks[1].added.length;
  result.api = apiCalls(net).map((c) => `${c.method} ${c.action} ${c.status}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL15/delta-error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL15/result-delta.json', result);
await browser.close();
