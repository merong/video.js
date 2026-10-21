// A2-E-QA E06: the demo opened without signing in, to record the known 401 on player-presets and anything else 4xx,
// and that the player still mounts with the ad skin. Nothing is saved.
import { BASE, launch, newContext, save, sleep } from './lib.mjs';
import { waitPlayer } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const statuses = [];
context.on('response', (res) => { const u = res.url().replace(BASE, ''); if (u.includes('/api/') || res.status() >= 400) statuses.push(`${res.status()} ${res.request().method()} ${u.replace(/^.*action=/, 'action=')}`); });
const page = await context.newPage();
const consoleLog = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleLog.push(`${m.type()}: ${m.text().slice(0, 160)} @${(m.location()?.url ?? '').replace(BASE, '')}`); });
await page.goto(`${BASE}/examples/index.html`);
await waitPlayer(page).catch(() => {});
await sleep(1500);
const facts = await page.evaluate(() => ({ skin: document.querySelector('#player solad-video-skin, #player video-skin')?.localName ?? null, presetNote: document.getElementById('preset-note')?.hidden === false ? document.getElementById('preset-note').textContent.replace(/\s+/g, ' ').trim() : null, presetOptions: document.querySelectorAll('#preset option').length }));
await context.close();
save('E06/prelogin.json', { statuses, console: consoleLog, facts });
console.log(JSON.stringify({ statuses, console: consoleLog, facts }, null, 1));
await browser.close();
