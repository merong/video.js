// A2-E-QA-DELTA F01 (A2E-01): the preset preview dialog's room width fitted to the body height. Sizes 1280×800, 1280×768,
// 1280×720, 768×1024, 390×844; presets: built-in 기본 (page language field), saved QA 테두리 8자리 (page language field)
// and a saved preset with language ko made here (no page language field), each without and with the unsaved note (name
// typed in the editor, not saved). At 1280 also: 800 → 720 → 800 with the dialog open, scene shortcuts and the captions
// button in the narrowed room, Esc / close / focus / iframe 0, and the editor preview and built-in screen card unchanged.
// The language preset id is written to F01/lang-preset.json so the end step can delete it.
import fs from 'node:fs';
import { BASE, EV, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { adminCall } from './a2.mjs';
import { requestLog } from './demo.mjs';
import { waitFrameSkin } from './probe-lib.mjs';
import { install, runSequence, SEQUENCE, TEXT } from './scenes.mjs';

const SIZES = [[1280, 800], [1280, 768], [1280, 720], [768, 1024], [390, 844]];
const browser = await launch();
const result = { sizes: {} };

const dialogFacts = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.sa-dialog[open]');
  if (!d) return { open: false, iframes: document.querySelectorAll('iframe').length };
  const b = d.querySelector('.sa-dialog-b');
  const v = d.querySelector('.sa-stage-view');
  const f = d.querySelector('.sa-stage-view iframe');
  const vr = v?.getBoundingClientRect();
  const fr = f?.getBoundingClientRect();
  return {
    open: true,
    dialog: { w: Math.round(d.getBoundingClientRect().width), h: Math.round(d.getBoundingClientRect().height), maxH: getComputedStyle(d).maxHeight },
    body: { scrollH: b.scrollHeight, clientH: b.clientHeight, scrolls: b.scrollHeight > b.clientHeight },
    room: vr ? { w: Math.round(vr.width * 10) / 10, left: Math.round(vr.left - b.getBoundingClientRect().left), fitVar: v.style.getPropertyValue('--_fit') || null } : null,
    frame: fr ? { w: Math.round(fr.width * 10) / 10, h: Math.round(fr.height * 10) / 10, ratio: Math.round((fr.width / fr.height) * 1000) / 1000 } : null,
    scaleNote: d.querySelector('[id$="-scale"]')?.textContent.trim() ?? null,
    note: d.querySelector('.sa-note')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    pageLang: [...d.querySelectorAll('label')].some((l) => l.textContent.trim().startsWith('페이지 언어')),
    iframes: document.querySelectorAll('iframe').length,
    docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
const frameOf = (page) => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const captionsButton = (frame) => frame?.evaluate(() => {
  const root = document.querySelector('#player solad-video-skin')?.shadowRoot;
  const b = root?.querySelector('media-captions-button');
  const c = root?.querySelector('media-container');
  return b ? { label: b.getAttribute('aria-label'), display: getComputedStyle(b).display, shown: b.getClientRects().length > 0, containerW: Math.round(c.getBoundingClientRect().width) } : null;
}).catch((e) => ({ error: String(e).slice(0, 120) }));

async function openDialog(page, name) {
  await page.getByRole('button', { name: `${name} 미리보기`, exact: true }).click();
  await page.locator('dialog.sa-dialog[open]').waitFor({ timeout: 10000 });
  await waitFrameSkin(() => frameOf(page));
  await sleep(1500);
}
async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await sleep(500);
}
async function typeUnsaved(page, id, name) {
  await page.goto(`${BASE}/#/players/edit/${id}`);
  const field = page.locator('#aa-preset-name');
  await field.waitFor({ timeout: 15000 });
  await field.fill(`${name} (입력 중)`);
  await sleep(400);
  await page.evaluate(() => { location.hash = '#/players'; });
  await page.getByRole('table').first().waitFor({ timeout: 15000 });
  await sleep(800);
}

let langId = null;
for (const [w, h] of SIZES) {
  const context = await newContext(browser, { width: w, height: h });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = (result.sizes[`${w}x${h}`] = { cases: {} });
  try {
    await login(page);
    if (!langId) {
      const list = await adminCall(page, 'player-presets');
      const existing = list.data.presets.find((p) => p.name === 'QA 언어 ko');
      const made = existing ? { status: 'existing', data: { preset: existing } } : await adminCall(page, 'player-preset-save', { revision: list.data.revision, preset: { id: null, name: 'QA 언어 ko', playerType: 'videojs', language: 'ko' } });
      langId = made.data?.preset?.id ?? null;
      result.langPreset = { status: made.status, id: langId, language: made.data?.preset?.language ?? null };
      fs.writeFileSync(`${EV}/F01/lang-preset.json`, JSON.stringify(result.langPreset));
    }
    await page.goto(`${BASE}/#/players`);
    await page.getByRole('table').first().waitFor({ timeout: 15000 });
    await sleep(800);
    for (const [key, name, id] of [['builtin-default', '기본', null], ['saved-8', 'QA 테두리 8자리', 'p-wgqz3x31a5'], ['saved-lang', 'QA 언어 ko', langId]]) {
      await openDialog(page, name);
      r.cases[`${key} note-off`] = await dialogFacts(page);
      await shot(page, `F01/${key}-off-${w}x${h}.png`);
      await closeDialog(page);
      if (!id) continue;
      // The unsaved input lives in a second tab that closes without its unload prompt, so the main tab stays clean.
      const draft = await context.newPage();
      consoleCollector(draft, logs);
      await typeUnsaved(draft, id, name);
      await openDialog(draft, name);
      r.cases[`${key} note-on`] = await dialogFacts(draft);
      await shot(draft, `F01/${key}-on-${w}x${h}.png`);
      await closeDialog(draft);
      await draft.close();
    }

    if (w === 1280 && h === 800) {
      // Resize with the dialog open.
      await openDialog(page, 'QA 테두리 8자리');
      const steps = [];
      steps.push({ at: '800', ...(await dialogFacts(page)) });
      await page.setViewportSize({ width: 1280, height: 720 });
      await sleep(1200);
      steps.push({ at: '720', ...(await dialogFacts(page)) });
      await page.setViewportSize({ width: 1280, height: 800 });
      await sleep(1200);
      steps.push({ at: '800 again', ...(await dialogFacts(page)) });
      r.resize = steps.map((s) => ({ at: s.at, room: s.room, body: s.body, scaleNote: s.scaleNote, ratio: s.frame?.ratio }));
      await closeDialog(page);
      // Regression: the editor preview and the built-in screen card keep the full room.
      await page.goto(`${BASE}/#/players/edit/p-wgqz3x31a5`);
      await page.locator('.sa-stage-view').first().waitFor({ timeout: 15000 });
      await sleep(1500);
      r.editorRoom = await page.evaluate(() => { const v = document.querySelector('.sa-stage-view'); return { w: Math.round(v.getBoundingClientRect().width), fitVar: v.style.getPropertyValue('--_fit') || null, note: document.querySelector('[id$="-scale"]')?.textContent.trim() }; });
      await page.goto(`${BASE}/#/players/edit/rounded`);
      await page.locator('.sa-stage-view').first().waitFor({ timeout: 15000 });
      await sleep(1500);
      r.builtinRoom = await page.evaluate(() => { const v = document.querySelector('.sa-stage-view'); return { w: Math.round(v.getBoundingClientRect().width), fitVar: v.style.getPropertyValue('--_fit') || null, note: document.querySelector('[id$="-scale"]')?.textContent.trim() }; });
    }

    if (w === 1280 && h === 720) {
      // Narrowed room: captions button, scene shortcuts, then close paths and focus.
      await openDialog(page, 'QA 테두리 8자리');
      r.narrow = { facts: await dialogFacts(page), captions: await captionsButton(frameOf(page)) };
      await install(page, 'dialog .sa-stage-now');
      const tools = page.locator('dialog .sa-stage-tools').first();
      r.narrow.scenes = await runSequence(page, {
        button: (scene) => tools.getByRole('button', { name: TEXT[scene], exact: true }),
        playerDoc: async () => frameOf(page),
        playerSel: '#player video-player, #player video',
        steps: SEQUENCE.slice(0, 2),
      });
      await page.locator('dialog .sa-stage-view').screenshot({ path: `${EV}/F01/narrow-scenes-1280x720.png` });
      r.narrow.captionsAfter = await captionsButton(frameOf(page));
      const focusName = () => page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute('aria-label') ?? ''}`);
      await page.keyboard.press('Escape');
      await sleep(600);
      r.close = { esc: { ...(await dialogFacts(page)), focus: await focusName() } };
      await openDialog(page, 'QA 테두리 8자리');
      await page.locator('dialog .sa-dialog-h button').click();
      await sleep(600);
      r.close.head = { ...(await dialogFacts(page)), focus: await focusName() };
      await openDialog(page, 'QA 테두리 8자리');
      await page.locator('dialog .sa-dialog-f').getByRole('button', { name: '닫기', exact: true }).click();
      await sleep(600);
      r.close.foot = { ...(await dialogFacts(page)), focus: await focusName() };
    }
    r.listOverflow = await overflow(page);
  } catch (e) {
    r.error = String(e).slice(0, 1200);
    await shot(page, `F01/error-${w}x${h}.png`, { fullPage: true }).catch(() => {});
  }
  r.events = req.events().length;
  r.api = req.actions().filter((a) => !/bootstrap|creatives|player-presets$|player-preset&|player-preset @/.test(a));
  r.console = logs.map((l) => `${l.type}: ${l.text.slice(0, 160)}`);
  await context.close();
}
save('F01/result.json', result);
await browser.close();
