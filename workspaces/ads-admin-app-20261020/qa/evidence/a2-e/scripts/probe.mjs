// scratch: the caption container's computed translate with the controls shown, and where the video lives.
import { launch, newContext, login, sleep } from './lib.mjs';
import { openDemo } from './demo.mjs';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
await login(page);
await openDemo(page, '?captionsUrl=%2Fexamples%2Fsample-captions.vtt');
await page.locator('[data-scene="before-midroll"]').click();
const end = Date.now() + 25000;
while (Date.now() < end && (await page.evaluate(() => document.querySelector('#player video')?.currentTime ?? 0)) < 3.4) await sleep(100);
await page.evaluate(() => document.querySelector('#player solad-video-skin').shadowRoot.querySelector('.video-controls-primary > media-play-button').focus());
await page.keyboard.press('c');
await page.evaluate(() => document.querySelector('#player video').pause());
await sleep(1000);
console.log(JSON.stringify(await page.evaluate(() => {
  const v = document.querySelector('#player video');
  const skin = document.querySelector('#player solad-video-skin');
  const root = skin.shadowRoot;
  const cont = root.querySelector('media-container');
  const pc = getComputedStyle(v, '::-webkit-media-text-track-container');
  const slot = v.assignedSlot;
  return {
    videoParent: v.parentElement?.localName, inShadow: v.getRootNode() !== document, assignedSlot: slot ? `${slot.localName}[name=${slot.name}] in ${slot.parentElement?.localName}` : null,
    pseudo: { translate: pc.translate, transform: pc.transform, zIndex: pc.zIndex },
    varsOnVideo: { y: getComputedStyle(v).getPropertyValue('--media-caption-track-y'), controlsY: getComputedStyle(v).getPropertyValue('--media-caption-controls-y') },
    varsOnContainer: { y: getComputedStyle(cont).getPropertyValue('--media-caption-track-y'), controlsY: getComputedStyle(cont).getPropertyValue('--media-caption-controls-y') },
    containerAttrs: [...cont.attributes].map((a) => a.name),
    docSheets: [...document.styleSheets].map((s) => s.href?.replace(location.origin, '') ?? 'inline').slice(0, 10),
    shadowSheets: (root.adoptedStyleSheets?.length ?? 0) + root.querySelectorAll('style,link[rel=stylesheet]').length,
  };
}), null, 1));
await browser.close();
