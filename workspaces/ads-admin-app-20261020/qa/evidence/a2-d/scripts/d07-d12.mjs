// A2-D-QA D07 doc shell and D12 overflow: at 390/768/960/1280 the demo, guide, help and play-test pages and the admin
// editor preview are read for horizontal overflow (scrollWidth vs clientWidth); the doc pages for the nav's
// aria-current, the TOC open state (folded at ≤960), the TOC link marked while reading a section, anchor links, and
// the sample-media notice. With prefers-reduced-motion: reduce, running animations and scroll-behavior are read.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';

const PAGES = [
  ['demo', '/examples/index.html'],
  ['guide', '/examples/guide.html'],
  ['help', '/examples/help.html'],
  ['play-test', '/examples/play-test.html?video=grok-demo-scene-01&type=videojs'],
];
const browser = await launch();
const result = { pages: [], admin: [], reduced: {} };

// Elements wider than the viewport (only the outermost offenders).
const wide = (p) => p.evaluate(() => {
  const w = document.documentElement.clientWidth;
  return [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > w + 1 && getComputedStyle(el).position !== 'fixed'; }).filter((el, _, all) => !all.includes(el.parentElement)).slice(0, 5).map((el) => `${el.tagName}.${String(el.className).slice(0, 30)} r=${Math.round(el.getBoundingClientRect().right)}`);
});

for (const width of [390, 768, 960, 1280]) {
  const context = await newContext(browser, { width, height: 900 });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  for (const [name, path] of PAGES) {
    await page.goto(`${BASE}${path}`);
    await sleep(2500);
    const r = { width, name, overflow: await overflow(page), wide: await wide(page) };
    r.nav = await page.evaluate(() => [...document.querySelectorAll('.sa-nav a')].map((a) => `${a.textContent}${a.getAttribute('aria-current') ? `[${a.getAttribute('aria-current')}]` : ''}`).join(' '));
    if (name === 'guide' || name === 'help') {
      r.tocOpen = await page.evaluate(() => document.querySelector('.sa-toc')?.open ?? null);
      r.tocBox = await page.evaluate(() => { const b = document.querySelector('.sa-toc')?.getBoundingClientRect(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; });
      const links = await page.evaluate(() => [...document.querySelectorAll('.sa-toc a[href^="#"]')].map((a) => a.getAttribute('href')));
      r.tocLinks = links.length;
      r.tocMissing = await page.evaluate((ls) => ls.filter((h) => !document.getElementById(h.slice(1))), links);
      if (width === 1280 || width === 390) {
        // Click the 4th TOC link (opening the TOC first when folded), then read the heading position and the marked link.
        if (!r.tocOpen) await page.locator('.sa-toc summary').click();
        const link = page.locator('.sa-toc a[href^="#"]').nth(3);
        const href = await link.getAttribute('href');
        await link.click();
        await sleep(1200);
        r.anchor = { href, hash: await page.evaluate(() => location.hash), top: await page.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), href.slice(1)), current: await page.evaluate(() => [...document.querySelectorAll('.sa-toc a[aria-current]')].map((a) => a.getAttribute('href'))) };
        await shot(page, `D07/${name}-${width}-anchor.png`);
      }
      if (name === 'guide') r.sampleNotice = await page.evaluate(() => { const s = document.getElementById('sample-media'); const sec = s?.closest('section') ?? s?.parentElement; return sec ? [...sec.querySelectorAll('.sa-note, p, li')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /public\/|demo-media|샘플/.test(t)).slice(0, 4) : null; });
    }
    await page.evaluate(() => scrollTo(0, 0));
    await shot(page, `D12/${name}-${width}.png`, { fullPage: true });
    result.pages.push(r);
  }
  result[`console${width}`] = logs.filter((l) => !/404|401/.test(l.text ?? ''));

  // Admin editor preview at this width.
  const admin = await context.newPage();
  await login(admin);
  await admin.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await admin.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(3500);
  const a = { width, overflowClosed: await overflow(admin) };
  const opener = admin.locator('aside.aa-editor-preview').getByRole('button', { name: '열기' });
  a.opener = (await opener.count()) ? { expanded: await opener.getAttribute('aria-expanded') } : null;
  if (a.opener) {
    await opener.click();
    await sleep(3500);
    a.opener.after = await admin.locator('aside.aa-editor-preview button[aria-expanded]').getAttribute('aria-expanded');
  }
  a.overflow = await overflow(admin);
  a.wide = await wide(admin);
  a.scale = await admin.locator('.sa-stage-bar .sa-small').innerText().catch(() => null);
  a.segment = await admin.evaluate(() => [...document.querySelectorAll('.sa-stage-bar label, .sa-stage-bar input')].map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName}:${el.textContent.trim() || el.value}:${Math.round(r.width)}x${Math.round(r.height)}:${getComputedStyle(el).display}`; }));
  a.stageBarHidden = await admin.evaluate(() => document.querySelector('.sa-stage-bar')?.hidden ?? null);
  for (const v of ['narrow', 'medium']) {
    try {
      await admin.locator(`input[type="radio"][value="${v}"]`).check({ force: true, timeout: 5000 });
      await sleep(800);
      a[`overflow-${v}`] = await overflow(admin);
      a[`scale-${v}`] = await admin.locator('.sa-stage-bar .sa-small').innerText();
    } catch (error) {
      a[`error-${v}`] = String(error).split('\n')[0];
    }
  }
  await admin.locator('aside.aa-editor-preview .sa-stage').first().scrollIntoViewIfNeeded().catch(() => {});
  await shot(admin, `D12/admin-preview-${width}.png`);
  // The schedule pre-publish preview at this width.
  await admin.goto(`${BASE}/#/schedule`);
  const target = admin.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await admin.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await admin.getByRole('button', { name: '미리보기 준비' }).click();
  await sleep(4000);
  a.schedule = { overflow: await overflow(admin), wide: await wide(admin) };
  await admin.getByRole('region', { name: '게시 전 미리보기' }).scrollIntoViewIfNeeded().catch(() => {});
  await shot(admin, `D12/admin-schedule-preview-${width}.png`);
  result.admin.push(a);
  await context.close();
}

// Reduced motion: running CSS animations/transitions on the demo and in the editor preview frame, and scroll-behavior.
{
  const context = await newContext(browser, { width: 1280, height: 900, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const motion = (p) => p.evaluate(() => {
    const anims = document.getAnimations({ subtree: true }).filter((x) => x.playState === 'running').map((x) => `${x.constructor.name}:${x.animationName ?? x.transitionProperty ?? ''}:${x.effect?.target?.tagName ?? ''}.${String(x.effect?.target?.className ?? '').slice(0, 30)}`);
    return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, running: anims.slice(0, 10), scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
  });
  await page.goto(`${BASE}/examples/index.html`);
  await sleep(2500);
  result.reduced.demo = await motion(page);
  await page.goto(`${BASE}/examples/guide.html`);
  await sleep(1000);
  await page.locator('.sa-toc a[href^="#"]').nth(5).click();
  await sleep(100);
  result.reduced.guide = { ...(await motion(page)), topAfter100ms: await page.evaluate(() => Math.round(document.getElementById(location.hash.slice(1)).getBoundingClientRect().top)) };
  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(3500);
  result.reduced.admin = await motion(page);
  const frame = page.frames().find((f) => f.url().includes('/examples/preview.html'));
  result.reduced.frame = frame ? await motion(frame) : null;
  await context.close();
}
save('D07/result.json', result);
await browser.close();
