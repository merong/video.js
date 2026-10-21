// A2-E-QA E02 list preview dialog at 1280×800 and 390×844: a "<이름> 미리보기" button first in every row's actions, the
// modal (:modal, wide, first focus, Esc / header close / footer close), cleanup (no iframe, no media, focus back), opening
// again, the saved values played (flat radius 0), the unsaved note (name typed in the editor, not saved), another menu
// closes it, the demo link (new page), events 0, no horizontal scroll. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow, deepActive } from './lib.mjs';
import { requestLog } from './demo.mjs';
import { playerShape, waitFrameSkin } from './probe-lib.mjs';

const browser = await launch();
const result = { runs: [] };

for (const [w, h] of [[1280, 800], [390, 844]]) {
  const context = await newContext(browser, { width: w, height: h });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { size: `${w}x${h}` };
  const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
  const dialogState = () => page.evaluate(() => {
    const d = document.querySelector('dialog.sa-dialog');
    const desc = (el, attr) => (el?.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() ?? `#${id}?`);
    let a = document.activeElement;
    return {
      present: Boolean(d), open: d?.open ?? false, modal: d ? d.matches(':modal') : false, cls: d?.className ?? null,
      label: desc(d, 'aria-labelledby').join(' '), describedBy: desc(d, 'aria-describedby'),
      width: d ? Math.round(d.getBoundingClientRect().width) : null, height: d ? Math.round(d.getBoundingClientRect().height) : null,
      aside: d?.querySelector('.sa-dialog-h .sa-small')?.textContent.trim() ?? null,
      bodyScroll: d ? (() => { const b = d.querySelector('.sa-dialog-b'); return b ? { overflowY: getComputedStyle(b).overflowY, scrollH: b.scrollHeight, clientH: b.clientHeight } : null; })() : null,
      footer: d ? [...d.querySelectorAll('.sa-dialog-f a, .sa-dialog-f button')].map((e) => ({ tag: e.tagName, text: e.textContent.replace(/\s+/g, ' ').trim(), href: e.getAttribute('href'), target: e.getAttribute('target'), rel: e.getAttribute('rel') })) : [],
      headClose: d?.querySelector('.sa-dialog-h button')?.getAttribute('aria-label') ?? null,
      note: d?.querySelector('.sa-note')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      active: a ? { tag: a.tagName, label: a.getAttribute('aria-label'), text: a.textContent.trim().slice(0, 30) } : null,
      iframes: document.querySelectorAll('iframe').length,
      stageTools: d ? [...d.querySelectorAll('.sa-stage-tools button')].map((b) => b.textContent.trim()) : [],
      now: d?.querySelector('.sa-stage-now')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      seg: d?.querySelector('.sa-stage-bar')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    };
  });
  const media = () => Promise.all(page.frames().map((f) => f.evaluate(() => document.querySelectorAll('video, audio').length).catch(() => 0))).then((n) => n.reduce((a, b) => a + b, 0));
  const button = (name) => page.getByRole('button', { name: `${name} 미리보기`, exact: true });
  const openFor = async (name) => { await button(name).click(); await page.locator('dialog.sa-dialog[open]').waitFor({ timeout: 10000 }); };

  try {
    await login(page);
    await page.goto(`${BASE}/#/players`);
    await page.getByRole('table').first().waitFor({ timeout: 15000 });
    await sleep(800);
    r.rows = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((tr) => {
      const cell = tr.querySelector('td:last-child');
      const btns = [...cell.querySelectorAll('button, a')].map((b) => ({ text: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 20), label: b.getAttribute('aria-label') }));
      return { name: tr.querySelector('b')?.textContent.trim(), first: btns[0], count: btns.length, pinned: cell.className };
    }));
    r.overflowList = await overflow(page);
    await shot(page, `E02/list-${w}.png`, { fullPage: true });

    // Flat: open, Esc.
    await openFor('플랫');
    await sleep(300);
    r.flatOpen = await dialogState();
    const f = await waitFrameSkin(frame);
    await sleep(2000);
    r.flatOpen.frameQuery = f ? new URL(f.url()).search : null;
    r.flatOpen.shape = f ? await playerShape(f) : null;
    r.flatOpen.overflow = await overflow(page);
    r.flatOpen.mediaWhileOpen = await media();
    await shot(page, `E02/dialog-flat-${w}.png`);
    // Tab from the close icon goes to the width view, not the frame.
    await page.keyboard.press('Tab');
    r.flatOpen.secondTab = await deepActive(page);
    // Play in the frame, then Esc.
    await page.locator('dialog .sa-stage-tools').getByRole('button', { name: '처음부터', exact: true }).click().catch(() => {});
    await sleep(3000);
    r.flatOpen.nowAfterStart = (await dialogState()).now;
    await page.keyboard.press('Escape');
    await sleep(600);
    r.afterEsc = { ...(await dialogState()), media: await media(), frames: page.frames().length };

    await openFor('플랫');
    await waitFrameSkin(frame);
    await sleep(1000);
    r.reopen = { iframes: (await dialogState()).iframes, now: (await dialogState()).now };
    await page.locator('dialog .sa-dialog-h button').click();
    await sleep(600);
    r.afterHeadClose = { ...(await dialogState()), media: await media() };

    await openFor('QA 테두리 8자리');
    await waitFrameSkin(frame);
    await sleep(1000);
    r.saved8 = await dialogState();
    r.saved8.shape = await playerShape(frame());
    await page.locator('dialog .sa-dialog-f').getByRole('button', { name: '닫기', exact: true }).click();
    await sleep(600);
    r.afterFootClose = { ...(await dialogState()), media: await media() };

    // Demo link opens a new page.
    await openFor('둥근 테두리');
    await waitFrameSkin(frame);
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 10000 }), page.locator('dialog .sa-dialog-f a').click()]);
    await popup.waitForLoadState('domcontentloaded');
    r.demoLink = { url: popup.url().replace(BASE, ''), stillOpen: (await dialogState()).open };
    await popup.close();
    await page.keyboard.press('Escape');
    await sleep(400);

    // Another menu while open: the hash moves to the schedule.
    await openFor('강조색');
    await waitFrameSkin(frame);
    await page.evaluate(() => { location.hash = '#/schedule'; });
    await sleep(1200);
    r.otherMenu = { hash: await page.evaluate(() => location.hash), ...(await dialogState()), media: await media() };

    // Unsaved input: type in the editor's name without saving, then back to the list.
    await page.goto(`${BASE}/#/players/edit/p-wgqz3x31a5`);
    const name = page.locator('#aa-preset-name');
    await name.waitFor({ timeout: 15000 });
    await name.fill('QA 테두리 8자리 (입력 중)');
    await sleep(500);
    await page.evaluate(() => { location.hash = '#/players'; });
    await page.getByRole('table').first().waitFor({ timeout: 15000 });
    await sleep(800);
    r.unsavedListName = await page.evaluate(() => [...document.querySelectorAll('table tbody tr b')].map((b) => b.textContent.trim()).filter((t) => t.startsWith('QA 테두리 8')));
    await openFor('QA 테두리 8자리');
    await waitFrameSkin(frame);
    await sleep(800);
    r.unsaved = await dialogState();
    r.unsaved.frameQuery = new URL(frame().url()).search;
    await shot(page, `E02/dialog-unsaved-${w}.png`);
    await page.keyboard.press('Escape');
    await sleep(400);
    r.unsavedClosedFocus = (await dialogState()).active;
    // A saved preset without input: no note.
    await openFor('QA 테두리 투명색');
    await sleep(500);
    r.savedNoNote = { note: (await dialogState()).note, describedBy: (await dialogState()).describedBy };
    await page.keyboard.press('Escape');
  } catch (e) {
    r.error = String(e).slice(0, 1200);
    await shot(page, `E02/error-${w}.png`, { fullPage: true }).catch(() => {});
  }
  r.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
  r.events = req.events().length;
  r.console = logs.map((l) => `${l.type}: ${l.text.slice(0, 200)}`);
  result.runs.push(r);
  await context.close();
}
save('E02/result.json', result);
await browser.close();
