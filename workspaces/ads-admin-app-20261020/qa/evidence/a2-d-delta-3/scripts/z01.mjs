// A2-D-QA-DELTA-3 Z01 demo scenes at 1280: Video.js built-in default, the native saved preset p-pchm59hhyv (QA 기본 video)
// and the autoplay preset p-lc3i8eidb4 (QA 자동재생). Order: 미드롤 앞 → 끝 직전 (pressed while the midroll plays) →
// 미드롤 앞 (after the postroll ends) → 처음부터 → 끝 직전. Per click: ms to the initial line and to that scene's ad, the
// lines seen (no 프리롤 for scene clicks, no 오류), a new player or not, the autoplay attribute, the progress log rows.
// Logged in so the saved presets load. Nothing is saved.
import { launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openDemo, requestLog } from './demo.mjs';
import { install, runSequence, SEQUENCE } from './scenes.mjs';

const browser = await launch();
const result = { runs: [] };
const context = await newContext(browser, { width: 1280, height: 1100 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const logRows = () => page.locator('#log li').allInnerTexts().then((r) => r.map((t) => t.replace(/\s+/g, ' ').trim()));

await login(page);
for (const [label, query] of [['videojs default', '?preset=default'], ['native p-pchm59hhyv', '?preset=p-pchm59hhyv'], ['autoplay p-lc3i8eidb4', '?preset=p-lc3i8eidb4']]) {
  const run = { label, query };
  const from = { logs: logs.length, req: req.all().length };
  try {
    await openDemo(page, query);
    run.selected = await page.locator('#preset').inputValue();
    run.type = await page.evaluate(() => (document.querySelector('#player video-player') ? 'videojs' : document.querySelector('#player video') ? 'native' : null));
    run.initialAutoplay = await page.evaluate(() => { const vp = document.querySelector('#player video-player'); const v = document.querySelector('#player video'); return { vp: vp?.hasAttribute('autoplay') ?? null, video: v?.autoplay ?? null, t: v ? Math.round(v.currentTime * 10) / 10 : null }; });
    await install(page, '#now');
    run.initialLine = await page.evaluate(() => window.__qa.lines[0].text);
    run.steps = await runSequence(page, {
      button: (scene) => page.locator(`button[data-scene="${scene}"]`),
      playerDoc: async () => page,
      playerSel: '#player video-player, #player video',
      steps: SEQUENCE,
      extra: async () => { const rows = await logRows(); return { logRows: rows.length, logError: rows.filter((r) => /오류/.test(r)).length, logHead: rows.slice(0, 3) }; },
    });
    await shot(page, `Z01/${label.split(' ')[0]}-end.png`);
  } catch (error) {
    run.error = String(error).slice(0, 1200);
    await shot(page, `Z01/error-${label.split(' ')[0]}.png`, { fullPage: true }).catch(() => {});
  }
  run.console = logs.slice(from.logs).map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
  run.events = req.all().slice(from.req).filter((x) => /action=events/.test(x.path)).length;
  result.runs.push(run);
}
result.eventsTotal = req.events().length;
await context.close();
save('Z01/result.json', result);
await browser.close();
