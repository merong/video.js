// A2-1-QA-DELTA fixture presets made on the screen (duplicate → change → 프리셋 저장): a 강조색 clone applied to the
// site (L01/L02 regression), an autoplay preset, and a 기본 video preset for the other-player warning (D-MSG).
import { launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { applyUI, openList, presetList } from './admin.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};

async function make(source, name, steps) {
  const existing = (await presetList(page)).presets.find((e) => e.name === name);
  if (existing) return { id: existing.id, note: '이미 있음(이전 실행)' };
  await openList(page);
  await page.getByRole('button', { name: `${source} 복제`, exact: true }).click();
  await page.getByRole('form', { name: '새 프리셋' }).waitFor();
  await sleep(600);
  await page.locator('#aa-preset-name').fill(name);
  const r = (await steps?.()) ?? {};
  await page.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  r.status = (await page.getByRole('status').allInnerTexts()).filter(Boolean);
  r.id = (await presetList(page)).presets.find((e) => e.name === name)?.id ?? null;
  return r;
}

try {
  await login(page);
  result.accent = await make('강조색', 'QA 강조색 복제');
  result.autoplay = await make('기본', 'QA 자동재생', async () => {
    await page.getByRole('switch', { name: '자동 재생', exact: true }).click();
  });
  result.native = await make('기본', 'QA 기본 video', async () => {
    await page.getByLabel('플레이어 종류', { exact: true }).selectOption('native');
  });
  result.apply = await applyUI(page, 'QA 강조색 복제');
  const list = await presetList(page);
  result.list = { revision: list.revision, defaultPresetId: list.defaultPresetId, saved: list.presets.filter((p) => !p.builtIn).map((p) => ({ id: p.id, name: p.name, playerType: p.playerType, autoplay: p.playback?.autoplay })) };
  await shot(page, 'presets/list.png', { fullPage: true });
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'presets/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
save('presets/result.json', result);
await browser.close();
