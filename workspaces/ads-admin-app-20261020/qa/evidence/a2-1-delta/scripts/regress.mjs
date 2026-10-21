// A2-1-QA-DELTA short regression: L01 site preset (QA 강조색 복제) colour and a pre-roll start, L02 unchanged reload
// revalidates to 304 (CDP), P01 built-in rows, P03 apply dialog closes on Esc with focus back on the trigger, and R01
// the editor at 390 without horizontal scroll. Nothing is saved or applied.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openList, presetList } from './admin.mjs';
import { CONTENT, LOADER_TAG, cdpNetwork, clickPlay, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const SITE = 'p-lbelw4d2xx';
const browser = await launch();
const result = { L01: {}, L02: {}, P01: {}, P03: {}, R01: {} };
const active = (page) => page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 30) }));

// L01 + L02: visitor page on the site preset.
{
  const url = writePaste('regress-site', `${placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT })}\n${LOADER_TAG}`);
  const context = await newContext(browser);
  try {
    const { page, solad } = await openPage(context, 'about:blank');
    const net = await cdpNetwork(page);
    await page.goto(url);
    const s = await waitQa(page, (q) => q.ready.length || q.errors.length, 15000);
    await sleep(1200);
    const p = (await players(page))[0];
    result.L01.ready = s.ready;
    result.L01.fill = p.skin?.fillBefore;
    result.L01.accentVar = p.skin?.accentVar;
    await shot(page, 'regress/L01-ready.png');
    await clickPlay(page, 0);
    const ad = await waitQa(page, (q) => q.ads.some((a) => a.type === 'start'), 20000);
    await sleep(1500);
    result.L01.adEvents = ad.ads.map((a) => `${a.type}@${a.contentTime}`);
    await shot(page, 'regress/L01-ad.png');
    result.L01.solad = solad.map((l) => l.text);

    const firstCount = net.presets().length;
    result.L02.first = net.presets();
    for (const n of [1, 2]) {
      await page.reload();
      await waitQa(page, (q) => q.ready.length || q.errors.length, 15000);
      await sleep(1200);
    }
    result.L02.reloads = net.presets().slice(firstCount);
    result.L02.fillAfter = (await players(page))[0].skin?.fillBefore;
    result.L02.errors = net.errors();
    await shot(page, 'regress/L02-after-reload.png');
  } catch (error) {
    result.L01.error = String(error).slice(0, 1500);
  }
  await context.close();
}

// P01 + P03 at 1280, R01 at 390.
for (const width of [1280, 390]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  try {
    await login(page);
    if (width === 1280) {
      const list = await presetList(page);
      await openList(page);
      for (const { id, name } of list.presets.filter((p) => p.builtIn)) {
        const state = (label) => page.getByRole('button', { name: `${name} ${label}`, exact: true }).evaluate((el) => ({ disabled: el.disabled || el.getAttribute('aria-disabled') === 'true', reason: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((x) => document.getElementById(x)?.textContent?.trim()) }));
        const row = page.getByRole('row').filter({ hasText: id });
        result.P01[id] = { mark: await row.getByText('내장', { exact: true }).count(), edit: await state('수정'), duplicate: await state('복제'), delete: await state('삭제'), apply: await state('사이트에 적용') };
      }
      result.P01.site = list.defaultPresetId;
      await shot(page, 'regress/P01-list.png', { fullPage: true });

      const trigger = page.getByRole('button', { name: '둥근 테두리 사이트에 적용', exact: true });
      await trigger.click();
      await page.getByRole('dialog').waitFor();
      result.P03.firstFocus = await active(page);
      await shot(page, 'regress/P03-dialog.png');
      await page.keyboard.press('Escape');
      await sleep(400);
      result.P03.afterEsc = { open: await page.getByRole('dialog').count(), focus: await active(page) };
      result.P03.siteAfter = (await presetList(page)).defaultPresetId;
    } else {
      await page.goto(`${BASE}/#/players/edit/${SITE}`);
      await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
      await sleep(900);
      result.R01.editor390 = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth, ok: document.documentElement.scrollWidth <= innerWidth }));
      await shot(page, 'regress/R01-editor-390.png', { fullPage: true });
    }
  } catch (error) {
    result[width === 1280 ? 'P01' : 'R01'].error = String(error).slice(0, 1500);
  }
  result[width === 1280 ? 'P03' : 'R01'].nativeDialogs = dialogs;
  result[width === 1280 ? 'P03' : 'R01'].console = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
  await context.close();
}
save('regress/result.json', result);
await browser.close();
