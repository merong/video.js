// A2-1-QA-DELTA D-A21-2: #/players/edit/<built-in> opened directly shows the read-only notice and 복제해서 새로 만들기,
// which opens the 새 프리셋 form; neutral (not a preset id) falls back to the list and an unknown p-… id shows
// 프리셋을 찾지 못했어요. Each case runs in its own context and nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const result = {};
const mainText = async (page) => (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);

for (const id of ['default', 'rounded', 'accent', 'neutral', 'p-zzzzzzzzzz']) {
  const context = await newContext(browser, { width: 1280, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  const r = {};
  try {
    await login(page);
    await page.goto(`${BASE}/#/players/edit/${id}`);
    await sleep(1800);
    r.hash = await page.evaluate(() => location.hash);
    r.text = (await mainText(page)).slice(0, 14);
    r.editForm = await page.getByRole('form', { name: /프리셋 수정/ }).count();
    r.notFound = await page.getByText('프리셋을 찾지 못했어요', { exact: true }).count();
    r.readOnly = await page.getByText('내장 프리셋은 바꿀 수 없어요. 복제해서 쓰세요.', { exact: true }).count();
    const dup = page.getByRole('button', { name: '복제해서 새로 만들기', exact: true });
    r.duplicateButton = await dup.count();
    r.listShown = await page.getByRole('button', { name: /^기본 복제$/ }).count();
    await shot(page, `D-A21-2/${id}.png`, { fullPage: true });
    if (r.duplicateButton) {
      r.duplicateEnabled = await dup.isEnabled();
      await dup.click();
      await page.getByRole('form', { name: '새 프리셋' }).waitFor({ timeout: 8000 });
      await sleep(700);
      r.afterDuplicate = {
        hash: await page.evaluate(() => location.hash),
        form: await page.getByRole('form', { name: '새 프리셋' }).count(),
        name: await page.locator('#aa-preset-name').inputValue(),
        accent: await page.locator('#aa-preset-theme-accentColor').inputValue().catch(() => null),
        savebar: (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim(),
      };
      await shot(page, `D-A21-2/${id}-duplicate.png`, { fullPage: true });
    }
    r.savedCount = await page.evaluate(async () => (await (await fetch('/api/index.php?action=player-presets')).json()).data.presets.filter((p) => !p.meta?.builtIn).length);
  } catch (error) {
    r.error = String(error).slice(0, 1500);
    await shot(page, `D-A21-2/error-${id}.png`, { fullPage: true }).catch(() => {});
  }
  r.nativeDialogs = dialogs;
  r.console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
  result[id] = r;
  await context.close();
}
save('D-A21-2/result.json', result);
await browser.close();
