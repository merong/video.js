// Read-only probe: logs in and stores the accessibility snapshot of every menu (no writes).
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser);
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);

await login(page);
save('00-env/probe/version.json', { browser: browser.version(), playwright: '1.59.1', channel: 'chrome' });

const nav = page.getByRole('navigation').first();
const links = await nav.getByRole('link').allTextContents();
const out = { links, snapshots: {} };
save('00-env/probe/top.aria.yml', await page.locator('body').ariaSnapshot());
for (const name of links) {
  await nav.getByRole('link', { name, exact: true }).click();
  await page.waitForTimeout(800);
  out.snapshots[name] = page.url();
  save(`00-env/probe/menu-${encodeURIComponent(name)}.aria.yml`, await page.locator('main, [role=main]').first().ariaSnapshot());
}
out.api = apiCalls(net);
out.console = logs;
save('00-env/probe/probe.json', out);
console.log(JSON.stringify({ links, urls: out.snapshots, api: out.api.length, console: logs.length }, null, 1));
await browser.close();
