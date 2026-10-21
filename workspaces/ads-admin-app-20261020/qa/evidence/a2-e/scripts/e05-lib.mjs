// A2-E-QA E05 helpers: the stage player's logo place measured against its container, the deep active element, the
// demo logo group state, and waits for the controls to show or hide. Nothing here stores cookies or tokens.
import { sleep } from './lib.mjs';

export function logoFacts(page) {
  return page.evaluate(() => {
    const skin = document.querySelector('#player solad-video-skin, #player video-skin');
    const root = skin?.shadowRoot;
    const media = document.querySelector('#player video');
    if (!root) return { skin: skin?.localName ?? null, native: Boolean(document.querySelector('#player video')) };
    const cont = root.querySelector('media-container');
    const slot = root.querySelector('.solad-logo');
    const c = cont.getBoundingClientRect();
    const title = root.querySelector('.media-title');
    const base = {
      skin: skin.localName,
      containerW: Math.round(c.width),
      radius: getComputedStyle(cont).borderRadius,
      controlsVisible: cont.hasAttribute('data-controls-visible'),
      adsOverlay: Boolean(cont.querySelector(':scope > [data-ads-overlay]')),
      t: media ? Math.round(media.currentTime * 100) / 100 : null,
      paused: media?.paused ?? null,
      videoTag: media?.dataset.qaTag ?? null,
      title: title ? { text: title.textContent.trim(), padStart: getComputedStyle(title).paddingInlineStart, left: Math.round(title.getBoundingClientRect().left - c.left), textLeft: (() => { const r = document.createRange(); r.selectNodeContents(title); const b = [...r.getClientRects()][0]; return b ? Math.round(b.left - c.left) : null; })(), display: getComputedStyle(title).display } : null,
    };
    if (!slot) return { ...base, slot: null };
    const s = slot.getBoundingClientRect();
    const cs = getComputedStyle(slot);
    const img = slot.querySelector('img');
    const link = slot.querySelector('a');
    const tail = slot.querySelector('.solad-logo-tail');
    const children = [...cont.children].map((n) => n.localName + (n.className && typeof n.className === 'string' ? `.${n.className.split(' ')[0]}` : ''));
    return {
      ...base,
      slot: {
        position: slot.dataset.position,
        hidden: slot.hidden,
        hideDuringAds: slot.hasAttribute('data-hide-during-ads'),
        hideWithControls: slot.hasAttribute('data-hide-with-controls'),
        display: cs.display,
        opacity: cs.opacity,
        visibility: cs.visibility,
        translate: cs.translate,
        zIndex: cs.zIndex,
        pointerEvents: cs.pointerEvents,
        transition: `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`,
        rect: { w: Math.round(s.width * 10) / 10, h: Math.round(s.height * 10) / 10 },
        gap: { left: Math.round((s.left - c.left) * 10) / 10, right: Math.round((c.right - s.right) * 10) / 10, top: Math.round((s.top - c.top) * 10) / 10, bottom: Math.round((c.bottom - s.bottom) * 10) / 10 },
        vars: { width: cont.style.getPropertyValue('--solad-logo-width'), margin: cont.style.getPropertyValue('--solad-logo-margin'), opacity: cont.style.getPropertyValue('--solad-logo-opacity'), bar: cs.getPropertyValue('--solad-logo-bar').trim() },
        img: img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt'), opacity: getComputedStyle(img).opacity, natural: `${img.naturalWidth}x${img.naturalHeight}`, rendered: `${Math.round(img.getBoundingClientRect().width * 10) / 10}x${Math.round(img.getBoundingClientRect().height * 10) / 10}`, complete: img.complete, draggable: img.draggable } : null,
        link: link ? { href: link.getAttribute('href'), target: link.target, rel: link.rel, tail: tail?.textContent ?? null, tailClip: tail ? getComputedStyle(tail).clipPath : null, outline: `${getComputedStyle(link).outlineStyle} ${getComputedStyle(link).outlineWidth} ${getComputedStyle(link).outlineColor} offset ${getComputedStyle(link).outlineOffset}`, pointerEvents: getComputedStyle(link).pointerEvents } : null,
        orderInContainer: children,
      },
    };
  });
}

export const deepActive = (page) => page.evaluate(() => {
  let a = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return `${a?.localName}${a?.id ? `#${a.id}` : ''}${a?.className && typeof a.className === 'string' ? `.${a.className.split(' ')[0]}` : ''} ${a?.getAttribute('aria-label') ?? ''}`.trim();
});

export const groupState = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id);
  const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const field = (id) => { const el = $(id); return el ? { value: el.value, disabled: el.disabled, ariaDisabled: el.getAttribute('aria-disabled'), invalid: el.getAttribute('aria-invalid'), required: el.getAttribute('aria-required'), help: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((x) => text($(x))).join(' / '), helpClass: $(`${id}-h`)?.className ?? null } : null; };
  const toggle = (key) => { const b = document.querySelector(`button.sa-toggle[data-key="${key}"]`); return b ? { checked: b.getAttribute('aria-checked'), disabled: b.disabled } : null; };
  return {
    query: location.search,
    img: field('logo-img'),
    imgHelpClass: $('logo-img-h')?.className,
    urlShown: !$('logo-url-field').hidden,
    url: field('logo-url'),
    offReason: $('logo-off').hidden ? null : text($('logo-off')),
    nativeReason: $('logo-off-native').hidden ? null : text($('logo-off-native')),
    bodyOff: $('logo-body').classList.contains('sa-off-body'),
    position: document.querySelector('input[name="logo-position"]:checked')?.value ?? null,
    positionDisabled: [...document.querySelectorAll('input[name="logo-position"]')].some((r) => r.disabled) || $('logo-pos').disabled,
    positionNow: text($('logo-pos-now')),
    w: field('logo-w'), op: field('logo-op'), m: field('logo-m'), href: field('logo-href'), alt: field('logo-alt'),
    hideDuringAds: toggle('logoHideDuringAds'), hideWithControls: toggle('logoHideWithControls'),
    cdLogo: $('cd-logo').hidden ? null : text($('cd-logo')),
    queryNote: $('query-note') && !$('query-note').hidden ? text($('query-note')) : null,
    codeHasLogo: /logo/i.test(document.querySelector('#code-html code')?.textContent ?? '') || /logo/i.test(document.querySelector('#code-js code')?.textContent ?? ''),
  };
});

/** Waits until the container's controls state is `visible`; moves the mouse away first when waiting for hidden. */
export async function waitControls(page, visible, timeout = 9000) {
  if (!visible) await page.mouse.move(2, 2);
  else await page.locator('#player').hover();
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await page.evaluate(() => document.querySelector('#player solad-video-skin')?.shadowRoot?.querySelector('media-container')?.hasAttribute('data-controls-visible'));
    if (v === visible) { await sleep(500); return true; }
    await sleep(150);
  }
  return false;
}

/** Sets a demo text field and commits it with `change`. */
export async function setField(page, id, value) {
  await page.locator(`#${id}`).fill(value);
  await page.locator(`#${id}`).dispatchEvent('change');
  await sleep(700);
}

/** Tags the stage video so a rebuilt player can be told from the same one. */
export const tagVideo = (page, tag) => page.evaluate((tag) => { const v = document.querySelector('#player video'); if (v) v.dataset.qaTag = tag; return Boolean(v); }, tag);

export const nowText = async (page) => (await page.locator('#now').innerText().catch(() => '')).replace(/\s+/g, ' ');
