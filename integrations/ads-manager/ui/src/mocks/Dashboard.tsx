import {
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  KpiRow,
  KpiStat,
  type AdStatus,
  StatusBadge,
  type TodoItem,
  TodoBanner,
} from '../components';
import { MOCK_WRITE_REASON, MockPage } from './MockPage';

const TODOS: TodoItem[] = [
  { id: 'creative', title: '소재 심사 대기', detail: '예시 소재 B v4 외 1건 · 가장 오래된 건 10.19', count: 2 },
  { id: 'line', title: '집행 승인 대기', detail: '프리롤 보장 · 메인 r5', count: 1 },
  { id: 'placement', title: '지면 편성 승인 대기', detail: '대기 없음', count: 0 },
  { id: 'ending', title: '7일 안에 종료되는 캠페인', detail: '예시 캠페인 C · 예시 캠페인 H', count: 2 },
  { id: 'rejected', title: '내 제출 중 반려', detail: '예시 소재 D v1 · 10.15 반려', count: 1, bad: true },
];

interface RecentLine {
  id: string;
  name: string;
  campaign: string;
  position: string;
  impressions: string;
  updated: string;
  status: AdStatus;
}

const RECENT_LINES: RecentLine[] = [
  {
    id: 'l1',
    name: '프리롤 보장 A',
    campaign: '예시 캠페인 A',
    position: '프리롤',
    impressions: '12,480',
    updated: '10.20 14:52',
    status: 'active',
  },
  {
    id: 'l2',
    name: '미드롤 보장 B',
    campaign: '예시 캠페인 A',
    position: '미드롤',
    impressions: '4,318',
    updated: '10.20 11:02',
    status: 'pending',
  },
  {
    id: 'l3',
    name: '앱 설치 프리롤',
    campaign: '예시 캠페인 C',
    position: '프리롤',
    impressions: '6,207',
    updated: '10.19 18:30',
    status: 'active',
  },
  {
    id: 'l4',
    name: '포스트롤 브랜드 하우스',
    campaign: '예시 캠페인 F',
    position: '포스트롤',
    impressions: '–',
    updated: '10.18 14:20',
    status: 'paused',
  },
];

const RECENT_COLUMNS: DataTableColumn<RecentLine>[] = [
  {
    key: 'name',
    header: '집행',
    render: (line) => (
      <div className="sa-name">
        <b>{line.name}</b>
        <small>{line.campaign}</small>
      </div>
    ),
  },
  { key: 'position', header: '위치', render: (line) => line.position },
  { key: 'impressions', header: '오늘 노출', numeric: true, render: (line) => line.impressions },
  { key: 'updated', header: '최근 변경', render: (line) => <span className="sa-num">{line.updated}</span> },
  { key: 'status', header: '상태', render: (line) => <StatusBadge status={line.status} /> },
];

const ENDING = [
  { id: 'c3', name: '예시 캠페인 C', detail: '예시 광고주 C · 집행 1 · 10.24 종료', dday: 'D-4' },
  { id: 'c8', name: '예시 캠페인 H', detail: '예시 광고주 B · 집행 2 · 10.26 종료', dday: 'D-6' },
];

/** Dashboard mock: to-dos, today's KPIs against yesterday, recent executions. */
export function MockDashboard() {
  return (
    <MockPage title="대시보드" description="10.20 15:00 기준 예시 수치예요.">
      <TodoBanner
        label="오늘의 할 일"
        title={
          <>
            예시 운영자 님, 확인할 일이
            <br />
            <em>6</em>건 있어요
          </>
        }
        description="오래된 승인 대기부터 처리하면 집행이 늦어지지 않아요."
        actions={
          <Button variant="accent" disabledReason={MOCK_WRITE_REASON}>
            승인함 열기
          </Button>
        }
        items={TODOS}
      />
      <KpiRow label="오늘 요약, 어제 같은 시각과 비교" hero>
        <KpiStat label="노출" value="28,412" delta={{ text: '▲ 5.4%', tone: 'good', compare: '어제 26,950' }} />
        <KpiStat label="채움률" value="77.5%" delta={{ text: '▲ 1.2%p', tone: 'good', compare: '어제 76.3%' }} />
        <KpiStat label="완료율" value="71.2%" delta={{ text: '▼ 0.8%p', tone: 'bad', compare: '어제 72.0%' }} />
        <KpiStat label="클릭률" value="0.84%" delta={{ text: '▲ 0.06%p', tone: 'good', compare: '어제 0.78%' }} />
      </KpiRow>
      <div className="sa-grid2">
        <DataTable
          caption="최근 집행"
          columns={RECENT_COLUMNS}
          rows={RECENT_LINES}
          rowKey={(line) => line.id}
          empty={{ title: '최근 바뀐 집행이 없어요' }}
        />
        <Card title="곧 끝나는 캠페인" actions={<span className="sa-small">7일 안</span>}>
          <ul className="sa-endl">
            {ENDING.map((campaign) => (
              <li key={campaign.id}>
                <span className="sa-thumb" aria-hidden="true" />
                <span>
                  <b>{campaign.name}</b>
                  <small className="sa-small">{campaign.detail}</small>
                </span>
                <span className="sa-dday">{campaign.dday}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </MockPage>
  );
}
