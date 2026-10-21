// A2-E-QA E05 part A at the width in argv (1280 or 390): the demo logo group with no image, then SVG and PNG in four
// corners with the controls shown and hidden (margin, width, opacity, the bottom rise, the top-right drop below 32rem,
// the title beside a top-left logo), number fields and their range errors, hideWithControls, hideDuringAds on and off
// during the midroll, and whether logo-only changes keep the same video element and position. Loop is on so the
// content keeps playing after the midroll. Nothing is saved.
import { EV, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { openDemo, requestLog, waitPlayer } from './demo.mjs';
import { logoFacts, groupState, waitControls, setField, tagVideo, nowText } from './e05-lib.mjs';

const W = Number(process.argv[2] ?? 1280);
const H = W === 390 ? 844 : 900;
const browser = await launch();
const context = await newContext(browser, { width: W, height: H });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { size: `${W}x${H}`, steps: [] };
const record = async (label, extra = {}) => {
  const entry = { label, facts: await logoFacts(page), ...extra };
  result.steps.push(entry);
  return entry;
};
const stage = async () => page.locator('#stage-view').boundingBox();
const settle = async () => { await sleep(400); await waitPlayer(page); await sleep(900); };

async function midrollAgain() {
  await page.locator('[data-scene="before-midroll"]').click();
  const end = Date.now() + 30000;
  while (Date.now() < end && !/미드롤 1\/1 재생 중/.test(await nowText(page))) await sleep(150);
  await sleep(1500);
}
async function afterMidroll() {
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    const f = await logoFacts(page);
    if (!f.adsOverlay && !f.paused && f.t > 5.5) return true;
    await sleep(200);
  }
  return false;
}

try {
  await login(page);
  await openDemo(page, '');
  result.none = { group: await groupState(page), facts: await logoFacts(page) };
  await page.locator('fieldset.sa-optgrp', { has: page.locator('#logo-img') }).screenshot({ path: `${EV}/E05/group-none-${W}.png` });
  await page.locator('button.sa-toggle[data-key="loop"]').click();
  await settle();
  await midrollAgain();
  result.duringMidrollNoLogo = await logoFacts(page);
  await afterMidroll();
  await tagVideo(page, 'A');

  // SVG, default layout.
  await page.locator('#logo-img').selectOption('sample-svg');
  await sleep(1200);
  await record('svg default', { group: await groupState(page) });
  await page.locator('fieldset.sa-optgrp', { has: page.locator('#logo-img') }).screenshot({ path: `${EV}/E05/group-svg-${W}.png` });

  for (const pos of ['top-right', 'top-left', 'bottom-left', 'bottom-right']) {
    await page.locator(`input[name="logo-position"][value="${pos}"]`).check({ force: true });
    await sleep(600);
    const shown = await waitControls(page, true);
    await record(`svg ${pos} controls shown`, { reached: shown, positionNow: (await groupState(page)).positionNow });
    await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/svg-${pos}-shown-${W}.png`}` });
    const hidden = await waitControls(page, false);
    await record(`svg ${pos} controls hidden`, { reached: hidden });
    await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/svg-${pos}-hidden-${W}.png`}` });
  }

  // PNG at the last corner, then top-right.
  await page.locator('#logo-img').selectOption('sample-png');
  await sleep(1200);
  await waitControls(page, true);
  await record('png bottom-right shown');
  await page.locator('input[name="logo-position"][value="top-right"]').check({ force: true });
  await sleep(600);
  await waitControls(page, false);
  await record('png top-right hidden');
  await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/png-top-right-${W}.png`}` });

  // Numbers.
  await setField(page, 'logo-w', '120');
  await setField(page, 'logo-op', '50');
  await setField(page, 'logo-m', '24');
  await waitControls(page, false);
  await record('png w120 op50 m24', { group: await groupState(page) });
  await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/png-w120-op50-m24-${W}.png`}` });
  const ranges = {};
  for (const [id, bad] of [['logo-w', '300'], ['logo-w', '23'], ['logo-op', '5'], ['logo-m', '49'], ['logo-w', '80.5']]) {
    await setField(page, id, bad);
    const g = await groupState(page);
    ranges[`${id}=${bad}`] = { field: g[id.replace('logo-', '')], query: g.query, applied: (await logoFacts(page)).slot?.vars };
  }
  result.ranges = ranges;
  await page.locator('fieldset.sa-optgrp', { has: page.locator('#logo-img') }).screenshot({ path: `${EV}/E05/group-range-error-${W}.png` });
  await setField(page, 'logo-w', '120');
  await setField(page, 'logo-op', '50');
  await setField(page, 'logo-m', '24');

  // Title beside a top-left logo.
  await page.locator('input[name="logo-position"][value="top-left"]').check({ force: true });
  await sleep(600);
  await waitControls(page, true);
  await record('png top-left title', {});
  await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/png-top-left-title-${W}.png`}` });

  // hideWithControls.
  await page.locator('button.sa-toggle[data-key="logoHideWithControls"]').click();
  await sleep(800);
  await waitControls(page, false);
  await record('hideWithControls on, hidden');
  await waitControls(page, true);
  await record('hideWithControls on, shown');
  await page.locator('button.sa-toggle[data-key="logoHideWithControls"]').click();
  await sleep(800);
  result.rebuild = { tagAfterLogoChanges: (await logoFacts(page)).videoTag, steps: result.steps.map((s) => `${s.label}: tag ${s.facts.videoTag} t ${s.facts.t}`) };

  // hideDuringAds on (default) then off, each through the midroll (the scene remounts the player).
  await midrollAgain();
  await record('midroll, hideDuringAds on', { now: await nowText(page) });
  await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/midroll-hide-on-${W}.png`}` });
  await afterMidroll();
  await record('after midroll, hideDuringAds on', { now: await nowText(page) });
  await page.locator('button.sa-toggle[data-key="logoHideDuringAds"]').click();
  await sleep(800);
  await midrollAgain();
  await record('midroll, hideDuringAds off', { now: await nowText(page) });
  await page.locator('#stage-view').screenshot({ path: `${EV}/${`E05/midroll-hide-off-${W}.png`}` });
  result.finalGroup = await groupState(page);
  result.overflow = await overflow(page);
} catch (e) {
  result.error = String(e).slice(0, 1500);
  await shot(page, `E05/a-error-${W}.png`, { fullPage: true }).catch(() => {});
}
result.events = req.events().length;
result.console = logs;
await context.close();
save(`E05/a-${W}.json`, result);
await browser.close();
