// A2-1-QA probe: skin theme values read from the shadow root of <video-skin>.
import { launch, newContext, save, sleep } from './lib.mjs';
import { openPage, players, waitQa } from './a2.mjs';

const browser = await launch();
const context = await newContext(browser);
const { page } = await openPage(context, 'http://127.0.0.1:18781/__qa/paste/a2-1-probe.html');
await waitQa(page, (s) => s.ready.length, 15000);
await sleep(1500);
const p = await players(page);
save('probe/dom2.json', p);
console.log(JSON.stringify(p[0].skin, null, 1));
await browser.close();
