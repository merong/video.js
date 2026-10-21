import { useId, useState } from 'react';

import {
  ActivityLog,
  type AdStatus,
  type AdTier,
  Button,
  Card,
  Chip,
  ChipGroup,
  DataTable,
  type DataTableColumn,
  KpiRow,
  KpiStat,
  Note,
  Progress,
  STATUS_LABELS,
  StatusBadge,
  TierTag,
  Toggle,
} from '../components';
import { MOCK_WRITE_REASON, MockPage, useMockView } from './MockPage';

interface Pace {
  value: number;
  expected: number;
  caption: string;
  behind?: boolean;
}

interface LineItem {
  id: string;
  name: string;
  tier: AdTier;
  position: string;
  period: string;
  condition: string;
  target: string;
  pace?: Pace;
  delivered: string;
  creatives: string;
  on: boolean;
  status: AdStatus;
  statusNote?: string;
}

interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  period: string;
  tiers: { tier: AdTier; count: string }[];
  /** Lowest guaranteed pace in the campaign. */
  pace?: Pace;
  paceText: string;
  yesterday: string;
  status: AdStatus;
  statusLabel?: string;
  summary: { impressions: string; goal: string; completion: string; ctr: string };
  notice?: string;
  lines: LineItem[];
  history: { id: string; time: string; text: string }[];
}

const CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: '예시 캠페인 A',
    advertiser: '예시 광고주 A',
    period: '10.01 – 10.31',
    tiers: [
      { tier: 'guaranteed', count: '2' },
      { tier: 'house', count: '1' },
    ],
    pace: { value: 64, expected: 65, caption: '64.0% · 기대 65.0% · 일 진도 98%' },
    paceText: '',
    yesterday: '31,240',
    status: 'active',
    summary: { impressions: '412,806', goal: '보장 목표 합계 550,000', completion: '71.2%', ctr: '1.84%' },
    notice: '미드롤 보장 B 수정본 r4가 승인 대기 중이에요. 승인 전까지는 게시본 r3으로 계속 집행해요.',
    lines: [
      {
        id: 'l1',
        name: '프리롤 보장 A',
        tier: 'guaranteed',
        position: '프리롤',
        period: '10.01 – 10.31',
        condition: '목표 400,000',
        target: '예시 게시판 1, 2 · 매일 18–24시',
        pace: { value: 64, expected: 65, caption: '256,118 / 400,000 · 일 진도 98%' },
        delivered: '256,118',
        creatives: '2개 · 비중 7:3',
        on: true,
        status: 'active',
      },
      {
        id: 'l2',
        name: '미드롤 보장 B',
        tier: 'guaranteed',
        position: '미드롤',
        period: '10.10 – 10.31',
        condition: '목표 150,000',
        target: '사이트 전체',
        pace: { value: 52, expected: 50, caption: '78,402 / 150,000 · 일 진도 104%' },
        delivered: '78,402',
        creatives: '1개 · v4 심사 대기',
        on: true,
        status: 'active',
        statusNote: '수정본 r4 승인 대기',
      },
      {
        id: 'l3',
        name: '포스트롤 브랜드 하우스',
        tier: 'house',
        position: '포스트롤',
        period: '상시',
        condition: '가중치 1',
        target: '사이트 전체',
        delivered: '78,286',
        creatives: '1개',
        on: false,
        status: 'paused',
        statusNote: '10.18 14:20 예시 운영자',
      },
    ],
    history: [
      { id: 'h1', time: '10.20 11:02', text: '미드롤 보장 B 승인을 요청했어요. 목표 120,000 → 150,000' },
      { id: 'h2', time: '10.09 17:40', text: '예시 승인자가 미드롤 보장 B를 승인했어요.' },
      { id: 'h3', time: '09.29 10:15', text: '예시 승인자가 프리롤 보장 A를 승인했어요.' },
      { id: 'h4', time: '09.28 16:03', text: '예시 승인자가 프리롤 보장 A를 반려했어요. 클릭 URL이 계약서와 달라요.' },
    ],
  },
  {
    id: 'c2',
    name: '예시 캠페인 B',
    advertiser: '예시 광고주 B',
    period: '10.05 – 11.05',
    tiers: [{ tier: 'period', count: '점유율 100%' }],
    paceText: '–',
    yesterday: '8,902',
    status: 'active',
    summary: { impressions: '120,334', goal: '기간제 · 목표 없음', completion: '68.4%', ctr: '0.92%' },
    lines: [
      {
        id: 'l4',
        name: '프리롤 기간제',
        tier: 'period',
        position: '프리롤',
        period: '10.05 – 11.05',
        condition: '점유율 100%',
        target: '예시 게시판 3',
        delivered: '120,334',
        creatives: '1개',
        on: true,
        status: 'active',
      },
    ],
    history: [{ id: 'h5', time: '10.03 09:20', text: '예시 승인자가 프리롤 기간제를 승인했어요.' }],
  },
  {
    id: 'c3',
    name: '예시 캠페인 C',
    advertiser: '예시 광고주 C',
    period: '10.10 – 10.24',
    tiers: [{ tier: 'guaranteed', count: '1' }],
    pace: { value: 41, expected: 71, caption: '41.0% · 기대 71.0% · 일 진도 58%', behind: true },
    paceText: '',
    yesterday: '12,015',
    status: 'active',
    summary: { impressions: '82,140', goal: '보장 목표 합계 200,000', completion: '73.9%', ctr: '2.31%' },
    lines: [
      {
        id: 'l5',
        name: '앱 설치 프리롤',
        tier: 'guaranteed',
        position: '프리롤',
        period: '10.10 – 10.24',
        condition: '목표 200,000',
        target: '사이트 전체',
        pace: { value: 41, expected: 71, caption: '82,140 / 200,000 · 일 진도 58%', behind: true },
        delivered: '82,140',
        creatives: '2개 · 비중 5:5',
        on: true,
        status: 'active',
      },
    ],
    history: [{ id: 'h6', time: '10.08 15:12', text: '예시 승인자가 앱 설치 프리롤을 승인했어요.' }],
  },
  {
    id: 'c4',
    name: '예시 캠페인 D',
    advertiser: '예시 광고주 D',
    period: '11.01 – 11.30',
    tiers: [{ tier: 'guaranteed', count: '1' }],
    paceText: '시작 전',
    yesterday: '–',
    status: 'pending',
    summary: { impressions: '–', goal: '보장 목표 합계 300,000', completion: '–', ctr: '–' },
    lines: [
      {
        id: 'l6',
        name: '겨울 프리롤 보장',
        tier: 'guaranteed',
        position: '프리롤',
        period: '11.01 – 11.30',
        condition: '목표 300,000',
        target: '예시 게시판 1',
        delivered: '–',
        creatives: '1개 · 심사 대기',
        on: false,
        status: 'pending',
      },
    ],
    history: [{ id: 'h7', time: '10.19 16:45', text: '겨울 프리롤 보장 승인을 요청했어요.' }],
  },
  {
    id: 'c5',
    name: '예시 캠페인 E',
    advertiser: '예시 광고주 A',
    period: '09.01 – 09.30',
    tiers: [{ tier: 'guaranteed', count: '1' }],
    pace: { value: 97, expected: 100, caption: '목표 300,000 중 291,480', behind: true },
    paceText: '',
    yesterday: '–',
    status: 'under',
    summary: { impressions: '291,480', goal: '보장 목표 합계 300,000', completion: '70.1%', ctr: '1.12%' },
    lines: [
      {
        id: 'l7',
        name: '추석 프리롤 보장',
        tier: 'guaranteed',
        position: '프리롤',
        period: '09.01 – 09.30',
        condition: '목표 300,000',
        target: '사이트 전체',
        pace: { value: 97, expected: 100, caption: '291,480 / 300,000 · 미달', behind: true },
        delivered: '291,480',
        creatives: '1개',
        on: false,
        status: 'under',
      },
    ],
    history: [{ id: 'h8', time: '09.30 23:59', text: '기간이 끝나 미달 종료됐어요.' }],
  },
];

type Filter = 'all' | AdStatus;

const FILTERS: Filter[] = ['all', 'active', 'pending', 'under'];

function PaceCell({ pace, text }: { pace?: Pace | undefined; text: string }) {
  if (!pace) return <span className="sa-small">{text}</span>;

  return <Progress value={pace.value} expected={pace.expected} behind={pace.behind} caption={pace.caption} />;
}

function TierList({ tiers }: { tiers: Campaign['tiers'] }) {
  return (
    <div className="sa-row">
      {tiers.map(({ tier, count }) => (
        <span key={tier} className="sa-row">
          <TierTag tier={tier} />
          <span className="sa-small">{count}</span>
        </span>
      ))}
    </div>
  );
}

function CampaignList({ onOpen }: { onOpen: (campaign: Campaign) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const rows = filter === 'all' ? CAMPAIGNS : CAMPAIGNS.filter((campaign) => campaign.status === filter);

  const columns: DataTableColumn<Campaign>[] = [
    {
      key: 'name',
      header: '캠페인',
      render: (campaign) => (
        <div className="sa-name">
          <b>{campaign.name}</b>
          <small>{campaign.advertiser}</small>
        </div>
      ),
    },
    { key: 'period', header: '계약 기간', render: (campaign) => <span className="sa-num">{campaign.period}</span> },
    { key: 'tiers', header: '집행', render: (campaign) => <TierList tiers={campaign.tiers} /> },
    {
      key: 'pace',
      header: '보장 진도 (가장 낮은 집행)',
      render: (campaign) => <PaceCell pace={campaign.pace} text={campaign.paceText} />,
    },
    { key: 'yesterday', header: '어제 노출', numeric: true, render: (campaign) => campaign.yesterday },
    {
      key: 'status',
      header: '상태',
      render: (campaign) => <StatusBadge status={campaign.status} />,
    },
    {
      key: 'open',
      header: '동작',
      hideHeader: true,
      pinEnd: true,
      render: (campaign) => (
        <Button size="sm" data-mock-nav aria-label={`${campaign.name} 열기`} onClick={() => onOpen(campaign)}>
          열기
        </Button>
      ),
    },
  ];

  return (
    <>
      <ChipGroup label="상태별 보기">
        {FILTERS.map((value) => (
          <Chip
            key={value}
            pressed={filter === value}
            count={value === 'all' ? CAMPAIGNS.length : CAMPAIGNS.filter((c) => c.status === value).length}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? '전체' : STATUS_LABELS[value]}
          </Chip>
        ))}
      </ChipGroup>
      <DataTable
        caption="캠페인 목록 (예시)"
        hideCaption
        columns={columns}
        rows={rows}
        rowKey={(campaign) => campaign.id}
        empty={{ title: '이 상태의 캠페인이 없어요', description: '다른 상태를 골라 보세요.' }}
        toolbar={
          <>
            <h2 className="sa-card-title">캠페인 {rows.length}개</h2>
            <span className="sa-spacer" />
            <span className="sa-small">진도 막대의 세로 눈금은 지금까지의 기대 진도예요.</span>
          </>
        }
      />
    </>
  );
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const toggleReasonId = useId();

  const columns: DataTableColumn<LineItem>[] = [
    {
      key: 'on',
      header: '켜기',
      render: (line) => (
        <Toggle checked={line.on} disabled aria-label={`${line.name} 켜기`} aria-describedby={toggleReasonId} />
      ),
    },
    {
      key: 'name',
      header: '집행',
      render: (line) => (
        <div className="sa-name">
          <b>{line.name}</b>
          <small>
            <TierTag tier={line.tier} /> {line.position} · <span className="sa-num">{line.period}</span>
          </small>
        </div>
      ),
    },
    {
      key: 'condition',
      header: '조건',
      render: (line) => (
        <div className="sa-name">
          <span className="sa-num">{line.condition}</span>
          <small>{line.target}</small>
        </div>
      ),
    },
    {
      key: 'pace',
      header: '진도',
      render: (line) => <PaceCell pace={line.pace} text={`– · 누적 노출 ${line.delivered}`} />,
    },
    { key: 'creatives', header: '소재', render: (line) => line.creatives },
    {
      key: 'status',
      header: '상태',
      render: (line) => (
        <div className="sa-name">
          <StatusBadge status={line.status} />
          {line.statusNote !== undefined && <small>{line.statusNote}</small>}
        </div>
      ),
    },
  ];

  return (
    <>
      {campaign.notice !== undefined && (
        <Note tone="warn" title="승인 대기">
          {campaign.notice}
        </Note>
      )}
      <KpiRow label="캠페인 요약">
        <KpiStat label="누적 노출" value={campaign.summary.impressions} note={campaign.summary.goal} />
        <KpiStat label="완료율" value={campaign.summary.completion} note="완료 ÷ 시작" />
        <KpiStat label="클릭률" value={campaign.summary.ctr} note="클릭한 노출 ÷ 노출" />
      </KpiRow>
      <div className="sa-split">
        <DataTable
          caption={`${campaign.name}의 집행 (예시)`}
          hideCaption
          dense
          columns={columns}
          rows={campaign.lines}
          rowKey={(line) => line.id}
          empty={{ title: '아직 집행이 없어요' }}
          toolbar={
            <>
              <h2 className="sa-card-title">집행 {campaign.lines.length}개</h2>
              <span className="sa-spacer" />
              <span className="sa-small" id={toggleReasonId}>
                목업이라 켜고 끄기를 바꿀 수 없어요.
              </span>
            </>
          }
        />
        <Card title="승인 이력">
          <ActivityLog label="승인 이력" entries={campaign.history} />
        </Card>
      </div>
    </>
  );
}

/** Campaigns mock: list with pace bars, and a detail view with its execution table. */
export function MockCampaigns() {
  const { openId, show, headingRef } = useMockView();
  const campaign = CAMPAIGNS.find((item) => item.id === openId);

  if (!campaign) {
    return (
      <MockPage
        title="캠페인"
        headingRef={headingRef}
        description="광고주와의 계약 단위예요. 실제 노출 조건은 캠페인 안의 집행에서 정해요."
        actions={
          <Button variant="primary" disabledReason={MOCK_WRITE_REASON}>
            캠페인 만들기
          </Button>
        }
      >
        <CampaignList onOpen={(item) => show(item.id)} />
      </MockPage>
    );
  }

  return (
    <MockPage
      title={campaign.name}
      headingRef={headingRef}
      before={
        <Button size="sm" data-mock-nav onClick={() => show(null)}>
          ← 캠페인 목록
        </Button>
      }
      titleExtra={<StatusBadge status={campaign.status} />}
      description={
        <>
          광고주 {campaign.advertiser} · 계약 기간 <span className="sa-num">{campaign.period}</span>
        </>
      }
      actions={
        <Button variant="primary" disabledReason={MOCK_WRITE_REASON}>
          이 캠페인에 집행 추가
        </Button>
      }
    >
      <CampaignDetail campaign={campaign} />
    </MockPage>
  );
}
