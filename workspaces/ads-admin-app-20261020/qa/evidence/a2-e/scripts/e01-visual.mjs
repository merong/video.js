// A2-E-QA E01 shape on the stage at 1280 and 390: the demo (default, flat, rounded, accent, QA 테두리 8자리) and the admin
// built-in screens (four) and editor (QA 테두리 8자리): the container's radius and outline, the stage layers above it, and
// corner pixels (stage background outside a rounded corner, video inside a flat one). The demo's empty stage with the
// sample schedule answered 404 by a Playwright route (no server change). Lists: demo select, admin list, schedule select.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { openDemo, requestLog } from './demo.mjs';
import { playerShape, stageLayers, frameLayers, pixels, cornerPoints, waitFrameSkin } from './probe-lib.mjs';

const EIGHT = 'p-wgqz3x31a5';
const browser = await launch();
const result = { demo: [], admin: [], lists: {} };

for (const [w, h] of [[1280, 900], [390, 844]]) {
  const context = await newContext(browser, { width: w, height: h });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  await login(page);
  for (const id of ['default', 'flat', 'rounded', 'accent', EIGHT]) {
    const r = { size: `${w}x${h}`, id };
    try {
      await openDemo(page, `?preset=${id}`);
      await sleep(1200);
      await page.locator('#stage-view').scrollIntoViewIfNeeded();
      await sleep(300);
      r.shape = await playerShape(page);
      r.stage = await stageLayers(page, '#stage');
      r.pixels = r.shape ? await pixels(page, cornerPoints(r.shape.rect)) : null;
      await shot(page, `E01/demo-${id}-${w}.png`, { clip: await page.locator('#stage-view').boundingBox() });
      r.overflow = await overflow(page);
    } catch (e) { r.error = String(e).slice(0, 600); }
    result.demo.push(r);
  }
  if (w === 1280) {
    result.lists.demoSelect = await page.evaluate(() => [...document.querySelectorAll('#preset optgroup')].map((g) => ({ label: g.label, options: [...g.querySelectorAll('option')].map((o) => `${o.value}:${o.textContent.trim()}`) })));
  }
  // Admin built-in screens and the editor of the 8-digit preset.
  const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
  for (const id of ['default', 'flat', 'rounded', 'accent', EIGHT]) {
    const r = { size: `${w}x${h}`, id };
    try {
      await page.goto(`${BASE}/#/players/edit/${id}`);
      const scope = id === EIGHT ? 'aside.aa-editor-preview' : 'section.aa-builtin-preview';
      await page.locator(scope).waitFor({ timeout: 15000 });
      const opener = page.locator(`${scope} button[aria-expanded]`).first();
      if ((await opener.count()) && (await opener.getAttribute('aria-expanded')) === 'false') { await opener.click(); await sleep(500); }
      const f = await waitFrameSkin(frame);
      await sleep(1500);
      await page.locator(`${scope} .sa-stage-view`).scrollIntoViewIfNeeded();
      await sleep(300);
      r.shape = await playerShape(f);
      r.stage = await stageLayers(page, scope);
      r.frameDoc = await frameLayers(f);
      const ifr = r.stage.iframe?.rect;
      const scale = await page.evaluate((s) => Number(getComputedStyle(document.querySelector(`${s} .sa-stage-frame`)).getPropertyValue('--_s')) || 1, scope);
      r.scale = scale;
      r.pixels = r.shape && ifr ? await pixels(page, cornerPoints(r.shape.rect, ifr.x, ifr.y, scale)) : null;
      await shot(page, `E01/admin-${id}-${w}.png`, { clip: await page.locator(`${scope} .sa-stage-view`).boundingBox() });
      r.overflow = await overflow(page);
    } catch (e) { r.error = String(e).slice(0, 600); }
    result.admin.push(r);
  }
  if (w === 1280) {
    await page.goto(`${BASE}/#/players`);
    await page.getByRole('table').first().waitFor({ timeout: 15000 });
    await sleep(800);
    result.lists.adminRows = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((tr) => tr.querySelector('b')?.textContent.trim() ?? tr.textContent.trim().slice(0, 40)));
    result.lists.adminSentence = await page.evaluate(() => [...document.querySelectorAll('p, span, td')].map((e) => e.textContent.trim()).filter((t) => /네 가지|내장 프리셋은/.test(t)).slice(0, 3));
    await page.goto(`${BASE}/#/schedule`);
    const target = page.getByRole('form', { name: '편집할 대상' });
    await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
    await target.getByRole('button', { name: '편성 불러오기' }).click();
    await page.getByText('편성을 불러왔어요', { exact: false }).first().waitFor({ timeout: 15000 });
    await sleep(1000);
    result.lists.scheduleSelect = await page.getByRole('combobox', { name: '적용할 프리셋' }).evaluate((s) => [...s.querySelectorAll('optgroup')].map((g) => ({ label: g.label, options: [...g.querySelectorAll('option')].map((o) => `${o.value}:${o.textContent.trim()}`) })).concat([...s.children].filter((c) => c.tagName === 'OPTION').map((o) => ({ label: '(top)', options: [`${o.value}:${o.textContent.trim()}`] })))).catch((e) => String(e).slice(0, 200));
  }
  result[`events${w}`] = req.events().length;
  result[`console${w}`] = logs.map((l) => `${l.type}: ${l.text.slice(0, 200)}`);
  await context.close();
}

// Empty stage: the sample schedule answered 404 in the browser only.
{
  const context = await newContext(browser, { width: 1280, height: 900 });
  await context.route('**/demo-media/grok-20261018/schedule.json.js', (route) => route.fulfill({ status: 404, body: '' }));
  const page = await context.newPage();
  await page.goto(`${BASE}/examples/index.html?preset=flat`);
  await page.locator('#stage-empty:not([hidden])').waitFor({ timeout: 15000 }).catch(() => {});
  await sleep(800);
  result.empty = await page.evaluate(() => { const v = document.querySelector('#stage-view'); const s = getComputedStyle(v); return { cls: v.className, radius: s.borderRadius, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, bg: s.backgroundColor, text: document.querySelector('#stage-empty')?.textContent.replace(/\s+/g, ' ').trim(), barHidden: getComputedStyle(document.querySelector('.sa-stage-bar')).display === 'none' || document.querySelector('.sa-stage-bar').hidden }; });
  await shot(page, 'E01/demo-empty-1280.png', { clip: await page.locator('#stage').boundingBox() });
  await context.close();
}
save('E01/visual.json', result);
await browser.close();
