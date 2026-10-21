// PL01: built-in default only, read-only list makes only GET player-presets, no meta key after reload.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);

try {
  await login(page);
  const t = mark();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '플레이어', exact: true }).click();
  await sleep(1800);
  result.hash = new URL(page.url()).hash;
  result.apiAfterMenu = apiCalls(net, t);
  const main = page.locator('main').filter({ visible: true });
  save('PL01/players.aria.yml', await main.ariaSnapshot());
  result.text = (await main.innerText()).slice(0, 3000);
  result.buttons = await main.locator('button, a').filter({ visible: true }).evaluateAll((els) => els.map((b) => ({
    tag: b.tagName, name: b.getAttribute('aria-label') || b.textContent.trim().slice(0, 60), disabled: b.disabled ?? null, ariaDisabled: b.getAttribute('aria-disabled'), href: b.getAttribute('href'),
    reason: (b.getAttribute('aria-describedby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(' | ') || null,
  })));
  await shot(page, 'PL01/players.png', { fullPage: true });
  const t2 = mark();
  await page.reload();
  await sleep(2000);
  result.apiAfterReload = apiCalls(net, t2);
  result.textAfterReload = (await page.locator('main').filter({ visible: true }).innerText()).slice(0, 3000);
  await shot(page, 'PL01/players-after-reload.png', { fullPage: true });
  result.playerPresetBodies = [];
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL01/error.png', { fullPage: true }).catch(() => {});
}
result.allApi = apiCalls(net);
result.console = logs;
save('PL01/result.json', result);
await browser.close();
