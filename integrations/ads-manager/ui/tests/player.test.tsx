// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { PlayerTestLinks } from '../src/player';

afterEach(cleanup);

describe('PlayerTestLinks', () => {
  it('opens the playback test page for each player in a new tab with video and content', () => {
    render(<PlayerTestLinks examplesUrl="/examples" videoId=" video-1 " contentUrl="/demo-media/content.mp4" />);

    const content = new URL('/demo-media/content.mp4', document.baseURI).href;
    const [player, videojs] = screen.getAllByRole('link');
    const native = new URL(player!.getAttribute('href')!);
    const vjs = new URL(videojs!.getAttribute('href')!);

    expect(native.pathname).toBe('/examples/play-test.html');
    expect(Object.fromEntries(native.searchParams)).toEqual({ video: 'video-1', type: 'native', content });
    expect(vjs.pathname).toBe('/examples/play-test.html');
    expect(Object.fromEntries(vjs.searchParams)).toEqual({ video: 'video-1', type: 'videojs', media: 'mp4', content });

    for (const link of [player!, videojs!]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }

    expect(screen.getByText(/게시한 편성을 실제 수집 경로로 재생해요/)).toBeTruthy();
  });

  it.each([
    ['p-abc123def4', { video: 'video-1', preset: 'p-abc123def4' }],
    ['default', { video: 'video-1' }],
    [null, { video: 'video-1' }],
  ])('passes presetId %j to both links except the built-in default', (presetId, query) => {
    render(<PlayerTestLinks examplesUrl="/examples/" videoId="video-1" presetId={presetId} />);

    const [player, videojs] = screen.getAllByRole('link').map((link) => new URL(link.getAttribute('href')!));

    expect(Object.fromEntries(player!.searchParams)).toEqual({ ...query, type: 'native' });
    expect(Object.fromEntries(videojs!.searchParams)).toEqual({ ...query, type: 'videojs', media: 'mp4' });
  });

  it.each([
    [
      'videojs',
      { video: 'video-1', type: 'native' },
      { video: 'video-1', type: 'videojs', media: 'mp4', preset: 'p-abc123def4' },
      '기본 video',
    ],
    [
      'native',
      { video: 'video-1', type: 'native', preset: 'p-abc123def4' },
      { video: 'video-1', type: 'videojs', media: 'mp4' },
      'Video.js',
    ],
  ] as const)('passes a %s preset only to its own player link', (presetPlayerType, native, videojs, other) => {
    render(
      <PlayerTestLinks
        examplesUrl="/examples/"
        videoId="video-1"
        presetId="p-abc123def4"
        presetPlayerType={presetPlayerType}
      />
    );

    const [player, vjs] = screen.getAllByRole('link');
    const note = document.querySelector('.ads-test-links-other');
    const plain = presetPlayerType === 'videojs' ? player! : vjs!;
    const matched = presetPlayerType === 'videojs' ? vjs! : player!;

    expect(Object.fromEntries(new URL(player!.getAttribute('href')!).searchParams)).toEqual(native);
    expect(Object.fromEntries(new URL(vjs!.getAttribute('href')!).searchParams)).toEqual(videojs);
    expect(note?.textContent).toBe(
      `${other}는 이 프리셋과 다른 플레이어라 프리셋 없이 열어요. 설치한 페이지처럼 사이트 적용 프리셋으로 재생하고, 그것도 다른 플레이어용이면 기본값으로 재생해요.`
    );
    expect(plain.getAttribute('aria-describedby')).toBe(note?.id);
    expect(matched.hasAttribute('aria-describedby')).toBe(false);
  });

  it.each(['default', null])('adds no player note without a saved preset (%j)', (presetId) => {
    render(
      <PlayerTestLinks examplesUrl="/examples/" videoId="video-1" presetId={presetId} presetPlayerType="native" />
    );

    expect(document.querySelector('.ads-test-links-other')).toBeNull();
    expect(screen.getAllByRole('link').every((link) => !link.hasAttribute('aria-describedby'))).toBe(true);
  });

  it('omits content when none is given', () => {
    render(<PlayerTestLinks examplesUrl="/examples/" videoId="board:1:main" />);

    const href = new URL(screen.getAllByRole('link')[0]!.getAttribute('href')!);

    expect(Object.fromEntries(href.searchParams)).toEqual({ video: 'board:1:main', type: 'native' });
  });

  it('resolves a relative content address against the admin page, not the test page', () => {
    render(
      <PlayerTestLinks
        examplesUrl="/examples/"
        videoId="video-1"
        contentUrl="demo-media/grok-20261018/content-scene-01.mp4"
      />
    );

    const content = new URL('demo-media/grok-20261018/content-scene-01.mp4', document.baseURI);

    for (const link of screen.getAllByRole('link')) {
      const value = new URL(link.getAttribute('href')!).searchParams.get('content')!;

      expect(value).toBe(content.href);
      expect(new URL(value).pathname).not.toContain('/examples/');
    }
  });

  it.each([
    'ftp://media.example/content.mp4',
    'javascript:alert(1)',
    'data:video/mp4;base64,AA',
    '//cdn.example/a.mp4',
  ])('makes no links for the non-HTTP(S) content %s', (contentUrl) => {
    render(<PlayerTestLinks examplesUrl="/examples/" videoId="video-1" contentUrl={contentUrl} />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(document.querySelector('.ads-test-links-reason')?.textContent).toBe(
      '본편 주소는 HTTP(S) 주소나 관리자 페이지 기준 경로로 입력해 주세요.'
    );
  });

  it('explains why links are unavailable', () => {
    render(<PlayerTestLinks examplesUrl="/examples/" videoId="" contentUrl="/content.mp4" />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(document.querySelector('.ads-test-links-reason')?.textContent).toBe('고정 영상 ID를 먼저 입력해 주세요.');
  });
});
