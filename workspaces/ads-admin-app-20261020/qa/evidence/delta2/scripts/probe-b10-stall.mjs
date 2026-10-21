// A1-QA-DELTA probe (read-only page, collects events): why ads pause around 3s in B10. Single tab, no popup.
import { BASE, launch, newContext, consoleCollector, save, sleep, recordNetwork } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
page.on('console', (msg) => logs.push({ type: `all:${msg.type()}`, text: msg.text().slice(0, 300) }));
await page.addInitScript(() => {
  window.__qaEvents = [];
  const origPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () {
    window.__qaEvents.push({ at: Math.round(performance.now()), n: 'pause() called', src: (this.currentSrc || '').split('/').pop().slice(0, 24), t: Math.round(this.currentTime * 10) / 10, stack: new Error().stack.split('\n').slice(2, 9).map((l) => l.trim().replace(location.origin, '')) });
    return origPause.call(this);
  };
  const names = ['play', 'playing', 'pause', 'waiting', 'stalled', 'error', 'ended', 'abort', 'emptied', 'suspend'];
  const hook = (v) => {
    if (v.__qa) return;
    v.__qa = true;
    for (const n of names) v.addEventListener(n, () => window.__qaEvents.push({ at: Math.round(performance.now()), n, src: (v.currentSrc || '').split('/').pop().slice(0, 24), t: Math.round(v.currentTime * 10) / 10, rs: v.readyState, ns: v.networkState, err: v.error?.code ?? null, buf: v.buffered.length ? Math.round(v.buffered.end(v.buffered.length - 1) * 10) / 10 : null }));
  };
  const scan = (root) => {
    root.querySelectorAll('video').forEach(hook);
    root.querySelectorAll('*').forEach((n) => n.shadowRoot && scan(n.shadowRoot));
  };
  setInterval(() => scan(document), 100);
  document.addEventListener('visibilitychange', () => window.__qaEvents.push({ at: Math.round(performance.now()), n: `visibility:${document.visibilityState}` }));
});
const url = `${BASE}/examples/player.html?video=${process.argv[2] ?? 'a1-qa-video-1'}&content=${encodeURIComponent(`${BASE}/demo-media/grok-20261018/content-scene-01.mp4`)}`;
await page.goto(url);
await sleep(2500);
const box = await page.locator('video').first().boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await sleep(25000);
const out = {
  url,
  events: await page.evaluate(() => window.__qaEvents),
  statusText: await page.locator('body').innerText().then((t) => t.slice(0, 1200)),
  media: net.filter((e) => /\.(mp4|png)/.test(e.url)).map((e) => ({ t: e.t, url: e.url.replace(BASE, ''), status: e.status, failed: e.failed ?? null })),
  api: net.filter((e) => e.action).map((e) => ({ t: e.t, m: e.method, a: e.action, s: e.status })),
  logs,
};
save(`B10/probe-stall-${process.argv[3] ?? '1'}.json`, out);
await page.screenshot({ path: `${(await import('./lib.mjs')).EV}/B10/probe-stall-${process.argv[3] ?? '1'}.png` });
await browser.close();
