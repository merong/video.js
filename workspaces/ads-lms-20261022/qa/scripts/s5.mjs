// L-3-QA scenario 5: lms.ads preroll (one 3 s demo ad, fixture-preroll.json) with "본 곳까지만" on the sample lecture.
// Samples every 250 ms: every <video> (ad or content) and the panel percent. Chromium 1280.
import { BASE, launch, consoleCollector, save, shot, sleep } from './lib.mjs';

const b = await launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = consoleCollector(page);
const r = { steps: {}, samples: [] };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };
const player = page.getByRole('group', { name: '미디어 플레이어' });
const panel = page.getByRole('region', { name: '강의 진도와 자료' });

await page.addInitScript(() => {
  window.__qa = { blocked: [], progress: [] };
  document.addEventListener('solad-lms-seek-blocked', (e) => window.__qa.blocked.push(e.detail), true);
  document.addEventListener('solad-lms-progress', (e) => window.__qa.progress.push({ reason: e.detail.reason, percent: e.detail.percent, position: e.detail.position, segments: e.detail.segments }), true);
});
const sample = () => page.evaluate(() => {
  const deep = (root, out = []) => { out.push(...root.querySelectorAll('video')); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) deep(el.shadowRoot, out); return out; };
  const vids = deep(document.querySelector('#player')).map((v) => ({ ad: /\/ad\.mp4/.test(v.currentSrc), t: Math.round(v.currentTime * 100) / 100, paused: v.paused }));
  const strong = document.querySelector('solad-lms-panel')?.shadowRoot?.querySelector('strong')?.textContent ?? '';
  return { vids, percent: Number(strong.match(/\d+/)?.[0] ?? -1), blocked: window.__qa.blocked.length };
});

try {
  await page.goto(`${BASE}/examples/lecture.html`);
  await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
  await page.locator('input[name=ads][value=preroll]').check();
  await page.locator('input[name=seekLimit][value=watched]').check();
  await sleep(2500);
  await player.getByRole('button', { name: '재생', exact: true }).click();
  const t0 = Date.now();
  let shotTaken = false;
  while (Date.now() - t0 < 12000) {
    const s = await sample();
    r.samples.push({ ms: Date.now() - t0, ...s });
    if (!shotTaken && s.vids.some((v) => v.ad && !v.paused && v.t > 1)) { await shot(page, 's5-preroll.png'); shotTaken = true; }
    await sleep(250);
  }
  const during = r.samples.filter((s) => s.vids.some((v) => v.ad && !v.paused));
  const after = r.samples.filter((s) => !s.vids.some((v) => v.ad && !v.paused));
  const content = (s) => s.vids.find((v) => !v.ad);
  const adMax = Math.max(0, ...r.samples.flatMap((s) => s.vids.filter((v) => v.ad).map((v) => v.t)));
  step('ad plays to the end; percent and content time stay 0 during the ad', during.length >= 8 && during.every((s) => s.percent === 0 && (content(s)?.t ?? 0) < 0.3) && adMax >= 2.8, { adSamples: during.length, adMaxTime: adMax, percentsDuringAd: [...new Set(during.map((s) => s.percent))], contentTimeDuringAd: Math.max(...during.map((s) => content(s)?.t ?? 0)) });
  const last = r.samples.at(-1);
  step('content progress rises after the ad', last.percent > 0 && (content(last)?.t ?? 0) > 3, { lastPercent: last.percent, contentTime: content(last)?.t });
  const ev = await page.evaluate(() => window.__qa);
  step('watched-only rule does not interfere with the ad', ev.blocked.length === 0, { blockedEvents: ev.blocked, firstProgress: ev.progress.slice(0, 3) });
} catch (e) {
  r.error = String(e).slice(0, 800);
  console.log('ERROR', r.error);
  await shot(page, 's5-error.png');
}
r.samples = r.samples.filter((_, i) => i % 4 === 0);
r.consoleErrors = errors;
save('s5-chromium.json', r);
await b.close();
