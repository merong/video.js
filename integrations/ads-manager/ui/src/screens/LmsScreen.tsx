import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import {
  downloadLmsProgressCsv,
  type LmsProgressFilters,
  type LmsProgressPage,
  type LmsProgressRow,
  type LmsProgressStatus,
  type LmsSettings,
  type LmsTestToken,
  lmsProgressList,
  lmsSettings,
  lmsTestToken,
  rotateLmsKey,
} from '../api/lms';
import { useConfirm } from '../app/confirm';
import { hrefFor, type LmsPage } from '../app/routes';
import { describeError, IDLE, info, Status, type Notice } from '../app/status';
import { DownloadIcon, PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import {
  Button,
  ButtonLink,
  Card,
  CodeBlock,
  DataTable,
  type DataTableColumn,
  Field,
  Input,
  KeyValue,
  Note,
  Progress,
  Segmented,
  StatusBadge,
  SubNav,
} from '../components';
import { HelpLink, helpHref } from '../help';
import { saveBlob } from './StatsScreen';

const SUB_PAGES = [
  { page: 'progress', label: '학습 진도' },
  { page: 'settings', label: 'LMS 연동' },
] as const satisfies readonly { page: LmsPage; label: string }[];

const PAGE_HEADS = {
  progress: { title: '학습 진도', description: '학습자별 진도와 완료를 봐요. 서버에 저장된 기록만 나와요.' },
  settings: {
    title: 'LMS 연동',
    description: '외부 LMS가 학습자를 알려 주면 진도와 메모를 학습자별로 저장해요.',
  },
} satisfies Record<LmsPage, { title: string; description: string }>;

const KEY_MISSING = '연동 키를 먼저 만들어 주세요.';
const FILTER_DELAY_MS = 400;

const TOKEN_EXAMPLE = `<?php
// LMS 서버에서만 실행하세요. 연동 키는 브라우저로 보내지 않아요.
function solad_b64url(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

$key = getenv('SOLAD_LMS_KEY'); // "LMS 연동"에서 복사한 64자 키 그대로
$payload = solad_b64url(json_encode([
    'v' => 1,
    'sub' => 'student-7',   // 학습자 ID
    'exp' => time() + 3600, // 만료(유닉스 초), 24시간 이내
    // 'dur' => 2712,       // 영상 길이(초), 선택
]));
$token = $payload . '.' . solad_b64url(hash_hmac('sha256', $payload, $key, true));`;

export interface LmsScreenProps {
  titleId: string;
  title: string;
  /** The active page; `null` while another menu is shown. */
  page: LmsPage | null;
  /** The menu's current activation; `null` while hidden. */
  activation: number | null;
}

/** "강의" menu: learner progress and the LMS link (ads-lms-spec 5.2, handoff 3.3–3.4). */
export function LmsScreen({ titleId, title, page, activation }: LmsScreenProps) {
  const { session } = useWorkspace();
  const [shown, setShown] = useState<LmsPage>(page ?? 'progress');
  const { lms } = session.capabilities;
  const installed = lms ? lms.installed === true : false;
  const visible = page !== null;
  const firstPage = useRef(true);

  if (page !== null && page !== shown) setShown(page);

  // After a page change inside the menu, move focus to the page heading.
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }

    if (visible) document.getElementById(`${titleId}-page`)?.focus();
  }, [shown, visible, titleId]);

  const head = PAGE_HEADS[shown];

  return (
    <>
      <PageHead titleId={titleId} title={title} description="강의 프리셋 영상의 학습 기록과 외부 LMS 연동을 다뤄요." />
      <SubNav
        label="강의 화면"
        items={SUB_PAGES.map((item) => ({
          id: item.page,
          label: item.label,
          href: hrefFor('lms', item.page),
          current: shown === item.page,
        }))}
      />
      <div className="aa-stack">
        <h2 id={`${titleId}-page`} className="sa-card-title" tabIndex={-1}>
          {head.title}
        </h2>
        <p className="sa-small">{head.description}</p>
      </div>
      {shown === 'progress' ? (
        <ProgressPage installed={installed} active={activation !== null} />
      ) : // The new key shows once: leaving the page or the menu unmounts it.
      activation === null ? null : (
        <SettingsPage installed={installed} />
      )}
    </>
  );
}

function NotInstalled({ link }: { link?: boolean }) {
  return (
    <Note
      tone="warn"
      actions={
        link ? (
          <ButtonLink size="sm" href={hrefFor('lms', 'settings')}>
            LMS 연동 보기
          </ButtonLink>
        ) : undefined
      }
    >
      LMS 표가 아직 없어요. 서버에서 <code>php bin/install.php</code>를 다시 실행해 주세요.
    </Note>
  );
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
function unavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'lms_unavailable';
}

function SettingsPage({ installed }: { installed: boolean }) {
  const { api, session, publicBase, run } = useWorkspace();
  const confirm = useConfirm();
  const timeZone = session.site.timeZone;
  const [settings, setSettings] = useState<LmsSettings | null>(null);
  const [loadStatus, setLoadStatus] = useState<Notice>(IDLE);
  const [keyStatus, setKeyStatus] = useState<Notice>(IDLE);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [learnerId, setLearnerId] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [dur, setDur] = useState('');
  const [tokenStatus, setTokenStatus] = useState<Notice>(IDLE);
  const [token, setToken] = useState<LmsTestToken | null>(null);

  useEffect(() => {
    if (!installed) return;

    let current = true;

    lmsSettings(api).then(
      (value) => {
        if (current) setSettings(value);
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
      (error: unknown) => {
        if (current) setLoadStatus(describeError(error).message);
      }
    );

    return () => {
      current = false;
    };
  }, [api, installed]);

  if (!installed || settings?.installed === false) return <NotInstalled />;

  if (!settings) return <Status status={loadStatus.text ? loadStatus : info('연동 상태를 불러오는 중이에요.')} />;

  const rotate = async () => {
    if (
      settings.keySet &&
      !(await confirm({
        title: '연동 키를 바꿀까요?',
        body: '바꾸면 지금까지 만든 학습자 토큰이 모두 무효가 돼요. LMS 서버에 둔 키도 새 키로 바꿔야 해요.',
        confirmLabel: '바꾸기',
        danger: true,
      }))
    ) {
      return;
    }

    await run(setKeyStatus, async () => {
      const result = await rotateLmsKey(api);

      setNewKey(result.key);
      setSettings({ ...settings, keySet: true, keyHint: result.keyHint, rotatedAt: result.rotatedAt });
      setToken(null);
      setKeyStatus(info(settings.keySet ? '연동 키를 바꿨어요.' : '연동 키를 만들었어요.'));
    });
  };

  const makeToken = (event: FormEvent) => {
    event.preventDefault();
    setToken(null);
    void run(setTokenStatus, async () => {
      try {
        const length = dur.trim() === '' ? undefined : Number(dur);

        setToken(await lmsTestToken(api, { learnerId: learnerId.trim(), minutes: Number(minutes), dur: length }));
        setTokenStatus(IDLE);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'lms_key_missing') {
          throw new ApiError(KEY_MISSING, error.status, error.code);
        }

        throw error;
      }
    });
  };

  const hint = settings.keyHint && !settings.keyHint.startsWith('…') ? `…${settings.keyHint}` : settings.keyHint;
  // The sample lecture has a token field; the token is pasted there, never put in an address.
  const lectureHref = `${publicBase}examples/lecture.html`;

  return (
    <div className="aa-stack">
      <Card title="연동 상태">
        <div className="aa-stack">
          <KeyValue
            label="연동 상태"
            rows={[
              { key: 'table', label: 'LMS 표', value: '설치됨' },
              {
                key: 'key',
                label: '연동 키',
                value: settings.keySet ? `있어요${hint ? ` (${hint})` : ''}` : '아직 없어요',
              },
              { key: 'rotated', label: '마지막으로 바꾼 때', value: dateTime(settings.rotatedAt, timeZone) },
            ]}
          />
          <div className="sa-row">
            <Button variant={settings.keySet ? 'default' : 'primary'} onClick={() => void rotate()}>
              {settings.keySet ? '연동 키 바꾸기' : '연동 키 만들기'}
            </Button>
            <HelpLink termId="lms-key" />
          </div>
          <Status status={keyStatus} />
          {newKey ? (
            <>
              <CodeBlock label="새 연동 키" code={newKey} />
              <Note tone="warn">이 키는 지금 한 번만 보여요. 복사해서 LMS 서버에 안전하게 두세요.</Note>
            </>
          ) : null}
        </div>
      </Card>

      <Card title="학습자 토큰 만드는 법">
        <div className="aa-stack">
          <p className="sa-small">
            LMS 서버가 학습자 ID와 만료 시각을 연동 키로 서명해서 토큰을 만들어요.
            <br />
            토큰은 플레이어 자리 요소의 data-learner-token에 넣어요.
            <br />
            키가 바뀌거나 만료되면 그 학습자는 이 브라우저에만 기록돼요.
          </p>
          <CodeBlock label="PHP 예시" code={TOKEN_EXAMPLE} />
          <span>
            <a className="sa-link" href={helpHref('lms-learner-token')}>
              도움말에서 자세히 보기
            </a>
          </span>
        </div>
      </Card>

      <Card title="시험 토큰 만들기">
        <form className="aa-stack" onSubmit={makeToken} noValidate>
          <div className="aa-form-grid">
            <Field label="학습자 ID" help="영문, 숫자, . _ : @ - 로 64자까지">
              <Input value={learnerId} maxLength={64} onChange={(event) => setLearnerId(event.currentTarget.value)} />
            </Field>
            <Field label="유효 시간(분)" help="1–1440 정수예요.">
              <Input
                value={minutes}
                numeric
                type="number"
                min={1}
                max={1440}
                step={1}
                onChange={(event) => setMinutes(event.currentTarget.value)}
              />
            </Field>
            <Field label="영상 길이(초, 선택)" help="LMS가 아는 영상 길이예요. 비우면 처음 보고된 길이를 써요.">
              <Input
                value={dur}
                numeric
                type="number"
                min={1}
                step={1}
                onChange={(event) => setDur(event.currentTarget.value)}
              />
            </Field>
          </div>
          <div className="sa-row">
            <Button type="submit" variant="primary">
              시험 토큰 만들기
            </Button>
          </div>
          <Status status={tokenStatus} />
          {token ? (
            <>
              <CodeBlock label="시험 토큰" code={token.token} />
              <p className="sa-row">
                {token.expiresAt ? (
                  <span className="sa-small">{clock(token.expiresAt, timeZone)}에 만료돼요.</span>
                ) : null}
                <ButtonLink size="sm" href={lectureHref} target="_blank" rel="noopener noreferrer">
                  샘플 강의에서 써 보기<span className="sa-sr"> (새 창)</span>
                </ButtonLink>
              </p>
            </>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'done', label: '완료' },
  { value: 'doing', label: '학습 중' },
] as const satisfies readonly { value: LmsProgressStatus; label: string }[];

const NO_FILTERS: LmsProgressFilters = { videoId: '', learner: '', status: 'all' };

interface ProgressQuery {
  filters: LmsProgressFilters;
  page: number;
}

/** The query with `next` filters; a real change goes back to the first page, and no change keeps the same object. */
function filterQuery(current: ProgressQuery, next: Partial<LmsProgressFilters>): ProgressQuery {
  const filters = { ...current.filters, ...next };
  const same =
    filters.videoId.trim() === current.filters.videoId.trim() &&
    filters.learner.trim() === current.filters.learner.trim() &&
    filters.status === current.filters.status;

  return same ? current : { filters, page: 1 };
}

function ProgressPage({ installed, active }: { installed: boolean; active: boolean }) {
  const { api, session, run } = useWorkspace();
  const timeZone = session.site.timeZone;
  const [draft, setDraft] = useState({ videoId: '', learner: '' });
  const [query, setQuery] = useState<ProgressQuery>({ filters: NO_FILTERS, page: 1 });
  const [loaded, setLoaded] = useState<{ query: ProgressQuery; data: LmsProgressPage } | null>(null);
  const [failed, setFailed] = useState<{ query: ProgressQuery; notice: Notice } | null>(null);
  const [missing, setMissing] = useState(!installed);
  const [csvStatus, setCsvStatus] = useState<Notice>(IDLE);

  const apply = (next: Partial<LmsProgressFilters>) => setQuery((current) => filterQuery(current, next));

  // Typed filters apply after a 0.4 s pause; Enter applies at once.
  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => filterQuery(current, draft)), FILTER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!active || missing) return;

    let current = true;

    lmsProgressList(api, query.filters, query.page).then(
      (data) => {
        if (current) setLoaded({ query, data });
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
      (error: unknown) => {
        if (!current) return;

        if (unavailable(error)) setMissing(true);
        else setFailed({ query, notice: describeError(error).message });
      }
    );

    return () => {
      current = false;
    };
  }, [api, query, active, missing]);

  if (missing) return <NotInstalled link />;

  // The last page stays on screen while the next one loads.
  const result = loaded?.data ?? null;
  const status =
    failed?.query === query ? failed.notice : loaded?.query === query ? IDLE : info('학습 기록을 불러오는 중이에요.');

  const filtered = Boolean(
    query.filters.videoId.trim() || query.filters.learner.trim() || query.filters.status !== 'all'
  );
  const clear = () => {
    setDraft({ videoId: '', learner: '' });
    setQuery({ filters: NO_FILTERS, page: 1 });
  };

  const download = () =>
    void run(setCsvStatus, async () => {
      saveBlob(await downloadLmsProgressCsv(api, query.filters), 'lms-progress.csv');
      setCsvStatus(info('지금 거름의 CSV 내려받기를 요청했어요. 브라우저 다운로드 목록을 확인해 주세요.'));
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(draft);
  };

  const total = result?.total ?? 0;
  const pages = result ? Math.max(1, Math.ceil(total / result.pageSize)) : 1;
  const go = (page: number) => setQuery((current) => ({ ...current, page }));

  return (
    <div className="aa-stack">
      <DataTable
        caption="학습자별 진도"
        hideCaption
        columns={progressColumns(timeZone)}
        rows={result?.rows ?? []}
        rowKey={(row) => `${row.learner}\u0000${row.videoId}`}
        toolbar={
          <form className="sa-row" onSubmit={submit} aria-label="거름">
            <Field label="영상 ID">
              <Input
                value={draft.videoId}
                maxLength={128}
                placeholder="전체 영상"
                onChange={(event) => setDraft({ ...draft, videoId: event.currentTarget.value })}
              />
            </Field>
            <Field label="학습자">
              <Input
                value={draft.learner}
                maxLength={64}
                placeholder="전체 학습자"
                onChange={(event) => setDraft({ ...draft, learner: event.currentTarget.value })}
              />
            </Field>
            <Segmented
              label="상태"
              value={query.filters.status}
              options={STATUS_OPTIONS}
              onChange={(value) => apply({ status: value })}
            />
            <Button icon={<DownloadIcon />} onClick={download}>
              CSV 내려받기
            </Button>
          </form>
        }
        empty={
          !result
            ? { title: '학습 기록을 불러오는 중이에요.' }
            : filtered
              ? {
                  title: '조건에 맞는 기록이 없어요.',
                  description: (
                    <Button size="sm" onClick={clear}>
                      거름 지우기
                    </Button>
                  ),
                }
              : {
                  title: '아직 학습 기록이 없어요.',
                  description:
                    '학습자가 강의 프리셋 영상을 보면 여기에 쌓여요. 로그인하지 않은 학습자의 기록은 그 브라우저에만 남아요.',
                }
        }
        after={
          total > 0 && result ? (
            <nav className="sa-pager" aria-label="쪽 넘김">
              <span className="sa-pager-total">기록 {total.toLocaleString('ko-KR')}개</span>
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
      <Status status={status} />
      <Status status={csvStatus} />
    </div>
  );
}

function progressColumns(timeZone: string): DataTableColumn<LmsProgressRow>[] {
  return [
    {
      key: 'learner',
      header: '학습자',
      render: (row) => {
        const { name, kind } = learner(row.learner);

        return (
          <span className="aa-stack">
            <span className="sa-name">{name}</span>
            {kind ? <span className="sa-small">{kind}</span> : null}
          </span>
        );
      },
    },
    { key: 'video', header: '영상', render: (row) => <code>{row.videoId}</code> },
    {
      key: 'percent',
      header: '진도율',
      render: (row) => {
        const percent = Math.floor(row.percent);

        return <Progress value={percent} caption={`${percent}%`} label={`진도율 ${percent}%`} />;
      },
    },
    {
      key: 'done',
      header: '완료',
      render: (row) =>
        row.completedAt ? (
          <span className="sa-row">
            <StatusBadge status="active" label="완료" />
            <span className="sa-small">{dateTime(row.completedAt, timeZone)}</span>
          </span>
        ) : (
          <span className="sa-badge">학습 중</span>
        ),
    },
    { key: 'active', header: '학습 시간', numeric: true, render: (row) => studyTime(row.activeSeconds) },
    {
      key: 'position',
      header: '마지막 위치',
      numeric: true,
      render: (row) => `${mediaTime(row.position)} / ${mediaTime(row.duration)}`,
    },
    {
      key: 'updated',
      header: '갱신',
      render: (row) => (
        <span className="sa-small" title={dateTime(row.updatedAt, timeZone)}>
          {ago(row.updatedAt)}
        </span>
      ),
    },
  ];
}

export interface LearnerName {
  name: string;
  kind: '' | '회원' | '외부 LMS';
}

/** `g:` is a GnuBoard member, `x:` an external LMS learner; the prefix is not shown. */
export function learner(id: string): LearnerName {
  if (id.startsWith('g:')) return { name: id.slice(2), kind: '회원' };

  if (id.startsWith('x:')) return { name: id.slice(2), kind: '외부 LMS' };

  return { name: id, kind: '' };
}

/** "1시간 2분", "12분 30초" or "45초". */
export function studyTime(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours) return `${hours}시간 ${minutes}분`;

  return minutes ? `${minutes}분 ${total % 60}초` : `${total % 60}초`;
}

/** "12:34", or "1:02:03" from an hour. */
export function mediaTime(seconds: number): string {
  const total = Math.floor(seconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;

  return hours ? `${hours}:${rest}` : rest;
}

/** "3분 전"; an unreadable time is "—". */
export function ago(value: string | null, now = Date.now()): string {
  const time = value ? new Date(value).getTime() : Number.NaN;
  if (Number.isNaN(time)) return '—';

  const minutes = Math.floor(Math.max(0, now - time) / 60_000);
  if (minutes < 1) return '방금 전';

  if (minutes < 60) return `${minutes}분 전`;

  return minutes < 1440 ? `${Math.floor(minutes / 60)}시간 전` : `${Math.floor(minutes / 1440)}일 전`;
}

function parts(value: string, timeZone: string): Record<string, string> | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const options: Intl.DateTimeFormatOptions = {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  let list: Intl.DateTimeFormatPart[];

  try {
    list = new Intl.DateTimeFormat('en-US', { ...options, timeZone }).formatToParts(date);
  } catch {
    list = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  }

  return Object.fromEntries(list.map((part) => [part.type, part.value]));
}

/** "10월 21일 17:25" in the site's time zone, or "—". */
export function dateTime(value: string | null, timeZone: string): string {
  const date = value ? parts(value, timeZone) : null;

  return date ? `${date.month}월 ${date.day}일 ${date.hour}:${date.minute}` : '—';
}

/** "17:25" in the site's time zone. */
function clock(value: string, timeZone: string): string {
  const date = parts(value, timeZone);

  return date ? `${date.hour}:${date.minute}` : value;
}
