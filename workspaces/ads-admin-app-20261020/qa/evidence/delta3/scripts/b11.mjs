// B11 third query (after B10): totals and ad/video/board filters, plus CSV download for the same conditions.
import fs from 'node:fs';
import { EV, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep } from './lib.mjs';
import { queryStats } from './stats.mjs';

const COFFEE = 'creative-56f8787f880150925a4ccd6e062fdadf';
const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { queries: [] };

try {
  await login(page);
  for (const filters of [{}, { '광고 ID': COFFEE }, { '영상 ID': 'a1-qa-video-1' }, { '게시판 ID': 'notice' }, { '게시판 ID': 'free' }]) {
    const q = await queryStats(page, filters);
    q.tables = q.tables.filter((t) => t[0]?.[0] === '광고 ID');
    result.queries.push(q);
  }
  await shot(page, 'B11/after-b10-board-free.png', { fullPage: true });

  // CSV for the 영상 ID condition; compare against the same query on screen.
  const form = page.getByRole('form', { name: '기본 통계' });
  for (const label of ['광고 ID', '게시판 ID']) await form.getByLabel(label, { exact: true }).fill('');
  await form.getByLabel('영상 ID', { exact: true }).fill('a1-qa-video-1');
  await form.getByRole('button', { name: '통계 조회' }).click();
  await sleep(1000);
  result.csvScreen = await page.locator('main table').evaluateAll((els) => els.map((t) => [...t.rows].map((r) => [...r.cells].map((c) => c.innerText.trim()))).filter((t) => t[0]?.[0] === '광고 ID'));
  await shot(page, 'B11/after-b10-video.png', { fullPage: true });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), form.getByRole('button', { name: '현재 조건 CSV 다운로드' }).click()]);
  const file = `${EV}/B11/stats-video.csv`;
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  result.csv = {
    suggestedFilename: download.suggestedFilename(),
    bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    text: bytes.toString('utf8').replace(/^﻿/, ''),
  };
  result.csvRequest = net.filter((e) => e.action === 'stats-csv').map((e) => ({ method: e.method, url: e.url, status: e.status }));
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'B11/error.png', { fullPage: true }).catch(() => {});
}

result.console = logs;
save('B11/result-after-b10.json', result);
await browser.close();
