import { vi } from 'vite-plus/test';

/** Jsdom has no media decoder; content commands emit their native lifecycle, ad observations remain test inputs. */
export function contentMedia(container: HTMLElement): HTMLVideoElement {
  const video = document.createElement('video');
  let paused = true;

  Object.defineProperties(video, {
    duration: { configurable: true, value: 100 },
    paused: { configurable: true, get: () => paused },
    play: {
      configurable: true,
      value: vi.fn(async () => {
        if (!paused) return;

        paused = false;
        video.dispatchEvent(new Event('play'));
      }),
    },
    pause: {
      configurable: true,
      value: vi.fn(() => {
        if (paused) return;

        paused = true;
        video.dispatchEvent(new Event('pause'));
      }),
    },
  });
  container.append(video);
  return video;
}

export function mediaState(
  media: HTMLMediaElement,
  fields: {
    duration?: number;
    currentTime?: number;
    seeking?: boolean;
    ended?: boolean;
    readyState?: number;
    paused?: boolean;
  }
): void {
  for (const [key, value] of Object.entries(fields))
    Object.defineProperty(media, key, { configurable: true, writable: true, value });
}

export function overlayRoot(container: HTMLElement): ShadowRoot {
  const root = container.querySelector('[data-ads-overlay]')?.shadowRoot;
  if (!root) throw new Error('Expected an active ad overlay.');

  return root;
}

export function button(root: ShadowRoot, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll('button')].find(
    (element) => (element.getAttribute('aria-label') ?? element.textContent) === label
  );
  if (!button) throw new Error(`Missing button: ${label}`);

  return button;
}
