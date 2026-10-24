import { type FormEvent, useEffect, useId, useState } from 'react';

import { safeUrl } from '../api/model';
import {
  type AdRequestDetail,
  type AdRequestFilters,
  type AdRequestItem,
  type AdRequestPage,
  type AdRequestView,
  adRequest,
  adRequests,
  REQUEST_STAGE_TONE,
  REQUEST_STAGES,
  type RequestStage,
} from '../api/requests';
import { describeError, IDLE, info, Status, type Notice } from '../app/status';
import { PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import {
  ActivityLog,
  Button,
  ButtonLink,
  Chip,
  ChipGroup,
  DataTable,
  type DataTableColumn,
  Dialog,
  Input,
  KeyValue,
  type KeyValueRow,
  Note,
  StatusBadge,
} from '../components';
import { dateTime } from './LmsScreen';

const FILTER_DELAY_MS = 400;
const NO_FILTERS: AdRequestFilters = { status: '', query: '' };
const MASKED_NOTE = '읽기 전용 계정이라 연락처를 가렸어요.';
const BOARD_NOTE = '상태 바꾸기와 답변은 게시판에서 해요. 이 화면은 읽기만 해요.';
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|svg)(?:[?#]|$)/iu;
const VIDEO_EXTENSION = /\.(?:mp4|webm|m4v|mov)(?:[?#]|$)/iu;

export interface RequestsScreenProps {
  titleId: string;
  title: string;
  /** The menu's current activation; `null` while hidden, so the list loads only once it is shown. */
  activation: number | null;
}

interface RequestQuery {
  filters: AdRequestFilters;
  page: number;
}

/** The query with `next` filters; a real change goes back to the first page, and no change keeps the same object. */
function filterQuery(current: RequestQuery, next: Partial<AdRequestFilters>): RequestQuery {
  const filters = { ...current.filters, ...next };
  const same = filters.query.trim() === current.filters.query.trim() && filters.status === current.filters.status;

  return same ? current : { filters, page: 1 };
}

/** GnuBoard "광고 요청": requests posted on the request boards, read only; processing stays on the board. */
export function RequestsScreen({ titleId, title, activation }: RequestsScreenProps) {
  const { api, session } = useWorkspace();
  const timeZone = session.site.timeZone;
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState<RequestQuery>({ filters: NO_FILTERS, page: 1 });
  const [loaded, setLoaded] = useState<{ query: RequestQuery; data: AdRequestPage } | null>(null);
  const [failed, setFailed] = useState<{ query: RequestQuery; notice: Notice } | null>(null);
  const [opened, setOpened] = useState<AdRequestItem | null>(null);
  const active = activation !== null;

  // Typed search applies after a 0.4 s pause; Enter applies at once.
  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => filterQuery(current, { query: draft })), FILTER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!active) return;

    let current = true;

    adRequests(api, query.filters, query.page).then(
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

  // The last page stays on screen while the next one loads.
  const result = loaded?.data ?? null;
  const failure = failed?.query === query ? failed.notice : null;
  const loading = !failure && loaded?.query !== query;
  const filtered = Boolean(query.filters.query.trim() || query.filters.status);
  const boards = result?.boards ?? [];

  const apply = (next: Partial<AdRequestFilters>) => setQuery((current) => filterQuery(current, next));
  const reload = () => setQuery((current) => ({ ...current }));
  const clear = () => {
    setDraft('');
    setQuery({ filters: NO_FILTERS, page: 1 });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply({ query: draft });
  };

  const total = result?.total ?? 0;
  const pages = result ? Math.max(1, Math.ceil(total / result.perPage)) : 1;
  const go = (page: number) => setQuery((current) => ({ ...current, page }));

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description="회원이 광고 요청 게시판에 올린 요청이에요. 새 요청이 위에 보여요."
      />
      <div className="aa-stack">
        {result ? (
          <ChipGroup label="상태별 보기">
            {(['', ...REQUEST_STAGES] as const).map((stage) => (
              <Chip
                key={stage || 'all'}
                pressed={query.filters.status === stage}
                count={result.counts[stage || 'all']}
                onClick={() => apply({ status: stage })}
              >
                {stage || '전체'}
              </Chip>
            ))}
          </ChipGroup>
        ) : null}
        <DataTable
          caption="광고 요청 목록"
          hideCaption
          dense
          columns={requestColumns(timeZone, boards.length > 1, setOpened)}
          rows={result?.items ?? []}
          rowKey={(item) => `${item.boardId}\u0000${item.postId}`}
          toolbar={
            <form className="sa-row" role="search" aria-label="광고 요청 검색" onSubmit={submit}>
              <h2 className="sa-card-title">요청 {total.toLocaleString('ko-KR')}건</h2>
              <span className="sa-spacer" />
              <Input
                type="search"
                aria-label="제목이나 광고주 검색"
                placeholder="제목, 광고주"
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
              ? { title: failure ? '광고 요청을 불러오지 못했어요.' : '광고 요청을 불러오는 중이에요.' }
              : filtered
                ? {
                    title: '조건에 맞는 요청이 없어요.',
                    description: (
                      <Button size="sm" onClick={clear}>
                        거름 지우기
                      </Button>
                    ),
                  }
                : boards.length === 0
                  ? {
                      title: '광고 요청 게시판이 없어요.',
                      description: '게시판 스킨을 광고 요청(solad_request)으로 고른 게시판이 있어야 요청이 모여요.',
                    }
                  : {
                      title: '아직 광고 요청이 없어요.',
                      description: '회원이 광고 요청 게시판에 글을 쓰면 여기에 보여요.',
                    }
          }
          after={
            total > 0 && result ? (
              <nav className="sa-pager" aria-label="쪽 넘김">
                <span className="sa-pager-total">요청 {total.toLocaleString('ko-KR')}건</span>
                {pages > 1 ? (
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
                ) : null}
              </nav>
            ) : undefined
          }
        />
        {failure ? (
          <Note
            tone="bad"
            actions={
              <Button size="sm" onClick={reload}>
                다시 불러오기
              </Button>
            }
          >
            {failure.text}
          </Note>
        ) : (
          <Status status={loading && result ? info('광고 요청을 불러오는 중이에요.') : IDLE} />
        )}
      </div>
      {opened ? <RequestDialog item={opened} timeZone={timeZone} onClose={() => setOpened(null)} /> : null}
    </>
  );
}

function requestColumns(
  timeZone: string,
  showBoard: boolean,
  onOpen: (item: AdRequestItem) => void
): DataTableColumn<AdRequestItem>[] {
  return [
    { key: 'no', header: '번호', numeric: true, render: (item) => item.postId },
    {
      key: 'title',
      header: '제목',
      render: (item) => (
        <span className="aa-stack">
          <span className="sa-name">
            <b>{item.title}</b>
          </span>
          {item.secret || item.comments || item.hasMedia || showBoard ? (
            <span className="sa-small">
              {[
                showBoard ? item.boardId : null,
                item.secret ? '비밀글' : null,
                item.hasMedia ? '소재 있음' : null,
                item.comments ? `처리 기록 ${item.comments}개` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'advertiser', header: '광고주', render: (item) => item.advertiser ?? '—' },
    { key: 'status', header: '상태', render: (item) => <StageBadge stage={item.status} /> },
    { key: 'period', header: '희망 기간', render: (item) => <span className="sa-num">{period(item)}</span> },
    { key: 'position', header: '위치', render: (item) => item.position ?? '—' },
    {
      key: 'impressions',
      header: '노출 수',
      numeric: true,
      render: (item) => (item.impressions === null ? '—' : item.impressions.toLocaleString('ko-KR')),
    },
    {
      key: 'created',
      header: '접수일',
      render: (item) => <span className="sa-num">{dateTime(item.createdAt, timeZone)}</span>,
    },
    {
      key: 'open',
      header: '동작',
      hideHeader: true,
      render: (item) => (
        <Button size="sm" aria-label={`요청 ${item.postId} 열기`} onClick={() => onOpen(item)}>
          열기
        </Button>
      ),
    },
  ];
}

function StageBadge({ stage }: { stage: RequestStage }) {
  return <StatusBadge status={REQUEST_STAGE_TONE[stage]} label={stage} />;
}

/** "2026-11-01 – 2026-11-15"; a missing end reads "부터", a missing start "까지". */
export function period({ startDate, endDate }: { startDate: string | null; endDate: string | null }): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`;

  if (startDate) return `${startDate}부터`;

  return endDate ? `${endDate}까지` : '—';
}

function RequestDialog({ item, timeZone, onClose }: { item: AdRequestItem; timeZone: string; onClose: () => void }) {
  const { api } = useWorkspace();
  const noteId = useId();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; view: AdRequestView } | null>(null);
  const [failed, setFailed] = useState<{ attempt: number; notice: Notice } | null>(null);

  useEffect(() => {
    let current = true;

    adRequest(api, item.boardId, item.postId).then(
      (view) => {
        if (current) setLoaded({ attempt, view });
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
      (error: unknown) => {
        if (current) setFailed({ attempt, notice: describeError(error).message });
      }
    );

    return () => {
      current = false;
    };
  }, [api, item, attempt]);

  const view = loaded?.view ?? null;
  const failure = failed?.attempt === attempt && !view ? failed.notice : null;
  const request = view?.request ?? null;
  const url = request?.url ?? item.url;

  return (
    <Dialog
      open
      onClose={onClose}
      title={request?.title ?? item.title}
      aside={`${request?.boardName ?? item.boardId} · ${item.postId}번`}
      describedBy={noteId}
      footer={
        url && safeUrl(url) ? (
          <ButtonLink variant="primary" href={url} target="_blank" rel="noopener noreferrer">
            게시판에서 열기<span className="sa-sr"> (새 창)</span>
          </ButtonLink>
        ) : null
      }
    >
      <div className="aa-stack aa-request-detail">
        <p className="sa-small" id={noteId}>
          {BOARD_NOTE}
        </p>
        {failure ? (
          <Note
            tone="bad"
            actions={
              <Button size="sm" onClick={() => setAttempt(attempt + 1)}>
                다시 불러오기
              </Button>
            }
          >
            {failure.text}
          </Note>
        ) : !request ? (
          <Status status={info('요청 내용을 불러오는 중이에요.')} />
        ) : (
          <RequestBody request={request} masked={view?.masked ?? false} timeZone={timeZone} />
        )}
      </div>
    </Dialog>
  );
}

function RequestBody({ request, masked, timeZone }: { request: AdRequestDetail; masked: boolean; timeZone: string }) {
  const author = [request.author.name, request.author.memberId ? `(${request.author.memberId})` : null]
    .filter(Boolean)
    .join(' ');
  const rows: KeyValueRow[] = [
    { key: 'status', label: '상태', value: <StageBadge stage={request.status} /> },
    { key: 'advertiser', label: '광고주', value: request.advertiser ?? '—' },
    { key: 'contact', label: '연락처', value: request.contact ?? '—', numeric: true },
    { key: 'author', label: '작성자', value: author || '—' },
    ...(request.author.email ? [{ key: 'email', label: '이메일', value: request.author.email }] : []),
    { key: 'period', label: '희망 기간', value: period(request), numeric: true },
    { key: 'position', label: '희망 위치', value: request.position ?? '—' },
    {
      key: 'impressions',
      label: '희망 노출 수',
      value: request.impressions === null ? '—' : request.impressions.toLocaleString('ko-KR'),
      numeric: true,
    },
    { key: 'board', label: '희망 게시판', value: request.targetBoard?.name ?? '—' },
    { key: 'click', label: '클릭 주소', value: <ExternalLink url={request.clickUrl} /> },
    { key: 'created', label: '접수', value: dateTime(request.createdAt, timeZone), numeric: true },
    ...(request.updatedAt && request.updatedAt !== request.createdAt
      ? [{ key: 'updated', label: '수정', value: dateTime(request.updatedAt, timeZone), numeric: true }]
      : []),
  ];
  const media = [
    ...request.files.map((file) => ({ key: file.url, name: file.name, url: file.url, kind: file.kind })),
    ...(request.mediaUrl
      ? [{ key: 'mediaUrl', name: '소재 주소', url: request.mediaUrl, kind: kindOf(request.mediaUrl) }]
      : []),
  ];

  return (
    <>
      {masked ? <Note>{MASKED_NOTE}</Note> : null}
      {request.secret ? <p className="sa-small">비밀글이에요. 게시판에서는 작성자와 관리자만 볼 수 있어요.</p> : null}
      <KeyValue label="요청서" rows={rows} />
      <section className="aa-stack" aria-label="요청 내용">
        <h3 className="sa-card-title">요청 내용</h3>
        {request.content ? <p className="aa-pre">{request.content}</p> : <p className="sa-small">내용이 없어요.</p>}
      </section>
      {media.length ? (
        <section className="aa-stack" aria-label="소재">
          <h3 className="sa-card-title">소재</h3>
          <ul className="aa-request-media">
            {media.map((entry) => (
              <li key={entry.key} className="aa-stack">
                <MediaPreview url={entry.url} kind={entry.kind} name={entry.name} />
                <ExternalLink url={entry.url} label={entry.name} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="aa-stack" aria-label="처리 기록">
        <h3 className="sa-card-title">처리 기록</h3>
        {request.history.length ? (
          <ActivityLog
            label="처리 기록 (오래된 순)"
            entries={request.history.map((comment) => ({
              id: String(comment.commentId),
              time: dateTime(comment.createdAt, timeZone),
              datetime: comment.createdAt ?? undefined,
              text: (
                <span className="aa-pre">
                  <b>{comment.author || '—'}</b>
                  {comment.status ? ` · ${comment.status}(으)로 바꿈` : ''}
                  {comment.content ? `\n${comment.content}` : ''}
                </span>
              ),
            }))}
          />
        ) : (
          <p className="sa-small">아직 처리 기록이 없어요.</p>
        )}
      </section>
    </>
  );
}

function kindOf(url: string): 'image' | 'video' | 'other' {
  if (IMAGE_EXTENSION.test(url)) return 'image';

  return VIDEO_EXTENSION.test(url) ? 'video' : 'other';
}

function MediaPreview({ url, kind, name }: { url: string; kind: 'image' | 'video' | 'other'; name: string }) {
  if (!safeUrl(url) || kind === 'other') return null;

  return (
    <div className="aa-media aa-request-thumb">
      {kind === 'image' ? (
        <img src={url} alt={name} loading="lazy" />
      ) : (
        <video src={url} controls preload="metadata" aria-label={name} />
      )}
    </div>
  );
}

/** An address opened in a new tab; anything but HTTP(S) or a same-site path is shown as text. */
function ExternalLink({ url, label }: { url: string | null; label?: string }) {
  if (!url) return <>—</>;

  if (!safeUrl(url)) return <span className="sa-small">{label ?? url}</span>;

  return (
    <a className="sa-link" href={url} target="_blank" rel="noopener noreferrer">
      {label ?? url}
      <span className="sa-sr"> (새 창)</span>
    </a>
  );
}
