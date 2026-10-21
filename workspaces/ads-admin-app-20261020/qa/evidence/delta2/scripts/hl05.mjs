// HL05: collect HelpLinks on the working screens, verify each target heading takes focus, D9 unsaved input round trips.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep } from './lib.mjs';
import { presetForm, field, gotoList } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { screens: {}, targets: {}, d9: {} };
const editor = () => page.getByRole('form', { name: '광고 편성 편집' });

async function links() {
  return page.locator('main').filter({ visible: true }).locator('a[href^="#/help/"]').filter({ visible: true }).evaluateAll((els) => els.map((a) => {
    const name = a.getAttribute('aria-label') || a.textContent.trim();
    const block = a.closest('label, .sa-field, [class*="field"], section, article, p, th, td, li, div');
    return { termId: a.getAttribute('href').replace('#/help/', ''), name, text: a.textContent.trim(), context: block?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) ?? null };
  }));
}
async function openTarget(type, id) {
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: type });
  if (id) await target.getByLabel('고정 대상 ID', { exact: true }).fill(id);
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await editor().waitFor();
  await sleep(1000);
}

try {
  await login(page);
  await page.goto(`${BASE}/#/creatives`);
  await sleep(1200);
  result.screens['소재'] = await links();
  await openTarget('사이트 기본');
  result.screens['지면 편성 · 사이트'] = await links();
  await openTarget('개별 영상', 'a1-qa-video-1');
  result.screens['지면 편성 · 개별 영상'] = await links();
  await page.goto(`${BASE}/#/reports`);
  await sleep(1500);
  result.screens['리포트(통계)'] = await links();
  await gotoList(page);
  result.screens['플레이어 · 목록'] = await links();
  await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(1000);
  result.screens['플레이어 · 편집(Video.js)'] = await links();
  await page.goto(`${BASE}/#/players/setup`);
  await sleep(1200);
  result.screens['플레이어 · 초기 설정'] = await links();
  await page.goto(`${BASE}/#/players/options`);
  await sleep(1200);
  result.screens['플레이어 · 옵션 설명'] = await links();
  save('HL05/options.aria.yml', await page.locator('main').filter({ visible: true }).ariaSnapshot());

  // Each distinct termId: the target heading exists and takes focus.
  const ids = [...new Set(Object.values(result.screens).flat().map((l) => l.termId))].sort();
  const probe = await context.newPage();
  for (const id of ids) {
    await probe.goto(`${BASE}/#/help/${id}`);
    await sleep(700);
    result.targets[id] = await probe.evaluate((termId) => ({ heading: Boolean(document.getElementById(`sa-help-${termId}`)), focused: document.activeElement?.id === `sa-help-${termId}`, hash: location.hash, title: document.getElementById(`sa-help-${termId}`)?.textContent.trim() ?? null }), id);
  }
  await probe.close();

  // D9: unsaved schedule edit → "?" → help → back (history) and → menu.
  await openTarget('사이트 기본');
  const url = editor().getByRole('article', { name: /프리롤/ }).getByRole('group', { name: /^1\. / }).getByLabel('클릭 목적지 URL', { exact: true });
  result.d9.scheduleOriginal = await url.inputValue();
  await url.fill('https://example.com/qa-d9-unsaved');
  const midHelp = editor().locator('a[href="#/help/mid-roll"]').first();
  await midHelp.click();
  await sleep(1000);
  result.d9.scheduleAtHelp = { hash: new URL(page.url()).hash, active: await page.evaluate(() => document.activeElement?.id) };
  await page.goBack();
  await sleep(1500);
  result.d9.scheduleAfterBack = { hash: new URL(page.url()).hash, editorVisible: await editor().isVisible(), value: (await editor().isVisible()) ? await url.inputValue() : null };
  await page.screenshot({ path: `${EV}/HL05/d9-schedule-after-back.png`, fullPage: true });
  await editor().locator('a[href="#/help/mid-roll"]').first().click().catch(() => {});
  await sleep(1000);
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '지면 편성', exact: true }).click();
  await sleep(1500);
  result.d9.scheduleAfterMenu = { hash: new URL(page.url()).hash, editorVisible: await editor().isVisible(), value: (await editor().isVisible()) ? await url.inputValue() : null };

  // D9: unsaved preset edit → "?" → help → back and → menu.
  await gotoList(page);
  await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
  await presetForm(page).waitFor();
  await sleep(800);
  await field(page, '건너뛰기 대기 문구').fill('{seconds}초 뒤 넘김 D9');
  await presetForm(page).locator('a[href="#/help/player-skin"]').first().click();
  await sleep(1000);
  result.d9.presetAtHelp = { hash: new URL(page.url()).hash };
  await page.goBack();
  await sleep(1500);
  result.d9.presetAfterBack = { hash: new URL(page.url()).hash, formVisible: await presetForm(page).isVisible(), value: (await presetForm(page).isVisible()) ? await field(page, '건너뛰기 대기 문구').inputValue() : null };
  await presetForm(page).locator('a[href="#/help/player-skin"]').first().click().catch(() => {});
  await sleep(1000);
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '플레이어', exact: true }).click();
  await sleep(1500);
  result.d9.presetAfterMenu = { hash: new URL(page.url()).hash, formVisible: await presetForm(page).isVisible().catch(() => false) };
  if (!result.d9.presetAfterMenu.formVisible) {
    await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click().catch(() => {});
    await sleep(1000);
  }
  result.d9.presetAfterMenu.reopenedValue = (await presetForm(page).isVisible()) ? await field(page, '건너뛰기 대기 문구').inputValue() : null;
  result.d9.presetAfterMenu.hashAfterReopen = new URL(page.url()).hash;
  await page.screenshot({ path: `${EV}/HL05/d9-preset-after-menu.png`, fullPage: true });
  result.d9.writes = net.filter((e) => e.method === 'POST' && e.action && e.action !== 'login').map((e) => `${e.action} ${e.status}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await page.screenshot({ path: `${EV}/HL05/error.png`, fullPage: true }).catch(() => {});
}
result.console = logs;
save('HL05/result.json', result);
await browser.close();
