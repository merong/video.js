// B01–B05: login/logout and creatives (URL, upload, new version, archive, invalid input).
import { execFileSync } from 'node:child_process';
import { BASE, USER, launch, newContext, login, recordNetwork, consoleCollector, save, shot, apiCalls, sleep } from './lib.mjs';

const MEDIA = '/Users/brian/works/tools/videojs/video.js/integrations/ads-manager/public/demo-media';
const browser = await launch();
const context = await newContext(browser);
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const discardLog = [];
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const editorForm = () => page.locator('form', { has: page.getByRole('button', { name: '소재 저장' }) });
const formStatus = () => editorForm().getByRole('status').first().innerText({ timeout: 5000 }).catch(() => '(status 없음)');

try {
// B01 ---------------------------------------------------------------
{
  const r = {};
  await page.goto(`${BASE}/`);
  await page.getByLabel('아이디', { exact: true }).fill(USER);
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong-password-for-qa');
  let t = mark();
  await page.getByRole('button', { name: '로그인' }).click();
  await sleep(1500);
  r.failStatus = await page.locator('main').getByRole('status').first().innerText().catch(() => null);
  r.failUsernameKept = await page.getByLabel('아이디', { exact: true }).inputValue();
  r.failPasswordCleared = (await page.getByLabel('비밀번호', { exact: true }).inputValue()).length === 0 ? 'empty' : 'kept';
  r.failApi = apiCalls(net, t);
  await shot(page, 'B01/login-fail.png');
  await login(page);
  r.displayName = await page.getByRole('banner').innerText();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '소재' }).click();
  await sleep(500);
  r.hashBeforeReload = new URL(page.url()).hash;
  await page.reload();
  await page.getByRole('heading', { name: '소재', level: 1 }).waitFor();
  r.hashAfterReload = new URL(page.url()).hash;
  r.headingAfterReload = await page.getByRole('heading', { level: 1 }).first().innerText();
  await shot(page, 'B01/after-reload.png');
  t = mark();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByRole('button', { name: '로그인' }).waitFor();
  await page.reload();
  await sleep(1000);
  r.afterLogoutLoginVisible = await page.getByRole('button', { name: '로그인' }).isVisible();
  r.afterLogoutProtected = await page.getByRole('heading', { name: '소재', level: 1 }).count();
  r.logoutApi = apiCalls(net, t);
  await shot(page, 'B01/after-logout.png');
  result.B01 = r;
}

// B02 ---------------------------------------------------------------
await login(page);
await page.goto(`${BASE}/#/creatives`);
await page.getByRole('heading', { name: '소재', level: 1 }).waitFor();
const form = editorForm();

// A dirty form asks "입력을 버릴까요?" in the app dialog before a new blank form; record and accept it.
async function newBlankForm() {
  await page.getByRole('button', { name: '새 소재 등록' }).click();
  const dialog = page.getByRole('dialog');
  if (await dialog.waitFor({ state: 'visible', timeout: 1000 }).then(() => true, () => false)) {
    discardLog.push(await dialog.innerText());
    await dialog.getByRole('button', { name: '버리기' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await sleep(300);
}

async function urlCreative(name, url, type, alt) {
  await newBlankForm();
  await form.getByLabel('소재 이름', { exact: true }).fill(name);
  await form.getByLabel('등록 방식', { exact: true }).selectOption({ label: '외부 URL' });
  await form.getByLabel('소재 URL', { exact: true }).fill(url);
  await form.getByLabel('파일 형식', { exact: true }).selectOption({ label: type });
  if (alt) await form.getByLabel('대체텍스트', { exact: true }).fill(alt);
}

async function mediaState() {
  return page.evaluate(async () => {
    const media = document.querySelector('main video, main img.aa-media, main figure img, main img');
    if (!media) return { found: false };
    if (media.tagName === 'VIDEO') {
      for (let i = 0; i < 30 && media.readyState < 2; i++) await new Promise((r) => setTimeout(r, 200));
      return { found: true, tag: 'VIDEO', src: media.currentSrc, readyState: media.readyState, duration: media.duration, error: media.error?.code ?? null };
    }
    for (let i = 0; i < 30 && !media.complete; i++) await new Promise((r) => setTimeout(r, 200));
    return { found: true, tag: media.tagName, src: media.currentSrc, naturalWidth: media.naturalWidth, alt: media.alt };
  });
}

{
  const r = { items: [] };
  for (const [name, url, type, alt] of [
    ['QA 커피 프리롤', '/demo-media/grok-20261018/ad-coffee-6s.mp4', 'MP4 영상', ''],
    ['QA 포스트롤 이미지', '/demo-media/ad.png', 'PNG 이미지', 'QA 포스트롤 이미지 광고'],
  ]) {
    await urlCreative(name, url, type, alt);
    await form.getByRole('button', { name: '입력 소재 미리보기' }).click();
    await sleep(800);
    const preview = await mediaState();
    await shot(page, `B02/preview-${type.startsWith('MP4') ? 'video' : 'image'}.png`, { fullPage: true });
    if (await page.getByRole('row', { name: new RegExp(name) }).count()) {
      r.items.push({ name, url, preview, saved: '이전 시도(스크립트 오류로 중단된 실행 또는 debug-b02.mjs)에서 이미 저장됨. 이번에는 저장하지 않음' });
      continue;
    }
    const t = mark();
    await form.getByRole('button', { name: '소재 저장' }).click();
    await sleep(1500);
    r.items.push({ name, url, preview, status: await formStatus(), api: apiCalls(net, t) });
  }
  r.listHeading = await page.getByRole('heading', { name: /등록한 소재/ }).innerText();
  await shot(page, 'B02/list.png', { fullPage: true });
  result.B02 = r;
}

// B03 ---------------------------------------------------------------
{
  const r = { items: [] };
  for (const [name, file] of [
    ['QA 이어버드 프리롤', `${MEDIA}/grok-20261018/ad-earbuds-12s.mp4`],
    ['QA 생수 미드롤', `${MEDIA}/grok-20261018/ad-water-8s.mp4`],
  ]) {
    if (await page.getByRole('row', { name: new RegExp(name) }).count()) {
      r.items.push({ name, saved: '이전 시도(debug-b03.mjs)에서 같은 화면 절차로 이미 업로드됨. 이번에는 업로드하지 않음' });
      continue;
    }
    await newBlankForm();
    await form.getByLabel('소재 이름', { exact: true }).fill(name);
    await form.getByLabel('등록 방식', { exact: true }).selectOption({ label: '파일 업로드' });
    await form.getByLabel('소재 파일', { exact: true }).setInputFiles(file);
    const t = mark();
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('action=creative-upload'), { timeout: 60000 }),
      form.getByRole('button', { name: '소재 저장' }).click(),
    ]);
    await sleep(1500);
    const upload = net.filter((e) => e.t >= t && e.action === 'creative-upload').map((e) => ({ method: e.method, status: e.status, ok: e.ok, type: e.type, csrfHeader: e.csrfHeader }));
    r.items.push({ name, status: await formStatus(), upload, api: apiCalls(net, t) });
  }
  const list = await page.evaluate(async () => (await (await fetch('/api/index.php?action=creatives', { credentials: 'same-origin' })).json()).data);
  r.creatives = list.items?.map((c) => ({ creativeId: c.creativeId, name: c.name, version: c.version, kind: c.kind, mime: c.mime, url: c.url, archived: c.archived })) ?? list;
  for (const c of r.creatives.filter((c) => c.url.startsWith('/media/'))) {
    const head = (args) => execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code} %{size_download} %{content_type}', ...args, `${BASE}${c.url}`]).toString();
    c.range = { full: head([]), range: head(['-H', 'Range: bytes=0-1023']), bad: head(['-H', 'Range: bytes=999999999-']) };
    c.urlPattern = /^\/media\/[a-f0-9]{32}\.mp4$/.test(c.url);
  }
  await shot(page, 'B03/list.png', { fullPage: true });
  result.B03 = r;
}

// B04 ---------------------------------------------------------------
{
  const r = {};
  const row = page.getByRole('row', { name: /QA 커피 프리롤/ });
  await row.getByRole('button', { name: '새 버전으로 수정' }).click();
  await form.getByLabel('소재 이름', { exact: true }).fill('QA 커피 프리롤 v2');
  let t = mark();
  await form.getByRole('button', { name: '소재 저장' }).click();
  await sleep(1500);
  r.editStatus = await formStatus();
  r.editApi = apiCalls(net, t);
  r.editRow = await page.getByRole('row', { name: /QA 커피 프리롤 v2/ }).innerText();
  await urlCreative('QA 보관 테스트', '/demo-media/grok-20261018/ad-coffee-6s.mp4', 'MP4 영상', '');
  await form.getByRole('button', { name: '소재 저장' }).click();
  await sleep(1500);
  t = mark();
  await page.getByRole('row', { name: /QA 보관 테스트/ }).getByRole('button', { name: '보관' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  r.dialogText = await dialog.innerText();
  await shot(page, 'B04/archive-dialog.png');
  await dialog.getByRole('button', { name: '보관' }).click();
  await sleep(1500);
  r.archiveApi = apiCalls(net, t);
  r.archivedRow = await page.getByRole('row', { name: /QA 보관 테스트/ }).innerText();
  r.archivedButtons = await page.getByRole('row', { name: /QA 보관 테스트/ }).getByRole('button', { name: '새 버전으로 수정' }).isDisabled();
  await shot(page, 'B04/after-archive.png', { fullPage: true });
  result.B04 = r;
}

// B05 ---------------------------------------------------------------
{
  const r = { cases: [] };
  for (const url of ['javascript:alert(1)', 'ftp://x/a.mp4']) {
    await urlCreative(`QA 잘못된 URL ${url.slice(0, 4)}`, url, 'MP4 영상', '');
    const before = await page.getByRole('heading', { name: /등록한 소재/ }).innerText();
    const t = mark();
    await form.getByRole('button', { name: '소재 저장' }).click();
    await sleep(1500);
    r.cases.push({
      url,
      status: await formStatus(),
      keptUrl: await form.getByLabel('소재 URL', { exact: true }).inputValue(),
      keptName: await form.getByLabel('소재 이름', { exact: true }).inputValue(),
      before,
      after: await page.getByRole('heading', { name: /등록한 소재/ }).innerText(),
      api: apiCalls(net, t),
    });
    await shot(page, `B05/invalid-${url.slice(0, 3)}.png`);
  }
  await form.getByLabel('소재 URL', { exact: true }).fill('/demo-media/grok-20261018/ad-coffee-6s.mp4');
  await form.getByLabel('소재 이름', { exact: true }).fill('QA 오류 뒤 유효 쓰기');
  const t = mark();
  await form.getByRole('button', { name: '소재 저장' }).click();
  await sleep(1500);
  r.validAfter = { status: await formStatus(), api: apiCalls(net, t) };
  result.B05 = r;
}

} catch (error) {
  result.error = String(error).slice(0, 1500);
  result.statusesAtError = await page.getByRole('status').allInnerTexts().catch(() => []);
  await shot(page, 'B01-B05/error.png', { fullPage: true }).catch(() => {});
}

result.discardDialogs = discardLog;
result.console = logs;
result.allRequests404 = net.filter((e) => e.status >= 400).map((e) => ({ url: e.url, status: e.status, action: e.action }));
save('B01-B05/result.json', result);
save('B01-B05/network.json', net);
console.log(JSON.stringify(result, null, 1).slice(0, 9000));
await browser.close();
