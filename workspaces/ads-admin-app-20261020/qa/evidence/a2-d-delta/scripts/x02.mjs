// A2-D-QA-DELTA X02 (A2D-02 schedule preview): on 지면 편성 (site default, nothing saved to the schedule) a video ID gets a
// name through 독립 설치 영상의 게시판·분류 연결 (영상 소속 저장, isolated QA DB only). The pre-publish preview is then
// prepared for that video (title = the name), for a video without a name (title = the video ID), and with each preset
// in 적용할 프리셋 so the poster follows the preset's display options. The frame's player attributes are read.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, EV } from './lib.mjs';
import { requestLog } from './demo.mjs';

const NAMED = 'qa-x02-named';
const LABEL = 'QA 이름 붙인 영상';
const PLAIN = 'qa-x02-plain';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1400 });
const req = requestLog(context);
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const logs = consoleCollector(page);
const result = { cases: [] };
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const readFrame = () => frame()?.evaluate(() => {
  const vp = document.querySelector('#player video-player');
  const v = document.querySelector('#player video');
  return { url: location.search, built: Boolean(v), tree: vp ? 'VIDEO-PLAYER' : v ? `${v.parentElement.tagName} > VIDEO` : null, contentTitle: vp?.getAttribute('content-title') ?? null, poster: vp?.getAttribute('poster') ?? v?.getAttribute('poster') ?? null, src: (v?.getAttribute('src') ?? '').replace(location.origin, '') };
}).catch(() => null);

async function prepare(videoId, presetLabel) {
  const box = page.getByRole('textbox', { name: '고정 영상 ID' });
  await box.fill('');
  await box.pressSequentially(videoId);
  await page.getByRole('combobox', { name: '적용할 프리셋' }).selectOption({ label: presetLabel });
  await sleep(300);
  await page.getByRole('button', { name: '미리보기 준비' }).click();
  const end = Date.now() + 25000;
  let f = await readFrame();
  while (Date.now() < end && !(f?.built)) { await sleep(400); f = await readFrame(); }
  await sleep(1500);
  return readFrame();
}

try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  // The video-context form shows only while 적용 단위 is 개별 영상 (standalone + manualTargets).
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await sleep(600);
  await page.locator('summary', { hasText: '독립 설치 영상의 게시판·분류 연결' }).click();
  const ctx = page.getByRole('form', { name: '영상 소속 연결' });
  await ctx.getByRole('textbox', { name: '영상 ID' }).fill(NAMED);
  await ctx.getByRole('textbox', { name: '영상 이름' }).fill(LABEL);
  await ctx.getByRole('button', { name: '영상 소속 저장' }).click();
  await sleep(1200);
  result.contextStatus = (await page.getByRole('status').allInnerTexts().catch(() => [])).filter((t) => /소속/.test(t)).join(' ');
  await shot(page, 'X02/context-saved.png');
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(800);
  result.presetOptions = await page.getByRole('combobox', { name: '적용할 프리셋' }).evaluate((s) => [...s.options].map((o) => o.textContent));

  const presets = result.presetOptions;
  const site = presets.find((p) => /사이트 적용/.test(p));
  for (const [videoId, label] of [[NAMED, site], [PLAIN, site], ...presets.filter((p) => p !== site).map((p) => [NAMED, p])]) {
    const f = await prepare(videoId, label);
    const key = `${videoId}-${label}`.replace(/[^\w가-힣-]+/g, '_');
    result.cases.push({ videoId, preset: label, frame: f });
    await page.locator('.sa-stage-frame iframe').first().screenshot({ path: `${EV}/X02/${key}.png` }).catch(() => {});
  }
  await page.getByRole('region', { name: '게시 전 미리보기' }).scrollIntoViewIfNeeded();
  await shot(page, 'X02/panel.png');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'X02/error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events();
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
await context.close();
save('X02/result.json', result);
await browser.close();
