// A2-D-QA-DELTA-3 Z03 admin progress line keep/reset at 1280:
// (1) built-in rounded: 처음부터 until 프리롤 1/2 재생 중, then only the hash → accent (theme only): the line must stay and the
//     player keep playing (same tagged element in the frame, the line moves on to 프리롤 2/2 …);
// (2) 다시 불러오기 → the initial line;
// (3) editor p-i0aecb28w3 (Video.js): 처음부터 until a line, then hash → p-pchm59hhyv (기본 video) → the initial line;
// (4) extra: editor p-i0aecb28w3, play, then change 플레이어 종류 in the form without saving → line; the form is left unsaved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';
import { install } from './scenes.mjs';

const browser = await launch();
const result = {};
const context = await newContext(browser, { width: 1280, height: 900 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const tools = () => page.locator('.sa-stage-tools').first();
const line = () => page.locator('.sa-stage-now').first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null);
const tag = (name) => frame()?.evaluate((n) => { const el = document.querySelector('#player video-player, #player video'); if (el) el.dataset.qaTag = n; return { frameUrl: location.pathname + location.search, tagged: Boolean(el) }; }, name).catch(() => null);
const probe = () => frame()?.evaluate(() => { const el = document.querySelector('#player video-player, #player video'); return { frameQuery: location.search, tag: el?.dataset.qaTag ?? null, kind: el?.tagName ?? null }; }).catch(() => null) ?? Promise.resolve(null);
const lines = () => page.evaluate(() => window.__qa.lines.map((l) => l.text.replace(/^최근 광고 진행 ?/, '')));

async function until(re, ms = 25000) {
  const end = Date.now() + ms;
  let v = await line();
  while (Date.now() < end && !re.test(v ?? '')) { await sleep(200); v = await line(); }
  return v;
}
async function ready() {
  await tools().waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.sa-stage-tools button')?.disabled === false, null, { timeout: 25000 });
}
const click = (name) => tools().getByRole('button', { name, exact: true }).click();
async function hash(id) {
  await page.evaluate((id) => { location.hash = `#/players/edit/${id}`; }, id);
  await page.waitForFunction((id) => location.hash.endsWith(id), id);
}

try {
  await login(page);
  // (1)
  await page.goto(`${BASE}/#/players/edit/rounded`);
  await ready();
  await install(page, '.sa-stage-now');
  await click('처음부터');
  const r1 = (result.themeOnly = {});
  r1.playing = await until(/프리롤 1\/2 재생 중/);
  r1.tag = await tag('rounded-player');
  await hash('accent');
  await sleep(300);
  r1.afterHash = { line: await line(), note: await page.locator('.aa-builtin .sa-note').first().innerText().catch(() => null), player: await probe() };
  await sleep(1500);
  r1.after2s = { line: await line(), player: await probe() };
  r1.continues = await until(/프리롤 2\/2 재생 중|미드롤|끝남/, 15000);
  r1.player = await probe();
  r1.lines = await lines();
  await shot(page, 'Z03/theme-only-accent.png');

  // (2)
  const r2 = (result.reload = {});
  r2.before = await line();
  await click('다시 불러오기');
  await sleep(300);
  r2.after300ms = await line();
  await sleep(2500);
  r2.after3s = { line: await line(), player: await probe() };
  await shot(page, 'Z03/after-reload.png');

  // (3)
  const r3 = (result.playerType = {});
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await ready();
  await install(page, '.sa-stage-now');
  await click('처음부터');
  r3.playing = await until(/프리롤 1\/2 재생 중/);
  r3.player = await probe();
  await hash('p-pchm59hhyv');
  await sleep(300);
  r3.after300ms = { line: await line(), name: await page.locator('#aa-preset-name').inputValue().catch(() => null) };
  await sleep(3000);
  r3.after3s = { line: await line(), player: await probe() };
  r3.lines = await lines();
  await shot(page, 'Z03/player-type-native.png');

  // (4) unsaved 플레이어 종류 change in the form.
  const r4 = (result.formType = {});
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await ready();
  await click('처음부터');
  r4.playing = await until(/프리롤 1\/2 재생 중/);
  const type = page.locator('#aa-preset-playerType');
  r4.control = await type.evaluate((el) => ({ tag: el.tagName, type: el.type ?? null, value: el.value ?? null })).catch(() => null);
  if (r4.control?.tag === 'SELECT') await type.selectOption('native');
  else await page.getByLabel(/기본 video/).first().check().catch(() => {});
  await sleep(300);
  r4.after300ms = await line();
  await sleep(3000);
  r4.after3s = { line: await line(), player: await probe() };
  await shot(page, 'Z03/form-type-native.png');
} catch (error) {
  result.error = String(error).slice(0, 1200);
  await shot(page, 'Z03/error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events().length;
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
await context.close();
save('Z03/result.json', result);
await browser.close();
