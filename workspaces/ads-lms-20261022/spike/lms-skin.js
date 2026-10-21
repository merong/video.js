// TASK L-1-SPIKE: a template copy of <solad-video-skin> with the lecture changes, made without touching packages.
// Load after /player/solad-video-skin.js. Attributes are read once, on the first connect (like the Solad skin).
//
//   lms-rate-keys="off"   removes the upstream `>`/`<` hotkeys (their speedUp/speedDown wrap to the first rate)
//   lms-indicator="off"   removes <media-seek-indicator>
//   lms-max-rate="1.5"    hides rate items above it (CSS on `data-rate`, set by the radio group)
//   lms-rate-hide="attr"  also sets `hidden` on those items so menu arrow keys skip them
//   lms-layers="off"      leaves the time slider untouched (for the A/B check)

const SoladSkin = customElements.get('solad-video-skin');
if (!SoladSkin) throw new Error('[lms-spike] Load /player/solad-video-skin.js first.');

const RATES = [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2];

const LAYER_CSS = `
.lms-slider-layers {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: var(--media-spacing);
  translate: 0 -50%;
  pointer-events: none;
  z-index: 0;
}
.lms-watched-part {
  position: absolute;
  inset-block: 0;
  left: var(--lms-start);
  right: calc(100% - var(--lms-end));
  background: color-mix(in oklab, #3fb950 55%, transparent);
  border-radius: var(--media-control-radius);
}
.lms-limit {
  position: absolute;
  inset-block: -3px;
  left: var(--lms-limit, 100%);
  width: 2px;
  translate: -1px 0;
  background: #f85149;
  display: none;
}
.lms-slider-layers[data-limit] .lms-limit { display: block; }
`;

function rateCss(max) {
  const hidden = RATES.filter((rate) => rate > max + 1e-6).map((rate) => `media-menu-radio-item[data-rate="${rate}"]`);

  return hidden.length ? `${hidden.join(',\n')} { display: none !important; }` : '';
}

export class LmsSpikeSkinElement extends SoladSkin {
  static tagName = 'spike-lms-skin';

  #lmsConfigured = false;

  connectedCallback() {
    if (!this.#lmsConfigured) {
      const root = this.shadowRoot;
      const style = document.createElement('style');
      const max = Number(this.getAttribute('lms-max-rate'));
      let css = '';

      this.#lmsConfigured = true;

      if (this.getAttribute('lms-rate-keys') === 'off') {
        for (const hotkey of root.querySelectorAll('media-hotkey[action="speedUp"], media-hotkey[action="speedDown"]'))
          hotkey.remove();
      }

      if (this.getAttribute('lms-indicator') === 'off') root.querySelector('media-seek-indicator')?.remove();

      if (this.getAttribute('lms-layers') !== 'off') {
        const slider = root.querySelector('media-time-slider');
        const layers = document.createElement('div');

        layers.className = 'lms-slider-layers';
        layers.setAttribute('aria-hidden', 'true');
        layers.innerHTML = '<div class="lms-watched"></div><span class="lms-limit"></span>';
        // Before the chapters so the fill and the buffer paint over the watched layer.
        slider?.prepend(layers);
        css += LAYER_CSS;
      }

      if (max > 0) css += rateCss(max);

      // `lms-rate-hide="attr"`: also mark the items `hidden`, which menu navigation skips (core menu.ts isItemHidden).
      // The radio group rebuilds its items when the locale changes, so the observer marks every new set.
      const group = root.querySelector('media-playback-rate-radio-group');

      if (max > 0 && group && this.getAttribute('lms-rate-hide') === 'attr') {
        const mark = () => {
          for (const item of group.querySelectorAll('media-menu-radio-item[data-rate]'))
            if (Number(item.getAttribute('data-rate')) > max + 1e-6 && !item.hidden) item.hidden = true;
        };

        new MutationObserver(mark).observe(group, { childList: true });
        mark();
      }

      style.id = 'lms-spike-style';
      style.textContent = css;
      root.append(style);
    }

    super.connectedCallback();
  }
}

if (!customElements.get(LmsSpikeSkinElement.tagName))
  customElements.define(LmsSpikeSkinElement.tagName, LmsSpikeSkinElement);
