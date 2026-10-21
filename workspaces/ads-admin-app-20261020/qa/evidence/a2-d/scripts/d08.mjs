// A2-D-QA D08 admin editor preview: on a saved preset, unsaved changes (accent, autoplay, loop, language, poster,
// title, the timer label) reach the preview frame before saving; scene shortcuts reach the midroll and postroll; width
// views with the ratio text; the page-language picker only while language is empty; the latest-progress line; the
// demo link (enabled for the saved preset, blocked with a reason after an edit and for a new preset); the built-in
// read-only screen. Nothing is saved. Every request is logged to count action=events.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { players } from './a2.mjs';
import { requestLog } from './demo.mjs';

const SAVED = 'p-i0aecb28w3';
const browser = await launch();
const result = { steps: [] };
const context = await newContext(browser, { width: 1280, height: 1500 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const frame = () => page.frames().find((f) => /\/examples\/preview\.html/.test(f.url()));
const look = (p) => p && { tree: p.tree, lang: p.i18nLang, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, media: p.media && { tag: p.media.tag, autoplay: p.media.autoplayAttr, muted: p.media.mutedProp, loop: p.media.loop, paused: p.media.paused, t: p.media.currentTime }, contentTitle: p.playerAttrs?.contentTitle, poster: p.playerAttrs?.poster, ads: p.ads?.attrs, buttons: p.buttonLabels?.slice(1, 6), text: p.visibleText?.slice(0, 12) };

async function ui() {
  return page.evaluate(() => {
    const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const demo = document.querySelector('.sa-ppv-f a');
    const why = demo?.getAttribute('aria-describedby');
    const pageLang = [...document.querySelectorAll('main label')].find((l) => l.textContent.trim().startsWith('페이지 언어'));
    return {
      now: t(document.querySelector('.sa-stage-now')),
      scale: t(document.querySelector('.sa-stage-bar .sa-small')),
      frameBox: (() => { const r = document.querySelector('.sa-stage-frame iframe')?.getBoundingClientRect(); return r && { w: Math.round(r.width), h: Math.round(r.height) }; })(),
      view: (() => { const r = document.querySelector('.sa-stage-view')?.getBoundingClientRect(); return r && { w: Math.round(r.width), h: Math.round(r.height) }; })(),
      frameStyle: document.querySelector('.sa-stage-frame')?.getAttribute('style'),
      scenes: [...document.querySelectorAll('.sa-stage-tools button')].map((b) => `${b.textContent.trim()}:${b.disabled ? 'off' : 'on'}`),
      sceneHelp: t(document.querySelector('.sa-stage-tools .sa-help')),
      demo: demo && { href: demo.getAttribute('href'), disabled: demo.getAttribute('aria-disabled'), why: why ? t(document.getElementById(why)) : null },
      pageLangShown: Boolean(pageLang),
      status: [...document.querySelectorAll('[role="status"], [role="alert"]')].map(t).filter(Boolean),
    };
  });
}

async function framePlayer() {
  const f = frame();
  if (!f) return null;
  return look((await players(f, '#player'))[0]);
}

async function step(label, act, wait = 2500) {
  await act?.();
  await sleep(wait);
  const r = { label, ui: await ui(), frame: await framePlayer(), frameNotice: await frame()?.evaluate(() => { const n = document.getElementById('notice'); return n && !n.hidden ? n.textContent.trim() : null; }) };
  result.steps.push(r);
  await page.locator('h2:has-text("플레이어 미리보기"), h3:has-text("플레이어 미리보기")').first().scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, `D08/${String(result.steps.length).padStart(2, '0')}-${label}.png`, { fullPage: true });
  return r;
}

const sw = (id) => page.locator(`#${id}`);
// Marks the frame's media element so a later read says whether the player was rebuilt.
const mark = () => frame()?.evaluate(() => { const m = document.querySelector('#player video, #player hls-video, #player hlsjs-video'); if (m) m.dataset.qaMark = '1'; });
const marked = () => frame()?.evaluate(() => Boolean(document.querySelector('#player [data-qa-mark]')));

try {
  await login(page);
  await page.goto(`${BASE}/#/players/edit/${SAVED}`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await step('saved-start', null, 4000);

  for (const v of ['narrow', 'medium', 'wide']) await step(`width-${v}`, () => page.locator(`input[type="radio"][value="${v}"]`).check(), 1200);

  await mark();
  await step('accent-red', async () => { await page.locator('#aa-preset-theme-accentColor').fill('#dc2626'); await page.keyboard.press('Tab'); });
  result.accentRebuilt = !(await marked());
  await step('autoplay-on', () => sw('aa-preset-playback-autoplay').click(), 5000);
  await step('loop-on', () => sw('aa-preset-playback-loop').click(), 3000);
  await step('lang-ja', () => page.locator('#aa-preset-language').selectOption('ja'), 4500);
  await step('poster-on', () => sw('aa-preset-display-poster').click());
  await step('title-toggle', () => sw('aa-preset-display-title').click());
  await mark();
  await step('timer-label', async () => { await page.locator('#aa-preset-ads-labels-timer').fill('QA {elapsed}/{duration}'); await page.keyboard.press('Tab'); }, 3500);
  result.labelRebuilt = !(await marked());

  // Scene shortcuts while autoplay is on.
  await step('scene-midroll', () => page.locator('.sa-stage-tools button', { hasText: '미드롤 앞' }).click(), 5000);
  await step('scene-end', () => page.locator('.sa-stage-tools button', { hasText: '끝 직전' }).click(), 6000);
  await step('scene-start', () => page.locator('.sa-stage-tools button', { hasText: '처음부터' }).click(), 3500);

  // Empty language: the page-language picker appears and drives the frame.
  await step('lang-empty', () => page.locator('#aa-preset-language').selectOption(''), 3000);
  const pageLang = page.getByRole('combobox', { name: '페이지 언어' });
  await step('page-lang-en', () => pageLang.selectOption('en'), 3000);
  await step('page-lang-ja', () => pageLang.selectOption('ja'), 3000);

  // A new preset: the demo link is blocked with the new-preset reason; the preview still follows input.
  await page.goto(`${BASE}/#/players/new`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await step('new-start', null, 4000);
  await step('new-autoplay', () => sw('aa-preset-playback-autoplay').click(), 4000);

  // Built-in: the list's buttons for 기본, then its own screen.
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('table', { name: '플레이어 프리셋' }).waitFor();
  await sleep(800);
  result.builtInRow = await page.locator('tr', { hasText: '둥근 테두리' }).first().evaluate((tr) => [...tr.querySelectorAll('a, button')].map((b) => ({ tag: b.tagName, name: (b.getAttribute('aria-label') || b.textContent).trim(), disabled: b.disabled || b.getAttribute('aria-disabled') === 'true', href: b.getAttribute('href'), why: (b.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()) })));
  await shot(page, 'D08/list.png', { fullPage: true });
  const view = result.builtInRow.find((b) => b.href?.includes('rounded') || /보기|열기/.test(b.name));
  if (view?.href) await page.goto(`${BASE}/${view.href}`);
  else if (view) await page.locator('tr', { hasText: '둥근 테두리' }).first().getByRole(view.tag === 'A' ? 'link' : 'button', { name: view.name }).click();
  await sleep(4000);
  result.builtIn = { url: page.url().replace(BASE, ''), headings: await page.locator('main h1, main h2, main h3').allInnerTexts(), editable: await page.evaluate(() => [...document.querySelectorAll('main form input, main form select, main form button[type="submit"]')].filter((e) => !e.disabled && !e.readOnly).length), readonlyNote: await page.locator('main .sa-note').allInnerTexts() };
  await step('built-in', null, 500);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D08/error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events();
result.console = logs;
await context.close();
save('D08/result.json', result);
await browser.close();
