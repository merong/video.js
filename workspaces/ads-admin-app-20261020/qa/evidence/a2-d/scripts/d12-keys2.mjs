// A2-D-QA D12 keyboard recheck: the preset select (arrow keys and type-to-select), the loop switch and the poster
// checkbox with Space (before/after), play with Space on the player's play button, the switches' accessible names, and
// the editor's demo link with Enter at 1280.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const result = {};
const active = (p) => p.evaluate(() => { let el = document.activeElement; while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement; return el ? `${el.tagName}${el.id ? '#' + el.id : ''}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}` : null; });

try {
  const context = await newContext(browser, { width: 1280, height: 1000 });
  const page = await context.newPage();
  await page.goto(`${BASE}/examples/index.html`);
  await sleep(3000);
  result.switchNames = await page.locator('[role="switch"]').evaluateAll((els) => els.map((el) => ({ name: el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim(), checked: el.getAttribute('aria-checked'), disabled: el.disabled || el.getAttribute('aria-disabled') })));

  await page.locator('#preset').focus();
  const sel = [];
  for (const key of ['ArrowDown', 'ArrowDown', 'Enter']) {
    await page.keyboard.press(key);
    await sleep(500);
    sel.push(`${key}:${await page.locator('#preset').inputValue()}`);
  }
  await sleep(1500);
  result.selectArrows = { sel, url: page.url().replace(BASE, '') };
  await page.locator('#preset').focus();
  await page.keyboard.type('둥');
  await sleep(1500);
  result.selectType = { value: await page.locator('#preset').inputValue(), url: page.url().replace(BASE, '') };

  const loop = page.locator('[role="switch"][aria-labelledby="lp-n"]');
  await loop.focus();
  const loopBefore = await loop.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  await sleep(1200);
  result.loopSpace = { before: loopBefore, after: await loop.getAttribute('aria-checked'), url: page.url().replace(BASE, '') };
  await page.locator('#poster').focus();
  const posterBefore = await page.locator('#poster').isChecked();
  await page.keyboard.press('Space');
  await sleep(1200);
  result.posterSpace = { before: posterBefore, after: await page.locator('#poster').isChecked(), url: page.url().replace(BASE, '') };

  await page.goto(`${BASE}/examples/index.html`);
  await sleep(3000);
  await page.locator('#preset').focus();
  let f = null;
  for (let i = 0; i < 12 && !/MEDIA-PLAY-BUTTON/.test(f ?? ''); i++) { await page.keyboard.press('Tab'); f = await active(page); }
  result.playFocus = f;
  await page.keyboard.press('Space');
  const end = Date.now() + 15000;
  while (Date.now() < end && !/재생 중/.test(await page.locator('#now').innerText())) await sleep(300);
  result.nowAfterPlay = (await page.locator('#now').innerText()).replace(/\s+/g, ' ').trim();
  await shot(page, 'D12/keys2-demo-play.png');
  await context.close();

  const c3 = await newContext(browser, { width: 1280, height: 1000 });
  const admin = await c3.newPage();
  await login(admin);
  await admin.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await admin.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(3000);
  const link = admin.getByRole('link', { name: '데모에서 열기 (새 창)' });
  result.admin = { count: await link.count(), attrs: await link.evaluate((a) => ({ href: a.getAttribute('href'), target: a.target, disabled: a.getAttribute('aria-disabled'), rel: a.rel })).catch((e) => String(e).slice(0, 100)) };
  await link.focus();
  result.admin.focus = await active(admin);
  const [popup] = await Promise.all([c3.waitForEvent('page', { timeout: 8000 }).catch(() => null), admin.keyboard.press('Enter')]);
  result.admin.popup = popup ? popup.url().replace(BASE, '') : null;
  if (popup) await popup.close();
  await c3.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('D12/keys2.json', result);
await browser.close();
