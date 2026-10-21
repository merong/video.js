// A2-E-QA-DELTA F03 (A2E-03) at the width in argv (1280 or 390): the logo failure note under the image choice. A wrong
// address, then a right one (the original help must come back in the same render: read in the same task as the change
// event), wrong again, "없음", sample PNG, custom address, the native preset. Then the late change of the hidden address
// field: typing an address and choosing "없음" without Tab or Enter must keep "없음". Nothing is saved.
import { EV, launch, newContext, login, consoleCollector, save, sleep, overflow } from './lib.mjs';
import { openDemo, requestLog, waitPlayer } from './demo.mjs';
import { groupState, logoFacts } from './e05-lib.mjs';

const W = Number(process.argv[2] ?? 1280);
const H = W === 390 ? 844 : 900;
const NATIVE = 'p-pchm59hhyv';
const WRONG = '/examples/no-such-logo.png';
const RIGHT = '/examples/sample-logo.png';
const FAILED = '이미지를 불러오지 못해';
const browser = await launch();
const context = await newContext(browser, { width: W, height: H });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { size: `${W}x${H}`, steps: [], late: {} };

// The image help right after a change, read inside the same task that dispatched it.
const help = () => {
  const h = document.getElementById('logo-img-h');
  return { text: h.textContent.trim(), warn: h.closest('.sa-field').classList.contains('is-warn') };
};
const changeUrl = (value) => page.evaluate(([value, helpSrc]) => {
  const help = new Function(`return (${helpSrc})()`);
  const input = document.getElementById('logo-url');
  const before = help();
  const t0 = performance.now();
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { before, sameTask: help(), ms: Math.round((performance.now() - t0) * 10) / 10 };
}, [value, help.toString()]);
const changeSelect = (value) => page.evaluate(([value, helpSrc]) => {
  const help = new Function(`return (${helpSrc})()`);
  const select = document.getElementById('logo-img');
  const before = help();
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return { before, sameTask: help() };
}, [value, help.toString()]);
const helpNow = () => page.evaluate(help);
async function waitHelp(re, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const h = await helpNow();
    if (re.test(h.text)) return { ...h, waitedMs: Date.now() - t0 };
    await sleep(100);
  }
  return { ...(await helpNow()), waitedMs: null };
}
const record = async (label, extra) => {
  await sleep(1200);
  const g = await groupState(page);
  const f = await logoFacts(page);
  const entry = { label, ...extra, after: await helpNow(), query: g.query, img: g.img?.value, imgDisabled: g.img?.disabled, offReason: g.offReason, nativeReason: g.nativeReason, urlShown: g.urlShown, url: g.url?.value, slot: f.slot ? { hidden: f.slot.hidden, src: f.slot.img?.src, complete: f.slot.img?.complete, natural: f.slot.img?.natural } : null, skin: f.skin };
  result.steps.push(entry);
  return entry;
};
const groupShot = (name) => page.locator('fieldset.sa-optgrp', { has: page.locator('#logo-img') }).screenshot({ path: `${EV}/F03/${name}-${W}.png` });

try {
  await login(page);
  await openDemo(page, '');
  result.originalHelp = await helpNow();

  await page.locator('#logo-img').selectOption('custom');
  await sleep(500);
  await record('custom chosen (empty address)', {});
  await record('1 wrong address', { change: await changeUrl(WRONG), failed: await waitHelp(new RegExp(FAILED)) });
  await groupShot('1-wrong');
  await record('2 right address', { change: await changeUrl(RIGHT) });
  await groupShot('2-right');
  await record('3 wrong again', { change: await changeUrl(WRONG), failed: await waitHelp(new RegExp(FAILED)) });
  await record('4 없음', { change: await changeSelect('') });
  await groupShot('4-none');
  await record('5 sample PNG', { change: await changeSelect('sample-png') });
  await record('6 custom again (last address)', { change: await changeSelect('custom'), failed: await waitHelp(new RegExp(FAILED)) });
  await groupShot('6-custom-again');
  await page.locator('#preset').selectOption(NATIVE);
  await sleep(800);
  await waitPlayer(page);
  await record('7 native preset', {});
  await groupShot('7-native');

  // Late change, a: type, then choose "없음" with the address field still focused (no Tab/Enter), then blur.
  await openDemo(page, '?logo=sample-png');
  await page.locator('#logo-img').selectOption('custom');
  await sleep(500);
  await page.locator('#logo-url').click();
  await page.locator('#logo-url').pressSequentially(RIGHT, { delay: 10 });
  result.late.aTypedFocused = await page.evaluate(() => document.activeElement?.id);
  await page.locator('#logo-img').selectOption('');
  result.late.aActiveAfterSelect = await page.evaluate(() => document.activeElement?.id);
  await sleep(400);
  await page.locator('h1, header').first().click({ force: true }).catch(() => page.mouse.click(5, 5));
  await sleep(1500);
  const a = await groupState(page);
  result.late.a = { img: a.img?.value, query: a.query, offReason: a.offReason, urlShown: a.urlShown, help: await helpNow(), slot: (await logoFacts(page)).slot?.hidden ?? 'none' };
  await groupShot('late-a');

  // Late change, b: type, then focus the select (the address field blurs while still shown) and choose "없음".
  await openDemo(page, '?logo=sample-png');
  await page.locator('#logo-img').selectOption('custom');
  await sleep(500);
  await page.locator('#logo-url').click();
  await page.locator('#logo-url').pressSequentially(RIGHT, { delay: 10 });
  await page.locator('#logo-img').focus();
  await sleep(300);
  result.late.bAfterBlur = (await groupState(page)).query;
  await page.locator('#logo-img').selectOption('');
  await sleep(1500);
  const b = await groupState(page);
  result.late.b = { img: b.img?.value, query: b.query, offReason: b.offReason, urlShown: b.urlShown, help: await helpNow() };

  // Late change, c: the hidden field's change dispatched after "없음" (what a late blur sends).
  await openDemo(page, '?logo=sample-png');
  await page.locator('#logo-img').selectOption('custom');
  await sleep(500);
  await page.locator('#logo-url').fill(RIGHT);
  await page.locator('#logo-img').selectOption('');
  await sleep(300);
  await page.evaluate(() => document.getElementById('logo-url').dispatchEvent(new Event('change', { bubbles: true })));
  await sleep(1500);
  const c = await groupState(page);
  result.late.c = { img: c.img?.value, query: c.query, offReason: c.offReason, urlShown: c.urlShown };
  result.overflow = await overflow(page);
} catch (e) {
  result.error = String(e).slice(0, 1500);
  await page.screenshot({ path: `${EV}/F03/error-${W}.png`, fullPage: true }).catch(() => {});
}
result.events = req.events().length;
result.api = [...new Set(req.actions())];
result.console = logs;
await context.close();
await browser.close();
save(`F03/result-${W}.json`, result);
console.log(JSON.stringify(result, null, 1).slice(0, 200), result.error ?? '');
