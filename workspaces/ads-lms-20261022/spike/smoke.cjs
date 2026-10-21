// Quick load check: node smoke.cjs [query] [browser]
const { chromium, webkit, firefox } = require('/Users/brian/works/tools/videojs/video.js/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');
const engines = { chromium, webkit, firefox };
(async () => {
  const browser = await engines[process.argv[3] ?? 'chromium'].launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:18791/spike/page.html?${process.argv[2] ?? ''}`);
  await page.waitForFunction(() => window.__lms?.ready, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const l = window.__lms; const s = l.state?.();
    return { ready: l.ready, registered: l.registered?.(), duration: s?.duration, currentTime: s?.currentTime, chapters: s?.chaptersCues?.length, log: l.log.slice(0, 20) };
  });
  console.log(JSON.stringify({ out, errors }, null, 1));
  await browser.close();
})();
