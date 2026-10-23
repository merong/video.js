import { parsePlayerPreset, type PlayerPreset } from '../player';
import {
  type FieldErrors,
  type FormConflict,
  isPresetPath,
  PRESET_FIELD_LABELS,
  type PresetForm,
  presetInput,
  type PresetPath,
  previewPreset,
  rebaseForm,
  updateForm,
} from './preset-form';
import { presetFieldId, presetSectionId, presetSectionOf } from './PresetEditor';

/** Unsaved editor state. Drafts outlive their page, so moving between menus and pages keeps input. */
export interface Draft {
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

export const FIELD_ORDER = Object.keys(PRESET_FIELD_LABELS).filter(isPresetPath);

export const CONFLICT_REASON = '다른 곳에서도 바꾼 항목이 있어요. 어느 값을 쓸지 먼저 골라 주세요.';

export function draftOf(form: PresetForm, dirty = false): Draft {
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

/** The draft after one field changed; the API error on that field goes away. */
export function changedDraft(draft: Draft, path: PresetPath, value: string): Draft {
  const form = updateForm(draft.form, path, value);
  const serverErrors = { ...draft.serverErrors };

  delete serverErrors[path];

  return {
    ...draft,
    form,
    dirty: draft.clean === null || !sameForm(form, draft.clean),
    serverErrors,
    preview: previewPreset(form) ?? draft.preview,
  };
}

/** The draft once the operator kept their input or took the values saved elsewhere. */
export function resolvedDraft(draft: Draft, choice: 'mine' | 'theirs'): Draft {
  const form =
    choice === 'theirs'
      ? draft.conflicts.reduce((next, { path, theirs }) => updateForm(next, path, theirs), draft.form)
      : draft.form;

  return {
    ...draft,
    form,
    conflicts: [],
    dirty: draft.clean === null || !sameForm(form, draft.clean),
    preview: previewPreset(form) ?? draft.preview,
  };
}

/**
 * The draft moved onto the server's current form, or `null` when the server form is the one the draft started from. A
 * copy has no server form and never moves. `subject` names what was saved elsewhere.
 */
export function rebased(
  draft: Draft,
  server: PresetForm,
  subject = '이 프리셋'
): { draft: Draft; text: string } | null {
  if (!draft.clean || sameForm(draft.clean, server)) return null;

  const { form, adopted, conflicts } = rebaseForm(draft.form, draft.clean, server);
  const names = (paths: readonly PresetPath[]) => paths.map((path) => PRESET_FIELD_LABELS[path]).join(', ');
  const text = [
    `다른 곳에서 ${subject}을 먼저 저장했어요.`,
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

export function sameForm(a: PresetForm, b: PresetForm): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The control to focus for a field error; a field the current player type disables falls back to a nearby one. */
export function fixTarget(path: PresetPath): HTMLElement | null {
  const field = document.getElementById(presetFieldId(path));
  const folded = field?.closest('details');

  // A field in the folded "세부 조정" cannot take focus until it opens.
  if (folded) folded.open = true;

  if (!field || !field.matches(':disabled')) return field;

  if (path === 'playback.muted') return document.getElementById(presetFieldId('playback.autoplay'));

  return document.getElementById(`${presetSectionId(presetSectionOf(path))}-title`);
}

export function localErrors(draft: Draft) {
  const result = parsePlayerPreset(presetInput(draft.form));

  return result.ok ? [] : result.errors;
}
