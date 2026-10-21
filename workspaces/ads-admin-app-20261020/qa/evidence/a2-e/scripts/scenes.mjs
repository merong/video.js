// A2-E-QA (copied from A2-D-QA-DELTA-3) Scene-sequence recorder shared by Z01, Z02 and Z05. An in-page MutationObserver keeps every change of the latest-progress
// line with performance.now(); a click records its own time in the same clock, so "click → initial line" and "click → that
// scene's ad" are measured without Node polling lag. The player element (demo page or preview frame) is tagged before
// each click to tell a new player from the same one. Nothing here stores cookies or tokens.
import { sleep } from './lib.mjs';

export const SEQUENCE = [
  { scene: 'before-midroll', label: '미드롤 앞', target: /미드롤 1\/1 재생 중/ },
  { scene: 'before-end', label: '끝 직전(미드롤 재생 중)', target: /포스트롤 1\/1 재생 중/, during: true },
  { scene: 'before-midroll', label: '미드롤 앞(포스트롤 뒤)', target: /미드롤 1\/1 재생 중/, waitEnd: true },
  { scene: 'start', label: '처음부터', target: /프리롤 1\/2 재생 중/ },
  { scene: 'before-end', label: '끝 직전', target: /포스트롤 1\/1 재생 중/ },
];
export const TEXT = { 'before-midroll': '미드롤 앞', 'before-end': '끝 직전', start: '처음부터' };
const INITIAL = /아직 광고가 나오지 않았어요/;

/** Installs the recorder in `page` for the line `nowSel` (a selector that may be re-rendered). */
export async function install(page, nowSel) {
  await page.evaluate((sel) => {
    const read = () => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const qa = (window.__qa = { lines: [], clicks: [] });
    let last = read();
    qa.lines.push({ t: performance.now(), text: last });
    new MutationObserver(() => {
      const x = read();
      if (x !== last) { last = x; qa.lines.push({ t: performance.now(), text: x }); }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, nowSel);
}

/**
 * Runs SEQUENCE (or `steps`). `button(scene)` returns a locator; `playerDoc()` returns the page or frame that holds the
 * player; `playerSel` finds the player element there; `extra()` may read more state after each step.
 */
export async function runSequence(page, { button, playerDoc, playerSel, steps = SEQUENCE, extra, timeout = 25000 }) {
  const out = [];
  for (const [i, step] of steps.entries()) {
    const b = button(step.scene);
    const enableStart = Date.now();
    while (Date.now() - enableStart < 20000 && !(await b.isEnabled().catch(() => false))) await sleep(100);
    if (step.waitEnd) {
      const end = Date.now() + 20000;
      while (Date.now() < end && !/끝남/.test(await page.evaluate(() => window.__qa.lines.at(-1)?.text ?? ''))) await sleep(200);
    }
    const tag = `step${i}`;
    const doc = await playerDoc();
    const tagged = await doc?.evaluate(([sel, tag]) => { const el = document.querySelector(sel); if (el) el.dataset.qaTag = tag; return Boolean(el); }, [playerSel, tag]).catch(() => false);
    const before = await page.evaluate(() => ({ line: window.__qa.lines.at(-1)?.text ?? null, n: window.__qa.lines.length }));
    const handle = await b.elementHandle();
    const t0 = await page.evaluate((el) => { const t = performance.now(); el.click(); return t; }, handle);

    // Wait for the target line after the click.
    const end = Date.now() + timeout;
    let lines = [];
    while (Date.now() < end) {
      lines = await page.evaluate((n) => window.__qa.lines.slice(n), before.n);
      if (lines.some((l) => step.target.test(l.text))) break;
      await sleep(100);
    }
    await sleep(600);
    lines = await page.evaluate((n) => window.__qa.lines.slice(n), before.n);
    const hit = lines.find((l) => step.target.test(l.text));
    const initial = lines.find((l) => INITIAL.test(l.text));
    const docAfter = await playerDoc();
    const player = await docAfter?.evaluate((sel) => {
      const el = document.querySelector(sel);
      const v = document.querySelector('#player video');
      return el && { tag: el.dataset.qaTag ?? null, autoplayAttr: el.hasAttribute('autoplay'), videoAutoplay: v ? v.autoplay : null, t: v ? Math.round(v.currentTime * 10) / 10 : null };
    }, playerSel).catch(() => null);
    out.push({
      step: step.label, scene: step.scene, enabledAfterMs: Date.now() - enableStart, lineBefore: before.line, tagged,
      newPlayer: player ? player.tag !== tag : null, player,
      msToInitial: initial ? Math.round(initial.t - t0) : null,
      msToTarget: hit ? Math.round(hit.t - t0) : null,
      lines: lines.map((l) => `${Math.round(l.t - t0)}ms ${l.text.replace(/^최근 광고 진행 /, '')}`),
      preroll: step.scene !== 'start' && lines.some((l) => /프리롤/.test(l.text)),
      error: lines.some((l) => /오류/.test(l.text)),
      ...(extra ? await extra() : {}),
    });
  }
  return out;
}
