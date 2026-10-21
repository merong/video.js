// A2-D-QA-DELTA X07 (observation 3): the built-in screens #/players/edit/{default,rounded,accent} at 1280/768/390.
// Read: the Note and 복제해서 새로 만들기, the preview card (aside line, folded state and 열기 below wide), the frame,
// 폭 보기 radios, 장면 바로가기 (미드롤 앞, 끝 직전) with 최근 광고 진행, the page-language select (language empty) and the
// frame's lang after a change, the demo link (enabled, href, new window, the demo's selected preset), horizontal overflow.
// At 1280 the frame size is compared with the editor of p-i0aecb28w3. Then a keyboard pass at 768 and 390 on rounded.
// action=events must stay 0 throughout. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { screens: [], compare: {}, keys: {} };
const IDS = ['default', 'rounded', 'accent'];
const card = (p) => p.locator('aside.sa-ppv');
const frame = (p) => p.frames().find((f) => f.url().includes('/examples/preview.html'));
const frameInfo = (p) => frame(p)?.evaluate(() => {
  const v = document.querySelector('#player video');
  const i18n = document.querySelector('#player media-i18n');
  return { type: new URLSearchParams(location.search).get('type'), built: Boolean(v), lang: i18n?.getAttribute('lang') ?? document.querySelector('#player')?.getAttribute('lang') ?? null };
}).catch(() => null) ?? null;
const now = (p) => card(p).locator('.sa-stage-now').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null);

async function waitFor(fn, test, timeout = 25000) {
  const end = Date.now() + timeout;
  let v = await fn();
  while (Date.now() < end && !test(v)) { await sleep(400); v = await fn(); }
  return v;
}

const focus = (p) => p.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const s = getComputedStyle(el);
  return { tag: el.tagName, type: el.type || null, value: el.type === 'radio' ? el.value : undefined, text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none') };
});
async function tabTo(p, test, max = 150) {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    const f = await focus(p);
    if (test(f)) return f;
  }
  return null;
}

for (const width of (process.argv[2] ? process.argv[2].split(',').map(Number) : [1280, 768, 390])) {
  const context = await newContext(browser, { width, height: 1000 });
  const req = requestLog(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  try {
    await login(page);
    for (const id of IDS) {
      const r = { width, id };
      await page.goto(`${BASE}/#/players/edit/${id}`);
      await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
      await sleep(1500);
      r.note = (await page.locator('main .sa-note').first().innerText()).replace(/\s+/g, ' ').trim();
      r.duplicate = await page.getByRole('button', { name: '복제해서 새로 만들기' }).count();
      r.asideLine = await card(page).locator('.sa-ppv-h .sa-small').innerText();
      const opener = card(page).locator('.sa-ppv-h button[aria-expanded]');
      r.opener = (await opener.count()) ? { text: await opener.innerText(), expanded: await opener.getAttribute('aria-expanded'), bodyHidden: await card(page).locator('div.sa-ppv').evaluate((el) => el.hidden) } : null;
      r.overflowFolded = await overflow(page);
      if (r.opener && r.opener.expanded === 'false') {
        await opener.click();
        await sleep(500);
        r.openerAfter = { text: await opener.innerText(), expanded: await opener.getAttribute('aria-expanded'), bodyHidden: await card(page).locator('div.sa-ppv').evaluate((el) => el.hidden) };
      }
      r.frame = await waitFor(() => frameInfo(page), (f) => f?.built);
      r.frameBox = await card(page).locator('.sa-stage-frame iframe').boundingBox().then((b) => b && { w: Math.round(b.width), h: Math.round(b.height) });
      r.nativeNote = await card(page).getByText('기본 video는 브라우저 컨트롤로 보여요').count();

      // 폭 보기
      const radios = card(page).locator('input[type="radio"]');
      r.widthRadios = await radios.evaluateAll((rs) => rs.map((x) => `${x.value}${x.checked ? '*' : ''}`));
      const scale = () => card(page).locator('.sa-stage-bar .sa-small').first().innerText().catch(() => null);
      r.widthViews = [];
      for (let i = 0; i < (await radios.count()); i++) {
        await radios.nth(i).check({ force: true });
        await sleep(500);
        r.widthViews.push({ value: await radios.nth(i).getAttribute('value'), scale: await scale(), frameW: await card(page).locator('.sa-stage-frame iframe').boundingBox().then((b) => b && Math.round(b.width)) });
      }
      const wide = r.widthRadios.length ? radios.last() : null;
      if (wide) await wide.check({ force: true });

      // Page language (language empty on built-ins).
      const lang = card(page).getByLabel('페이지 언어');
      r.pageLang = (await lang.count()) ? { value: await lang.inputValue(), options: await lang.locator('option').allInnerTexts() } : null;
      if (r.pageLang) {
        await lang.selectOption('en');
        r.pageLang.frameAfter = await waitFor(() => frameInfo(page), (f) => f?.built && f.lang === 'en', 20000);
        await lang.selectOption(r.pageLang.value);
        await sleep(800);
      }

      // Scenes (rounded at every width; the others at 1280 only).
      if (id === 'rounded' || width === 1280) {
        await waitFor(() => frameInfo(page), (f) => f?.built);
        r.scenes = { buttons: await card(page).locator('.sa-stage-tools button').evaluateAll((bs) => bs.map((b) => `${b.textContent.trim()}:${b.disabled || b.getAttribute('aria-disabled') === 'true' ? 'off' : 'on'}`)) };
        await waitFor(() => card(page).locator('.sa-stage-tools button', { hasText: '미드롤 앞' }).isEnabled(), Boolean, 20000);
        await card(page).locator('.sa-stage-tools button', { hasText: '미드롤 앞' }).click();
        r.scenes.mid = await waitFor(() => now(page), (t) => /미드롤/.test(t ?? ''), 30000);
        await card(page).locator('.sa-stage-tools button', { hasText: '끝 직전' }).click();
        r.scenes.end = await waitFor(() => now(page), (t) => /포스트롤/.test(t ?? ''), 30000);
      }

      // Demo link.
      const demo = card(page).getByRole('link', { name: /데모에서 열기/ });
      r.demo = { count: await demo.count(), href: await demo.getAttribute('href'), target: await demo.getAttribute('target'), ariaDisabled: await demo.getAttribute('aria-disabled'), text: (await demo.innerText()).trim() };
      if (width === 1280) {
        const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 10000 }), demo.click()]);
        await popup.waitForLoadState();
        await popup.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 });
        await sleep(1500);
        r.demo.popup = { url: popup.url().replace(BASE, ''), selected: await popup.locator('#preset').inputValue(), note: await popup.locator('#preset-note').isVisible() ? await popup.locator('#preset-note').innerText() : null };
        await popup.close();
      }
      r.overflow = await overflow(page);
      await card(page).scrollIntoViewIfNeeded();
      await shot(page, `X07/${id}-${width}.png`, { fullPage: true });
      result.screens.push(r);
    }

    if (width === 1280) {
      await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
      await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
      await sleep(3000);
      result.compare.editor = { aside: await page.locator('aside.aa-editor-preview').boundingBox().then((b) => b && { x: Math.round(b.x), w: Math.round(b.width) }), frame: await page.locator('aside.aa-editor-preview .sa-stage-frame iframe').boundingBox().then((b) => b && { w: Math.round(b.width), h: Math.round(b.height) }) };
      await shot(page, 'X07/compare-editor-1280.png');
      await page.goto(`${BASE}/#/players/edit/rounded`);
      await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
      await sleep(3000);
      result.compare.builtIn = { aside: await card(page).boundingBox().then((b) => b && { x: Math.round(b.x), w: Math.round(b.width) }), frame: await card(page).locator('.sa-stage-frame iframe').boundingBox().then((b) => b && { w: Math.round(b.width), h: Math.round(b.height) }) };
      await shot(page, 'X07/compare-builtin-1280.png');
    } else {
      // Keyboard on rounded: 열기, 폭 보기 arrow, 끝 직전, 데모에서 열기.
      const k = {};
      await page.goto(`${BASE}/#/players/edit/rounded`);
      await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
      await sleep(1500);
      await page.locator('main h1, main h2').first().click();
      k.opener = await tabTo(page, (f) => f.tag === 'BUTTON' && f.text === '열기');
      await page.keyboard.press('Enter');
      await sleep(800);
      k.openerAfter = await card(page).locator('.sa-ppv-h button[aria-expanded]').getAttribute('aria-expanded');
      await waitFor(() => frameInfo(page), (f) => f?.built);
      k.radio = await tabTo(page, (f) => f.type === 'radio', 40);
      await page.keyboard.press('ArrowRight');
      await sleep(600);
      k.radioAfter = await focus(page);
      await waitFor(() => card(page).locator('.sa-stage-tools button', { hasText: '끝 직전' }).isEnabled(), Boolean, 20000);
      k.scene = await tabTo(page, (f) => f.tag === 'BUTTON' && /끝 직전/.test(f.text), 40);
      await page.keyboard.press('Enter');
      k.nowAfter = await waitFor(() => now(page), (t) => /포스트롤/.test(t ?? ''), 30000);
      k.demo = await tabTo(page, (f) => f.tag === 'A' && /데모에서 열기/.test(f.text), 40);
      if (k.demo) {
        const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 10000 }), page.keyboard.press('Enter')]);
        await popup.waitForLoadState();
        await popup.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 });
        await sleep(1000);
        k.popup = { url: popup.url().replace(BASE, ''), selected: await popup.locator('#preset').inputValue() };
        await popup.close();
      }
      await shot(page, `X07/keys-rounded-${width}.png`);
      result.keys[width] = k;
    }
  } catch (error) {
    result[`error${width}`] = String(error).slice(0, 1500);
    await shot(page, `X07/error-${width}.png`, { fullPage: true }).catch(() => {});
  }
  result[`events${width}`] = req.events().length;
  result[`console${width}`] = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 160)}`);
  await context.close();
}
save(process.argv[3] ?? 'X07/result.json', result);
await browser.close();
