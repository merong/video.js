// Probe: which URL produces the console 404 on a paste page (console message location).
import { BASE, launch, newContext, save, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
const out = [];
page.on('console', (m) => { if (m.type() === 'error') out.push({ text: m.text().slice(0, 200), location: m.location() }); });
await page.goto(`${BASE}/__qa/paste/pl16-videojs-mp4.html`);
await sleep(3000);
const fav = await page.request.get(`${BASE}/favicon.ico`);
save('PL16/console-404-source.json', { console: out, faviconStatus: fav.status() });
console.log(JSON.stringify({ out, fav: fav.status() }));
await browser.close();
