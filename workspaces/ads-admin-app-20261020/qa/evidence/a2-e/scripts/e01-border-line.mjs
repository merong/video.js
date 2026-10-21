// A2-E-QA E01: the player border line is media-container::after (1px); its color per preset.
import { launch, newContext, sleep } from './lib.mjs';
import { openDemo } from './demo.mjs';
const browser = await launch();
const page = await (await newContext(browser)).newPage();
for (const id of ['default', 'flat', 'rounded', 'accent', 'p-wgqz3x31a5', 'p-46sx1n57gw']) {
  await openDemo(page, `?preset=${id}`);
  console.log(id, JSON.stringify(await page.evaluate(() => {
    const c = document.querySelector('#player solad-video-skin').shadowRoot.querySelector('media-container');
    const out = {};
    for (const p of ['::before', '::after']) { const s = getComputedStyle(c, p); out[p] = { content: s.content, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, shadow: s.boxShadow, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, radius: s.borderRadius, inset: s.inset, z: s.zIndex }; }
    return out;
  })));
}
await browser.close();
