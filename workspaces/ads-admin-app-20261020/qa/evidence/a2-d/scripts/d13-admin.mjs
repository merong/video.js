// A2-D-QA D13 admin: disabled controls (built-in 수정/삭제 on the list, the schedule's 게시 and 광고 추가 when they are
// unavailable, the editor's demo link after an edit) are read for disabled/aria-disabled, text vs background contrast,
// opacity, the reason text, and whether they take focus with a visible ring. A smoke pass opens the player list, an
// editor, setup, options and the schedule screen. Every 4xx response URL is collected on all pages. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const bad = [];
context.on('response', (res) => { if (res.status() >= 400) bad.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')} (${res.request().frame()?.url().replace(BASE, '') ?? ''})`); });
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { disabled: [], smoke: {} };

// Contrast of an element's text against the first opaque background up the tree.
const look = (loc, label) => loc.evaluate((el, label) => {
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  let bgEl = el;
  let bg = getComputedStyle(el).backgroundColor;
  while (bgEl && (rgb(bg)[3] === 0 || /transparent/.test(bg))) { bgEl = bgEl.parentElement; bg = bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(255,255,255)'; }
  const s = getComputedStyle(el);
  const L1 = lum(rgb(s.color));
  const L2 = lum(rgb(bg));
  const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  return {
    label, tag: el.tagName, text: el.textContent.trim().slice(0, 30), disabled: el.disabled ?? null, ariaDisabled: el.getAttribute('aria-disabled'), tabindex: el.getAttribute('tabindex'),
    color: s.color, bg, opacity: s.opacity, cursor: s.cursor, contrast: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100,
    reason: ids.map((x) => document.getElementById(x)?.textContent.trim()).filter(Boolean), title: el.getAttribute('title'),
  };
}, label);

async function focusRing(loc) {
  await loc.focus().catch(() => {});
  return loc.evaluate((el) => { const s = getComputedStyle(el); return { focused: document.activeElement === el, outline: `${s.outlineStyle} ${s.outlineWidth}`, shadow: s.boxShadow === 'none' ? null : s.boxShadow.slice(0, 40) }; });
}

try {
  await login(page);
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('table').first().waitFor();
  await sleep(1000);
  result.smoke.list = { rows: await page.getByRole('row').count(), heading: await page.locator('main h1, main h2').first().innerText() };
  for (const name of ['기본', '둥근 테두리']) {
    for (const action of ['수정', '삭제']) {
      const b = page.getByRole('button', { name: `${name} ${action}`, exact: true }).or(page.getByRole('link', { name: `${name} ${action}`, exact: true })).first();
      if (!(await b.count())) { result.disabled.push({ label: `${name} ${action}`, missing: true }); continue; }
      result.disabled.push({ ...(await look(b, `list ${name} ${action}`)), ring: await focusRing(b) });
    }
  }
  const enabled = page.getByRole('button', { name: 'QA 강조색 복제 삭제', exact: true });
  if (await enabled.count()) result.enabledRef = await look(enabled, 'list QA 강조색 복제 삭제 (enabled reference)');
  await shot(page, 'D13/admin-list.png', { fullPage: true });

  // Editor: after an edit the demo link is aria-disabled.
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(2000);
  result.smoke.editor = { form: await page.getByRole('form', { name: '프리셋 수정' }).count(), name: await page.getByRole('textbox', { name: /이름/ }).first().inputValue().catch(() => null) };
  await page.locator('#aa-preset-playback-loop').click();
  await sleep(600);
  const demoLink = page.locator('aside.aa-editor-preview').getByText('데모에서 열기', { exact: false }).first();
  result.disabled.push({ ...(await look(demoLink, 'editor 데모에서 열기 after edit')), ring: await focusRing(demoLink) });
  await shot(page, 'D13/admin-editor-dirty.png');
  page.once('dialog', (d) => d.dismiss().catch(() => {}));
  await page.locator('#aa-preset-playback-loop').click();
  await sleep(400);

  await page.goto(`${BASE}/#/players/setup`);
  await page.getByRole('heading', { name: '설치 코드', exact: true }).waitFor({ timeout: 15000 });
  await sleep(1000);
  result.smoke.setup = { codeBlocks: await page.locator('main pre').count(), headings: await page.locator('main h2').allInnerTexts() };
  await page.goto(`${BASE}/#/players/options`);
  await page.locator('main table:visible').first().waitFor();
  result.smoke.options = { tables: await page.locator('main table:visible').count() };

  // Schedule: site default loaded with no change, so 게시 should be unavailable; 광고 추가 state as found.
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(1200);
  result.smoke.schedule = { buttons: await page.locator('main button').evaluateAll((bs) => bs.filter((b) => b.getClientRects().length).map((b) => `${b.textContent.trim().slice(0, 20)}${b.disabled ? '[disabled]' : ''}${b.getAttribute('aria-disabled') === 'true' ? '[aria-disabled]' : ''}`)) };
  for (const re of [/^게시/, /광고 추가/]) {
    const b = page.locator('main button:visible', { hasText: re }).first();
    if (await b.count()) result.disabled.push({ ...(await look(b, `schedule ${re.source}`)), ring: await focusRing(b) });
  }
  await shot(page, 'D13/admin-schedule.png', { fullPage: true });

  // Public pages for the 4xx list.
  for (const path of ['/examples/index.html', '/examples/guide.html', '/examples/help.html', '/examples/play-test.html?video=grok-demo-scene-01']) {
    await page.goto(`${BASE}${path}`);
    await sleep(2500);
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D13/admin-error.png', { fullPage: true }).catch(() => {});
}
result.bad = [...new Set(bad)];
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
save('D13/admin.json', result);
await browser.close();
