import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  type DraftResponse,
  loadDraft,
  publishDraft,
  saveDraft,
  saveVideoContext,
  searchTargets,
  type TargetChoice,
} from '../api/actions';
import {
  type AdBreak,
  breakRank,
  editorPayload,
  type EditorRecord,
  SCHEDULE_MODES,
  type ScheduleMode,
  type Target,
  TARGET_TYPES,
  type TargetType,
  videoIdProblem,
} from '../api/model';
import { useConfirm } from '../app/confirm';
import { type ErrorReport, failure, IDLE, info, Status, type Notice } from '../app/status';
import { PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import { Button, Card, Field, Input, Panel, Select, StatusBadge } from '../components';
import { HelpLink } from '../help';
import { BreakEditor, type FocusRequest } from './BreakEditor';
import { PlaybackPanel } from './PlaybackPanel';

const TARGET_NAMES = { site: '사이트', board: '게시판', category: '분류', video: '영상' } satisfies Record<
  TargetType,
  string
>;

const MODE_HELP = {
  inherit: '이 대상의 직접 편성 대신 상위 게시 설정을 따라요.',
  replace: '상위 편성과 합치지 않고 아래 편성 전체로 대체해요.',
  disabled: '이 대상의 광고를 끄고 상위 편성으로의 대체도 중단해요. 게시해야 적용돼요.',
} satisfies Record<ScheduleMode, string>;

const TARGET_ID_INPUT = 'aa-schedule-target-id';
const TARGET_BLOCKED = '편성을 불러오지 못했어요. 고정 대상 ID를 확인해 주세요.';

interface TargetForm {
  type: TargetType;
  boardId: string;
  targetId: string;
  query: string;
  choice: string;
}

export function ScheduleScreen({
  titleId,
  title,
  activation,
}: {
  titleId: string;
  title: string;
  /** The menu's current activation; `null` while hidden. */
  activation: number | null;
}) {
  const { api, session, creatives, creativesState, reloadCreatives, run, setDirty } = useWorkspace();
  const confirm = useConfirm();
  const manualTargets = session.capabilities.manualTargets;
  const standalone = session.capabilities.host === 'standalone';
  const siteId = session.site.siteId;

  const [targetForm, setTargetForm] = useState<TargetForm>({
    type: 'site',
    boardId: '',
    targetId: siteId,
    query: '',
    choice: '',
  });
  const [choices, setChoices] = useState<TargetChoice[]>([]);
  const [targetStatus, setTargetStatus] = useState<Notice>(IDLE);
  /** Blocking error on the fixed target ID: a contract 4.1 video ID check or the server's `target.id` message. */
  const [targetIdError, setTargetIdError] = useState('');

  const [draft, setDraft] = useState<EditorRecord | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [resolvedFrom, setResolvedFrom] = useState<Target | null>(null);
  /** Video names this screen has seen (host search, saved video context), for the preview's content title. */
  const [videoNames, setVideoNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [dirty, setScheduleDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<Notice>(IDLE);
  // Bumps on every draft edit or reload so a prepared preview can tell it is stale.
  const [revisionKey, setRevisionKey] = useState(0);
  const focus = useFocusAfterRender();

  useEffect(() => setDirty('schedule', dirty), [dirty, setDirty]);

  const manual = manualTargets || targetForm.type === 'site';

  const acceptDraft = useCallback((data: DraftResponse) => {
    setDraft(structuredClone(data.draft));
    setPublishedVersion(data.publishedVersion);
    setResolvedFrom(data.resolvedFrom);
    setScheduleDirty(false);
    setRevisionKey((key) => key + 1);
  }, []);

  const changeDraft = (mutate: (record: EditorRecord) => void) => {
    setDraft((current) => {
      if (!current) return current;

      const next = structuredClone(current);

      mutate(next);
      return next;
    });
    setScheduleDirty(true);
    setRevisionKey((key) => key + 1);
  };

  const changeBreaks = (mutate: (breaks: AdBreak[]) => void) => changeDraft((record) => mutate(record.breaks));

  const sortBreaks = () =>
    setDraft((current) =>
      current ? { ...current, breaks: [...current.breaks].sort((a, b) => breakRank(a) - breakRank(b)) } : current
    );

  const nameVideos = (names: readonly (readonly [string, string])[]) =>
    setVideoNames((current) => new Map([...current, ...names.filter(([, label]) => label.trim() !== '')]));

  const updateTarget = (patch: Partial<TargetForm>) => setTargetForm((current) => ({ ...current, ...patch }));

  const blockTarget = (message: string) => {
    setTargetIdError(message);
    setTargetStatus(failure(TARGET_BLOCKED));
    focus({ selector: `#${TARGET_ID_INPUT}` });
  };

  const resetChoices = () => {
    setChoices([]);
    updateTarget({ choice: '' });
  };

  const selectedTarget = (): Target => {
    const input = targetForm;

    if (!manual) {
      const choice = input.choice === '' ? undefined : choices[Number(input.choice)];
      if (!choice) throw new Error('호스트에서 확인된 대상을 검색해 선택해 주세요.');

      return structuredClone(choice.target);
    }

    const id = input.targetId.trim();
    const boardId = input.boardId.trim();

    if (!id || id.length > 128) throw new Error('128자 이내의 고정 대상 ID를 입력해 주세요.');

    if (input.type === 'category' && !boardId) throw new Error('분류 소속 게시판 ID를 입력해 주세요.');

    return input.type === 'category' ? { type: input.type, id, boardId } : { type: input.type, id };
  };

  const fetchDraft = async (target: Target) => {
    acceptDraft(await loadDraft(api, target));
    setConflict(false);
    setScheduleStatus(IDLE);
  };

  const search = () =>
    void run(setTargetStatus, async () => {
      const boardId = targetForm.boardId.trim();
      if (targetForm.type === 'category' && !boardId) throw new Error('분류를 검색할 게시판 ID를 입력해 주세요.');

      const items = await searchTargets(api, {
        type: targetForm.type,
        query: targetForm.query.trim(),
        // An empty query value is left out of the URL.
        boardId,
      });

      setChoices(items);
      updateTarget({ choice: '' });
      nameVideos(
        items.filter((item) => item.target.type === 'video').map((item) => [item.target.id, item.label] as const)
      );
      setTargetStatus(
        info(
          items.length
            ? `${items.length}개 대상이 있어요. 선택한 뒤 편성을 불러와 주세요.`
            : '검색 결과가 없어요. 검색어나 게시판을 확인해 주세요.'
        )
      );
    });

  const discardEdits = () =>
    confirm({
      title: '편집 내용을 버릴까요?',
      body: '저장하지 않은 편집 내용이 있어요. 편성을 다시 불러오면 지금 입력이 사라져요.',
      confirmLabel: '불러오기',
      danger: true,
    });

  const load = async (event: FormEvent) => {
    event.preventDefault();

    const idProblem = manual && targetForm.type === 'video' ? videoIdProblem(targetForm.targetId.trim()) : null;

    if (idProblem) {
      blockTarget(idProblem);
      return;
    }

    if (dirty && !(await discardEdits())) return;

    void run(
      setTargetStatus,
      async () => {
        await fetchDraft(selectedTarget());
        setTargetStatus(info('편성을 불러왔어요. 초안과 현재 게시본은 따로 관리돼요.'));
      },
      {
        onError: (report: ErrorReport) => {
          const message = manual ? report.fields['target.id'] : undefined;

          if (message) blockTarget(message);
        },
      }
    );
  };

  const onConflict = { onError: (report: { conflict: boolean }) => report.conflict && setConflict(true) };

  const save = (event: FormEvent) => {
    event.preventDefault();

    if (!draft) return;

    void run(
      setScheduleStatus,
      async () => {
        const data = await saveDraft(api, editorPayload(draft));

        acceptDraft(data);
        setConflict(false);
        setScheduleStatus(info(`초안 r${data.draft.revision}을 저장했어요. 현재 게시본은 바뀌지 않았어요.`));
      },
      onConflict
    );
  };

  const publish = async () => {
    if (!draft || dirty || !draft.revision) return;

    const accepted = await confirm({
      title: `초안 r${draft.revision}을 게시할까요?`,
      body: '게시하면 새 재생 세션부터 이 편성이 적용돼요. 이미 재생 중인 세션은 기존 편성을 유지해요.',
      confirmLabel: '게시',
    });
    if (!accepted) return;

    void run(
      setScheduleStatus,
      async () => {
        const result = await publishDraft(api, draft.target, draft.revision);

        setPublishedVersion(result.scheduleVersion);
        setConflict(false);
        setScheduleStatus(
          info(`게시 v${result.scheduleVersion}이 적용됐어요. 이미 재생 중인 세션은 기존 편성을 유지해요.`)
        );

        try {
          acceptDraft(await loadDraft(api, draft.target));
        } catch {
          setScheduleStatus(
            failure(
              `게시 v${result.scheduleVersion}은 완료됐지만 최신 초안을 다시 읽지 못했어요. 연결을 확인하고 다시 불러와 주세요.`
            )
          );
        }
      },
      onConflict
    );
  };

  const reloadConflict = async () => {
    if (!draft || !(await discardEdits())) return;

    void run(setScheduleStatus, async () => {
      await fetchDraft(draft.target);
      setScheduleStatus(info('서버 초안을 다시 불러왔어요.'));
    });
  };

  const showContext = standalone && manualTargets && targetForm.type === 'video';

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description="사이트 → 게시판 → 분류 → 영상. 더 구체적인 게시 설정이 우선해요. 초안 저장만으로는 노출이 바뀌지 않아요."
      />

      <Panel
        title="편집할 대상"
        onSubmit={(event) => void load(event)}
        footer={
          <>
            {manual ? null : <Button onClick={search}>대상 검색</Button>}
            <Button type="submit" variant="primary">
              편성 불러오기
            </Button>
          </>
        }
      >
        <div className="aa-form-grid">
          <Field label="적용 단위" labelAside={<HelpLink termId="target-scope" />}>
            <Select
              value={targetForm.type}
              onChange={(event) => {
                const value = event.currentTarget.value;
                const type = TARGET_TYPES.find((item) => item === value) ?? 'site';

                setTargetForm((current) => ({ ...current, type, targetId: type === 'site' ? siteId : '', choice: '' }));
                setChoices([]);
                setTargetIdError('');
              }}
            >
              <option value="site">사이트 기본</option>
              <option value="board">게시판</option>
              <option value="category">분류</option>
              <option value="video">개별 영상</option>
            </Select>
          </Field>
          {targetForm.type === 'category' ? (
            <Field label="분류 소속 게시판 ID">
              <Input
                required
                maxLength={128}
                value={targetForm.boardId}
                onChange={(event) => {
                  updateTarget({ boardId: event.currentTarget.value });
                  resetChoices();
                }}
              />
            </Field>
          ) : null}
          {manual ? (
            <Field
              id={TARGET_ID_INPUT}
              label="고정 대상 ID"
              help={targetForm.type === 'site' ? '사이트 기본 편성은 이 사이트 ID로 고정돼요.' : undefined}
              error={targetIdError}
            >
              <Input
                required
                maxLength={128}
                readOnly={targetForm.type === 'site'}
                value={targetForm.targetId}
                onChange={(event) => {
                  updateTarget({ targetId: event.currentTarget.value });
                  setTargetIdError('');
                }}
              />
            </Field>
          ) : (
            <>
              <Field label="대상 검색">
                <Input
                  type="search"
                  placeholder="이름 또는 ID"
                  value={targetForm.query}
                  onChange={(event) => updateTarget({ query: event.currentTarget.value })}
                />
              </Field>
              <Field label="검색 결과">
                <Select
                  required
                  value={targetForm.choice}
                  onChange={(event) => updateTarget({ choice: event.currentTarget.value })}
                >
                  <option value="">{choices.length ? '대상을 선택해 주세요' : '먼저 대상을 검색해 주세요'}</option>
                  {choices.map((choice, index) => (
                    <option
                      key={`${choice.target.type}:${choice.target.boardId ?? ''}:${choice.target.id}`}
                      value={index}
                    >
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
        <Status status={targetStatus} />
      </Panel>
      {showContext ? <VideoContextForm onSaved={(videoId, label) => nameVideos([[videoId, label]])} /> : null}

      {draft ? (
        <form className="aa-stack" onSubmit={save} aria-label="광고 편성 편집">
          <Card
            title={`${TARGET_NAMES[draft.target.type]} · ${draft.target.id}${draft.target.boardId ? ` / 게시판 ${draft.target.boardId}` : ''}`}
            actions={
              <div className="sa-row">
                {publishedVersion ? (
                  <StatusBadge status="active" label={`게시 v${publishedVersion}`} />
                ) : (
                  <StatusBadge status="archived" label="게시본 없음" />
                )}
                <HelpLink termId="publish-version" />
                {dirty ? (
                  <StatusBadge status="pending" label="저장하지 않은 변경" />
                ) : (
                  <StatusBadge
                    status="draft"
                    label={draft.revision ? `저장된 초안 r${draft.revision}` : '저장 전 초안'}
                  />
                )}
                <HelpLink termId="draft-revision" />
              </div>
            }
          >
            <div className="aa-stack">
              <p className="sa-small">
                {resolvedFrom
                  ? `현재 게시 설정 출처: ${TARGET_NAMES[resolvedFrom.type]} ${resolvedFrom.id}`
                  : '현재 적용되는 게시 편성이 없어요.'}
              </p>
              <Field label="이 대상의 광고" labelAside={<HelpLink termId={draft.mode} />} help={MODE_HELP[draft.mode]}>
                <Select
                  value={draft.mode}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    const mode = SCHEDULE_MODES.find((item) => item === value);

                    if (mode) changeDraft((record) => (record.mode = mode));
                  }}
                >
                  <option value="inherit" disabled={draft.target.type === 'site'}>
                    상위 설정 상속
                  </option>
                  <option value="replace">직접 편성 · 전체 대체</option>
                  <option value="disabled">광고 비활성화 · 상속 중단</option>
                </Select>
              </Field>
            </div>
          </Card>

          {draft.mode === 'replace' ? (
            <BreakEditor
              breaks={draft.breaks}
              creatives={creatives}
              creativesState={creativesState}
              reloadCreatives={() =>
                void run(setScheduleStatus, async () => {
                  const items = await reloadCreatives();

                  setScheduleStatus(info(`소재 ${items.length}개를 다시 불러왔어요.`));
                })
              }
              change={changeBreaks}
              sort={sortBreaks}
              focus={focus}
              message={(text, error = false) => setScheduleStatus(error ? failure(text) : info(text))}
            />
          ) : null}

          <div className="sa-card aa-between aa-savebar">
            <span className="sa-small">
              {dirty ? '변경 내용을 저장한 뒤 게시해 주세요.' : '초안 저장만으로는 노출이 바뀌지 않아요.'}{' '}
              <HelpLink termId="draft" />
            </span>
            <div className="sa-row">
              <Button type="submit">초안 저장</Button>
              <Button
                variant="primary"
                disabledReason={
                  dirty ? '먼저 초안을 저장해 주세요.' : !draft.revision ? '저장한 초안이 없어요.' : undefined
                }
                onClick={() => void publish()}
              >
                저장한 초안 게시
              </Button>
              <HelpLink termId="publish" />
            </div>
          </div>
          <Status status={scheduleStatus} />
          {conflict ? (
            <div className="sa-row">
              <Button onClick={() => void reloadConflict()}>서버 초안 다시 불러오기</Button>
              <HelpLink termId="revision-conflict" />
            </div>
          ) : null}
        </form>
      ) : null}

      <PlaybackPanel draft={draft} videoNames={videoNames} revisionKey={revisionKey} activation={activation} />
    </>
  );
}

function VideoContextForm({ onSaved }: { onSaved: (videoId: string, label: string) => void }) {
  const { api, run } = useWorkspace();
  const [values, setValues] = useState({ videoId: '', label: '', boardId: '', categoryId: '' });
  const [status, setStatus] = useState<Notice>(IDLE);
  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: { currentTarget: HTMLInputElement }) => {
      const value = event.currentTarget.value;

      setValues((current) => ({ ...current, [key]: value }));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(setStatus, async () => {
      const input = {
        videoId: values.videoId.trim(),
        label: values.label.trim(),
        boardId: values.boardId.trim(),
        categoryId: values.categoryId.trim(),
      };
      if (input.categoryId && !input.boardId) throw new Error('분류를 지정하려면 게시판 ID도 입력해 주세요.');

      await saveVideoContext(api, {
        videoId: input.videoId,
        label: input.label,
        boardId: input.boardId || null,
        categoryId: input.categoryId || null,
      });
      onSaved(input.videoId, input.label);
      setStatus(info('영상 소속을 저장했어요. 새 재생 세션부터 이 소속으로 편성을 찾아요.'));
    });
  };

  return (
    <details className="sa-card">
      <summary className="sa-label">독립 설치 영상의 게시판·분류 연결</summary>
      <form className="sa-panel" onSubmit={submit} aria-label="영상 소속 연결">
        <p className="sa-help">
          고정 영상 ID에 소속을 등록해야 게시판·분류 편성이 적용돼요. 실제 영상 주소와는 별개의 ID예요.{' '}
          <HelpLink termId="video-context" />
        </p>
        <div className="aa-form-grid">
          <Field label="영상 ID">
            <Input required maxLength={128} {...field('videoId')} />
          </Field>
          <Field label="영상 이름">
            <Input required maxLength={200} {...field('label')} />
          </Field>
          <Field label="게시판 ID">
            <Input maxLength={128} {...field('boardId')} />
          </Field>
          <Field label="분류 ID" help="분류를 지정하려면 게시판 ID도 입력해요.">
            <Input maxLength={128} {...field('categoryId')} />
          </Field>
        </div>
        <div className="sa-row">
          <Button type="submit">영상 소속 저장</Button>
        </div>
        <Status status={status} />
      </form>
    </details>
  );
}

/** Queues a focus target for after React commits the change that renders it. */
function useFocusAfterRender(): (request: FocusRequest) => void {
  const pending = useRef<FocusRequest | null>(null);

  useEffect(() => {
    const request = pending.current;
    if (!request) return;

    pending.current = null;
    focusTarget(request)?.focus();
  });

  return useCallback((request: FocusRequest) => {
    pending.current = request;
  }, []);
}

function focusTarget(request: FocusRequest): HTMLElement | null {
  if ('element' in request) return request.element.isConnected ? request.element : null;

  const { selector, breakId, itemId } = request;
  const scope =
    itemId !== undefined
      ? byData('[data-item-id]', (element) => element.dataset.itemId === itemId)
      : breakId !== undefined
        ? byData('[data-break-id]', (element) => element.dataset.breakId === breakId)
        : document;

  return scope?.querySelector<HTMLElement>(selector) ?? null;
}

function byData(selector: string, matches: (element: HTMLElement) => boolean): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(matches) ?? null;
}
