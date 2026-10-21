// A2-E-QA E06 at 1280: (1) help.html rows and anchors for the A2-E keys and the invalid_preview_logo error row, the
// controls.* stage text, and the page's id list against A2-D; (2) the admin #/players/options table has the same A2-E
// rows and its help links reach existing anchors; (3) no cast or AirPlay button in the demo, the preview frame and the
// play test; (4) play-test.html with the ad skin plays and sends action=events; (5) the schedule preview's scene
// shortcuts 미드롤 앞 then 끝 직전 during the midroll; (6) every 4xx and console error with its URL. Nothing is saved.
import fs from 'node:fs';
import { BASE, EV, launch, newContext, login, save, shot, sleep } from './lib.mjs';
import { requestLog, openDemo, waitPlayer } from './demo.mjs';
import { install, runSequence, SEQUENCE, TEXT } from './scenes.mjs';

const browser = await launch();
const result = {};
const context = await newContext(browser, { width: 1280, height: 1000 });
const req = requestLog(context);
const bad = [];
context.on('response', (res) => { if (res.status() >= 400) bad.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')} @${(() => { try { return res.request().frame().url().replace(BASE, ''); } catch { return '?'; } })()}`); });
const consoleLog = [];
const watch = (p) => {
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleLog.push(`${m.type()}: ${m.text().slice(0, 160)} @${(m.location()?.url ?? '').replace(BASE, '')} page ${p.url().replace(BASE, '')}`); });
  p.on('pageerror', (e) => consoleLog.push(`pageerror: ${String(e).slice(0, 200)} page ${p.url().replace(BASE, '')}`));
};
const castFacts = (doc) => doc.evaluate(() => {
  const skin = document.querySelector('#player solad-video-skin, #player video-skin');
  const root = skin?.shadowRoot;
  const deep = (r, sel) => r ? [...r.querySelectorAll(sel)].length : null;
  return { skin: skin?.localName ?? (document.querySelector('#player video') ? 'native video' : null), cast: deep(root, 'media-cast-button, [class*="cast"]'), airplay: deep(root, 'media-airplay-button, [class*="airplay"]'), buttons: root ? [...root.querySelectorAll('[aria-label]')].map((b) => b.getAttribute('aria-label')).filter(Boolean) : null };
});

const page = await context.newPage();
watch(page);
const helpIds = ['opt-data-captions', 'opt-mount-captions', 'opt-mount-previewlogo', 'opt-query-seekbuttons', 'opt-query-captions', 'opt-query-captionsurl', 'opt-query-logo', 'opt-query-logoposition', 'opt-query-logowidth', 'opt-query-logoopacity', 'opt-query-logomargin', 'opt-query-logohref', 'opt-query-logoalt', 'opt-query-logohideduringads', 'opt-query-logohidewithcontrols', 'field-controls-seekButtons', 'field-controls-captions', 'field-logo-position', 'field-logo-assetId'];

try {
  // (1) help.html before login (public page).
  const h = (result.help = { rows: {} });
  const help = await context.newPage();
  watch(help);
  for (const id of helpIds) {
    await help.goto(`${BASE}/examples/help.html#${id}`);
    await sleep(700);
    h.rows[id] = await help.evaluate((id) => {
      const tr = document.getElementById(id);
      if (!tr) return { found: false };
      const r = tr.getBoundingClientRect();
      return { found: true, tag: tr.tagName, target: tr.matches(':target'), inView: r.top >= 0 && r.top < innerHeight, href: tr.querySelector('a.sa-anchor')?.getAttribute('href') ?? null, text: tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) };
    }, id);
  }
  await shot(help, 'E06/help-opt-query-seekbuttons.png');
  await help.goto(`${BASE}/examples/help.html#field-controls-seekButtons`);
  await sleep(800);
  await shot(help, 'E06/help-field-controls-seekButtons.png');
  h.invalidPreviewLogo = await help.evaluate(() => [...document.querySelectorAll('tr')].filter((tr) => tr.textContent.includes('invalid_preview_logo')).map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()));
  h.errorCodes = await help.evaluate(() => [...document.querySelectorAll('tr td:first-child code')].map((c) => c.textContent).filter((t) => /^[a-z_]+$/.test(t)));
  const ids = await help.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  const base = JSON.parse(fs.readFileSync(`${EV}/../a2-d/D06/result.json`, 'utf8')).helpIds;
  h.ids = { now: ids.length, a2d: base.length, missing: base.filter((x) => !ids.includes(x)), added: ids.filter((x) => !base.includes(x)) };
  h.overflow = await help.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await help.close();

  // (2) admin option table.
  await login(page);
  await page.goto(`${BASE}/#/players/options`);
  await page.locator('a[href*="help.html#opt-"]').first().waitFor({ state: 'attached', timeout: 15000 });
  await sleep(800);
  const a = (result.adminOptions = {});
  a.layout = await page.evaluate(() => ({ tables: document.querySelectorAll('table').length, visibleTables: [...document.querySelectorAll('table')].filter((t) => t.getClientRects().length).length, helpLinks: document.querySelectorAll('a[href*="help.html#"]').length }));
  a.rows = await page.evaluate(() => [...document.querySelectorAll('a[href*="help.html#"]')].filter((l) => l.getClientRects().length).map((l) => ({ link: l.getAttribute('href'), name: l.getAttribute('aria-label') ?? l.textContent.trim(), row: l.closest('tr, li, [role=row], article')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null })).filter((r) => /captions|logo|seek|preview/i.test(r.link)));
  const helpAll = await context.newPage();
  await helpAll.goto(`${BASE}/examples/help.html`);
  await sleep(800);
  const allIds = await helpAll.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  await helpAll.close();
  a.linksMissing = a.rows.filter((r) => r.link && !allIds.includes(decodeURIComponent(r.link.split('#')[1] ?? ''))).map((r) => r.link);
  await page.locator('a[href*="help.html#opt-query-seekbuttons"]').filter({ visible: true }).first().scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, 'E06/admin-options-query.png');

  // (3) demo cast/AirPlay.
  await openDemo(page, '');
  result.cast = { demo: await castFacts(page) };

  // (5) schedule preview shortcuts.
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await page.getByText('편성을 불러왔어요', { exact: false }).first().waitFor({ timeout: 15000 });
  await sleep(1500);
  const vid = page.getByRole('textbox', { name: '고정 영상 ID' });
  await vid.fill('grok-demo-scene-01');
  await sleep(500);
  if ((await vid.inputValue()) !== 'grok-demo-scene-01') await vid.fill('grok-demo-scene-01');
  await page.getByRole('button', { name: '미리보기 준비' }).click();
  const tools = page.locator('.sa-stage-tools').first();
  await tools.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.sa-stage-tools button')?.disabled === false, null, { timeout: 30000 });
  const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
  const s = (result.schedule = {});
  s.frame = await frame()?.evaluate(() => ({ query: location.search, skin: document.querySelector('#player solad-video-skin, #player video-skin')?.localName ?? null, mediaAds: document.querySelectorAll('media-ads').length }));
  result.cast.scheduleFrame = await castFacts(frame());
  await install(page, '.sa-stage-now');
  s.initialLine = await page.evaluate(() => window.__qa.lines[0].text);
  s.steps = await runSequence(page, {
    button: (scene) => tools.getByRole('button', { name: TEXT[scene], exact: true }),
    playerDoc: async () => frame(),
    playerSel: '#player video-player, #player video',
    steps: SEQUENCE.slice(0, 2),
  });
  await shot(page, 'E06/schedule-preview.png');
  s.saveCalls = req.actions().filter((x) => /draft|publish|save/.test(x));

  // (4) play test.
  const pt = (result.playTest = {});
  const from = req.all().length;
  const tab = await context.newPage();
  watch(tab);
  await tab.goto(`${BASE}/examples/play-test.html?video=grok-demo-scene-01&type=videojs`);
  await sleep(3500);
  result.cast.playTest = await castFacts(tab);
  const b = await tab.locator('#player').boundingBox();
  await tab.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const end = Date.now() + 20000;
  while (Date.now() < end && !/재생 중/.test(await tab.locator('#now').innerText())) await sleep(300);
  await sleep(3000);
  pt.now = (await tab.locator('#now').innerText()).replace(/\s+/g, ' ');
  pt.events = req.all().slice(from).filter((x) => /action=events/.test(x.path)).map((x) => `${x.method} ${x.path.replace(/^.*action=/, '')}`);
  await shot(tab, 'E06/play-test.png');
  await tab.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'E06/error.png', { fullPage: true }).catch(() => {});
}
result.bad = [...new Set(bad)];
result.console = consoleLog;
result.api = req.actions().filter((x) => !/bootstrap|creatives/.test(x));
await context.close();
save('E06/result.json', result);
await browser.close();
