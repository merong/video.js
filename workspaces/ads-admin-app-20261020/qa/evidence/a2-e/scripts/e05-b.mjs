// A2-E-QA E05 part B at the width in argv: the logo link (href, target, rel, accessible name in four player
// languages, Tab order against the controls, focus ring, the new tab and its opener, the video left paused), the
// decorative image (alt "", pointer-events, a click at the logo reaches the player as it does without a logo), a link
// without alt, a broken image, a custom address and a relative one, "없음" and the native preset blocking with values
// kept, the query round trip and invalid query values, the install code, and the logo against the flat/default/rounded
// corners. Nothing is saved.
import { BASE, EV, launch, newContext, login, consoleCollector, save, sleep } from './lib.mjs';
import { openDemo, requestLog, waitPlayer } from './demo.mjs';
import { logoFacts, groupState, waitControls, setField, deepActive } from './e05-lib.mjs';

const W = Number(process.argv[2] ?? 1280);
const H = W === 390 ? 844 : 900;
const NATIVE = 'p-pchm59hhyv';
const LINK = `${BASE}/examples/guide.html`;
const browser = await launch();
const context = await newContext(browser, { width: W, height: H });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { size: `${W}x${H}` };
const stageShot = (name) => page.locator('#stage-view').screenshot({ path: `${EV}/E05/${name}-${W}.png` });
const groupShot = (name) => page.locator('fieldset.sa-optgrp', { has: page.locator('#logo-img') }).screenshot({ path: `${EV}/E05/${name}-${W}.png` });
const settle = async () => { await sleep(400); await waitPlayer(page); await sleep(1000); };
const linkName = async () => {
  const link = page.locator('#player a.solad-logo-link');
  if (!(await link.count())) return null;
  return (await link.ariaSnapshot()).split('\n')[0];
};
// Only the steps named in argv[3] (comma list) run when it is given; a step that loses its page context is tried again
// once, and the retry is recorded.
const ONLY = process.argv[3]?.split(',');
const step = async (label, fn) => {
  if (ONLY && !ONLY.includes(label)) return;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { result[label] = await fn(); if (attempt > 1) result[label].attempt = attempt; return; } catch (e) {
      result[label] = { error: String(e).slice(0, 600), attempt };
      if (!/Execution context was destroyed/.test(String(e))) return;
    }
  }
};

await login(page);

await step('link', async () => {
  const out = {};
  await openDemo(page, `?logo=sample-svg&logoPosition=bottom-left&logoHref=${encodeURIComponent(LINK)}&logoAlt=DEMO+STORE`);
  await sleep(1500);
  out.group = await groupState(page);
  out.facts = await logoFacts(page);
  out.name = await linkName();
  out.langs = {};
  for (const lang of ['en', 'ja', 'zh-CN', 'ko']) {
    await page.locator('#lang').selectOption(lang);
    await settle();
    out.langs[lang] = { name: await linkName(), tail: (await logoFacts(page)).slot?.link?.tail };
  }
  await page.locator('#lang').selectOption('');
  await settle();
  // Tab order: from the element before the player into the player, and Shift+Tab from the play button.
  await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button').focus());
  out.shiftTabFromPlay = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); out.shiftTabFromPlay.push(await deepActive(page)); }
  await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('a.solad-logo-link').focus());
  out.tabFromLink = [await deepActive(page)];
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Tab'); out.tabFromLink.push(await deepActive(page)); }
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  out.focusedLink = await deepActive(page);
  await sleep(400);
  out.focusRing = (await logoFacts(page)).slot?.link?.outline;
  out.focusVisible = await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('a.solad-logo-link').matches(':focus-visible'));
  await stageShot('link-focus');
  // Click: a new tab with no opener, and the stage video stays as it was.
  const pausedBefore = await page.evaluate(() => document.querySelector('#player video').paused);
  const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 8000 }), page.locator('#player a.solad-logo-link').click()]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  out.popup = { url: popup.url().replace(BASE, ''), opener: await popup.evaluate(() => window.opener === null ? 'null' : 'set') };
  await popup.close();
  out.pausedBefore = pausedBefore;
  out.pausedAfter = await page.evaluate(() => document.querySelector('#player video').paused);
  return out;
});

await step('decorative', async () => {
  const out = {};
  await openDemo(page, '?logo=sample-png&logoPosition=bottom-left&logoWidth=120');
  await sleep(800);
  out.facts = await logoFacts(page);
  const box = await page.evaluate(() => { const s = document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.solad-logo').getBoundingClientRect(); return { x: s.x + s.width / 2, y: s.y + s.height / 2 }; });
  out.at = await page.evaluate(({ x, y }) => { let el = document.elementFromPoint(x, y); while (el?.shadowRoot) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner; } return `${el?.localName}${el?.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`; }, box);
  out.inTab = await page.evaluate(() => [...document.querySelector('#player solad-video-skin').shadowRoot.querySelectorAll('.solad-logo a, .solad-logo [tabindex]')].length);
  const hook = () => page.evaluate(() => { window.__qaHits = []; const root = document.querySelector('#player solad-video-skin').shadowRoot; root.addEventListener('pointerup', (e) => window.__qaHits.push(e.composedPath()[0].localName + (typeof e.composedPath()[0].className === 'string' && e.composedPath()[0].className ? '.' + e.composedPath()[0].className.split(' ')[0] : '')), true); });
  await hook();
  const paused0 = await page.evaluate(() => document.querySelector('#player video').paused);
  await page.mouse.click(box.x, box.y);
  await sleep(1500);
  out.clickWithLogo = { hits: await page.evaluate(() => window.__qaHits), pausedBefore: paused0, pausedAfter: await page.evaluate(() => document.querySelector('#player video').paused), adsOverlay: (await logoFacts(page)).adsOverlay };
  // The same point without a logo.
  await openDemo(page, '');
  await sleep(800);
  await hook();
  const paused1 = await page.evaluate(() => document.querySelector('#player video').paused);
  await page.mouse.click(box.x, box.y);
  await sleep(1500);
  out.clickWithoutLogo = { hits: await page.evaluate(() => window.__qaHits), pausedBefore: paused1, pausedAfter: await page.evaluate(() => document.querySelector('#player video').paused), adsOverlay: (await logoFacts(page)).adsOverlay };
  return out;
});

await step('linkNoAlt', async () => {
  const out = {};
  await openDemo(page, '?logo=sample-svg');
  await setField(page, 'logo-href', LINK);
  await settle();
  out.group = await groupState(page);
  out.facts = await logoFacts(page);
  await groupShot('link-no-alt');
  await stageShot('link-no-alt-player');
  await setField(page, 'logo-href', 'javascript:alert(1)');
  out.badHref = (await groupState(page)).href;
  await setField(page, 'logo-href', 'example.com');
  out.relHref = (await groupState(page)).href;
  return out;
});

await step('images', async () => {
  const out = {};
  await openDemo(page, '?logo=sample-svg');
  await page.locator('#logo-img').selectOption('custom');
  await sleep(800);
  out.customEmpty = { group: await groupState(page), facts: (await logoFacts(page)).slot };
  await setField(page, 'logo-url', '/examples/no-such-logo.png');
  await sleep(1500);
  out.broken = { group: await groupState(page), imgHelpClass: (await groupState(page)).imgHelpClass, facts: (await logoFacts(page)).slot };
  await groupShot('broken-image');
  await stageShot('broken-image-player');
  await setField(page, 'logo-url', '/examples/sample-logo.png');
  await sleep(3000);
  out.customOk = { group: await groupState(page), imgHelpClass: (await groupState(page)).imgHelpClass, facts: (await logoFacts(page)).slot };
  await groupShot('custom-ok-after-broken');
  await setField(page, 'logo-w', '96');
  await sleep(1500);
  out.customOkAfterOtherChange = { imgHelp: (await groupState(page)).img.help, imgHelpClass: (await groupState(page)).imgHelpClass };
  await setField(page, 'logo-w', '80');
  await setField(page, 'logo-url', 'images/logo.png');
  await sleep(600);
  out.relative = { url: (await groupState(page)).url, query: (await groupState(page)).query, src: (await logoFacts(page)).slot?.img?.src };
  await setField(page, 'logo-url', 'sample-svg');
  out.sampleIdTyped = { url: (await groupState(page)).url, query: (await groupState(page)).query };
  // Back to a sample and to custom: the last address comes back.
  await page.locator('#logo-img').selectOption('sample-png');
  await sleep(600);
  await page.locator('#logo-img').selectOption('custom');
  await sleep(800);
  out.customAgain = { url: (await groupState(page)).url.value, query: (await groupState(page)).query };
  return out;
});

await step('blocking', async () => {
  const out = {};
  await openDemo(page, `?logo=sample-png&logoPosition=bottom-right&logoWidth=120&logoOpacity=50&logoMargin=24&logoHref=${encodeURIComponent(LINK)}&logoAlt=QA&logoHideWithControls=true`);
  await sleep(800);
  out.start = await groupState(page);
  await page.locator('#logo-img').selectOption('');
  await settle();
  out.none = { group: await groupState(page), slot: (await logoFacts(page)).slot };
  await groupShot('group-none-kept');
  await page.locator('#logo-img').selectOption('sample-png');
  await settle();
  out.back = await groupState(page);
  await page.locator('#preset').selectOption(NATIVE);
  await settle();
  out.native = { group: await groupState(page), facts: await logoFacts(page) };
  await groupShot('group-native');
  await page.locator('#preset').selectOption('default');
  await settle();
  out.afterNative = { group: await groupState(page), slot: (await logoFacts(page)).slot };
  return out;
});

await step('roundTrip', async () => {
  const out = {};
  await openDemo(page, '');
  await page.locator('#logo-img').selectOption('sample-png');
  await sleep(600);
  await page.locator('input[name="logo-position"][value="bottom-left"]').check({ force: true });
  await setField(page, 'logo-w', '64');
  await setField(page, 'logo-op', '90');
  await setField(page, 'logo-m', '8');
  await setField(page, 'logo-href', LINK);
  await setField(page, 'logo-alt', 'QA 로고');
  await page.locator('button.sa-toggle[data-key="logoHideDuringAds"]').click();
  await page.locator('button.sa-toggle[data-key="logoHideWithControls"]').click();
  await settle();
  const a = await groupState(page);
  const fa = await logoFacts(page);
  const url = page.url();
  const tab = await context.newPage();
  await tab.goto(url);
  await tab.locator('#preset option').first().waitFor({ state: 'attached' });
  await sleep(2500);
  const b = await groupState(tab);
  const fb = await logoFacts(tab);
  const pick = (g) => ({ query: g.query, img: g.img.value, position: g.position, w: g.w.value, op: g.op.value, m: g.m.value, href: g.href.value, alt: g.alt.value, hda: g.hideDuringAds.checked, hwc: g.hideWithControls.checked });
  const slot = (f) => f.slot && { position: f.slot.position, vars: f.slot.vars, hda: f.slot.hideDuringAds, hwc: f.slot.hideWithControls, link: f.slot.link?.href, alt: f.slot.img?.alt };
  out.first = { group: pick(a), slot: slot(fa) };
  out.newTab = { group: pick(b), slot: slot(fb) };
  out.same = JSON.stringify(out.first) === JSON.stringify(out.newTab);
  await tab.goto(`${BASE}/examples/index.html?logo=evil.png&logoPosition=middle&logoWidth=999&logoOpacity=5&logoMargin=-1&logoHref=javascript%3Aalert(1)&logoAlt=${'x'.repeat(81)}&logoHideDuringAds=maybe`);
  await tab.locator('#preset option').first().waitFor({ state: 'attached' });
  await sleep(2500);
  out.invalid = { group: await groupState(tab), slot: (await logoFacts(tab)).slot };
  await tab.locator('#query-note').screenshot({ path: `${EV}/E05/query-note-invalid-${W}.png` }).catch(() => {});
  await tab.close();
  return out;
});

await step('code', async () => {
  const out = {};
  await openDemo(page, '');
  out.none = { cdLogo: (await groupState(page)).cdLogo, hasLogo: (await groupState(page)).codeHasLogo };
  await page.locator('#logo-img').selectOption('sample-svg');
  await settle();
  const s = await groupState(page);
  out.svg = { cdLogo: s.cdLogo, hasLogo: s.codeHasLogo, html: await page.locator('#code-html code').textContent(), js: await page.locator('#code-js code').textContent() };
  await page.locator('#cd-logo').screenshot({ path: `${EV}/E05/code-logo-note-${W}.png` });
  return out;
});

await step('corners', async () => {
  const out = {};
  for (const preset of ['flat', 'default', 'rounded']) {
    for (const m of ['0', '12']) {
      await openDemo(page, `?preset=${preset}&logo=sample-png&logoPosition=top-left&logoMargin=${m}`);
      await sleep(800);
      const f = await logoFacts(page);
      out[`${preset}-m${m}`] = { radius: f.radius, gap: f.slot?.gap };
      await page.locator('#stage-view').screenshot({ path: `${EV}/E05/corner-${preset}-m${m}-${W}.png`, clip: undefined });
    }
  }
  return out;
});

result.events = req.events().length;
result.console = logs;
await context.close();
save(`E05/b-${W}${ONLY ? `-${ONLY.join('-')}` : ''}.json`, result);
await browser.close();
