// A1-QA-DELTA preset.js guards: the public player-preset response is rewritten in the browser (page.route) to carry
// bidi controls, a C0 control or `__proto__` keys. The example page must refuse it (notice, defaults), keep playing
// ads, and not pollute Object.prototype. Console messages of every type are recorded. No server write.
import { BASE, launch, newContext, save, shot, sleep } from './lib.mjs';

const CONTENT = encodeURIComponent(`${BASE}/demo-media/grok-20261018/content-scene-01.mp4`);
const CASES = [
  { key: 'bidi-RLO-skip-label', page: 'videojs', mutate: (d) => { d.attributes['skip-label'] = 'Skip‮ad'; } },
  { key: 'bidi-isolate-lang-lri', page: 'videojs', mutate: (d) => { d.attributes['skip-label'] = '⁦Skip ad⁩'; } },
  { key: 'c0-bell-skip-label', page: 'videojs', mutate: (d) => { d.attributes['skip-label'] = 'Skip\u0007ad'; } },
  { key: 'proto-in-attributes', page: 'videojs', raw: (t) => t.replace('"attributes":{', '"attributes":{"__proto__":{"polluted":"yes"},') },
  { key: 'proto-in-css', page: 'videojs', raw: (t) => t.replace('"css":{', '"css":{"__proto__":"red",') },
  { key: 'constructor-in-css', page: 'videojs', raw: (t) => t.replace('"css":{', '"css":{"constructor":"red",') },
  { key: 'proto-in-ui-labels', page: 'videojs', raw: (t) => t.replace(/}}$/, ',"ui":{"labels":{"__proto__":{"polluted":"yes"}}}}}') },
  { key: 'native-bidi-skip-label', page: 'player', preset: 'p-obxpj5v9m9', mutate: (d) => { d.attributes = { ...(d.attributes ?? {}), 'skip-label': 'Skip‮ad' }; } },
  { key: 'control-unmodified', page: 'videojs', mutate: () => {} },
];

const browser = await launch();
const result = {};
for (const c of CASES) {
  const context = await newContext(browser, { height: 900 });
  const page = await context.newPage();
  const consoleAll = [];
  page.on('console', (m) => consoleAll.push(`${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => consoleAll.push(`pageerror: ${String(e).slice(0, 200)}`));
  const r = { case: c.key };
  await page.route('**/api/index.php?action=player-preset*', async (route) => {
    const response = await route.fetch();
    let text = await response.text();
    if (c.mutate) {
      const body = JSON.parse(text);
      c.mutate(body.data);
      text = JSON.stringify(body);
    } else if (c.raw) text = c.raw(text);
    r.injected = text.length;
    r.injectedHasMarker = /__proto__|constructor|\\u202e|\\u2066|\\u0007|‮|⁦|\u0007/.test(text);
    await route.fulfill({ response, body: text, headers: { ...response.headers(), 'content-length': String(Buffer.byteLength(text)) } });
  });
  const preset = c.preset ?? 'p-qrgzuc8ste';
  await page.goto(`${BASE}/examples/${c.page}.html?video=a1-qa-preset-1&content=${CONTENT}&preset=${preset}`);
  await sleep(2500);
  r.notice = await page.locator('#notice').evaluate((n) => (n.hidden ? null : n.textContent.trim())).catch(() => null);
  r.meta = await page.locator('#context').textContent().catch(() => null);
  r.applied = await page.evaluate(() => {
    const skin = document.querySelector('video-neutral-skin, video-skin');
    const ads = document.querySelector('media-ads');
    const cs = skin && getComputedStyle(skin);
    return {
      skinTag: skin?.tagName.toLowerCase() ?? null,
      accent: cs?.getPropertyValue('--media-accent-color').trim() || null,
      adsAttrs: ads ? Object.fromEntries([...ads.attributes].filter((a) => ['lang', 'skip-label', 'skip-countdown-label', 'timer-label'].includes(a.name)).map((a) => [a.name, a.value])) : null,
      prototypePolluted: ({}).polluted !== undefined || Object.prototype.hasOwnProperty('polluted'),
    };
  });
  const box = await page.locator('video').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(6000);
  r.playing = await page.evaluate(() => {
    const out = [];
    const scan = (root) => {
      root.querySelectorAll('video').forEach((v) => out.push({ src: (v.currentSrc || '').split('/').pop(), paused: v.paused, t: Math.round(v.currentTime * 10) / 10 }));
      root.querySelectorAll('*').forEach((n) => n.shadowRoot && scan(n.shadowRoot));
    };
    scan(document);
    return out;
  });
  r.adPlaying = r.playing.some((v) => !/content-scene/.test(v.src) && v.src && !v.paused && v.t > 0);
  r.skipText = await page.evaluate(() => {
    const texts = [];
    const scan = (root) => {
      root.querySelectorAll('button').forEach((b) => /skip|건너/i.test(b.textContent + (b.getAttribute('aria-label') || '')) && texts.push(JSON.stringify(b.textContent.trim())));
      root.querySelectorAll('*').forEach((n) => n.shadowRoot && scan(n.shadowRoot));
    };
    scan(document);
    return texts;
  });
  r.console = consoleAll.filter((l) => !/favicon/.test(l));
  await shot(page, `PRESET-GUARD/${c.key}.png`);
  result[c.key] = r;
  await context.close();
}
save('PRESET-GUARD/result.json', result);
await browser.close();
