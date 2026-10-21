// A2-1-QA L03: player-preset failures fall back to the built-in default and ads still play. Only player-preset is
// routed; schedule and events go to the server. Each page has two placeholders on the same preset so "one warning per
// page" is visible. (e) uses a real 404 from a data-preset id that does not exist.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, cdpNetwork, clickPlay, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const isPreset = (url) => new URL(url).searchParams.get('action') === 'player-preset';
const page2 = (name, extra = {}) =>
  writePaste(name, ['a', 'b'].map((n, i) => placeholder({ id: `${name}-${n}`, 'data-solad-player': true, 'data-video-id': `a1-qa-video-${i + 1}`, 'data-src': CONTENT, ...extra })).join('\n') + `\n${LOADER_TAG}`);

const CASES = {
  'a-500': { url: page2('l03-500'), route: (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":{"code":"server_error","message":"QA 500"}}' }) },
  'b-disconnect': { url: page2('l03-disconnect'), route: (route) => route.abort('connectionreset') },
  'c-delay-4s': {
    url: page2('l03-delay'),
    route: async (route) => {
      await sleep(4000);
      await route.continue().catch(() => {});
    },
  },
  'd-invalid-body': {
    url: page2('l03-invalid'),
    route: async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      // A CSS value outside the colour rule; the render validator must reject the whole preset.
      body.data.css = { ...body.data.css, '--media-accent-color': 'url(javascript:alert(1))' };
      await route.fulfill({ response, body: JSON.stringify(body) });
    },
  },
  'e-missing-id-404': { url: page2('l03-missing', { 'data-preset': 'p-zzzzzzzzzz' }), route: null },
};

const browser = await launch();
const result = {};
for (const [key, c] of Object.entries(CASES)) {
  const context = await newContext(browser);
  const routed = [];
  const r = {};
  try {
    const { page, solad, all } = await openPage(context, 'about:blank', {
      routes: async (p) => {
        if (c.route) await p.route((url) => isPreset(url.href), (route) => { routed.push(route.request().url().replace(/^https?:\/\/[^/]+/, '')); return c.route(route); });
      },
    });
    const net = await cdpNetwork(page);
    const t0 = Date.now();
    await page.goto(c.url);
    const s = await waitQa(page, (q) => q.ready.length >= 2 || q.errors.length, 12000);
    r.readyAfterMs = Date.now() - t0;
    r.ready = s.ready;
    r.errors = s.errors;
    await sleep(800);
    const ps = await players(page);
    r.players = ps.map((p) => ({ id: p.id, tree: p.tree, fill: p.skin?.fillBefore, accentVar: p.skin?.accentVar, radius: p.skin?.borderRadius, i18n: p.i18nLang, adsLang: p.ads?.lang, visibleText: p.visibleText.filter((t) => !t.startsWith('@')) }));
    await shot(page, `L03/${key}-ready.png`, { fullPage: true });
    await clickPlay(page, 0);
    const ad = await waitQa(page, (q) => q.ads.some((a) => a.type === 'start'), 20000);
    await sleep(1500);
    r.adEvents = ad.ads.map((a) => `${a.target}:${a.type}@${a.contentTime}`);
    r.adText = (await players(page))[0].visibleText.filter((t) => !t.startsWith('@'));
    await shot(page, `L03/${key}-ad.png`, { fullPage: true });
    r.routed = routed;
    r.presetRequests = net.presets();
    r.scheduleRequests = net.all().filter((x) => /action=schedule(&|$)/.test(x.url ?? '')).map((x) => ({ url: x.url.replace(/videoId=[^&]+/, 'videoId=…'), status: x.status, wireStatus: x.wireStatus }));
    r.httpErrors = net.errors().map((x) => `${x.status ?? x.wireStatus} ${x.url}`);
    r.soladWarnings = solad;
    r.soladWarningCount = solad.length;
    r.console = all.filter((l) => ['error', 'warning'].includes(l.type));
    await page.close();
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  result[key] = r;
  await context.close();
}
save('L03/result.json', result);
await browser.close();
