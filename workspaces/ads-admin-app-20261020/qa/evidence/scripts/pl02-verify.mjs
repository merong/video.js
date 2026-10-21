// PL02 reload check: a fresh session opens P-A by its list "수정" button and reads the stored values.
import { launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { gotoList, readForm, presetForm } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
try {
  await login(page);
  await gotoList(page);
  await page.reload();
  await gotoList(page);
  await page.getByRole('button', { name: 'QA Video.js 중립 수정', exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(1000);
  result.editHash = new URL(page.url()).hash;
  result.values = await readForm(page);
  await shot(page, 'PL02/edit-after-reload.png', { fullPage: true });
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
result.console = logs;
save('PL02/result-reload.json', result);
await browser.close();
