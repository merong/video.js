// Probe: which requests answer 404 on the preset edit screen with the preview iframe.
import { launch, newContext, login, save, sleep } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const hits = [];
context.on('response', (r) => { if (r.status() >= 400) hits.push(`${r.status()} ${r.request().method()} ${r.url()} frame=${r.request().frame()?.url()}`); });
const page = await context.newPage();
await login(page);
await gotoList(page);
await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
await presetForm(page).waitFor();
await sleep(3000);
save('PL12/probe-404.json', hits);
await browser.close();
