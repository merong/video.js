import type { ReactNode } from 'react';

export interface ActivityEntry {
  id: string;
  /** Display time, e.g. "10.18 10:31". */
  time: string;
  /** Machine-readable time for `<time datetime>`. */
  datetime?: string | undefined;
  /** Who did what, e.g. "admin이 검토를 시작했어요." */
  text: ReactNode;
}

export interface ActivityLogProps {
  /** Newest first. */
  entries: readonly ActivityEntry[];
  label?: string | undefined;
}

export function ActivityLog({ entries, label }: ActivityLogProps) {
  return (
    <ol className="sa-log" aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <time className="sa-num" dateTime={entry.datetime}>
            {entry.time}
          </time>
          <span>{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}
