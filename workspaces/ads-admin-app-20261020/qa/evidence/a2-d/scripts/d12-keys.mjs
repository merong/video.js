// A2-D-QA D12 keyboard: the demo, help and the admin editor preview are used with the keyboard only. A Tab walk records
// every stop and whether it shows a focus ring (outline or box-shadow). Then: the preset select with arrows, a checkbox
// with Space, preload radios with arrows, play with Space, a scene button with Enter, the copy buttons (writeText is
// replaced in the page so the system clipboard is not touched), the help TOC at 768, and the editor preview opener,
// width radios, scenes and the demo link. Wider-than-viewport elements are checked for a scrolling ancestor.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const result = { demo: {}, help: {}, admin: {}, containment: {} };

// Deep active element plus its focus indicator.
const focus = (p) => p.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const s = getComputedStyle(el);
  const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName, id: el.id || null, type: el.type || null, name: el.name || null, value: el.type === 'radio' || el.tagName === 'SELECT' ? el.value : undefined,
    text: (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 50),
    ring, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow === 'none' ? null : s.boxShadow.slice(0, 50), focusVisible: el.matches(':focus-visible'), inView: r.bottom > 0 && r.top < innerHeight,
  };
});

async function walk(p, n, label) {
  const stops = [];
  for (let i = 0; i < n; i++) {
    await p.keyboard.press('Tab');
    await sleep(60);
    const f = await focus(p);
    stops.push(f);
    if (f.tag === 'BODY' && i > 2) break;
  }
  return { label, count: stops.length, noRing: stops.filter((s) => s.tag !== 'BODY' && !s.ring), stops: stops.map((s) => `${s.tag}${s.id ? '#' + s.id : ''}${s.name ? '[' + s.name + '=' + s.value + ']' : ''}:${s.text}${s.ring ? '' : ' (NO RING)'}`) };
}

async function tabTo(p, test, max = 120) {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    const f = await focus(p);
    if (test(f)) return f;
  }
  return null;
}

// Wider-than-viewport elements and whether an ancestor scrolls them.
const contained = (p) => p.evaluate(() => {
  const w = document.documentElement.clientWidth;
  return [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > w + 1 && el.getClientRects().length).filter((el, _, all) => !all.includes(el.parentElement)).slice(0, 8).map((el) => {
    let a = el.parentElement;
    while (a && a !== document.body && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) a = a.parentElement;
    return `${el.tagName}.${String(el.className).slice(0, 24)} r=${Math.round(el.getBoundingClientRect().right)} scroller=${a && a !== document.body ? `${a.tagName}.${String(a.className).slice(0, 24)}(${getComputedStyle(a).overflowX}) r=${Math.round(a.getBoundingClientRect().right)}` : 'none'}`;
  });
});

try {
  // Demo at 1280.
  const context = await newContext(browser, { width: 1280, height: 1000 });
  await context.addInitScript(() => { window.__copied = []; if (navigator.clipboard) navigator.clipboard.writeText = async (t) => { window.__copied.push(t.length); }; });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  await page.goto(`${BASE}/examples/index.html`);
  await sleep(3000);
  result.demo.walk = await walk(page, 70, 'demo-1280');

  await page.goto(`${BASE}/examples/index.html`);
  await sleep(3000);
  const d = result.demo;
  d.preset = await tabTo(page, (f) => f.id === 'preset');
  const before = await page.locator('#preset').inputValue();
  await page.keyboard.press('ArrowDown');
  await sleep(1500);
  d.presetChange = { before, after: await page.locator('#preset').inputValue(), url: page.url().replace(BASE, '') };
  d.preload = await tabTo(page, (f) => f.name === 'preload');
  await page.keyboard.press('ArrowRight');
  await sleep(800);
  d.preloadAfter = { focused: await focus(page), checked: await page.locator('input[name="preload"]:checked').inputValue().catch(() => null) };
  d.poster = await tabTo(page, (f) => f.id === 'poster');
  await page.keyboard.press('Space');
  await sleep(800);
  d.posterAfter = await page.locator('#poster').isChecked();
  d.copy = [];
  for (const name of ['HTML 코드 복사', 'JS API 코드 복사']) {
    const f = await tabTo(page, (x) => x.tag === 'BUTTON' && x.text === name);
    await page.keyboard.press('Enter');
    await sleep(600);
    d.copy.push({ name, reached: Boolean(f), ring: f?.ring, copiedLengths: await page.evaluate(() => window.__copied.slice()), status: await page.evaluate(() => [...document.querySelectorAll('[role="status"], [aria-live]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4)) });
  }
  await shot(page, 'D12/keys-demo-after-options.png');

  // Play with the keyboard, then a scene button with Enter.
  await page.goto(`${BASE}/examples/index.html`);
  await sleep(3000);
  d.play = await tabTo(page, (f) => /재생|play/i.test(f.text) && f.tag === 'BUTTON' && !f.id, 60);
  await page.keyboard.press('Space');
  const end = Date.now() + 15000;
  while (Date.now() < end && !/재생 중/.test(await page.locator('#now').innerText())) await sleep(300);
  d.nowAfterPlay = (await page.locator('#now').innerText()).replace(/\s+/g, ' ').trim();
  await page.locator('#preset').focus();
  d.scene = await tabTo(page, (f) => f.tag === 'BUTTON' && /미드롤 앞/.test(f.text), 60);
  await page.keyboard.press('Enter');
  const end2 = Date.now() + 25000;
  while (Date.now() < end2 && !/미드롤 1\/1 재생 중/.test(await page.locator('#now').innerText())) await sleep(400);
  d.nowAfterScene = (await page.locator('#now').innerText()).replace(/\s+/g, ' ').trim();
  await shot(page, 'D12/keys-demo-scene.png');
  result.demo.console = logs.filter((l) => !/404|401/.test(l.text ?? ''));
  await context.close();

  // Help at 768: TOC folded, open with Enter, follow a link with Enter.
  const c2 = await newContext(browser, { width: 768, height: 900 });
  const help = await c2.newPage();
  await help.goto(`${BASE}/examples/help.html`);
  await sleep(1500);
  const h = result.help;
  h.summary = await tabTo(help, (f) => f.tag === 'SUMMARY');
  await help.keyboard.press('Enter');
  await sleep(300);
  h.open = await help.evaluate(() => document.querySelector('.sa-toc').open);
  h.link = await tabTo(help, (f) => f.tag === 'A' && f.inView !== undefined && /이벤트|events/i.test(f.text), 20) ?? await focus(help);
  await help.keyboard.press('Enter');
  await sleep(800);
  h.hash = await help.evaluate(() => location.hash);
  h.walk = await walk(help, 25, 'help-768');
  result.containment['help-390'] = null;
  await help.setViewportSize({ width: 390, height: 900 });
  await sleep(500);
  result.containment['help-390'] = await contained(help);
  await help.goto(`${BASE}/examples/index.html`);
  await sleep(2500);
  result.containment['demo-390'] = await contained(help);
  await help.goto(`${BASE}/examples/guide.html`);
  await sleep(1500);
  result.containment['guide-390'] = await contained(help);
  await shot(help, 'D12/keys-help.png');
  await c2.close();

  // Admin editor preview: 768 (collapsed) with the opener, then 1280.
  for (const width of [768, 1280]) {
    const c3 = await newContext(browser, { width, height: 1000 });
    const admin = await c3.newPage();
    await login(admin);
    await admin.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
    await admin.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
    await sleep(3000);
    const a = { width };
    await admin.getByRole('heading', { name: '플레이어 미리보기' }).click();
    if (width === 768) {
      a.opener = await tabTo(admin, (f) => f.tag === 'BUTTON' && f.text === '열기', 200);
      await admin.keyboard.press('Enter');
      await sleep(3000);
      a.openerAfter = await admin.locator('aside.aa-editor-preview button[aria-expanded]').getAttribute('aria-expanded');
      a.containment = await contained(admin);
    }
    a.radio = await tabTo(admin, (f) => f.type === 'radio', 60);
    await admin.keyboard.press('ArrowRight');
    await sleep(800);
    a.radioAfter = { focused: await focus(admin), scale: await admin.locator('aside.aa-editor-preview .sa-stage-bar .sa-small').innerText().catch(() => null) };
    a.scene = await tabTo(admin, (f) => f.tag === 'BUTTON' && /끝 직전/.test(f.text), 30);
    await admin.keyboard.press('Enter');
    const e3 = Date.now() + 25000;
    while (Date.now() < e3 && !/포스트롤/.test(await admin.locator('.sa-stage-now').innerText().catch(() => ''))) await sleep(400);
    a.nowAfterScene = (await admin.locator('.sa-stage-now').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    a.demoLink = await tabTo(admin, (f) => f.tag === 'A' && /데모에서 열기/.test(f.text), 30);
    if (a.demoLink) {
      const [popup] = await Promise.all([c3.waitForEvent('page', { timeout: 8000 }), admin.keyboard.press('Enter')]);
      await popup.waitForLoadState();
      a.popup = popup.url().replace(BASE, '');
      await popup.close();
    }
    await shot(admin, `D12/keys-admin-${width}.png`);
    result.admin[width] = a;
    await c3.close();
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('D12/keys.json', result);
await browser.close();
