// A2-1-QA fixture presets for L06 made on the screen: 플레이어 화면 언어 일본어, and a 기본 video preset.
import { launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openList, presetList } from './admin.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};

async function make(name, steps) {
  const existing = (await presetList(page)).presets.find((e) => e.name === name);
  if (existing) return { id: existing.id, note: '이미 있음(이전 실행)' };
  await openList(page);
  await page.getByRole('button', { name: '기본 복제' }).click();
  await page.getByRole('form', { name: '새 프리셋' }).waitFor();
  await sleep(600);
  await page.locator('#aa-preset-name').fill(name);
  const r = (await steps()) ?? {};
  await page.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  r.status = (await page.getByRole('status').allInnerTexts()).filter(Boolean);
  r.id = (await presetList(page)).presets.find((e) => e.name === name)?.id ?? null;
  return r;
}

try {
  await login(page);
  result.ja = await make('QA 일본어', async () => {
    await page.getByLabel('플레이어 화면 언어', { exact: true }).selectOption('ja');
  });
  result.native = await make('QA 기본 video', async () => {
    await page.getByLabel('플레이어 종류', { exact: true }).selectOption('native');
    await sleep(400);
    await shot(page, 'presets/native-form.png', { fullPage: true });
  });
  result.nativeJa = await make('QA 기본 video 일본어', async () => {
    await page.getByLabel('플레이어 종류', { exact: true }).selectOption('native');
    await page.getByLabel('플레이어 화면 언어', { exact: true }).selectOption('ja');
  });
  result.renders = {};
  for (const key of ['ja', 'native', 'nativeJa']) {
    result.renders[key] = await page.evaluate(async (id) => (await (await fetch(`/api/index.php?action=player-preset&id=${id}`)).json()).data, result[key].id);
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'presets/error2.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('presets/result2.json', result);
await browser.close();
