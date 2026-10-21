import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deletePlayerPreset,
  MAX_SAVED_PRESETS,
  type PresetEntry,
  type PresetList,
  playerPresets,
  savePlayerPreset,
  setDefaultPlayerPreset,
} from '../api/presets';
import { useConfirm } from '../app/confirm';
import { useLayoutWidth } from '../app/media-query';
import { hrefFor, type PlayerPage, playerHref, playerPath } from '../app/routes';
import { failure, IDLE, info, Status, type Notice } from '../app/status';
import { PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import { Button, ButtonLink, DataTable, type DataTableColumn, Note, PresetMark, SubNav } from '../components';
import { HelpLink } from '../help';
import { parsePlayerPreset, type PlayerPreset, ThemePreview } from '../player';
import { ApplyConfirm, languageLabel, PLAYER_TYPE_LABELS } from './ApplyConfirm';
import { LmsMock } from './LmsMock';
import { LIST_PLANNED, PlannedNote } from './planned';
import { PlayerOptions } from './PlayerOptions';
import { PlayerPreviewCard } from './PlayerPreviewCard';
import { initialSetupForm, ListState, PlayerSetup, type SetupForm } from './PlayerSetup';
import {
  BLANK_FORM,
  duplicateForm,
  type FieldErrors,
  fieldErrors,
  type FormConflict,
  formFromPreset,
  PRESET_CONFLICT_TEXT,
  PRESET_LIST_CONFLICT_TEXT,
  isPresetPath,
  needsListReload,
  PRESET_FIELD_LABELS,
  presetError,
  type PresetForm,
  presetInput,
  type PresetPath,
  previewPreset,
  rebaseForm,
  updateForm,
} from './preset-form';
import { PresetEditor, presetFieldId, presetSectionId, presetSectionOf } from './PresetEditor';
import { PresetPreviewDialog } from './PresetPreviewDialog';

/** Unsaved editor state. Drafts outlive their page, so moving between menus and pages keeps input. */
interface Draft {
  form: PresetForm;
  dirty: boolean;
  /** The form that counts as unchanged; `null` for a copy, which is unsaved from the start. */
  clean: PresetForm | null;
  /** After a save attempt, local schema errors show on their fields. */
  checked: boolean;
  /** Paths the API rejected (422); cleared when that field changes. */
  serverErrors: FieldErrors;
  /** The last form state that passed the schema; the live preview keeps it while the form is invalid. */
  preview: PlayerPreset | null;
  /** Fields changed here and in a save elsewhere; saving waits until the operator picks a side. */
  conflicts: readonly FormConflict[];
}

type DraftKey = 'new' | `edit:${string}`;

const BUILT_IN_REASON = '내장 프리셋은 바꿀 수 없어요. 복제해서 쓰세요.';
const LIMIT_REASON = `저장 프리셋은 ${MAX_SAVED_PRESETS}개까지예요. 쓰지 않는 프리셋을 지운 뒤 만들어 주세요.`;
const LOADING_TEXT = '프리셋 목록을 불러오고 있어요.';
const APPLIED_REASON = '이미 사이트에 적용된 프리셋이에요.';
/**
 * A migration note was confirmed for this set of presets; a later migration of other presets shows it again. Each note
 * keeps its own key, so confirming one leaves the other.
 */
const MIGRATION_SEEN_KEY = 'aa-players-migrated-neutral';
const LABELS_SEEN_KEY = 'aa-players-migrated-labels';
const FIELD_ORDER = Object.keys(PRESET_FIELD_LABELS).filter(isPresetPath);

function draftOf(form: PresetForm, dirty = false): Draft {
  return {
    form,
    dirty,
    clean: dirty ? null : form,
    checked: false,
    serverErrors: {},
    preview: previewPreset(form),
    conflicts: [],
  };
}

const CONFLICT_REASON = '다른 곳에서도 바꾼 항목이 있어요. 어느 값을 쓸지 먼저 골라 주세요.';

/**
 * The draft moved onto the server's current form, or `null` when the server form is the one the draft started from. A
 * copy has no server form and never moves.
 */
function rebased(draft: Draft, server: PresetForm): { draft: Draft; text: string } | null {
  if (!draft.clean || sameForm(draft.clean, server)) return null;

  const { form, adopted, conflicts } = rebaseForm(draft.form, draft.clean, server);
  const names = (paths: readonly PresetPath[]) => paths.map((path) => PRESET_FIELD_LABELS[path]).join(', ');
  const text = [
    '다른 곳에서 이 프리셋을 먼저 저장했어요.',
    adopted.length ? `그쪽에서 바꾼 값(${names(adopted)})을 입력에 반영했어요.` : '',
    conflicts.length
      ? `양쪽에서 바꾼 항목(${names(conflicts.map(({ path }) => path))})은 어느 값을 쓸지 골라 주세요.`
      : '확인한 뒤 다시 저장해 주세요.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    draft: {
      ...draft,
      form,
      clean: server,
      dirty: !sameForm(form, server),
      conflicts,
      preview: previewPreset(form) ?? draft.preview,
    },
    text,
  };
}

function sameForm(a: PresetForm, b: PresetForm): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function editKey(id: string): DraftKey {
  return `edit:${id}`;
}

const SUB_PAGES = [
  { page: { page: 'list' }, label: '프리셋 목록' },
  { page: { page: 'setup' }, label: '초기 설정 방법' },
  { page: { page: 'options' }, label: '옵션 설명' },
] satisfies { page: PlayerPage; label: string }[];

export interface PlayersScreenProps {
  titleId: string;
  title: string;
  /** The active page; `null` while another menu is shown (the last page stays rendered, hidden). */
  page: PlayerPage | null;
  /** The menu's current activation; `null` while hidden. The live preview is unmounted then. */
  activation: number | null;
}

/** Contract 3.2 and schema v2: presets, the site-applied preset, setup guide and option reference under `#/players`. */
export function PlayersScreen({ titleId, title, page, activation }: PlayersScreenProps) {
  const { api, session, publicBase, run, busy, setDirty } = useWorkspace();
  const width = useLayoutWidth();
  const confirm = useConfirm();
  const [lastPage, setLastPage] = useState<PlayerPage>(page ?? { page: 'list' });
  const [list, setList] = useState<PresetList | null>(null);
  const [listError, setListError] = useState('');
  const [listRequest, setListRequest] = useState(0);
  // A later visit reads the list again; a failure keeps the list on screen and says it may be old.
  const [stale, setStale] = useState(false);
  const latestRefresh = useRef(0);
  const [drafts, setDrafts] = useState<Partial<Record<DraftKey, Draft>>>({});
  const [listStatus, setListStatus] = useState<Notice>(IDLE);
  const [editStatus, setEditStatus] = useState<Notice>(IDLE);
  const [reloadable, setReloadable] = useState(false);
  const [applyId, setApplyId] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<Notice>(IDLE);
  // The list's "미리보기" dialog. It shows the list's current saved values, or these if a reload removed the preset.
  const [previewing, setPreviewing] = useState<PresetEntry | null>(null);
  const previewClosed = useRef<{ id: string; name: string } | null>(null);
  const [migrationSeen, setMigrationSeen] = useState(() => readMigrationSeen(MIGRATION_SEEN_KEY));
  const [labelsSeen, setLabelsSeen] = useState(() => readMigrationSeen(LABELS_SEEN_KEY));
  const [setup, setSetup] = useState<SetupForm>(() => initialSetupForm(publicBase));
  const focusPath = useRef<PresetPath | null>(null);
  const focusTitle = useRef(false);
  // After "사이트에 적용" the row's trigger is disabled; focus goes to the row's 수정, or 복제 for a built-in preset.
  const focusRow = useRef<string | null>(null);
  const firstPage = useRef(true);
  const seenActivation = useRef(activation);

  if (page && playerPath(page) !== playerPath(lastPage)) setLastPage(page);

  const shown = page ?? lastPage;
  const shownPath = playerPath(shown);
  const visible = page !== null;

  // Leaving the list (another menu or page) closes the preview; coming back does not open it again.
  if (previewing && (activation === null || shown.page !== 'list')) setPreviewing(null);

  // The option reference is static; only the other pages read presets.
  const needsList = shown.page !== 'options';
  // A draft for a preset deleted elsewhere still counts: its page offers to keep it as a new preset or drop it.
  const dirty = Object.values(drafts).some((draft) => draft?.dirty);
  const orphans = list
    ? Object.entries(drafts).flatMap(([key, draft]) => {
        const id = key.startsWith('edit:') ? key.slice('edit:'.length) : null;

        return id && draft?.dirty && !list.presets.some((entry) => entry.preset.id === id) ? [{ id, draft }] : [];
      })
    : [];

  useEffect(() => setDirty('players', dirty), [dirty, setDirty]);

  useEffect(() => {
    if (!needsList || list) return;

    let current = true;

    // A read needs no admin token, so it does not take the single-operation lock.
    playerPresets(api).then(
      (next) => {
        if (current) setList(next);
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- whatever the failed read threw.
      (error: unknown) => {
        if (current) setListError(presetErrorMessage(error));
      }
    );

    return () => {
      current = false;
    };
  }, [api, needsList, list, listRequest]);

  // Only the latest refresh lands; state changes only once its response is in.
  const refreshList = useCallback(() => {
    latestRefresh.current += 1;
    const request = latestRefresh.current;

    playerPresets(api).then(
      (next) => {
        if (request !== latestRefresh.current) return;

        // A write that landed meanwhile already set a newer list.
        setList((shownList) => (shownList && shownList.revision > next.revision ? shownList : next));
        setStale(false);
      },
      () => {
        if (request === latestRefresh.current) setStale(true);
      }
    );
  }, [api]);

  useEffect(() => {
    if (activation === null || activation === seenActivation.current) return;

    seenActivation.current = activation;

    if (list && needsList) refreshList();
  }, [activation, list, needsList, refreshList]);

  // After a page change inside the menu, move focus to the page heading; after a failed save, to the first bad field.
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }

    if (visible) document.getElementById(`${titleId}-page`)?.focus();
  }, [shownPath, visible, titleId]);

  // After a write the main area was inert, and a conflict choice removes its buttons: focus goes to the first bad or
  // settled field, or else back to the page heading.
  useEffect(() => {
    if (busy) return;

    const path = focusPath.current;
    const title = focusTitle.current;
    const row = focusRow.current;

    focusPath.current = null;
    focusTitle.current = false;
    focusRow.current = null;

    if (row) {
      const rowButton = [presetButtonId('edit', row), presetButtonId('dup', row)]
        .map((id) => document.getElementById(id))
        .find((button) => button instanceof HTMLButtonElement && !button.disabled);
      if (rowButton) return rowButton.focus();
    }

    const field = path ? fixTarget(path) : null;

    // A field the current player type hides falls back to the page heading.
    if (field) field.focus();
    else if (path || title) document.getElementById(`${titleId}-page`)?.focus();
  });

  // After the preview closes, focus goes to its "미리보기" button; if a reload removed that row meanwhile, to the button
  // of a row with the same name, and otherwise to the list heading.
  useEffect(() => {
    const closed = previewClosed.current;
    if (!closed) return;

    previewClosed.current = null;

    const label = `${closed.name} 미리보기`;
    const sameName = [...document.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === label
    );

    (
      document.getElementById(presetButtonId('preview', closed.id)) ??
      sameName ??
      document.getElementById(`${titleId}-page`)
    )?.focus();
  });

  const listNotice = listError || LOADING_TEXT;
  const savedCount = list ? list.presets.filter((entry) => !entry.meta.builtIn).length : 0;
  const full = savedCount >= MAX_SAVED_PRESETS;

  const go = (next: PlayerPage) => {
    window.location.assign(playerHref(next));
  };

  const retryList = () => {
    setListError('');
    setListRequest((count) => count + 1);
  };

  const onConflict = (setStatus: (status: Notice) => void, text: string) => ({
    onError: (report: { conflict: boolean }) => {
      if (!report.conflict) return;

      setReloadable(true);
      setStatus(failure(text));
    },
  });

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- whatever the failed write threw.
  const presetFailure = (error: unknown) => {
    const mapped = presetError(error);

    if (needsListReload(mapped.error)) setReloadable(true);

    return mapped;
  };

  const write = (setStatus: (status: Notice) => void, task: () => Promise<void>, conflictText: string) => {
    focusTitle.current = true;
    void run(setStatus, task, onConflict(setStatus, conflictText));
  };

  /** Moves the preset's draft onto its entry in `next`; returns what changed, or `null` when nothing did. */
  const rebaseOnto = (next: PresetList, id: string): string | null => {
    const key = editKey(id);
    const draft = drafts[key];
    const entry = next.presets.find((candidate) => candidate.preset.id === id);
    const result = draft && entry ? rebased(draft, formFromPreset(entry.preset)) : null;
    if (!result) return null;

    setDrafts((current) => ({ ...current, [key]: result.draft }));
    return result.text;
  };

  const resolve = (key: DraftKey, choice: 'mine' | 'theirs') => {
    const conflicts = drafts[key]?.conflicts ?? [];

    // The choice buttons go away with the conflict; focus moves to the first field it settled.
    focusPath.current =
      FIELD_ORDER.find((path) => conflicts.some((conflict) => conflict.path === path)) ?? conflicts[0]?.path ?? null;
    setDrafts((current) => {
      const draft = current[key];
      if (!draft) return current;

      const form =
        choice === 'theirs'
          ? draft.conflicts.reduce((next, { path, theirs }) => updateForm(next, path, theirs), draft.form)
          : draft.form;

      return {
        ...current,
        [key]: {
          ...draft,
          form,
          conflicts: [],
          dirty: draft.clean === null || !sameForm(form, draft.clean),
          preview: previewPreset(form) ?? draft.preview,
        },
      };
    });
    setEditStatus(
      info(
        choice === 'theirs'
          ? '다른 곳에서 저장한 값으로 바꿨어요.'
          : '내 입력을 쓰기로 했어요. 저장하면 다른 곳에서 바꾼 값을 덮어써요.'
      )
    );
  };

  const reloadList = (setStatus: (status: Notice) => void, inEditor: boolean) => {
    focusTitle.current = true;
    void run(setStatus, async () => {
      const next = await playerPresets(api);
      const created = inEditor ? createdMeanwhile(list, next, drafts.new) : undefined;
      const moved = inEditor && shown.page === 'edit' ? rebaseOnto(next, shown.presetId) : null;

      setList(next);
      setStale(false);
      setReloadable(false);
      setStatus(
        info(
          created
            ? `프리셋 목록을 다시 불러왔어요. "${created}" 프리셋이 새로 생겼어요. 앞서 시간이 초과된 저장이 반영됐을 수 있으니 목록에서 확인한 뒤 필요할 때만 저장해 주세요.`
            : moved
              ? `프리셋 목록을 다시 불러왔어요. ${moved}`
              : inEditor
                ? '프리셋 목록을 다시 불러왔어요. 입력은 그대로예요. 확인한 뒤 다시 저장해 주세요.'
                : '프리셋 목록을 다시 불러왔어요.'
        )
      );
    });
  };

  const change = (key: DraftKey, base: Draft, path: PresetPath, value: string) =>
    setDrafts((current) => {
      const draft = current[key] ?? base;
      const form = updateForm(draft.form, path, value);
      const serverErrors = { ...draft.serverErrors };

      delete serverErrors[path];

      return {
        ...current,
        [key]: {
          ...draft,
          form,
          dirty: draft.clean === null || !sameForm(form, draft.clean),
          serverErrors,
          preview: previewPreset(form) ?? draft.preview,
        },
      };
    });

  const save = (key: DraftKey, draft: Draft, invalidColors: readonly PresetPath[]) => {
    if (draft.conflicts.length) return setEditStatus(failure(CONFLICT_REASON));

    const parsed = parsePlayerPreset(presetInput(draft.form));

    // A color field showing a format error still holds its last valid value; saving that would not be what is shown.
    if (!parsed.ok || invalidColors.length) {
      const fields: FieldErrors = parsed.ok ? {} : fieldErrors(parsed.errors).fields;

      focusPath.current = FIELD_ORDER.find((path) => fields[path] || invalidColors.includes(path)) ?? null;
      setDrafts((current) => ({ ...current, [key]: { ...draft, checked: true } }));
      setEditStatus(failure('저장하지 못했어요. 표시한 항목을 확인해 주세요.'));
      return;
    }

    if (!list) return;

    // The list may be newer than the draft (a reload, a later visit or another save); never save over those changes.
    const presetId = key === 'new' ? null : key.slice('edit:'.length);
    const moved = presetId === null ? null : rebaseOnto(list, presetId);
    if (moved) return setEditStatus(info(moved));

    const revision = list.revision;

    write(
      setEditStatus,
      async () => {
        let result;

        try {
          result = await savePlayerPreset(api, { preset: parsed.preset, revision });
        } catch (error) {
          const mapped = presetFailure(error);
          const paths = FIELD_ORDER.filter((path) => mapped.fields[path]);

          if (paths.length) {
            focusPath.current = paths[0] ?? null;
            setDrafts((current) => ({ ...current, [key]: { ...draft, checked: true, serverErrors: mapped.fields } }));
          }

          throw mapped.error;
        }

        const id = result.saved.preset.id;

        setList(result.list);
        setReloadable(false);
        setDrafts(({ [key]: _saved, ...rest }) => rest);
        setEditStatus(
          info(
            `"${result.saved.preset.name}" 프리셋을 저장했어요. 이 프리셋을 쓰는 페이지를 새로고침하면 바뀐 플레이어가 보여요.`
          )
        );

        if (key === 'new' && id) go({ page: 'edit', presetId: id });
      },
      PRESET_CONFLICT_TEXT
    );
  };

  const confirmReplaceNew = async (body: string, confirmLabel: string) =>
    !drafts.new?.dirty || confirm({ title: '작성 중인 새 프리셋을 바꿀까요?', body, confirmLabel, danger: true });

  /** Moves the input for a preset deleted elsewhere to the new-preset page. */
  const keepAsNew = async (id: string, draft: Draft) => {
    if (
      !(await confirmReplaceNew(
        '새 프리셋에 저장하지 않은 입력이 있어요. 옮기면 그 입력 대신 이 입력이 들어가요.',
        '옮기기'
      ))
    ) {
      return;
    }

    setDrafts(({ [editKey(id)]: _moved, ...rest }) => ({
      ...rest,
      new: {
        ...draft,
        form: { ...draft.form, id: null },
        dirty: true,
        clean: null,
        checked: false,
        serverErrors: {},
        conflicts: [],
      },
    }));
    setEditStatus(info('입력한 값을 새 프리셋으로 옮겼어요. 이름을 확인하고 저장해 주세요.'));
    go({ page: 'new' });
  };

  const dropDraft = async (id: string) => {
    const accepted = await confirm({
      title: '입력을 버릴까요?',
      body: '지워진 프리셋에 입력한 값이 사라져요. 되돌릴 수 없어요.',
      confirmLabel: '버리기',
      danger: true,
    });
    if (!accepted) return;

    setDrafts(({ [editKey(id)]: _dropped, ...rest }) => rest);
    setEditStatus(info('입력을 버렸어요.'));
  };

  const duplicate = async (entry: PresetEntry) => {
    if (
      !(await confirmReplaceNew(
        '새 프리셋에 저장하지 않은 입력이 있어요. 복제하면 그 입력 대신 복제한 값이 들어가요.',
        '복제'
      ))
    ) {
      return;
    }

    setDrafts((current) => ({ ...current, new: draftOf(duplicateForm(entry), true) }));
    setEditStatus(info(`"${entry.preset.name}" 값을 복사했어요. 이름을 확인하고 저장해 주세요.`));
    go({ page: 'new' });
  };

  const remove = async (entry: PresetEntry) => {
    const { id, name } = entry.preset;
    if (!list || !id) return;

    const accepted = await confirm({
      title: `"${name}" 프리셋을 삭제할까요?`,
      body: `이 프리셋을 불러오는 페이지(preset=${id})는 프리셋을 찾지 못해 패키지 기본값으로 재생돼요.${
        list.defaultPresetId === id ? ' 사이트 적용 프리셋이라 지우면 내장 "기본"이 사이트에 적용돼요.' : ''
      }${drafts[editKey(id)]?.dirty ? ' 저장하지 않은 수정도 함께 사라져요.' : ''} 삭제는 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!accepted) return;

    write(
      setListStatus,
      async () => {
        try {
          setList(await deletePlayerPreset(api, { id, revision: list.revision }));
        } catch (error) {
          throw presetFailure(error).error;
        }

        setReloadable(false);
        setDrafts(({ [editKey(id)]: _removed, ...rest }) => rest);
        setListStatus(info(`"${name}" 프리셋을 삭제했어요.`));
      },
      PRESET_LIST_CONFLICT_TEXT
    );
  };

  const applyTarget = applyId ? list?.presets.find((entry) => entry.preset.id === applyId) : undefined;
  const previewEntry = previewing
    ? (list?.presets.find((entry) => entry.preset.id === previewing.preset.id) ?? previewing)
    : null;
  const siteEntry = list?.presets.find((entry) => entry.preset.id === list.defaultPresetId);

  const openApply = (entry: PresetEntry) => {
    if (!entry.preset.id) return;

    setApplyStatus(IDLE);
    setApplyId(entry.preset.id);
  };

  const applySite = async () => {
    if (!list || !applyTarget?.preset.id) return;

    const { id, name } = applyTarget.preset;
    const previous = siteEntry?.preset.name ?? list.defaultPresetId;
    let conflict = false;
    let stale = false;

    const applied = await run(
      // The dialog words its own progress; a failure is replaced below once `run` settles.
      (notice) => setApplyStatus(notice.error ? notice : info('적용하는 중…')),
      async () => {
        try {
          setList(await setDefaultPlayerPreset(api, { id, revision: list.revision }));
        } catch (error) {
          const mapped = presetFailure(error);

          stale = needsListReload(mapped.error);
          throw mapped.error;
        }
      },
      {
        onError: (report) => {
          conflict = report.conflict;

          if (conflict) setReloadable(true);
        },
      }
    );

    if (!applied) {
      const next = conflict
        ? '다른 곳에서 목록이 바뀌었어요. 목록을 다시 불러온 뒤 다시 골라 주세요.'
        : stale
          ? '이 프리셋이 다른 곳에서 지워졌을 수 있어요. 목록을 다시 불러와 주세요.'
          : '잠시 뒤 다시 눌러 주세요.';

      setApplyStatus(
        failure(`사이트에 적용하지 못했어요. 지금 사이트 적용 프리셋은 "${previous}" 그대로예요. ${next}`)
      );
      return;
    }

    focusRow.current = id;
    setReloadable(false);
    setApplyId(null);
    setListStatus(info(`"${name}" 프리셋을 사이트에 적용했어요. 페이지를 새로고침하면 바뀐 플레이어가 보여요.`));
  };

  const confirmMigration = (key: string, ids: readonly string[], setSeen: (seen: string) => void) => {
    const seen = migrationKey(ids);

    try {
      localStorage.setItem(key, seen);
    } catch {
      // Storage may be blocked; the note still goes away for this visit.
    }

    setSeen(seen);
    focusTitle.current = true;
  };

  const editor = (key: DraftKey, base: Draft, heading: string, saveBlocked?: string) => {
    const draft = drafts[key] ?? base;
    const local = draft.checked ? fieldErrors(localErrors(draft)).fields : {};

    return (
      <PresetEditor
        previewKey={key}
        title={heading}
        form={draft.form}
        dirty={draft.dirty}
        site={Boolean(list && draft.form.id && draft.form.id === list.defaultPresetId)}
        errors={{ ...local, ...draft.serverErrors }}
        change={(path, value) => change(key, base, path, value)}
        save={(invalidColors) => save(key, draft, invalidColors)}
        saveBlocked={saveBlocked ?? (list ? (draft.conflicts.length ? CONFLICT_REASON : undefined) : listNotice)}
        conflicts={draft.conflicts}
        resolve={(choice) => resolve(key, choice)}
        status={editStatus}
        reloadable={reloadable}
        reload={() => reloadList(setEditStatus, true)}
        lectureHref={`${publicBase}examples/lecture.html`}
        preview={
          <>
            {/* `ThemePreview` reloads its frame only when the player type changes. */}
            {draft.preview && activation !== null ? (
              <ThemePreview
                preset={draft.preview}
                examplesUrl={`${publicBase}examples/`}
                demo={{ presetId: draft.form.id, unsaved: draft.dirty }}
              />
            ) : null}
            {draft.preview ? <LmsMock preset={draft.preview} /> : null}
            {draft.preview === null ? (
              <Note tone="warn">입력값을 확인하면 미리보기가 다시 바뀌어요. 지금은 미리보기를 보여 줄 수 없어요.</Note>
            ) : previewPreset(draft.form) === null ? (
              <Note tone="warn">
                입력값에 확인할 항목이 있어 마지막으로 올바르던 값으로 보여 줘요. 항목을 고치면 바로 반영돼요.
              </Note>
            ) : null}
          </>
        }
      />
    );
  };

  const content = () => {
    switch (shown.page) {
      case 'options':
        return <PlayerOptions publicBase={publicBase} />;
      case 'setup':
        return (
          <PlayerSetup
            host={session.capabilities.host}
            list={list}
            listNotice={listNotice}
            listError={Boolean(listError)}
            retryList={retryList}
            publicBase={publicBase}
            playerModuleUrl={session.playerModuleUrl}
            apiUrl={api.apiUrl}
            form={setup}
            change={(patch) => setSetup((current) => ({ ...current, ...patch }))}
          />
        );
      case 'new':
        return editor('new', draftOf(BLANK_FORM), '새 프리셋', full ? LIMIT_REASON : undefined);
      case 'edit': {
        const entry = list?.presets.find((candidate) => candidate.preset.id === shown.presetId);

        if (!list) return <ListState notice={listNotice} error={Boolean(listError)} retry={retryList} />;

        if (!entry) {
          const draft = drafts[editKey(shown.presetId)];

          return (
            <div className="aa-stack">
              <Note tone="warn" title="프리셋을 찾지 못했어요">
                지워졌거나 주소가 잘못됐어요. <a href={playerHref({ page: 'list' })}>프리셋 목록</a>에서 다시 골라
                주세요.
              </Note>
              {draft?.dirty ? (
                <>
                  <Note tone="info" title="저장하지 않은 입력이 남아 있어요">
                    이 프리셋에 입력한 값을 새 프리셋으로 만들거나 버릴 수 있어요.
                  </Note>
                  <div className="sa-row">
                    <Button
                      disabledReason={full ? LIMIT_REASON : undefined}
                      onClick={() => void keepAsNew(shown.presetId, draft)}
                    >
                      입력한 값으로 새 프리셋 만들기
                    </Button>
                    <Button variant="danger" onClick={() => void dropDraft(shown.presetId)}>
                      입력 버리기
                    </Button>
                  </div>
                </>
              ) : null}
              <Status status={editStatus} />
            </div>
          );
        }

        if (entry.meta.builtIn) {
          return (
            <div className={`aa-builtin is-${width}`}>
              <div className="aa-stack">
                <Note tone="info" title={entry.preset.name}>
                  {BUILT_IN_REASON}
                </Note>
                <div className="sa-row">
                  <Button disabledReason={full ? LIMIT_REASON : undefined} onClick={() => void duplicate(entry)}>
                    복제해서 새로 만들기
                  </Button>
                </div>
              </div>
              {/* The card is this page's content, so a section; nothing here can be edited, so the demo is open. */}
              <PlayerPreviewCard
                presetKey={`builtin:${shown.presetId}`}
                as="section"
                className="aa-builtin-preview"
                aside="내장 프리셋 모습이에요"
                native={entry.preset.playerType === 'native'}
              >
                {activation === null ? null : (
                  <ThemePreview
                    preset={entry.preset}
                    examplesUrl={`${publicBase}examples/`}
                    demo={{ presetId: entry.preset.id, unsaved: false }}
                  />
                )}
              </PlayerPreviewCard>
            </div>
          );
        }

        return editor(
          `edit:${shown.presetId}`,
          draftOf(formFromPreset(entry.preset)),
          `프리셋 수정 · ${entry.preset.name}`
        );
      }
      case 'list':
        return list ? (
          <PresetTable
            list={list}
            full={full}
            timeZone={session.site.timeZone}
            status={listStatus}
            reloadable={reloadable}
            reload={() => reloadList(setListStatus, false)}
            orphans={orphans.map(({ id, draft }) => ({ id, name: draft.form.name.trim() || id }))}
            preview={setPreviewing}
            edit={(entry) => entry.preset.id && go({ page: 'edit', presetId: entry.preset.id })}
            duplicate={(entry) => void duplicate(entry)}
            remove={(entry) => void remove(entry)}
            apply={openApply}
            migrated={migrationKey(list.migratedNeutral) === migrationSeen ? [] : list.migratedNeutral}
            confirmMigration={() => confirmMigration(MIGRATION_SEEN_KEY, list.migratedNeutral, setMigrationSeen)}
            relabeled={migrationKey(list.migratedLabels) === labelsSeen ? [] : list.migratedLabels}
            confirmLabels={() => confirmMigration(LABELS_SEEN_KEY, list.migratedLabels, setLabelsSeen)}
            testHref={hrefFor('schedule')}
          />
        ) : (
          <ListState notice={listNotice} error={Boolean(listError)} retry={retryList} />
        );
    }
  };

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description="플레이어 종류, 테마, 재생 동작, 언어, 광고 화면을 프리셋으로 저장하고, 사이트에 적용할 프리셋과 설치 방법을 정해요."
      />
      <SubNav
        label="플레이어 화면"
        items={SUB_PAGES.map((item) => ({
          id: item.page.page,
          label: item.label,
          href: playerHref(item.page),
          // The editor pages sit under the list.
          current: shown.page === item.page.page || (item.page.page === 'list' && isEditorPage(shown)),
        }))}
      />
      <h2 id={`${titleId}-page`} className="sa-card-title" tabIndex={-1}>
        {pageTitle(shown)}
      </h2>
      {stale && needsList ? (
        <div className="aa-global">
          <Status status={failure('최신 프리셋 목록을 불러오지 못했어요. 이전 목록으로 보여 줘요.')} />
          <Button size="sm" onClick={refreshList}>
            다시 불러오기
          </Button>
        </div>
      ) : null}
      {content()}
      <PresetPreviewDialog
        target={previewEntry}
        unsaved={Boolean(previewEntry?.preset.id && drafts[editKey(previewEntry.preset.id)]?.dirty)}
        examplesUrl={`${publicBase}examples/`}
        onClose={() => {
          if (previewEntry?.preset.id)
            previewClosed.current = { id: previewEntry.preset.id, name: previewEntry.preset.name };

          setPreviewing(null);
        }}
      />
      <ApplyConfirm
        target={applyTarget ?? null}
        current={siteEntry}
        busy={busy}
        status={applyStatus}
        apply={() => void applySite()}
        onClose={() => setApplyId(null)}
      />
    </>
  );
}

function readMigrationSeen(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/**
 * Where to fix the field at `path`. A disabled control takes no focus: a muted switch locked by autoplay is fixed at
 * the autoplay switch, and a field native video disables at its section heading, beside the reason.
 */
function fixTarget(path: PresetPath): HTMLElement | null {
  const field = document.getElementById(presetFieldId(path));
  if (!field || !field.matches(':disabled')) return field;

  if (path === 'playback.muted') return document.getElementById(presetFieldId('playback.autoplay'));

  return document.getElementById(`${presetSectionId(presetSectionOf(path))}-title`);
}

function migrationKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/** Row buttons by preset id, so focus can move to a row after a write or the preview. */
function presetButtonId(action: 'preview' | 'edit' | 'dup' | 'apply', id: string): string {
  return `aa-preset-${action}-${id}`;
}

function localErrors(draft: Draft) {
  const result = parsePlayerPreset(presetInput(draft.form));

  return result.ok ? [] : result.errors;
}

function pageTitle(page: PlayerPage): string {
  switch (page.page) {
    case 'list':
      return '프리셋 목록';
    case 'new':
      return '새 프리셋';
    case 'edit':
      return '프리셋 수정';
    case 'setup':
      return '초기 설정 방법';
    case 'options':
      return '옵션 설명';
  }
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- whatever the failed read threw.
function presetErrorMessage(error: unknown): string {
  const mapped = presetError(error).error;

  return `프리셋 목록을 불러오지 못했어요. ${mapped instanceof Error ? mapped.message : ''}`.trim();
}

function isEditorPage(page: PlayerPage): boolean {
  return page.page === 'edit' || page.page === 'new';
}

/**
 * The name of a preset that appeared in `next` with the same name as the new-preset draft: a save that timed out may
 * have landed, and saving again would make a second copy.
 */
function createdMeanwhile(before: PresetList | null, next: PresetList, draft: Draft | undefined): string | undefined {
  const name = draft?.form.name.trim();
  if (!before || !name) return undefined;

  const known = new Set(before.presets.map((entry) => entry.preset.id));

  return next.presets.find((entry) => !entry.meta.builtIn && !known.has(entry.preset.id) && entry.preset.name === name)
    ?.preset.name;
}

interface PresetTableProps {
  list: PresetList;
  full: boolean;
  timeZone: string;
  status: Notice;
  reloadable: boolean;
  reload: () => void;
  /** Unsaved input for presets deleted elsewhere. */
  orphans: { id: string; name: string }[];
  preview: (entry: PresetEntry) => void;
  edit: (entry: PresetEntry) => void;
  duplicate: (entry: PresetEntry) => void;
  remove: (entry: PresetEntry) => void;
  apply: (entry: PresetEntry) => void;
  /** Presets moved off the neutral skin that the operator has not confirmed yet. */
  migrated: readonly string[];
  confirmMigration: () => void;
  /** Presets whose English ad labels gave way to the Korean defaults, not confirmed yet. */
  relabeled: readonly string[];
  confirmLabels: () => void;
  /** Where the published playback test is. */
  testHref: string;
}

function PresetTable({
  list,
  full,
  timeZone,
  status,
  reloadable,
  reload,
  orphans,
  preview,
  edit,
  duplicate,
  remove,
  apply,
  migrated,
  confirmMigration,
  relabeled,
  confirmLabels,
  testHref,
}: PresetTableProps) {
  const movedNames = list.presets.filter((entry) => migrated.includes(entry.preset.id ?? '')).map(nameOf);
  const relabeledNames = list.presets.filter((entry) => relabeled.includes(entry.preset.id ?? '')).map(nameOf);
  const columns: DataTableColumn<PresetEntry>[] = [
    {
      key: 'name',
      header: '이름',
      render: (entry) => (
        <>
          <span className="sa-row">
            {entry.preset.name}
            {entry.meta.builtIn ? <PresetMark kind="builtIn" /> : null}
            {migrated.includes(entry.preset.id ?? '') ? <PresetMark kind="moved" /> : null}
          </span>
          <span className="sa-small aa-preset-id">{entry.preset.id}</span>
        </>
      ),
    },
    { key: 'playerType', header: '플레이어 종류', render: (entry) => PLAYER_TYPE_LABELS[entry.preset.playerType] },
    { key: 'language', header: '언어', render: (entry) => languageLabel(entry.preset.language) },
    {
      key: 'site',
      header: '사이트 적용',
      render: (entry) => (entry.preset.id === list.defaultPresetId ? <PresetMark kind="site" /> : '—'),
    },
    {
      key: 'updatedAt',
      header: '수정 시각',
      render: (entry) => (entry.meta.builtIn ? '패키지 기본값' : formatTime(entry.meta.updatedAt, timeZone)),
    },
    {
      key: 'actions',
      header: '작업',
      render: (entry) => {
        const builtIn = entry.meta.builtIn ? BUILT_IN_REASON : undefined;
        const { id, name } = entry.preset;

        return (
          <div className="sa-row">
            <Button
              id={id ? presetButtonId('preview', id) : undefined}
              size="sm"
              aria-label={`${name} 미리보기`}
              onClick={() => preview(entry)}
            >
              미리보기
            </Button>
            <Button
              id={id ? presetButtonId('edit', id) : undefined}
              size="sm"
              disabledReason={builtIn}
              aria-label={`${name} 수정`}
              onClick={() => edit(entry)}
            >
              수정
            </Button>
            <Button
              id={id ? presetButtonId('dup', id) : undefined}
              size="sm"
              disabledReason={full ? LIMIT_REASON : undefined}
              aria-label={`${name} 복제`}
              onClick={() => duplicate(entry)}
            >
              복제
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabledReason={builtIn}
              aria-label={`${name} 삭제`}
              onClick={() => remove(entry)}
            >
              삭제
            </Button>
            <Button
              id={id ? presetButtonId('apply', id) : undefined}
              size="sm"
              disabledReason={id === list.defaultPresetId ? APPLIED_REASON : undefined}
              aria-label={`${name} 사이트에 적용`}
              onClick={() => apply(entry)}
            >
              사이트에 적용
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="aa-stack">
      {movedNames.length ? (
        <Note
          tone="warn"
          title="모양이 조금 달라질 수 있어요"
          actions={
            <>
              <ButtonLink size="sm" href={testHref}>
                재생 테스트 열기
              </ButtonLink>
              <Button size="sm" onClick={confirmMigration}>
                확인했어요
              </Button>
            </>
          }
        >
          스킨 선택이 없어져서, 중립 스킨을 쓰던 프리셋 {movedNames.length}개({movedNames.join(', ')})를 기본 스킨으로
          옮겼어요. 비슷한 모양이 되도록 모서리 12px를 넣었어요. 재생 테스트로 한 번 확인해 주세요.{' '}
          <HelpLink termId="player-skin" />
        </Note>
      ) : null}
      {relabeledNames.length ? (
        <Note
          tone="warn"
          title="광고 문구를 한국어로 바꿨어요"
          actions={
            <>
              <ButtonLink size="sm" href={testHref}>
                재생 테스트 열기
              </ButtonLink>
              <Button size="sm" onClick={confirmLabels}>
                확인했어요
              </Button>
            </>
          }
        >
          광고 화면은 이제 늘 한국어예요. 영어 광고로 만든 프리셋 {relabeledNames.length}개({relabeledNames.join(', ')}
          )에 직접 넣었던 광고 문구를 한국어 기본 문구로 바꿨어요. 다른 문구가 필요하면 편집기의 광고 구획에서 다시 넣어
          주세요.
        </Note>
      ) : null}
      {orphans.length ? (
        <Note tone="warn" title="지워진 프리셋에 저장하지 않은 입력이 있어요">
          다른 곳에서 지워진 프리셋이에요. 열어서 새 프리셋으로 만들거나 버려 주세요:{' '}
          {orphans.map(({ id, name }, index) => (
            <span key={id}>
              {index ? ', ' : null}
              <a href={playerHref({ page: 'edit', presetId: id })}>{name}</a>
            </span>
          ))}
        </Note>
      ) : null}
      <DataTable
        caption="플레이어 프리셋"
        columns={columns}
        rows={list.presets}
        rowKey={(entry) => entry.preset.id ?? ''}
        empty={{ title: '프리셋이 없어요.' }}
        toolbar={<ButtonNew full={full} />}
      />
      <p className="sa-small">
        저장 프리셋 {list.presets.filter((entry) => !entry.meta.builtIn).length}/{MAX_SAVED_PRESETS}개.{' '}
        <HelpLink termId="player-preset" /> 사이트 적용 프리셋은 로더를 넣은 모든 페이지의 플레이어가 쓰는 프리셋이에요.{' '}
        <HelpLink termId="player-default-preset" />
      </p>
      <PlannedNote features={LIST_PLANNED} />
      <Status status={status} />
      {reloadable ? (
        <div className="sa-row">
          <Button onClick={reload}>프리셋 목록 다시 불러오기</Button>
        </div>
      ) : null}
    </div>
  );
}

function nameOf(entry: PresetEntry): string {
  return entry.preset.name;
}

function ButtonNew({ full }: { full: boolean }) {
  return (
    <Button
      variant="primary"
      disabledReason={full ? LIMIT_REASON : undefined}
      onClick={() => {
        window.location.assign(playerHref({ page: 'new' }));
      }}
    >
      새 프리셋 만들기
    </Button>
  );
}

function formatTime(value: string | null, timeZone: string): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
