// A2-D-QA probe: the preset editor's controls (labels and roles) and the player preview section, before writing D08.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1400 });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const controls = () => page.evaluate(() => {
  const label = (el) => el.getAttribute('aria-label') || (el.labels?.[0]?.textContent ?? '').trim() || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ') || el.textContent.trim().slice(0, 40);
  return [...document.querySelectorAll('main input, main select, main textarea, main button, main [role="switch"], main a, main iframe')].map((el) => ({ tag: el.tagName, type: el.type || el.getAttribute('role') || null, id: el.id || null, name: label(el).replace(/\s+/g, ' ').slice(0, 60), value: el.value?.slice?.(0, 40) ?? null, disabled: el.disabled || el.getAttribute('aria-disabled') === 'true', href: el.getAttribute('href'), src: el.getAttribute('src') }));
});

try {
  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(4000);
  result.edit = await controls();
  result.headings = await page.locator('main h1, main h2, main h3').allInnerTexts();
  result.frames = page.frames().map((f) => f.url().replace(BASE, ''));
  await shot(page, 'probe/editor-1280.png', { fullPage: true });
  await page.goto(`${BASE}/#/players/new`);
  await sleep(4000);
  result.newHeadings = await page.locator('main h1, main h2, main h3').allInnerTexts();
  result.newDemo = await page.locator('.sa-ppv-f').innerText().catch(() => null);
  await shot(page, 'probe/new-1280.png', { fullPage: true });
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'probe/editor-error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('probe/editor.json', result);
await browser.close();
