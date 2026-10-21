// A2-D-QA probe: the editor preview at 390px (the stage was "not visible" there): ancestors' display and the section.
import { BASE, launch, newContext, login, save, shot, sleep, overflow } from './lib.mjs';

const browser = await launch();
const result = {};
for (const width of [390, 768]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ state: 'attached', timeout: 15000 });
  await sleep(3500);
  result[width] = await page.evaluate(() => {
    const stage = document.querySelectorAll('.sa-stage');
    return [...stage].map((s) => {
      const chain = [];
      for (let el = s; el && el !== document.body; el = el.parentElement) { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); chain.push(`${el.tagName}.${String(el.className).slice(0, 30)}${el.hidden ? '[hidden]' : ''} d=${cs.display} v=${cs.visibility} ${Math.round(r.width)}x${Math.round(r.height)}`); }
      return chain.slice(0, 8);
    });
  });
  result[`${width}-headings`] = await page.locator('h2:visible, h3:visible').allInnerTexts();
  result[`${width}-overflow`] = await overflow(page);
  result[`${width}-toggles`] = await page.locator('main button:visible, main summary:visible').evaluateAll((bs) => bs.map((b) => b.textContent.trim()).filter((t) => /미리보기|편집|보기/.test(t)));
  await shot(page, `D12/probe-editor-${width}.png`, { fullPage: true });
  await context.close();
}
save('D12/probe-390.json', result);
await browser.close();
