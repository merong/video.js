// A2-1-QA L10 v1 upgrade. The v1 document (qa/evidence/delta2/99-end/player-presets.json) was written into this run's
// ads.sqlite with one UPDATE (see L10/sql-log.txt). Reads must not write; the first save stores schema 2.
import { execFileSync } from 'node:child_process';
import { BASE, QA_DIR, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openList, presetList } from './admin.mjs';
import { CONTENT, LOADER_TAG, clickPlay, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const NEUTRAL = 'p-qrgzuc8ste';
const NATIVE = 'p-6aiokv34yw';
const sql = (q) => execFileSync('sqlite3', ['-readonly', `${QA_DIR}/ads.sqlite`, q], { encoding: 'utf8' }).trim();
const stored = () => ({
  row: sql("SELECT length(value), json_extract(value,'$.schema'), json_extract(value,'$.revision'), json_extract(value,'$.defaultPresetId'), json_array_length(value,'$.presets') FROM ads_meta WHERE name='player_presets';"),
  sha: execFileSync('shasum', ['-a', '256'], { input: sql("SELECT value FROM ads_meta WHERE name='player_presets';") }).toString().slice(0, 16),
});

const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { storedAtStart: stored() };

try {
  await login(page);
  const list = await presetList(page);
  result.list = { revision: list.revision, defaultPresetId: list.defaultPresetId, migratedNeutral: list.migratedNeutral, saved: list.presets.filter((p) => !p.builtIn) };

  await openList(page);
  const main = await page.locator('main').innerText();
  result.listScreen = {
    notice: main.split('\n').filter((l) => /모양이 조금 달라질|중립|옮김/.test(l)),
    neutralRow: (await page.getByRole('row').filter({ hasText: NEUTRAL }).innerText()).replace(/\s+/g, ' ').trim(),
    nativeRow: (await page.getByRole('row').filter({ hasText: NATIVE }).innerText()).replace(/\s+/g, ' ').trim(),
  };
  await shot(page, 'L10/list-migrated.png', { fullPage: true });

  await page.goto(`${BASE}/#/players/edit/${NEUTRAL}`);
  await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
  await sleep(800);
  result.editScreen = {
    name: await page.locator('#aa-preset-name').inputValue(),
    language: await page.locator('#aa-preset-language').inputValue(),
    radius: await page.locator('#aa-preset-theme-borderRadius').inputValue().catch(() => null),
    accent: await page.locator('#aa-preset-theme-accentColor').inputValue().catch(() => null),
    savebar: (await page.locator('.aa-savebar').innerText().catch(() => '')).replace(/\s+/g, ' ').trim(),
  };
  await shot(page, 'L10/edit-neutral.png', { fullPage: true });
  await openList(page);

  result.render = {};
  for (const id of [null, NEUTRAL, NATIVE]) {
    result.render[id ?? 'site'] = await page.evaluate(async (id) => {
      const res = await fetch(`/api/index.php?action=player-preset${id ? `&id=${id}` : ''}`);
      const body = await res.json();
      return { status: res.status, data: body.data };
    }, id);
  }

  const url = writePaste('l10-site', `${placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT })}\n${LOADER_TAG}`, { lang: 'ko' });
  const visitor = await newContext(browser);
  {
    const { page: v, solad } = await openPage(visitor, url);
    const r = { ready: (await waitQa(v, (q) => q.ready.length || q.errors.length, 12000)).ready };
    await sleep(1000);
    const p = (await players(v))[0];
    Object.assign(r, { tree: p.tree, i18n: p.i18nLang, adsLang: p.ads?.lang, radius: p.skin?.borderRadius, fill: p.skin?.fillBefore, labels: p.buttonLabels.slice(0, 6) });
    await shot(v, 'L10/loader-neutral.png');
    await clickPlay(v);
    const q = await waitQa(v, (s) => s.ads.some((a) => a.type === 'start'), 15000);
    await sleep(1500);
    r.adStarted = q.ads.some((a) => a.type === 'start');
    r.adText = (await players(v))[0].visibleText.filter((t) => !t.startsWith('@'));
    r.solad = solad;
    await shot(v, 'L10/loader-neutral-ad.png');
    result.loader = r;
  }
  await visitor.close();

  result.storedAfterReads = stored();

  // First save: the neutral preset, unchanged, through the screen.
  await page.goto(`${BASE}/#/players/edit/${NEUTRAL}`);
  await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
  await sleep(800);
  await page.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.firstSave = { status: (await page.getByRole('status').allInnerTexts()).filter(Boolean) };
  await shot(page, 'L10/after-first-save.png', { fullPage: true });
  result.storedAfterSave = stored();
  result.storedPresetKeys = JSON.parse(sql("SELECT json_extract(value,'$.presets[0]') FROM ads_meta WHERE name='player_presets';"));
  const after = await presetList(page);
  result.listAfterSave = { revision: after.revision, migratedNeutral: after.migratedNeutral };
  await openList(page);
  result.noticeAfterSave = (await page.locator('main').innerText()).split('\n').filter((l) => /모양이 조금 달라질|옮김/.test(l));
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'L10/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
save('L10/result.json', result);
await browser.close();
