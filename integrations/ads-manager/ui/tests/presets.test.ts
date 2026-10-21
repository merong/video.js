import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { AdminApi } from '../src/api/client';
import {
  deletePlayerPreset,
  playerPresets,
  presetList,
  savePlayerPreset,
  setDefaultPlayerPreset,
} from '../src/api/presets';
import { DEFAULT_PLAYER_PRESET } from '../src/player';

const STORED = {
  ...DEFAULT_PLAYER_PRESET,
  id: 'p-abc1234567',
  name: '브랜드',
  theme: { ...DEFAULT_PLAYER_PRESET.theme, accentColor: '#112233' },
  createdAt: '2026-10-20T01:00:00Z',
  updatedAt: '2026-10-20T02:00:00Z',
  builtIn: false,
};

const BUILT_IN = { ...DEFAULT_PLAYER_PRESET, builtIn: true, createdAt: null, updatedAt: null };

const LIST = { revision: 3, defaultPresetId: 'p-abc1234567', presets: [BUILT_IN, STORED] };

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
function stubFetch(data: unknown) {
  const fetch = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, data }), { headers: { 'Content-Type': 'application/json' } })
  );

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function sent(fetch: ReturnType<typeof stubFetch>) {
  const [url, init = {}] = fetch.mock.calls[0] ?? [''];

  return {
    action: new URL(url).searchParams.get('action'),
    method: init.method,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

const api = () => new AdminApi('http://admin.test/ads/api/index.php');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('presetList', () => {
  it('keeps list metadata beside the parsed preset', () => {
    const list = presetList(LIST);

    expect(list.revision).toBe(3);
    expect(list.defaultPresetId).toBe('p-abc1234567');
    expect(list.presets.map((entry) => entry.meta)).toEqual([
      { builtIn: true, createdAt: null, updatedAt: null },
      { builtIn: false, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T02:00:00Z' },
    ]);
    expect(list.presets[1]?.preset).not.toHaveProperty('builtIn');
    expect(list.presets[1]?.preset.theme.accentColor).toBe('#112233');
    expect(list.migratedNeutral).toEqual([]);
    expect(list.migratedLabels).toEqual([]);
  });

  it('reads the presets moved off the neutral skin and drops ids that are not text', () => {
    expect(presetList({ ...LIST, migratedNeutral: ['p-abc1234567', 3, '', null] }).migratedNeutral).toEqual([
      'p-abc1234567',
    ]);
    expect(presetList({ ...LIST, migratedNeutral: 'p-abc1234567' }).migratedNeutral).toEqual([]);
  });

  it('reads the presets whose English ad labels became Korean, apart from the neutral skin move', () => {
    const list = presetList({ ...LIST, migratedNeutral: ['p-abc1234567'], migratedLabels: ['p-abc1234567', 7, ''] });

    expect(list.migratedLabels).toEqual(['p-abc1234567']);
    expect(presetList({ ...LIST, migratedNeutral: ['p-abc1234567'] }).migratedLabels).toEqual([]);
    expect(presetList({ ...LIST, migratedLabels: { id: 'p-abc1234567' } }).migratedLabels).toEqual([]);
    expect(presetList({ ...LIST, migratedLabels: null }).migratedLabels).toEqual([]);
  });

  it('rejects a v1 preset that still has a skin', () => {
    expect(() => presetList({ ...LIST, presets: [BUILT_IN, { ...STORED, skin: 'neutral' }] })).toThrow(
      '플레이어 프리셋 응답을 읽지 못했어요.'
    );
  });

  it.each([
    ['a non-integer revision', { ...LIST, revision: '3' }],
    ['a preset failing the schema', { ...LIST, presets: [BUILT_IN, { ...STORED, theme: { accentColor: 'red' } }] }],
    ['a preset without id', { ...LIST, presets: [BUILT_IN, { ...STORED, id: null }] }],
    ['an unknown default id', { ...LIST, defaultPresetId: 'p-zzzzzzzzzz' }],
  ])('rejects %s', (_name, data) => {
    expect(() => presetList(data)).toThrow('플레이어 프리셋 응답을 읽지 못했어요.');
  });
});

describe('playerPresets', () => {
  it('reads the list with a GET', async () => {
    const fetch = stubFetch(LIST);

    expect((await playerPresets(api())).presets).toHaveLength(2);
    expect(sent(fetch)).toEqual({ action: 'player-presets', method: 'GET', body: undefined });
  });
});

describe('savePlayerPreset', () => {
  it('sends the preset and revision and returns the saved entry', async () => {
    const fetch = stubFetch({ ...LIST, revision: 4, preset: STORED });
    const preset = { ...DEFAULT_PLAYER_PRESET, id: null, name: '새 프리셋' };
    const result = await savePlayerPreset(api(), { preset, revision: 3 });

    expect(sent(fetch)).toEqual({ action: 'player-preset-save', method: 'POST', body: { preset, revision: 3 } });
    expect(result.list.revision).toBe(4);
    expect(result.saved.preset.id).toBe('p-abc1234567');
  });

  it('rejects a response without the saved preset', async () => {
    stubFetch(LIST);

    await expect(
      savePlayerPreset(api(), { preset: { ...DEFAULT_PLAYER_PRESET, id: null }, revision: 3 })
    ).rejects.toThrow('플레이어 프리셋 응답을 읽지 못했어요.');
  });
});

describe('deletePlayerPreset', () => {
  it('sends the id and revision', async () => {
    const fetch = stubFetch({ ...LIST, presets: [BUILT_IN], defaultPresetId: 'default' });

    await deletePlayerPreset(api(), { id: 'p-abc1234567', revision: 3 });

    expect(sent(fetch).body).toEqual({ id: 'p-abc1234567', revision: 3 });
    expect(sent(fetch).action).toBe('player-preset-delete');
  });
});

describe('setDefaultPlayerPreset', () => {
  it('sends the id and revision', async () => {
    const fetch = stubFetch({ ...LIST, defaultPresetId: 'default' });
    const list = await setDefaultPlayerPreset(api(), { id: 'default', revision: 3 });

    expect(sent(fetch)).toEqual({
      action: 'player-preset-default',
      method: 'POST',
      body: { id: 'default', revision: 3 },
    });
    expect(list.defaultPresetId).toBe('default');
  });
});
