// A2-D-QA D04 install code: for several demo states the shown HTML code is read with its reason line, pasted unchanged
// into an empty same-origin page (/__qa/paste/) and opened. The pasted player is compared with the demo player, its
// schedule request must be the real published one (not the sample), and a click starts an ad. Last, the same code with
// a video ID that has no own schedule shows what a visitor gets.
import { launch, newContext, consoleCollector, save, shot, sleep } from './lib.mjs';
import { clickPlay, openPage, players, qaState, waitQa, writePaste } from './a2.mjs';
import { demoState, openDemo, player, requestLog } from './demo.mjs';

const CASES = [
  { name: 'site-mix', query: '?autoplay=true&loop=true&language=ja&posterUrl=%2Fdemo-media%2Fad.png&titleText=QA+붙여넣기&media=hls&engine=hlsjs' },
  { name: 'rounded-muted', query: '?preset=rounded&muted=true&preload=none' },
  { name: 'autoplay-preset-off', query: '?preset=p-lc3i8eidb4&autoplay=false' },
  { name: 'autoplay-preset-same', query: '?preset=p-lc3i8eidb4' },
  { name: 'native-loop', query: '?preset=p-pchm59hhyv&loop=true&titleText=QA+native' },
];
const look = (p) => p && { tree: p.tree, lang: p.i18nLang, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, media: p.media && { tag: p.media.tag, src: p.media.src, preload: p.media.preload, autoplay: p.media.autoplayAttr, muted: p.media.mutedProp, loop: p.media.loop, poster: p.media.poster, controls: p.media.controls, tracks: p.media.tracks.length }, contentTitle: p.playerAttrs?.contentTitle, poster: p.playerAttrs?.poster };
const adsSrc = (page, selector) => page.evaluate((s) => (document.querySelector(s)?.querySelector('media-ads')?.getAttribute('src') ?? null)?.replace(location.origin, ''), selector);

const browser = await launch();
const result = { cases: [] };
const context = await newContext(browser, { width: 1280, height: 1000 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);

async function pasteAndOpen(name, code) {
  const url = writePaste(name, code, { title: `A2-D-QA ${name}` });
  const from = req.all().length;
  const open = await openPage(context, url);
  const ready = await waitQa(open.page, (s) => s.ready.length || s.errors.length, 15000);
  await sleep(1500);
  const before = look((await players(open.page))[0]);
  const src = await adsSrc(open.page, '[data-solad-player]');
  await shot(open.page, `D04/paste-${name}.png`);
  if (!before?.media?.autoplay) await clickPlay(open.page);
  const qa = await waitQa(open.page, (s) => s.ads.some((a) => a.type === 'start' || a.type === 'error'), 12000);
  await sleep(800);
  const playing = (await players(open.page))[0];
  await shot(open.page, `D04/paste-${name}-ad.png`);
  const requests = req.all().slice(from).filter((r) => r.path.includes('/api/') || r.path.includes('schedule')).map((r) => `${r.method} ${r.path}`);
  await open.page.close();
  return { url: url.replace(/^https?:\/\/[^/]+/, ''), ready: ready.ready, errors: ready.errors, look: before, adsSrc: src, ads: qa.ads.slice(0, 8), adText: playing?.visibleText?.filter((t) => /광고|건너|Skip|초/.test(t)).slice(0, 6), requests, console: open.all.filter((c) => c.type !== 'debug').slice(0, 10) };
}

try {
  for (const c of CASES) {
    await openDemo(page, c.query);
    await sleep(1500);
    const s = await demoState(page);
    const demo = look(await player(page));
    await shot(page, `D04/demo-${c.name}.png`, { fullPage: true });
    const paste = await pasteAndOpen(c.name, s.codeHtml);
    const keys = ['tree', 'lang', 'fill', 'radius', 'contentTitle', 'poster'];
    const mediaKeys = ['tag', 'src', 'preload', 'autoplay', 'muted', 'loop', 'tracks'];
    const diff = [...keys.filter((k) => JSON.stringify(demo?.[k]) !== JSON.stringify(paste.look?.[k])).map((k) => `${k}: ${JSON.stringify(demo?.[k])} → ${JSON.stringify(paste.look?.[k])}`), ...mediaKeys.filter((k) => JSON.stringify(demo?.media?.[k]) !== JSON.stringify(paste.look?.media?.[k])).map((k) => `media.${k}: ${JSON.stringify(demo?.media?.[k])} → ${JSON.stringify(paste.look?.media?.[k])}`)];
    result.cases.push({ name: c.name, query: s.query, ignored: s.notes, preset: s.preset.value, toggles: s.toggles, codeWhy: s.codeWhy, codeHtml: s.codeHtml, codeJs: s.codeJs, demo, demoAdsSrc: await adsSrc(page, '#player'), paste, diff });
  }

  // A video ID without its own schedule: the rounded case's code with only data-video-id changed.
  const base = result.cases.find((c) => c.name === 'rounded-muted').codeHtml;
  result.noSchedule = await pasteAndOpen('no-schedule', base.replace('data-video-id="grok-demo-scene-01"', 'data-video-id="qa-a2d-no-schedule"'));
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D04/error.png', { fullPage: true }).catch(() => {});
}
result.events = req.events();
result.console = logs;
await context.close();
save('D04/result.json', result);
await browser.close();
