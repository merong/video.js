// Bare <hls-video> / <hlsjs-video> outside the player: which src forms load? node hls-probe.cjs → evidence/hls-probe.json
const fs = require('node:fs');
const path = require('node:path');
const pw = require('/Users/brian/works/tools/videojs/video.js/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');
const O = 'http://127.0.0.1:18791';
const cases = [];
for (const tag of ['hls-video', 'hlsjs-video'])
  for (const src of ['/demo-media/content-fmp4.m3u8', `${O}/demo-media/content-fmp4.m3u8`, '/demo-media/content-master.m3u8', `${O}/demo-media/content-master.m3u8`])
    cases.push({ tag, src });
(async () => {
  const out = [];
  for (const engine of ['chromium', 'webkit', 'firefox']) {
    const browser = await pw[engine].launch();
    for (const c of cases) {
      const page = await browser.newPage();
      await page.goto(`${O}/spike/pagehide.html?browser=probe`);
      const r = await page.evaluate(async ({ tag, src }) => {
        await import(`/assets/videojs/media/${tag}.js`);
        const m = document.createElement(tag);
        m.setAttribute('src', src);
        m.setAttribute('preload', 'auto');
        m.muted = true;
        document.body.append(m);
        await new Promise((r) => setTimeout(r, 3500));
        return { duration: m.duration, readyState: m.readyState };
      }, c);
      out.push({ engine, ...c, ...r });
      console.log(engine, c.tag, c.src, JSON.stringify(r));
      await page.close();
    }
    await browser.close();
  }
  fs.writeFileSync(path.join(__dirname, 'evidence', 'hls-probe.json'), JSON.stringify(out, null, 1));
})();
