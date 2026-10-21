// A2-D-QA-DELTA X08 regression (copied from A2-D-QA, output paths moved to X08/): D09 schedule pre-publish preview (site default schedule, nothing saved or published): "적용할 프리셋" changes
// the preview look (Video.js 강조색 복제, 둥근 테두리, then the 기본 video preset), a cross-origin content address plays
// (http://localhost:18781 is another origin than the admin's 127.0.0.1:18781; same QA server, no second server), the
// play-test links carry the chosen preset, and the ad screen through the schedule-object path is shot next to the
// demo's <media-ads src> path at the same point (preroll 1/2).
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { players } from './a2.mjs';
import { openDemo, requestLog } from './demo.mjs';

const XORIGIN = 'http://localhost:18781/demo-media/grok-20261018/content-scene-01.mp4';
const browser = await launch();
const result = { cases: [] };
const context = await newContext(browser, { width: 1280, height: 1600 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const look = (p) => p && { tree: p.tree, lang: p.i18nLang, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, media: p.media && { tag: p.media.tag, src: p.media.src, controls: p.media.controls, paused: p.media.paused, t: p.media.currentTime }, ads: p.ads?.attrs };

// What the ad screen shows: visible control bar or not, the skip control and the ad text.
const adScreen = (target) => target.evaluate(() => {
  const deep = (root, sel) => { const out = [...root.querySelectorAll(sel)]; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(...deep(el.shadowRoot, sel)); return out; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const root = document.querySelector('#player');
  const controls = deep(root, '.media-controls, [class*="control-bar"], media-control-bar').map((el) => ({ cls: String(el.className).slice(0, 40), visible: visible(el) }));
  const playButtons = deep(root, 'button').filter(visible).map((b) => (b.getAttribute('aria-label') || b.textContent).trim()).filter(Boolean).slice(0, 10);
  const texts = deep(root, '*').filter((el) => el.children.length === 0 && visible(el) && el.textContent.trim() && !/^@/.test(el.textContent.trim())).map((el) => el.textContent.trim()).slice(0, 15);
  return { controls, visibleButtons: playButtons, texts, hasMediaAds: Boolean(root.querySelector('media-ads')) };
});

async function prepare(presetLabel, { content } = {}) {
  const panel = page.getByRole('group', { name: '재생 확인' }).or(page.locator('form', { has: page.getByRole('heading', { name: '게시 전 미리보기' }) })).first();
  if (content) await page.getByRole('textbox', { name: '본편 영상 URL' }).fill(content);
  await page.getByRole('combobox', { name: '적용할 프리셋' }).selectOption({ label: presetLabel });
  await sleep(300);
  await page.getByRole('button', { name: '미리보기 준비' }).click();
  const end = Date.now() + 20000;
  while (Date.now() < end && !(frame() && (await frame().evaluate(() => Boolean(document.querySelector('#player video'))).catch(() => false)))) await sleep(400);
  await sleep(2500);
  return panel;
}

async function startAd(target) {
  const box = await page.locator('.sa-stage-frame iframe').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const end = Date.now() + 15000;
  while (Date.now() < end && !/프리롤 1\/\d 재생 중/.test(await page.locator('.sa-stage-now').innerText().catch(() => ''))) await sleep(300);
  await sleep(1200);
}

try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(1000);
  await page.getByRole('textbox', { name: '고정 영상 ID' }).fill('grok-demo-scene-01');
  result.presetOptions = await page.getByRole('combobox', { name: '적용할 프리셋' }).evaluate((s) => [...s.options].map((o) => `${o.value}:${o.textContent}${o.selected ? '*' : ''}`));
  result.presetHelp = await page.getByRole('combobox', { name: '적용할 프리셋' }).evaluate((s) => document.getElementById(s.getAttribute('aria-describedby')?.split(' ')[0])?.textContent ?? null);

  for (const [label, name] of [['QA 강조색 복제 (사이트 적용)', 'accent-site'], ['둥근 테두리', 'rounded'], ['QA 기본 video', 'native']]) {
    await prepare(label);
    const r = { name, frameUrl: frame()?.url().replace(BASE, ''), look: look((await players(frame(), '#player'))[0]), links: await page.locator('a', { hasText: /로 재생$/ }).evaluateAll((as) => as.map((a) => `${a.textContent.trim()} ${a.getAttribute('href')?.replace(/^https?:\/\/[^/]+/, '')}`)), linkNote: await page.locator('text=패키지 기본값으로 재생해요').allInnerTexts(), status: (await page.getByRole('status').allInnerTexts()).filter(Boolean) };
    await page.locator('.sa-ppv').scrollIntoViewIfNeeded();
    await shot(page, `X08/d09-${name}.png`);
    if (name !== 'native') {
      await startAd();
      r.adScreen = await adScreen(frame());
      r.now = await page.locator('.sa-stage-now').innerText();
      await page.locator('.sa-ppv').scrollIntoViewIfNeeded();
      await shot(page, `X08/d09-${name}-ad.png`);
    }
    result.cases.push(r);
  }

  // Cross-origin content with the Video.js preset.
  await prepare('QA 강조색 복제 (사이트 적용)', { content: XORIGIN });
  const media = () => frame().evaluate(() => { const m = document.querySelector('#player video'); return m && { src: m.getAttribute('src') || m.currentSrc, readyState: m.readyState, duration: m.duration, error: m.error?.code ?? null }; });
  result.xorigin = { content: XORIGIN, frameOrigin: new URL(frame().url()).origin, media: await media() };
  await startAd();
  await page.locator('.sa-stage-tools button', { hasText: '끝 직전' }).click();
  await sleep(4000);
  result.xorigin.after = { media: await media(), now: await page.locator('.sa-stage-now').innerText(), status: (await page.getByRole('status').allInnerTexts()).filter(Boolean) };
  await shot(page, 'X08/d09-xorigin.png');

  // Demo <media-ads src> path at the same point, for the side-by-side shot.
  const demo = await context.newPage();
  await openDemo(demo);
  const box = await demo.locator('#player').boundingBox();
  await demo.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const end = Date.now() + 15000;
  while (Date.now() < end && !/프리롤 1\/2 재생 중/.test(await demo.locator('#now').innerText())) await sleep(300);
  await sleep(1200);
  result.demoAdScreen = await adScreen(demo);
  await demo.locator('#player').screenshot({ path: `${(await import('./lib.mjs')).EV}/X08/d09-demo-ad-player.png` });
  await demo.close();
  await page.locator('.sa-stage-frame iframe').screenshot({ path: `${(await import('./lib.mjs')).EV}/X08/d09-preview-ad-player.png` }).catch(() => {});
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'X08/d09-error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events();
result.console = logs;
await context.close();
save('X08/d09-result.json', result);
await browser.close();
