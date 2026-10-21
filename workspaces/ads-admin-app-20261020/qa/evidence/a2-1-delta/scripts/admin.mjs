// A2-1-QA admin screen helpers for the 플레이어 menu (list, apply dialog, setup code).
import { BASE, sleep } from './lib.mjs';

export async function openList(page) {
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('table', { name: '플레이어 프리셋' }).waitFor();
  await sleep(600);
}

/** 사이트에 적용 through the app dialog; returns the dialog text and the list status after applying. */
export async function applyUI(page, name) {
  await openList(page);
  await page.getByRole('button', { name: `${name} 사이트에 적용` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const dialogText = await dialog.innerText();
  await dialog.getByRole('button', { name: '사이트에 적용', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  await sleep(800);
  return { dialogText, status: (await page.getByRole('status').allInnerTexts()).filter(Boolean) };
}

/** The loader install code for `videoId` from 초기 설정, exactly as the code block shows it. */
export async function loaderCode(page, { videoId = 'a1-qa-video-1', poster, title } = {}) {
  await page.goto(`${BASE}/#/players/setup`);
  await page.getByRole('heading', { name: '설치 코드', exact: true }).waitFor();
  await sleep(800);
  await page.getByRole('textbox', { name: '영상 ID', exact: true }).first().fill(videoId);
  if (poster !== undefined) await page.getByRole('textbox', { name: '포스터 URL (선택)' }).fill(poster);
  if (title !== undefined) await page.getByRole('textbox', { name: '제목 (선택)' }).fill(title);
  await page.keyboard.press('Tab');
  await sleep(600);
  const codes = await page.locator('main pre').evaluateAll((els) => els.map((e) => e.textContent));
  return codes.find((c) => c.includes('data-solad-player')) ?? null;
}

/** Built-in and saved presets as the list API returns them: flat presets with `builtIn` (no secrets in this action). */
export function presetList(page) {
  return page.evaluate(async () => (await (await fetch('/api/index.php?action=player-presets', { credentials: 'same-origin' })).json()).data);
}
