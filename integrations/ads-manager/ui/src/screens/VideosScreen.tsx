import { type FormEvent, useEffect, useId, useState } from 'react';

import { safeUrl } from '../api/model';
import {
  deleteVideoMedia,
  generateVideoMedia,
  type MediaDetection,
  type UploadedVideo,
  type UploadedVideoFilters,
  type UploadedVideoPage,
  uploadedVideos,
  VIDEO_FEATURE_LABELS,
  VIDEO_FEATURES,
  VIDEO_SOURCE_LABELS,
  type VideoBoard,
  type VideoFeature,
  type VideoFeatureStatus,
} from '../api/videos';
import { describeError, failure, IDLE, info, Status, type Notice } from '../app/status';
import { PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import {
  type AdStatus,
  Button,
  ButtonLink,
  Card,
  DataTable,
  type DataTableColumn,
  Dialog,
  Input,
  KeyValue,
  Note,
  Select,
  StatusBadge,
} from '../components';

const FILTER_DELAY_MS = 400;
const NO_FILTERS: UploadedVideoFilters = { boardId: '', query: '' };
const READ_ONLY = '읽기 전용 계정이라 만들거나 지울 수 없어요.';
const NO_FFMPEG = 'ffmpeg를 찾지 못해 만들 수 없어요.';
const NO_FEATURES = '게시판 설정에서 켜진 기능이 없어요.';
const INSTALL_HINT =
  '서버에 ffmpeg를 설치해 주세요(예: apt install ffmpeg). 다른 경로에 있으면 그누보드 설정의 SOLAD_FFMPEG_PATH로 알려 주세요.';

/** Badge color per state: made is lit, missing is dim, the rest say why. */
const STATUS_TONE = {
  ready: 'active',
  none: 'archived',
  disabled: 'paused',
  unsupported: 'draft',
  error: 'rejected',
} satisfies Record<VideoFeatureStatus, AdStatus>;

const STATUS_SUFFIX = {
  ready: '',
  none: '',
  disabled: '꺼짐',
  unsupported: '못 만듦',
  error: '오류',
} satisfies Record<VideoFeatureStatus, string>;

const STATUS_WORDS = {
  ready: '만들었어요',
  none: '아직 없어요',
  disabled: '게시판에서 꺼져 있어요',
  unsupported: '만들 수 없어요',
  error: '만들지 못했어요',
} satisfies Record<VideoFeatureStatus, string>;

export interface VideosScreenProps {
  titleId: string;
  title: string;
  /** The menu's current activation; `null` while hidden, so the list loads only once it is shown. */
  activation: number | null;
}

interface VideoQuery {
  filters: UploadedVideoFilters;
  page: number;
  /** Runs ffmpeg detection again instead of using the server's short cache. */
  refresh: boolean;
}

/** A pending generation or removal; one at a time, because each runs ffmpeg on the server. */
interface Busy {
  key: string;
  feature: VideoFeature | 'all';
  kind: 'generate' | 'delete';
}

const keyOf = (video: Pick<UploadedVideo, 'boardId' | 'postId'>) => `${video.boardId}\u0000${video.postId}`;

/** The query with `next` filters; a real change goes back to the first page, and no change keeps the same object. */
function filterQuery(current: VideoQuery, next: Partial<UploadedVideoFilters>): VideoQuery {
  const filters = { ...current.filters, ...next };
  const same = filters.query.trim() === current.filters.query.trim() && filters.boardId === current.filters.boardId;

  return same ? current : { filters, page: 1, refresh: false };
}

/** Why `feature` (or every enabled one) cannot be generated now, or `null` when it can. */
export function generateBlock(
  video: UploadedVideo,
  feature: VideoFeature | 'all',
  media: MediaDetection,
  canWrite: boolean
): string | null {
  if (!canWrite) return READ_ONLY;

  const states = feature === 'all' ? VIDEO_FEATURES.map((name) => video.features[name]) : [video.features[feature]];
  const unsupported = states.find((state) => state.status === 'unsupported');
  if (unsupported) return unsupported.message ?? '이 영상으로는 만들 수 없어요.';

  if (!media.available) return NO_FFMPEG;

  if (feature === 'all') return states.some((state) => state.status !== 'disabled') ? null : NO_FEATURES;

  return video.features[feature].status === 'disabled' ? '게시판 설정에서 꺼져 있어요.' : null;
}

/** GnuBoard "업로드 동영상": video posts of the solad_video boards and their cover, thumbnails and highlight. */
export function VideosScreen({ titleId, title, activation }: VideosScreenProps) {
  const { api, session } = useWorkspace();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState<VideoQuery>({ filters: NO_FILTERS, page: 1, refresh: false });
  const [loaded, setLoaded] = useState<{ query: VideoQuery; data: UploadedVideoPage } | null>(null);
  const [failed, setFailed] = useState<{ query: VideoQuery; notice: Notice } | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<Notice>(IDLE);
  const active = activation !== null;

  // Typed search applies after a 0.4 s pause; Enter applies at once.
  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => filterQuery(current, { query: draft })), FILTER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!active) return;

    let current = true;

    uploadedVideos(api, query.filters, query.page, query.refresh).then(
      (data) => {
        if (current) setLoaded({ query, data });
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
      (error: unknown) => {
        if (current) setFailed({ query, notice: describeError(error).message });
      }
    );

    return () => {
      current = false;
    };
  }, [api, query, active]);

  const result = loaded?.data ?? null;
  const loadFailure = failed?.query === query ? failed.notice : null;
  const loading = !loadFailure && loaded?.query !== query;
  const boards = result?.boards ?? [];
  const media = result?.media ?? null;
  const filtered = Boolean(query.filters.query.trim() || query.filters.boardId);
  const total = result?.total ?? 0;
  const pages = result ? Math.max(1, Math.ceil(total / result.pageSize)) : 1;
  const openedVideo = result?.items.find((video) => keyOf(video) === opened) ?? null;

  const apply = (next: Partial<UploadedVideoFilters>) => setQuery((current) => filterQuery(current, next));
  const reload = (refresh = false) => setQuery((current) => ({ ...current, refresh }));
  const go = (page: number) => setQuery((current) => ({ ...current, page, refresh: false }));
  const clear = () => {
    setDraft('');
    setQuery({ filters: NO_FILTERS, page: 1, refresh: false });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply({ query: draft });
  };

  // Only the row that changed is replaced; the rest of the page stays as loaded.
  const replace = (video: UploadedVideo) =>
    setLoaded((current) =>
      current
        ? {
            ...current,
            data: {
              ...current.data,
              items: current.data.items.map((item) => (keyOf(item) === keyOf(video) ? video : item)),
            },
          }
        : current
    );

  async function run(video: UploadedVideo, feature: VideoFeature | 'all', kind: Busy['kind']) {
    const name = feature === 'all' ? '추가 기능' : VIDEO_FEATURE_LABELS[feature];

    setBusy({ key: keyOf(video), feature, kind });
    setNotice(
      info(kind === 'generate' ? `「${video.title}」의 ${name}을 만드는 중이에요.` : `${name}을 지우는 중이에요.`)
    );

    try {
      if (kind === 'generate') {
        const { item, failed: missing } = await generateVideoMedia(api, video, feature);

        replace(item);
        setNotice(
          missing.length
            ? failure(
                missing
                  .map((name) => `${VIDEO_FEATURE_LABELS[name]}: ${item.features[name].message ?? '만들지 못했어요.'}`)
                  .join(' ')
              )
            : info(`「${item.title}」의 ${name}을 만들었어요.`)
        );
      } else {
        const item = await deleteVideoMedia(api, video, feature);

        replace(item);
        setNotice(info(`「${item.title}」의 ${name}을 지웠어요.`));
      }
    } catch (error) {
      setNotice(describeError(error).message);
    } finally {
      setBusy(null);
    }
  }

  const actions: RowActions = {
    media,
    canWrite: session.canWrite,
    busy,
    onGenerate: (video, feature) => void run(video, feature, 'generate'),
    onDelete: (video, feature) => void run(video, feature, 'delete'),
    onOpen: (video) => setOpened(keyOf(video)),
  };

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description="동영상 게시판에 올린 영상이에요. 커버, 진행바 썸네일, 하이라이트를 만들 수 있어요."
      />
      <div className="aa-stack">
        <div className="aa-videos-top">
          <MediaCard media={media} loading={loading && query.refresh} onRecheck={() => reload(true)} />
          <BoardsCard boards={result ? boards : null} />
        </div>
        {!session.canWrite ? <Note>{READ_ONLY}</Note> : null}
        <DataTable
          caption="업로드 동영상 목록"
          hideCaption
          dense
          className="aa-videos-table"
          columns={videoColumns(boards.length > 1, actions)}
          rows={result?.items ?? []}
          rowKey={keyOf}
          toolbar={
            <form className="sa-row" role="search" aria-label="업로드 동영상 검색" onSubmit={submit}>
              <h2 className="sa-card-title">영상 {total.toLocaleString('ko-KR')}개</h2>
              <span className="sa-spacer" />
              {boards.length > 1 ? (
                <Select
                  aria-label="게시판"
                  value={query.filters.boardId}
                  onChange={(event) => apply({ boardId: event.currentTarget.value })}
                >
                  <option value="">모든 게시판</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.subject}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Input
                type="search"
                aria-label="제목 검색"
                placeholder="제목"
                maxLength={100}
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
              />
              <Button size="sm" type="submit">
                검색
              </Button>
            </form>
          }
          empty={
            !result
              ? { title: loadFailure ? '영상 목록을 불러오지 못했어요.' : '영상 목록을 불러오는 중이에요.' }
              : filtered
                ? {
                    title: '조건에 맞는 영상이 없어요.',
                    description: (
                      <Button size="sm" onClick={clear}>
                        거름 지우기
                      </Button>
                    ),
                  }
                : boards.length === 0
                  ? {
                      title: '동영상 게시판이 없어요.',
                      description: '게시판 스킨을 솔애드 동영상(solad_video)으로 고른 게시판이 있어야 영상이 모여요.',
                    }
                  : { title: '아직 올린 영상이 없어요.', description: '동영상 게시판에 글을 쓰면 여기에 보여요.' }
          }
          after={
            total > 0 && result && pages > 1 ? (
              <nav className="sa-pager" aria-label="쪽 넘김">
                <span className="sa-pager-total">영상 {total.toLocaleString('ko-KR')}개</span>
                <div className="sa-pager-nav">
                  <Button size="sm" disabled={result.page <= 1} onClick={() => go(result.page - 1)}>
                    이전
                  </Button>
                  <span className="sa-pager-now" aria-current="page">
                    {result.page} / {pages}쪽
                  </span>
                  <Button size="sm" disabled={result.page >= pages} onClick={() => go(result.page + 1)}>
                    다음
                  </Button>
                </div>
              </nav>
            ) : undefined
          }
        />
        {loadFailure ? (
          <Note
            tone="bad"
            actions={
              <Button size="sm" onClick={() => reload()}>
                다시 불러오기
              </Button>
            }
          >
            {loadFailure.text}
          </Note>
        ) : (
          <Status status={notice.text ? notice : loading && result ? info('영상 목록을 불러오는 중이에요.') : IDLE} />
        )}
      </div>
      {openedVideo ? (
        <VideoDialog video={openedVideo} actions={actions} notice={notice} onClose={() => setOpened(null)} />
      ) : null}
    </>
  );
}

function MediaCard({
  media,
  loading,
  onRecheck,
}: {
  media: MediaDetection | null;
  loading: boolean;
  onRecheck: () => void;
}) {
  // A read-only account gets no path, so only the version shows.
  const tool = (found: MediaDetection['ffmpeg']) =>
    found ? [found.version, found.path].filter(Boolean).join(' · ') : '못 찾았어요';

  return (
    <Card
      title="ffmpeg"
      actions={
        <Button size="sm" disabled={loading || !media} onClick={onRecheck}>
          {loading ? '확인하는 중…' : '다시 확인'}
        </Button>
      }
    >
      {!media ? (
        <p className="sa-small">서버의 ffmpeg를 확인하는 중이에요.</p>
      ) : (
        <div className="aa-stack">
          <p>
            <StatusBadge
              status={media.available ? 'active' : 'rejected'}
              label={media.available ? '찾았어요' : '못 찾았어요'}
            />
          </p>
          {media.available ? null : (
            <Note tone="warn">
              <b>{media.message ?? 'ffmpeg를 쓸 수 없어요.'}</b>{' '}
              {media.reason === 'proc_open' ? 'php.ini의 disable_functions에서 proc_open을 빼야 해요.' : INSTALL_HINT}
            </Note>
          )}
          <KeyValue
            label="ffmpeg 감지 결과"
            rows={[
              { key: 'ffmpeg', label: 'ffmpeg', value: tool(media.ffmpeg), numeric: true },
              { key: 'ffprobe', label: 'ffprobe', value: tool(media.ffprobe), numeric: true },
            ]}
          />
        </div>
      )}
    </Card>
  );
}

function BoardsCard({ boards }: { boards: VideoBoard[] | null }) {
  return (
    <Card title="게시판별 추가 기능">
      <div className="aa-stack">
        <p className="sa-small">게시판 설정에서 켜고 끌 수 있어요. 켠 기능만 여기서 만들 수 있어요.</p>
        {boards === null ? null : boards.length === 0 ? (
          <p className="sa-small">동영상 게시판이 없어요.</p>
        ) : (
          <ul className="aa-videos-boards">
            {boards.map((board) => (
              <li key={board.id}>
                <span className="aa-stack">
                  <b>{board.subject}</b>
                  <span className="aa-videos-badges">
                    {VIDEO_FEATURES.map((feature) => (
                      <StatusBadge
                        key={feature}
                        status={board.features.includes(feature) ? 'active' : 'archived'}
                        label={`${VIDEO_FEATURE_LABELS[feature]} ${board.features.includes(feature) ? '켜짐' : '꺼짐'}`}
                      />
                    ))}
                  </span>
                </span>
                {board.formUrl && safeUrl(board.formUrl) ? (
                  <ButtonLink size="sm" href={board.formUrl} target="_blank" rel="noopener noreferrer">
                    게시판 설정<span className="sa-sr"> {board.subject} (새 창)</span>
                  </ButtonLink>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

interface RowActions {
  media: MediaDetection | null;
  canWrite: boolean;
  busy: Busy | null;
  onGenerate: (video: UploadedVideo, feature: VideoFeature | 'all') => void;
  onDelete: (video: UploadedVideo, feature: VideoFeature | 'all') => void;
  onOpen: (video: UploadedVideo) => void;
}

function videoColumns(showBoard: boolean, actions: RowActions): DataTableColumn<UploadedVideo>[] {
  return [
    {
      key: 'cover',
      header: '커버',
      render: (video) => <Cover video={video} />,
    },
    {
      key: 'title',
      header: '제목',
      render: (video) => (
        <span className="aa-stack">
          <span className="sa-name">
            <b>{video.title}</b>
          </span>
          <span className="sa-small">
            {[showBoard ? video.boardSubject : null, `${video.postId}번`, video.secret ? '비밀글' : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      ),
    },
    { key: 'source', header: '형식', render: (video) => VIDEO_SOURCE_LABELS[video.source] },
    {
      key: 'duration',
      header: '재생 시간',
      numeric: true,
      render: (video) => (video.duration === null ? '—' : clock(video.duration)),
    },
    {
      key: 'created',
      header: '작성일',
      render: (video) => <span className="sa-num">{video.createdAt.slice(0, 16) || '—'}</span>,
    },
    {
      key: 'features',
      header: '추가 기능',
      render: (video) => <FeatureBadges video={video} />,
    },
    {
      key: 'actions',
      header: '동작',
      hideHeader: true,
      pinEnd: true,
      render: (video) => {
        const busy = actions.busy?.key === keyOf(video);
        const block = actions.media ? generateBlock(video, 'all', actions.media, actions.canWrite) : NO_FFMPEG;

        return (
          <span className="sa-row aa-videos-actions">
            <Button
              size="sm"
              variant="primary"
              disabled={Boolean(block) || actions.busy !== null}
              title={block ?? undefined}
              aria-label={`${video.title} 추가 기능 모두 만들기`}
              onClick={() => actions.onGenerate(video, 'all')}
            >
              {busy && actions.busy?.kind === 'generate' ? '만드는 중…' : '모두 만들기'}
            </Button>
            <Button size="sm" aria-label={`${video.title} 관리`} onClick={() => actions.onOpen(video)}>
              관리
            </Button>
          </span>
        );
      },
    },
  ];
}

function Cover({ video }: { video: UploadedVideo }) {
  const url = video.features.cover.url;

  return url && safeUrl(url) ? (
    <img className="aa-videos-cover" src={url} alt="" loading="lazy" />
  ) : (
    <span className="aa-videos-cover is-empty" aria-hidden="true" />
  );
}

function FeatureBadges({ video }: { video: UploadedVideo }) {
  return (
    <span className="aa-videos-badges">
      {VIDEO_FEATURES.map((feature) => {
        const { status, message } = video.features[feature];
        const suffix = STATUS_SUFFIX[status];

        return (
          <span key={feature} title={message ?? STATUS_WORDS[status]}>
            <StatusBadge
              status={STATUS_TONE[status]}
              label={`${VIDEO_FEATURE_LABELS[feature]}${suffix ? ` · ${suffix}` : ''}`}
            />
            <span className="sa-sr"> {STATUS_WORDS[status]}</span>
          </span>
        );
      })}
    </span>
  );
}

function VideoDialog({
  video,
  actions,
  notice,
  onClose,
}: {
  video: UploadedVideo;
  actions: RowActions;
  notice: Notice;
  onClose: () => void;
}) {
  const noteId = useId();
  const media = actions.media;

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={video.title}
      aside={`${video.boardSubject} · ${video.postId}번`}
      describedBy={noteId}
      footer={
        video.postUrl && safeUrl(video.postUrl) ? (
          <ButtonLink href={video.postUrl} target="_blank" rel="noopener noreferrer">
            게시판에서 열기<span className="sa-sr"> (새 창)</span>
          </ButtonLink>
        ) : null
      }
    >
      <div className="aa-stack">
        <p className="sa-small" id={noteId}>
          {VIDEO_SOURCE_LABELS[video.source]} · {video.duration === null ? '재생 시간 모름' : clock(video.duration)}.
          다시 만들면 덮어써요.
        </p>
        <div className="aa-videos-features">
          {VIDEO_FEATURES.map((feature) => {
            const state = video.features[feature];
            const block = media ? generateBlock(video, feature, media, actions.canWrite) : NO_FFMPEG;
            const busy =
              actions.busy?.key === keyOf(video) &&
              (actions.busy.feature === feature || actions.busy.feature === 'all');
            const has = state.url !== null;

            return (
              <section key={feature} className="sa-card aa-stack" aria-label={VIDEO_FEATURE_LABELS[feature]}>
                <div className="sa-row">
                  <h3 className="sa-card-title">{VIDEO_FEATURE_LABELS[feature]}</h3>
                  <span className="sa-spacer" />
                  <StatusBadge status={STATUS_TONE[state.status]} label={STATUS_WORDS[state.status]} />
                </div>
                <FeaturePreview feature={feature} video={video} />
                {state.message && state.status !== 'ready' ? <p className="sa-small">{state.message}</p> : null}
                <div className="sa-row">
                  <Button
                    size="sm"
                    variant="primary"
                    disabledReason={block ?? (actions.busy && !busy ? '다른 작업이 끝나면 할 수 있어요.' : undefined)}
                    disabled={busy}
                    onClick={() => actions.onGenerate(video, feature)}
                  >
                    {busy && actions.busy?.kind === 'generate' ? '만드는 중…' : has ? '다시 만들기' : '만들기'}
                  </Button>
                  {has ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!actions.canWrite || actions.busy !== null}
                      onClick={() => actions.onDelete(video, feature)}
                    >
                      지우기
                    </Button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
        <Status status={notice} />
      </div>
    </Dialog>
  );
}

function FeaturePreview({ feature, video }: { feature: VideoFeature; video: UploadedVideo }) {
  const state = video.features[feature];
  const url = feature === 'thumbnails' ? state.image : state.url;
  if (!url || !safeUrl(url)) return <span className="aa-videos-preview is-empty">미리보기 없음</span>;

  if (feature === 'highlight')
    return (
      <video className="aa-videos-preview" src={url} muted loop playsInline controls preload="metadata">
        <track kind="captions" />
      </video>
    );

  return (
    <a className="aa-videos-preview-link" href={url} target="_blank" rel="noopener noreferrer">
      <img
        className={feature === 'thumbnails' ? 'aa-videos-preview is-sprite' : 'aa-videos-preview'}
        src={url}
        alt={feature === 'thumbnails' ? `${video.title} 진행바 썸네일 모음` : `${video.title} 커버`}
      />
    </a>
  );
}

/** "1:05" or "1:02:05". */
export function clock(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');

  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
