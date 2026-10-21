// A2-D-QA D10 play-test.html: the two admin "재생 테스트 링크" (schedule panel, preset 둥근 테두리) are read and opened;
// the switch links keep the other query values; ?preset applies; an other-player preset shows the notice and plays
// defaults; an unknown preset and a missing video; the collection notice; action=events is sent after an ad plays.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { players } from './a2.mjs';
import { requestLog } from './demo.mjs';

const PT = `${BASE}/examples/play-test.html`;
const browser = await launch();
const result = { pages: [] };
const context = await newContext(browser, { width: 1280, height: 1200 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const look = (p) => p && { tree: p.tree, lang: p.i18nLang, fill: p.skin?.fillBefore, radius: p.skin?.borderRadius, media: p.media && { tag: p.media.tag, src: p.media.src, controls: p.media.controls } };

const read = (p) => p.evaluate(() => {
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length);
  const chips = [...document.querySelectorAll('.sa-switchbar a.sa-chip, .sa-switchbar .sa-chip')].filter(shown).map((a) => ({ text: t(a), href: a.getAttribute('href'), current: a.getAttribute('aria-current') }));
  return {
    query: location.search,
    collect: t(document.querySelector('.sa-note.is-warn[role="note"]:not([id])')),
    queryNote: shown(document.getElementById('query-note')) ? t(document.getElementById('query-note')) : null,
    presetNote: shown(document.getElementById('preset-note')) ? t(document.getElementById('preset-note')) : null,
    empty: shown(document.getElementById('stage-empty')) ? t(document.getElementById('stage-empty')) : null,
    mediaWhy: shown(document.querySelector('[data-media-why]')) ? t(document.querySelector('[data-media-why]')) : null,
    engineShown: shown(document.querySelector('[data-engine-field]')),
    chips,
    conditions: [...document.querySelectorAll('#conditions tr')].map((tr) => `${t(tr.querySelector('th'))}=${t(tr.querySelector('td'))}`),
    status: t(document.getElementById('status')),
    now: t(document.getElementById('now')),
  };
});

async function open(query, label, { play = false } = {}) {
  const from = req.all().length;
  await page.goto(`${PT}${query}`);
  await sleep(3500);
  const r = { label, ...(await read(page)), player: look((await players(page, '#player'))[0]) };
  if (play) {
    const box = await page.locator('#player').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const end = Date.now() + 15000;
    while (Date.now() < end && !/재생 중/.test(await page.locator('#now').innerText())) await sleep(300);
    await sleep(2500);
    r.nowAfterPlay = (await read(page)).now;
  }
  r.requests = req.all().slice(from).filter((x) => x.path.includes('/api/')).map((x) => `${x.method} ${x.path.replace(/^.*action=/, '')}`);
  result.pages.push(r);
  await shot(page, `D10/${String(result.pages.length).padStart(2, '0')}-${label}.png`, { fullPage: true });
  return r;
}

try {
  // Admin links from the schedule panel.
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시본 재생 테스트' }).waitFor({ timeout: 15000 });
  await page.getByRole('textbox', { name: '고정 영상 ID' }).fill('grok-demo-scene-01');
  await page.getByRole('combobox', { name: '적용할 프리셋' }).selectOption('rounded');
  await sleep(800);
  result.adminLinks = await page.getByRole('group', { name: '게시본 재생 테스트' }).locator('a').evaluateAll((as) => as.map((a) => ({ text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.getAttribute('target') })));
  await page.getByRole('group', { name: '게시본 재생 테스트' }).scrollIntoViewIfNeeded();
  await shot(page, 'D10/admin-links.png');

  for (const link of result.adminLinks.filter((l) => /재생/.test(l.text) && l.href?.includes('play-test.html'))) {
    const q = new URL(link.href, BASE).search;
    await open(q, `admin-${q.includes('type=native') ? 'native' : 'videojs'}`);
  }

  // Switch links: from a full query, every chip href keeps the other values.
  const full = '?video=grok-demo-scene-01&type=videojs&media=hls&engine=hlsjs&content=%2Fdemo-media%2Fcontent-master.m3u8&preset=rounded';
  const base = await open(full, 'full-query');
  result.switchCheck = base.chips.filter((c) => c.href).map((c) => {
    const a = new URLSearchParams(full.slice(1));
    const b = new URLSearchParams(new URL(c.href, PT).search);
    const changed = [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k));
    return { chip: c.text, current: c.current, changed: changed.map((k) => `${k}:${a.get(k)}→${b.get(k)}`) };
  });

  await open('?video=grok-demo-scene-01&type=videojs&preset=p-i0aecb28w3', 'preset-site', { play: true });
  await open('?video=grok-demo-scene-01&type=native&preset=rounded', 'other-player-preset');
  await open('?video=grok-demo-scene-01&type=videojs&preset=p-pchm59hhyv', 'native-preset-on-videojs');
  await open('?video=grok-demo-scene-01&type=native&media=hls', 'native-hls');
  await open('?video=grok-demo-scene-01&preset=p-zzzzzzzzzz', 'unknown-preset');
  await open('?type=videojs', 'no-video');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D10/error.png', { fullPage: true }).catch(() => {});
}
result.events = req.events().map((e) => `${e.method} ${e.frame}`);
result.console = logs;
await context.close();
save('D10/result.json', result);
await browser.close();
