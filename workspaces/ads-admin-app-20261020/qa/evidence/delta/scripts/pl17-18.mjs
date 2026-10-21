// PL17 example pages with ?preset; PL18 bad or missing preset ids. Cookie-less visitor contexts.
import { BASE, EV, launch, newContext, recordNetwork, consoleCollector, save, sleep, redact } from './lib.mjs';
import { playToEnd, trackEvents } from './play.mjs';

const PA = 'p-vym1rjw052';
const PB = 'p-obxpj5v9m9';
const Q = 'video=a1-qa-preset-1&media=mp4&content=/demo-media/grok-20261018/content-scene-01.mp4';
const browser = await launch();
const result = { PL17: {}, PL18: {} };

async function inspect(page) {
  return page.evaluate(() => {
    const skin = document.querySelector('video-neutral-skin, video-default-skin, [class*=skin]');
    const tag = document.querySelector('video-neutral-skin') ? 'video-neutral-skin' : document.querySelector('video-default-skin') ? 'video-default-skin' : null;
    const el = tag ? document.querySelector(tag) : document.querySelector('#mount, [id$=mount]');
    const cs = el && getComputedStyle(el);
    const ads = document.querySelector('media-ads');
    const notice = [...document.querySelectorAll('[id$=notice], .notice, [role=status], [role=alert]')].filter((n) => !n.hidden && n.textContent.trim()).map((n) => n.textContent.trim());
    return {
      skinTag: tag, css: [...document.styleSheets].map((s) => s.href).filter((h) => h && h.includes('/assets/')),
      accent: cs?.getPropertyValue('--media-accent-color').trim() || null, radius: cs?.getPropertyValue('--media-border-radius').trim() || null,
      adsAttrs: ads ? Object.fromEntries([...ads.attributes].filter((a) => !['src', 'for'].includes(a.name)).map((a) => [a.name, a.value])) : null,
      heading: [...document.querySelectorAll('h1, h2, header p, [id$=meta], [id$=summary]')].map((n) => n.textContent.trim()).filter((t) => t).slice(0, 4),
      notice, inlineScripts: document.querySelectorAll('script:not([src])').length, bodyHasScriptText: document.body.innerHTML.includes('<script>'),
      switchLinks: [...document.querySelectorAll('a[href*="player.html"], a[href*="videojs.html"], a[href*="media="]')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') })),
    };
  });
}
async function presetResponses(net) {
  return net.filter((e) => e.action === 'player-preset').map((e) => `${e.method} ${e.status}`);
}

async function open(name, path, { play = false, playSeconds = 0 } = {}) {
  const context = await newContext(browser, { height: 900 });
  const net = recordNetwork(context);
  const events = trackEvents(context);
  const bodies = [];
  context.on('response', async (res) => {
    if (/action=player-preset/.test(res.url())) bodies.push({ status: res.status(), body: redact(await res.json().catch(() => null)) });
  });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const dir = name.startsWith('PL17') ? 'PL17' : 'PL18';
  const r = { path };
  try {
    await page.goto(`${BASE}${path}`);
    await sleep(2500);
    r.page = await inspect(page);
    await page.screenshot({ path: `${EV}/${dir}/${name}-ready.png` });
    if (play) {
      const p = await playToEnd(page, { label: name, shotDir: dir, net });
      r.contentEnded = p.contentEnded;
      r.overlayTexts = p.overlayTexts;
      r.sequence = p.timeline.map((t) => t.media.filter((m) => m.src && !m.paused).map((m) => m.src.split('/').pop()).join('+'));
    } else if (playSeconds) {
      const box = await page.locator('video').first().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(playSeconds * 1000);
      r.playingAfter = await page.evaluate(() => {
        const all = (root) => [...root.querySelectorAll('video')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
        return all(document).map((v) => ({ src: (v.currentSrc || v.src).split('/').pop(), paused: v.paused, t: Math.round(v.currentTime) }));
      });
      await page.screenshot({ path: `${EV}/${dir}/${name}-playing.png` });
    }
    r.presetRequests = await presetResponses(net);
    r.presetBodies = bodies;
    r.assetStatuses = net.filter((e) => /\/assets\//.test(e.url)).map((e) => `${e.status} ${e.url.replace(BASE, '')}`);
    r.non2xx = net.filter((e) => (e.status >= 400 || e.failed) && !/content-scene-01\.mp4/.test(e.url)).map((e) => `${e.method} ${e.url.replace(BASE, '')} ${e.status} ${e.failed ?? ''}`);
    r.events = events.map((e) => `${e.status} ${e.items.map((i) => i.type).join('+')}`);
  } catch (error) {
    r.error = String(error).slice(0, 1200);
    await page.screenshot({ path: `${EV}/${dir}/${name}-error.png` }).catch(() => {});
  }
  r.console = logs.filter((l) => !/404 \(Not Found\)/.test(l.text) || !l.url);
  await context.close();
  return r;
}

const only = process.env.ONLY;
if (!only || only === 'PL17') {
  result.PL17.videojsPA = await open('PL17-1-videojs-PA', `/examples/videojs.html?${Q}&preset=${PA}`, { play: true });
  result.PL17.playerPB = await open('PL17-2-player-PB', `/examples/player.html?${Q}&preset=${PB}`, { play: true });
  result.PL17.playerPA = await open('PL17-3-player-PA', `/examples/player.html?${Q}&preset=${PA}`, { playSeconds: 8 });
}
if (!only || only === 'PL18') {
  result.PL18.notFound = await open('PL18-1-notfound', `/examples/videojs.html?${Q}&preset=p-zzzzzzzzzz`, { playSeconds: 8 });
  result.PL18.invalid = await open('PL18-2-invalid', `/examples/videojs.html?${Q}&preset=%3Cscript%3Ealert(1)%3C/script%3E`, { playSeconds: 8 });
  result.PL18.none = await open('PL18-3-none', `/examples/videojs.html?${Q}`, { playSeconds: 4 });
}
save('PL17-18/result.json', result);
await browser.close();
