import { useEffect, useRef, useState } from 'react';

import { type PresetList, playerPresets, savePlayerPreset } from '../api/presets';
import { failure, IDLE, info, Status, type Notice } from '../app/status';
import { PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import { Button, Note } from '../components';
import { DEFAULT_PLAYER_PRESET, parsePlayerPreset, type PlayerPreset, ThemePreview } from '../player';
import { ListState } from './PlayerSetup';
import {
  changedDraft,
  CONFLICT_REASON,
  type Draft,
  draftOf,
  FIELD_ORDER,
  fixTarget,
  localErrors,
  rebased,
  resolvedDraft,
} from './preset-draft';
import {
  type FieldErrors,
  fieldErrors,
  formFromPreset,
  needsListReload,
  PRESET_CONFLICT_TEXT,
  presetError,
  type PresetForm,
  presetInput,
  type PresetPath,
  previewPreset,
} from './preset-form';
import { PresetEditor } from './PresetEditor';

const LOADING_TEXT = '플레이어 설정을 불러오고 있어요.';
/** The stored name of the one setting; the editor hides the name field. */
const SETTING_NAME = '플레이어 설정';
const SUBJECT = '플레이어 설정';

/** What the editor edits: the stored preset to update, or `null` to store the first one. */
interface Setting {
  id: string | null;
  form: PresetForm;
}

export interface PlayerSettingsScreenProps {
  titleId: string;
  title: string;
  /** The menu's current activation; `null` while hidden. The live preview is unmounted then. */
  activation: number | null;
}

/**
 * The one player setting of a GnuBoard site: the site preset in a single editor, without a list, copies, deletion or
 * lectures. The first save stores it and makes it the site preset; later saves update it (the API keeps one).
 */
export function PlayerSettingsScreen({ titleId, title, activation }: PlayerSettingsScreenProps) {
  const { api, publicBase, run, busy, setDirty } = useWorkspace();
  const [list, setList] = useState<PresetList | null>(null);
  const [listError, setListError] = useState('');
  const [listRequest, setListRequest] = useState(0);
  // A later visit reads the setting again; a failure keeps the shown values and says they may be old.
  const [stale, setStale] = useState(false);
  const latestRefresh = useRef(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<Notice>(IDLE);
  const [reloadable, setReloadable] = useState(false);
  const focusPath = useRef<PresetPath | null>(null);
  const seenActivation = useRef(activation);

  const setting = list ? settingOf(list) : null;
  const shown = draft ?? (setting ? draftOf(setting.form) : null);
  const dirty = Boolean(draft?.dirty);

  useEffect(() => setDirty('players', dirty), [dirty, setDirty]);

  useEffect(() => {
    if (list) return;

    let current = true;

    // A read needs no admin token, so it does not take the single-operation lock.
    playerPresets(api).then(
      (next) => {
        if (current) setList(next);
      },
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- whatever the failed read threw.
      (error: unknown) => {
        if (current) setListError(loadError(error));
      }
    );

    return () => {
      current = false;
    };
  }, [api, list, listRequest]);

  // Unsaved input stays as it is; saving moves it onto what was read here.
  const refresh = () => {
    latestRefresh.current += 1;
    const request = latestRefresh.current;

    playerPresets(api).then(
      (next) => {
        if (request !== latestRefresh.current) return;

        // A save that landed meanwhile already set a newer list.
        setList((shownList) => (shownList && shownList.revision > next.revision ? shownList : next));
        setStale(false);
      },
      () => {
        if (request === latestRefresh.current) setStale(true);
      }
    );
  };

  useEffect(() => {
    if (activation === null || activation === seenActivation.current) return;

    seenActivation.current = activation;

    if (list) refresh();
  });

  // After a failed save, focus goes to the first bad field; otherwise the shell returns it to the save button.
  useEffect(() => {
    if (busy) return;

    const path = focusPath.current;

    focusPath.current = null;

    if (path) (fixTarget(path) ?? document.getElementById(titleId))?.focus();
  });

  const retryList = () => {
    setListError('');
    setListRequest((count) => count + 1);
  };

  const save = (current: Draft, invalidColors: readonly PresetPath[]) => {
    if (current.conflicts.length) return setStatus(failure(CONFLICT_REASON));

    const parsed = parsePlayerPreset(presetInput(current.form));

    // A color field showing a format error still holds its last valid value; saving that would not be what is shown.
    if (!parsed.ok || invalidColors.length) {
      const fields: FieldErrors = parsed.ok ? {} : fieldErrors(parsed.errors).fields;

      focusPath.current = FIELD_ORDER.find((path) => fields[path] || invalidColors.includes(path)) ?? null;
      setDraft({ ...current, checked: true });
      setStatus(failure('저장하지 못했어요. 표시한 항목을 확인해 주세요.'));
      return;
    }

    if (!list || !setting) return;

    // The setting may be newer than the input (a later visit or another window); never save over those changes.
    const moved = rebased(current, setting.form, SUBJECT);

    if (moved) {
      setDraft(moved.draft);
      setStatus(info(moved.text));
      return;
    }

    const revision = list.revision;

    void run(
      setStatus,
      async () => {
        let result;

        try {
          result = await savePlayerPreset(api, { preset: { ...parsed.preset, id: setting.id }, revision });
        } catch (error) {
          const mapped = presetError(error);
          const paths = FIELD_ORDER.filter((path) => mapped.fields[path]);

          if (needsListReload(mapped.error)) setReloadable(true);

          if (paths.length) {
            focusPath.current = paths[0] ?? null;
            setDraft({ ...current, checked: true, serverErrors: mapped.fields });
          }

          throw mapped.error;
        }

        setList(result.list);
        setStale(false);
        setReloadable(false);
        setDraft(null);
        setStatus(info('플레이어 설정을 저장했어요. 영상 페이지를 새로고침하면 바뀐 플레이어가 보여요.'));
      },
      {
        onError: (report) => {
          if (!report.conflict) return;

          setReloadable(true);
          setStatus(failure(PRESET_CONFLICT_TEXT));
        },
      }
    );
  };

  const reload = () => {
    void run(setStatus, async () => {
      const next = await playerPresets(api);
      const moved = draft ? rebased(draft, settingOf(next).form, SUBJECT) : null;

      setList(next);
      setStale(false);
      setReloadable(false);

      if (moved) setDraft(moved.draft);

      setStatus(
        info(
          moved
            ? `플레이어 설정을 다시 불러왔어요. ${moved.text}`
            : dirty
              ? '플레이어 설정을 다시 불러왔어요. 입력은 그대로예요. 확인한 뒤 다시 저장해 주세요.'
              : '플레이어 설정을 다시 불러왔어요.'
        )
      );
    });
  };

  const resolve = (choice: 'mine' | 'theirs') => {
    if (!draft) return;

    // The choice buttons go away with the conflict; focus moves to the first field it settled.
    focusPath.current =
      FIELD_ORDER.find((path) => draft.conflicts.some((conflict) => conflict.path === path)) ??
      draft.conflicts[0]?.path ??
      null;
    setDraft(resolvedDraft(draft, choice));
    setStatus(
      info(
        choice === 'theirs'
          ? '다른 곳에서 저장한 값으로 바꿨어요.'
          : '내 입력을 쓰기로 했어요. 저장하면 다른 곳에서 바꾼 값을 덮어써요.'
      )
    );
  };

  const content = () => {
    if (!shown) {
      return <ListState notice={listError || LOADING_TEXT} error={Boolean(listError)} retry={retryList} />;
    }

    const local = shown.checked ? fieldErrors(localErrors(shown)).fields : {};

    return (
      <PresetEditor
        previewKey="site"
        title={title}
        form={shown.form}
        dirty={shown.dirty}
        site
        fixed
        lectures={false}
        sectionNav={false}
        errors={{ ...local, ...shown.serverErrors }}
        // A theme card changes several fields at once, so each change builds on the one before.
        change={(path, value) => setDraft((current) => changedDraft(current ?? shown, path, value))}
        save={(invalidColors) => save(shown, invalidColors)}
        saveBlocked={shown.conflicts.length ? CONFLICT_REASON : undefined}
        conflicts={shown.conflicts}
        resolve={resolve}
        status={status}
        reloadable={reloadable}
        reload={reload}
        preview={
          <>
            {/* `ThemePreview` reloads its frame only when the player type changes. */}
            {shown.preview && activation !== null ? (
              <ThemePreview
                preset={shown.preview}
                examplesUrl={`${publicBase}examples/`}
                demo={{ presetId: shown.form.id, unsaved: shown.dirty }}
              />
            ) : null}
            {shown.preview === null ? (
              <Note tone="warn">입력값을 확인하면 미리보기가 다시 바뀌어요. 지금은 미리보기를 보여 줄 수 없어요.</Note>
            ) : previewPreset(shown.form) === null ? (
              <Note tone="warn">
                입력값에 확인할 항목이 있어 마지막으로 올바르던 값으로 보여 줘요. 항목을 고치면 바로 반영돼요.
              </Note>
            ) : null}
          </>
        }
      />
    );
  };

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description="사이트의 모든 영상 플레이어가 쓰는 설정 하나예요. 테마, 로고, 재생 동작, 화면 표시, 단축키, 컨트롤, 광고 화면을 바꾸고 저장하면 바로 적용돼요."
      />
      {stale ? (
        <div className="aa-global">
          <Status status={failure('최신 플레이어 설정을 불러오지 못했어요. 이전 값으로 보여 줘요.')} />
          <Button size="sm" onClick={refresh}>
            다시 불러오기
          </Button>
        </div>
      ) : null}
      {content()}
    </>
  );
}

/**
 * The site preset when it is stored. While the site still shows a built-in, its values start a new setting, or replace
 * the one preset an earlier version may have stored (the API refuses a second one).
 */
function settingOf(list: PresetList): Setting {
  const site = list.presets.find((entry) => entry.preset.id === list.defaultPresetId);
  if (site && !site.meta.builtIn) return { id: site.preset.id, form: formOf(site.preset) };

  const stored = list.presets.find((entry) => !entry.meta.builtIn)?.preset;
  const id = stored?.id ?? null;

  return { id, form: formOf({ ...(site?.preset ?? DEFAULT_PLAYER_PRESET), id, name: stored?.name ?? SETTING_NAME }) };
}

/** This host has no lectures; a lecture group stored before stays off, as the API stores and renders it. */
function formOf(preset: PlayerPreset): PresetForm {
  return formFromPreset({ ...preset, lms: { ...preset.lms, enabled: null } });
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- whatever the failed read threw.
function loadError(error: unknown): string {
  const mapped = presetError(error).error;

  return `플레이어 설정을 불러오지 못했어요. ${mapped instanceof Error ? mapped.message : ''}`.trim();
}
