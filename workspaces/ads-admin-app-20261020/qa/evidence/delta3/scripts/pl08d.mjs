// A1-QA-DELTA PL08: two windows on P-A. (1) different fields: A saves ads accent, B edits font size → 409 → reload
// → B adopts A's accent and keeps its font size, second save keeps both. (2) same field: both edit 강조색.
// Restores P-A afterwards. Expected behaviour source: ui/src/screens/preset-form.ts rebaseForm.
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { gotoList, readForm, fill, liveTexts, presetForm, field, listJson } from './presets.mjs';

const P_A = 'QA Video.js 중립 v2';
const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const net = recordNetwork(context);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const calls = (t) => apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ` ${c.error.code}` : ''}`);
const pa = async (page) => (await listJson(page)).data.presets.find((p) => p.name === P_A);
const brief = (p) => ({ accent: p.theme.accentColor, adsAccent: p.ads.accentColor, font: p.ads.fontSize, radius: p.theme.borderRadius, updatedAt: p.updatedAt });
const openEdit = async (page) => {
  await gotoList(page);
  await page.getByRole('button', { name: `${P_A} 수정`, exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(1000);
};
const formButtons = (page) => presetForm(page).getByRole('button').filter({ visible: true }).allInnerTexts();
const pick = (form, keys) => Object.fromEntries(keys.map((k) => [k, form[k]]));
const KEYS = ['강조색', '광고 음량 막대 색', '광고 글자 크기 (px)', '모서리 둥글기 (px)'];

async function saveB(b) {
  const t = mark();
  await presetForm(b).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  return { api: calls(t), live: await liveTexts(b) };
}

async function reloadAfterConflict(b, tag) {
  const buttons = await formButtons(b);
  const pageButtons = await b.locator('main').filter({ visible: true }).getByRole('button', { name: /다시 불러오기/ }).allInnerTexts();
  const button = b.locator('main').filter({ visible: true }).getByRole('button', { name: /다시 불러오기/ }).first();
  const t = mark();
  await button.click();
  await sleep(1500);
  const dialog = b.getByRole('dialog').filter({ visible: true });
  let dialogText = null;
  if (await dialog.count()) {
    dialogText = await dialog.innerText();
    await dialog.getByRole('button').filter({ hasNotText: '취소' }).filter({ hasNotText: '닫기' }).last().click();
    await sleep(1500);
  }
  const out = { formButtonsAt409: buttons, reloadButtons: pageButtons, dialogText, api: calls(t), live: await liveTexts(b), form: pick(await readForm(b), KEYS) };
  out.fieldStates = {};
  for (const k of KEYS) {
    out.fieldStates[k] = await field(b, k).evaluate((el) => ({
      invalid: el.getAttribute('aria-invalid'),
      described: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean),
    }));
  }
  await shot(b, `PL08/${tag}-b-after-reload.png`, { fullPage: true });
  return out;
}

const a = await context.newPage();
const b = await context.newPage();
const logs = { a: consoleCollector(a), b: consoleCollector(b) };
try {
  await login(a);
  const original = await pa(a);
  result.original = brief(original);

  // (1) Different fields ---------------------------------------------
  {
    const r = {};
    await openEdit(a);
    await openEdit(b);
    await a.bringToFront();
    await fill(a, { '광고 음량 막대 색': '#ff8800' });
    let t = mark();
    await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
    await sleep(1500);
    r.aSave = calls(t);
    r.serverAfterA = brief(await pa(a));
    await b.bringToFront();
    await fill(b, { '광고 글자 크기 (px)': '16' });
    r.bFirst = await saveB(b);
    await shot(b, 'PL08/diff-b-409.png', { fullPage: true });
    r.bReload = await reloadAfterConflict(b, 'diff');
    r.bSecond = await saveB(b);
    r.serverAfterB = brief(await pa(b));
    r.pass = r.bReload.form['광고 음량 막대 색'] === '#ff8800' && r.bReload.form['광고 글자 크기 (px)'] === '16' && r.serverAfterB.adsAccent === '#ff8800' && r.serverAfterB.font === 16;
    await shot(b, 'PL08/diff-b-second-save.png', { fullPage: true });
    result.differentFields = r;
  }

  // (2) Same field ----------------------------------------------------
  {
    const r = {};
    await a.bringToFront();
    await openEdit(a);
    await b.bringToFront();
    await openEdit(b);
    await a.bringToFront();
    await fill(a, { 강조색: '#111111' });
    let t = mark();
    await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
    await sleep(1500);
    r.aSave = calls(t);
    r.serverAfterA = brief(await pa(a));
    await b.bringToFront();
    await fill(b, { 강조색: '#222222' });
    r.bFirst = await saveB(b);
    r.bReload = await reloadAfterConflict(b, 'same');
    r.bSecond = await saveB(b);
    r.serverAfterB = brief(await pa(b));
    await shot(b, 'PL08/same-b-second-save.png', { fullPage: true });
    result.sameField = r;
  }

  // Restore P-A to its values before PL08.
  await a.bringToFront();
  await a.reload();
  await openEdit(a);
  await fill(a, { 강조색: original.theme.accentColor ?? '', '광고 음량 막대 색': original.ads.accentColor ?? '', '광고 글자 크기 (px)': String(original.ads.fontSize ?? ''), '모서리 둥글기 (px)': String(original.theme.borderRadius ?? '') });
  const t = mark();
  await presetForm(a).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.restore = { api: calls(t), server: brief(await pa(a)) };
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(b, 'PL08/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL08/result.json', result);
await browser.close();
