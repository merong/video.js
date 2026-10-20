import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PreviewSession } from '../../public/assets/admin/preview.js';
import { calls } from './fixtures/player.js';

const options = () => ({
  playerModuleUrl: '/integrations/ads-manager/tests/admin/fixtures/player.js',
  media: document.createElement('video'),
  container: document.createElement('div'),
  contentUrl: '/content.mp4',
  schedule: { schemaVersion: 1, breaks: [] },
});

beforeEach(() => {
  calls.length = 0;
  // jsdom has no media engine: these tests verify wiring/teardown, never playback.
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

describe('PreviewSession', () => {
  it('imports the configured module with preview-only options and destroys it before replacement', async () => {
    const session = new PreviewSession();
    const input = options();

    expect(await session.start(input)).toBe(true);
    expect(calls[0].options).toMatchObject({
      media: input.media,
      container: input.container,
      schedule: input.schedule,
      preview: true,
    });
    expect(calls[0].options).not.toHaveProperty('tracking');
    expect(input.media.getAttribute('src')).toBe('/content.mp4');
    await session.start({ ...input, contentUrl: '/next.mp4' });
    expect(calls[0].destroyed).toBe(true);
    expect(calls[1].destroyed).toBe(false);
    session.destroy();
    expect(calls[1].destroyed).toBe(true);
    expect(input.media.hasAttribute('src')).toBe(false);
  });

  it('discards an import completion after closing without creating an ad session', async () => {
    const session = new PreviewSession();
    const pending = session.start(options());

    session.destroy();
    expect(await pending).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('forwards local observations without tracking and detaches status updates before controller teardown', async () => {
    const session = new PreviewSession();
    const input = options();
    const onChange = vi.fn();

    await session.start({ ...input, onChange });
    const controller = calls[0];

    controller.options.onEvent({ type: 'start', adId: 'ad-1' });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ad' }));
    input.container.dispatchEvent(new CustomEvent('ads-error', { detail: { code: 'invalid_duration' } }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error' }));
    expect(controller.options.preview).toBe(true);
    expect(controller.options).not.toHaveProperty('tracking');
    session.destroy();
    const count = onChange.mock.calls.length;

    controller.options.onEvent({ type: 'complete', adId: 'ad-1' });
    input.media.dispatchEvent(new Event('error'));
    expect(onChange).toHaveBeenCalledTimes(count);
  });

  it('rejects missing player modules and unsafe content URLs without fabricating readiness', async () => {
    const session = new PreviewSession();

    await expect(session.start({ ...options(), playerModuleUrl: null })).rejects.toThrow('아직 연결되지');
    await expect(session.start({ ...options(), contentUrl: 'javascript:alert(1)' })).rejects.toThrow('본편 영상');
    expect(calls).toHaveLength(0);
  });
});
