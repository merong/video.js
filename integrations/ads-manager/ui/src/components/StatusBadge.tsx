export type AdStatus =
  | 'draft'
  | 'pending'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'done'
  | 'under'
  | 'rejected'
  | 'archived';

export const STATUS_LABELS = {
  draft: '초안',
  pending: '승인 대기',
  scheduled: '예정',
  active: '진행',
  paused: '일시중지',
  done: '종료',
  under: '미달 종료',
  rejected: '반려',
  archived: '보관',
} satisfies Record<AdStatus, string>;

export interface StatusBadgeProps {
  status: AdStatus;
  /** Overrides the default name, e.g. GnuBoard terms "접수", "검토", "보완 요청" on the matching color. */
  label?: string | undefined;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className="sa-badge" data-st={status}>
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}

export type PresetMarkKind = 'site' | 'moved' | 'builtIn';

export const PRESET_MARK_LABELS = {
  site: '사이트 적용',
  moved: '중립 스킨에서 옮김',
  builtIn: '내장',
} satisfies Record<PresetMarkKind, string>;

/** Player preset marks (A2). Not statuses, so they never take `data-st`: the site preset, a moved preset, a built-in. */
export function PresetMark({ kind }: { kind: PresetMarkKind }) {
  return <span className={kind === 'builtIn' ? 'sa-badge' : `sa-badge is-${kind}`}>{PRESET_MARK_LABELS[kind]}</span>;
}
