// A1-QA-DELTA PL23: the 7 "준비 중" features of contract §3 line 56 (ui/src/screens/planned.tsx) are shown on the
// screens an operator would look at, with a reason. Read-only.
import { BASE, launch, newContext, login, recordNetwork, save, shot, sleep, apiCalls } from './lib.mjs';

const EXPECTED = {
  '프리셋 ID로 불러오는 설치 코드': '#/players/setup',
  '게시판·분류·영상별 프리셋 지정': '#/players',
  '프리셋 변경 이력과 되돌리기': '#/players',
  '오디오·라이브 플레이어': '#/players/new',
  '사용자 CSS 직접 입력': '#/players/new',
  '로고·워터마크': '#/players/new',
  '스킨 소스 내려받기': '#/players/new',
};
const browser = await launch();
const context = await newContext(browser, { height: 1600 });
const net = recordNetwork(context);
const page = await context.newPage();
const result = { screens: {} };
try {
  await login(page);
  for (const hash of ['#/players', '#/players/new', '#/players/edit/p-vym1rjw052', '#/players/setup', '#/players/options']) {
    await page.goto(`${BASE}/${hash}`);
    await page.reload();
    await sleep(1500);
    const main = page.locator('main').filter({ visible: true });
    result.screens[hash] = {
      planned: await main.locator('li').filter({ hasText: '준비 중' }).allInnerTexts(),
      otherMentions: (await main.innerText()).split('\n').filter((l) => l.includes('준비 중') && !/· 준비 중\./.test(l)),
    };
    await shot(page, `PL23/${hash.replace(/[#/]+/g, '-').replace(/^-/, '')}.png`, { fullPage: true });
  }
  result.check = Object.fromEntries(Object.entries(EXPECTED).map(([name, hash]) => {
    const line = result.screens[hash].planned.find((t) => t.startsWith(`${name} · 준비 중.`));
    const alsoEdit = hash === '#/players/new' ? result.screens['#/players/edit/p-vym1rjw052'].planned.some((t) => t.startsWith(name)) : null;
    return [name, { expectedOn: hash, shown: Boolean(line), hasReason: Boolean(line && line.length > name.length + 8), alsoOnEdit: alsoEdit, line: line ?? null }];
  }));
  result.allShown = Object.values(result.check).every((c) => c.shown && c.hasReason);
  result.writes = apiCalls(net).filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.action} ${c.status}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('PL23/result.json', result);
await browser.close();
