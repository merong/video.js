import type { AdsMedia } from './controller';

/** Tracks one native load sequence across schedule fetching and runtime attachment. @internal */
export class AdsSourceLifecycle {
  readonly #media: AdsMedia;
  readonly #source: string;
  #initial: 'pending' | 'emptied' | 'loading' | null;

  constructor(media: AdsMedia, hasPlayed = false) {
    this.#media = media;
    this.#source = media.src || media.currentSrc || '';
    this.#initial = hasPlayed || media.readyState ? null : 'pending';
  }

  matches(): boolean {
    return this.#source === (this.#media.src || this.#media.currentSrc || '');
  }

  acceptInitial(event: Event): boolean {
    if (!this.matches() || this.#initial === null) return false;

    // load() queues emptied before loadstart; both may arrive after binding. A second sequence is a reload.
    if (event.type === 'emptied' && this.#initial === 'pending') {
      this.#initial = 'emptied';
      return true;
    }

    if (event.type === 'loadstart' && this.#initial !== 'loading') {
      this.#initial = 'loading';
      return true;
    }

    return false;
  }

  observeMetadata(event?: Event): void {
    // An initial emptied can report durationchange(NaN); it is not evidence that the load completed.
    if (
      this.#media.readyState ||
      event?.type === 'loadedmetadata' ||
      (event?.type === 'durationchange' && Number.isFinite(this.#media.duration))
    ) {
      this.settle();
    }
  }

  settle(): void {
    this.#initial = null;
  }
}
