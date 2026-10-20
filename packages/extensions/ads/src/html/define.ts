import { MediaAdsElement } from './element';

export { MediaAdsElement };

// Duplicate bundles keep the first registered version; they do not replace a live element implementation.
if (globalThis.customElements && !customElements.get(MediaAdsElement.tagName))
  customElements.define(MediaAdsElement.tagName, MediaAdsElement);

declare global {
  interface HTMLElementTagNameMap {
    'media-ads': MediaAdsElement;
  }
}
