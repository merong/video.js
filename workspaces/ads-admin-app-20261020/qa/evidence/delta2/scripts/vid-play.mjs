// A1-QA-DELTA-2 video ID observation: the schedule screen's 재생 확인 → 고정 영상 ID field with rejected values.
// Observation only: records link hrefs (code points only), disabled state, field aria and the status text.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep, apiCalls } from './lib.mjs';

const VALUES = { rlo: 'a1‮qa', 'ideographic-space-only': '　', 'c1-nel': 'a1\u0085qa', valid: 'a1-qa-video-1' };
const cps = (s) => [...(s ?? '')].filter((c) => c.codePointAt(0) > 0x7e || c.codePointAt(0) < 0x20).map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

const browser = await launch();
const context = await newContext(browser, { height: 1100 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
try {
  await login(page);
  for (const [key, value] of Object.entries(VALUES)) {
    await page.goto(`${BASE}/#/schedule`);
    await page.getByRole('heading', { name: '재생 확인' }).waitFor();
    await sleep(800);
    const box = page.getByLabel('고정 영상 ID', { exact: true }).last();
    const t = net.length ? net[net.length - 1].t + 1 : 0;
    await box.fill(value);
    await page.keyboard.press('Tab');
    await sleep(800);
    const group = page.getByRole('group', { name: '게시본 재생 테스트' });
    const links = await group.getByRole('link').evaluateAll((els) => els.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), ariaDisabled: a.getAttribute('aria-disabled'), hidden: !a.offsetParent })));
    result[key] = {
      api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ` ${c.error.code}` : ''}`),
      invalid: await box.getAttribute('aria-invalid'),
      describedBy: await box.evaluate((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim())),
      links: links.map((l) => ({ ...l, href: l.href ? l.href.replace(/[^\x20-\x7e]/g, '?') : null, hrefDecodedCodepoints: l.href ? cps(decodeURIComponent((l.href.split('video=')[1] || '').split('&')[0])) : null })),
      previewButton: await page.getByRole('button', { name: /미리보기 준비|미리보기 시작/ }).first().evaluate((b) => ({ text: b.textContent.trim(), disabled: b.disabled })).catch(() => null),
      sectionText: (await page.getByRole('heading', { name: '재생 확인' }).locator('xpath=ancestor::section[1]').innerText().catch(() => '')).split('\n').filter((l) => /ID|입력|확인해/.test(l)).slice(0, 6),
      alerts: (await page.getByRole('alert').allInnerTexts()).filter(Boolean),
    };
    await page.screenshot({ path: `${EV}/VID/play-test-${key}.png`, fullPage: true });
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
result.console = logs;
save('VID/result-play-test.json', result);
await browser.close();
