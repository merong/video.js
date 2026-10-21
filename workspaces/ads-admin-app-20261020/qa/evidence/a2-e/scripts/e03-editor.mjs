// A2-E-QA E03 editor and API: the editor's "컨트롤" section (이전·이후 버튼 first on 10, 5/15/30, off, on again keeps
// the last; the preview frame's skin follows), the native preset's block and reason, the save API's 422 for a bad step,
// a non-boolean captions and a native preset with controls, and the demo's install-code line. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { adminCall } from './a2.mjs';
import { openDemo, requestLog, demoState } from './demo.mjs';
import { waitFrameSkin } from './probe-lib.mjs';

const VJS = 'p-wgqz3x31a5';
const NATIVE = 'p-pchm59hhyv';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const req = requestLog(context);
let page = await context.newPage();
const logs = consoleCollector(page);
const result = { editor: [], native: null, api: [] };
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));

const sectionState = () => page.evaluate(() => {
  const sw = document.getElementById('aa-preset-controls-seekButtons');
  const sec = sw?.closest('section, fieldset, details');
  const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const radios = [...(sec?.querySelectorAll('input[type="radio"]') ?? [])];
  const cc = document.getElementById('aa-preset-controls-captions');
  return {
    heading: text(sec?.querySelector('h2, h3, legend, summary')),
    seek: sw ? { tag: sw.localName, role: sw.getAttribute('role'), checked: sw.getAttribute('aria-checked') ?? String(sw.checked), disabled: sw.disabled || sw.getAttribute('aria-disabled') === 'true', describedBy: (sw.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => text(document.getElementById(id))) } : null,
    radios: radios.map((r) => `${r.value}${r.checked ? '*' : ''}${r.disabled ? '(off)' : ''}`),
    radioVisible: radios.some((r) => r.closest('label')?.getClientRects().length),
    segLabel: text(sec?.querySelector('.sa-seg')?.previousElementSibling) ?? text(document.getElementById(sec?.querySelector('[role=radiogroup]')?.getAttribute('aria-labelledby'))),
    captions: cc ? { checked: cc.getAttribute('aria-checked') ?? String(cc.checked), disabled: cc.disabled || cc.getAttribute('aria-disabled') === 'true', describedBy: (cc.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => text(document.getElementById(id))) } : null,
    reason: text(sec?.querySelector('.sa-off-reason, [class*="reason"]')),
    sectionText: text(sec)?.slice(0, 400),
  };
});
const frameSkin = async () => {
  const f = await waitFrameSkin(frame, 15000);
  await sleep(1200);
  return f?.evaluate(() => {
    const skin = document.querySelector('#player solad-video-skin, #player video-skin');
    const root = skin?.shadowRoot;
    return { query: location.search, skin: skin?.localName ?? null, seekAttr: skin?.getAttribute('seek-buttons') ?? null, buttons: root ? [...root.querySelectorAll('media-seek-button')].map((b) => b.getAttribute('seconds')) : null };
  }).catch((e) => ({ error: String(e).slice(0, 200) }));
};

try {
  await login(page);
  await page.goto(`${BASE}/#/players/edit/${VJS}`);
  await page.locator('#aa-preset-controls-seekButtons').waitFor({ timeout: 15000 });
  const opener = page.locator('aside.aa-editor-preview button[aria-expanded]').first();
  if ((await opener.count()) && (await opener.getAttribute('aria-expanded')) === 'false') { await opener.click(); await sleep(500); }
  const step = async (label) => result.editor.push({ label, section: await sectionState(), frame: await frameSkin() });
  await step('open (saved: off)');
  await page.locator('#aa-preset-controls-seekButtons').click();
  await sleep(1500);
  await step('switch on');
  await page.locator('#aa-preset-controls-seekButtons').scrollIntoViewIfNeeded();
  await shot(page, 'E03/editor-seek-on-1280.png');
  for (const v of ['5', '15', '30']) {
    const sec = page.locator('section, fieldset').filter({ has: page.locator('#aa-preset-controls-seekButtons') }).last();
    await sec.locator(`input[type="radio"][value="${v}"]`).check({ force: true });
    await sleep(1500);
    await step(`step ${v}`);
  }
  await page.locator('#aa-preset-controls-seekButtons').click();
  await sleep(1500);
  await step('switch off');
  await page.locator('#aa-preset-controls-seekButtons').click();
  await sleep(1500);
  await step('switch on again');
  // Leave without saving: a new page for the native preset, then the edited page closes without its unload prompt.
  const edited = page;
  page = await context.newPage();
  consoleCollector(page, logs);
  await page.goto(`${BASE}/#/players/edit/${NATIVE}`);
  await page.locator('#aa-preset-controls-seekButtons').waitFor({ timeout: 15000 });
  await sleep(800);
  result.native = await sectionState();
  await page.locator('#aa-preset-controls-seekButtons').scrollIntoViewIfNeeded();
  await shot(page, 'E03/editor-native-1280.png');
  await edited.close();
} catch (e) {
  result.error = String(e).slice(0, 1000);
  await shot(page, 'E03/editor-error.png', { fullPage: true }).catch(() => {});
}

// API (each refused or deleted at once).
const list = await adminCall(page, 'player-presets');
let revision = list.data.revision;
const base = (controls, extra = {}) => ({ id: null, name: 'QA A2-E 컨트롤 검사', playerType: 'videojs', controls, ...extra });
for (const [label, preset] of [
  ['seek 10', base({ seekButtons: 10 })],
  ['seek null + captions false', base({ seekButtons: null, captions: false })],
  ['seek 7', base({ seekButtons: 7 })],
  ['seek "10"', base({ seekButtons: '10' })],
  ['seek 0', base({ seekButtons: 0 })],
  ['captions "yes"', base({ captions: 'yes' })],
  ['native + seek 10', base({ seekButtons: 10 }, { playerType: 'native' })],
  ['native + captions false', base({ captions: false }, { playerType: 'native' })],
]) {
  const r = await adminCall(page, 'player-preset-save', { revision, preset });
  const entry = { label, status: r.status, code: r.code, fields: r.fields, message: r.message, controls: r.data?.preset?.controls ?? null };
  if (r.status === 200) {
    revision = r.data.revision;
    const d = await adminCall(page, 'player-preset-delete', { revision, id: r.data.preset.id });
    entry.deleted = d.status;
    revision = d.data?.revision ?? revision;
  }
  result.api.push(entry);
}

// Demo install code with seek 10: what each tab says.
await openDemo(page, '?seekButtons=10');
const s = await demoState(page);
result.demoCode = { why: s.codeWhy, htmlHasSeek: /seek/i.test(s.codeHtml ?? ''), js: (s.codeJs ?? '').split('\n').filter((l) => /overrides|controls|seek/i.test(l)), html: s.codeHtml };
result.after = (await adminCall(page, 'player-presets')).data.presets.map((p) => `${p.id}:${p.name}`);
result.events = req.events().length;
result.calls = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.console = logs;
await context.close();
save('E03/editor.json', result);
await browser.close();
