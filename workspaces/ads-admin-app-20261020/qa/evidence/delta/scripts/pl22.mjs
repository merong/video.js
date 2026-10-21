// PL22: player screens at 1280×800 and 768×1024, then a keyboard-only pass (sub-nav, edit, ColorField, save, delete dialog, copy).
import { BASE, EV, launch, login, recordNetwork, apiCalls, consoleCollector, save, sleep, overflow } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';

const browser = await launch();
const result = { widths: {}, keyboard: { steps: [] } };

for (const [label, width, height] of [['1280', 1280, 800], ['768', 768, 1024]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const r = {};
  const measure = () => page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const m = [...document.querySelectorAll('main')].find((x) => x.getClientRects().length);
    const clipped = [...m.querySelectorAll('button, a, input, select, textarea, iframe')].filter((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width || el.closest('[hidden]') || el.closest('table')) return false;
      return b.right > vw + 0.5 || b.left < -0.5;
    }).map((el) => (el.getAttribute('aria-label') || el.textContent || el.title || el.tagName).trim().slice(0, 30));
    const tableScrollers = [...m.querySelectorAll('table')].map((t) => ({ name: t.getAttribute('aria-label') || t.caption?.textContent.trim(), tableWider: t.scrollWidth > t.parentElement.clientWidth + 1, parentOverflowX: getComputedStyle(t.parentElement).overflowX })).filter((t) => t.name);
    return { clipped, tableScrollers };
  });
  try {
    await login(page);
    await gotoList(page);
    r.list = { ...(await overflow(page)), ...(await measure()) };
    await page.screenshot({ path: `${EV}/PL22/${label}-list.png`, fullPage: true });
    await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
    await presetForm(page).waitFor();
    await sleep(2500);
    r.edit = { ...(await overflow(page)), ...(await measure()) };
    r.edit.formPreview = await page.evaluate(() => {
      const f = [...document.querySelectorAll('main form')].find((x) => x.getClientRects().length)?.getBoundingClientRect();
      const i = document.querySelector('iframe[title="플레이어 테마 미리보기"]')?.getBoundingClientRect();
      if (!f || !i) return { form: Boolean(f), iframe: Boolean(i) };
      const overlap = f.left < i.right - 1 && i.left < f.right - 1 && f.top < i.bottom - 1 && i.top < f.bottom - 1;
      return { form: [Math.round(f.left), Math.round(f.top), Math.round(f.width), Math.round(f.height)], iframe: [Math.round(i.left), Math.round(i.top), Math.round(i.width), Math.round(i.height)], overlap, stacked: i.top >= f.bottom - 1 || f.top >= i.bottom - 1 };
    });
    await page.screenshot({ path: `${EV}/PL22/${label}-edit.png`, fullPage: true });
    for (const [k, h] of [['setup', '#/players/setup'], ['options', '#/players/options']]) {
      await page.goto(`${BASE}/${h}`);
      await sleep(1200);
      r[k] = { ...(await overflow(page)), ...(await measure()) };
      await page.screenshot({ path: `${EV}/PL22/${label}-${k}.png`, fullPage: true });
    }
  } catch (error) {
    r.error = String(error).slice(0, 1000);
    await page.screenshot({ path: `${EV}/PL22/${label}-error.png`, fullPage: true }).catch(() => {});
  }
  result.widths[label] = r;
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.__qaClipboard = [];
    const stub = async (text) => { window.__qaClipboard.push(String(text).length); };
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: stub, write: stub } }); } catch { /* keep */ }
  });
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const K = result.keyboard;
  const active = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'BODY' };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { tag: el.tagName, href: el.getAttribute('href') || undefined, name: (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent || '').trim().slice(0, 40), current: el.getAttribute('aria-current') || undefined, inDialog: Boolean(el.closest('dialog[open]')), visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[hidden],[inert]'), focusRing: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') };
  });
  async function tabTo(label, match, { max = 150, back = false } = {}) {
    const trail = [];
    for (let i = 0; i < max; i++) {
      await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
      const a = await active();
      trail.push(a);
      if (match(a)) {
        K.steps.push({ label, presses: i + 1, reached: a, hiddenFocus: trail.filter((t) => t.tag !== 'BODY' && !t.visible).map((t) => t.name), noRing: trail.filter((t) => t.tag !== 'BODY' && t.visible && !t.focusRing).map((t) => `${t.tag}:${t.name}`) });
        return a;
      }
    }
    K.steps.push({ label, presses: max, reached: null, trailTail: trail.slice(-8) });
    throw new Error(`keyboard: ${label} not reached`);
  }
  try {
    await login(page);
    await gotoList(page);
    await page.evaluate(() => document.activeElement?.blur());
    await tabTo('하위 탐색 초기 설정 방법', (a) => a.tag === 'A' && a.href === '#/players/setup');
    await page.keyboard.press('Enter');
    await sleep(1000);
    K.subnavAfter = { hash: new URL(page.url()).hash, current: await page.locator('a[href="#/players/setup"]').filter({ visible: true }).getAttribute('aria-current'), focus: await active() };
    await tabTo('하위 탐색 프리셋 목록', (a) => a.tag === 'A' && a.href === '#/players', { back: true });
    await page.keyboard.press('Enter');
    await sleep(1000);
    await tabTo('P-A 수정', (a) => a.tag === 'BUTTON' && a.name === 'QA Video.js 중립 v2 수정');
    await page.keyboard.press('Enter');
    await sleep(1500);
    K.editFocus = await active();
    await tabTo('강조색 입력', (a) => a.tag === 'INPUT' && a.name.startsWith('강조색') && !a.name.includes('고르기'));
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('#0f5132');
    await tabTo('프리셋 저장', (a) => a.tag === 'BUTTON' && a.name === '프리셋 저장');
    const t = net.length ? net[net.length - 1].t + 1 : 0;
    await page.keyboard.press('Enter');
    await sleep(1500);
    K.save = { api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`), status: (await page.getByRole('status').allInnerTexts()).filter(Boolean).slice(0, 3), hash: new URL(page.url()).hash, focus: await active() };
    if (!K.save.hash.endsWith('#/players')) {
      await page.goto(`${BASE}/#/players`);
      await sleep(1000);
      await page.evaluate(() => document.activeElement?.blur());
    }
    await tabTo('P-B 삭제', (a) => a.tag === 'BUTTON' && a.name === 'QA 기본 video 삭제');
    await page.keyboard.press('Space');
    await sleep(500);
    K.dialogOpen = await active();
    K.dialogTrap = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      K.dialogTrap.push(await active());
    }
    await page.screenshot({ path: `${EV}/PL22/keyboard-dialog.png` });
    await page.keyboard.press('Escape');
    await sleep(400);
    K.afterEscape = await active();
    K.presetsAfter = await page.getByRole('table', { name: '플레이어 프리셋' }).filter({ visible: true }).locator('tbody tr').count();
    await tabTo('하위 탐색 초기 설정 방법(2)', (a) => a.tag === 'A' && a.href === '#/players/setup', { back: true });
    await page.keyboard.press('Enter');
    await sleep(1000);
    await tabTo('영상 ID', (a) => a.tag === 'INPUT' && a.name.startsWith('영상 ID'));
    await page.keyboard.type('a1-qa-preset-1');
    await tabTo('코드 복사', (a) => a.tag === 'BUTTON' && /복사/.test(a.name));
    await page.keyboard.press('Enter');
    await sleep(600);
    K.copy = { clipboardCalls: await page.evaluate(() => window.__qaClipboard), status: (await page.getByRole('status').allInnerTexts()).filter((s) => /복사/.test(s)) };
    await page.screenshot({ path: `${EV}/PL22/keyboard-copy.png` });
    K.writes = net.filter((e) => e.method === 'POST' && e.action !== 'login').map((e) => `${e.action} ${e.status}`);
  } catch (error) {
    K.error = String(error).slice(0, 1200);
    await page.screenshot({ path: `${EV}/PL22/keyboard-error.png` }).catch(() => {});
  }
  K.console = logs;
  await context.close();
}

save('PL22/result.json', result);
await browser.close();
