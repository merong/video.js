// Read-only browser observations for this local UX review.
export async function installProbe(page) {
  await page.evaluate(() => {
    window.readAdUX = () => {
      const all = (root) => [...root.querySelectorAll('*')].flatMap((element) => [element, ...(element.shadowRoot ? all(element.shadowRoot) : [])]);
      const nodes = all(document);
      const host = nodes.find((element) => element.hasAttribute('data-ads-overlay'));
      const root = host?.shadowRoot;
      const video = root?.querySelector('video');
      let focus = document.activeElement;
      while (focus?.shadowRoot?.activeElement) focus = focus.shadowRoot.activeElement;
      return {
        phase: host?.dataset.adState,
        status: root?.querySelector('[role=status]')?.textContent,
        timer: root?.querySelector('[part=timer]')?.textContent,
        adTime: video?.currentTime,
        adPaused: video?.paused,
        skipDisabled: root?.querySelector('[part=skip]')?.disabled,
        skipHidden: root?.querySelector('[part=skip]')?.hidden,
        skipText: root?.querySelector('[part=skip]')?.textContent,
        imageAlt: root?.querySelector('img')?.alt,
        contentButton: nodes.find((element) => element.tagName === 'MEDIA-PLAY-BUTTON')?.getAttribute('aria-label'),
        focus: { tag: focus?.tagName, part: focus?.getAttribute('part'), label: focus?.getAttribute('aria-label') },
        fullscreen: document.fullscreenElement?.tagName,
        fixture: window.uxReview?.snapshot(),
        resources: performance.getEntriesByType('resource').map((entry) => entry.name),
      };
    };
  });
}
