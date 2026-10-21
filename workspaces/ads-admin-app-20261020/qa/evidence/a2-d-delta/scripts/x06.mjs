// A2-D-QA-DELTA X06 (observation 5), adapted from A2-D-QA D11: a Playwright route answers every
// /demo-media/grok-20261018/ request (the repo's demo-media folder is not touched). invalid: schedule.json.js is 200 with
// the wrong shape, everything else 404 → the demo's empty state must read copy §5 "샘플 형식 오류" (title, description,
// guide link) and the editor preview copy §7 "샘플 형식 오류". missing: all 404 → the current missing-sample copy.
// The empty state's <b>, <span> and <a> are read separately; the built-in screen #/players/edit/rounded is read too.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const result = {};
const SAMPLE = '**/demo-media/grok-20261018/**';

async function setup(mode) {
  const context = await newContext(browser, { width: 1280, height: 1100 });
  const media = [];
  await context.route(SAMPLE, (route) => {
    const url = new URL(route.request().url());
    media.push(`${route.request().method()} ${url.pathname} -> ${mode === 'invalid' && url.pathname.endsWith('schedule.json.js') ? 200 : 404}`);
    if (mode === 'invalid' && url.pathname.endsWith('schedule.json.js')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"videoId":"other","breaks":"x"}' });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'qa missing sample' });
  });
  context.on('request', (r) => { if (/\.(mp4|m3u8|webm|ts|m4s)(\?|$)|demo-media/.test(r.url()) && !r.url().includes('grok-20261018')) media.push(`OTHER ${r.method()} ${new URL(r.url()).pathname}`); });
  return { context, media };
}

const empty = (p) => p.evaluate(() => {
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length);
  const stage = document.getElementById('stage');
  const blocks = [...(stage?.querySelectorAll('*') ?? [])].filter((el) => shown(el) && /샘플/.test(el.textContent) && el.children.length < 6).map((el) => `${el.tagName}.${String(el.className).slice(0, 20)}: ${t(el).slice(0, 160)}`).slice(-4);
  const links = [...(stage?.querySelectorAll('a') ?? [])].filter(shown).map((a) => `${t(a)} -> ${a.getAttribute('href')}`);
  return {
    blocks, links,
    player: Boolean(document.querySelector('#player video, #player media-container, #player [data-solad-player] *')),
    playerHtml: (document.getElementById('player')?.innerHTML ?? '').slice(0, 120),
    scenesDisabled: [...document.querySelectorAll('[data-scene]')].map((b) => b.disabled),
    codeShown: shown(document.querySelector('pre')),
    now: t(document.getElementById('now')),
    parts: (() => { const e = document.getElementById('stage-empty'); return e && shown(e) ? { title: t(e.querySelector('b')), text: t(e.querySelector('span')), code: t(e.querySelector('span code')), link: t(e.querySelector('a')), href: e.querySelector('a')?.getAttribute('href') } : null; })(),
  };
});

try {
  for (const mode of ['invalid', 'missing']) {
    const { context, media } = await setup(mode);
    const page = await context.newPage();
    const logs = consoleCollector(page);
    await page.goto(`${BASE}/examples/index.html`);
    await sleep(3500);
    const r = { demo: await empty(page) };
    await shot(page, `X06/demo-${mode}.png`, { fullPage: true });
    await page.goto(`${BASE}/examples/index.html?type=native`);
    await sleep(2500);
    r.demoNative = await empty(page);

    await login(page);
    await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
    await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
    await sleep(5000);
    const aside = page.locator('aside.aa-editor-preview');
    r.editor = {
      text: (await aside.innerText()).replace(/\s+/g, ' ').trim().slice(0, 600),
      notes: await aside.locator('[role="alert"], [role="status"], .sa-note').allInnerTexts(),
      frameVideo: await (async () => { const f = page.frames().find((x) => x.url().includes('/examples/preview.html')); return f ? f.evaluate(() => Boolean(document.querySelector('#player video'))) : null; })(),
      sceneButtons: await aside.locator('.sa-stage-tools button').evaluateAll((bs) => bs.map((b) => `${b.textContent.trim()}:${b.disabled || b.getAttribute('aria-disabled') || ''}`)),
    };
    await aside.scrollIntoViewIfNeeded();
    await shot(page, `X06/editor-${mode}.png`);
    await page.goto(`${BASE}/#/players/edit/rounded`);
    await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
    await sleep(5000);
    r.builtIn = { notes: await page.locator('aside.aa-editor-preview').locator('[role="alert"], [role="status"], .sa-note').allInnerTexts() };
    await shot(page, `X06/builtin-${mode}.png`);
    r.media = media;
    r.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
    result[mode] = r;
    await context.close();
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('X06/result.json', result);
await browser.close();
