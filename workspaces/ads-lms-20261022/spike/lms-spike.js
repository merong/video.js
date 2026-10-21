// TASK L-1-SPIKE: a hand-written ES module (no build step) that plugs lecture rules into a CDN Video.js player.
//
// @internal Video.js API in use, all in this file: the extension context `Symbol.for('@videojs/extension')`
// (packages/html/src/player/context.ts:75-90) and `PlayerExtension.mediaOverride`
// (packages/core/src/dom/extensions/extension.ts, media.ts:31-69). Both are internal and may change upstream.

const EXTENSION_CONTEXT = Symbol.for('@videojs/extension');
const RATES = [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2];
const BLOCK_NOTE_MS = 2000;

/**
 * Ask the `<video-player>` around `from` for its extension registrar. This is the @lit/context request protocol
 * (`context-request`, bubbling and composed) that `<media-ads>` sends through `ContextConsumer`; the provider answers
 * synchronously when the context matches.
 */
export function requestRegistrar(from) {
  let value = null;
  const event = new Event('context-request', { bubbles: true, composed: true });

  Object.assign(event, {
    context: EXTENSION_CONTEXT,
    contextTarget: from,
    subscribe: false,
    callback: (provided) => {
      value = provided;
    },
  });
  from.dispatchEvent(event);
  return value;
}

/** One instance per player; the coordinator keeps one extension per class. */
class LmsExtension {
  #lms;

  constructor(lms) {
    this.#lms = lms;
  }

  attach(target) {
    this.#lms.attachMedia(target.media);
  }

  detach() {
    this.#lms.attachMedia(null);
  }

  // Read on every media access (createMediaFacade), so returning null hands the member back to the next source.
  get mediaOverride() {
    return this.#lms.override();
  }
}

export class LmsSpike {
  constructor({ container, slider, maxRate = 2, seekLimit = 'watched', yieldToAds = true, log = () => {} }) {
    this.container = container;
    this.slider = slider;
    this.maxRate = maxRate;
    this.seekLimit = seekLimit;
    this.yieldToAds = yieldToAds;
    this.log = log;
    this.maxWatched = 0;
    this.segments = [];
    this.completed = false;
    this.media = null;
    this.counts = { setter: 0, clamped: 0, safetyNet: 0, rateReverted: 0, blockedNotes: 0 };
    this.#override = this.#makeOverride();
  }

  #override;
  #listeners = null;
  #last = 0;
  #reverting = false;
  #lastNote = 0;
  #release = null;

  /** Register through the context request sent from `from` (any element inside the `<video-player>`). */
  register(from) {
    const registrar = requestRegistrar(from);
    if (!registrar) return false;

    this.#release = registrar.registerExtension(new LmsExtension(this));
    return true;
  }

  release() {
    this.#release?.();
    this.#release = null;
  }

  get allowed() {
    return this.maxWatched + 1;
  }

  get limiting() {
    return this.seekLimit === 'watched' && !this.completed;
  }

  adsActive() {
    return Boolean(this.container?.querySelector(':scope > [data-ads-overlay]'));
  }

  override() {
    if (!this.media || !this.limiting) return null;
    if (this.yieldToAds && this.adsActive()) return null;

    return this.#override;
  }

  #makeOverride() {
    // eslint-disable-next-line typescript/no-this-alias -- accessor `this` is the override object.
    const lms = this;

    return {
      get currentTime() {
        return lms.media.currentTime;
      },
      set currentTime(value) {
        lms.counts.setter++;
        // Clamp and still write: a no-op leaves `time.seek()` waiting for a `seeked` that never comes (time.ts:36-39).
        lms.media.currentTime = lms.clamp(value);
      },
    };
  }

  clamp(value) {
    if (!this.limiting || !(value > this.allowed)) return value;

    this.counts.clamped++;
    this.#blocked(value);
    return this.allowed;
  }

  #blocked(requested) {
    const now = performance.now();

    if (now - this.#lastNote < BLOCK_NOTE_MS) return;

    this.#lastNote = now;
    this.counts.blockedNotes++;
    this.log('seek-blocked', { requested: round(requested), allowed: round(this.allowed) });
    this.container?.dispatchEvent(
      new CustomEvent('solad-lms-seek-blocked', {
        bubbles: true,
        composed: true,
        detail: { requested, allowed: this.allowed },
      })
    );
  }

  /** For the spike only: pretend the learner has played up to `seconds`. */
  setWatched(seconds) {
    this.maxWatched = seconds;
    this.segments = seconds > 0 ? [[0, seconds]] : [];
    this.paint();
  }

  attachMedia(media) {
    this.#listeners?.abort();
    this.#listeners = null;
    this.media = media;
    if (!media) return;

    const listeners = new AbortController();
    const on = (type, handler) => media.addEventListener(type, handler, { signal: listeners.signal });

    this.#listeners = listeners;
    this.#last = media.currentTime;

    on('timeupdate', () => this.#onTime());
    on('seeking', () => this.#onSeeking());
    on('seeked', () => {
      this.#reverting = false;
      this.#last = media.currentTime;
      this.log('seeked', { time: round(media.currentTime) });
    });
    on('ratechange', () => this.#onRate());
    on('durationchange', () => this.paint());
    this.log('attached', { tag: media.localName });
  }

  #onTime() {
    const media = this.media;
    const time = media.currentTime;
    const step = time - this.#last;

    if (!media.seeking && !media.paused && !this.adsActive() && step > 0 && step <= 1.5 * media.playbackRate + 0.1) {
      this.#add(this.#last, time);
      if (time > this.maxWatched) this.maxWatched = time;
      this.paint();
    }

    this.#last = time;
  }

  // Safety net for seeks that skip the facade (OS media keys, the PiP window, direct writes to the real media).
  #onSeeking() {
    const media = this.media;

    if (!this.limiting || this.adsActive() || this.#reverting) return;
    if (!(media.currentTime > this.allowed + 0.5)) return;

    this.#reverting = true;
    this.counts.safetyNet++;
    this.#blocked(media.currentTime);
    media.currentTime = this.allowed;
  }

  #onRate() {
    const media = this.media;

    if (media.playbackRate > this.maxRate + 1e-6) {
      this.counts.rateReverted++;
      this.log('rate-reverted', { from: media.playbackRate, to: this.maxRate });
      media.playbackRate = this.maxRate;
    }
  }

  #add(start, end) {
    const merged = [];

    for (const segment of [...this.segments, [start, end]].sort((a, b) => a[0] - b[0])) {
      const previous = merged.at(-1);

      if (previous && segment[0] <= previous[1] + 0.5) previous[1] = Math.max(previous[1], segment[1]);
      else merged.push([...segment]);
    }

    this.segments = merged;
  }

  /** The watched layer and the limit marker in the slider (template copy, lms-skin.js), placed by CSS variables. */
  paint() {
    const layers = this.slider?.querySelector('.lms-slider-layers');
    const duration = this.media?.duration;
    if (!layers || !(duration > 0)) return;

    const percent = (seconds) => `${Math.min(100, (seconds / duration) * 100).toFixed(3)}%`;
    const watched = layers.querySelector('.lms-watched');

    watched.replaceChildren(
      ...this.segments.map(([start, end]) => {
        const part = layers.ownerDocument.createElement('span');

        part.className = 'lms-watched-part';
        part.style.setProperty('--lms-start', percent(start));
        part.style.setProperty('--lms-end', percent(end));
        return part;
      })
    );
    layers.style.setProperty('--lms-limit', percent(Math.min(this.allowed, duration)));
    layers.toggleAttribute('data-limit', this.limiting);
  }

  /**
   * `>`/`<` without the upstream wrap (media-actions.ts:88-108) and with the rate cap; `b` for a bookmark. Bound on
   * the same element as the hotkey coordinator (the media container) after the template copy removed the upstream
   * speed bindings.
   */
  bindKeys() {
    const target = this.container;

    target.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditable(event)) return;

      const rates = RATES.filter((rate) => rate <= this.maxRate + 1e-6);
      const index = rates.findIndex((rate) => Math.abs(rate - this.media.playbackRate) < 1e-6);

      if (event.key === '>' || event.key === '<') {
        const next = event.key === '>' ? Math.min(rates.length - 1, index + 1) : Math.max(0, index - 1);

        event.preventDefault();
        if (index >= 0 && next !== index) this.media.playbackRate = rates[next];
        this.log('rate-key', { key: event.key, rate: this.media.playbackRate });
      } else if (event.key === 'b') {
        event.preventDefault();
        this.log('bookmark', { time: round(this.media.currentTime) });
      }
    });
  }
}

function isEditable(event) {
  const element = event.composedPath()[0];

  return element instanceof HTMLElement && (element.isContentEditable || /^(input|textarea|select)$/i.test(element.localName));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/** WebVTT text for `[{start, title}]` chapters ending at `duration`. */
export function chaptersVtt(chapters, duration) {
  const stamp = (seconds) => new Date(seconds * 1000).toISOString().slice(11, 23);
  const cues = chapters.map(({ start, title }, index) => {
    const end = chapters[index + 1]?.start ?? duration;

    return `${index + 1}\n${stamp(start)} --> ${stamp(end)}\n${title}`;
  });

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

/** A `<track kind="chapters" default>` whose source is a blob URL or a data URL. */
export function chaptersTrack(vtt, as) {
  const track = document.createElement('track');

  track.kind = 'chapters';
  track.label = 'chapters';
  track.default = true;
  track.src =
    as === 'data'
      ? `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`
      : URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  return track;
}
