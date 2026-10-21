// HL05: target heading focus for links found in the follow-up pass.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
const out = {};
await login(page);
for (const id of ['start', 'completion', 'click', 'click-through-rate', 'video-context', 'inherit', 'replace', 'disabled', 'revision-conflict']) {
  await page.goto(`${BASE}/#/help/${id}`);
  await sleep(700);
  out[id] = await page.evaluate((t) => ({ heading: Boolean(document.getElementById(`sa-help-${t}`)), focused: document.activeElement?.id === `sa-help-${t}`, title: document.getElementById(`sa-help-${t}`)?.textContent.trim() }), id);
}
save('HL05/targets-followup.json', out);
console.log(JSON.stringify(out));
await browser.close();
