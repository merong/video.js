// A2-1-QA L11 legacy static code: the A1 pl16-*.html pages as they are (their 127.0.0.1:18781 origin is this run's
// server), and the code from the new 예전 정적 코드 Disclosure on 초기 설정 for a Video.js and a 기본 video preset.
import fs from 'node:fs';
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { openPage, waitQa, writePaste } from './a2.mjs';

const REPO = '/Users/brian/works/tools/videojs/video.js';
const PASTE = `${REPO}/workspaces/ads-admin-app-20261020/qa/fixtures/paste`;
const NATIVE = 'p-6aiokv34yw';

const deepVideos = (page) => page.evaluate(() => {
  const all = (root, sel) => [...root.querySelectorAll(sel)].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot, sel)));
  return all(document, 'video').map((v) => ({ src: (v.currentSrc || v.getAttribute('src') || '').replace(location.origin, '').replace(/^blob:.*/, 'blob:'), paused: v.paused, t: Math.round(v.currentTime * 10) / 10 }));
});
const visibleText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.children.length === 0 && el.textContent.trim()) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0) out.push(el.textContent.trim());
      }
    }
  };
  walk(document);
  return [...new Set(out)].slice(0, 20);
});

async function play(browser, url, key) {
  const context = await newContext(browser);
  const r = {};
  try {
    const { page, all } = await openPage(context, url);
    await sleep(2500);
    r.before = await deepVideos(page);
    const target = page.locator('video').first();
    const box = await target.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // Native <video controls>: the click on the frame toggles play in Chrome; if nothing plays, use play().
    await sleep(1500);
    if ((await deepVideos(page)).every((v) => v.paused)) {
      r.fallbackPlay = await page.evaluate(() => document.querySelector('video')?.play().then(() => 'played', (e) => String(e)));
    }
    const q = await waitQa(page, (s) => s.ads.some((a) => a.type === 'start'), 12000);
    await sleep(1500);
    r.adEvents = q.ads.map((a) => `${a.type}@${a.contentTime}`);
    r.during = await deepVideos(page);
    r.text = await visibleText(page);
    r.console = all.filter((l) => ['error', 'warning'].includes(l.type) && !/favicon/.test(l.text));
    await shot(page, `L11/${key}-ad.png`);
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  await context.close();
  return r;
}

const browser = await launch();
const result = { legacy: {}, disclosure: {} };

for (const file of ['pl16-videojs-mp4.html', 'pl16-native-mp4.html', 'pl16d-videojs-mp4.html', 'pl16d-native-mp4.html']) {
  if (!fs.existsSync(`${PASTE}/${file}`)) continue;
  result.legacy[file] = await play(browser, `${BASE}/__qa/paste/${file}`, file.replace('.html', ''));
}

// The Disclosure on 초기 설정: keyboard open, then the code for the site preset (Video.js) and for 기본 video.
const context = await newContext(browser, { height: 1400 });
const page = await context.newPage();
const logs = consoleCollector(page);
try {
  await login(page);
  await page.goto(`${BASE}/#/players/setup`);
  await page.getByRole('heading', { name: '설치 코드', exact: true }).waitFor();
  await sleep(800);
  await page.getByRole('textbox', { name: '영상 ID', exact: true }).first().fill('a1-qa-video-1');
  await page.keyboard.press('Tab');
  const summary = page.locator('summary', { hasText: '예전 정적 코드 보기' });
  result.disclosure.openBefore = await summary.evaluate((s) => s.parentElement.open);
  await summary.focus();
  await page.keyboard.press('Enter');
  await sleep(400);
  result.disclosure.openAfterEnter = await summary.evaluate((s) => s.parentElement.open);
  await page.keyboard.press('Space');
  await sleep(300);
  result.disclosure.openAfterSpace = await summary.evaluate((s) => s.parentElement.open);
  await page.keyboard.press('Space');
  await sleep(400);
  result.disclosure.openAfterSecondSpace = await summary.evaluate((s) => s.parentElement.open);
  const details = summary.locator('xpath=..');
  result.disclosure.note = (await details.innerText()).split('\n').filter((l) => /따라 바뀌지 않아요|이미 붙인 페이지/.test(l));
  await shot(page, 'L11/disclosure-open.png', { fullPage: true });

  const codeOf = async () => (await details.locator('pre').allTextContents()).find((c) => c.includes('createAdsController') || c.includes('<media-ads')) ?? null;
  const select = details.getByRole('combobox', { name: '프리셋' });
  result.disclosure.selected = await select.inputValue();
  const vjs = await codeOf();
  await select.selectOption(NATIVE);
  await sleep(600);
  const nat = await codeOf();
  await shot(page, 'L11/disclosure-native.png', { fullPage: true });
  for (const [key, code] of [['videojs', vjs], ['native', nat]]) {
    if (!code) { result.disclosure[key] = { error: 'no code' }; continue; }
    fs.writeFileSync(`${REPO}/workspaces/ads-admin-app-20261020/qa/evidence/a2-1/L11/disclosure-${key}.txt`, code);
    const url = writePaste(`l11-legacy-${key}`, code);
    result.disclosure[key] = { codeLines: code.split('\n').length, ...(await play(browser, url, `disclosure-${key}`)) };
  }
} catch (error) {
  result.disclosure.error = String(error).slice(0, 1500);
  await shot(page, 'L11/error.png', { fullPage: true }).catch(() => {});
}
result.adminConsole = logs.filter((l) => !/favicon|404/.test(l.text ?? ''));
save('L11/result.json', result);
await browser.close();
