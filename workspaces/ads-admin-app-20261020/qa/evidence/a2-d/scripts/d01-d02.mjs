// A2-D-QA D01 public demo (signed out): starts on the site preset, switches to the three built-ins, ?preset=rounded and
// ?preset=accent start there, an unknown or malformed ?preset and bad option values are each named in one notice line
// and ignored. D02: sign in to the admin in the same browser and reload; saved presets join the list with the site mark.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { DEMO, demoState, openDemo, player, requestLog } from './demo.mjs';

const SITE = 'p-i0aecb28w3';
const browser = await launch();
const result = { D01: {}, D02: {} };
const look = (p) => p && { tree: p.tree, lang: p.i18nLang, fill: p.skin?.fillBefore, accent: p.skin?.accentVar, radius: p.skin?.borderRadius, radiusVar: p.skin?.borderRadiusVar, media: p.media && { tag: p.media.tag, src: p.media.src, preload: p.media.preload, autoplay: p.media.autoplayAttr, muted: p.media.mutedProp, loop: p.media.loop, poster: p.media.poster }, contentTitle: p.playerAttrs?.contentTitle, poster: p.playerAttrs?.poster, ads: p.ads?.attrs };
const brief = (s) => ({ query: s.query, preset: s.preset.value, selected: s.preset.options.find((o) => o.selected)?.label, help: s.preset.help, notes: s.notes, codeWhy: s.codeWhy, status: s.stageStatus, reset: s.reset });

const context = await newContext(browser, { width: 1280, height: 1000 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
try {
  await openDemo(page);
  const s = await demoState(page);
  result.D01.start = { ...brief(s), options: s.preset.options, player: look(await player(page)) };
  await shot(page, 'D01/start-1280.png', { fullPage: true });

  result.D01.switch = [];
  for (const id of ['rounded', 'accent', 'default', SITE]) {
    await page.locator('#preset').selectOption(id);
    await sleep(2500);
    const st = await demoState(page);
    result.D01.switch.push({ to: id, ...brief(st), player: look(await player(page)) });
    await shot(page, `D01/switch-${id}.png`);
  }

  for (const q of ['?preset=rounded', '?preset=accent', '?preset=p-zzzzzzzzzz', '?preset=NOPE', '?autoplay=maybe&language=xx&preload=fast&posterUrl=javascript:alert(1)&media=avi', '?preset=rounded&loop=yes&pageLang=de']) {
    await openDemo(page, q);
    const st = await demoState(page);
    result.D01[q] = { ...brief(st), player: look(await player(page)) };
    await shot(page, `D01/query-${q.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`);
  }

  // D02: sign in on this origin, then reload the demo.
  const admin = await context.newPage();
  await login(admin);
  await admin.close();
  await openDemo(page);
  const signed = await demoState(page);
  result.D02.signedIn = { ...brief(signed), options: signed.preset.options };
  await shot(page, 'D02/signed-in-1280.png', { fullPage: true });
  await page.locator('#preset').selectOption('p-lc3i8eidb4');
  await sleep(2500);
  const pick = await demoState(page);
  result.D02.pickSaved = { ...brief(pick), player: look(await player(page)) };
  await shot(page, 'D02/pick-autoplay-preset.png');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D01/error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions();
result.events = req.events();
result.console = logs;
await context.close();
save('D01/result.json', result);
await browser.close();
