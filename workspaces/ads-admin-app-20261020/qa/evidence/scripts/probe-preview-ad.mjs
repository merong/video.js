// Probe: media-ads structure during the preroll in the theme preview (no writes).
import { launch, newContext, login, save, sleep } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const page = await context.newPage();
await login(page);
await gotoList(page);
await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
await presetForm(page).waitFor();
await sleep(3000);
const frame = page.frames().find((f) => /player-preview/.test(f.url()));
await page.frameLocator('iframe[title="플레이어 테마 미리보기"]').locator('media-play-button').click();
await sleep(3000);
const out = await frame.evaluate(() => {
  const ads = document.querySelector('media-ads');
  const tree = [];
  const walk = (root, depth) => {
    for (const el of root.children ?? []) {
      if (tree.length > 80) return;
      const cs = getComputedStyle(el);
      tree.push(`${'  '.repeat(depth)}${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ').join('.')}` : ''}${el.getAttribute('part') ? ` part=${el.getAttribute('part')}` : ''}${el.shadowRoot ? ' [shadow]' : ''} d=${cs.display} ${(el.getAttribute('aria-label') || (el.children.length ? '' : el.textContent)).trim().slice(0, 40)}`);
      if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
      walk(el, depth + 1);
    }
  };
  walk(ads, 0);
  if (ads.shadowRoot) {
    tree.push('--- ads.shadowRoot ---');
    walk(ads.shadowRoot, 0);
  }
  const deepVideos = [];
  const collect = (root) => {
    for (const v of root.querySelectorAll('video')) deepVideos.push({ src: (v.currentSrc || v.src).split('/').pop(), t: v.currentTime, paused: v.paused, muted: v.muted });
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) collect(el.shadowRoot);
  };
  collect(document);
  const ancestry = [];
  const adVideo = (() => {
    let found = null;
    const scan = (root) => {
      for (const v of root.querySelectorAll('video')) if (/ad-/.test(v.currentSrc || v.src)) found = v;
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot && !found) scan(el.shadowRoot);
    };
    scan(document);
    return found;
  })();
  for (let el = adVideo; el; el = el.parentNode instanceof ShadowRoot ? el.parentNode.host : el.parentElement) {
    const cs = getComputedStyle(el);
    ancestry.push({ tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '', part: el.getAttribute('part'), inShadowOf: el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host.tagName.toLowerCase() : null, display: cs.display, position: cs.position, font: cs.fontFamily.slice(0, 60), radius: cs.borderRadius });
  }
  const overlay = adVideo?.parentElement;
  const overlayTree = [];
  if (overlay) walkInto(overlay, 0);
  function walkInto(root, depth) {
    for (const el of root.children) {
      if (overlayTree.length > 60) return;
      overlayTree.push(`${'  '.repeat(depth)}${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? `.${el.className.split(' ').join('.')}` : ''}${el.getAttribute('part') ? ` part=${el.getAttribute('part')}` : ''} ${(el.getAttribute('aria-label') || (el.children.length ? '' : el.textContent)).trim().slice(0, 40)}`);
      walkInto(el, depth + 1);
    }
  }
  return { ancestry, overlayTree, adsAttrs: [...ads.attributes].map((a) => `${a.name}=${a.value.slice(0, 80)}`), tree, deepVideos };
});
save('PL12/probe-ad.json', out);
await page.screenshot({ path: '/Users/brian/works/tools/videojs/video.js/workspaces/ads-admin-app-20261020/qa/evidence/PL12/probe-ad.png' });
await browser.close();
