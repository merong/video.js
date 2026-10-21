// A2-D-QA-DELTA-2 Y02 fold reset at 768×1024 and 390×844: (1) built-in rounded opened with 열기, then only the hash changes
// to accent → the card must start folded; (2) saved preset p-i0aecb28w3 opened, then hash → p-lc3i8eidb4 → folded;
// (3) #/players/new opened with 열기, saved (isolated QA DB only) → after the redirect to edit:<id>, read the fold state
// (observation); the created preset is deleted through the list's 삭제 dialog.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { runs: [] };
const state = (card) => card.locator('.sa-ppv-h button[aria-expanded]').evaluate((b) => ({ text: b.textContent.trim(), expanded: b.getAttribute('aria-expanded') })).catch(() => null);
const hidden = (card) => card.locator('div.sa-ppv').evaluate((el) => el.hidden).catch(() => null);

async function openCard(page, card) {
  const b = card.locator('.sa-ppv-h button[aria-expanded]');
  if ((await b.getAttribute('aria-expanded')) === 'false') await b.click();
  await sleep(600);
  return { ...(await state(card)), bodyHidden: await hidden(card) };
}

for (const [width, height] of [[768, 1024], [390, 844]]) {
  const context = await newContext(browser, { width, height });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { size: `${width}x${height}` };
  try {
    await login(page);

    // (1) built-in → built-in by hash only.
    await page.goto(`${BASE}/#/players/edit/rounded`);
    const bi = page.locator('section.aa-builtin-preview');
    await bi.waitFor({ timeout: 15000 });
    await sleep(1200);
    r.builtIn = { start: await state(bi) };
    r.builtIn.opened = await openCard(page, bi);
    await page.evaluate(() => { location.hash = '#/players/edit/accent'; });
    await page.waitForFunction(() => location.hash === '#/players/edit/accent');
    await sleep(1500);
    r.builtIn.afterHash = { hash: await page.evaluate(() => location.hash), h1: await page.locator('main h1:visible, main h2:visible').first().innerText().catch(() => null), ...(await state(bi)), bodyHidden: await hidden(bi), demoHref: await bi.getByRole('link', { name: /데모에서 열기/ }).getAttribute('href').catch(() => null) };
    await shot(page, `Y02/builtin-after-hash-${width}.png`);

    // (2) saved a → saved b by hash only.
    await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
    const ed = page.locator('aside.aa-editor-preview');
    await ed.waitFor({ timeout: 15000 });
    await sleep(1500);
    r.saved = { start: await state(ed) };
    r.saved.opened = await openCard(page, ed);
    await page.evaluate(() => { location.hash = '#/players/edit/p-lc3i8eidb4'; });
    await page.waitForFunction(() => location.hash === '#/players/edit/p-lc3i8eidb4');
    await sleep(1500);
    r.saved.afterHash = { hash: await page.evaluate(() => location.hash), name: await page.locator('#aa-preset-name').inputValue().catch(() => null), ...(await state(ed)), bodyHidden: await hidden(ed) };
    await shot(page, `Y02/saved-after-hash-${width}.png`);

    // (3) new → save → edit:<id> (observation), then delete.
    const name = `QA 접힘 ${width}`;
    await page.goto(`${BASE}/#/players/new`);
    await ed.waitFor({ timeout: 15000 });
    await sleep(1500);
    r.created = { start: await state(ed) };
    r.created.opened = await openCard(page, ed);
    await page.locator('#aa-preset-name').fill(name);
    await page.getByRole('button', { name: '프리셋 저장' }).click();
    await page.waitForFunction(() => /#\/players\/edit\/p-/.test(location.hash), null, { timeout: 15000 });
    await sleep(1500);
    r.created.afterSave = { hash: await page.evaluate(() => location.hash), name: await page.locator('#aa-preset-name').inputValue().catch(() => null), ...(await state(ed)), bodyHidden: await hidden(ed), status: (await page.getByRole('status').allInnerTexts().catch(() => [])).map((t) => t.trim()).filter(Boolean) };
    await shot(page, `Y02/new-after-save-${width}.png`);
    r.overflow = await overflow(page);

    await page.goto(`${BASE}/#/players`);
    await page.getByRole('table').first().waitFor();
    await sleep(800);
    await page.getByRole('button', { name: `${name} 삭제`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
    await sleep(1500);
    r.created.deleted = (await page.getByRole('button', { name: `${name} 삭제`, exact: true }).count()) === 0;
    r.created.rows = (await page.getByRole('table').first().locator('tbody tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').slice(0, 60));
  } catch (error) {
    r.error = String(error).slice(0, 1500);
    await shot(page, `Y02/error-${width}.png`, { fullPage: true }).catch(() => {});
  }
  r.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
  r.events = req.events().length;
  r.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
  result.runs.push(r);
  await context.close();
}
save('Y02/result.json', result);
await browser.close();
