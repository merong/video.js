// A2-1-QA P03 apply dialog (Esc and 취소 close it, focus returns, no native confirm), P04 초기 설정 contents on a
// standalone install, and R01 list/editor/setup at 390/768/1280 with the horizontal-scroll check plus the loader page
// at 390. The apply dialog is only opened and cancelled here; nothing is applied.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openList } from './admin.mjs';
import { CONTENT, LOADER_TAG, openPage, waitQa, placeholder, writePaste } from './a2.mjs';

const SITE = 'p-qrgzuc8ste';
const browser = await launch();
const result = { P03: {}, P04: {}, R01: {} };
const overflow = (page) => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth, ok: document.documentElement.scrollWidth <= innerWidth }));
const active = (page) => page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 30) }));

for (const width of [1280, 768, 390]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  const r = {};
  try {
    await login(page);
    await openList(page);
    r.list = await overflow(page);
    await shot(page, `R01/list-${width}.png`, { fullPage: true });
    await page.goto(`${BASE}/#/players/edit/${SITE}`);
    await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
    await sleep(900);
    r.editor = await overflow(page);
    await page.goto(`${BASE}/#/players/setup`);
    await page.getByRole('heading', { name: '설치 코드', exact: true }).waitFor();
    await sleep(800);
    r.setupEmpty = await overflow(page);
    await page.getByRole('textbox', { name: '영상 ID', exact: true }).first().fill('a1-qa-video-1');
    await page.keyboard.press('Tab');
    await sleep(500);
    await page.locator('summary', { hasText: '예전 정적 코드 보기' }).click();
    await sleep(500);
    r.setupFilledOpen = await overflow(page);
    r.wideBlocks = await page.evaluate(() => [...document.querySelectorAll('main pre, main table')].map((el) => ({ tag: el.tagName, client: el.clientWidth, scroll: el.scrollWidth, scrollsInside: el.scrollWidth > el.clientWidth, overflowX: getComputedStyle(el).overflowX, parentOverflowX: getComputedStyle(el.parentElement).overflowX })));
    await shot(page, `R01/setup-${width}.png`, { fullPage: true });

    if (width === 1280) {
      // P03: the apply dialog on a non-applied preset.
      await openList(page);
      const trigger = page.getByRole('button', { name: '둥근 테두리 사이트에 적용', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      result.P03.open = { firstFocus: await active(page), modal: await dialog.evaluate((el) => ({ tag: el.tagName, modal: el.matches(':modal') || el.getAttribute('aria-modal') === 'true', labelledBy: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent?.trim() ?? null })) };
      await shot(page, 'P03/dialog-open.png');
      await page.keyboard.press('Escape');
      await sleep(400);
      result.P03.afterEsc = { open: await page.getByRole('dialog').count(), focus: await active(page) };
      await trigger.click();
      await dialog.waitFor();
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      await sleep(400);
      result.P03.afterCancel = { open: await page.getByRole('dialog').count(), focus: await active(page) };
      // Tab stays inside the dialog.
      await trigger.click();
      await dialog.waitFor();
      const seen = [];
      for (let i = 0; i < 4; i += 1) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => ({ inDialog: !!document.activeElement?.closest('dialog, [role="dialog"]'), label: document.activeElement?.textContent?.trim().slice(0, 20) })));
      }
      result.P03.tabCycle = seen;
      await page.keyboard.press('Escape');
      await sleep(300);
      result.P03.siteUnchanged = await page.evaluate(async () => (await (await fetch('/api/index.php?action=player-presets')).json()).data.defaultPresetId);
      result.P03.nativeDialogs = [...dialogs];

      // P04: setup contents.
      await page.goto(`${BASE}/#/players/setup`);
      await page.getByRole('heading', { name: '설치 코드', exact: true }).waitFor();
      await sleep(800);
      const main = page.locator('main');
      result.P04.loaderCodeBeforeId = await main.locator('pre').evaluateAll((els) => els.filter((e) => e.textContent.includes('data-solad-player')).length);
      result.P04.problemBeforeId = (await main.innerText()).split('\n').filter((l) => /영상 ID를/.test(l)).slice(0, 3);
      await page.getByRole('textbox', { name: '영상 ID', exact: true }).first().fill('a1-qa-video-1');
      await page.keyboard.press('Tab');
      await sleep(500);
      result.P04.loaderCode = (await main.locator('pre').allTextContents()).find((c) => c.includes('data-solad-player'));
      result.P04.jsApi = (await main.locator('pre').allTextContents()).find((c) => c.includes('mount('));
      result.P04.dataTable = await page.locator('section, .sa-card').filter({ has: page.getByText('자리 요소 속성 (data-*)', { exact: true }) }).locator('table').evaluate((t) => ({ headers: [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim()), rows: [...t.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('th, td')?.textContent.trim()) })).catch((e) => String(e).slice(0, 200));
      const text = await main.innerText();
      result.P04.sameSiteNote = text.split('\n').filter((l) => /같은 사이트/.test(l));
      result.P04.noVisitorErrorNote = text.split('\n').filter((l) => /오류가 보이지 않아요/.test(l));
      result.P04.gnuboardNotice = { planned: (text.match(/준비 중인 기능/g) || []).length, boardIdFormat: /게시판:글번호/.test(text), gnuboardWord: (text.match(/그누보드|GnuBoard/gi) || []).length };
      result.P04.host = await page.evaluate(() => document.documentElement.dataset.host ?? null);
      const summary = page.locator('summary', { hasText: '예전 정적 코드 보기' });
      await summary.focus();
      await page.keyboard.press('Enter');
      await sleep(300);
      const afterEnter = await summary.evaluate((s) => s.parentElement.open);
      await page.keyboard.press('Space');
      await sleep(300);
      const afterSpace = await summary.evaluate((s) => s.parentElement.open);
      await page.keyboard.press('Space');
      await sleep(300);
      result.P04.disclosure = { afterEnter, afterSpace, afterSpace2: await summary.evaluate((s) => s.parentElement.open), focusOnSummary: await summary.evaluate((s) => document.activeElement === s) };
      await shot(page, 'P04/setup-1280.png', { fullPage: true });
    }
  } catch (error) {
    r.error = String(error).slice(0, 1500);
    await shot(page, `R01/error-${width}.png`, { fullPage: true }).catch(() => {});
  }
  r.nativeDialogs = dialogs;
  r.console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
  result.R01[width] = r;
  await context.close();
}

// The loader player page at 390.
{
  const url = writePaste('r01-390', `<h1 style="font:600 18px system-ui">QA 기사 제목</h1>\n<p style="font:14px system-ui">본문 문단입니다.</p>\n${placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT, 'data-title': 'QA 제목' })}\n${LOADER_TAG}`);
  const context = await newContext(browser, { width: 390, height: 844 });
  const { page } = await openPage(context, url);
  const ready = (await waitQa(page, (q) => q.ready.length || q.errors.length, 12000)).ready;
  await sleep(1200);
  const box = await page.locator('[data-solad-player]').boundingBox();
  await shot(page, 'R01/loader-390.png', { fullPage: true });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await waitQa(page, (s) => s.ads.some((a) => a.type === 'start'), 15000);
  await sleep(1500);
  await shot(page, 'R01/loader-390-ad.png', { fullPage: true });
  result.R01.loader390 = { ready, box: { w: Math.round(box.width), h: Math.round(box.height) }, ...(await overflow(page)) };
  await context.close();
}
save('P03-P04-R01/result.json', result);
await browser.close();
