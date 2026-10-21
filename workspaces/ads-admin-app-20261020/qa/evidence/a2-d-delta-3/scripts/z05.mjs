// A2-D-QA-DELTA-3 Z05 short regression at 1280:
// (1) 지면 편성 → 사이트 기본 → 게시 전 미리보기(grok-demo-scene-01, schedule object path): 미드롤 앞, then 끝 직전 pressed
//     while the midroll plays — ms to the initial line and to that scene's ad, no 프리롤, no 오류;
// (2) play-test.html (unchanged): a click plays and POST action=events goes out;
// (3) help.html: the preview and handle.seek(target) rows are shown, their anchors (#opt-mount-preview,
//     #opt-mount-handleseektarget) open the row, and the page's id list is compared with the A2-D list (a2-d/D06 helpIds);
// (4) every 4xx response and console error with its URL. The schedule draft is not saved.
import fs from 'node:fs';
import { BASE, EV, launch, newContext, login, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';
import { install, runSequence, SEQUENCE, TEXT } from './scenes.mjs';

const browser = await launch();
const result = {};
const context = await newContext(browser, { width: 1280, height: 1000 });
const req = requestLog(context);
const bad = [];
context.on('response', (res) => { if (res.status() >= 400) bad.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')}`); });
const page = await context.newPage();
const consoleLog = [];
const watch = (p) => {
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleLog.push(`${m.type()}: ${m.text().slice(0, 160)} @${(m.location()?.url ?? '').replace(BASE, '')}`); });
  p.on('pageerror', (e) => consoleLog.push(`pageerror: ${String(e).slice(0, 200)}`));
};
watch(page);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));

try {
  // (1)
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  // The draft load re-renders the panel; fill only after it settles and check the value stayed.
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
  const s = (result.schedule = {});
  s.preset = await page.getByRole('combobox', { name: '적용할 프리셋' }).inputValue().catch(() => null);
  s.frame = await frame()?.evaluate(() => ({ query: location.search, type: document.querySelector('#player video-player') ? 'videojs' : document.querySelector('#player video') ? 'native' : null, mediaAds: document.querySelectorAll('media-ads').length }));
  await install(page, '.sa-stage-now');
  s.initialLine = await page.evaluate(() => window.__qa.lines[0].text);
  s.steps = await runSequence(page, {
    button: (scene) => tools.getByRole('button', { name: TEXT[scene], exact: true }),
    playerDoc: async () => frame(),
    playerSel: '#player video-player, #player video',
    steps: SEQUENCE.slice(0, 2),
  });
  s.frameAfter = await frame()?.evaluate(() => ({ query: location.search, mediaAds: document.querySelectorAll('media-ads').length }));
  await shot(page, 'Z05/schedule-preview.png');
  s.saveCalls = req.actions().filter((a) => /draft|publish|save/.test(a));

  // (2)
  const pt = (result.playTest = {});
  const from = req.all().length;
  const tab = await context.newPage();
  watch(tab);
  await tab.goto(`${BASE}/examples/play-test.html?video=grok-demo-scene-01&type=videojs`);
  await sleep(3500);
  const b = await tab.locator('#player').boundingBox();
  await tab.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const end = Date.now() + 20000;
  while (Date.now() < end && !/재생 중/.test(await tab.locator('#now').innerText())) await sleep(300);
  await sleep(3000);
  pt.now = (await tab.locator('#now').innerText()).replace(/\s+/g, ' ');
  pt.events = req.all().slice(from).filter((x) => /action=events/.test(x.path)).map((x) => `${x.method} ${x.path.replace(/^.*action=/, '')}`);
  await shot(tab, 'Z05/play-test.png');
  await tab.close();

  // (3)
  const h = (result.help = {});
  const help = await context.newPage();
  watch(help);
  for (const id of ['opt-mount-preview', 'opt-mount-handleseektarget']) {
    await help.goto(`${BASE}/examples/help.html#${id}`);
    await sleep(1500);
    h[id] = await help.evaluate((id) => {
      const tr = document.getElementById(id);
      if (!tr) return { found: false };
      const r = tr.getBoundingClientRect();
      const link = tr.querySelector('a.sa-anchor');
      return { found: true, tag: tr.tagName, target: tr.matches(':target'), visible: r.width > 0 && r.height > 0, inView: r.top >= 0 && r.top < innerHeight, href: link?.getAttribute('href') ?? null, name: tr.querySelector('code')?.textContent ?? null, text: tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 420) };
    }, id);
    await shot(help, `Z05/help-${id}.png`);
  }
  const ids = await help.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  const base = JSON.parse(fs.readFileSync(`${EV}/../a2-d/D06/result.json`, 'utf8')).helpIds;
  h.ids = { now: ids.length, a2d: base.length, missing: base.filter((x) => !ids.includes(x)), added: ids.filter((x) => !base.includes(x)) };
  await help.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'Z05/error.png', { fullPage: true }).catch(() => {});
}
result.bad = [...new Set(bad)];
result.console = consoleLog;
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
await context.close();
save('Z05/result.json', result);
await browser.close();
