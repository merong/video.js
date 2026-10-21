import type { ReactNode } from 'react';

export interface KeyValueRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Inter digits for numbers and dates. */
  numeric?: boolean | undefined;
}

export interface KeyValueProps {
  /** Table name when the surrounding card title does not label it. */
  label?: string | undefined;
  rows: readonly KeyValueRow[];
}

/** Item-and-value table (`sa-table sa-kv`). Put it in a flush card. */
export function KeyValue({ label, rows }: KeyValueProps) {
  return (
    <table className="sa-table sa-kv" aria-label={label}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td className={row.numeric ? 'sa-num' : undefined}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
