// Shared helpers for the 플레이어 preset scenarios.
import { BASE, sleep, redact } from './lib.mjs';

export const FIELDS = ['이름', '플레이어 종류', '스킨', '강조색', '강조 글자색', '테두리 색', '모서리 둥글기 (px)', '글꼴', '화면 채우기', '크기 기준', '광고 문구 언어', '건너뛰기 문구', '건너뛰기 대기 문구', '광고 시간 문구', '광고 음량 막대 색', '건너뛰기 버튼 모서리 (px)', '광고 글자 크기 (px)'];

export const presetForm = (page) => page.locator('main form').filter({ visible: true }).first();

/** Resolves a form control by accessible role and exact name (the colour pickers are named "… 색 고르기"). */
export function field(page, label) {
  const form = presetForm(page);
  return form.getByRole('combobox', { name: label, exact: true }).or(form.getByRole('spinbutton', { name: label, exact: true })).or(form.getByRole('textbox', { name: label, exact: true }));
}

/** Captures every player-preset API JSON body (redacted) into `sink`. */
export function captureBodies(context, sink = []) {
  context.on('response', async (response) => {
    const url = new URL(response.url());
    const action = url.searchParams.get('action');
    if (!url.pathname.endsWith('/api/index.php') || !/player-preset/.test(action ?? '')) return;
    const request = response.request();
    let sent = null;
    try {
      sent = request.postDataJSON();
    } catch {
      sent = null;
    }
    sink.push({ at: Date.now(), method: request.method(), action, status: response.status(), sent: redact(sent), body: redact(await response.json().catch(() => null)) });
  });
  return sink;
}

export async function gotoList(page) {
  await page.goto(`${BASE}/#/players`);
  await page.getByRole('table', { name: '플레이어 프리셋' }).filter({ visible: true }).waitFor();
  await sleep(500);
}

export async function listRows(page) {
  return page.getByRole('table', { name: '플레이어 프리셋' }).filter({ visible: true }).evaluate((t) => [...t.tBodies[0].rows].map((r) => [...r.cells].slice(0, 5).map((c) => c.innerText.trim())));
}

export async function listJson(page) {
  return (await page.request.get(`${BASE}/api/index.php?action=player-presets`)).json();
}

export async function readForm(page) {
  const out = {};
  for (const label of FIELDS) {
    const control = field(page, label);
    if (!(await control.count())) {
      out[label] = '<absent>';
      continue;
    }
    if (!(await control.isVisible())) {
      out[label] = '<hidden>';
      continue;
    }
    out[label] = await control.evaluate((el) => (el.tagName === 'SELECT' ? `${el.value}|${el.selectedOptions[0]?.textContent}` : el.value));
  }
  return out;
}

export async function fill(page, values) {
  for (const [label, value] of Object.entries(values)) {
    const control = field(page, label);
    if (await control.evaluate((el) => el.tagName === 'SELECT')) await control.selectOption({ label: value });
    else await control.fill(String(value));
  }
}

export async function liveTexts(page) {
  const form = presetForm(page);
  return {
    status: (await form.getByRole('status').allInnerTexts()).filter(Boolean),
    alert: (await form.getByRole('alert').allInnerTexts()).filter(Boolean),
    pageStatus: (await page.locator('main').filter({ visible: true }).getByRole('status').allInnerTexts()).filter(Boolean),
  };
}

export const idOf = (json, name) => json?.data?.presets?.find((p) => p.name === name)?.id ?? null;
