// A2-1-QA L02: a duplicated preset applied to the site; changing its 강조색 shows after a reload, an unchanged reload
// revalidates to 304, and two placeholders with the same preset on one page make one player-preset request.
// The PHP built-in server does not log router-handled responses, so Chrome's network view (CDP) is the status source.
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, cdpNetwork, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';
import { applyUI, openList, presetList } from './admin.mjs';

const NAME = 'QA L02 강조색 복제';
const browser = await launch();
const adminContext = await newContext(browser, { height: 1200 });
const admin = await adminContext.newPage();
const adminLogs = consoleCollector(admin);
const adminNet = recordNetwork(adminContext);
const visitor = await newContext(browser);
const result = { steps: [] };
const one = writePaste('l02', `${placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT })}\n${LOADER_TAG}`);
const two = writePaste('l02-two', `${placeholder({ id: 'first', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT })}\n${placeholder({ id: 'second', 'data-solad-player': true, 'data-video-id': 'a1-qa-video-2', 'data-src': CONTENT })}\n${LOADER_TAG}`);

let page;
let net;
async function look(label, { reload = true } = {}) {
  const before = net.presets().length;
  if (reload) await page.reload();
  await waitQa(page, (s) => s.ready.length || s.errors.length, 15000);
  await sleep(1200);
  const p = (await players(page))[0];
  const step = { label, presetRequests: net.presets().slice(before), ready: (await page.evaluate(() => window.__qa.ready)), fill: p.skin?.fillBefore, accentVar: p.skin?.accentVar, adsAccentVar: p.ads?.accentVar };
  result.steps.push(step);
  await shot(page, `L02/${result.steps.length}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`);
  return step;
}

try {
  await login(admin);
  // Duplicate the built-in 강조색 and save it under a new name (attempt 1 already saved it; see L02/attempt-1-list-shape).
  const existing = (await presetList(admin)).presets.find((e) => e.name === NAME);
  if (existing) result.duplicate = `attempt 1에서 화면으로 복제·저장함(${existing.id}). 이번에는 다시 만들지 않음`;
  else {
  await openList(admin);
  await admin.getByRole('button', { name: '강조색 복제' }).click();
  await admin.getByRole('form', { name: '새 프리셋' }).waitFor();
  result.duplicateStatus = (await admin.getByRole('status').allInnerTexts()).filter(Boolean);
  result.duplicateForm = { name: await admin.locator('#aa-preset-name').inputValue(), accent: await admin.locator('#aa-preset-theme-accentColor').inputValue(), adsAccent: await admin.locator('#aa-preset-ads-accentColor').inputValue() };
  await admin.locator('#aa-preset-name').fill(NAME);
  await admin.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.saveStatus = (await admin.getByRole('status').allInnerTexts()).filter(Boolean);
  result.afterSaveUrl = new URL(admin.url()).hash;
  }
  const list = await presetList(admin);
  const clone = list.presets.find((e) => e.name === NAME);
  result.cloneId = clone?.id ?? null;
  result.apply = await applyUI(admin, NAME);
  result.siteAfterApply = (await presetList(admin)).defaultPresetId;

  // Visitor: first load, then a reload after saving a new colour, then an unchanged reload.
  page = (await openPage(visitor, one)).page;
  net = await cdpNetwork(page);
  await look('first-load', { reload: true });
  await look('unchanged-reload-1');

  await admin.goto(`${new URL(admin.url()).origin}/#/players/edit/${result.cloneId}`);
  await admin.getByRole('form', { name: '프리셋 수정' }).waitFor();
  await sleep(800);
  result.saveBar = await admin.locator('.aa-savebar').innerText();
  await admin.locator('#aa-preset-theme-accentColor').fill('#dc2626');
  await admin.locator('#aa-preset-theme-accentColor').press('Tab');
  await admin.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.editStatus = (await admin.getByRole('status').allInnerTexts()).filter(Boolean);
  await shot(admin, 'L02/admin-after-color-save.png', { fullPage: true });

  await look('reload-after-color-save');
  await look('unchanged-reload-2');
  await look('unchanged-reload-3');

  // Two placeholders, same (site) preset, fresh page in the same visitor context.
  const twoPage = await openPage(visitor, two);
  const twoNet = await cdpNetwork(twoPage.page);
  await twoPage.page.reload();
  await waitQa(twoPage.page, (s) => s.ready.length >= 2 || s.errors.length, 15000);
  await sleep(1500);
  result.twoPlaceholders = { presetRequests: twoNet.presets(), ready: await twoPage.page.evaluate(() => window.__qa.ready), fills: (await players(twoPage.page)).map((p) => p.skin?.fillBefore), errors: twoNet.errors() };
  await shot(twoPage.page, 'L02/two-placeholders.png', { fullPage: true });
  result.visitorErrors = net.errors();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(admin, 'L02/error-admin.png', { fullPage: true }).catch(() => {});
}
result.adminApi = adminNet.filter((e) => /player-preset/.test(e.action ?? '')).map((e) => `${e.method} ${e.action} ${e.status}`);
result.adminConsole = adminLogs;
save('L02/result.json', result);
await browser.close();
