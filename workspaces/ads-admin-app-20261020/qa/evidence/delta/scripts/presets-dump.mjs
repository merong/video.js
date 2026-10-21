// Saves the redacted player-presets list (authenticated) and the public player-preset response (no cookies).
import { BASE, launch, newContext, login, save, redact } from './lib.mjs';

const out = process.argv[2];
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
await login(page);
const list = await (await page.request.get(`${BASE}/api/index.php?action=player-presets`)).json();
const anon = await browser.newContext();
const pubRes = await anon.request.get(`${BASE}/api/index.php?action=player-preset`);
const pub = { status: pubRes.status(), headers: Object.fromEntries(Object.entries(pubRes.headers()).filter(([k]) => /cache|content-type|access-control/i.test(k))), body: await pubRes.json().catch(() => null) };
save(out, { at: new Date().toISOString(), list: redact(list), public: redact(pub) });
await browser.close();
