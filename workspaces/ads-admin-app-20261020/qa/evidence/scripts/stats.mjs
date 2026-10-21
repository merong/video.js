// Shared B11 helper: query the 기본 통계 form and keep the rendered table plus the stats API body.
import { BASE, redact, sleep } from './lib.mjs';

export async function queryStats(page, filters = {}) {
  await page.goto(`${BASE}/#/reports`);
  const form = page.getByRole('form', { name: '기본 통계' });
  await form.waitFor();
  for (const label of ['광고 ID', '영상 ID', '게시판 ID']) await form.getByLabel(label, { exact: true }).fill(filters[label] ?? '');
  const responsePromise = page.waitForResponse((res) => /action=stats\b/.test(res.url()) && res.request().method() === 'GET', { timeout: 15000 }).catch(() => null);
  await form.getByRole('button', { name: '통계 조회' }).click();
  const response = await responsePromise;
  await sleep(800);
  const body = response ? redact(await response.json().catch(() => null)) : null;
  const tables = await page.locator('main table').evaluateAll((els) => els.map((t) => [...t.rows].map((r) => [...r.cells].map((c) => c.innerText.trim()))));
  return { filters, url: response?.url() ?? null, status: response?.status() ?? null, body, tables, formStatus: await form.getByRole('status').innerText().catch(() => null) };
}
