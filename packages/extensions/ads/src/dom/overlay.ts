import {
  fullscreenEnterIcon,
  fullscreenExitIcon,
  pauseIcon,
  playIcon,
  volumeHighIcon,
  volumeOffIcon,
} from '@videojs/icons/html';
import {
  containsComposed,
  getDeepActiveElement,
  type WebKitDocument,
  type WebKitFullscreenElement,
} from '@videojs/utils/dom';
import { isFunction } from '@videojs/utils/predicate';

import type { PlaybackAd } from '../core/playback';
import { overlayStyles } from './overlay.styles';
import {
  formatAdLabel,
  formatAdTime,
  observeAdsLocale,
  resolveAdsLabels,
  resolveAdsLocale,
  type AdsUIOptions,
} from './ui';

interface OverlayActions {
  playPause(): void;
  skip(): void;
  mute(): void;
  volume(value: number): void;
  click(): void;
}

/** Observed playback and explicit intent, never an independent ad clock. @internal */
export interface AdsOverlayState {
  readonly elapsed: number;
  readonly duration: number | null;
  readonly started: boolean;
  readonly paused: boolean;
  readonly phase: 'loading' | 'playing' | 'paused' | 'blocked';
  readonly muted: boolean;
  readonly volume: number;
}

function setText(element: Element, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function label(element: HTMLElement, value: string): void {
  element.setAttribute('aria-label', value);
  element.title = value;
}

function icon(button: HTMLButtonElement, name: string, svg: string): void {
  if (button.dataset.icon === name) return;

  button.dataset.icon = name;
  // Only bundled @videojs/icons markup enters this boundary. Labels use textContent/attributes.
  button.innerHTML = svg;
}

/** A shadow boundary keeps the ad's video out of content-media discovery. @internal */
export class AdsOverlay {
  readonly host: HTMLDivElement;
  readonly root: ShadowRoot;
  readonly creative: HTMLDivElement;
  readonly play: HTMLButtonElement;
  readonly skip: HTMLButtonElement;
  readonly mute: HTMLButtonElement;
  readonly volume: HTMLInputElement;
  readonly link: HTMLAnchorElement;
  readonly status: HTMLParagraphElement;
  readonly timer: HTMLSpanElement;
  readonly fullscreen: HTMLButtonElement;
  readonly #panel: HTMLElement;
  readonly #container: HTMLElement;
  readonly #actions: OverlayActions;
  readonly #inert = new Map<HTMLElement, boolean>();
  readonly #observer: MutationObserver;
  readonly #previousFocus: HTMLElement | null;
  readonly #position: string;
  readonly #listeners = new AbortController();
  readonly #stopLocale: () => void;
  #ui: AdsUIOptions;
  #ad: PlaybackAd | null = null;
  #state: AdsOverlayState | null = null;
  #index = 0;
  #count = 0;
  #fullscreenError = false;
  #destroyed = false;

  constructor(container: HTMLElement, actions: OverlayActions, ui: AdsUIOptions = {}) {
    this.#container = container;
    this.#actions = actions;
    this.#ui = ui;
    const doc = container.ownerDocument;
    const focused = getDeepActiveElement(doc);

    this.#previousFocus = focused instanceof HTMLElement && containsComposed(container, focused) ? focused : null;
    this.#position = container.style.position;

    if (getComputedStyle(container).position === 'static' || !getComputedStyle(container).position)
      container.style.position = 'relative';

    this.host = doc.createElement('div');
    this.host.dataset.adsOverlay = '';
    this.host.tabIndex = -1;
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');

    style.textContent = overlayStyles;
    this.#panel = doc.createElement('section');
    this.#panel.className = 'panel';
    this.#panel.setAttribute('part', 'panel');
    this.creative = doc.createElement('div');
    this.creative.className = 'creative';
    this.creative.setAttribute('part', 'creative');
    const header = doc.createElement('div');

    header.className = 'header';
    this.status = doc.createElement('p');
    this.status.className = 'status';
    this.status.setAttribute('part', 'status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-atomic', 'true');
    header.append(this.status);
    const footer = doc.createElement('div');

    footer.className = 'footer';
    footer.setAttribute('part', 'controls');
    const actionsRow = doc.createElement('div');

    actionsRow.className = 'actions';
    const controls = doc.createElement('div');

    controls.className = 'controls';
    this.timer = doc.createElement('span');
    this.timer.className = 'timer';
    this.timer.setAttribute('part', 'timer');
    this.timer.setAttribute('aria-live', 'off');
    this.play = this.#button('play', actions.playPause);
    this.play.setAttribute('aria-pressed', 'false');
    this.play.setAttribute('aria-keyshortcuts', 'k');
    this.skip = this.#button('skip', actions.skip);
    this.skip.className = 'skip';
    this.skip.disabled = true;
    this.mute = this.#button('mute', actions.mute);
    this.mute.setAttribute('aria-keyshortcuts', 'm');
    this.volume = doc.createElement('input');
    this.volume.className = 'volume';
    this.volume.setAttribute('part', 'volume');
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '1';
    this.volume.step = '0.05';
    this.volume.addEventListener('input', () => actions.volume(this.volume.valueAsNumber));
    this.link = doc.createElement('a');
    this.link.className = 'link';
    this.link.setAttribute('part', 'cta');
    this.link.target = '_blank';
    this.link.rel = 'noopener noreferrer';
    this.link.addEventListener('click', actions.click);
    this.fullscreen = this.#button('fullscreen', () => void this.#setFullscreen(!this.#isFullscreen()));
    this.fullscreen.setAttribute('aria-keyshortcuts', 'f');
    actionsRow.append(this.link, this.skip);
    controls.append(this.play, this.mute, this.volume, this.timer, this.fullscreen);
    footer.append(actionsRow, controls);
    this.#panel.append(this.creative, header, footer);
    this.root.append(style, this.#panel);
    this.host.addEventListener('keydown', this.#onKeyDown);
    this.host.addEventListener('click', (event) => event.stopPropagation());
    doc.addEventListener('fullscreenchange', this.#render, { signal: this.#listeners.signal });
    doc.addEventListener('webkitfullscreenchange', this.#render, { signal: this.#listeners.signal });
    container.append(this.host);
    this.#hideContent();
    this.#observer = new MutationObserver(() => this.#hideContent());
    this.#observer.observe(container, { childList: true });
    this.#stopLocale = observeAdsLocale(container, this.#render);

    if (this.#previousFocus) this.play.focus({ preventScroll: true });
  }

  show(ad: PlaybackAd, index: number, count: number): HTMLVideoElement | HTMLImageElement {
    const focused = this.root.activeElement;

    this.#ad = ad;
    this.#index = index;
    this.#count = count;
    this.#state = null;
    this.#fullscreenError = false;
    this.link.hidden = true;
    this.link.removeAttribute('href');
    this.skip.disabled = true;
    this.skip.hidden = ad.skipAfterSeconds === null;

    if (focused === this.link || focused === this.skip) this.play.focus({ preventScroll: true });

    const element = this.#container.ownerDocument.createElement(ad.kind === 'video' ? 'video' : 'img');

    element.setAttribute('part', 'media');

    if (element instanceof HTMLVideoElement) {
      element.playsInline = true;
      element.preload = 'auto';
      element.disablePictureInPicture = true;
      element.disableRemotePlayback = true;
    }

    this.creative.replaceChildren(element);
    return element;
  }

  update(state: AdsOverlayState): void {
    this.#state = state;
    this.#render();
  }

  updateUI(ui: AdsUIOptions): void {
    this.#ui = ui;
    this.#render();
  }

  #render = (): void => {
    const ad = this.#ad;
    const state = this.#state;
    if (this.#destroyed || !ad || !state) return;

    const locale = resolveAdsLocale(this.#container, this.#ui.locale);
    const labels = resolveAdsLabels(locale, this.#ui.labels);
    const sequence = formatAdLabel(labels.sequence, { index: this.#index + 1, count: this.#count });
    const phase = this.#fullscreenError ? labels.fullscreenError : state.phase === 'playing' ? '' : labels[state.phase];

    this.host.lang = locale;
    this.host.dataset.adState = state.phase;
    this.#panel.setAttribute('aria-label', labels.advertisement);
    // This live region changes only for a state/pod/label change, never for clock ticks.
    setText(this.status, phase ? `${sequence} — ${phase}` : sequence);
    label(this.play, labels.playPause);
    this.play.setAttribute('aria-pressed', String(!state.paused));
    icon(this.play, state.paused ? 'play' : 'pause', state.paused ? playIcon : pauseIcon);
    label(this.mute, labels.mute);
    this.mute.setAttribute('aria-pressed', String(state.muted));
    icon(
      this.mute,
      state.muted || state.volume === 0 ? 'muted' : 'volume',
      state.muted || state.volume === 0 ? volumeOffIcon : volumeHighIcon
    );
    label(this.volume, labels.volume);
    this.volume.value = String(state.volume);
    this.volume.setAttribute('aria-valuetext', `${Math.round(state.volume * 100)}%`);
    const remaining = state.duration === null ? null : Math.ceil(Math.max(0, state.duration - state.elapsed));

    setText(
      this.timer,
      formatAdLabel(labels.timer, {
        elapsed: formatAdTime(state.elapsed),
        duration: formatAdTime(state.duration),
        remaining: formatAdTime(remaining),
      })
    );
    this.skip.disabled = !state.started || ad.skipAfterSeconds === null || state.elapsed < ad.skipAfterSeconds;
    setText(
      this.skip,
      ad.skipAfterSeconds !== null && state.elapsed < ad.skipAfterSeconds
        ? formatAdLabel(labels.skipCountdown, { seconds: Math.ceil(ad.skipAfterSeconds - state.elapsed) })
        : labels.skip
    );
    this.link.hidden = !state.started || !ad.clickUrl;
    setText(this.link, labels.advertiser);
    label(this.link, `${labels.advertiser} — ${labels.newWindow}`);

    if (state.started && ad.clickUrl) this.link.href = ad.clickUrl;

    const media = this.creative.firstElementChild;
    const alt = this.#ui.labels?.mediaAlt || ad.alt || labels.mediaAlt;

    if (media instanceof HTMLImageElement) media.alt = alt;
    else media?.setAttribute('aria-label', alt);

    const fullscreen = this.#isFullscreen();

    this.fullscreen.hidden = !this.#fullscreenAvailable();
    label(this.fullscreen, fullscreen ? labels.exitFullscreen : labels.enterFullscreen);
    icon(this.fullscreen, fullscreen ? 'exit' : 'enter', fullscreen ? fullscreenExitIcon : fullscreenEnterIcon);

    if (this.fullscreen.hidden && this.root.activeElement === this.fullscreen) this.play.focus({ preventScroll: true });
  };

  #button(part: string, click: () => void): HTMLButtonElement {
    const button = this.#container.ownerDocument.createElement('button');

    button.type = 'button';
    button.setAttribute('part', part);
    button.addEventListener('click', click);
    return button;
  }

  #fullscreenAvailable(): boolean {
    const doc: WebKitDocument = this.#container.ownerDocument;
    const container: WebKitFullscreenElement = this.#container;

    return !!(
      (doc.fullscreenEnabled && isFunction(container.requestFullscreen)) ||
      (doc.webkitFullscreenEnabled && isFunction(container.webkitRequestFullscreen))
    );
  }

  #isFullscreen(): boolean {
    const doc: WebKitDocument = this.#container.ownerDocument;
    let element = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    while (element?.shadowRoot?.fullscreenElement) element = element.shadowRoot.fullscreenElement;

    return !!element && containsComposed(element, this.#container);
  }

  async #setFullscreen(active: boolean): Promise<void> {
    if (active ? !this.#fullscreenAvailable() : !this.#isFullscreen()) return;

    const doc: WebKitDocument = this.#container.ownerDocument;
    const container: WebKitFullscreenElement = this.#container;

    this.#fullscreenError = false;

    try {
      if (!active) {
        if (isFunction(doc.exitFullscreen)) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else if (isFunction(container.requestFullscreen)) await container.requestFullscreen();
      else await container.webkitRequestFullscreen?.();
    } catch {
      this.#fullscreenError = true;
    }

    if (!this.#destroyed) this.#render();
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();

    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    const key = event.key.toLowerCase();

    if (key === 'escape' && this.#isFullscreen()) {
      event.preventDefault();

      if (!event.repeat) void this.#setFullscreen(false);

      return;
    }

    const target = event.composedPath()[0];
    // Preserve native range Arrow/Home/End/Space handling, while preventing player hotkeys from seeing it.
    if (target instanceof HTMLInputElement || (target instanceof HTMLElement && target.isContentEditable)) return;

    const interactive = target instanceof Element && !!target.closest('button,a');

    if (key === 'k' || (key === ' ' && !interactive)) {
      event.preventDefault();

      if (!event.repeat) this.#actions.playPause();
    } else if (key === 'm') {
      event.preventDefault();

      if (!event.repeat) this.#actions.mute();
    } else if (key === 'f' && this.#fullscreenAvailable()) {
      event.preventDefault();

      if (!event.repeat) void this.#setFullscreen(!this.#isFullscreen());
    } else if (key === 'arrowup' || key === 'arrowdown') {
      event.preventDefault();
      this.#actions.volume(Math.max(0, Math.min(1, (this.#state?.volume ?? 1) + (key === 'arrowup' ? 0.05 : -0.05))));
    } else if (['arrowleft', 'arrowright', 'home', 'end', 'j', 'l'].includes(key) || /^\d$/.test(key))
      event.preventDefault();
  };

  destroy(): void {
    if (this.#destroyed) return;

    this.#destroyed = true;
    this.#observer.disconnect();
    this.#stopLocale();
    this.#listeners.abort();
    const restoreFocus = !!this.root.activeElement;

    this.host.remove();

    for (const [element, inert] of this.#inert) element.inert = inert;

    if (this.#container.style.position === 'relative') this.#container.style.position = this.#position;

    if (restoreFocus) {
      if (this.#previousFocus?.isConnected && !this.#previousFocus.inert)
        this.#previousFocus.focus({ preventScroll: true });
      else if (this.#container.isConnected) {
        const tabIndex = this.#container.getAttribute('tabindex');

        this.#container.tabIndex = -1;
        this.#container.focus({ preventScroll: true });

        if (tabIndex === null) this.#container.removeAttribute('tabindex');
        else this.#container.setAttribute('tabindex', tabIndex);
      }
    }
  }

  #hideContent(): void {
    for (const child of this.#container.children) {
      if (!(child instanceof HTMLElement) || child === this.host || this.#inert.has(child)) continue;

      this.#inert.set(child, child.inert);
      child.inert = true;
    }
  }
}
