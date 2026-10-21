// A2-D-QA probe: one signed-out demo load to see the page shape before writing the scenario scripts.
import { launch, newContext, consoleCollector, save, shot } from './lib.mjs';
import { demoState, openDemo, player, requestLog } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1000 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
await openDemo(page);
const result = { state: await demoState(page), player: await player(page), api: req.actions(), console: logs };
await shot(page, 'probe/demo-1280.png', { fullPage: true });
save('probe/demo.json', result);
await browser.close();
