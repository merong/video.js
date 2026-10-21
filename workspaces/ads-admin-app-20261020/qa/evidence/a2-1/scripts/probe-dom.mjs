// A2-1-QA probe: skin DOM shape (shadow roots, classes using the accent) and failed requests on a loader page.
import { launch, newContext, save, sleep } from './lib.mjs';
import { openPage, waitQa } from './a2.mjs';

const browser = await launch();
const context = await newContext(browser);
const failed = [];
context.on('response', (r) => { if (r.status() >= 400) failed.push({ status: r.status(), url: r.url() }); });
const { page } = await openPage(context, 'http://127.0.0.1:18781/__qa/paste/a2-1-probe.html');
await waitQa(page, (s) => s.ready.length, 15000);
await sleep(1500);
const dom = await page.evaluate(() => {
  const skin = document.querySelector('video-skin');
  const out = { skinShadow: Boolean(skin.shadowRoot), skinClass: skin.className, skinStyleRadius: getComputedStyle(skin).borderRadius };
  const all = [...skin.querySelectorAll('*')];
  out.classes = [...new Set(all.flatMap((e) => [...e.classList]))].filter((c) => /skin|slider|fill|root|container/.test(c)).slice(0, 40);
  out.shadowHosts = all.filter((e) => e.shadowRoot).map((e) => e.tagName).slice(0, 20);
  const withRadius = all.filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0).slice(0, 5).map((e) => ({ tag: e.tagName, cls: e.className?.toString?.().slice(0, 60), r: getComputedStyle(e).borderTopLeftRadius, bc: getComputedStyle(e).borderTopColor, bw: getComputedStyle(e).borderTopWidth }));
  out.withRadius = withRadius;
  const prim = all.filter((e) => getComputedStyle(e).getPropertyValue('--media-primary').trim()).slice(0, 3).map((e) => ({ tag: e.tagName, cls: e.className?.toString?.().slice(0, 60), primary: getComputedStyle(e).getPropertyValue('--media-primary').trim() }));
  out.primary = prim;
  return out;
});
save('probe/dom.json', { dom, failed });
console.log(JSON.stringify({ dom, failed }, null, 1));
await browser.close();
