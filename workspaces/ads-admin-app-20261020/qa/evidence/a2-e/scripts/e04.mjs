// A2-E-QA E04 captions in the demo at 1280 and 390: on without a track ("자막 없음", aria-disabled, focusable, no effect
// on press or c; hidden below 32rem), the four player languages, off (no button, menu item, c hotkey or Tab stop), the
// sample track (kind, srclang, label, off at first, toggled by the button and c, a frame log of the button's name while
// the player rebuilds), the .vtt response and the install code's data-captions. Nothing is saved.
import { launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { openDemo, requestLog, demoState, waitPlayer } from './demo.mjs';

const browser = await launch();
const result = { runs: [] };

const facts = (page) => page.evaluate(() => {
  const skin = document.querySelector('#player solad-video-skin, #player video-skin');
  const root = skin?.shadowRoot;
  const media = document.querySelector('#player video');
  if (!root) return { skin: skin?.localName ?? null };
  const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const buttons = [...root.querySelectorAll('media-captions-button')].map((b) => {
    const s = getComputedStyle(b);
    const tip = [...root.querySelectorAll('media-tooltip')].find((t) => t.getAttribute('trigger') === b.id);
    return { id: b.id, hiddenAttr: b.hasAttribute('hidden'), availability: b.getAttribute('data-availability'), ariaDisabled: b.getAttribute('aria-disabled'), ariaLabel: b.getAttribute('aria-label'), ariaPressed: b.getAttribute('aria-pressed'), tabIndex: b.tabIndex, display: s.display, w: Math.round(b.getBoundingClientRect().width), tipLabel: text(tip?.querySelector('media-tooltip-label')), tipShortcut: text(tip?.querySelector('media-tooltip-shortcut')), tipShortcutDisplay: tip?.querySelector('media-tooltip-shortcut') ? getComputedStyle(tip.querySelector('media-tooltip-shortcut')).display : null };
  });
  return {
    skin: skin.localName,
    lang: skin.closest('media-i18n')?.getAttribute('lang') ?? document.querySelector('#player media-i18n')?.getAttribute('lang') ?? null,
    captionsAttr: skin.getAttribute('captions'),
    containerWidth: Math.round(root.querySelector('media-container')?.getBoundingClientRect().width ?? 0),
    buttons,
    menuItems: [...root.querySelectorAll('media-menu-item')].map((m) => text(m)).filter(Boolean),
    menuCaptionTokens: [...root.querySelectorAll('media-menu-item media-text[token="menu.captions"]')].length,
    captionsHotkeys: [...root.querySelectorAll('media-hotkey')].filter((h) => /subtitle|caption/i.test(h.getAttribute('action') ?? '')).map((h) => `${h.getAttribute('keys')}:${h.getAttribute('action')}`),
    tracks: media ? [...media.querySelectorAll('track')].map((t) => ({ kind: t.kind, srclang: t.srclang, label: t.label, src: t.getAttribute('src'), default: t.default, readyState: t.readyState })) : null,
    textTracks: media ? [...media.textTracks].map((t) => ({ kind: t.kind, label: t.label, language: t.language, mode: t.mode, activeCue: t.activeCues?.[0]?.text ?? null })) : null,
    t: media ? Math.round(media.currentTime * 100) / 100 : null,
  };
});
const activeName = (page) => page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return `${a?.localName}${a?.id ? `#${a.id}` : ''} ${a?.getAttribute('aria-label') ?? ''}`.trim(); });
const tabFromPlay = async (page, n = 8) => {
  const out = [await page.evaluate(() => { const b = document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button'); b.focus(); return b.getAttribute('aria-label'); })];
  for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); out.push(await activeName(page)); }
  return out;
};
const focusPlay = (page) => page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button').focus());
const settle = async (page) => { await sleep(400); await waitPlayer(page); await sleep(1000); };
const controlsClip = async (page) => {
  const box = await page.locator('#player').boundingBox();
  return { x: box.x, y: box.y + box.height - 70, width: box.width, height: 70 };
};

for (const [w, h] of [[1280, 900], [390, 844]]) {
  const context = await newContext(browser, { width: w, height: h });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
  const run = { size: `${w}x${h}` };
  try {
    await login(page);
    // 1. On, no track.
    await openDemo(page, '');
    const n = (run.noTrack = {});
    n.facts = await facts(page);
    n.group = await page.evaluate(() => { const b = document.querySelector('button.sa-toggle[data-key="captions"]'); return { checked: b.getAttribute('aria-checked'), url: document.getElementById('cc-url').value }; });
    await page.locator('#player').hover();
    await sleep(500);
    await shot(page, `E04/no-track-controls-${w}.png`, { clip: await controlsClip(page) });
    n.tab = await tabFromPlay(page);
    if (n.facts.buttons[0]?.display !== 'none') {
      await page.locator('#player media-captions-button').hover();
      await sleep(700);
      n.tooltipShown = await page.evaluate(() => { const r = document.querySelector('#player solad-video-skin').shadowRoot; const t = [...r.querySelectorAll('media-tooltip')].find((x) => x.getAttribute('trigger') === r.querySelector('media-captions-button').id); return t ? { open: t.matches(':popover-open') || t.hasAttribute('data-open'), text: t.textContent.replace(/\s+/g, ' ').trim() } : null; });
      await shot(page, `E04/no-track-tooltip-${w}.png`, { clip: await page.locator('#stage-view').boundingBox() });
      await page.locator('#player media-captions-button').click({ force: true });
      await sleep(500);
      n.afterClick = await facts(page);
      await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('media-captions-button').focus());
      await page.keyboard.press('Enter');
      await sleep(400);
      n.afterEnter = (await facts(page)).buttons;
    }
    await focusPlay(page);
    await page.keyboard.press('c');
    await sleep(500);
    n.afterC = (await facts(page)).buttons;
    if (w === 1280) {
      n.langs = {};
      for (const lang of ['en', 'ja', 'zh-CN', 'ko']) {
        await page.locator('#lang').selectOption(lang);
        await settle(page);
        const f = await facts(page);
        n.langs[lang] = { lang: f.lang, button: f.buttons.map((b) => `${b.ariaLabel} | tip ${b.tipLabel} | shortcut "${b.tipShortcut}" ${b.tipShortcutDisplay}`) };
        await page.locator('#player').hover();
        await page.locator('#player media-captions-button').hover();
        await sleep(600);
        await shot(page, `E04/no-track-${lang}-1280.png`, { clip: await page.locator('#stage-view').boundingBox() });
      }
      await page.locator('#lang').selectOption('');
      await settle(page);
    }

    // 2. Off.
    await page.locator('button.sa-toggle[data-key="captions"]').click();
    await settle(page);
    const o = (run.off = {});
    o.query = await page.evaluate(() => location.search);
    o.facts = await facts(page);
    o.tab = await tabFromPlay(page);
    await focusPlay(page);
    await page.keyboard.press('c');
    await sleep(400);
    o.afterC = (await facts(page)).textTracks;
    await page.locator('#player').hover();
    await sleep(400);
    await shot(page, `E04/off-controls-${w}.png`, { clip: await controlsClip(page) });
    // Settings menu items while off.
    const settings = page.locator('#player media-menu-trigger, #player [aria-haspopup="menu"]').first();
    o.settingsButton = await settings.count();
    if (o.settingsButton) {
      await settings.click({ force: true }).catch(() => {});
      await sleep(600);
      o.menuOpen = await page.evaluate(() => [...document.querySelector('#player solad-video-skin').shadowRoot.querySelectorAll('media-menu-item')].filter((m) => m.getClientRects().length).map((m) => m.textContent.replace(/\s+/g, ' ').trim()));
      await shot(page, `E04/off-menu-${w}.png`, { clip: await page.locator('#stage-view').boundingBox() });
      await page.keyboard.press('Escape');
    }
    // Back on, then the sample track with a per-frame log of the button while the player rebuilds.
    await page.locator('button.sa-toggle[data-key="captions"]').click();
    await settle(page);
    const s = (run.sample = {});
    s.onMenu = await page.evaluate(() => [...document.querySelector('#player solad-video-skin').shadowRoot.querySelectorAll('media-menu-item')].map((m) => m.textContent.replace(/\s+/g, ' ').trim()));
    await page.evaluate(() => {
      const log = (window.__ccLog = []);
      const t0 = performance.now();
      let last = '';
      const tick = () => {
        const skin = document.querySelector('#player solad-video-skin');
        const b = skin?.shadowRoot?.querySelector('media-captions-button');
        const v = b ? `${b.getAttribute('aria-label')}|${b.getAttribute('data-availability')}|${getComputedStyle(b).display}` : skin ? 'no button' : 'no skin';
        if (v !== last) { log.push(`${Math.round(performance.now() - t0)}ms ${v}`); last = v; }
        if (performance.now() - t0 < 6000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.locator('#cc-fill').click();
    await settle(page);
    await sleep(3500);
    s.frameLog = await page.evaluate(() => window.__ccLog);
    s.url = await page.locator('#cc-url').inputValue();
    s.query = await page.evaluate(() => location.search);
    s.facts = await facts(page);
    const st = await demoState(page);
    s.code = { html: (st.codeHtml ?? '').split('\n').filter((l) => /captions/.test(l)), js: (st.codeJs ?? '').split('\n').filter((l) => /captions/.test(l)) };
    s.tab = await tabFromPlay(page);
    if (s.facts.buttons[0]?.display !== 'none') {
      await page.locator('#player').hover();
      await page.locator('#player media-captions-button').click();
      await sleep(600);
      s.afterClickOn = await facts(page);
      await page.locator('#player media-captions-button').click();
      await sleep(600);
      s.afterClickOff = (await facts(page)).textTracks;
    }
    await focusPlay(page);
    await page.keyboard.press('c');
    await sleep(600);
    s.afterCOn = (await facts(page)).textTracks;
    // Play into the content with captions on (scene 미드롤 앞 starts near 2 s; cue 2 runs 3.2–6.0 s).
    await page.locator('[data-scene="before-midroll"]').click();
    const end = Date.now() + 25000;
    while (Date.now() < end) { const f = await facts(page); if ((f.t ?? 0) > 3.5) break; await sleep(150); }
    await page.evaluate(() => document.querySelector('#player video').pause());
    await sleep(600);
    s.playing = await facts(page);
    await shot(page, `E04/sample-cue-${w}.png`, { clip: await page.locator('#stage-view').boundingBox() });
    await focusPlay(page);
    await page.keyboard.press('c');
    await sleep(600);
    s.afterCOff = (await facts(page)).textTracks;
    // Off with a URL: what the loader does with the track.
    await page.locator('button.sa-toggle[data-key="captions"]').click();
    await settle(page);
    s.offWithUrl = await facts(page);
    s.offWithUrlCode = (await demoState(page)).codeHtml?.split('\n').filter((l) => /captions/.test(l));
    run.vtt = await page.evaluate(async (u) => { const r = await fetch(u); const t = await r.text(); return { status: r.status, type: r.headers.get('content-type'), firstLine: t.split('\n')[0], cues: (t.match(/-->/g) ?? []).length }; }, s.url);
    run.overflow = await overflow(page);
  } catch (e) {
    run.error = String(e).slice(0, 1200);
    await shot(page, `E04/error-${w}.png`, { fullPage: true }).catch(() => {});
  }
  run.events = req.events().length;
  run.console = logs;
  run.bad = bad;
  result.runs.push(run);
  await context.close();
}

save('E04/result.json', result);
await browser.close();
