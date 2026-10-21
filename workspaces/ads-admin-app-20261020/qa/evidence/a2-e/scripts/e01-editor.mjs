// A2-E-QA E01 editor "테두리 없음" at 1280: open with #00000026 (off, alpha help) and #ff000000 (on, locked), turn it on and
// off, type 8 digits in upper case, a wrong format, and #00000000 typed. The preview frame's border line is read after each
// change. Nothing is saved; the screen is left by a new page load.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';
import { waitFrameSkin } from './probe-lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const text = () => page.getByRole('textbox', { name: '테두리 색', exact: true });
const pick = () => page.getByLabel('테두리 색 색 고르기');
const check = () => page.getByRole('checkbox', { name: '테두리 없음' });

async function read() {
  return page.evaluate(() => {
    const t = [...document.querySelectorAll('input.sa-input')].find((i) => document.querySelector(`label[for="${i.id}"]`)?.textContent.trim() === '테두리 색');
    const field = t?.closest('.sa-field');
    const color = field?.querySelector('input[type=color]');
    const box = [...document.querySelectorAll('input[type=checkbox]')].find((c) => c.closest('label')?.textContent.trim() === '테두리 없음');
    const desc = (el) => (el?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() ?? `#${id}?`);
    return {
      text: t?.value, textDisabled: t?.disabled, textInvalid: t?.getAttribute('aria-invalid'), textDesc: desc(t),
      color: color?.value, colorDisabled: color?.disabled, colorDesc: desc(color),
      colorCls: field?.querySelector('.sa-color')?.className,
      clear: field?.querySelector('button')?.textContent.trim() ?? null,
      state: field?.querySelector('.sa-color-state')?.textContent.trim() ?? null,
      fieldCls: field?.className, help: [...(field?.querySelectorAll('.sa-help') ?? [])].map((h) => h.textContent.trim()),
      check: box?.checked, checkDesc: desc(box),
    };
  });
}
async function line() {
  const f = frame();
  return f?.evaluate(() => { const c = document.querySelector('#player solad-video-skin')?.shadowRoot.querySelector('media-container'); return c ? getComputedStyle(c, '::after').borderTopColor : null; }).catch(() => null);
}
async function open(id) {
  await page.goto(`${BASE}/#/players/edit/${id}`);
  await text().waitFor({ timeout: 15000 });
  await text().scrollIntoViewIfNeeded();
  await waitFrameSkin(frame);
  await sleep(1500);
}

try {
  await login(page);
  await open('p-46sx1n57gw');
  result.openFF000000 = { ...(await read()), line: await line() };
  await shot(page, 'E01/editor-open-ff000000.png', { clip: await page.locator('.sa-field', { has: text() }).first().boundingBox().then((b) => ({ x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 80 })) });

  await open('p-wgqz3x31a5');
  result.open00000026 = { ...(await read()), line: await line() };
  await shot(page, 'E01/editor-open-00000026.png', { clip: await page.locator('.sa-field', { has: text() }).first().boundingBox().then((b) => ({ x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 80 })) });

  await check().check();
  await sleep(2500);
  result.on = { ...(await read()), line: await line(), focusIsCheck: await page.evaluate(() => document.activeElement?.type === 'checkbox') };
  await shot(page, 'E01/editor-none-on.png', { clip: await page.locator('.sa-field', { has: text() }).first().boundingBox().then((b) => ({ x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 80 })) });
  await check().uncheck();
  await sleep(2500);
  result.off = { ...(await read()), line: await line() };

  await text().fill('#ABCDEF12');
  await text().press('Tab');
  await sleep(2500);
  result.upper8 = { ...(await read()), line: await line() };

  await text().fill('#12345');
  await text().press('Tab');
  await sleep(500);
  result.wrong = await read();
  await shot(page, 'E01/editor-format-error.png', { clip: await page.locator('.sa-field', { has: text() }).first().boundingBox().then((b) => ({ x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 80 })) });

  await text().fill('#00000000');
  await text().press('Tab');
  await sleep(2500);
  result.typedNone = { ...(await read()), line: await line() };

  await text().fill('#11223344');
  await text().press('Tab');
  await sleep(300);
  result.typed8ff = await read();
  await text().fill('#112233ff');
  await text().press('Tab');
  await sleep(300);
  result.typedFF = await read();
} catch (e) {
  result.error = String(e).slice(0, 1200);
  await shot(page, 'E01/editor-error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events().length;
result.console = logs.map((l) => `${l.type}: ${l.text.slice(0, 200)}`);
await context.close();
save('E01/editor.json', result);
await browser.close();
