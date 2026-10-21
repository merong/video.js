// L-3-QA scenario 3: LMS key → test token → sample lecture with the token → progress row → CSV file name. Chromium 1280.
// The key and the token stay in memory; evidence never stores them.
import { BASE, launch, login, consoleCollector, save, shot, sleep, video } from './lib.mjs';

const LEARNER = 'qa-learner-1';
const TOKEN_RE = /[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{20,}/;
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = consoleCollector(page);
const lmsCalls = [];
page.on('response', async (res) => { const u = new URL(res.url()); const a = u.searchParams.get('action'); if (a?.startsWith('lms')) lmsCalls.push({ action: a, status: res.status() }); });
const r = { steps: {} };
const step = (k, ok, detail) => { r.steps[k] = { ok, detail }; console.log(ok ? 'PASS' : 'FAIL', k, JSON.stringify(detail)); };

try {
  await login(page);
  await page.goto(`${BASE}/#/lms/settings`);
  await page.getByRole('button', { name: '연동 키 만들기' }).click();
  await sleep(500);
  const dlg = page.getByRole('dialog');
  if (await dlg.count()) await dlg.getByRole('button').filter({ hasNotText: '취소' }).last().click();
  await sleep(1000);
  const keyRow = await page.getByRole('row', { name: /^연동 키/ }).innerText();
  step('key created (hint only after)', !/아직 없어요/.test(keyRow), { keyRow: keyRow.replace(/[0-9a-f]{32,}/g, '<key>') });

  const tokenRegion = page.getByRole('region', { name: '시험 토큰 만들기' });
  await tokenRegion.getByRole('textbox', { name: '학습자 ID' }).fill(LEARNER);
  await tokenRegion.getByRole('button', { name: '시험 토큰 만들기' }).click();
  await sleep(1200);
  const regionText = await tokenRegion.evaluate((el) => [el.innerText, ...[...el.querySelectorAll('input,textarea,code')].map((n) => n.value ?? n.textContent)].join('\n'));
  const token = regionText.match(TOKEN_RE)?.[0];
  step('test token created', Boolean(token), { tokenFound: Boolean(token) });

  await page.goto(`${BASE}/examples/lecture.html`);
  const player = page.getByRole('group', { name: '미디어 플레이어' });
  await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
  await page.locator('#token').fill(token);
  await page.locator('#token-apply').click();
  await sleep(2500);
  const panel = page.getByRole('region', { name: '강의 진도와 자료' });
  const storeLine = await panel.getByText(/학습 기록이 저장돼요|이 브라우저에만/).first().textContent();
  const rulesOff = await page.locator('#rules-off').isVisible();
  await player.getByRole('button', { name: '재생', exact: true }).click();
  await sleep(9000);
  await player.getByRole('slider', { name: '탐색' }).focus();
  await page.keyboard.press('k');
  await sleep(1500);
  const shown = (await panel.locator('strong').first().textContent()).trim();
  await shot(page, 's3-lecture-server.png');
  step('lecture saves to server with token', /학습 기록이 저장돼요/.test(storeLine) && lmsCalls.some((c) => c.action === 'lms-progress' && c.status === 200), { storeLine, rulesOffShown: rulesOff, panelPercent: shown, position: (await video(page)).t, lmsCalls });

  await page.goto(`${BASE}/#/lms/progress`);
  await sleep(2000);
  const rows = page.getByRole('region', { name: '학습자별 진도' }).getByRole('row');
  const texts = (await rows.allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim());
  const mine = texts.filter((t) => t.includes(LEARNER));
  step('progress table has one row with learner and percent', mine.length === 1 && /\d+%/.test(mine[0]), { rows: texts.slice(0, 4), panelPercent: shown });

  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: 'CSV 내려받기' }).click()]);
  const file = await dl.path();
  const csv = (await import('node:fs')).readFileSync(file, 'utf8');
  step('CSV file name lms-progress.csv', dl.suggestedFilename() === 'lms-progress.csv', { name: dl.suggestedFilename(), bom: csv.charCodeAt(0) === 0xfeff, lines: csv.trim().split('\n').length, header: csv.split('\n')[0].replace(/^﻿/, ''), hasLearner: csv.includes(LEARNER) });
} catch (e) {
  r.error = String(e).replace(TOKEN_RE, '<token>').slice(0, 800);
  console.log('ERROR', r.error);
  await shot(page, 's3-error.png');
}
r.consoleErrors = errors;
save('s3-chromium.json', r);
await b.close();
