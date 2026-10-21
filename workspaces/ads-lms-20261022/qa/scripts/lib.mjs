// L-3-QA shared Playwright helpers. Evidence never stores the password, cookies, CSRF or tokens.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/brian/works/tools/videojs/video.js';
const require = createRequire(`${REPO}/apps/e2e/package.json`);
export const { chromium, webkit } = require('@playwright/test');

export const BASE = 'http://127.0.0.1:18791';
export const QA_DIR = '/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/3c8126b3-a613-4129-aab9-a86515b837b2/scratchpad/lms-l3-qa';
export const EV = `${REPO}/workspaces/ads-lms-20261022/qa/evidence`;
export const USER = 'l3-qa-admin';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function save(rel, data) {
  const file = path.join(EV, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

export async function launch(engine = 'chromium') {
  if (engine === 'webkit') return webkit.launch({ headless: true });
  return chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=HardwareMediaKeyHandling,GlobalMediaControls', '--autoplay-policy=no-user-gesture-required'] });
}

export function consoleCollector(page, sink = []) {
  page.on('console', (m) => { if (m.type() === 'error') sink.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => sink.push(`pageerror: ${String(e).slice(0, 300)}`));
  return sink;
}

export async function login(page) {
  const pw = fs.readFileSync(`${QA_DIR}/admin-password`, 'utf8');
  await page.goto(`${BASE}/`);
  await page.getByLabel('아이디', { exact: true }).fill(USER);
  await page.getByLabel('비밀번호', { exact: true }).fill(pw);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByRole('button', { name: '로그아웃' }).waitFor({ timeout: 15000 });
}

export async function shot(page, rel) {
  const file = path.join(EV, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
}

/** The page's <video> inside the player (shadow roots pierced). */
export const video = (page) => page.evaluate(() => {
  const find = (root) => {
    const v = root.querySelector('video');
    if (v) return v;
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const f = find(el.shadowRoot); if (f) return f; }
    return null;
  };
  const v = find(document.querySelector('#player') ?? document);
  return v ? { t: v.currentTime, paused: v.paused, rate: v.playbackRate, d: v.duration, src: v.currentSrc } : null;
});
