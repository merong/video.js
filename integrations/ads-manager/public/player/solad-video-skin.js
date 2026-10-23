/**
 * Solad ad skin `<solad-video-skin>` (`.agents/plans/ads-a2e-spec.md` section 3): the default Video.js video skin
 * without the cast and AirPlay buttons, plus two host attributes read once on connect.
 *
 * - `seek-buttons="N"` (5, 10, 15 or 30): a back/forward pair of N seconds, and double-tap seeks of N seconds.
 *   `seek-placement` puts the pair after the control bar's play button (`bar`, the default), around a large play button
 *   in the middle of the video (`center`), or in both places (`both`). The middle group shows and hides with the
 *   controls, gives way to the buffering spinner and the ad screen, and replaces the play/pause flash. Below 28rem it
 *   tightens, and a logo in any corner narrows to stay clear of it.
 * - `captions="off"`: no captions button, settings item or `c` hotkey. Otherwise a video without captions shows the
 *   button disabled with the name "No captions" (hidden below 32rem, like the default skin) and keeps the settings item
 *   disabled with the value "None" (ads-a2e-spec 6.2). No caption text shows over the video.
 * - `lms` (lecture render, ads-lms-design-handoff 1): the watched layer and limit marker in the time slider, the toast,
 *   the live region, no upstream `>`/`<` hotkeys. `lms-max-rate="1.5"` hides the faster rates,
 *   `lms-seek-limit="watched"` removes the seek indicator and `lms-bookmarks` adds the bookmark button. `lms.js` drives
 *   them.
 *
 * The `logo` property takes the render's `logo` (section 5.4) and can change at any time: a corner image above the
 * video and below the controls and ad screen, a link when it has `href`.
 *
 * Load it after `videojs/video.js` and `videojs/ui/seek-button.js`; it extends the registered `video-skin`.
 */
import { loadLocale, registerI18n } from '../assets/videojs/i18n.js';

const TAG = 'solad-video-skin';
const SEEK_STEPS = ['5', '10', '15', '30'];
const SEEK_PLACEMENTS = ['bar', 'center', 'both'];
const UNAVAILABLE_KEY = 'solad.captionsUnavailable';
const unavailableText = { ko: '자막 없음', en: 'No captions', ja: '字幕なし', 'zh-CN': '无字幕' };
// The settings item's value while no captions exist.
const NONE_KEY = 'solad.captionsNone';
const noneText = { ko: '없음', en: 'None', ja: 'なし', 'zh-CN': '无' };
const BOOKMARK_KEY = 'solad.bookmark';
const bookmarkText = { ko: '북마크 추가', en: 'Add bookmark', ja: 'ブックマークを追加', 'zh-CN': '添加书签' };
// The rates of Video.js `DEFAULT_RATES`, as the settings menu lists them.
const RATES = [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2];
// The logo link's name ends with this; ko and en keep a space after the alt text, the full-width brackets do not.
const NEW_TAB_KEY = 'solad.opensInNewTab';
const newTabText = {
  ko: ' (새 탭에서 열림)',
  en: ' (opens in a new tab)',
  ja: '（新しいタブで開きます）',
  'zh-CN': '（在新标签页中打开）',
};
// packages/icons/src/assets/default/seek.svg (clockwise); the backward icon is mirrored in CSS.
const BOOKMARK_ICONS = `<svg class="media-button-icon solad-lms-bookmark-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 2h8a1.5 1.5 0 0 1 1.5 1.5V16L9 12.5 3.5 16V3.5A1.5 1.5 0 0 1 5 2Z"/><path d="M9 5v5M6.5 7.5h5"/></svg><svg class="media-button-icon solad-lms-bookmark-added-icon" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M5 1h8a2.5 2.5 0 0 1 2.5 2.5v12.6a.9.9 0 0 1-1.39.76L9 13.6l-5.11 3.26a.9.9 0 0 1-1.39-.76V3.5A2.5 2.5 0 0 1 5 1Z"/></svg>`;
const SEEK_ICON =
  '<svg class="media-button-icon media-seek-button-icon" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9 1a7.98 7.98 0 0 1 6.132 2.867l1.441-1.44a.25.25 0 0 1 .427.177V6.75a.25.25 0 0 1-.25.25h-4.146a.25.25 0 0 1-.177-.427L13.71 5.29A5.99 5.99 0 0 0 9 3a6 6 0 0 0-4.242 10.242l-1.415 1.415A8 8 0 0 1 9 1"/></svg>';

// The skin CSS uses cascade layers. `[hidden][hidden]` is `!important` in `base`, so only an `!important` rule in the
// same layer with more weight shows the captions button its core hides when no track exists.
const STYLES = `
@layer base {
  @container media-root (width >= 32rem) {
    :where(.media-skin) .video-controls-captions-button[hidden][data-availability="unavailable"] {
      display: grid !important;
    }
  }

  :where(.media-skin) .video-controls-captions-button[data-availability="unavailable"] + media-tooltip media-tooltip-shortcut {
    display: none !important;
  }
}

@layer components {
  :where(.media-skin) .media-seek-button-content {
    display: grid;
    position: relative;
  }

  :where(.media-skin) .media-seek-button-backward-icon {
    transform: scaleX(-1);
  }

  :where(.media-skin) .media-seek-button-label {
    position: absolute;
    bottom: calc(var(--media-spacing) * -0.75);
    font-size: calc(var(--media-spacing) * 2.25);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  :where(.media-skin) .media-seek-button-backward-label {
    left: -1px;
  }

  :where(.media-skin) .media-seek-button-forward-label {
    right: -1px;
  }

  @container media-root (width < 28rem) {
    :where(.media-skin) .media-seek-button-label {
      display: none;
    }
  }

  /* The middle group (seek-placement center or both): above the video, the logo and the title (20), below the control
     bar (30), dialogs and the ad screen. 44px seek buttons around a larger play button, like other video players. */
  :where(.media-skin) > .solad-center {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 25;
    display: flex;
    align-items: center;
    gap: calc(var(--media-spacing) * 6);
    translate: -50% -50%;
    color: #fff;
    transition-property: opacity, scale, visibility;
    transition-duration: calc(var(--media-duration-controls) / 2);
    transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }

  :where(.media-skin):not([data-controls-visible]) > .solad-center,
  :where(.media-skin):has(> [data-ads-overlay]) > .solad-center {
    opacity: 0;
    scale: 0.9;
    visibility: hidden;
    pointer-events: none;
    transition-duration: var(--media-duration-controls);
  }

  :where(.media-skin) > .solad-center .solad-center-button {
    width: 44px;
    height: 44px;
    border-radius: 9999px;
    background-color: rgb(0 0 0 / 0.45);
    color: inherit;
  }

  :where(.media-skin) > .solad-center .solad-center-play {
    width: 64px;
    height: 64px;
  }

  /* Narrow players keep the 44px targets but pull the group in, clear of a top-right logo under the top controls. */
  @container media-root (width < 28rem) {
    :where(.media-skin) > .solad-center {
      gap: calc(var(--media-spacing) * 3);
    }

    :where(.media-skin) > .solad-center .solad-center-play {
      width: 56px;
      height: 56px;
    }
  }

  @media (hover: hover) {
    :where(.media-skin) > .solad-center .solad-center-button:not([aria-disabled="true"]):hover {
      background-color: rgb(0 0 0 / 0.75);
      color: inherit;
    }
  }

  :where(.media-skin) > .solad-center .solad-center-play .media-button-icon {
    width: 28px;
    height: 28px;
  }

  :where(.media-skin) > .solad-center .solad-center-seek .media-button-icon {
    width: 26px;
    height: 26px;
  }

  /* The number sits inside the circular arrow. */
  :where(.media-skin) > .solad-center .solad-center-seek-label {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding-top: 1px;
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 1;
  }

  /* The spinner takes the play button's place while the video waits. */
  :where(.media-skin):has(> .media-buffering-indicator[data-visible]) > .solad-center .solad-center-play {
    visibility: hidden;
  }

  /* The play button already shows the state, so the play/pause flash would draw a second icon on top of it. */
  :where(.media-skin):has(> .solad-center) .media-playback-status-indicator {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    :where(.media-skin) > .solad-center {
      transition-property: opacity, visibility;
      scale: none;
    }
  }

  /* Logo (ads-a2e-spec 5.4): above the video (z 0) and the controls backdrop (10), level with the title (20), below
     the controls (30), dialogs (40, 50) and the ad screen (100). It draws no wider than a quarter of the player; the
     saved width stays as it is. cqi resolves against the container (media-root) for the logo and the title alike. */
  :where(.media-skin) {
    --solad-logo-size: min(var(--solad-logo-width), 25cqi);
  }

  :where(.media-skin) .solad-logo {
    --solad-logo-duration: calc(var(--media-duration-controls) / 2);
    position: absolute;
    z-index: 20;
    width: var(--solad-logo-size);
    line-height: 0;
    pointer-events: none;
    transition-property: opacity, translate, visibility;
    transition-duration: var(--solad-logo-duration);
    transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }

  :where(.media-skin) .solad-logo[data-position^="top"] {
    top: var(--solad-logo-margin);
  }

  :where(.media-skin) .solad-logo[data-position^="bottom"] {
    bottom: var(--solad-logo-margin);
  }

  :where(.media-skin) .solad-logo[data-position$="left"] {
    left: var(--solad-logo-margin);
  }

  :where(.media-skin) .solad-logo[data-position$="right"] {
    right: var(--solad-logo-margin);
  }

  /* While the controls show, a bottom logo rises over the control bar: its bottom offset plus its height. Set on the
     logo, since the container cannot query its own width. */
  :where(.media-skin) .solad-logo {
    --solad-logo-bar: calc(var(--media-spacing) * 4 + var(--media-control-size));
  }

  :where(.media-skin)[data-controls-visible] > .solad-logo[data-position^="bottom"] {
    translate: 0 calc(var(--solad-logo-bar) * -1);
  }

  /* Below 32rem the bar is thinner and the settings group sits at the top right, so a top-right logo moves under it. */
  @container media-root (width < 32rem) {
    :where(.media-skin) .solad-logo {
      --solad-logo-bar: calc(var(--media-spacing) * 3 + var(--media-control-size));
    }

    :where(.media-skin)[data-controls-visible] > .solad-logo[data-position="top-right"] {
      translate: 0 var(--solad-logo-bar);
    }
  }

  /* In a narrow player the middle group's seek buttons reach 84px either side of the middle, level with a logo in any
     corner, so the logo narrows to keep an 8px gap. */
  @container media-root (width < 28rem) {
    :where(.media-skin):has(> .solad-center) :is(.solad-logo, .media-title) {
      --solad-logo-size: min(var(--solad-logo-width), 25cqi, 50cqi - 92px - var(--solad-logo-margin));
    }
  }

  /* The title moves right of a top-left logo. */
  :where(.media-skin):has(> .solad-logo[data-position="top-left"]:not([hidden])) .media-title {
    padding-inline-start: calc(var(--solad-logo-margin) + var(--solad-logo-size) + var(--media-spacing) * 2);
  }

  /* The ad screen is a direct child of the container while a pod plays. */
  :where(.media-skin):has(> [data-ads-overlay]) > .solad-logo[data-hide-during-ads],
  :where(.media-skin):not([data-controls-visible]) > .solad-logo[data-hide-with-controls] {
    --solad-logo-duration: var(--media-duration-controls);
    opacity: 0;
    visibility: hidden;
  }

  :where(.media-skin) .solad-logo-image {
    display: block;
    width: 100%;
    height: auto;
    opacity: var(--solad-logo-opacity);
  }

  :where(.media-skin) .solad-logo-link {
    display: block;
    border-radius: 2px;
    outline: 2px solid transparent;
    outline-offset: -2px;
    pointer-events: auto;
    transition-property: outline-offset;
    transition-duration: var(--media-duration);
    transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }

  :where(.media-skin) .solad-logo-link:focus-visible {
    outline-color: var(--media-ring);
    outline-offset: 2px;
  }

  :where(.media-skin) .solad-logo-tail {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    :where(.media-skin) .solad-logo {
      transition-duration: 0s;
    }
  }

  :where(.media-skin) .solad-captions-none {
    display: none;
  }

  /* The theme hides unavailable menu items; this one stays, disabled, with "None" as its value. */
  :where(.media-skin) .media-menu-trigger-item.solad-captions-item[data-availability="unavailable"] {
    display: flex;
  }

  :where(.media-skin) .solad-captions-item[data-availability="unavailable"] .solad-captions-none {
    display: inline;
    margin-inline-start: auto;
    opacity: 0.6;
  }

  :where(.media-skin) .solad-captions-item[data-availability="unavailable"] .media-menu-hint {
    display: none;
  }

  /* Lecture (ads-lms-design-handoff 1). Watched layer under the chapter tracks, so buffer and fill paint over it. */
  :where(.media-skin) {
    --solad-lms-watched-color: color-mix(in oklab, var(--media-primary, #fff) 65%, transparent);
    --solad-lms-limit-color: #fff;
  }

  :where(.media-skin) .solad-lms-watched {
    position: absolute;
    inset-inline: 0;
    top: 50%;
    height: var(--media-spacing);
    translate: 0 -50%;
    border-radius: var(--media-control-radius);
    background: var(--solad-lms-watched, none);
    pointer-events: none;
  }

  :where(.media-skin) .solad-lms-limit {
    position: absolute;
    top: 50%;
    left: var(--solad-lms-limit, 100%);
    display: none;
    width: 2px;
    height: 12px;
    translate: -1px -50%;
    border-radius: 1px;
    background: var(--solad-lms-limit-color);
    box-shadow: 0 0 0 1px #00000080;
    pointer-events: none;
  }

  :where(.media-skin) [data-solad-lms-limit] > .solad-lms-limit {
    display: block;
  }

  :where(.media-skin) .solad-lms-bookmark {
    appearance: none;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  :where(.media-skin) .solad-lms-bookmark-added-icon,
  :where(.media-skin) .solad-lms-bookmark[data-added] .solad-lms-bookmark-icon {
    display: none;
  }

  :where(.media-skin) .solad-lms-bookmark[data-added] .solad-lms-bookmark-added-icon {
    display: block;
  }

  :where(.media-skin) .solad-lms-sr,
  :where(.media-skin) .solad-lms-live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  :where(.media-skin) .solad-lms-toast {
    position: absolute;
    top: 12px;
    inset-inline: 0;
    z-index: 38;
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    max-width: min(100% - 32px, 400px);
    min-height: 36px;
    margin-inline: auto;
    padding: 8px 16px 8px 12px;
    box-sizing: border-box;
    border-radius: 18px;
    background: color-mix(in oklab, #000 85%, transparent);
    backdrop-filter: blur(16px);
    box-shadow: 0 0 0 1px #ffffff1a;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.35;
    opacity: 0;
    translate: 0 -4px;
    pointer-events: none;
    transition-property: opacity, translate;
    transition-duration: 150ms;
  }

  :where(.media-skin) .solad-lms-toast[data-open] {
    opacity: 1;
    translate: 0 0;
  }

  :where(.media-skin) .solad-lms-toast b {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  :where(.media-skin) .solad-lms-toast-icon {
    display: grid;
    flex: none;
    width: 18px;
    height: 18px;
  }

  :where(.media-skin) .solad-lms-toast[data-kind="done"] .solad-lms-toast-icon {
    color: var(--media-primary, #fff);
  }

  :where(.media-skin)[data-solad-lms-toast] .media-title {
    opacity: 0;
    transition-duration: 150ms;
  }

  @container media-root (width < 28rem) {
    :where(.media-skin) .solad-lms-toast {
      top: 44px;
      min-height: 32px;
      padding: 6px 12px 6px 10px;
      font-size: 13px;
    }
  }

  :where(.media-skin) .solad-lms-resume {
    position: absolute;
    inset: 0;
    z-index: 35;
    display: grid;
    place-items: center;
    padding: 12px;
    background: color-mix(in oklab, #000 60%, transparent);
    backdrop-filter: blur(8px);
    color: #fff;
  }

  :where(.media-skin) .solad-lms-resume-card {
    width: min(100%, 352px);
    box-sizing: border-box;
    padding: 20px;
    border-radius: 20px;
    background: color-mix(in oklab, #000 70%, transparent);
    box-shadow: 0 0 0 1px #ffffff1a;
    text-align: center;
  }

  :where(.media-skin) .solad-lms-resume-title {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  :where(.media-skin) .solad-lms-resume-meta {
    margin: 4px 0 0;
    font-size: 13px;
    color: #ffffffa6;
  }

  :where(.media-skin) .solad-lms-resume-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 16px;
  }

  :where(.media-skin) .solad-lms-resume button {
    height: 40px;
    border: 0;
    border-radius: 999px;
    background: #ffffff1f;
    box-shadow: inset 0 0 0 1px #ffffff26;
    color: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  :where(.media-skin) .solad-lms-resume button.is-primary {
    background: var(--media-primary, #fff);
    box-shadow: none;
    color: var(--media-accent-text-color, #000);
  }

  :where(.media-skin) .solad-lms-resume button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  @container media-root (width < 28rem) {
    :where(.media-skin) .solad-lms-resume-card {
      padding: 14px;
    }

    :where(.media-skin) .solad-lms-resume-title {
      font-size: 15px;
    }

    :where(.media-skin) .solad-lms-resume-actions {
      margin-top: 10px;
    }

    :where(.media-skin) .solad-lms-resume button {
      height: 36px;
    }
  }

  @media (prefers-contrast: more) {
    :where(.media-skin) {
      --solad-lms-watched-color: color-mix(in oklab, var(--media-primary, #fff) 80%, transparent);
    }

    :where(.media-skin) .solad-lms-limit {
      width: 3px;
    }
  }

  @media (forced-colors: active) {
    :where(.media-skin) .solad-lms-watched,
    :where(.media-skin) .solad-lms-limit {
      forced-color-adjust: none;
    }

    :where(.media-skin) {
      --solad-lms-watched-color: GrayText;
      --solad-lms-limit-color: CanvasText;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :where(.media-skin) .solad-lms-toast {
      translate: none;
    }
  }
}

/* Two title lines for every preset (ads-lms-design-handoff 1.7). Outside the layers so it wins over the layered flex
   of the default skin; <media-title> owns its text, so the clamp is on the element itself. */
:where(.media-skin) .media-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
`;

const VideoSkin = customElements.get('video-skin');
if (!VideoSkin) throw new Error(`[solad] Load videojs/video.js before ${TAG}.`);

// A registered locale stops the built-in pack from loading lazily (core `loadLocale`), so each pack is registered with
// the Solad text instead of being replaced by it.
await Promise.all(
  Object.entries(unavailableText).map(async ([locale, text]) => {
    const pack = await loadLocale(locale).catch(() => undefined);

    const translations = {
      ...pack,
      solad: {
        captionsUnavailable: text,
        captionsNone: noneText[locale],
        opensInNewTab: newTabText[locale],
        bookmark: bookmarkText[locale],
      },
    };

    // The Solad copy says 자막 for captions everywhere; the upstream ko pack names the settings item 캡션.
    if (locale === 'ko') translations.menu = { ...pack?.menu, captions: '자막' };

    registerI18n(locale, translations);
  })
);

function tooltipFor(button) {
  const tooltip = button.nextElementSibling;

  return tooltip?.localName === 'media-tooltip' && tooltip.getAttribute('trigger') === button.id ? tooltip : null;
}

function removeWithTooltip(button) {
  tooltipFor(button)?.remove();
  button.remove();
}

/** The template without cast and AirPlay; the ad skin never casts. */
function createTemplate(base) {
  const template = document.createElement('template');

  template.content.append(base.content.cloneNode(true));

  for (const button of template.content.querySelectorAll('media-cast-button, media-airplay-button'))
    removeWithTooltip(button);

  return template;
}

function createSheet() {
  try {
    const sheet = new CSSStyleSheet();

    sheet.replaceSync(STYLES);
    return sheet;
  } catch {
    return null;
  }
}

const sheet = createSheet();

function seekButton(direction, seconds) {
  const template = document.createElement('template');
  const value = direction === 'backward' ? `-${seconds}` : seconds;
  const id = `solad-seek-${direction}`;

  // The number is decoration; the button's name comes from the upstream seek label, which includes the seconds.
  template.innerHTML = `<media-seek-button seconds="${value}" class="media-button media-seek-button" id="${id}">
<span class="media-seek-button-content">${SEEK_ICON.replace('media-seek-button-icon', `media-seek-button-icon media-seek-button-${direction}-icon`)}<span class="media-seek-button-label media-seek-button-${direction}-label" aria-hidden="true">${seconds}</span></span>
</media-seek-button><media-tooltip trigger="${id}" side="top" class="media-popup media-popup-safe-area media-popup-transition media-popup-surface media-tooltip"><media-tooltip-label></media-tooltip-label><media-tooltip-shortcut class="media-tooltip-shortcut"></media-tooltip-shortcut></media-tooltip>`;

  return template.content;
}

/** A middle seek button: the bar's name and icon, without a tooltip (like the upstream compat skin's middle group). */
function centerSeekButton(direction, seconds) {
  const template = document.createElement('template');
  const value = direction === 'backward' ? `-${seconds}` : seconds;

  template.innerHTML = `<media-seek-button seconds="${value}" class="media-button media-seek-button solad-center-button solad-center-seek" id="solad-center-seek-${direction}">
<span class="media-seek-button-content">${SEEK_ICON.replace('media-seek-button-icon', `media-seek-button-icon media-seek-button-${direction}-icon`)}<span class="solad-center-seek-label" aria-hidden="true">${seconds}</span></span>
</media-seek-button>`;

  return template.content;
}

/**
 * The middle group after the controls, so the bar's play button stays first in the Tab order and for
 * `querySelector('media-play-button')`. Its play button copies the untouched template's icons.
 */
function addCenterGroup(root, seconds, pristinePlay) {
  const container = root.querySelector('media-container');
  if (!container || !pristinePlay) return;

  const group = root.ownerDocument.createElement('div');
  const play = pristinePlay.cloneNode(true);

  group.className = 'solad-center';
  play.id = 'solad-center-play';
  play.classList.add('solad-center-button', 'solad-center-play');
  group.append(centerSeekButton('backward', seconds), play, centerSeekButton('forward', seconds));
  container.append(group);
}

function addSeekButtons(root, seconds, placement, pristinePlay) {
  const play = root.querySelector('.video-controls-primary > media-play-button');

  if (play && placement !== 'center')
    (tooltipFor(play) ?? play).after(seekButton('backward', seconds), seekButton('forward', seconds));

  if (placement !== 'bar') addCenterGroup(root, seconds, pristinePlay);

  // Double taps match the buttons; arrow keys keep their upstream step.
  for (const gesture of root.querySelectorAll('media-gesture[type="doubletap"][action="seekStep"]')) {
    gesture.setAttribute('value', gesture.getAttribute('region') === 'left' ? `-${seconds}` : seconds);
  }
}

const isCaptionsText = (node) => node.localName === 'media-text' && node.getAttribute('token') === 'menu.captions';

function removeCaptions(root) {
  for (const button of root.querySelectorAll('media-captions-button')) removeWithTooltip(button);

  for (const item of root.querySelectorAll('media-menu-item[commandfor]')) {
    if (![...item.children].some(isCaptionsText)) continue;

    root.getElementById(item.getAttribute('commandfor'))?.remove();
    item.remove();
  }

  for (const hotkey of root.querySelectorAll('media-hotkey[action="toggleSubtitles"]')) hotkey.remove();
}

function labelUnavailable(root) {
  const unavailable = { key: UNAVAILABLE_KEY, text: unavailableText.en };

  // An empty label keeps the upstream "Enable/Disable captions" names while a track exists.
  for (const button of root.querySelectorAll('media-captions-button'))
    button.label = (state) => (state.availability === 'unavailable' ? unavailable : '');

  // The settings item stays, disabled (the core sets `disabled`, so its submenu does not open), with "None".
  for (const item of root.querySelectorAll('media-menu-item[commandfor]')) {
    if (![...item.children].some(isCaptionsText)) continue;

    const none = document.createElement('media-text');

    none.className = 'solad-captions-none';
    none.setAttribute('token', NONE_KEY);
    none.textContent = noneText.en;
    item.classList.add('solad-captions-item');
    item.querySelector('.media-menu-hint')?.before(none);
    showUnavailable(item);
  }
}

/**
 * Keep the settings item shown at every width while no track exists. The core hides it then, and the menu leaves hidden
 * items out of its height, so showing it with CSS clipped it under the controls (QA L3-01). The core sets `hidden` only
 * when the option state changes, so taking it off again does not loop; `disabled` stays.
 */
function showUnavailable(item) {
  const show = () => {
    if (item.hidden && item.getAttribute('data-availability') === 'unavailable') item.hidden = false;
  };

  new MutationObserver(show).observe(item, { attributes: true, attributeFilter: ['hidden', 'data-availability'] });
  show();
}

function rateCss(max) {
  const hidden = RATES.filter((rate) => rate > max + 1e-6).map(
    (rate) => `:where(.media-skin) media-menu-radio-item[data-rate="${rate}"]`
  );

  return hidden.length ? `${hidden.join(',\n')} { display: none !important; }` : '';
}

/** The lecture parts of the template copy (ads-lms-design-handoff 1); `lms.js` fills them. */
function configureLecture(root, { maxRate, seekLimit, bookmarks }) {
  const document = root.ownerDocument;
  const container = root.querySelector('media-container');
  const slider = root.querySelector('media-time-slider');

  // `lms.js` steps the rate without the upstream wrap from 2× to 0.2× and stops at the cap.
  for (const hotkey of root.querySelectorAll('media-hotkey[action="speedUp"], media-hotkey[action="speedDown"]'))
    hotkey.remove();

  // The indicator shows the requested direction, so a blocked seek would still show one (L-1 spike).
  if (seekLimit === 'watched') root.querySelector('media-seek-indicator')?.remove();

  if (slider) {
    const watched = document.createElement('div');
    const limit = document.createElement('i');

    watched.className = 'solad-lms-watched';
    watched.setAttribute('aria-hidden', 'true');
    limit.className = 'solad-lms-limit';
    limit.setAttribute('aria-hidden', 'true');
    // Before the chapters so the buffer and the fill paint over the watched layer.
    slider.prepend(watched);
    slider.append(limit);
  }

  if (maxRate > 0 && maxRate < 2) {
    const style = document.createElement('style');
    const group = root.querySelector('media-playback-rate-radio-group');

    style.textContent = rateCss(maxRate);
    root.append(style);

    // `hidden` also makes menu arrow keys skip the items; the group rebuilds them when the locale changes.
    if (group) {
      const mark = () => {
        for (const item of group.querySelectorAll('media-menu-radio-item[data-rate]'))
          if (Number(item.getAttribute('data-rate')) > maxRate + 1e-6 && !item.hidden) item.hidden = true;
      };

      new MutationObserver(mark).observe(group, { childList: true, subtree: true, attributes: true });
      mark();
    }
  }

  if (bookmarks) {
    const group = root.querySelector('.video-controls-primary > .video-time-slider-group');
    const template = document.createElement('template');
    const id = 'solad-lms-bookmark';

    template.innerHTML = `<button type="button" class="media-button solad-lms-bookmark" id="${id}" aria-keyshortcuts="b">${BOOKMARK_ICONS}<span class="solad-lms-sr"><media-text token="${BOOKMARK_KEY}">${bookmarkText.en}</media-text></span></button><media-tooltip trigger="${id}" side="top" class="media-popup media-popup-safe-area media-popup-transition media-popup-surface media-tooltip"><media-text token="${BOOKMARK_KEY}">${bookmarkText.en}</media-text><span class="media-tooltip-shortcut">B</span></media-tooltip>`;
    group?.after(template.content);
  }

  if (container) {
    const toast = document.createElement('div');
    const live = document.createElement('div');

    toast.className = 'solad-lms-toast';
    toast.hidden = true;
    toast.setAttribute('aria-hidden', 'true');
    toast.innerHTML = '<span class="solad-lms-toast-icon"></span><span class="solad-lms-toast-text"></span>';
    live.className = 'solad-lms-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    container.append(toast, live);
  }
}

/** The logo's image and, with `href` and `alt`, its link; the image is kept while its `src` stays. */
function logoContent(slot, logo) {
  const document = slot.ownerDocument;
  let image = slot.querySelector('img');

  if (image?.getAttribute('src') !== logo.src) {
    image = document.createElement('img');
    image.className = 'solad-logo-image';
    image.decoding = 'async';
    image.draggable = false;
    // A broken image would show its frame; the place hides instead (section 5.4).
    image.addEventListener('error', () => {
      if (slot.contains(image)) slot.hidden = true;
    });
    image.addEventListener('load', () => {
      if (slot.contains(image)) slot.hidden = false;
    });
    image.setAttribute('src', logo.src);
    slot.hidden = false;
  }

  if (!logo.href || !logo.alt) {
    // Decorative: no name, and presses reach the video below.
    image.alt = '';
    slot.replaceChildren(image);
    return;
  }

  const link = document.createElement('a');
  const tail = document.createElement('span');
  const text = document.createElement('media-text');

  link.className = 'solad-logo-link';
  link.href = logo.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  image.alt = logo.alt;
  tail.className = 'solad-logo-tail';
  text.setAttribute('token', NEW_TAB_KEY);
  text.textContent = newTabText.en;
  tail.append(text);
  link.append(image, tail);
  slot.replaceChildren(link);
}

/** Draw, change or remove the logo place before the controls, so a link comes first in the Tab order. */
function renderLogo(root, logo) {
  const container = root.querySelector('media-container');
  if (!container) return;

  const child = (name) => [...container.children].find((node) => node.matches(name)) ?? null;
  let slot = child('.solad-logo');

  if (!logo?.src) {
    slot?.remove();
    return;
  }

  if (!slot) {
    slot = root.ownerDocument.createElement('div');
    slot.className = 'solad-logo';
    container.insertBefore(slot, child('media-controls'));
  }

  slot.dataset.position = logo.position;
  slot.toggleAttribute('data-hide-during-ads', logo.hideDuringAds);
  slot.toggleAttribute('data-hide-with-controls', logo.hideWithControls);
  // On the container, so the title can make room for a top-left logo.
  container.style.setProperty('--solad-logo-width', `${logo.width}px`);
  container.style.setProperty('--solad-logo-margin', `${logo.margin}px`);
  container.style.setProperty('--solad-logo-opacity', String(logo.opacity / 100));
  logoContent(slot, logo);
}

export class SoladVideoSkinElement extends VideoSkin {
  static tagName = TAG;
  static template = createTemplate(VideoSkin.template);

  #configured = false;
  #logo = null;

  constructor() {
    super();

    const root = this.shadowRoot;

    if (sheet && root.adoptedStyleSheets?.length) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    else {
      const style = document.createElement('style');

      style.textContent = STYLES;
      root.append(style);
    }
  }

  /** The render's `logo` (`null` for none); set it again to change the place in place. */
  get logo() {
    return this.#logo;
  }

  set logo(value) {
    this.#logo = value ?? null;
    renderLogo(this.shadowRoot, this.#logo);
  }

  connectedCallback() {
    // The loader sets the attributes before appending, so the controls are final before any of them connects.
    if (!this.#configured) {
      const root = this.shadowRoot;
      const seconds = this.getAttribute('seek-buttons');
      const placement = this.getAttribute('seek-placement');

      this.#configured = true;

      if (SEEK_STEPS.includes(seconds))
        addSeekButtons(
          root,
          seconds,
          SEEK_PLACEMENTS.includes(placement) ? placement : 'bar',
          this.constructor.template.content.querySelector('.video-controls-primary > media-play-button')
        );

      if (this.getAttribute('captions') === 'off') removeCaptions(root);
      else labelUnavailable(root);

      if (this.hasAttribute('lms'))
        configureLecture(root, {
          maxRate: Number(this.getAttribute('lms-max-rate')) || 2,
          seekLimit: this.getAttribute('lms-seek-limit'),
          bookmarks: this.hasAttribute('lms-bookmarks'),
        });
    }

    super.connectedCallback?.();
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, SoladVideoSkinElement);
