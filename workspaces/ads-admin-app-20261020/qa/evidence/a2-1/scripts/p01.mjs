// A2-1-QA P01 built-in presets: 내장 mark, 수정/삭제 disabled with the reason, 복제 opens a new form, 사이트에 적용 works
// (render and loader follow it), and the API refuses save/delete on built-in ids. Restores the earlier site preset.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { applyUI, openList, presetList } from './admin.mjs';
import { CONTENT, LOADER_TAG, adminCall, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const page = await context.newPage();
const logs = consoleCollector(page);
const dialogs = [];
page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
const result = {};

const buttonState = (name) => page.getByRole('button', { name, exact: true }).evaluate((el) => ({
  disabled: el.disabled,
  reason: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()),
}));

try {
  await login(page);
  const before = await presetList(page);
  result.before = { revision: before.revision, defaultPresetId: before.defaultPresetId, builtIns: before.presets.filter((p) => p.builtIn).map((p) => ({ id: p.id, name: p.name })), savedCount: before.presets.filter((p) => !p.builtIn).length };
  const siteBefore = before.presets.find((p) => p.id === before.defaultPresetId);

  // List rows.
  await openList(page);
  result.rows = {};
  for (const { id, name } of result.before.builtIns) {
    const row = page.getByRole('row').filter({ hasText: id });
    result.rows[id] = {
      text: (await row.innerText()).replace(/\s+/g, ' ').trim(),
      mark: await row.getByText('내장', { exact: true }).count(),
      edit: await buttonState(`${name} 수정`),
      duplicate: await buttonState(`${name} 복제`),
      delete: await buttonState(`${name} 삭제`),
      apply: await buttonState(`${name} 사이트에 적용`),
    };
  }
  result.countNote = (await page.getByText(/저장 프리셋 \d+\/20개/).allInnerTexts()).map((t) => t.trim());
  await shot(page, 'P01/list-1280.png', { fullPage: true });

  // Direct edit route on a built-in id.
  await page.goto(`${BASE}/#/players/edit/rounded`);
  await sleep(1200);
  result.editRoute = {
    hash: await page.evaluate(() => location.hash),
    forms: await page.getByRole('form').count(),
    saveButtons: await page.getByRole('button', { name: '프리셋 저장' }).count(),
    note: (await page.locator('main').innerText()).split('\n').filter((l) => /내장 프리셋은|복제해서 새로 만들기/.test(l)),
  };
  await shot(page, 'P01/edit-route-builtin.png', { fullPage: true });

  // 복제 opens a 새 프리셋 form carrying the built-in values; leave without saving.
  await openList(page);
  await page.getByRole('button', { name: '둥근 테두리 복제', exact: true }).click();
  await page.getByRole('form', { name: '새 프리셋' }).waitFor();
  await sleep(600);
  result.duplicateForm = { hash: await page.evaluate(() => location.hash), name: await page.locator('#aa-preset-name').inputValue(), radius: await page.locator('#aa-preset-theme-borderRadius').inputValue().catch(() => null) };
  await shot(page, 'P01/duplicate-form.png', { fullPage: true });
  await openList(page);
  result.afterLeave = { hash: await page.evaluate(() => location.hash), dialogs: [...dialogs], appDialog: await page.getByRole('dialog').count() };
  if (result.afterLeave.appDialog) {
    result.afterLeave.appDialogText = await page.getByRole('dialog').innerText();
    await shot(page, 'P01/leave-dialog.png');
  }

  // API refusals: save and delete on every built-in id, plus literal PUT/DELETE methods.
  const list = await presetList(page);
  const sample = { ...list.presets.find((p) => p.id === 'rounded') };
  for (const k of ['builtIn', 'createdAt', 'updatedAt']) delete sample[k];
  result.api = {};
  for (const id of ['default', 'rounded', 'accent']) {
    result.api[`save ${id}`] = await adminCall(page, 'player-preset-save', { revision: list.revision, preset: { ...sample, id, name: 'QA 내장 덮어쓰기' } });
    result.api[`delete ${id}`] = await adminCall(page, 'player-preset-delete', { revision: list.revision, id });
  }
  result.api['PUT player-preset-save default'] = await adminCall(page, 'player-preset-save', { revision: list.revision, preset: { ...sample, id: 'default', name: 'QA 내장 덮어쓰기' } }, { method: 'PUT' });
  result.api['DELETE player-preset-delete rounded'] = await adminCall(page, 'player-preset-delete', { revision: list.revision, id: 'rounded' }, { method: 'DELETE' });
  for (const v of Object.values(result.api)) delete v.data;
  const afterApi = await presetList(page);
  result.afterApi = { revision: afterApi.revision, builtIns: afterApi.presets.filter((p) => p.builtIn).map((p) => `${p.id}:${p.name}`) };

  // Apply a built-in through the dialog, then check render and the loader.
  result.applyRounded = await applyUI(page, '둥근 테두리');
  result.afterApply = { defaultPresetId: (await presetList(page)).defaultPresetId };
  await shot(page, 'P01/list-after-apply-rounded.png', { fullPage: true });
  result.render = await page.evaluate(async () => {
    const res = await fetch('/api/index.php?action=player-preset');
    const body = await res.json();
    return { status: res.status, id: body.data?.id, css: body.data?.css };
  });
  const url = writePaste('p01-site', `${placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT })}\n${LOADER_TAG}`);
  const visitor = await newContext(browser);
  {
    const { page: v } = await openPage(visitor, url);
    result.loader = { ready: (await waitQa(v, (q) => q.ready.length || q.errors.length, 12000)).ready };
    await sleep(800);
    const p = (await players(v))[0];
    result.loader.radius = p.skin?.borderRadius;
    result.loader.fill = p.skin?.fillBefore;
    await shot(v, 'P01/loader-rounded.png');
  }
  await visitor.close();

  // Restore the earlier site preset.
  result.restore = await applyUI(page, siteBefore.name);
  result.end = { defaultPresetId: (await presetList(page)).defaultPresetId, expected: before.defaultPresetId };
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'P01/error.png', { fullPage: true }).catch(() => {});
}
result.nativeDialogs = dialogs;
result.console = logs.filter((l) => !/favicon/.test(l.text ?? ''));
save('P01/result.json', result);
await browser.close();
