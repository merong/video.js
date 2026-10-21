// Read-only: prints current creatives of the isolated install.
import { launch, newContext, login } from './lib.mjs';
const browser = await launch();
const page = await (await newContext(browser)).newPage();
await login(page);
const data = await page.evaluate(async () => (await (await fetch('/api/index.php?action=creatives')).json()).data);
const items = Array.isArray(data) ? data : data.creatives ?? data.items; console.log(Object.keys(data)); console.log(JSON.stringify(items.map((c) => [c.creativeId, c.name, `v${c.version}`, c.mime, c.url, c.archived])));
await browser.close();
