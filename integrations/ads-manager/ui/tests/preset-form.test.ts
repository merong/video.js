import { describe, expect, it } from 'vite-plus/test';

import { ApiError } from '../src/api/client';
import { DEFAULT_PLAYER_PRESET, parsePlayerPreset } from '../src/player';
import { presetFieldLabel } from '../src/screens/PlayerOptions';
import { assetsUrlFrom, initialSetupForm } from '../src/screens/PlayerSetup';
import {
  BLANK_FORM,
  contrastRatio,
  contrastWarning,
  duplicateForm,
  fieldErrors,
  formFromPreset,
  formValue,
  presetError,
  presetInput,
  previewPreset,
  updateForm,
} from '../src/screens/preset-form';

const STORED = {
  ...DEFAULT_PLAYER_PRESET,
  id: 'p-abc1234567',
  name: '브랜드',
  language: 'en' as const,
  theme: { ...DEFAULT_PLAYER_PRESET.theme, accentColor: '#112233', borderRadius: 8 },
  playback: { autoplay: true, muted: true, loop: null, preload: 'none' as const },
  display: { poster: false, title: null },
  controls: { ...DEFAULT_PLAYER_PRESET.controls, pip: false },
  ads: {
    ...DEFAULT_PLAYER_PRESET.ads,
    fontSize: 14,
    labels: { ...DEFAULT_PLAYER_PRESET.ads.labels, skip: '건너뛰기', volume: '볼륨' },
    progress: { sequence: false, timer: null, bar: null },
  },
};

const meta = { builtIn: false, createdAt: null, updatedAt: null };

describe('formFromPreset', () => {
  it('round-trips through presetInput', () => {
    const parsed = parsePlayerPreset(presetInput(formFromPreset(STORED)));

    expect(parsed).toEqual({ ok: true, preset: STORED });
  });

  it('keeps values the editor has no control for, such as controls and the other ad labels', () => {
    const input = presetInput(updateForm(formFromPreset(STORED), 'ads.labels.skip', '넘기기'));

    expect(input.controls.pip).toBe(false);
    expect(input.ads.labels.volume).toBe('볼륨');
    expect(input.ads.progress.sequence).toBe(false);
  });

  it('reads a saved switch equal to its built-in default as unset', () => {
    const form = formFromPreset({
      ...STORED,
      playback: { ...STORED.playback, loop: false },
      display: { poster: true, title: true },
    });

    expect(formValue(form, 'playback.loop')).toBe('');
    expect(formValue(form, 'display.poster')).toBe('');
    expect(presetInput(form).display).toEqual({ poster: null, title: null });
  });
});

describe('duplicateForm', () => {
  it('copies every value into a new preset named "<name> 복사본"', () => {
    const form = duplicateForm({ preset: STORED, meta });

    expect(form.id).toBeNull();
    expect(form.name).toBe('브랜드 복사본');
    expect(presetInput(form)).toEqual({ ...presetInput(formFromPreset(STORED)), id: null, name: '브랜드 복사본' });
  });
});

describe('updateForm', () => {
  it('sets flat ads controls by their schema path', () => {
    let form = updateForm(BLANK_FORM, 'ads.labels.timer', '{remaining}');

    form = updateForm(form, 'ads.timeouts.stallSeconds', '12');
    form = updateForm(form, 'theme.borderColor', '#000000');

    expect(formValue(form, 'ads.labels.timer')).toBe('{remaining}');
    expect(formValue(form, 'ads.timeouts.stallSeconds')).toBe('12');
    expect(formValue(form, 'theme.borderColor')).toBe('#000000');
    expect(BLANK_FORM.ads.timer).toBe('');
  });
});

describe('presetInput', () => {
  it('sends theme, title and the Video.js groups as null after switching to native video, and restores them on switching back', () => {
    const form = updateForm(updateForm(formFromPreset(STORED), 'display.title', 'false'), 'playerType', 'native');
    const input = presetInput(form);

    expect(Object.values(input.theme).every((value) => value === null)).toBe(true);
    expect(input.display.title).toBeNull();
    expect(input.controls.pip).toBeNull();
    expect(parsePlayerPreset(input).ok).toBe(true);

    const back = presetInput(updateForm(form, 'playerType', 'videojs'));

    expect(back.theme.accentColor).toBe('#112233');
    expect(back.display.title).toBe(false);
    expect(back.controls.pip).toBe(false);
  });

  it('sends timeouts as null for Video.js', () => {
    let form = updateForm(BLANK_FORM, 'playerType', 'native');

    form = updateForm(form, 'ads.timeouts.loadSeconds', '7');
    expect(presetInput(form).ads.timeouts.loadSeconds).toBe(7);

    form = updateForm(form, 'playerType', 'videojs');
    expect(presetInput(form).ads.timeouts).toEqual({ loadSeconds: null, stallSeconds: null });
  });

  it('turns blank text into null and bad numbers into schema errors', () => {
    let form = updateForm(BLANK_FORM, 'name', '이름');

    form = updateForm(form, 'ads.labels.skip', '   ');
    form = updateForm(form, 'ads.fontSize', '1e');

    const input = presetInput(form);

    expect(input.ads.labels.skip).toBeNull();
    expect(parsePlayerPreset(input)).toMatchObject({ ok: false, errors: [{ path: 'ads.fontSize' }] });
  });
});

describe('previewPreset', () => {
  it('previews a nameless form and refuses an invalid one', () => {
    expect(previewPreset(BLANK_FORM)?.name).toBe('미리보기');
    expect(previewPreset(updateForm(BLANK_FORM, 'theme.accentColor', 'red'))).toBeNull();
  });
});

describe('fieldErrors', () => {
  it('maps schema paths to field messages and flags paths the form does not show', () => {
    const { fields, other } = fieldErrors([
      { path: 'name', code: 'required' },
      { path: 'theme.accentColor', code: 'format' },
      { path: 'ads.labels.mediaAlt', code: 'unknown_key' },
    ]);

    expect(fields.name).toBe('이름을 입력해 주세요.');
    expect(fields['theme.accentColor']).toBeTruthy();
    expect(other).toBe(true);
  });
});

describe('contrastWarning', () => {
  it('warns below 4.5:1 between accent and accent text colors', () => {
    let form = updateForm(BLANK_FORM, 'theme.accentColor', '#777777');

    form = updateForm(form, 'theme.accentTextColor', '#888888');

    expect(contrastWarning(form)).toContain('4.5:1 이상을 권해요');
    expect(contrastWarning(updateForm(form, 'theme.accentColor', '#000000'))).toBeUndefined();
  });

  it('compares with black when the accent text color is empty', () => {
    const form = updateForm(BLANK_FORM, 'theme.accentColor', '#1a1a80');

    expect(contrastWarning(form)).toContain('검정과의 대비가');
    expect(contrastWarning(updateForm(form, 'theme.accentColor', '#ffcc00'))).toBeUndefined();
  });

  it('stays quiet for native video, invalid colors and an empty theme', () => {
    const dark = updateForm(BLANK_FORM, 'theme.accentColor', '#1a1a80');

    expect(contrastWarning(updateForm(dark, 'playerType', 'native'))).toBeUndefined();
    expect(contrastWarning(updateForm(BLANK_FORM, 'theme.accentColor', 'navy'))).toBeUndefined();
    expect(contrastWarning(BLANK_FORM)).toBeUndefined();
  });

  it('uses the WCAG ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });
});

describe('presetError', () => {
  it('keeps 422 field paths with local wording', () => {
    const mapped = presetError(
      new ApiError('bad', 422, 'validation', { 'theme.accentColor': 'server text', 'ads.labels.mediaAlt': 'x' })
    );

    expect(Object.keys(mapped.fields)).toEqual(['theme.accentColor']);
    expect(mapped.fields['theme.accentColor']).not.toBe('server text');
    expect(mapped.error).toBeInstanceOf(ApiError);
    expect(mapped.error).toMatchObject({ fields: {} });
  });

  it.each([
    ['preset_limit', '20개까지예요'],
    ['preset_builtin', '내장 프리셋은 바꿀 수 없어요'],
    ['preset_not_found', '프리셋을 찾지 못했어요'],
    ['invalid_preset_id', '프리셋 ID가 올바르지 않아요'],
  ])('rewrites %s', (code, text) => {
    const { error } = presetError(new ApiError('raw', code === 'preset_not_found' ? 404 : 400, code));

    expect(error).toMatchObject({ message: expect.stringContaining(text) });
  });

  it('passes other errors through', () => {
    const error = new ApiError('conflict', 409, 'revision_conflict');

    expect(presetError(error).error).toBe(error);
  });
});

describe('assetsUrlFrom', () => {
  it('is the absolute directory of the player module', () => {
    expect(assetsUrlFrom('/ads/assets/ads.js')).toBe(new URL('/ads/assets/', location.href).href);
    expect(assetsUrlFrom('https://cdn.test/x/ads.js')).toBe('https://cdn.test/x/');
  });

  it('is null without a usable module URL', () => {
    expect(assetsUrlFrom(null)).toBeNull();
    expect(assetsUrlFrom('javascript:alert(1)')).toBeNull();
  });
});

describe('initialSetupForm', () => {
  it('starts with the default preset and the absolute demo content URL', () => {
    const form = initialSetupForm('/ads/');

    expect(form.presetId).toBeNull();
    expect(form.media).toBe('mp4');
    expect(form.contentUrl).toMatch(/^http:\/\/[^/]+\/ads\//u);
  });
});

describe('presetFieldLabel', () => {
  it('names the editor field for an option row', () => {
    expect(presetFieldLabel('theme.accentColor')).toBe('강조색');
    expect(presetFieldLabel('ads.labels')).toBe('건너뛰기 문구 · 건너뛰기 대기 문구 · 광고 시간 문구');
    expect(presetFieldLabel(undefined)).toBe('프리셋에서 설정 안 함');
  });
});
