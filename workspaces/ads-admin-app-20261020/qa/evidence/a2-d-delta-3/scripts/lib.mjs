// A2-D-QA-DELTA-2 (copied from A2-D-QA-DELTA) (copied from A2-D-QA) (copied from A2-1-QA-DELTA) shared Playwright helpers. Evidence never stores the password, cookies, CSRF or signed tokens.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/brian/works/tools/videojs/video.js';
const require = createRequire(`${REPO}/apps/e2e/package.json`);
const { chromium } = require('@playwright/test');

export const BASE = 'http://127.0.0.1:18781';
export const QA_DIR = '/private/tmp/ads-a2dd-qa-F67XG8Tx';
export const EV = `${REPO}/workspaces/ads-admin-app-20261020/qa/evidence/a2-d-delta-3`;
export const USER = 'a2dd3-qa-admin';

const SECRET_KEY = /token|password|cookie|csrf|secret|signature/i;

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '<redacted>' : redact(v)]));
  }
  return value;
}

export function redactUrl(raw) {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) if (SECRET_KEY.test(key)) url.searchParams.set(key, '<redacted>');
    return url.href;
  } catch {
    return raw;
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function save(rel, data) {
  const file = path.join(EV, rel);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

export async function launch({ reducedMotion } = {}) {
  // A1-QA-DELTA-2: OS media-session commands pause ads in headless Chrome, so the flag is on from the start for every run.
  const args = (process.env.QA_CHROME_ARGS ?? '--disable-features=HardwareMediaKeyHandling,GlobalMediaControls').split(' ').filter(Boolean);
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args });
  return browser;
}

export async function newContext(browser, { width = 1280, height = 800, reducedMotion } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, reducedMotion });
  return context;
}

/** Records every request with status; API requests keep their action and a redacted JSON body summary. */
export function recordNetwork(context, log = []) {
  const started = Date.now();
  let lastToken = null;
  context.on('request', (request) => {
    const url = new URL(request.url());
    const entry = {
      t: Date.now() - started,
      method: request.method(),
      url: redactUrl(request.url()),
      type: request.resourceType(),
      frame: (() => {
        try {
          return redactUrl(request.frame().url());
        } catch {
          return null;
        }
      })(),
      action: url.pathname.endsWith('/api/index.php') ? url.searchParams.get('action') : null,
      csrfHeader: Boolean(request.headers()['x-csrf-token']),
      csrfMatchesLastResponse: request.headers()['x-csrf-token'] ? request.headers()['x-csrf-token'] === lastToken : null,
      sameOrigin: url.origin === BASE,
    };
    request._qa = entry;
    log.push(entry);
  });
  context.on('response', async (response) => {
    const entry = response.request()._qa;
    if (!entry) return;
    entry.status = response.status();
    const token = response.headers()['x-csrf-token'];
    entry.respCsrfHeader = Boolean(token);
    if (token) lastToken = token;
    if (entry.action) {
      try {
        const body = await response.json();
        entry.ok = body?.ok;
        if (!body?.ok) entry.error = redact(body?.error ?? body);
      } catch {
        /* non JSON (CSV) */
      }
    }
  });
  context.on('requestfailed', (request) => {
    const entry = request._qa;
    if (entry) entry.failed = request.failure()?.errorText ?? 'failed';
  });
  return log;
}

export function apiCalls(log, from = 0) {
  return log.filter((e) => e.action !== null && e.t >= from).map((e) => ({ t: e.t, method: e.method, action: e.action, status: e.status, ok: e.ok, csrfHeader: e.csrfHeader, csrfMatchesLastResponse: e.csrfMatchesLastResponse, respCsrfHeader: e.respCsrfHeader, error: e.error }));
}

export function consoleCollector(page, sink = []) {
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) sink.push({ type: msg.type(), text: msg.text().slice(0, 500) });
  });
  page.on('pageerror', (err) => sink.push({ type: 'pageerror', text: String(err).slice(0, 500) }));
  page.on('dialog', async (dialog) => {
    sink.push({ type: 'native-dialog', dialogType: dialog.type(), text: dialog.message().slice(0, 200) });
    await dialog.dismiss();
  });
  return sink;
}

export function password() {
  return fs.readFileSync(`${QA_DIR}/admin-password`, 'utf8');
}

export async function login(page, { pw = password() } = {}) {
  await page.goto(`${BASE}/`);
  await page.getByLabel('아이디', { exact: true }).fill(USER);
  await page.getByLabel('비밀번호', { exact: true }).fill(pw);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByRole('button', { name: '로그아웃' }).waitFor({ timeout: 15000 });
}

export async function shot(page, rel, options = {}) {
  const file = path.join(EV, rel);
  ensureDir(path.dirname(file));
  await page.screenshot({ path: file, ...options });
  return file;
}

export async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
}

export async function deepActive(page) {
  return page.evaluate(() => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (!el) return null;
    if (el === document.body) return { tag: 'BODY' };
    return { tag: el.tagName, id: el.id || null, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80), role: el.getAttribute('role') };
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
