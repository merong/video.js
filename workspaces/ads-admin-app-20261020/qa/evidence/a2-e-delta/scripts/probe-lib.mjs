// A2-E-QA-DELTA (copied from A2-E-QA) A2-E-QA probes: the player's container shape inside a page or the preview frame, the stage layers above it, and pixel
// reads from a screenshot (decoded in a blank page, so no app page's CSP matters).
import { sleep } from './lib.mjs';

/** The skin container's shape in `doc` (Page or Frame); coordinates are in that document's viewport. */
export function playerShape(doc, root = '#player') {
  return doc.evaluate((root) => {
    const host = document.querySelector(root);
    const skin = host?.querySelector('solad-video-skin, video-skin');
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
    if (!skin) {
      const v = host?.querySelector('video');
      if (!v) return null;
      const s = getComputedStyle(v);
      return { kind: 'native', radius: s.borderRadius, border: s.border, outline: `${s.outlineStyle} ${s.outlineWidth}`, rect: r(v) };
    }
    const c = skin.shadowRoot?.querySelector('media-container');
    const s = getComputedStyle(c);
    return { kind: skin.localName, radius: s.borderRadius, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, outlineColor: s.outlineColor, borderWidth: s.borderTopWidth, borderColor: s.borderTopColor, varBorderColor: s.getPropertyValue('--media-border-color').trim(), varRadius: s.getPropertyValue('--media-border-radius').trim(), overflow: s.overflow, rect: r(c) };
  }, root);
}

/** The stage layers in the admin or demo page: view, frame, the demo's .ex-player or the admin iframe. */
export function stageLayers(page, scope = '') {
  return page.evaluate((scope) => {
    const q = (s) => document.querySelector(`${scope} ${s}`.trim());
    const st = (e) => {
      if (!e) return null;
      const s = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      return { cls: e.className?.toString?.() ?? '', radius: s.borderRadius, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, outline: `${s.outlineStyle} ${s.outlineWidth}`, shadow: s.boxShadow, overflow: s.overflow, clipPath: s.clipPath, bg: s.backgroundColor, transform: s.transform, rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } };
    };
    return { view: st(q('.sa-stage-view')), frame: st(q('.sa-stage-frame')), exPlayer: st(q('.ex-player')), iframe: st(q('.sa-stage-frame iframe')), scaleNote: q('.sa-stage-bar .sa-small')?.textContent.trim() ?? null };
  }, scope);
}

/** The preview frame's body background and .ex-player shape. */
export function frameLayers(frame) {
  return frame.evaluate(() => {
    const st = (e) => { if (!e) return null; const s = getComputedStyle(e); return { radius: s.borderRadius, border: `${s.borderTopWidth} ${s.borderTopStyle}`, shadow: s.boxShadow, overflow: s.overflow, bg: s.backgroundColor }; };
    return { html: st(document.documentElement), body: st(document.body), exPlayer: st(document.querySelector('.ex-player')) };
  });
}

let decoder = null;
/** RGB at viewport points of `page`, read from one screenshot. */
export async function pixels(page, points) {
  if (!decoder || decoder.isClosed()) decoder = await page.context().newPage();
  const png = (await page.screenshot()).toString('base64');
  const dpr = await page.evaluate(() => devicePixelRatio);
  return decoder.evaluate(async ({ png, points, dpr }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return points.map(([x, y, label]) => { const d = g.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data; return { label, x, y, rgb: [d[0], d[1], d[2]] }; });
  }, { png, points, dpr });
}

/** Corner and inside points of a container rect offset by `ox, oy` (iframe position) and `scale`. */
export function cornerPoints(rect, ox = 0, oy = 0, scale = 1) {
  const X = (v) => ox + v * scale, Y = (v) => oy + v * scale;
  return [
    [X(rect.x) + 1.5, Y(rect.y) + 1.5, 'top-left corner +1.5'],
    [X(rect.x + rect.w) - 2, Y(rect.y + rect.h) - 2, 'bottom-right corner -2'],
    [X(rect.x + 30), Y(rect.y + rect.h / 2), 'inside left middle'],
    [X(rect.x) - 3, Y(rect.y + rect.h / 2), 'outside left -3'],
  ];
}

export async function waitFrameSkin(frameFn, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const f = frameFn();
    const ok = await f?.evaluate(() => Boolean(document.querySelector('#player solad-video-skin, #player video-skin, #player video'))).catch(() => false);
    if (ok) return f;
    await sleep(250);
  }
  return null;
}
