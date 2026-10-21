// Probe: preview iframe structure on the P-A edit screen (no writes).
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
const out = { frameUrl: frame?.url() };
out.iframeAttrs = await page.locator('iframe').evaluateAll((els) => els.map((e) => ({ title: e.title, src: e.getAttribute('src'), w: e.clientWidth, h: e.clientHeight, sandbox: e.getAttribute('sandbox'), allow: e.getAttribute('allow') })));
out.dom = await frame.evaluate(() => {
  const walk = (root, depth = 0, acc = []) => {
    for (const el of root.children ?? []) {
      if (acc.length > 120) break;
      acc.push(`${'  '.repeat(depth)}${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('style') ? ` style="${el.getAttribute('style').slice(0, 200)}"` : ''}${el.shadowRoot ? ' [shadow]' : ''}${['BUTTON'].includes(el.tagName) ? ` "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"` : ''}`);
      if (el.shadowRoot) walk(el.shadowRoot, depth + 1, acc);
      walk(el, depth + 1, acc);
    }
    return acc;
  };
  return { lang: document.documentElement.lang, title: document.title, scripts: [...document.scripts].map((s) => s.src || 'inline'), links: [...document.querySelectorAll('link')].map((l) => l.href), tree: walk(document.body) };
});
save('PL12/probe-iframe.json', out);
await browser.close();
