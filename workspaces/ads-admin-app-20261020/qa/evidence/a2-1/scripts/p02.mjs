// A2-1-QA P02 preset editor: SectionNav per width, heading focus after a jump, muted lock under autoplay, the loop
// post-roll warning, Segmented preload arrow keys, native locks, save-bar text, and error linking with focus (local
// validation, and a 422 from a routed player-preset-save response). Nothing here is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';

const SITE = 'p-qrgzuc8ste';
const NATIVE = 'p-6aiokv34yw';
const browser = await launch();
const result = {};
const active = (page) => page.evaluate(() => {
  const el = document.activeElement;
  return { tag: el?.tagName, id: el?.id || null, text: (el?.textContent || '').trim().slice(0, 40), name: el?.getAttribute('aria-label') || null };
});
const describedBy = (loc) => loc.evaluate((el) => ({
  checked: el.getAttribute('aria-checked') ?? el.checked ?? null,
  disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
  described: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()),
}));
const sw = (page, name) => page.getByRole('switch', { name, exact: true });

async function openEdit(page, id) {
  await page.goto(`${BASE}/#/players/edit/${id}`);
  await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
  await sleep(900);
}

for (const width of [1280, 768, 390]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  const r = {};
  try {
    await login(page);
    await openEdit(page, SITE);
    r.editorClass = await page.locator('form.aa-editor').getAttribute('class');
    r.nav = await page.evaluate(() => {
      const nav = document.querySelector('.aa-editor-nav nav.sa-secnav');
      const select = document.querySelector('.aa-editor-nav select');
      const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), visible: b.width > 0 && getComputedStyle(el).display !== 'none' }; };
      return { navClass: nav?.className ?? null, navBox: box(nav), links: nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent.trim()) : [], select: select ? { label: document.querySelector(`label[for="${select.id}"]`)?.textContent.trim(), options: [...select.options].map((o) => o.textContent.trim()), box: box(select) } : null };
    });
    r.overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
    await shot(page, `R01/editor-${width}.png`, { fullPage: true });

    // Jump to 재생 동작 and check the focused heading and the hash.
    const hashBefore = await page.evaluate(() => location.hash);
    if (r.nav.select) {
      await page.locator('.aa-editor-nav select').selectOption({ label: '재생 동작' });
    } else {
      await page.locator('.aa-editor-nav nav.sa-secnav a', { hasText: '재생 동작' }).click();
    }
    await sleep(700);
    await shot(page, `P02/jump-${width}.png`);
    r.jump = { headingTop: await page.locator('#aa-preset-section-playback-title').evaluate((el) => Math.round(el.getBoundingClientRect().top)), viewport: await page.evaluate(() => innerHeight), scrollY: await page.evaluate(() => Math.round(scrollY)), focus: await active(page), hashBefore, hashAfter: await page.evaluate(() => location.hash), current: await page.evaluate(() => document.querySelector('.aa-editor-nav [aria-current="true"]')?.textContent?.trim() ?? document.querySelector('.aa-editor-nav select')?.selectedOptions[0]?.textContent) };

    if (width === 1280) {
      // Muted lock under autoplay.
      r.mutedBefore = await describedBy(sw(page, '음소거로 시작'));
      await sw(page, '자동 재생').click();
      await sleep(300);
      r.mutedLocked = await describedBy(sw(page, '음소거로 시작'));
      r.mutedBadge = (await page.locator('fieldset', { hasText: '시작과 끝' }).innerText()).split('\n').filter((l) => /자동 재생 때문에/.test(l));
      await shot(page, 'P02/muted-locked.png', { fullPage: true });
      await sw(page, '자동 재생').click();
      await sleep(300);
      r.mutedAfterOff = await describedBy(sw(page, '음소거로 시작'));

      // Loop warning.
      await sw(page, '반복 재생').click();
      await sleep(300);
      r.loopNote = (await page.locator('fieldset', { hasText: '시작과 끝' }).innerText()).split('\n').filter((l) => /포스트롤/.test(l));
      await shot(page, 'P02/loop-warning.png', { fullPage: true });
      await sw(page, '반복 재생').click();
      await sleep(300);
      r.loopNoteAfterOff = await page.getByText('포스트롤은 재생되지 않아요').count();

      // Segmented preload: arrow keys.
      const seg = page.locator('#aa-preset-playback-preload').locator('xpath=ancestor::*[@role="radiogroup"][1]');
      const checked = () => seg.evaluate((el) => {
        const radios = [...el.querySelectorAll('input[type="radio"]')];
        const on = radios.find((x) => x.getAttribute('aria-checked') === 'true' || x.checked);
        return { role: el.getAttribute('role'), label: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim(), count: radios.length, checked: on ? (on.textContent.trim() || on.closest('label')?.textContent.trim()) : null, focused: document.activeElement === on, help: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()) };
      });
      r.preload = { start: await checked() };
      await seg.locator('input:checked').first().focus();
      await page.keyboard.press('ArrowRight');
      await sleep(200);
      r.preload.right = await checked();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await sleep(200);
      r.preload.leftLeft = await checked();
      await page.keyboard.press('ArrowRight');
      await sleep(200);
      r.preload.back = await checked();
      await shot(page, 'P02/preload.png');

      r.savebarSite = (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim();

      // Local validation: empty name.
      await page.locator('#aa-preset-name').fill('');
      await page.getByRole('button', { name: '프리셋 저장' }).click();
      await sleep(700);
      r.localError = { focus: await active(page), savebar: (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim(), nameDescribed: await describedBy(page.locator('#aa-preset-name')), invalid: await page.locator('#aa-preset-name').getAttribute('aria-invalid'), navErrors: await page.locator('.aa-editor-nav').innerText() };
      await shot(page, 'P02/local-error.png', { fullPage: true });
      await openEdit(page, SITE);

      // 422 from the server (routed once) on theme.accentColor.
      let routed = 0;
      await page.route((url) => new URL(url).searchParams.get('action') === 'player-preset-save', async (route) => {
        routed += 1;
        await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'validation', message: '입력값을 확인해 주세요.', fields: { 'theme.accentColor': '입력값을 확인해 주세요.' } } }) });
      });
      await page.getByRole('button', { name: '프리셋 저장' }).click();
      await sleep(1000);
      r.serverError = { routed, focus: await active(page), field: await describedBy(page.locator('#aa-preset-theme-accentColor')), invalid: await page.locator('#aa-preset-theme-accentColor').getAttribute('aria-invalid'), status: (await page.getByRole('status').allInnerTexts()).concat(await page.getByRole('alert').allInnerTexts()).filter(Boolean), savebar: (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim(), nav: (await page.locator('.aa-editor-nav').innerText()).replace(/\s+/g, ' ') };
      await shot(page, 'P02/server-422.png', { fullPage: true });
      await page.unroute((url) => new URL(url).searchParams.get('action') === 'player-preset-save');

      // Native preset: theme and title locked with reasons, savebar for a non-site preset.
      await openEdit(page, NATIVE);
      r.native = {
        title: await describedBy(sw(page, '제목 표시')),
        themeNote: (await page.locator('main').innerText()).split('\n').filter((l) => /브라우저 기본 컨트롤|기본 video에서는|쓰지 않음|쓸 수 없어요/.test(l)).slice(0, 6),
        accentDisabled: await page.locator('#aa-preset-theme-accentColor').evaluate((el) => el.disabled || !!el.closest('fieldset[disabled]')).catch(() => 'missing'),
        nav: (await page.locator('.aa-editor-nav').innerText()).replace(/\s+/g, ' '),
        savebar: (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim(),
      };
      await shot(page, 'P02/native.png', { fullPage: true });
    } else {
      r.savebarSite = (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim();
    }
  } catch (error) {
    r.error = String(error).slice(0, 1500);
    await shot(page, `P02/error-${width}.png`, { fullPage: true }).catch(() => {});
  }
  r.nativeDialogs = dialogs;
  r.console = logs.filter((l) => !/favicon|404|422/.test(l.text ?? ''));
  result[width] = r;
  await context.close();
}
save('P02/result.json', result);
await browser.close();
