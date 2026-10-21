// L-3-QA scenario 6: a video without captions + controls.captions on (the sample lecture: built-in lms preset has
// captions: true, the lecture has no caption track). 1280: no "자막 없음" text on screen, disabled icon, tooltip and
// accessible name. 390: the settings menu captions item is disabled with the value "없음". Chromium.
import { BASE, launch, consoleCollector, save, shot, sleep } from './lib.mjs';

const b = await launch();
const r = { steps: {} };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };
// Visible text nodes containing the phrase, shadow roots included (tooltips count only while shown).
const visibleText = (page, phrase) => page.evaluate((phrase) => {
  const hits = [];
  const walk = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.includes(phrase)) continue;
      const el = n.parentElement;
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const shown = rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && !el.closest('[hidden]') && el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false;
      hits.push({ tag: el.localName, cls: String(el.className).slice(0, 60), shown });
    }
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document.body);
  return hits;
}, phrase);

for (const [W, H] of [[1280, 900], [390, 844]]) {
  const page = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errors = consoleCollector(page);
  const player = page.getByRole('group', { name: '미디어 플레이어' });
  try {
    await page.goto(`${BASE}/examples/lecture.html`);
    await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
    await sleep(1500);
    await player.hover({ position: { x: 100, y: 60 } });
    await sleep(400);
    const idle = (await visibleText(page, '자막 없음')).filter((h) => h.shown);
    if (W === 1280) {
      const btn = player.getByRole('button', { name: '자막 없음' });
      const info = { count: await btn.count(), disabled: await btn.isDisabled().catch(() => null), visible: await btn.isVisible().catch(() => null), opacity: await btn.evaluate((e) => getComputedStyle(e).opacity).catch(() => null) };
      await btn.hover({ force: true });
      await sleep(900);
      const tip = (await visibleText(page, '자막 없음')).filter((h) => h.shown);
      await shot(page, 's6-1280-tooltip.png');
      step('1280: no on-screen "자막 없음" text at rest; disabled icon; tooltip and name "자막 없음"', idle.length === 0 && info.count === 1 && info.disabled && info.visible && tip.length >= 1, { restVisibleHits: idle, button: info, tooltipVisibleHits: tip });
    } else {
      const btn = player.getByRole('button', { name: '자막 없음' });
      const btnVisible = await btn.isVisible().catch(() => false);
      await player.getByRole('button', { name: '설정' }).click();
      await sleep(500);
      const items = player.getByRole('menuitem');
      const list = [];
      for (let i = 0; i < await items.count(); i++) list.push({ name: await items.nth(i).evaluate((e) => e.getAttribute('aria-label') ?? e.textContent.replace(/\s+/g, ' ').trim()), text: (await items.nth(i).innerText()).replace(/\s+/g, ' ').trim(), disabled: await items.nth(i).isDisabled() });
      const menuAria = await player.getByRole('menu').ariaSnapshot();
      await shot(page, 's6-390-menu.png');
      const cap = list.find((x) => /자막|캡션/.test(x.name + x.text));
      step('390: settings captions item disabled with value "없음"', Boolean(cap && cap.disabled && /없음/.test(cap.text) && /자막/.test(cap.text)), { captionButtonVisible: btnVisible, restVisibleHits: idle, menu: list, menuAria, note: 'menu[].name는 textContent(숨은 "끄기" 포함), 접근성 이름은 menuAria가 기준' });
    }
  } catch (e) {
    r[`error${W}`] = String(e).slice(0, 600);
    console.log('ERROR', W, r[`error${W}`]);
  }
  r[`consoleErrors${W}`] = errors;
  await page.context().close();
}
save('s6-chromium.json', r);
await b.close();
