import { useId } from 'react';

import { ButtonLink, Note } from '../components';
import type { PlayerType } from './preset';
import { resolveHttpUrl } from './url';

import './player.css';

export interface PlayerTestLinksProps {
  /** Public examples directory, e.g. `/examples/` beside the manager's `api/`. */
  examplesUrl: string;
  /** Fixed video ID used by schedules and stats (`게시판:글번호:영상키` on gnuboard). */
  videoId: string;
  /** Content media address passed to the examples as `content`. Empty uses the examples' default media. */
  contentUrl?: string | null;
  /** Saved preset the test page loads with `?preset=`. The built-in `default` is left out: it is what it uses anyway. */
  presetId?: string | null;
  /**
   * Player the preset is for. Only that link gets `?preset=`; the other one opens without a preset and says so. Like an
   * installed page, it then plays the site-applied preset, or defaults when that one is also for the other player.
   * Without it both links get the preset.
   */
  presetPlayerType?: PlayerType;
}

const playerNames = { videojs: 'Video.js', native: '기본 video' } as const;

/**
 * Build the F5 `examples/play-test.html` address (contract §2). The page resolves `content` against itself, so the
 * content address is passed already absolute, resolved against the admin page.
 */
function testHref(
  examples: URL,
  query: { type: PlayerType; videoId: string; content: URL | null; presetId: string | null }
): string {
  const url = new URL('play-test.html', examples);

  url.searchParams.set('video', query.videoId);
  url.searchParams.set('type', query.type);

  if (query.type === 'videojs') url.searchParams.set('media', 'mp4');

  if (query.content) url.searchParams.set('content', query.content.href);

  if (query.presetId) url.searchParams.set('preset', query.presetId);

  return url.href;
}

/**
 * Open the published schedule in the playback test page. It sends collector requests, so the links say that they are
 * recorded in stats; preview without recording is the player preview (`ThemePreview`).
 */
export function PlayerTestLinks({
  examplesUrl,
  videoId,
  contentUrl,
  presetId,
  presetPlayerType,
}: PlayerTestLinksProps) {
  const otherNote = useId();
  const examples = resolveHttpUrl(examplesUrl, document.baseURI);
  const content = contentUrl ? resolveHttpUrl(contentUrl, document.baseURI) : null;
  const id = videoId.trim();
  const preset = presetId && presetId !== 'default' ? presetId : null;
  let reason = '';

  if (!examples) reason = '재생 테스트 페이지 주소가 없어 링크를 만들 수 없어요. 관리자 설치 경로를 확인해 주세요.';
  else if (!id) reason = '고정 영상 ID를 먼저 입력해 주세요.';
  else if (contentUrl && !content) reason = '본편 주소는 HTTP(S) 주소나 관리자 페이지 기준 경로로 입력해 주세요.';

  if (examples && !examples.pathname.endsWith('/')) examples.pathname += '/';

  // A preset for the other player would be refused by the test page, so that link goes without one and plays like an
  // installed page: the site-applied preset, or defaults when that is also for the other player.
  const presetFor = (type: PlayerType) => (presetPlayerType && presetPlayerType !== type ? null : preset);
  const other = preset && presetPlayerType ? (presetPlayerType === 'videojs' ? 'native' : 'videojs') : null;
  const links =
    examples && !reason
      ? [
          {
            type: 'native' as const,
            label: '기본 video로 재생',
            href: testHref(examples, { type: 'native', videoId: id, content, presetId: presetFor('native') }),
          },
          {
            type: 'videojs' as const,
            label: 'Video.js로 재생',
            href: testHref(examples, { type: 'videojs', videoId: id, content, presetId: presetFor('videojs') }),
          },
        ]
      : [];

  return (
    <div className="ads-test-links">
      <Note tone="warn" title="통계에 기록돼요">
        게시한 편성을 실제 수집 경로로 재생해요. 기록 없이 확인하려면 미리보기를 이용해 주세요.
      </Note>
      {links.length > 0 ? (
        <>
          <div className="sa-row">
            {links.map((link) => (
              <ButtonLink
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby={link.type === other ? otherNote : undefined}
              >
                {link.label}
                <span className="sa-sr"> (새 탭)</span>
              </ButtonLink>
            ))}
          </div>
          {other ? (
            <p id={otherNote} className="sa-help ads-test-links-other">
              {playerNames[other]}는 이 프리셋과 다른 플레이어라 프리셋 없이 열어요. 설치한 페이지처럼 사이트 적용
              프리셋으로 재생하고, 그것도 다른 플레이어용이면 기본값으로 재생해요.
            </p>
          ) : null}
        </>
      ) : (
        <p className="sa-help ads-test-links-reason">{reason}</p>
      )}
    </div>
  );
}
