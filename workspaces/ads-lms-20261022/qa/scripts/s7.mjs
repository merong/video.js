// L-3-QA scenario 7 (regression): /examples/index.html default demo plays with an ad; the admin player list shows the
// five built-in presets in order. Chromium 1280.
import { BASE, launch, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const b = await launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = consoleCollector(page);
const bad = [];
page.on('response', (res) => { if (res.status() >= 400) bad.push(`${res.status()} ${res.url().replace(BASE, '')}`); });
const r = { steps: {} };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };
const videos = () => page.evaluate(() => {
  const deep = (root, out = []) => { out.push(...root.querySelectorAll('video')); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) deep(el.shadowRoot, out); return out; };
  return deep(document.querySelector('#player') ?? document).map((v) => ({ src: v.currentSrc.replace(location.origin, ''), t: Math.round(v.currentTime * 10) / 10, paused: v.paused }));
});

try {
  await page.goto(`${BASE}/examples/index.html`);
  const player = page.getByRole('group', { name: '미디어 플레이어' }).first();
  await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
  await sleep(1000);
  await player.getByRole('button', { name: '재생', exact: true }).click();
  const seen = [];
  let adPlaying = null;
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const v = await videos();
    seen.push(v);
    adPlaying = v.find((x) => /\/ad[-.]/.test(x.src) && !x.paused && x.t > 0.5) ?? adPlaying;
    if (adPlaying && v.some((x) => !/\/ad[-.]/.test(x.src) && x.t > 1)) break;
    await sleep(300);
  }
  const last = seen.at(-1);
  await shot(page, 's7-demo.png');
  step('default demo plays with an ad then content', Boolean(adPlaying) && last.some((x) => !/\/ad[-.]/.test(x.src) && x.t > 1), { adPlaying, last, bad: bad.slice(0, 5) });

  await login(page);
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('region', { name: '플레이어 프리셋' }).waitFor({ timeout: 15000 });
  await sleep(1000);
  const names = await page.getByRole('region', { name: '플레이어 프리셋' }).getByRole('row').evaluateAll((rows) => rows.slice(1).map((row) => row.cells[0]?.innerText.replace(/\s+/g, ' ').trim()));
  const builtIn = names.filter((n) => /내장/.test(n));
  step('admin list has the five built-in presets in order', builtIn.length === 5 && ['default', 'flat', 'rounded', 'accent', 'lms'].every((id, i) => builtIn[i]?.endsWith(id)) && /^강의/.test(builtIn[4]), { builtIn, allRows: names.length });
} catch (e) {
  r.error = String(e).slice(0, 800);
  console.log('ERROR', r.error);
  await shot(page, 's7-error.png');
}
r.consoleErrors = errors;
r.http4xx5xx = bad;
save('s7-chromium.json', r);
await b.close();
