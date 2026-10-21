import type { HostKind } from '../api/actions';
import { safeUrl, videoIdProblem } from '../api/model';
import type { PresetList } from '../api/presets';
import { DEFAULT_CONTENT_PATH } from '../app/config';
import { playerHref } from '../app/routes';
import { failure, info, Status } from '../app/status';
import {
  Button,
  Card,
  Check,
  CodeBlock,
  Disclosure,
  Field,
  Fieldset,
  Input,
  Note,
  Select,
  StatusMessage,
} from '../components';
import { HelpLink } from '../help';
import { installSnippet, loaderApiExample, loaderSnippet, playerOptions, type SnippetMedia } from '../player';
import { PlannedNote, SETUP_PLANNED } from './planned';
import { ExamplePageLinks, PlayerOptionTable } from './PlayerOptions';

export interface SetupForm {
  /** Old static code only; `null` follows the site-applied preset. */
  presetId: string | null;
  videoId: string;
  contentUrl: string;
  /** Optional `data-poster` and `data-title` of the placeholder. */
  posterUrl: string;
  title: string;
  /** Old static code only. */
  media: SnippetMedia;
}

/** The generator's starting values: the same demo content as the F5 test links, no poster or title. */
export function initialSetupForm(publicBase: string): SetupForm {
  return {
    presetId: null,
    videoId: '',
    contentUrl: absolute(`${publicBase}${DEFAULT_CONTENT_PATH}`),
    posterUrl: '',
    title: '',
    media: 'mp4',
  };
}

export const SNIPPET_STALE_NOTE = '이미 붙여 넣은 코드는 프리셋을 바꿔도 그대로예요. 다시 복사해 주세요.';

const MEDIA: readonly SnippetMedia[] = ['mp4', 'hls-spf', 'hls-hlsjs'];

const MEDIA_LABELS = { mp4: 'MP4', 'hls-spf': 'HLS · SPF', 'hls-hlsjs': 'HLS · hls.js' } satisfies Record<
  SnippetMedia,
  string
>;

const HLS_REASON = 'HLS는 Video.js 플레이어에서만 쓸 수 있어요. Video.js 프리셋을 고르면 선택할 수 있어요.';

const LOADER_DATA = playerOptions.find((group) => group.id === 'loaderData');

function absolute(value: string): string {
  return new URL(value, location.href).href;
}

/**
 * The manager's `public/assets/` as an absolute URL: the directory of the bootstrap `playerModuleUrl`
 * (`…/assets/ads.js`). `null` when the installation has no module URL.
 */
export function assetsUrlFrom(playerModuleUrl: string | null): string | null {
  return safeUrl(playerModuleUrl) ? new URL('./', absolute(playerModuleUrl)).href : null;
}

/** The loader path on this site. The loader works only on the manager's own origin, so the path is enough. */
export function loaderPath(publicBase: string): string {
  return new URL(`${publicBase}player/loader.js`, location.href).pathname;
}

/** Code to show, or, when `problem` is set, the message to show instead. */
interface SnippetResult {
  code: string;
  problem: string;
}

/** Runs a snippet builder; its `RangeError` is the message to show instead of code. */
function snippet(build: () => string): SnippetResult {
  try {
    return { code: build(), problem: '' };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;

    return { code: '', problem: error.message };
  }
}

export interface PlayerSetupProps {
  host: HostKind;
  /** `null` while the preset list loads or failed; `listNotice` says which. */
  list: PresetList | null;
  listNotice: string;
  /** The first list load failed; the generator offers `retryList`. */
  listError: boolean;
  retryList: () => void;
  /** Public web root of the manager, ending in `/`; the loader is `player/loader.js` under it. */
  publicBase: string;
  playerModuleUrl: string | null;
  /** The admin API address from the shell config; made absolute for the snippet. */
  apiUrl: string;
  form: SetupForm;
  change: (patch: Partial<SetupForm>) => void;
}

/** `#/players/setup`: the loader install (schema v2 section 4) first; the old static code stays folded below. */
export function PlayerSetup(props: PlayerSetupProps) {
  const { host, publicBase } = props;
  const loaderUrl = loaderPath(publicBase);

  return (
    <>
      <ExamplePageLinks publicBase={publicBase} />
      <Card title="설치 순서">
        <ol className="aa-steps">
          <li>
            <strong>사이트에 적용할 프리셋 고르기.</strong> <a href={playerHref({ page: 'list' })}>프리셋 목록</a>에서
            "사이트에 적용"을 눌러요. 고르지 않으면 내장 "기본" 프리셋으로 나와요.
          </li>
          <li>
            <strong>영상을 넣을 자리에 코드 붙이기.</strong> 아래 설치 코드를 붙이고 data-video-id, data-src를 영상에
            맞게 바꿔요.{' '}
            {host === 'gnuboard'
              ? '영상 ID는 게시판:글번호:영상키 형식이에요. 영상키는 기본 main이에요. 방문자가 그 글을 읽을 권한이 있어야 광고가 나와요.'
              : '영상 ID가 지면 편성의 영상 ID와 같아야 광고가 붙어요. 영상을 등록하면 게시판·분류 편성도 적용돼요.'}
          </li>
          <li>
            <strong>페이지 새로고침.</strong> 프리셋을 다시 저장해도 코드는 그대로 두면 돼요. 새로고침하면 바뀐 모습이
            나와요. 이 코드로 재생하면 실제 통계에 기록돼요. 기록 없이 확인하려면 지면 편성의 미리보기를 써 주세요.
          </li>
        </ol>
      </Card>
      <LoaderCode {...props} loaderUrl={loaderUrl} />
      {LOADER_DATA ? (
        <Card title="자리 요소 속성 (data-*)">
          <PlayerOptionTable group={LOADER_DATA} publicBase={publicBase} />
          <p className="sa-small">
            테마, 컨트롤, 로고처럼 보이는 모습은 속성으로 바꿀 수 없어요. 프리셋에서 바꿔 주세요.
          </p>
        </Card>
      ) : null}
      <Card title="JS로 직접 만들기 · 개발자용">
        <div className="aa-stack">
          <p className="sa-small">
            페이지를 그린 뒤에 영상을 넣거나, 이벤트를 받아야 할 때 써요. 자리 요소에 data-solad-manual을 붙이면 로더가
            먼저 만들지 않아요.
          </p>
          <CodeBlock label="JS API 예" code={loaderApiExample(loaderUrl)} />
          <ul className="sa-small">
            <li>값이 겹치면 overrides가 data-*를 이기고, data-*가 프리셋을 이겨요.</li>
            <li>overrides에 잘못된 값이 하나라도 있으면 overrides 전체를 쓰지 않고 onError로 알려요.</li>
            <li>같은 요소에 mount를 다시 부르면 먼저 만든 플레이어를 정리하고 새로 만들어요.</li>
          </ul>
        </div>
      </Card>
      <Disclosure summary="예전 정적 코드 보기 · 로더 없이 플레이어를 직접 넣던 방식">
        <div className="aa-stack">
          <Note tone="warn" title="프리셋을 바꿔도 이 코드는 따라 바뀌지 않아요">
            이미 붙인 페이지는 그대로 동작해요. 새로 붙이는 페이지에는 위 설치 코드를 써 주세요.
          </Note>
          <Generator {...props} />
        </div>
      </Disclosure>
      {host === 'gnuboard' ? <PlannedNote features={SETUP_PLANNED} /> : null}
    </>
  );
}

function LoaderCode({ host, form, change, loaderUrl }: PlayerSetupProps & { loaderUrl: string }) {
  const videoId = form.videoId.trim();
  // An empty field is left to `loaderSnippet`, which asks for an ID.
  const videoIdError = form.videoId === '' ? null : videoIdProblem(videoId);
  const { code, problem } = videoIdError
    ? { code: '', problem: '영상 ID를 고치면 설치 코드를 만들어요.' }
    : snippet(() =>
        loaderSnippet({
          host,
          videoId,
          contentUrl: form.contentUrl.trim(),
          posterUrl: form.posterUrl.trim(),
          title: form.title,
          loaderUrl,
        })
      );

  return (
    <Card
      title="설치 코드"
      actions={
        <span className="sa-row">
          <span className="sa-badge">권장</span>
          <HelpLink termId="player-loader" />
        </span>
      }
    >
      <div className="aa-stack">
        <p className="sa-small">
          자리 요소 하나와 로더 한 줄이에요. 테마, 컨트롤, 로고, 언어, 광고는 사이트 적용 프리셋에서 가져와요.{' '}
          <HelpLink termId="player-placeholder" />
        </p>
        <div className="aa-form-grid">
          <Field
            label="영상 ID"
            labelAside={<HelpLink termId="fixed-video-id" />}
            help={
              host === 'gnuboard'
                ? '게시판:글번호:영상키 형식이에요. 예: free:12:main'
                : '편성과 통계에 쓰는 고정 영상 ID예요. 128자 이내예요.'
            }
            error={videoIdError}
          >
            <Input
              maxLength={128}
              value={form.videoId}
              onChange={(event) => change({ videoId: event.currentTarget.value })}
            />
          </Field>
          <Field label="본편 URL" help="기본값은 재생 테스트와 같은 데모 본편이에요. 실제 영상 주소로 바꿔 주세요.">
            <Input
              inputMode="url"
              value={form.contentUrl}
              onChange={(event) => change({ contentUrl: event.currentTarget.value })}
            />
          </Field>
          <Field label="포스터 URL (선택)" help="프리셋의 포스터 표시가 켜져 있을 때 재생 전에 보여요.">
            <Input
              inputMode="url"
              value={form.posterUrl}
              onChange={(event) => change({ posterUrl: event.currentTarget.value })}
            />
          </Field>
          <Field label="제목 (선택)" help="프리셋의 제목 표시가 켜져 있을 때 플레이어 왼쪽 위에 보여요.">
            <Input value={form.title} onChange={(event) => change({ title: event.currentTarget.value })} />
          </Field>
        </div>
        {/* Stays mounted so a problem that appears later is announced. */}
        <StatusMessage tone="warn">{problem}</StatusMessage>
        {problem ? null : <CodeBlock label="로더 설치 코드" code={code} />}
        <Note tone="info" title="매니저와 같은 사이트의 페이지에서만 동작해요">
          로더와 광고 정보는 매니저가 설치된 사이트에서만 받을 수 있어요. 다른 도메인의 페이지에 붙이면 재생되지 않아요.
          파일을 직접 열지 말고 웹 서버로 열어 주세요.
        </Note>
        <Note tone="info" title="문제가 있어도 방문자에게는 오류가 보이지 않아요">
          프리셋을 받지 못하면 기본 모습으로 재생해요. data-video-id나 data-src가 빠진 자리는 건너뛰고, 브라우저 콘솔에{' '}
          <code>[solad]</code>로 시작하는 경고를 한 번 남겨요.
        </Note>
        <p className="sa-small">한 페이지에 영상이 여러 개면 자리 요소만 여러 개 두고, 로더는 한 번만 넣어요.</p>
      </div>
    </Card>
  );
}

function Generator({
  host,
  list,
  listNotice,
  listError,
  retryList,
  playerModuleUrl,
  apiUrl,
  form,
  change,
}: PlayerSetupProps) {
  const assetsUrl = assetsUrlFrom(playerModuleUrl);

  if (!assetsUrl) {
    return (
      <Card title="예전 정적 코드 만들기">
        <Note tone="warn" title="예전 정적 코드를 만들 수 없어요">
          플레이어 모듈 주소(playerModuleUrl)가 설정되지 않았어요. 설치 설정의 플레이어 모듈 주소를 확인해 주세요.
        </Note>
      </Card>
    );
  }

  if (!list) {
    return (
      <Card title="예전 정적 코드 만들기">
        <ListState notice={listNotice} error={listError} retry={retryList} />
      </Card>
    );
  }

  const find = (id: string | null) => list.presets.find((candidate) => candidate.preset.id === id);
  // A preset deleted elsewhere falls back to the site-applied one, so the select and the code agree.
  const missing = form.presetId !== null && !find(form.presetId);
  const presetId = form.presetId === null || missing ? list.defaultPresetId : form.presetId;
  const entry = find(presetId);
  const native = entry?.preset.playerType === 'native';
  const media = native ? 'mp4' : form.media;
  const videoId = form.videoId.trim();
  const videoIdError = form.videoId === '' ? null : videoIdProblem(videoId);
  const { code, problem } = !entry
    ? { code: '', problem: '사이트 적용 프리셋이 목록에 없어요. 다른 프리셋을 골라 주세요.' }
    : videoIdError
      ? { code: '', problem: '위 설치 코드의 영상 ID를 고치면 예전 정적 코드도 만들어요.' }
      : snippet(() =>
          installSnippet({
            preset: entry.preset,
            host,
            videoId,
            contentUrl: form.contentUrl.trim(),
            media,
            assetsUrl,
            apiUrl: absolute(apiUrl),
          })
        );

  return (
    <Card title="예전 정적 코드 만들기" actions={<HelpLink termId="player-install-snippet" />}>
      <div className="aa-stack">
        <p className="sa-small">영상 ID와 본편 URL은 위 설치 코드에 넣은 값을 써요.</p>
        <Field
          label="프리셋"
          labelAside={<HelpLink termId="player-preset" />}
          help="저장한 값을 코드에 넣어요. 처음에는 사이트 적용 프리셋이 선택돼요."
        >
          <Select value={presetId} onChange={(event) => change({ presetId: event.currentTarget.value })}>
            {list.presets.map(({ preset }) => (
              <option key={preset.id} value={preset.id ?? ''}>
                {preset.name}
                {preset.id === list.defaultPresetId ? ' (사이트 적용)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Fieldset
          legend="미디어"
          legendAside={<HelpLink termId="player-media-engine" />}
          help={native ? HLS_REASON : 'HLS는 Video.js 플레이어에서만 쓸 수 있어요.'}
        >
          {MEDIA.map((value) => (
            <Check
              key={value}
              type="radio"
              name="aa-setup-media"
              label={MEDIA_LABELS[value]}
              value={value}
              checked={media === value}
              disabled={native && value !== 'mp4'}
              onChange={() => change({ media: value })}
            />
          ))}
        </Fieldset>
        {missing ? (
          <Note tone="info">고른 프리셋이 목록에 없어서 사이트 적용 프리셋으로 코드를 만들었어요.</Note>
        ) : null}
        <StatusMessage tone="warn">{problem}</StatusMessage>
        {problem ? null : (
          <div className="aa-stack">
            <CodeBlock label="예전 정적 코드" code={code} />
            <p className="sa-help">{SNIPPET_STALE_NOTE}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/** The preset list while it loads or after it failed; a failure offers to load it again. */
export function ListState({ notice, error, retry }: { notice: string; error: boolean; retry: () => void }) {
  return (
    <div className="aa-stack">
      <Status status={error ? failure(notice) : info(notice)} />
      {error ? (
        <div className="sa-row">
          <Button onClick={retry}>다시 불러오기</Button>
        </div>
      ) : null}
    </div>
  );
}
