// A2-1-QA fixture presets made on the screen (duplicate 기본 → change → 프리셋 저장): an autoplay preset, an autoplay
// preset where 음소거로 시작 was switched on before 자동 재생, and a poster/title preset for L09. Records each render.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openList, presetList } from './admin.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1300 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const sw = (name) => page.getByRole('switch', { name, exact: true });

async function make(name, steps) {
  const existing = (await presetList(page)).presets.find((e) => e.name === name);
  if (existing) return { id: existing.id, note: '이미 있음(이전 실행)' };
  await openList(page);
  await page.getByRole('button', { name: '기본 복제' }).click();
  await page.getByRole('form', { name: '새 프리셋' }).waitFor();
  await sleep(600);
  await page.locator('#aa-preset-name').fill(name);
  const r = await steps();
  await page.getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  r.status = (await page.getByRole('status').allInnerTexts()).filter(Boolean);
  r.id = (await presetList(page)).presets.find((e) => e.name === name)?.id ?? null;
  return r;
}

const state = async (name) => sw(name).evaluate((el) => ({ checked: el.getAttribute('aria-checked'), disabled: el.disabled || el.getAttribute('aria-disabled') === 'true', describedBy: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()) }));

try {
  await login(page);
  result.autoplay = await make('QA 자동재생', async () => {
    await sw('자동 재생').click();
    await sleep(300);
    const r = { mutedAfterAutoplay: await state('음소거로 시작') };
    await shot(page, 'presets/autoplay-form.png', { fullPage: true });
    return r;
  });
  result.autoplayMutedFirst = await make('QA 자동재생 음소거 먼저', async () => {
    await sw('음소거로 시작').click();
    await sw('자동 재생').click();
    await sleep(300);
    return { mutedAfterAutoplay: await state('음소거로 시작') };
  });
  result.display = await make('QA 포스터 제목', async () => ({ poster: await state('포스터 표시'), title: await state('제목 표시') }));
  result.displayOff = await make('QA 포스터 제목 끔', async () => {
    await sw('포스터 표시').click();
    await sw('제목 표시').click();
    return { poster: await state('포스터 표시'), title: await state('제목 표시') };
  });
  // The public render of each, as the loader receives it.
  result.renders = {};
  for (const key of ['autoplay', 'autoplayMutedFirst', 'display', 'displayOff']) {
    const id = result[key].id;
    result.renders[key] = await page.evaluate(async (id) => {
      const body = await (await fetch(`/api/index.php?action=player-preset&id=${id}`)).json();
      return { playback: body.data?.playback, display: body.data?.display };
    }, id);
  }
  result.stored = (await presetList(page)).presets.filter((e) => e.name.startsWith('QA ')).map((e) => ({ id: e.id, name: e.name, playback: e.playback, display: e.display }));
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'presets/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('presets/result.json', result);
await browser.close();
