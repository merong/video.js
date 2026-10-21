// A2-D-QA-DELTA X04 (A2D-03) and X05 (A2D-04).
// X04: play-test.html with an unknown ?preset (videojs and native) and with an other-player ?preset (native+rounded,
// videojs+QA 기본 video): the preset note against copy §6 and the player look against the built-in default
// (?preset=default) and the site preset (no ?preset); one case is played to see action=events.
// X05: 지면 편성 → 게시본 재생 테스트 with 적용할 프리셋 = QA 기본 video (native): the note beside the Video.js link against
// copy §7 row "재생 테스트 링크의 다른 플레이어 안내"; the Video.js link is opened and must play with the site preset.
// Then, in the isolated QA DB only, QA 기본 video is applied to the site; the same Video.js link must play defaults; the
// site preset is restored to QA 강조색 복제 through the same 사이트에 적용 dialog.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { players } from './a2.mjs';
import { requestLog } from './demo.mjs';

const PT = `${BASE}/examples/play-test.html`;
const VIDEO = 'grok-demo-scene-01';
const browser = await launch();
const result = { x04: [], x05: {} }; // second run: logged-in X04 cases and X05
const context = await newContext(browser, { width: 1280, height: 1200 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const look = (p) => p && { tree: p.tree, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, media: p.media && { tag: p.media.tag, controls: p.media.controls } };

const read = (p) => p.evaluate(() => {
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length);
  return {
    query: location.search,
    presetNote: shown(document.getElementById('preset-note')) ? t(document.getElementById('preset-note')) : null,
    queryNote: shown(document.getElementById('query-note')) ? t(document.getElementById('query-note')) : null,
    conditions: [...document.querySelectorAll('#conditions tr')].map((tr) => `${t(tr.querySelector('th'))}=${t(tr.querySelector('td'))}`),
    status: t(document.getElementById('status')),
  };
});

async function open(p, query, label, { play = false, list = result.x04, dir = 'X04' } = {}) {
  const from = req.all().length;
  await p.goto(`${PT}${query}`);
  await sleep(3500);
  const r = { label, ...(await read(p)), player: look((await players(p, '#player'))[0]) };
  if (play) {
    const box = await p.locator('#player').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const end = Date.now() + 15000;
    while (Date.now() < end && !/재생 중/.test(await p.locator('#now').innerText())) await sleep(300);
    await sleep(2500);
    r.nowAfterPlay = (await p.locator('#now').innerText()).replace(/\s+/g, ' ');
  }
  r.events = req.all().slice(from).filter((x) => /action=events/.test(x.path)).length;
  list.push(r);
  await shot(p, `${dir}/${label}.png`, { fullPage: true });
  return r;
}

async function applySite(name) {
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('table').first().waitFor();
  await sleep(800);
  await page.getByRole('button', { name: `${name} 사이트에 적용`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '사이트에 적용', exact: true }).click();
  await sleep(1500);
  return (await page.getByRole('status').allInnerTexts()).map((t) => t.trim()).filter((t) => /사이트에 적용/.test(t)).join(' ');
}

try {
  // X04 again while logged in (play-test reads saved preset names from player-presets only for an admin session).
  await login(page);
  await open(page, `?video=${VIDEO}&type=videojs&preset=p-pchm59hhyv`, 'admin-other-videojs-native-preset');
  await open(page, `?video=${VIDEO}&type=videojs&preset=p-zzzzzzzzzz`, 'admin-unknown-videojs');

  // X05: admin links with a native preset chosen.
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시본 재생 테스트' }).waitFor({ timeout: 15000 });
  await page.getByRole('textbox', { name: '고정 영상 ID' }).fill(VIDEO);
  await page.getByRole('combobox', { name: '적용할 프리셋' }).selectOption({ label: 'QA 기본 video' });
  await page.locator('.ads-test-links a').nth(1).waitFor({ timeout: 15000 });
  await page.locator('.ads-test-links-other').waitFor({ timeout: 15000 });
  await sleep(500);
  const group = page.getByRole('group', { name: '게시본 재생 테스트' });
  result.x05.links = await group.locator('a').evaluateAll((as) => as.map((a) => ({
    text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.getAttribute('target'),
    describedBy: (a.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim()),
  })));
  result.x05.notes = (await group.locator('.ads-test-links-other').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  await group.scrollIntoViewIfNeeded();
  await shot(page, 'X05/admin-links-native-preset.png');

  const vjs = result.x05.links.find((l) => /Video\.js로 재생/.test(l.text));
  const nat = result.x05.links.find((l) => /기본 video로 재생/.test(l.text));
  const tab = await context.newPage();
  const x05 = (result.x05.opened = []);
  await open(tab, new URL(vjs.href, BASE).search, 'videojs-link-site-accent', { play: true, list: x05, dir: 'X05' });
  await open(tab, new URL(nat.href, BASE).search, 'native-link', { list: x05, dir: 'X05' });

  // Isolated DB only: site preset → QA 기본 video, reopen the Video.js link, then restore.
  result.x05.applyNative = await applySite('QA 기본 video');
  await open(tab, new URL(vjs.href, BASE).search, 'videojs-link-site-native', { list: x05, dir: 'X05' });
  result.x05.restore = await applySite('QA 강조색 복제');
  result.x05.siteAfter = await page.getByRole('row').filter({ hasText: '사이트 적용' }).allInnerTexts().then((r) => r.map((t) => t.replace(/\s+/g, ' ').slice(0, 80)));
  await open(tab, new URL(vjs.href, BASE).search, 'videojs-link-restored', { list: x05, dir: 'X05' });
  await tab.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'X05/error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.eventsTotal = req.events().length;
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
await context.close();
save('X04-X05/result-admin.json', result);
await browser.close();
