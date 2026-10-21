// PL09: invalid inputs one at a time on a fresh new-preset form; errors tied to the field, input kept, server 422 path if sent.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { captureBodies, liveTexts, presetForm, field, listJson } from './presets.mjs';

const NAME = 'QA PL09 검증';
const CASES = [
  ['name-blank', '이름', ''],
  ['name-41', '이름', '가'.repeat(41)],
  ['accent-GGG', '강조색', '#GGG'],
  ['accent-upper', '강조색', '#ABCDEF'],
  ['radius-33', '모서리 둥글기 (px)', '33'],
  ['timer-foo', '광고 시간 문구', '{foo}'],
];
const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
let page = await context.newPage();
const logs = consoleCollector(page);
const ONLY = process.env.CASES?.split(',');
const result = { cases: [] };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);

const describe = (control) => control.evaluate((el) => ({
  value: el.value,
  maxLength: el.maxLength,
  ariaInvalid: el.getAttribute('aria-invalid'),
  describedBy: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => ({ id, text: document.getElementById(id)?.textContent.trim() ?? null })),
  validationMessage: el.validationMessage || null,
}));

try {
  await login(page);
  for (const [key, label, value] of CASES) {
    if (ONLY && !ONLY.includes(key)) continue;
    const c = { key, label, input: value.length > 20 ? `${value.slice(0, 3)}…(${value.length})` : value };
    // A fresh tab per case: closing without beforeunload avoids the native leave prompt of a dirty form.
    const fresh = await context.newPage();
    consoleCollector(fresh, logs);
    await page.close({ runBeforeUnload: false });
    page = fresh;
    await page.goto(`${BASE}/#/players/new`);
    await presetForm(page).waitFor();
    await sleep(1000);
    if (label !== '이름') await field(page, '이름').fill(NAME);
    await field(page, label).fill(value);
    const t = mark();
    await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
    await sleep(1500);
    c.api = apiCalls(net, t).map((x) => `${x.method} ${x.action} ${x.status} ${x.error?.code ?? ''} ${x.error?.fields ? JSON.stringify(x.error.fields) : ''}`.trim());
    c.field = await describe(field(page, label));
    c.live = await liveTexts(page);
    c.invalidFields = await presetForm(page).locator('[aria-invalid="true"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || el.labels?.[0]?.textContent.trim() || el.id));
    c.activeAfter = await page.evaluate(() => document.activeElement?.labels?.[0]?.textContent.trim() || document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName);
    c.hash = new URL(page.url()).hash;
    await presetForm(page).screenshot({ path: `${(await import('./lib.mjs')).EV}/PL09/${key}.png` });
    result.cases.push(c);
  }
  result.storedAfter = (await listJson(page)).data.presets.map((p) => `${p.id} ${p.name}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL09/error.png', { fullPage: true }).catch(() => {});
}
result.bodies = bodies.filter((b) => b.method === 'POST').map((b) => ({ action: b.action, status: b.status, sent: b.sent, error: b.body?.error }));
result.console = logs;
save('PL09/result.json', result);
await browser.close();
