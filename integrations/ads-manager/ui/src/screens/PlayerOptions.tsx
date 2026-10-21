import { ButtonLink, DataTable, type DataTableColumn, Note } from '../components';
import { HelpLink, type HelpTermId } from '../help';
import { helpHref, optionAnchor, type PlayerOptionGroup, type PlayerOptionRow, playerOptions } from '../player';
import { isPresetPath, PRESET_FIELD_LABELS } from './preset-form';

/** The option table names the three ad labels as one preset field. */
const LABEL_FIELDS = [
  PRESET_FIELD_LABELS['ads.labels.skip'],
  PRESET_FIELD_LABELS['ads.labels.skipCountdown'],
  PRESET_FIELD_LABELS['ads.labels.timer'],
].join(' · ');

/** The editor field that sets a row, by the same label the editor shows. */
export function presetFieldLabel(path: string | undefined): string {
  if (!path) return '프리셋에서 설정 안 함';

  if (path === 'ads.labels') return LABEL_FIELDS;

  return isPresetPath(path) ? PRESET_FIELD_LABELS[path] : path;
}

/** The glossary term that explains a preset field; `undefined` when the option has none. */
export function presetFieldTerm(path: string | undefined): HelpTermId | undefined {
  switch (path) {
    case undefined:
      return undefined;
    case 'theme.accentColor':
    case 'theme.accentTextColor':
      return 'player-accent-color';
    case 'theme.objectFit':
      return 'player-object-fit';
    case 'language':
      return 'player-ad-language';
    // The timeouts belong to native video, and the player-type term explains them.
    case 'ads.timeouts.loadSeconds':
    case 'ads.timeouts.stallSeconds':
      return 'player-type';
  }

  if (path.startsWith('theme.')) return 'player-theme-property';

  return path.startsWith('ads.') ? 'player-ad-overlay' : undefined;
}

function PresetFieldCell({ path }: { path: string | undefined }) {
  const termId = presetFieldTerm(path);

  return termId ? (
    <>
      {presetFieldLabel(path)} <HelpLink termId={termId} />
    </>
  ) : (
    presetFieldLabel(path)
  );
}

/** The row's entry on the public help page, in a new window. */
function OptionHelpLink({
  row,
  group,
  publicBase,
}: {
  row: PlayerOptionRow;
  group: PlayerOptionGroup;
  publicBase: string;
}) {
  return (
    <a
      className="sa-help-link"
      href={`${publicBase}examples/${helpHref(optionAnchor(row.name, group.id))}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`‘${row.name}’ 도움말 (새 창)`}
    >
      ?
    </a>
  );
}

function columns(group: PlayerOptionGroup, publicBase: string): readonly DataTableColumn<PlayerOptionRow>[] {
  return [
    { key: 'name', header: '이름', render: (row) => <code>{row.name}</code> },
    { key: 'type', header: '형식', render: (row) => row.type },
    { key: 'defaultValue', header: '기본값', render: (row) => row.defaultValue },
    {
      key: 'description',
      header: '설명',
      render: (row) => (
        <>
          {row.description} <OptionHelpLink row={row} group={group} publicBase={publicBase} />
        </>
      ),
    },
    { key: 'preset', header: '프리셋 설정', render: (row) => <PresetFieldCell path={row.presetField} /> },
  ];
}

const EXAMPLE_PAGES = [
  { page: 'index.html', label: '데모 열기' },
  { page: 'guide.html', label: '설명서' },
  { page: 'help.html', label: '도움말' },
] as const;

/** The public demo, guide and help pages (`examples/`), each in a new window. */
export function ExamplePageLinks({ publicBase }: { publicBase: string }) {
  return (
    <nav className="sa-row" aria-label="플레이어 문서">
      {EXAMPLE_PAGES.map((link) => (
        <ButtonLink
          key={link.page}
          size="sm"
          href={`${publicBase}examples/${link.page}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
          <span className="sa-sr"> (새 창)</span>
        </ButtonLink>
      ))}
    </nav>
  );
}

/** One reference table with its caution note; each row links to its entry on the public help page. */
export function PlayerOptionTable({ group, publicBase }: { group: PlayerOptionGroup; publicBase: string }) {
  return (
    <section className="aa-stack" aria-label={group.title}>
      {group.note ? <Note tone="warn">{group.note}</Note> : null}
      <DataTable
        caption={group.title}
        columns={columns(group, publicBase)}
        rows={group.rows}
        rowKey={(row) => row.name}
        empty={{ title: '설명할 항목이 없어요.' }}
      />
    </section>
  );
}

/** `#/players/options`: static reference tables. It never calls the API. */
export function PlayerOptions({ publicBase }: { publicBase: string }) {
  return (
    <div className="aa-stack">
      <ExamplePageLinks publicBase={publicBase} />
      <p className="sa-small">
        로더, 광고 모듈과 예제의 설정이에요. 로더와 광고 모듈은 통합 기간 동안 내부 API라 바뀔 수 있어요. 스킨 CSS
        속성만 Video.js 문서에 공개된 설정이에요.
      </p>
      {playerOptions.map((group) => (
        <PlayerOptionTable key={group.id} group={group} publicBase={publicBase} />
      ))}
    </div>
  );
}
