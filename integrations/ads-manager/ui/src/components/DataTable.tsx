import { type Key, type ReactNode, useId } from 'react';

import { cx } from './cx';

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  /** Right-aligned Inter digits (`.num`). */
  numeric?: boolean | undefined;
  /** Keeps the header for screen readers only, e.g. an action column. */
  hideHeader?: boolean | undefined;
  /** Keeps the column at the right edge while the table scrolls sideways. Last column only, e.g. an "열기" button. */
  pinEnd?: boolean | undefined;
  render: (row: Row) => ReactNode;
}

export interface DataTableEmpty {
  title: ReactNode;
  /** What to do next, e.g. "필터를 바꿔 보세요." */
  description?: ReactNode;
}

export interface DataTableProps<Row> {
  /** Table name. Always rendered so the table and its scroll area are named. */
  caption: ReactNode;
  /** Keeps the caption for screen readers only, when a toolbar title already shows it. */
  hideCaption?: boolean | undefined;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => Key;
  /** Dense rows; only for list screens (approvals, executions, placements, creatives). */
  dense?: boolean | undefined;
  /** Shown as one full-width row when `rows` is empty. */
  empty: DataTableEmpty;
  isSelected?: ((row: Row) => boolean) | undefined;
  /** Toolbar above the table: title, filters, search. */
  toolbar?: ReactNode;
  /** `tfoot` row cells, e.g. totals. */
  footer?: ReactNode;
  /** Below the scroll area, e.g. pagination. */
  after?: ReactNode;
  className?: string | undefined;
}

function cellClass(column: Pick<DataTableColumn<unknown>, 'numeric' | 'pinEnd'>): string | undefined {
  return cx(column.numeric && 'num', column.pinEnd && 'is-pinned') || undefined;
}

/** Card with an optional toolbar and a horizontally scrolling `sa-table`. */
export function DataTable<Row>({
  caption,
  hideCaption,
  columns,
  rows,
  rowKey,
  dense,
  empty,
  isSelected,
  toolbar,
  footer,
  after,
  className,
}: DataTableProps<Row>) {
  const captionId = useId();

  return (
    <div className={cx('sa-card is-flush', dense && 'sa-dense', className)}>
      {toolbar !== undefined && <div className="sa-toolbar">{toolbar}</div>}
      {/* Focusable so keyboard users can scroll wide tables. */}
      <div className="sa-scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
        <table className="sa-table">
          <caption id={captionId} className={hideCaption ? 'sa-sr' : undefined}>
            {caption}
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cellClass(column)}>
                  {column.hideHeader ? <span className="sa-sr">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="sa-empty" colSpan={columns.length}>
                  <b>{empty.title}</b>
                  {empty.description}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className={isSelected?.(row) ? 'is-selected' : undefined}>
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass(column)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer !== undefined && (
            <tfoot>
              <tr>{footer}</tr>
            </tfoot>
          )}
        </table>
      </div>
      {after}
    </div>
  );
}
