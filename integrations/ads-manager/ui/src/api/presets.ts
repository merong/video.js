import { parsePlayerPreset, type PlayerPreset } from '../player';
import type { AdminApi } from './client';

/** Stored metadata the list adds beside each preset; `parsePlayerPreset` drops it, so it is read separately. */
export interface PresetMeta {
  builtIn: boolean;
  /** ISO 8601 UTC, `null` for the built-in presets. */
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PresetEntry {
  preset: PlayerPreset;
  meta: PresetMeta;
}

/**
 * `player-presets` and every write response: the whole document, the built-in `default`, `flat`, `rounded` and `accent`
 * first. `defaultPresetId` is the site-applied preset.
 */
export interface PresetList {
  revision: number;
  defaultPresetId: string;
  presets: PresetEntry[];
  /**
   * Saved presets moved off the removed neutral skin while the document is still v1 (schema v2 section 1). Empty once
   * the document is written as v2, and in write responses.
   */
  migratedNeutral: string[];
  /**
   * Saved presets made with English ad labels (`ads.locale: "en"`) whose own labels gave way to the Korean defaults
   * (A2-E spec section 6). Same lifetime as `migratedNeutral`.
   */
  migratedLabels: string[];
}

export interface PresetSaveResult {
  list: PresetList;
  saved: PresetEntry;
}

/** Stored presets the server accepts besides the built-in ones (schema v2 section 1). */
export const MAX_SAVED_PRESETS = 20;

const INVALID_RESPONSE = '플레이어 프리셋 응답을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.';

export async function playerPresets(api: AdminApi): Promise<PresetList> {
  return presetList(await api.request<unknown>('player-presets'));
}

/** Creates the preset when it has no id, otherwise replaces it. */
export async function savePlayerPreset(
  api: AdminApi,
  input: { preset: PlayerPreset; revision: number }
): Promise<PresetSaveResult> {
  const data = await api.request<unknown>('player-preset-save', { data: input });
  const saved = isRecord(data) ? presetEntry(data.preset) : null;
  if (!saved) throw new Error(INVALID_RESPONSE);

  return { list: presetList(data), saved };
}

export async function deletePlayerPreset(api: AdminApi, input: { id: string; revision: number }): Promise<PresetList> {
  return presetList(await api.request<unknown>('player-preset-delete', { data: input }));
}

export async function setDefaultPlayerPreset(
  api: AdminApi,
  input: { id: string; revision: number }
): Promise<PresetList> {
  return presetList(await api.request<unknown>('player-preset-default', { data: input }));
}

/** Validates the list response; every preset must pass the same schema the editor and examples use. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the boundary that reads the untrusted list response.
export function presetList(data: unknown): PresetList {
  if (!isRecord(data) || !Number.isInteger(data.revision) || !Array.isArray(data.presets)) {
    throw new Error(INVALID_RESPONSE);
  }

  const presets = data.presets.map(presetEntry);
  const defaultPresetId = data.defaultPresetId;

  if (presets.some((entry) => entry === null) || !presets.some((entry) => entry?.preset.id === defaultPresetId)) {
    throw new Error(INVALID_RESPONSE);
  }

  return {
    // SAFETY: `Number.isInteger` above accepted it.
    revision: data.revision as number,
    // SAFETY: equal to the id of a parsed preset, which is a string.
    defaultPresetId: defaultPresetId as string,
    // SAFETY: the `some` check above rejected every `null`.
    presets: presets as PresetEntry[],
    migratedNeutral: presetIds(data.migratedNeutral),
    migratedLabels: presetIds(data.migratedLabels),
  };
}

/** A migration list of preset ids; an older server without it, or a value that is not a list, reads as none. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function presetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((id) => {
    const item = text(id);

    return item === null ? [] : [item];
  });
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function presetEntry(value: unknown): PresetEntry | null {
  const result = parsePlayerPreset(value);
  if (!result.ok || !result.preset.id || !isRecord(value)) return null;

  return {
    preset: result.preset,
    meta: {
      builtIn: value.builtIn === true,
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
    },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function text(value: unknown): string | null {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON.
  return typeof value === 'string' && value ? value : null;
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- untrusted JSON.
function isRecord(value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
