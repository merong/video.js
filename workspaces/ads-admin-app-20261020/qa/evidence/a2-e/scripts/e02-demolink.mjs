// A2-E-QA E02 extra: the dialog's "데모에서 열기" opens a new page at the demo with that preset chosen.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 800 });
const page = await context.newPage();
await login(page);
await page.goto(`${BASE}/#/players`);
await page.getByRole('button', { name: '둥근 테두리 미리보기', exact: true }).click();
await page.locator('dialog.sa-dialog[open]').waitFor();
const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('dialog .sa-dialog-f a').click()]);
await popup.waitForURL(/examples\/index\.html/, { timeout: 15000 });
await popup.locator('#preset option').first().waitFor({ state: 'attached' });
await sleep(1500);
const out = { url: popup.url().replace(BASE, ''), selected: await popup.locator('#preset').inputValue(), opener: await popup.evaluate(() => window.opener === null), dialogStillOpen: await page.locator('dialog.sa-dialog[open]').count() };
save('E02/demo-link.json', out);
console.log(JSON.stringify(out));
await browser.close();
