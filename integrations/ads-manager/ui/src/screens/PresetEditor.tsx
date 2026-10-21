import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { type LayoutWidth, useLayoutWidth } from '../app/media-query';
import { Status, type Notice } from '../app/status';
import {
  Button,
  ButtonLink,
  Check,
  ColorField,
  DisabledReason,
  Field,
  Input,
  Note,
  PresetMark,
  SectionNav,
  type SectionNavItem,
  Segmented,
  Select,
  StatusBadge,
  SwitchList,
} from '../components';
import { HelpLink, type HelpTermId } from '../help';
import { AD_LABEL_DEFAULTS } from '../player';
import { PlayerPreviewCard } from './PlayerPreviewCard';
import {
  contrastWarning,
  drawsNoBorder,
  type FieldErrors,
  type FlagPath,
  flagOn,
  type FormConflict,
  type FormMaxRate,
  type FormSeekButtons,
  formValue,
  NO_BORDER_COLOR,
  PRESET_FIELD_LABELS,
  type PresetForm,
  type PresetPath,
} from './preset-form';

/** One editor is mounted at a time, so field ids are fixed and `focusField` can find them. */
export function presetFieldId(path: PresetPath): string {
  return `aa-preset-${path.replaceAll('.', '-')}`;
}

export type PresetSection = 'basic' | 'theme' | 'controls' | 'playback' | 'lms' | 'language' | 'ads';

/** Section order of the editor (design SectionNav); the logo section comes in A2-3, between theme and controls. */
export const PRESET_SECTIONS: readonly { id: PresetSection; label: string }[] = [
  { id: 'basic', label: '기본' },
  { id: 'theme', label: '테마' },
  { id: 'controls', label: '컨트롤' },
  { id: 'playback', label: '재생 동작' },
  { id: 'lms', label: '강의(LMS)' },
  { id: 'language', label: '언어' },
  { id: 'ads', label: '광고 화면' },
];

export function presetSectionId(section: PresetSection): string {
  return `aa-preset-section-${section}`;
}

/** The section that holds the field at `path`. */
export function presetSectionOf(path: PresetPath): PresetSection {
  if (path === 'name' || path === 'playerType') return 'basic';

  if (path === 'language') return 'language';

  if (path.startsWith('theme.')) return 'theme';

  if (path.startsWith('controls.')) return 'controls';

  if (path.startsWith('lms.')) return 'lms';

  return path.startsWith('ads.') ? 'ads' : 'playback';
}

/** The save bar text: errors to fix first, otherwise who sees the change and when. */
export function saveNote({
  errorCount,
  site,
  width,
}: {
  errorCount: number;
  site: boolean;
  width: LayoutWidth;
}): string {
  if (errorCount) return `고칠 칸 ${errorCount}개 · 표시한 칸을 고친 뒤 저장해 주세요.`;

  if (!site) return '저장하면 이 프리셋을 쓰는 페이지에서, 새로고침하면 바뀐 플레이어가 보여요.';

  return width === 'narrow'
    ? '사이트 적용 프리셋이에요. 저장하면 사이트의 플레이어가 바뀌어요.'
    : '사이트 적용 프리셋이에요. 저장하면 로더를 넣은 모든 페이지에서, 새로고침하면 바뀐 플레이어가 보여요.';
}

const NATIVE_NOTE =
  '테마, 로고, 컨트롤, 단축키·제스처, 제목 표시는 브라우저 기본 컨트롤에서 쓸 수 없어요. 입력한 값은 화면에 그대로 남아 있지만, 기본 video로 저장하면 이 값은 빼고 저장해요. 저장하기 전에 Video.js 플레이어로 되돌리면 값이 그대로 쓰여요.';

const MUTED_LOCKED =
  '자동 재생을 켜서 바꿀 수 없어요. 브라우저는 소리 나는 자동 재생을 막아서, 광고도 음소거로 시작해요. 바꾸려면 자동 재생을 꺼 주세요.';

/** "건너뛰는 폭" choices; the first turn on picks 10. */
const SEEK_OPTIONS = [
  { value: '5', label: '5초' },
  { value: '10', label: '10초' },
  { value: '15', label: '15초' },
  { value: '30', label: '30초' },
] as const satisfies readonly { value: Exclude<FormSeekButtons, ''>; label: string }[];
const SEEK_FIRST = '10';

const MAX_RATE_OPTIONS = [
  { value: '1', label: '1×' },
  { value: '1.2', label: '1.2×' },
  { value: '1.5', label: '1.5×' },
  { value: '1.7', label: '1.7×' },
  { value: '', label: '2×' },
] as const satisfies readonly { value: FormMaxRate; label: string }[];

const PRELOAD_HELP = {
  none: '재생을 누를 때 영상을 받기 시작해요. 데이터를 가장 적게 써요. 길이는 재생 전에 보이지 않아요.',
  '': '길이와 첫 정보만 미리 받아요. 기본값이에요.',
  auto: '페이지를 열 때 영상을 미리 받아요. 빨리 시작하지만 보지 않아도 데이터를 써요.',
} satisfies Record<PresetForm['playback']['preload'], string>;

export interface PresetEditorProps {
  title: string;
  form: PresetForm;
  dirty: boolean;
  /** The preset is the site-applied one, so saving changes every page with the loader. */
  site: boolean;
  errors: FieldErrors;
  change: (path: PresetPath, value: string) => void;
  /** `invalidColors`: shown color fields whose text is not a color; the form keeps their last valid value. */
  save: (invalidColors: readonly PresetPath[]) => void;
  /** Why saving is blocked, e.g. the 20-preset limit. */
  saveBlocked?: string | undefined;
  status: Notice;
  /** After a 409, or a 404/400 for a preset id: input is kept and the list can be reloaded in place. */
  reloadable: boolean;
  reload: () => void;
  /** Fields changed here and in a save elsewhere; `resolve` keeps this input or takes the saved values. */
  conflicts: readonly FormConflict[];
  resolve: (choice: 'mine' | 'theirs') => void;
  /** The live preview (`ThemePreview` and its notes); the editor places it and folds it on narrow screens. */
  preview?: ReactNode;
  /** Which preset the preview shows (`new`, `edit:<id>`); another one starts folded again on narrow screens. */
  previewKey: string;
  /** The sample lecture page (`examples/lecture.html`), opened in a new tab from the lecture section. */
  lectureHref?: string | undefined;
}

/**
 * The preset form in sections (schema v2 2.1, A2-1 scope). Values native video cannot use stay on screen, disabled with
 * the reason, and are sent as `null` (decision 27).
 */
export function PresetEditor({
  title,
  form,
  dirty,
  site,
  errors,
  change,
  save,
  saveBlocked,
  status,
  reloadable,
  reload,
  conflicts,
  resolve,
  preview,
  previewKey,
  lectureHref,
}: PresetEditorProps) {
  const native = form.playerType === 'native';
  const width = useLayoutWidth();
  const invalidColors = useRef(new Set<PresetPath>());
  const [current, setCurrent] = useState<PresetSection>('basic');
  const picked = useRef(false);
  const autoplay = flagOn(form, 'playback.autoplay');
  const lmsOn = flagOn(form, 'lms.enabled');
  // "테두리 없음" opens on for a see-through border; typing one later does not lock the field mid-entry.
  const [borderOff, setBorderOff] = useState(() => drawsNoBorder(form.theme.borderColor));
  const [borderOffFor, setBorderOffFor] = useState(previewKey);
  const noBorder = borderOff && drawsNoBorder(form.theme.borderColor);
  // Turning "이전·이후 버튼" on again brings back the step it had on this screen.
  const [lastSeek, setLastSeek] = useState<Exclude<FormSeekButtons, ''>>(form.controls.seekButtons || SEEK_FIRST);
  const seek = form.controls.seekButtons;

  if (borderOffFor !== previewKey) {
    setBorderOffFor(previewKey);
    setBorderOff(drawsNoBorder(form.theme.borderColor));
    setLastSeek(seek || SEEK_FIRST);
  }

  const errorCounts = new Map<PresetSection, number>();

  for (const path of Object.keys(errors).filter((key): key is PresetPath => Object.hasOwn(errors, key))) {
    const section = presetSectionOf(path);

    errorCounts.set(section, (errorCounts.get(section) ?? 0) + 1);
  }

  const errorCount = [...errorCounts.values()].reduce((sum, count) => sum + count, 0);

  const navItems: SectionNavItem[] = PRESET_SECTIONS.map(({ id, label }) => ({
    id: presetSectionId(id),
    label,
    errors: errorCounts.get(id),
    off: native && (id === 'theme' || id === 'controls' || id === 'lms'),
  }));

  // The section in view follows scrolling where the browser can tell; links and the select set it directly. A picked
  // section stays current through the scroll its focus causes (the heading can land below the observed band, which
  // still holds the section before it) until the next wheel, touch, key or pointer input.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (picked.current) return;

        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const section = PRESET_SECTIONS.find(({ id }) => presetSectionId(id) === top?.target.id);

        if (section) setCurrent(section.id);
      },
      { rootMargin: '-15% 0px -60% 0px' }
    );

    for (const { id } of PRESET_SECTIONS) {
      const element = document.getElementById(presetSectionId(id));

      if (element) observer.observe(element);
    }

    // Capture runs before the nav's own click or change, which picks again after this release.
    const release = () => {
      picked.current = false;
    };
    const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

    for (const type of inputs) window.addEventListener(type, release, { capture: true, passive: true });

    return () => {
      observer.disconnect();

      for (const type of inputs) window.removeEventListener(type, release, { capture: true });
    };
  }, []);

  const navigate = (sectionId: string) => {
    const section = PRESET_SECTIONS.find(({ id }) => presetSectionId(id) === sectionId);
    if (!section) return;

    picked.current = true;
    setCurrent(section.id);
    document.getElementById(`${sectionId}-title`)?.focus();
  };

  // `Field id` names the control, so the control itself only needs its value.
  const field = (path: PresetPath) => ({
    value: formValue(form, path),
    onChange: (event: { currentTarget: HTMLInputElement | HTMLSelectElement }) =>
      change(path, event.currentTarget.value),
  });

  const label = (path: PresetPath) => PRESET_FIELD_LABELS[path];

  // Beside the label, not in `help`, so the field's description does not end with "<용어> 도움말".
  const term = (termId: HelpTermId) => <HelpLink termId={termId} />;

  // `ColorField` sends only valid lowercase `#rrggbb` or `null`, so the form never holds a malformed color. Text that is
  // not a color is tracked here so saving refuses it instead of storing the last valid value.
  const color = (
    path: PresetPath,
    {
      help,
      emptyLabel,
      warning,
      termId,
      alpha,
      none,
    }: {
      help: ReactNode;
      emptyLabel: string;
      warning?: string | undefined;
      termId?: HelpTermId;
      alpha?: boolean;
      none?: boolean;
    }
  ) => (
    <ColorField
      label={label(path)}
      labelAside={termId ? term(termId) : undefined}
      id={presetFieldId(path)}
      value={formValue(form, path) || null}
      onChange={(next) => change(path, next ?? '')}
      onInvalidChange={(invalid) => {
        if (invalid) invalidColors.current.add(path);
        else invalidColors.current.delete(path);
      }}
      help={help}
      error={errors[path]}
      warning={warning}
      emptyLabel={emptyLabel}
      fallback="#ffffff"
      alpha={alpha}
      none={none}
    />
  );

  const toggle = (path: FlagPath, description: ReactNode, extra?: { locked?: ReactNode; badge?: ReactNode }) => ({
    id: presetFieldId(path),
    name: label(path),
    description,
    checked: flagOn(form, path),
    onCheckedChange: (checked: boolean) => change(path, String(checked)),
    error: errors[path],
    ...extra,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Native video saves no theme, so a theme color it disabled cannot block the save.
    save([...invalidColors.current].filter((path) => !(native && path.startsWith('theme.'))));
  };

  const section = (id: PresetSection, heading: string, aside: ReactNode, children: ReactNode) => {
    const sectionId = presetSectionId(id);

    return (
      <section className="sa-card aa-section" id={sectionId} aria-labelledby={`${sectionId}-title`}>
        <div className="sa-card-h">
          <h2 className="sa-card-title" id={`${sectionId}-title`} tabIndex={-1}>
            {heading}
          </h2>
          {aside}
        </div>
        {children}
      </section>
    );
  };

  return (
    <form className={`aa-editor is-${width}`} onSubmit={submit} aria-label={title} noValidate>
      <div className="aa-editor-nav">
        <SectionNav
          items={navItems}
          current={presetSectionId(current)}
          variant={width === 'wide' ? 'column' : width === 'medium' ? 'row' : 'select'}
          onNavigate={navigate}
        />
      </div>

      <div className="aa-stack aa-editor-main">
        {section(
          'basic',
          '기본',
          <span className="sa-row">
            {site ? <PresetMark kind="site" /> : null}
            {dirty ? <StatusBadge status="pending" label="저장하지 않은 변경" /> : null}
          </span>,
          <div className="aa-stack">
            <div className="aa-form-grid">
              <Field
                label={label('name')}
                id={presetFieldId('name')}
                error={errors.name}
                labelAside={term('player-preset')}
                help="목록과 생성기에서 고를 때 보이는 이름이에요. 1–40자예요."
              >
                <Input {...field('name')} />
              </Field>
              <Field
                label={label('playerType')}
                id={presetFieldId('playerType')}
                error={errors.playerType}
                labelAside={term('player-type')}
                help="기본 video는 브라우저 컨트롤을 써요. 로고, 컨트롤, 단축키·제스처, 제목 표시는 Video.js 플레이어에서만 정할 수 있어요."
              >
                <Select {...field('playerType')}>
                  <option value="videojs">Video.js 플레이어</option>
                  <option value="native">기본 video</option>
                </Select>
              </Field>
            </div>
            {native ? (
              <Note tone="warn" title="기본 video 프리셋이에요">
                {NATIVE_NOTE}
              </Note>
            ) : null}
          </div>
        )}

        {section(
          'theme',
          '테마',
          <HelpLink termId="player-theme-property" />,
          <DisabledReason
            active={native}
            reason={
              <>
                <b>기본 video에서는 테마를 쓸 수 없어요.</b> 브라우저 컨트롤을 써서 테마가 적용되지 않아요. 기본 구획의
                플레이어 종류를 Video.js 플레이어로 바꾸면 쓸 수 있어요.
              </>
            }
          >
            <div className="aa-form-grid">
              {color('theme.accentColor', {
                help: '진행 막대 채움, 강조 버튼, 메뉴 선택 색이에요. 광고 강조색을 비우면 광고 화면도 이 색을 따라요.',
                emptyLabel: '스킨 기본 (흰색)',
                termId: 'player-accent-color',
              })}
              {color('theme.accentTextColor', {
                help: '비우면 브라우저가 대비되는 글자색을 골라요. Chrome 147, Firefox 146, Safari 26 미만은 검정으로 고정돼요.',
                emptyLabel: '자동 대비',
                warning: contrastWarning(form),
                termId: 'player-accent-color',
              })}
              <div className="sa-field">
                {color('theme.borderColor', {
                  help: '플레이어 둘레의 가는 선 색이에요. 8자리로 투명도를 줄 수 있고 #00000000이면 선이 없어요.',
                  emptyLabel: '스킨 기본 (반투명 검정)',
                  alpha: true,
                  none: noBorder,
                })}
                <Check
                  label="테두리 없음"
                  id={`${presetFieldId('theme.borderColor')}-none`}
                  checked={noBorder}
                  aria-describedby={`${presetFieldId('theme.borderColor')}-none-help`}
                  onChange={(event) => {
                    const off = event.currentTarget.checked;

                    setBorderOff(off);
                    change('theme.borderColor', off ? NO_BORDER_COLOR : '');
                  }}
                />
                <span className="sa-help" id={`${presetFieldId('theme.borderColor')}-none-help`}>
                  켜면 플레이어 둘레에 선을 그리지 않아요.
                </span>
              </div>
              <Field
                label={label('theme.borderRadius')}
                id={presetFieldId('theme.borderRadius')}
                error={errors['theme.borderRadius']}
                help="0–32 정수예요. 광고 화면 모서리도 따라가요."
              >
                <Input
                  {...field('theme.borderRadius')}
                  numeric
                  type="number"
                  min={0}
                  max={32}
                  step={1}
                  placeholder="스킨 기본 (28px)"
                />
              </Field>
              <Field
                label={label('theme.fontFamily')}
                id={presetFieldId('theme.fontFamily')}
                error={errors['theme.fontFamily']}
                help="플레이어 글꼴을 바꾸면 광고 화면 글꼴도 따라가요. Inter는 페이지가 불러와야 보여요."
              >
                <Select {...field('theme.fontFamily')}>
                  <option value="">스킨 기본 (Inter 우선)</option>
                  <option value="system">시스템 글꼴</option>
                </Select>
              </Field>
              <Field
                label={label('theme.objectFit')}
                id={presetFieldId('theme.objectFit')}
                error={errors['theme.objectFit']}
                labelAside={term('player-object-fit')}
                help="전체화면에서는 항상 맞춤이에요. 채우기 위치는 프리셋에서 정하지 않아요."
              >
                <Select {...field('theme.objectFit')}>
                  <option value="">스킨 기본 (맞춤)</option>
                  <option value="contain">맞춤 · 전체가 보여요</option>
                  <option value="cover">채움 · 빈 곳 없이 잘려요</option>
                </Select>
              </Field>
              <Field
                label={label('theme.scaleUnit')}
                id={presetFieldId('theme.scaleUnit')}
                error={errors['theme.scaleUnit']}
                help="컨트롤 간격, 아이콘, 글자 크기의 기준이에요. 광고 화면에는 영향이 없어요."
              >
                <Select {...field('theme.scaleUnit')}>
                  <option value="">스킨 기본 (16px)</option>
                  <option value="root">문서 글자 크기 (1rem)</option>
                </Select>
              </Field>
            </div>
          </DisabledReason>
        )}

        {section(
          'controls',
          '컨트롤',
          null,
          <DisabledReason
            active={native}
            reason={
              <>
                <b>기본 video에서는 컨트롤을 쓸 수 없어요.</b> 기본 구획의 플레이어 종류를 Video.js로 바꾸면 쓸 수
                있어요.
              </>
            }
          >
            <SwitchList
              items={[
                {
                  id: presetFieldId('controls.seekButtons'),
                  name: label('controls.seekButtons'),
                  description: '컨트롤 막대에 뒤로·앞으로 건너뛰기 버튼을 보여요.',
                  checked: seek !== '',
                  onCheckedChange: (checked) => change('controls.seekButtons', checked ? lastSeek : ''),
                  error: errors['controls.seekButtons'],
                  sub: (
                    <Segmented
                      label="건너뛰는 폭"
                      value={seek || lastSeek}
                      options={SEEK_OPTIONS}
                      numeric
                      onChange={(value) => {
                        setLastSeek(value);
                        change('controls.seekButtons', value);
                      }}
                    />
                  ),
                },
                {
                  ...toggle(
                    'controls.captions',
                    '자막 버튼과 설정 메뉴의 자막 항목이에요. 영상에 자막이 없으면 버튼이 ‘자막 없음’으로 막혀 보여요.'
                  ),
                  keys: (
                    <>
                      끄면 단축키 <kbd className="sa-kbd">c</kbd>도 꺼져요.
                    </>
                  ),
                },
              ]}
            />
          </DisabledReason>
        )}

        {section(
          'playback',
          '재생 동작',
          null,
          <div className="aa-stack">
            <fieldset className="aa-fieldset">
              <legend className="sa-label">시작과 끝</legend>
              <SwitchList
                items={[
                  toggle('playback.autoplay', '페이지가 열리면 바로 재생해요. 켜면 음소거로 시작해요.'),
                  {
                    ...toggle('playback.muted', '소리 없이 시작해요. 보는 사람이 음량 버튼으로 켤 수 있어요.', {
                      locked: autoplay ? MUTED_LOCKED : undefined,
                      badge: autoplay ? '자동 재생 때문에 켜짐' : undefined,
                    }),
                    checked: autoplay || flagOn(form, 'playback.muted'),
                  },
                  toggle('playback.loop', '본편이 끝나면 처음부터 다시 재생해요.'),
                ]}
              />
              {flagOn(form, 'playback.loop') ? (
                <Note tone="warn" title="포스트롤은 재생되지 않아요">
                  반복 재생을 켜면 본편이 끝나지 않아서, 본편 뒤에 넣은 광고가 나오지 않아요. 포스트롤을 쓰는 지면이면
                  반복을 꺼 주세요.
                </Note>
              ) : null}
            </fieldset>
            <Segmented
              label={label('playback.preload')}
              id={presetFieldId('playback.preload')}
              value={form.playback.preload}
              options={[
                { value: 'none', label: '누를 때' },
                { value: '', label: '정보만 (기본)' },
                { value: 'auto', label: '미리 받기' },
              ]}
              onChange={(value) => change('playback.preload', value)}
              help={PRELOAD_HELP[form.playback.preload]}
              error={errors['playback.preload']}
            />
            <fieldset className="aa-fieldset">
              <legend className="sa-label">화면 표시</legend>
              <SwitchList
                items={[
                  toggle(
                    'display.poster',
                    '재생 전에 대표 그림을 보여요. 자리 요소에 data-poster가 있을 때만 효과가 있어요.'
                  ),
                  toggle(
                    'display.title',
                    '플레이어 왼쪽 위에 영상 제목을 보여요. 자리 요소에 data-title이 있을 때만 효과가 있어요.',
                    {
                      locked: native
                        ? '기본 video에서는 쓸 수 없어요. 브라우저 컨트롤에는 제목 자리가 없어요. 플레이어 종류를 Video.js 플레이어로 바꾸면 쓸 수 있어요.'
                        : undefined,
                    }
                  ),
                ]}
              />
            </fieldset>
          </div>
        )}

        {section(
          'lms',
          '강의(LMS)',
          <HelpLink termId="lms-progress-rate" />,
          <DisabledReason active={native} reason={<b>강의 기능은 Video.js 플레이어에서만 써요.</b>}>
            <div className="aa-stack">
              <div className="sa-field">
                <Check
                  label={label('lms.enabled')}
                  id={presetFieldId('lms.enabled')}
                  checked={lmsOn}
                  aria-describedby={`${presetFieldId('lms.enabled')}-help`}
                  onChange={(event) => change('lms.enabled', String(event.currentTarget.checked))}
                />
                <span className="sa-help" id={`${presetFieldId('lms.enabled')}-help`}>
                  진도를 기록하고 목차·자료·스크립트·메모 패널을 붙여요.
                </span>
              </div>
              <DisabledReason active={!native && !lmsOn} reason={<b>강의 기능 사용을 켜면 고칠 수 있어요.</b>}>
                <div className="aa-stack">
                  <Segmented
                    label={label('lms.resume')}
                    id={presetFieldId('lms.resume')}
                    value={form.lms.resume}
                    options={[
                      { value: '', label: '물어보기' },
                      { value: 'auto', label: '바로 이어서' },
                      { value: 'off', label: '처음부터' },
                    ]}
                    onChange={(value) => change('lms.resume', value)}
                    error={errors['lms.resume']}
                  />
                  <Segmented
                    label={label('lms.seekLimit')}
                    labelAside={term('lms-seek-limit')}
                    id={presetFieldId('lms.seekLimit')}
                    value={form.lms.seekLimit}
                    options={[
                      { value: '', label: '자유롭게' },
                      { value: 'watched', label: '본 곳까지만' },
                    ]}
                    onChange={(value) => change('lms.seekLimit', value)}
                    help="본 곳까지만이면 아직 보지 않은 구간으로 건너뛸 수 없어요. 완료하면 풀려요."
                    error={errors['lms.seekLimit']}
                  />
                  <Segmented
                    label={label('lms.maxRate')}
                    id={presetFieldId('lms.maxRate')}
                    value={form.lms.maxRate}
                    options={MAX_RATE_OPTIONS}
                    numeric
                    onChange={(value) => change('lms.maxRate', value)}
                    error={errors['lms.maxRate']}
                  />
                  <div className="aa-form-grid">
                    <Field
                      label={label('lms.completion')}
                      id={presetFieldId('lms.completion')}
                      error={errors['lms.completion']}
                      labelAside={term('lms-completion')}
                      help="진도율이 이 값 이상이 되는 순간 완료로 기록해요. 규정이 있으면 그 값으로 맞춰 주세요(예: 80%)."
                    >
                      <Input
                        {...field('lms.completion')}
                        numeric
                        type="number"
                        min={50}
                        max={100}
                        step={1}
                        placeholder="90"
                      />
                    </Field>
                  </div>
                  <fieldset className="aa-fieldset">
                    <legend className="sa-label">패널 탭</legend>
                    <SwitchList
                      items={[
                        toggle('lms.tabs.chapters', '장 목록과 장별 시청 비율'),
                        toggle('lms.tabs.materials', '슬라이드와 내려받기 자료'),
                        toggle('lms.tabs.transcript', '문장 목록과 검색'),
                        toggle('lms.tabs.notes', '메모와 북마크'),
                      ]}
                    />
                    <span className="sa-help">넷 다 끄면 패널 없이 진도 줄만 보여요.</span>
                  </fieldset>
                  <SwitchList
                    items={[
                      {
                        ...toggle('lms.bookmarks', '컨트롤 막대 버튼과 B 키로 지금 장면을 표시해요.', {
                          locked: flagOn(form, 'lms.tabs.notes') ? undefined : '메모 탭을 켜야 북마크를 쓸 수 있어요.',
                        }),
                        keys: (
                          <>
                            단축키 <kbd className="sa-kbd">B</kbd>
                          </>
                        ),
                      },
                    ]}
                  />
                  <Segmented
                    label={label('lms.ads')}
                    id={presetFieldId('lms.ads')}
                    value={form.lms.ads}
                    options={[
                      { value: '', label: '끔' },
                      { value: 'preroll', label: '프리롤만' },
                    ]}
                    onChange={(value) => change('lms.ads', value)}
                    help="프리롤만 재생하고 광고 시간은 진도에 넣지 않아요."
                    error={errors['lms.ads']}
                  />
                </div>
              </DisabledReason>
              <Note
                tone="info"
                actions={
                  lectureHref ? (
                    <ButtonLink size="sm" href={lectureHref} target="_blank" rel="noopener">
                      샘플 강의 열기
                    </ButtonLink>
                  ) : undefined
                }
              >
                자료 패널은 샘플 강의에서 볼 수 있어요.
              </Note>
            </div>
          </DisabledReason>
        )}

        {section(
          'language',
          '언어',
          <HelpLink termId="player-ad-language" />,
          <div className="aa-stack">
            <Field
              label={label('language')}
              id={presetFieldId('language')}
              error={errors.language}
              help={
                native
                  ? '기본 video에서는 이 값이 화면에 쓰이지 않아요. 브라우저 컨트롤은 브라우저 언어로, 광고 문구는 늘 한국어로 나와요.'
                  : '비우면 페이지의 lang을 따라요. 페이지에 lang이 없거나 네 언어가 아니면 영어로 나와요.'
              }
            >
              <Select {...field('language')}>
                <option value="">페이지 언어 따르기</option>
                <option value="ko">한국어</option>
                <option value="en">영어 (English)</option>
                <option value="ja">일본어 (日本語)</option>
                <option value="zh-CN">중국어 간체 (简体中文)</option>
              </Select>
            </Field>
            <Note tone="info">플레이어 화면 언어예요. 광고 문구는 늘 한국어로 나와요.</Note>
          </div>
        )}

        {section(
          'ads',
          '광고 화면',
          <HelpLink termId="player-ad-overlay" />,
          <div className="aa-stack">
            <div className="aa-form-grid">
              <Field
                label={label('ads.labels.skip')}
                id={presetFieldId('ads.labels.skip')}
                error={errors['ads.labels.skip']}
                help="40자 이내예요. { } 문자는 쓸 수 없어요."
              >
                <Input {...field('ads.labels.skip')} placeholder={AD_LABEL_DEFAULTS.skip} />
              </Field>
              <Field
                label={label('ads.labels.skipCountdown')}
                id={presetFieldId('ads.labels.skipCountdown')}
                error={errors['ads.labels.skipCountdown']}
                help="{seconds} 자리에 남은 초가 들어가요."
              >
                <Input {...field('ads.labels.skipCountdown')} placeholder={AD_LABEL_DEFAULTS.skipCountdown} />
              </Field>
              <Field
                label={label('ads.labels.timer')}
                id={presetFieldId('ads.labels.timer')}
                error={errors['ads.labels.timer']}
                help="{elapsed} 지난 시간, {duration} 광고 길이, {remaining} 남은 시간을 쓸 수 있어요."
              >
                <Input {...field('ads.labels.timer')} placeholder={AD_LABEL_DEFAULTS.timer} />
              </Field>
              {color('ads.accentColor', {
                help: native
                  ? '광고 음량 막대와 진행 막대 색이에요.'
                  : '음량 막대와 진행 막대 색이에요. 비우면 테마 강조색을 따라요.',
                emptyLabel: native ? '흰색' : '테마 강조색',
                termId: 'player-ad-overlay',
              })}
              <Field
                label={label('ads.skipRadius')}
                id={presetFieldId('ads.skipRadius')}
                error={errors['ads.skipRadius']}
                help="0–24 정수예요."
              >
                <Input {...field('ads.skipRadius')} numeric type="number" min={0} max={24} step={1} placeholder="6" />
              </Field>
              <Field
                label={label('ads.fontSize')}
                id={presetFieldId('ads.fontSize')}
                error={errors['ads.fontSize']}
                help="11–18 정수예요. 플레이어 폭이 280px 이하이면 글자가 11px로 고정돼요."
              >
                <Input {...field('ads.fontSize')} numeric type="number" min={11} max={18} step={1} placeholder="13" />
              </Field>
            </div>
            {native ? (
              <div className="aa-form-grid">
                <Field
                  label={label('ads.timeouts.loadSeconds')}
                  id={presetFieldId('ads.timeouts.loadSeconds')}
                  error={errors['ads.timeouts.loadSeconds']}
                  help="광고 소재를 불러와 재생을 시작하기까지 기다리는 시간이에요. 1–60 정수예요."
                >
                  <Input
                    {...field('ads.timeouts.loadSeconds')}
                    numeric
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    placeholder="5"
                  />
                </Field>
                <Field
                  label={label('ads.timeouts.stallSeconds')}
                  id={presetFieldId('ads.timeouts.stallSeconds')}
                  error={errors['ads.timeouts.stallSeconds']}
                  help="광고 영상이 멈췄을 때 다음으로 넘어가기 전까지 기다리는 시간이에요. 1–120 정수예요."
                >
                  <Input
                    {...field('ads.timeouts.stallSeconds')}
                    numeric
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    placeholder="10"
                  />
                </Field>
              </div>
            ) : (
              <Note tone="info" title="광고 시간 제한">
                Video.js의 광고 요소에는 시간 제한 속성이 없어요. 편성 요청 시간 제한은 5초로 고정돼요. 시간 제한은 기본
                video 프리셋에서 정할 수 있어요.
              </Note>
            )}
          </div>
        )}

        {conflicts.length ? (
          <Note tone="warn" title="다른 곳에서도 바꾼 항목이 있어요">
            <ul>
              {conflicts.map(({ path, mine, theirs }) => (
                <li key={path}>
                  {label(path)}: 내 입력 {mine || '(비어 있음)'} · 다른 곳에서 저장한 값 {theirs || '(비어 있음)'}
                </li>
              ))}
            </ul>
            <div className="sa-row">
              <Button onClick={() => resolve('theirs')}>다른 곳에서 저장한 값 쓰기</Button>
              <Button onClick={() => resolve('mine')}>내 입력 유지</Button>
            </div>
          </Note>
        ) : null}

        <div className="sa-card aa-between aa-savebar">
          <span className="sa-small">{saveNote({ errorCount, site, width })}</span>
          <Button type="submit" variant="primary" disabledReason={saveBlocked}>
            프리셋 저장
          </Button>
        </div>
        <Status status={status} />
        {reloadable ? (
          <div className="sa-row">
            <Button onClick={reload}>프리셋 목록 다시 불러오기</Button>
          </div>
        ) : null}
      </div>

      {preview === undefined ? null : (
        <PlayerPreviewCard
          presetKey={previewKey}
          className="aa-editor-preview"
          aside="저장하기 전 입력도 보여요"
          native={native}
        >
          {preview}
        </PlayerPreviewCard>
      )}
    </form>
  );
}
