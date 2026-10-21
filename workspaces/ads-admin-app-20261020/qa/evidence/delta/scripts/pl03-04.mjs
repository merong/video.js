// PL03: edit P-A name and accent, reload, revision/updatedAt rise. PL04: duplicate built-in and P-A, save, edit the copy.
import { launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';
import { captureBodies, gotoList, listRows, listJson, readForm, fill, liveTexts, presetForm, field } from './presets.mjs';

const P_A_ID = 'p-vym1rjw052';
const NEW_NAME = 'QA Video.js 중립 v2';
const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const bodies = captureBodies(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { PL03: {}, PL04: {} };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const pick = (json, id) => json.data.presets.find((p) => p.id === id);

try {
  await login(page);
  // PL03 -------------------------------------------------------------
  const r = result.PL03;
  const before = await listJson(page);
  r.before = { revision: before.data.revision, preset: pick(before, P_A_ID), others: before.data.presets.filter((p) => p.id !== P_A_ID) };
  if (r.before.preset.name !== NEW_NAME) {
    await gotoList(page);
    await page.getByRole('button', { name: 'QA Video.js 중립 수정', exact: true }).click();
    await presetForm(page).waitFor();
    await sleep(1200);
    await fill(page, { 이름: NEW_NAME, 강조색: '#0f5132' });
    const t = mark();
    await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
    await sleep(2000);
    r.saveApi = apiCalls(net, t);
    r.live = await liveTexts(page);
    await shot(page, 'PL03/after-save.png', { fullPage: true });
  }
  await page.reload();
  await gotoList(page);
  r.listAfterReload = await listRows(page);
  await page.getByRole('button', { name: `${NEW_NAME} 수정`, exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(1000);
  r.formAfterReload = await readForm(page);
  await shot(page, 'PL03/edit-after-reload.png', { fullPage: true });
  const after = await listJson(page);
  r.after = { revision: after.data.revision, preset: pick(after, P_A_ID), othersUnchanged: JSON.stringify(after.data.presets.filter((p) => p.id !== P_A_ID)) === JSON.stringify(r.before.others) };

  // PL04 -------------------------------------------------------------
  const d = result.PL04;
  d.before = (await listJson(page)).data.presets.map((p) => ({ id: p.id, name: p.name }));
  for (const source of ['기본', NEW_NAME]) {
    const step = { source };
    await gotoList(page);
    const t = mark();
    await page.getByRole('button', { name: `${source} 복제`, exact: true }).click();
    await sleep(1500);
    step.hashAfterClick = new URL(page.url()).hash;
    step.apiAfterClick = apiCalls(net, t);
    step.formVisible = await presetForm(page).isVisible();
    if (step.formVisible) {
      step.formBeforeSave = await readForm(page);
      step.heading = await page.locator('main h2').filter({ visible: true }).allInnerTexts();
      await shot(page, `PL04/copy-${source === '기본' ? 'default' : 'p-a'}-form.png`, { fullPage: true });
      const t2 = mark();
      await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
      await sleep(2000);
      step.saveApi = apiCalls(net, t2);
      step.live = await liveTexts(page);
      step.hashAfterSave = new URL(page.url()).hash;
    }
    d[source === '기본' ? 'copyDefault' : 'copyPA'] = step;
  }
  const json = await listJson(page);
  d.after = json.data.presets;
  d.defaultPresetId = json.data.defaultPresetId;
  await gotoList(page);
  d.listRows = await listRows(page);
  await shot(page, 'PL04/list.png', { fullPage: true });
  // The P-A copy can be edited: open it and check the name field is editable.
  const copy = json.data.presets.find((p) => !p.builtIn && p.id !== P_A_ID && p.playerType === 'videojs' && p.skin === 'neutral');
  if (copy) {
    await page.getByRole('button', { name: `${copy.name} 수정`, exact: true }).click();
    await presetForm(page).waitFor();
    await sleep(800);
    d.copyEditable = { name: copy.name, editable: await field(page, '이름').isEditable(), saveEnabled: await presetForm(page).getByRole('button', { name: '프리셋 저장' }).isEnabled() };
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL03/error.png', { fullPage: true }).catch(() => {});
}
result.bodies = bodies.filter((b) => b.method === 'POST').map((b) => ({ action: b.action, status: b.status, sent: b.sent, preset: b.body?.data?.preset, revision: b.body?.data?.revision, error: b.body?.error }));
result.console = logs;
save('PL03-04/result.json', result);
await browser.close();
