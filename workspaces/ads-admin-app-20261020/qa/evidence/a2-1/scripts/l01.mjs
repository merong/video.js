// A2-1-QA L01: the 초기 설정 loader code pasted unchanged into an empty page plays with the site preset's theme and
// language, with pre-roll and post-roll ads. Run once with 강조색 applied to the site and once with 기본.
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep } from './lib.mjs';
import { clickPlay, openPage, players, waitQa, writePaste } from './a2.mjs';
import { applyUI, loaderCode, presetList } from './admin.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const admin = await context.newPage();
const adminLogs = consoleCollector(admin);
const result = { runs: {} };

const phase = (ads) => ads.map((a) => `${a.contentTime === 0 ? 'pre' : a.contentTime >= 9.9 ? 'post' : `mid@${a.contentTime?.toFixed?.(1)}`}:${a.type}`);

async function run(state) {
  const r = {};
  const { page, solad, all } = await openPage(context, url);
  r.ready = (await waitQa(page, (s) => s.ready.length || s.errors.length, 15000)).ready;
  await sleep(1200);
  r.before = (await players(page))[0];
  await shot(page, `L01/${state}-ready.png`);
  await clickPlay(page);
  await sleep(3000);
  r.duringPre = (await players(page))[0];
  await shot(page, `L01/${state}-preroll.png`);
  const done = await waitQa(page, (s) => s.ads.some((a) => a.type === 'complete' && a.contentTime >= 9.9), 90000);
  r.adSequence = phase(done.ads);
  r.events = done.ads;
  r.errors = done.errors;
  await shot(page, `L01/${state}-after-post.png`);
  r.after = (await players(page))[0];
  r.solad = solad;
  r.console = all.filter((l) => ['error', 'warning'].includes(l.type));
  await page.close();
  return r;
}

let url;
try {
  await login(admin);
  result.code = await loaderCode(admin);
  save('L01/loader-code.txt', result.code ?? '(코드 없음)');
  await shot(admin, 'L01/setup-code.png', { fullPage: true });
  // The code is pasted unchanged into an otherwise empty page.
  url = writePaste('l01', result.code);
  result.paste = 'qa/fixtures/paste/a2-1-l01.html';

  result.applyAccent = await applyUI(admin, '강조색');
  result.listAfterAccent = (await presetList(admin)).defaultPresetId;
  result.runs.accent = await run('accent');

  result.applyDefault = await applyUI(admin, '기본');
  result.listAfterDefault = (await presetList(admin)).defaultPresetId;
  result.runs.default = await run('default');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(admin, 'L01/error.png', { fullPage: true }).catch(() => {});
}
result.presetRequests = net.filter((e) => e.action === 'player-preset').map((e) => ({ t: e.t, status: e.status, url: e.url.replace(/^https?:\/\/[^/]+/, '') }));
result.adminConsole = adminLogs;
save('L01/result.json', result);
save('L01/network.json', net);
await browser.close();
