// A2-1-QA probe: a loader page with the site preset; dumps the built tree and the ad event shape through one full play.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, clickPlay, openPage, placeholder, players, qaState, waitQa, writePaste } from './a2.mjs';

const url = writePaste('probe', `${placeholder({ id: 'p1', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT })}\n${LOADER_TAG}`);
const browser = await launch();
const context = await newContext(browser);
const { page, solad, all } = await openPage(context, url);
const result = {};
await waitQa(page, (s) => s.ready.length || s.errors.length, 15000);
await sleep(1500);
result.before = await players(page);
await shot(page, 'probe/loader-ready.png');
await clickPlay(page);
await sleep(2500);
result.during = await players(page);
await shot(page, 'probe/loader-ad.png');
result.state = await waitQa(page, (s) => s.ads.some((a) => a.type === 'complete' && /post/i.test(JSON.stringify(a))), 70000);
result.after = await players(page);
result.solad = solad;
result.console = all.slice(0, 40);
save('probe/loader.json', result);
await browser.close();
