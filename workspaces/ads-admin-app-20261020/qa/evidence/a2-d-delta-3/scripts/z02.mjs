// A2-D-QA-DELTA-3 Z02 admin previews at 1280: the Z01 order once on the built-in rounded screen (Video.js) and once in the
// editor of the native saved preset p-pchm59hhyv. The admin page's latest-progress line is recorded; the player element in
// the preview frame is tagged per click. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot } from './lib.mjs';
import { requestLog } from './demo.mjs';
import { install, runSequence, SEQUENCE, TEXT } from './scenes.mjs';

const browser = await launch();
const result = { runs: [] };
const context = await newContext(browser, { width: 1280, height: 900 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));

await login(page);
for (const [label, id] of [['videojs built-in rounded', 'rounded'], ['native editor p-pchm59hhyv', 'p-pchm59hhyv']]) {
  const run = { label, id };
  const from = { logs: logs.length, req: req.all().length };
  try {
    await page.goto(`${BASE}/#/players/edit/${id}`);
    const tools = page.locator('.sa-stage-tools').first();
    await tools.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.sa-stage-tools button')?.disabled === false, null, { timeout: 25000 });
    run.type = await frame()?.evaluate(() => (document.querySelector('#player video-player') ? 'videojs' : document.querySelector('#player video') ? 'native' : null));
    await install(page, '.sa-stage-now');
    run.initialLine = await page.evaluate(() => window.__qa.lines[0].text);
    run.steps = await runSequence(page, {
      button: (scene) => tools.getByRole('button', { name: TEXT[scene], exact: true }),
      playerDoc: async () => frame(),
      playerSel: '#player video-player, #player video',
      steps: SEQUENCE,
    });
    await shot(page, `Z02/${id}-end.png`);
  } catch (error) {
    run.error = String(error).slice(0, 1200);
    await shot(page, `Z02/error-${id}.png`, { fullPage: true }).catch(() => {});
  }
  run.console = logs.slice(from.logs).map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
  run.events = req.all().slice(from.req).filter((x) => /action=events/.test(x.path)).length;
  result.runs.push(run);
}
result.eventsTotal = req.events().length;
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
await context.close();
save('Z02/result.json', result);
await browser.close();
