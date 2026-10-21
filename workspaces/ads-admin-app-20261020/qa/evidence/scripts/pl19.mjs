// PL19: play-test links carry ?preset only for a saved preset; the P-A link applies P-A.
import { BASE, EV, launch, newContext, login, recordNetwork, apiCalls, consoleCollector, save, sleep } from './lib.mjs';
const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('form', { name: '광고 편성 편집' }).waitFor();
  await sleep(1000);
  const check = page.getByRole('form', { name: '재생 확인' });
  await check.getByLabel('고정 영상 ID', { exact: true }).fill('a1-qa-preset-1');
  const preset = check.getByRole('combobox', { name: '플레이어 프리셋' });
  result.options = await preset.evaluate((s) => [...s.options].map((o) => `${o.value}:${o.textContent.trim()}${o.selected ? ' [selected]' : ''}`));
  const group = page.getByRole('group', { name: '게시본 재생 테스트' });
  const links = () => group.getByRole('link').evaluateAll((as) => as.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), target: a.target })));
  result.initial = await links();
  const t = net.length ? net[net.length - 1].t + 1 : 0;
  await preset.selectOption('default');
  await sleep(400);
  result.default = await links();
  await preset.selectOption('p-wkepup6b7d');
  await sleep(400);
  result.pa = await links();
  await preset.selectOption('p-nln4iamtsc');
  await sleep(400);
  result.pb = await links();
  result.apiWhileSwitching = apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`);
  await preset.selectOption('p-wkepup6b7d');
  await sleep(400);
  await group.screenshot({ path: `${EV}/PL19/links-pa.png` });
  const link = group.getByRole('link', { name: 'Video.js로 재생 (새 탭)' });
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await tab.waitForLoadState('load');
  await sleep(2500);
  result.opened = await tab.evaluate(() => {
    const skin = document.querySelector('video-neutral-skin');
    return { url: location.pathname + location.search, skinTag: skin ? 'video-neutral-skin' : null, accent: skin ? getComputedStyle(skin).getPropertyValue('--media-accent-color').trim() : null, adsAttrs: Object.fromEntries([...(document.querySelector('media-ads')?.attributes ?? [])].filter((a) => !['src', 'for'].includes(a.name)).map((a) => [a.name, a.value])), meta: [...document.querySelectorAll('p, span')].map((n) => n.textContent.trim()).find((x) => /프리셋 p-/.test(x)) ?? null };
  });
  await tab.screenshot({ path: `${EV}/PL19/opened-pa.png` });
  await tab.close();
} catch (error) {
  result.error = String(error).slice(0, 1200);
  await page.screenshot({ path: `${EV}/PL19/error.png`, fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL19/result.json', result);
console.log(JSON.stringify(result, null, 1));
await browser.close();
