// A2-E-QA-DELTA F02 (A2E-02): the demo logo's drawn width is min(setting, player width / 4) at 390×844, 768×1024 and
// 1280×900 for widths 24/80/120/240 in all four corners, and the title beside a top-left logo starts at margin + drawn
// width + spacing × 2 without breaking into a column or overflowing. Also the bottom rise and the 390 top-right drop
// against A2-E-QA, and at 1280 only: hideWithControls, hideDuringAds and the link's Tab order. Nothing is saved.
import { BASE, EV, launch, newContext, login, consoleCollector, save, sleep, overflow } from './lib.mjs';
import { openDemo, requestLog } from './demo.mjs';
import { logoFacts, waitControls, deepActive, nowText } from './e05-lib.mjs';

const SIZES = [[390, 844], [768, 1024], [1280, 900]];
const WIDTHS = [24, 80, 120, 240];
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const LINK = `${BASE}/examples/guide.html`;
const LONG = '아주 긴 제목이 로고 옆에서 어떻게 줄바꿈되는지 보는 QA 문장입니다';

// The title's box and text lines against the container, plus the skin's spacing resolved to px.
const titleFacts = (page) => page.evaluate(() => {
  const root = document.querySelector('#player solad-video-skin')?.shadowRoot;
  const cont = root?.querySelector('media-container');
  const title = root?.querySelector('.media-title');
  if (!title) return null;
  const c = cont.getBoundingClientRect();
  const t = title.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(title);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0);
  const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--media-spacing)';
  cont.append(probe);
  const spacing = probe.getBoundingClientRect().width;
  probe.remove();
  const text = title.textContent.trim();
  return {
    text,
    padStart: parseFloat(getComputedStyle(title).paddingInlineStart),
    spacing,
    lines: tops.length,
    charsPerLine: tops.length ? Math.round(text.length / tops.length) : 0,
    textLeft: rects.length ? Math.round(Math.min(...rects.map((r) => r.left)) - c.left) : null,
    textRight: rects.length ? Math.round(Math.max(...rects.map((r) => r.right)) - c.left) : null,
    textBottom: rects.length ? Math.round(Math.max(...rects.map((r) => r.bottom)) - c.top) : null,
    barTop: (() => { const b = root.querySelector('.video-controls-primary > media-play-button')?.parentElement?.getBoundingClientRect(); return b ? Math.round(b.top - c.top) : null; })(),
    titleOverflowY: title.scrollHeight > title.clientHeight + 1,
    box: { left: Math.round(t.left - c.left), right: Math.round(t.right - c.left), w: Math.round(t.width) },
    overflowX: title.scrollWidth > title.clientWidth + 1,
    insideContainer: t.left >= c.left - 0.5 && t.right <= c.right + 0.5,
    textInside: rects.every((r) => r.left >= c.left - 0.5 && r.right <= c.right + 0.5),
  };
});

// Plays muted and looped so the controls can hide; logo changes keep the same video element.
const play = (page) => page.evaluate(async () => { const v = document.querySelector('#player video'); v.muted = true; v.loop = true; try { await v.play(); return !v.paused; } catch (e) { return String(e); } });

const result = { sizes: {} };
const browser = await launch();
for (const [W, H] of SIZES) {
  const context = await newContext(browser, { width: W, height: H });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { cases: [], checks: [] };
  const check = (label, ok, detail) => { r.checks.push({ label, ok, detail }); };
  try {
    await login(page);
    for (const w of WIDTHS) {
      await openDemo(page, `?logo=sample-png&logoWidth=${w}&logoPosition=top-left`);
      await sleep(1200);
      r.played = [...(r.played ?? []), await play(page)];
      for (const pos of CORNERS) {
        await page.locator(`input[name="logo-position"][value="${pos}"]`).check({ force: true });
        await sleep(500);
        for (const shown of [true, false]) {
          const reached = await waitControls(page, shown);
          const f = await logoFacts(page);
          const expected = Math.min(w, f.containerW / 4);
          const entry = { w, pos, controls: shown ? 'shown' : 'hidden', reached, containerW: f.containerW, drawn: f.slot?.rect.w, expected: Math.round(expected * 10) / 10, gap: f.slot?.gap, varWidth: f.slot?.vars.width, imgRendered: f.slot?.img?.rendered };
          if (pos === 'top-left' && shown) {
            const t = await titleFacts(page);
            entry.title = t;
            entry.titleExpected = t ? 12 + Math.min(w, f.containerW / 4) + t.spacing * 2 : null;
            await page.locator('#stage-view').screenshot({ path: `${EV}/F02/top-left-w${w}-${W}.png` });
          }
          r.cases.push(entry);
        }
      }
    }

    // A long title with no logo, then beside the widest logo.
    await openDemo(page, '');
    await page.locator('#title-text').fill(LONG);
    await page.locator('#title-text').dispatchEvent('change');
    await sleep(1200);
    await waitControls(page, true);
    r.longTitleNoLogo = { facts: await titleFacts(page) };
    await page.locator('#stage-view').screenshot({ path: `${EV}/F02/long-title-none-${W}.png` });
    for (const w of [24, 80]) {
      await openDemo(page, `?logo=sample-png&logoWidth=${w}&logoPosition=top-left`);
      await page.locator('#title-text').fill(LONG);
      await page.locator('#title-text').dispatchEvent('change');
      await sleep(1200);
      await waitControls(page, true);
      r[`longTitleW${w}`] = { facts: await titleFacts(page) };
    }

    await openDemo(page, `?logo=sample-png&logoWidth=240&logoPosition=top-left`);
    await page.locator('#title-text').fill(LONG);
    await page.locator('#title-text').dispatchEvent('change');
    await sleep(1200);
    await waitControls(page, true);
    r.longTitle = { facts: await titleFacts(page), logo: (await logoFacts(page)).slot?.rect };
    await page.locator('#stage-view').screenshot({ path: `${EV}/F02/long-title-w240-${W}.png` });

    if (W === 1280) {
      // hideWithControls, then hideDuringAds through the midroll, then the link's Tab order.
      await openDemo(page, `?logo=sample-png&logoWidth=120&logoPosition=bottom-left`);
      await sleep(1200);
      await page.locator('button.sa-toggle[data-key="loop"]').click();
      await sleep(1500);
      await play(page);
      const hw = {};
      await page.locator('button.sa-toggle[data-key="logoHideWithControls"]').click();
      await sleep(800);
      await waitControls(page, false);
      hw.hidden = (await logoFacts(page)).slot;
      await waitControls(page, true);
      hw.shown = (await logoFacts(page)).slot;
      await page.locator('button.sa-toggle[data-key="logoHideWithControls"]').click();
      await sleep(800);
      r.hideWithControls = { hidden: { opacity: hw.hidden?.opacity, visibility: hw.hidden?.visibility, attr: hw.hidden?.hideWithControls }, shown: { opacity: hw.shown?.opacity, visibility: hw.shown?.visibility } };

      const midroll = async () => {
        await page.locator('[data-scene="before-midroll"]').click();
        const end = Date.now() + 30000;
        while (Date.now() < end && !/미드롤 1\/1 재생 중/.test(await nowText(page))) await sleep(150);
        await sleep(1500);
        const f = await logoFacts(page);
        return { now: await nowText(page), adsOverlay: f.adsOverlay, opacity: f.slot?.opacity, visibility: f.slot?.visibility, attr: f.slot?.hideDuringAds };
      };
      r.hideDuringAds = { on: await midroll() };
      await page.locator('button.sa-toggle[data-key="logoHideDuringAds"]').click();
      await sleep(800);
      r.hideDuringAds.off = await midroll();

      await openDemo(page, `?logo=sample-svg&logoWidth=240&logoPosition=bottom-left&logoHref=${encodeURIComponent(LINK)}&logoAlt=DEMO+STORE`);
      await sleep(1500);
      await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button').focus());
      const tab = { shiftTabFromPlay: [] };
      for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); tab.shiftTabFromPlay.push(await deepActive(page)); }
      await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('a.solad-logo-link').focus());
      tab.tabFromLink = [await deepActive(page)];
      for (let i = 0; i < 2; i++) { await page.keyboard.press('Tab'); tab.tabFromLink.push(await deepActive(page)); }
      tab.slot = (await logoFacts(page)).slot?.rect;
      r.linkTab = tab;
    }

    for (const c of r.cases) {
      check(`${c.w} ${c.pos} ${c.controls} reached`, c.reached, String(c.reached));
      check(`${c.w} ${c.pos} ${c.controls} drawn`, Math.abs(c.drawn - c.expected) <= 0.6, `${c.drawn} vs ${c.expected}`);
      if (c.title) {
        check(`${c.w} top-left title padStart`, Math.abs(c.title.padStart - c.titleExpected) <= 0.6, `${c.title.padStart} vs ${c.titleExpected}`);
        check(`${c.w} top-left title fits`, !c.title.overflowX && c.title.insideContainer && c.title.textInside && c.title.lines <= 2, `lines ${c.title.lines}, overflow ${c.title.overflowX}`);
      }
    }
    r.overflow = await overflow(page);
  } catch (e) {
    r.error = String(e).slice(0, 1500);
    await page.screenshot({ path: `${EV}/F02/error-${W}.png`, fullPage: true }).catch(() => {});
  }
  r.events = req.events().length;
  r.api = req.actions();
  r.console = logs;
  r.failed = r.checks.filter((c) => !c.ok);
  result.sizes[`${W}x${H}`] = r;
  await context.close();
}
await browser.close();
save('F02/result.json', result);
for (const [k, r] of Object.entries(result.sizes)) console.log(k, 'checks', r.checks.length, 'failed', r.failed.length, r.error ?? '');
