// A2-D-QA-DELTA X01 debug: Video.js preset, 포스터 표시 off (title on, then title off) — the frame DOM, the stage status
// and every console line of the page and the frame are read for 20 s. Then poster back on. Nothing is saved.
import { BASE, launch, newContext, login, save, shot, sleep, EV } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const lines = [];
page.on('console', (m) => lines.push(`${new URL(m.location()?.url || BASE).pathname} ${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => lines.push(`pageerror: ${String(e).slice(0, 300)}`));
const result = { steps: [] };
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const snap = async (label) => {
  const f = frame();
  const dom = f ? await f.evaluate(() => ({ url: location.search, player: (document.querySelector('#player')?.innerHTML ?? 'NO #player').replace(/\s+/g, ' ').slice(0, 300), body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200) })).catch((e) => String(e).slice(0, 100)) : null;
  const aside = (await page.locator('aside.aa-editor-preview').innerText()).replace(/\s+/g, ' ').slice(0, 300);
  result.steps.push({ label, at: Date.now(), dom, aside });
};
try {
  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(3500);
  await snap('initial');
  await page.locator('#aa-preset-display-poster').click();
  for (const t of [1, 3, 8, 20]) { await sleep(t === 1 ? 1000 : (t - [1, 3, 8, 20][[1, 3, 8, 20].indexOf(t) - 1]) * 1000); await snap(`poster-off ${t}s`); }
  await page.locator('.sa-stage-frame iframe').first().screenshot({ path: `${EV}/X01/debug-poster-off-20s.png` });
  await page.locator('#aa-preset-display-title').click();
  await sleep(4000);
  await snap('poster-off title-off 4s');
  await page.locator('#aa-preset-display-poster').click();
  await sleep(4000);
  await snap('poster-on title-off 4s');
  await page.reload();
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(1000);
  await page.locator('#aa-preset-display-poster').click();
  await sleep(5000);
  await snap('after reload: poster-off 5s');
} catch (error) {
  result.error = String(error).slice(0, 1200);
}
result.console = lines;
save('X01/debug.json', result);
await browser.close();
