// A2-E-QA-DELTA F05 (short regression) at 1280×900 and 390×844: the demo and help logged out (the player-presets 401 is
// known), then logged in the admin screens, the demo, help and play-test. Per page: console errors, 4xx/5xx and failed
// requests, events calls and horizontal scroll. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, recordNetwork, save, sleep, overflow, shot } from './lib.mjs';
import { waitPlayer } from './demo.mjs';

const SIZES = [[1280, 900], [390, 844]];
const result = {};
const browser = await launch();
for (const [W, H] of SIZES) {
  const context = await newContext(browser, { width: W, height: H });
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const pages = [];
  const visit = async (label, url, ready) => {
    const from = net.length;
    const c0 = logs.length;
    try {
      await page.goto(url);
      await ready();
    } catch (e) {
      pages.push({ label, error: String(e).slice(0, 400) });
      return;
    }
    const bad = net.slice(from).filter((e) => (e.status ?? 0) >= 400 || e.failed);
    pages.push({
      label,
      url: url.replace(BASE, ''),
      requests: net.length - from,
      bad: bad.map((e) => `${e.method} ${e.url.replace(BASE, '')} ${e.status ?? ''} ${e.failed ?? ''}`.trim()),
      events: net.slice(from).filter((e) => e.action === 'events').length,
      console: logs.slice(c0).map((l) => `${l.type}: ${l.text.slice(0, 160)}`),
      overflow: await overflow(page),
    });
  };
  const demoReady = async () => { await page.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 }); await waitPlayer(page); await sleep(1500); };
  const helpReady = async () => { await page.locator('#field-logo-href').waitFor({ state: 'attached', timeout: 15000 }); await sleep(800); };
  const adminReady = (sel) => async () => { await page.locator(sel).first().waitFor({ state: 'attached', timeout: 15000 }); await sleep(1200); };

  await visit('demo (logged out)', `${BASE}/examples/index.html`, demoReady);
  await visit('help (logged out)', `${BASE}/examples/help.html`, helpReady);
  await login(page);
  await visit('admin home', `${BASE}/#/`, adminReady('button:has-text("로그아웃")'));
  await visit('admin players', `${BASE}/#/players`, adminReady('.sa-stage-view, table, h1'));
  await visit('admin players/options', `${BASE}/#/players/options`, adminReady('a[href*="help.html#"]'));
  await visit('admin players/edit/rounded', `${BASE}/#/players/edit/rounded`, adminReady('.sa-stage-view'));
  await visit('admin players/edit saved', `${BASE}/#/players/edit/p-wgqz3x31a5`, adminReady('.sa-stage-view'));
  await visit('demo (logged in)', `${BASE}/examples/index.html`, demoReady);
  await visit('demo logo query', `${BASE}/examples/index.html?logo=sample-png&logoWidth=240&logoPosition=top-left`, demoReady);
  await visit('help (logged in)', `${BASE}/examples/help.html#field-ads-labels-newWindow`, helpReady);
  await visit('play-test', `${BASE}/examples/play-test.html?preset=p-wgqz3x31a5`, async () => {
    await page.locator('#player').waitFor({ state: 'attached', timeout: 15000 });
    await sleep(4000);
  });
  await shot(page, `F05/play-test-${W}.png`);
  result[`${W}x${H}`] = { pages, totalEvents: net.filter((e) => e.action === 'events').length };
  await context.close();
}
await browser.close();
save('F05/result.json', result);
for (const [k, v] of Object.entries(result)) for (const p of v.pages) console.log(k, p.label, p.error ?? '', 'req', p.requests, 'bad', JSON.stringify(p.bad), 'ev', p.events, 'console', JSON.stringify(p.console), 'ovf', p.overflow?.horizontalOverflow);
