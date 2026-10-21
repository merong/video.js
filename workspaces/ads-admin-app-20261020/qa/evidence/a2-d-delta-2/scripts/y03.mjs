// A2-D-QA-DELTA-2 Y03 short regression at 1280×800: built-in rounded and accent — 데모에서 열기 opens a new window with
// ?preset=<id> and that preset selected; 장면 바로가기 미드롤 앞 and 끝 직전 update 최근 광고 진행; the sticky containing block
// (.aa-builtin) against the card. Editor p-i0aecb28w3 — the preview aside sits right of the form and reflects 포스터 and
// 제목 toggles (not saved). Keyboard on rounded — Tab reaches 복제해서 새로 만들기, a 폭 보기 radio (ArrowRight), 끝 직전
// (Enter), 데모에서 열기 (Enter → popup). Every 4xx response and console error is kept with its URL; action=events counted.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const result = { builtIn: [], editor: {}, keys: {} };
const context = await newContext(browser, { width: 1280, height: 800 });
const req = requestLog(context);
const bad = [];
context.on('response', (res) => { if (res.status() >= 400) bad.push(`${res.status()} ${res.url().replace(BASE, '')}`); });
const page = await context.newPage();
const logs = consoleCollector(page);
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const box = (loc) => loc.boundingBox().then((b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }).catch(() => null);

async function waitFor(fn, test, timeout = 25000) {
  const end = Date.now() + timeout;
  let v = await fn().catch(() => null);
  while (Date.now() < end && !test(v)) { await sleep(400); v = await fn().catch(() => null); }
  return v;
}

const focus = () => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const s = getComputedStyle(el);
  return { tag: el.tagName, type: el.type || null, value: el.type === 'radio' ? el.value : undefined, checked: el.type === 'radio' ? el.checked : undefined, text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none') };
});
async function tabTo(test, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const f = await focus();
    if (test(f)) return { ...f, presses: i + 1 };
  }
  return null;
}

const readFrame = () => frame()?.evaluate(() => {
  const vp = document.querySelector('#player video-player');
  return vp ? { contentTitle: vp.getAttribute('content-title'), poster: vp.getAttribute('poster') } : null;
}) ?? Promise.resolve(null);

try {
  await login(page);
  for (const id of ['rounded', 'accent']) {
    await page.goto(`${BASE}/#/players/edit/${id}`);
    const card = page.locator('section.aa-builtin-preview');
    await card.waitFor({ timeout: 15000 });
    await sleep(2000);
    const r = { id };
    r.containingBlock = { grid: await box(page.locator('.aa-builtin')), left: await box(page.locator('.aa-builtin .aa-stack').first()), card: await box(card) };
    const now = () => card.locator('.sa-stage-now').innerText().then((t) => t.replace(/\s+/g, ' ').trim());
    await waitFor(() => card.locator('.sa-stage-tools button', { hasText: '미드롤 앞' }).isEnabled(), Boolean);
    await card.locator('.sa-stage-tools button', { hasText: '미드롤 앞' }).click();
    r.mid = await waitFor(now, (t) => /미드롤/.test(t ?? ''), 30000);
    await card.locator('.sa-stage-tools button', { hasText: '끝 직전' }).click();
    r.end = await waitFor(now, (t) => /포스트롤/.test(t ?? ''), 30000);
    await shot(page, `Y03/scenes-${id}.png`);
    const demo = card.getByRole('link', { name: /데모에서 열기/ });
    r.demo = { href: await demo.getAttribute('href'), target: await demo.getAttribute('target') };
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 10000 }), demo.click()]);
    await popup.waitForLoadState();
    await popup.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 });
    await sleep(1500);
    r.demo.popup = { url: popup.url().replace(BASE, ''), selected: await popup.locator('#preset').inputValue() };
    await popup.close();
    result.builtIn.push(r);
  }

  // Editor: aside right of the form, poster/title toggles reach the frame.
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  const aside = page.locator('aside.aa-editor-preview');
  await aside.waitFor({ timeout: 15000 });
  await sleep(3000);
  const e = result.editor;
  e.aside = await box(aside);
  e.form = await box(page.locator('#aa-preset-name'));
  e.asideTag = await aside.evaluate((el) => el.tagName);
  e.rightColumn = Boolean(e.aside && e.form && e.aside.x > e.form.x + e.form.w);
  e.opener = await aside.locator('.sa-ppv-h button[aria-expanded]').count();
  e.initial = { poster: await page.locator('#aa-preset-display-poster').isChecked(), title: await page.locator('#aa-preset-display-title').isChecked(), frame: await waitFor(readFrame, Boolean) };
  e.toggles = [];
  for (const [poster, title] of [[true, true], [false, false]]) {
    for (const [sel, on] of [['#aa-preset-display-poster', poster], ['#aa-preset-display-title', title]]) {
      const c = page.locator(sel);
      if ((await c.isChecked()) !== on) await c.click();
    }
    const f = await waitFor(readFrame, (x) => x && Boolean(x.poster) === poster && Boolean(x.contentTitle) === title);
    e.toggles.push({ poster, title, frame: f });
    await aside.locator('.sa-stage-frame iframe').screenshot({ path: `${(await import('./lib.mjs')).EV}/Y03/editor-poster-${poster ? 'on' : 'off'}-title-${title ? 'on' : 'off'}.png` }).catch(() => {});
  }
  await shot(page, 'Y03/editor-1280.png');

  // Keyboard on rounded (leave the editor without saving; a confirm may appear).
  page.on('dialog', (d) => { result.keys.dialog = d.message().slice(0, 120); d.dismiss().catch(() => {}); });
  await page.goto(`${BASE}/#/players/edit/rounded`);
  const card = page.locator('section.aa-builtin-preview');
  await card.waitFor({ timeout: 15000 });
  await sleep(2000);
  const k = result.keys;
  await page.locator('main').getByRole('heading', { name: '프리셋 수정' }).click().catch(async () => { await page.locator('.aa-builtin .sa-note').first().click(); });
  k.duplicate = await tabTo((f) => f.tag === 'BUTTON' && /복제해서 새로 만들기/.test(f.text), 40);
  k.radio = await tabTo((f) => f.type === 'radio', 40);
  await page.keyboard.press('ArrowRight');
  await sleep(600);
  k.radioAfter = await focus();
  await waitFor(() => card.locator('.sa-stage-tools button', { hasText: '끝 직전' }).isEnabled(), Boolean);
  k.scene = await tabTo((f) => f.tag === 'BUTTON' && /끝 직전/.test(f.text), 40);
  await page.keyboard.press('Enter');
  k.nowAfter = await waitFor(() => card.locator('.sa-stage-now').innerText().then((t) => t.replace(/\s+/g, ' ').trim()), (t) => /포스트롤/.test(t ?? ''), 30000);
  k.demo = await tabTo((f) => f.tag === 'A' && /데모에서 열기/.test(f.text), 40);
  if (k.demo) {
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 10000 }), page.keyboard.press('Enter')]);
    await popup.waitForLoadState();
    await popup.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 });
    await sleep(1000);
    k.popup = { url: popup.url().replace(BASE, ''), selected: await popup.locator('#preset').inputValue() };
    await popup.close();
  }
  await shot(page, 'Y03/keys-rounded-1280.png');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'Y03/error.png', { fullPage: true }).catch(() => {});
}
result.bad = bad;
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events().length;
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
await context.close();
save('Y03/result.json', result);
await browser.close();
