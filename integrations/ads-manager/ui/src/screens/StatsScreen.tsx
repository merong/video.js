import { type FormEvent, useState } from 'react';

import { downloadStatsCsv, loadStats, type StatsMetrics, type StatsResponse, type StatsRow } from '../api/actions';
import { formatCount, formatRate, type StatsFilterInput, type StatsFilters, statsFilters } from '../api/model';
import { IDLE, info, Status, type Notice } from '../app/status';
import { DownloadIcon, PageHead } from '../app/ui';
import { useWorkspace } from '../app/workspace-context';
import { Button, DataTable, type DataTableColumn, Field, Input, KpiRow, KpiStat, Panel } from '../components';
import { HelpLink } from '../help';

type MetricKey = Exclude<keyof StatsMetrics, 'clickedStarts'>;

const METRICS: readonly (readonly [MetricKey, string])[] = [
  ['starts', '시작'],
  ['completes', '완료'],
  ['skips', '스킵'],
  ['clicks', '클릭'],
  ['errors', '오류'],
  ['completionRate', '완료율'],
  ['clickRate', '클릭률'],
];

const COLUMNS: readonly DataTableColumn<StatsRow>[] = [
  { key: 'adId', header: '광고 ID', render: (row) => row.adId ?? '—' },
  { key: 'videoId', header: '영상 ID', render: (row) => row.videoId ?? '—' },
  { key: 'boardId', header: '게시판', render: (row) => row.boardId ?? '—' },
  ...METRICS.map(([key, label]) => ({
    key,
    header: label,
    numeric: true,
    render: (row: StatsRow) => metric(key, row[key]),
  })),
];

interface StatsResult {
  filters: StatsFilters;
  data: StatsResponse;
}

/** F6: collected playback records only; previews never reach the collector. */
export function StatsScreen({ titleId, title, section }: { titleId: string; title: string; section?: string }) {
  const { api, session, run } = useWorkspace();
  const [form, setForm] = useState<StatsFilterInput>(() => {
    const today = siteToday(session.site.timeZone);

    return { from: today, to: today, adId: '', videoId: '', boardId: '' };
  });
  const [status, setStatus] = useState<Notice>(IDLE);
  const [result, setResult] = useState<StatsResult | null>(null);

  const update = (key: keyof StatsFilterInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));

    // Results always describe the conditions on screen; a stale table would mislead.
    if (result) {
      setResult(null);
      setStatus(info('조회 조건이 바뀌었어요. 통계 조회를 눌러 결과를 갱신해 주세요.'));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    void run(setStatus, async () => {
      const filters = statsFilters(form);
      const data = await loadStats(api, filters);

      setResult({ filters, data });
      setStatus(
        info(
          data.rows.length
            ? `${data.rows.length}개 조합의 결과예요.`
            : '이 조건에 수집된 기록이 없어요. 기간과 광고·영상·게시판 ID를 확인해 주세요.'
        )
      );
    });
  };

  const download = () =>
    void run(setStatus, async () => {
      const filters = statsFilters(form);
      const blob = await downloadStatsCsv(api, filters);

      saveBlob(blob, `ads-${filters.from}-${filters.to}.csv`);
      setStatus(info('현재 조회 조건의 CSV 다운로드를 요청했어요. 브라우저 다운로드 목록을 확인해 주세요.'));
    });

  const input = (key: keyof StatsFilterInput) => ({
    value: form[key],
    onChange: (event: { currentTarget: HTMLInputElement }) => update(key, event.currentTarget.value),
  });

  return (
    <>
      <PageHead
        titleId={titleId}
        title={title}
        description="실제 수집된 재생 기록이에요. 관리자 미리보기는 통계에 들어가지 않아요."
      />
      <Panel
        title={section ?? '조회 조건'}
        description={section ? '기간과 광고·영상·게시판으로 수집 기록을 조회해요.' : undefined}
        onSubmit={submit}
        footer={
          <>
            <Button icon={<DownloadIcon />} onClick={download}>
              현재 조건 CSV 다운로드
            </Button>
            <HelpLink termId="stats-csv" />
            <Button type="submit" variant="primary">
              통계 조회
            </Button>
          </>
        }
      >
        <div className="aa-form-grid">
          <Field label="시작일">
            <Input numeric type="date" required {...input('from')} />
          </Field>
          <Field label="종료일">
            <Input numeric type="date" required {...input('to')} />
          </Field>
          <Field label="광고 ID">
            <Input maxLength={128} placeholder="전체 광고" {...input('adId')} />
          </Field>
          <Field label="영상 ID">
            <Input maxLength={128} placeholder="전체 영상" {...input('videoId')} />
          </Field>
          <Field label="게시판 ID">
            <Input maxLength={128} placeholder="전체 게시판" {...input('boardId')} />
          </Field>
        </div>
        <Status status={status} />
      </Panel>

      {result ? (
        <div className="aa-stack">
          <p className="sa-small">
            {result.filters.from} ~ {result.filters.to} · {result.data.timeZone} · 집계 시각 {result.data.asOf}
          </p>
          <KpiRow label="조회 기간 합계" hero columns={METRICS.length}>
            {METRICS.map(([key, label]) => (
              <KpiStat key={key} label={label} value={metric(key, result.data.totals[key])} />
            ))}
          </KpiRow>
          {/* `KpiStat` labels are plain text, so the terms get their own line. */}
          <p className="sa-small">
            지표 설명: <HelpLink termId="start">시작</HelpLink> · <HelpLink termId="completion">완료와 완료율</HelpLink>{' '}
            · <HelpLink termId="click">클릭</HelpLink> · <HelpLink termId="click-through-rate">클릭률</HelpLink>
          </p>
          <DataTable
            caption="광고 · 영상 · 게시판별 성과"
            columns={COLUMNS}
            rows={result.data.rows}
            rowKey={(row) => `${row.adId ?? ''}\u0000${row.videoId ?? ''}\u0000${row.boardId ?? ''}`}
            empty={{ title: '수집된 기록이 없어요.', description: '기간이나 ID 조건을 바꿔 보세요.' }}
          />
        </div>
      ) : null}
    </>
  );
}

function metric(key: MetricKey, value: number | null): string {
  return key.endsWith('Rate') ? formatRate(value) : formatCount(value);
}

/** Today's date (`YYYY-MM-DD`) in the site's reporting time zone, which the server aggregates by. */
export function siteToday(timeZone: string, now = new Date()): string {
  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }

  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${date.year}-${date.month}-${date.day}`;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
