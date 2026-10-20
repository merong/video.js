import { describe, expect, it } from 'vitest';

import schedule from '../../contract/playback-v1.json';
import { observePlayback } from '../../public/assets/admin/preview.js';

// Media and ads events are inputs to this UI observer, not evidence of actual playback.
function setup() {
  const media = document.createElement('video');
  const container = document.createElement('div');
  const changes: any[] = [];
  const observer = observePlayback({ media, container, schedule, onChange: (state) => changes.push(state) });
  const emit = (type, itemId = 'pre-image', breakId = 'pre-1', extra = {}) =>
    observer.onEvent({ type, itemId, breakId, adId: 'creative-image', ...extra });

  return { media, container, observer, emit, changes, latest: () => changes.at(-1) };
}

describe('observePlayback', () => {
  it('distinguishes readiness, ordered ad observations and actual content return', () => {
    const view = setup();

    expect(view.latest()).toMatchObject({ phase: 'loading', history: [] });
    view.media.dispatchEvent(new Event('canplay'));
    expect(view.latest()).toMatchObject({ phase: 'ready', history: [] });
    view.emit('start');
    expect(view.latest().message).toContain('광고 1/2 진행 중');
    view.media.dispatchEvent(new Event('playing'));
    expect(view.latest().phase).toBe('ad');
    view.emit('skip');
    expect(view.latest().phase).toBe('transition');
    view.emit('start', 'pre-video');
    expect(view.latest().message).toContain('광고 2/2 진행 중');
    view.emit('complete', 'pre-video');
    expect(view.latest().history).not.toContain('본편 복귀');
    view.media.dispatchEvent(new Event('playing'));
    expect(view.latest()).toMatchObject({
      phase: 'content',
      history: [
        '프리롤 · 광고 1/2 · 시작',
        '프리롤 · 광고 1/2 · 건너뜀',
        '프리롤 · 광고 2/2 · 시작',
        '프리롤 · 광고 2/2 · 완료',
        '본편 복귀',
      ],
    });
    view.observer.destroy();
  });

  it('keeps an ad failure visible after subsequent content playback without recording completion', () => {
    const view = setup();

    view.emit('start');
    view.emit('error', 'pre-image', 'pre-1', { code: 'creative_load_failed' });
    expect(view.latest()).toMatchObject({ phase: 'error', notice: '광고 소재를 불러오지 못했습니다.' });
    view.media.dispatchEvent(new Event('playing'));
    expect(view.latest()).toMatchObject({ phase: 'content', notice: '광고 소재를 불러오지 못했습니다.' });
    expect(view.latest().history.some((line) => line.includes('완료'))).toBe(false);
    view.observer.destroy();
  });

  it('does not call the whole playback complete when content ends ahead of postroll', () => {
    const view = setup();
    const post = schedule.breaks.find((br) => br.position === 'post')!;
    const last = post.ads.at(-1)!;

    view.media.dispatchEvent(new Event('ended'));
    expect(view.latest().message).toContain('후속 광고');
    view.emit('start', last.itemId, post.breakId);
    expect(view.latest().phase).toBe('ad');
    view.emit('complete', last.itemId, post.breakId);
    expect(view.latest().message).toContain('재생이 끝났습니다');
    view.observer.destroy();
  });

  it('consumes HTML ads events and local diagnostics, then ignores all events after disposal', () => {
    const view = setup();

    view.container.dispatchEvent(
      new CustomEvent('ads-event', { detail: { type: 'start', adId: 'a', itemId: 'pre-image', breakId: 'pre-1' } })
    );
    expect(view.latest().phase).toBe('ad');
    view.container.dispatchEvent(new CustomEvent('ads-error', { detail: { code: 'content_play_rejected' } }));
    expect(view.latest().notice).toContain('재생 버튼을 다시');
    view.observer.destroy();
    const count = view.changes.length;

    view.emit('complete');
    view.container.dispatchEvent(new CustomEvent('ads-error', { detail: { code: 'invalid_schedule' } }));
    view.media.dispatchEvent(new Event('playing'));
    expect(view.changes).toHaveLength(count);
  });

  it('finishes HTML postroll observations without a schedule or a further content playing event', () => {
    const media = document.createElement('video');
    const container = document.createElement('div');
    const changes: any[] = [];
    const observer = observePlayback({ media, container, onChange: (state) => changes.push(state) });
    const emit = (type, adId) => container.dispatchEvent(new CustomEvent('ads-event', { detail: { type, adId } }));

    Object.defineProperty(media, 'ended', { value: true });
    media.dispatchEvent(new Event('ended'));
    emit('start', 'post-1');
    emit('complete', 'post-1');
    expect(changes.at(-1)).toMatchObject({ phase: 'ended' });
    expect(changes.at(-1).message).toContain('본편은 종료');
    emit('start', 'post-2');
    expect(changes.at(-1)).toMatchObject({ phase: 'ad' });
    emit('skip', 'post-2');
    expect(changes.at(-1)).toMatchObject({ phase: 'ended' });
    expect(changes.at(-1).message).toContain('건너뜀');
    expect(changes.at(-1).history).not.toContain('본편 복귀');
    observer.destroy();
  });
});
