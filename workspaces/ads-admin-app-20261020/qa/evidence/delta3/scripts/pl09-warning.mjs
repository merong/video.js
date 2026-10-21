// A1-QA-DELTA PL09 add-on (R3-2): the low-contrast warning on 강조 글자색 is linked to both the picker and the text box.
// New preset form only; nothing is saved.
import { BASE, launch, newContext, login, recordNetwork, save, shot, sleep, apiCalls } from './lib.mjs';
import { presetForm, fill } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const page = await context.newPage();
const result = {};
const describe = (loc) => loc.evaluate((el) => ({
  type: el.getAttribute('type'),
  describedBy: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? null),
  invalid: el.getAttribute('aria-invalid'),
}));
try {
  await login(page);
  await page.goto(`${BASE}/#/players/new`);
  await presetForm(page).waitFor();
  await sleep(1000);
  await fill(page, { 강조색: '#ffffff', '강조 글자색': '#eeeeee' });
  await page.keyboard.press('Tab');
  await sleep(300);
  const box = presetForm(page).getByRole('textbox', { name: '강조 글자색', exact: true });
  const pick = box.locator('xpath=ancestor::div[contains(@class,"sa-color")][1]').locator('input[type="color"]');
  result.text = await describe(box);
  result.picker = await describe(pick);
  result.pass = result.text.describedBy.some((d) => d?.includes('대비')) && result.picker.describedBy.some((d) => d?.includes('대비'));
  await shot(page, 'PL09/contrast-warning.png', { fullPage: true });
  result.writes = apiCalls(net, 0).filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.action} ${c.status}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('PL09/result-warning.json', result);
await browser.close();
