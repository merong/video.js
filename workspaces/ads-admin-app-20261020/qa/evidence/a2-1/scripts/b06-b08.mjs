// A2-1-QA R02 setup/regression: copied from A1-QA-DELTA-3, evidence paths moved under R02/.
// B06–B08: site-default draft, two-tab 409, publish, video context and inheritance (standalone).
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, apiCalls, sleep, redact } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const bodies = [];
context.on('response', async (response) => {
  const url = new URL(response.url());
  const action = url.pathname.endsWith('/api/index.php') ? url.searchParams.get('action') : null;
  if (!action || !/^schedule|video-context|targets/.test(action)) return;
  const body = await response.json().catch(() => null);
  bodies.push({ action, method: response.request().method(), status: response.status(), body: redact(body) });
});
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const dialogs = [];
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const editor = (p = page) => p.getByRole('form', { name: '광고 편성 편집' });
const editorStatus = (p = page) => editor(p).getByRole('status').last().innerText().catch(() => '(status 없음)');
const article = (name, p = page) => editor(p).getByRole('article', { name: new RegExp(name) });

/** Accepts an app confirm dialog when one appears and records its text. */
async function acceptDialog(p, label) {
  const dialog = p.getByRole('dialog');
  if (await dialog.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) {
    dialogs.push({ label, text: await dialog.innerText() });
    await dialog.getByRole('button').filter({ hasNotText: '취소' }).filter({ hasNotText: '닫기' }).last().click();
    await dialog.waitFor({ state: 'hidden' });
  }
}

async function openTarget(p, type, id) {
  await p.goto(`${BASE}/#/schedule`);
  const target = p.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: type });
  if (id) await target.getByLabel('고정 대상 ID', { exact: true }).fill(id);
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await editor(p).waitFor();
  await sleep(800);
}

async function addItem(name, option) {
  const a = article(name);
  await a.getByLabel('추가할 소재', { exact: true }).selectOption({ label: option });
  await a.getByRole('button', { name: '광고 추가' }).click();
  await sleep(150);
}

async function setSkip(group, seconds) {
  await group.getByLabel('이 광고의 스킵', { exact: true }).selectOption({ label: 'N초 후 현재 광고만 스킵' });
  await group.getByLabel('스킵 대기 (초)', { exact: true }).fill(String(seconds));
}

async function save_(p, label) {
  const t = mark();
  await editor(p).getByRole('button', { name: '초안 저장' }).click();
  await sleep(1500);
  return { label, status: await editorStatus(p), api: apiCalls(net, t) };
}

async function publish(p, label) {
  const t = mark();
  await editor(p).getByRole('button', { name: '저장한 초안 게시' }).click();
  await acceptDialog(p, label);
  await sleep(1500);
  return { label, status: await editorStatus(p), api: apiCalls(net, t) };
}

const regionText = async (p = page) => editor(p).getByRole('region').first().innerText();

try {
  await login(page);

  // B06 -------------------------------------------------------------
  {
    const r = {};
    await openTarget(page, '사이트 기본');
    r.before = await regionText();
    await editor().getByLabel('이 대상의 광고', { exact: true }).selectOption({ label: '직접 편성 · 전체 대체' });
    const add = editor().getByRole('group', { name: '광고 구간 추가' });
    await add.getByRole('button', { name: '프리롤' }).click();
    await addItem('프리롤', 'QA 이어버드 프리롤 · v1 · 영상');
    await addItem('프리롤', 'QA 커피 프리롤 v2 · v2 · 영상');
    await addItem('프리롤', 'QA 포스트롤 이미지 · v1 · 이미지');
    await article('프리롤').getByRole('button', { name: '2번 광고 위로 이동' }).click();
    await article('프리롤').getByRole('group', { name: /^3\. / }).getByRole('button', { name: '광고 제거' }).click();
    r.preOrder = await article('프리롤').getByRole('group').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.querySelector('legend')?.textContent));
    const coffee = article('프리롤').getByRole('group', { name: /^1\. QA 커피/ });
    await coffee.getByLabel('클릭 목적지 URL', { exact: true }).fill('https://example.com/qa-coffee');
    await setSkip(article('프리롤').getByRole('group', { name: /^2\. QA 이어버드/ }), 3);
    await add.getByRole('button', { name: '미드롤' }).click();
    await addItem('미드롤', 'QA 생수 미드롤 · v1 · 영상');
    await setSkip(article('미드롤').getByRole('group', { name: /QA 생수/ }), 3);
    await add.getByRole('button', { name: '포스트롤' }).click();
    await addItem('포스트롤', 'QA 포스트롤 이미지 · v1 · 이미지');
    await article('포스트롤').getByLabel('이미지 · GIF 표시 (초)', { exact: true }).fill('3');
    // Workaround for the mid position focus trap (see B06/probe-mid2.json): edit the position last, then only click.
    await article('미드롤').getByLabel('본편 재생 위치 (초)', { exact: true }).fill('5');
    r.valuesBeforeSave = {
      position: await article('미드롤').getByLabel('본편 재생 위치 (초)', { exact: true }).inputValue(),
      midWait: await article('미드롤').getByLabel('스킵 대기 (초)', { exact: true }).inputValue(),
      preWait: await article('프리롤').getByLabel('스킵 대기 (초)', { exact: true }).inputValue(),
      postSeconds: await article('포스트롤').getByLabel('이미지 · GIF 표시 (초)', { exact: true }).inputValue(),
    };
    await shot(page, 'R02/B06/draft-filled.png', { fullPage: true });
    r.save = await save_(page, 'R02/B06 첫 저장');
    r.afterSave = await regionText();
    await page.reload();
    await openTarget(page, '사이트 기본');
    r.afterReloadSnapshot = await editor().ariaSnapshot();
    r.afterReloadRegion = await regionText();
    await shot(page, 'R02/B06/after-reload.png', { fullPage: true });
    save('R02/B06/after-reload.aria.yml', r.afterReloadSnapshot);
    delete r.afterReloadSnapshot;
    result.B06 = r;
  }

  // B07 -------------------------------------------------------------
  {
    const r = {};
    const pageB = await context.newPage();
    const logsB = consoleCollector(pageB);
    const reqB = [];
    pageB.on('request', (req) => {
      const u = new URL(req.url());
      if (u.pathname.endsWith('/api/index.php')) reqB.push({ at: Date.now(), method: req.method(), action: u.searchParams.get('action') });
    });
    await openTarget(page, '사이트 기본');
    await openTarget(pageB, '사이트 기본');
    const coffeeOf = (p) => article('프리롤', p).getByRole('group', { name: /^1\. QA 커피/ });
    await coffeeOf(page).getByLabel('클릭 목적지 URL', { exact: true }).fill('https://example.com/qa-coffee-a');
    r.saveA = await save_(page, 'R02/B07 탭 A 저장');
    await coffeeOf(pageB).getByLabel('클릭 목적지 URL', { exact: true }).fill('https://example.com/qa-coffee-b');
    const tB = Date.now();
    r.saveB = await save_(pageB, 'R02/B07 탭 B 저장');
    await sleep(5000);
    r.tabBRequestsAfterSave = reqB.filter((e) => e.at >= tB).map(({ method, action }) => ({ method, action }));
    r.tabBStatuses = await pageB.getByRole('status').allInnerTexts();
    r.tabBAlerts = await pageB.getByRole('alert').allInnerTexts();
    r.tabBInputKept = await coffeeOf(pageB).getByLabel('클릭 목적지 URL', { exact: true }).inputValue();
    r.tabBButtons = await editor(pageB).getByRole('button').allInnerTexts();
    await shot(pageB, 'R02/B07/tab-b-conflict.png', { fullPage: true });
    const reload = editor(pageB).getByRole('button', { name: '서버 초안 다시 불러오기' });
    if (await reload.count()) {
      await reload.click();
      await acceptDialog(pageB, 'R02/B07 서버 초안 다시 불러오기');
      await sleep(1200);
      r.tabBAfterReloadValue = await coffeeOf(pageB).getByLabel('클릭 목적지 URL', { exact: true }).inputValue();
      r.tabBAfterReloadStatus = await editorStatus(pageB);
    }
    r.consoleB = logsB;
    await pageB.close();
    result.B07 = r;
  }

  // B08 -------------------------------------------------------------
  {
    const r = {};
    await openTarget(page, '사이트 기본');
    r.publishSite = await publish(page, 'R02/B08 사이트 기본 게시');
    r.siteRegionAfterPublish = await regionText();
    await shot(page, 'R02/B08/site-published.png', { fullPage: true });

    await page.goto(`${BASE}/#/schedule`);
    const target = page.getByRole('form', { name: '편집할 대상' });
    await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
    await page.getByText('독립 설치 영상의 게시판·분류 연결').click();
    const ctx = page.getByRole('form', { name: '영상 소속 연결' });
    await ctx.getByLabel('영상 ID', { exact: true }).fill('a1-qa-video-1');
    await ctx.getByLabel('영상 이름', { exact: true }).fill('QA 영상 1');
    await ctx.getByLabel('게시판 ID', { exact: true }).fill('notice');
    await ctx.getByLabel('분류 ID', { exact: true }).fill('1');
    let t = mark();
    await ctx.getByRole('button', { name: '영상 소속 저장' }).click();
    await sleep(1500);
    r.videoContext = { status: await ctx.getByRole('status').innerText().catch(() => null), api: apiCalls(net, t) };
    await shot(page, 'R02/B08/video-context.png', { fullPage: true });

    await openTarget(page, '개별 영상', 'a1-qa-video-1');
    r.videoInherit1 = await regionText();
    save('R02/B08/video-inherit-1.aria.yml', await editor().ariaSnapshot());
    await shot(page, 'R02/B08/video-inherit-1.png', { fullPage: true });

    await openTarget(page, '게시판', 'notice');
    r.boardBefore = await regionText();
    await editor().getByLabel('이 대상의 광고', { exact: true }).selectOption({ label: '광고 비활성화 · 상속 중단' });
    r.boardDisableSave = await save_(page, 'R02/B08 게시판 disabled 저장');
    r.boardDisablePublish = await publish(page, 'R02/B08 게시판 disabled 게시');
    await openTarget(page, '개별 영상', 'a1-qa-video-1');
    r.videoInheritDisabled = await regionText();
    save('R02/B08/video-inherit-disabled.aria.yml', await editor().ariaSnapshot());
    await shot(page, 'R02/B08/video-inherit-disabled.png', { fullPage: true });

    await openTarget(page, '게시판', 'notice');
    await editor().getByLabel('이 대상의 광고', { exact: true }).selectOption({ label: '상위 설정 상속' });
    r.boardInheritSave = await save_(page, 'R02/B08 게시판 inherit 저장');
    r.boardInheritPublish = await publish(page, 'R02/B08 게시판 inherit 게시');
    await openTarget(page, '개별 영상', 'a1-qa-video-1');
    r.videoInheritRestored = await regionText();
    save('R02/B08/video-inherit-restored.aria.yml', await editor().ariaSnapshot());
    await shot(page, 'R02/B08/video-inherit-restored.png', { fullPage: true });
    t = mark();
    r.targetSearchAvailable = await page.getByRole('button', { name: '대상 검색' }).count();
    result.B08 = r;
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  result.statusesAtError = await page.getByRole('status').allInnerTexts().catch(() => []);
  await shot(page, 'R02/B06-B08/error.png', { fullPage: true }).catch(() => {});
}

result.dialogs = dialogs;
result.console = logs;
save('R02/B06-B08/result.json', result);
save('R02/B06-B08/bodies.json', bodies);
save('R02/B06-B08/network.json', net);
await browser.close();
