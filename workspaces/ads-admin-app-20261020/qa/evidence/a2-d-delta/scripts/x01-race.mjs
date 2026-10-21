// A2-D-QA-DELTA X01 race: on p-i0aecb28w3 two display checkboxes are clicked back to back (gap 0/150/600 ms), ten
// rounds each; after each round the frame is polled up to 15 s for a built player. A round whose frame stays empty is
// recorded with the frame #player HTML, the stage text and the console. Nothing is saved.
import { BASE, launch, newContext, login, save, sleep, EV } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const lines = [];
page.on('console', (m) => lines.push(`${new URL(m.location()?.url || BASE).pathname} ${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => lines.push(`pageerror: ${String(e).slice(0, 300)}`));
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const built = () => frame()?.evaluate(() => Boolean(document.querySelector('#player video'))).catch(() => false);
const result = { rounds: [] };
try {
  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(3500);
  for (const gap of [0, 150, 600]) {
    for (let i = 0; i < 10; i++) {
      await page.locator('#aa-preset-display-poster').click();
      if (gap) await sleep(gap);
      await page.locator('#aa-preset-display-title').click();
      const t0 = Date.now();
      await sleep(300);
      let ok = await built();
      while (!ok && Date.now() - t0 < 15000) { await sleep(300); ok = await built(); }
      const r = { gap, i, ok, ms: Date.now() - t0 };
      if (!ok) {
        r.frameHtml = await frame()?.evaluate(() => (document.querySelector('#player')?.outerHTML ?? 'none').slice(0, 300)).catch((e) => String(e));
        r.stage = (await page.locator('aside.aa-editor-preview').innerText()).replace(/\s+/g, ' ').slice(0, 200);
        r.state = { poster: await page.locator('#aa-preset-display-poster').isChecked(), title: await page.locator('#aa-preset-display-title').isChecked() };
        await page.locator('.sa-stage-frame iframe').first().screenshot({ path: `${EV}/X01/race-empty-${gap}-${i}.png` }).catch(() => {});
        // Does it recover on its own, or after 다시 불러오기?
        await sleep(15000);
        r.after30s = await built();
        await page.getByRole('button', { name: '다시 불러오기' }).click();
        await sleep(4000);
        r.afterReload = await built();
      }
      result.rounds.push(r);
    }
  }
} catch (error) {
  result.error = String(error).slice(0, 1200);
}
result.summary = [0, 150, 600].map((g) => `${g}ms: empty ${result.rounds.filter((r) => r.gap === g && !r.ok).length}/${result.rounds.filter((r) => r.gap === g).length}`);
result.console = lines;
save('X01/race.json', result);
await browser.close();
