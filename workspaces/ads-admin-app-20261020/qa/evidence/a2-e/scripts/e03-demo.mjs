// A2-E-QA E03 demo: the "컨트롤" group's 이전·이후 버튼 (first on 10, 5/15/30, off, on again keeps the last), the
// stage player (order play → back → forward, ±N per press, double tap value, labels hidden at narrow width, inert
// during an ad), the native preset's block with its reason and kept value, and the install code. Nothing is saved.
import { EV, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { openDemo, requestLog, demoState, waitPlayer } from './demo.mjs';

const NATIVE = 'p-pchm59hhyv';
const browser = await launch();
const result = { runs: [] };

// Skin facts read inside the stage player.
const skinFacts = (page) => page.evaluate(() => {
  const skin = document.querySelector('#player solad-video-skin, #player video-skin');
  const root = skin?.shadowRoot;
  if (!root) return { skin: skin?.localName ?? null };
  const primary = root.querySelector('.video-controls-primary');
  const chain = (el) => { const out = []; let n = el; while (n) { if (n.nodeType === 1 && (n.inert || n.hasAttribute('inert'))) out.push(`${n.localName}${n.id ? `#${n.id}` : ''}`); n = n.parentNode ?? n.host ?? null; } return out; };
  const seek = (id) => {
    const b = root.getElementById(id);
    if (!b) return null;
    const label = b.querySelector('.media-seek-button-label');
    const r = b.getBoundingClientRect();
    return { seconds: b.getAttribute('seconds'), ariaLabel: b.getAttribute('aria-label'), role: b.getAttribute('role'), tabIndex: b.tabIndex, labelText: label?.textContent, labelDisplay: label ? getComputedStyle(label).display : null, iconTransform: getComputedStyle(b.querySelector('svg')).transform, inert: chain(b), w: Math.round(r.width), visible: r.width > 0 && r.height > 0 };
  };
  const media = document.querySelector('#player video');
  return {
    skin: skin.localName,
    attrs: { seekButtons: skin.getAttribute('seek-buttons'), captions: skin.getAttribute('captions') },
    containerWidth: Math.round(root.querySelector('media-container')?.getBoundingClientRect().width ?? 0),
    primaryOrder: primary ? [...primary.children].filter((c) => c.localName !== 'media-tooltip').map((c) => `${c.localName}${c.id ? `#${c.id}` : ''}`) : null,
    backward: seek('solad-seek-backward'),
    forward: seek('solad-seek-forward'),
    gestures: [...root.querySelectorAll('media-gesture')].map((g) => Object.fromEntries([...g.attributes].map((a) => [a.name, a.value]))),
    hotkeys: [...root.querySelectorAll('media-hotkey')].map((h) => `${h.getAttribute('keys')}:${h.getAttribute('action')}${h.getAttribute('value') ? `=${h.getAttribute('value')}` : ''}`),
    adsOverlay: Boolean(root.querySelector('media-container > [data-ads-overlay]')) || Boolean(document.querySelector('#player [data-ads-overlay]')),
    t: media ? Math.round(media.currentTime * 100) / 100 : null,
    paused: media?.paused ?? null,
  };
});

const codeLines = (s) => ({ html: (s.codeHtml ?? '').split('\n').filter((l) => /seek|controls|captions/i.test(l)), js: (s.codeJs ?? '').split('\n').filter((l) => /seek|controls|captions/i.test(l)) });
const groupState = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id);
  const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  return {
    seek: { checked: $('seek').getAttribute('aria-checked'), disabled: $('seek').disabled, ariaDisabled: $('seek').getAttribute('aria-disabled'), describedBy: ($('seek').getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => text($(id))) },
    subHidden: $('seek-sub').hidden,
    step: document.querySelector('input[name="seek-step"]:checked')?.value ?? null,
    stepsDisabled: [...document.querySelectorAll('input[name="seek-step"]')].filter((r) => r.disabled).map((r) => r.value),
    offReason: $('off-c').hidden ? null : text($('off-c')),
    bodyOff: $('controls-body').classList.contains('sa-off-body'),
    query: location.search,
  };
});
async function settle(page) { await sleep(400); await waitPlayer(page); await sleep(900); }

for (const [w, h] of [[1280, 900], [390, 844]]) {
  const context = await newContext(browser, { width: w, height: h });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
  const run = { size: `${w}x${h}`, steps: [] };
  const step = async (label, extra = {}) => {
    const s = await demoState(page);
    run.steps.push({ label, group: await groupState(page), player: await skinFacts(page), code: codeLines(s), ...extra });
  };
  try {
    await login(page);
    await openDemo(page, '');
    await step('first open (default)');
    await page.locator('#seek').click();
    await settle(page);
    await step('switch on');
    if (w === 1280) await shot(page, 'E03/demo-seek-10-1280.png', { clip: await page.locator('#stage-view').boundingBox() });
    for (const v of ['5', '15', '30']) {
      await page.locator(`input[name="seek-step"][value="${v}"]`).check({ force: true });
      await settle(page);
      await step(`step ${v}`);
    }
    await page.locator('#seek').click();
    await settle(page);
    await step('switch off');
    await page.locator('#seek').click();
    await settle(page);
    await step('switch on again');
    // Reload the query for the round trip, then the native preset keeps the value but blocks the group.
    const q = await page.evaluate(() => location.search);
    await openDemo(page, q);
    await step('reload same query');
    await page.locator('#preset').selectOption(NATIVE);
    await settle(page);
    await step('native preset');
    if (w === 1280) await page.locator('fieldset.sa-optgrp', { has: page.locator('#off-c') }).screenshot({ path: `${EV}/E03/demo-native-block-1280.png` });
    await page.locator('#preset').selectOption('default');
    await settle(page);
    await step('back to default');

    // Player behaviour at 5 (the sample content is 10 s with the midroll at 5 s): order, inert during the midroll, then
    // ±5 per press in the content after it.
    await page.locator('input[name="seek-step"][value="5"]').check({ force: true });
    await settle(page);
    const p = (run.play = {});
    const nowText = async () => (await page.locator('#now').innerText().catch(() => '')).replace(/\s+/g, ' ');
    await page.locator('[data-scene="before-midroll"]').click();
    let end = Date.now() + 30000;
    while (Date.now() < end && !/미드롤 1\/1 재생 중/.test(await nowText())) await sleep(200);
    await sleep(1200);
    p.duringAd = await skinFacts(page);
    p.duringAdNow = await nowText();
    p.duringAdTab = [];
    await page.locator('#player').hover();
    await page.evaluate(() => document.querySelector('#player').focus?.());
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      p.duringAdTab.push(await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return `${a?.localName}${a?.id ? `#${a.id}` : ''} ${a?.getAttribute('aria-label') ?? a?.textContent?.trim().slice(0, 20) ?? ''}`; }));
    }
    p.clickDuringAd = await page.locator('#player #solad-seek-forward').click({ timeout: 2500 }).then(() => 'clicked').catch((e) => `not clickable: ${String(e).split('\n').filter((l) => /intercepts|inert|not visible|visible|enabled/.test(l)).slice(0, 2).join(' | ').slice(0, 300)}`);
    p.mainDuringAd = (await skinFacts(page)).t;
    await shot(page, `E03/demo-during-ad-${w}.png`, { clip: await page.locator('#stage-view').boundingBox() });
    end = Date.now() + 40000;
    while (Date.now() < end) { const f = await skinFacts(page); if (!f.paused && f.t > 5.6 && !/미드롤 1\/1 재생 중/.test(await nowText())) break; await sleep(150); }
    await page.evaluate(() => document.querySelector('#player video').pause());
    await sleep(500);
    p.afterAdNow = await nowText();
    p.before = await skinFacts(page);
    await page.locator('#player').hover();
    await sleep(400);
    await page.locator('#player #solad-seek-backward').click();
    await sleep(900);
    p.afterBackward = (await skinFacts(page)).t;
    p.nowAfterBackward = await nowText();
    await page.locator('#player #solad-seek-forward').click();
    await sleep(900);
    p.afterForward = (await skinFacts(page)).t;
    p.nowAfterForward = await nowText();
    if (w === 1280) await shot(page, 'E03/demo-seek-paused-1280.png', { clip: await page.locator('#stage-view').boundingBox() });
    p.tooltip = await page.evaluate(() => {
      const root = document.querySelector('#player solad-video-skin').shadowRoot;
      return [...root.querySelectorAll('media-tooltip')].filter((t) => /solad-seek/.test(t.getAttribute('trigger'))).map((t) => ({ trigger: t.getAttribute('trigger'), label: t.querySelector('media-tooltip-label')?.textContent.trim(), shortcut: t.querySelector('media-tooltip-shortcut')?.textContent.trim() }));
    });
    // Keyboard: Tab order from play in content.
    p.tabOrder = [await page.evaluate(() => { const b = document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button'); b.focus(); return b.getAttribute('aria-label'); })];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      p.tabOrder.push(await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return `${a?.localName}${a?.id ? `#${a.id}` : ''} ${a?.getAttribute('aria-label') ?? ''}`; }));
    }
    // Enter on the focused backward button.
    await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.getElementById('solad-seek-backward').focus());
    const tk = (await skinFacts(page)).t;
    await page.keyboard.press('Enter');
    await sleep(700);
    p.enterBackward = { before: tk, after: (await skinFacts(page)).t };
    run.overflow = await overflow(page);
  } catch (e) {
    run.error = String(e).slice(0, 1200);
    await shot(page, `E03/error-${w}.png`, { fullPage: true }).catch(() => {});
  }
  run.events = req.events().length;
  run.console = logs;
  run.bad = bad;
  result.runs.push(run);
  await context.close();
}

// Double tap with touch at 390: two quick taps in the right and left thirds while paused in content.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const d = (result.doubletap = {});
  try {
    await login(page);
    await openDemo(page, '?seekButtons=5');
    await page.locator('[data-scene="before-midroll"]').tap();
    const end = Date.now() + 45000;
    while (Date.now() < end) { const f = await skinFacts(page); if (f.t > 5.6 && !f.paused) break; await sleep(200); }
    await page.evaluate(() => document.querySelector('#player video').pause());
    await sleep(600);
    const box = await page.locator('#player').boundingBox();
    const tapTwice = async (x) => { await page.touchscreen.tap(x, box.y + box.height * 0.45); await sleep(120); await page.touchscreen.tap(x, box.y + box.height * 0.45); await sleep(900); };
    d.start = await skinFacts(page);
    await tapTwice(box.x + box.width * 0.15);
    d.afterLeft = (await skinFacts(page)).t;
    await tapTwice(box.x + box.width * 0.85);
    d.afterRight = (await skinFacts(page)).t;
    await shot(page, 'E03/doubletap-390.png', { clip: await page.locator('#stage-view').boundingBox() });
    d.gestures = d.start.gestures;
  } catch (e) { d.error = String(e).slice(0, 800); }
  await context.close();
}

save('E03/demo.json', result);
await browser.close();
