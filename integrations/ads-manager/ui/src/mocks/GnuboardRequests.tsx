import { useId, useState } from 'react';

import {
  ActivityLog,
  type AdStatus,
  Button,
  Card,
  Chip,
  ChipGroup,
  DataTable,
  type DataTableColumn,
  Input,
  KeyValue,
  Note,
  StatusBadge,
} from '../components';
import { MOCK_WRITE_REASON, MockPage, useMockView } from './MockPage';

type RequestStage = 'received' | 'review' | 'revision' | 'scheduled' | 'running' | 'ended' | 'rejected';

/** GnuBoard terms shown on the shared status colors. */
const STAGES = {
  received: { label: '접수', status: 'draft' },
  review: { label: '검토', status: 'pending' },
  revision: { label: '보완 요청', status: 'paused' },
  scheduled: { label: '집행 예정', status: 'scheduled' },
  running: { label: '집행', status: 'active' },
  ended: { label: '종료', status: 'done' },
  rejected: { label: '반려', status: 'rejected' },
} satisfies Record<RequestStage, { label: string; status: AdStatus }>;

const STAGE_ORDER: RequestStage[] = ['received', 'review', 'revision', 'scheduled', 'running', 'ended', 'rejected'];

interface AdRequest {
  no: number;
  title: string;
  member: string;
  stage: RequestStage;
  period: string;
  position: string;
  impressions: string;
  created: string;
}

const REQUESTS: AdRequest[] = [
  {
    no: 18,
    title: '예시 카페 가을 메뉴 홍보',
    member: '예시 회원 A',
    stage: 'received',
    period: '11.01 – 11.15',
    position: '프리롤',
    impressions: '20,000',
    created: '10.20',
  },
  {
    no: 17,
    title: '예시 학원 겨울 특강 모집',
    member: '예시 회원 B',
    stage: 'received',
    period: '11.10 – 12.10',
    position: '프리롤',
    impressions: '50,000',
    created: '10.19',
  },
  {
    no: 16,
    title: '예시 꽃집 개업 안내',
    member: '예시 회원 C',
    stage: 'review',
    period: '10.25 – 11.05',
    position: '포스트롤',
    impressions: '10,000',
    created: '10.18',
  },
  {
    no: 15,
    title: '예시 동호회 정기 모임 안내',
    member: '예시 회원 D',
    stage: 'revision',
    period: '10.28 – 11.10',
    position: '미드롤',
    impressions: '15,000',
    created: '10.16',
  },
  {
    no: 14,
    title: '예시 식당 점심 할인',
    member: '예시 회원 E',
    stage: 'scheduled',
    period: '10.22 – 11.21',
    position: '프리롤',
    impressions: '30,000',
    created: '10.14',
  },
  {
    no: 13,
    title: '예시 헬스장 회원 모집',
    member: '예시 회원 F',
    stage: 'running',
    period: '10.10 – 10.31',
    position: '프리롤',
    impressions: '40,000',
    created: '10.08',
  },
  {
    no: 12,
    title: '예시 서점 작가 초청 행사',
    member: '예시 회원 A',
    stage: 'running',
    period: '10.15 – 10.29',
    position: '미드롤',
    impressions: '12,000',
    created: '10.07',
  },
  {
    no: 11,
    title: '예시 공방 체험 수업',
    member: '예시 회원 G',
    stage: 'ended',
    period: '09.15 – 09.30',
    position: '포스트롤',
    impressions: '8,000',
    created: '09.10',
  },
  {
    no: 10,
    title: '예시 대출 상담 안내',
    member: '예시 회원 H',
    stage: 'rejected',
    period: '10.01 – 10.31',
    position: '프리롤',
    impressions: '100,000',
    created: '09.27',
  },
];

type Filter = 'all' | RequestStage;

function requestColumns(onOpen: (request: AdRequest) => void): DataTableColumn<AdRequest>[] {
  return [
    { key: 'no', header: '번호', numeric: true, render: (request) => request.no },
    {
      key: 'title',
      header: '제목',
      render: (request) => (
        <div className="sa-name">
          <b>{request.title}</b>
        </div>
      ),
    },
    { key: 'member', header: '회원', render: (request) => request.member },
    {
      key: 'stage',
      header: '상태',
      render: (request) => {
        const stage = STAGES[request.stage];

        return <StatusBadge status={stage.status} label={stage.label} />;
      },
    },
    { key: 'period', header: '희망 기간', render: (request) => <span className="sa-num">{request.period}</span> },
    { key: 'position', header: '희망 위치', render: (request) => request.position },
    { key: 'impressions', header: '희망 노출', numeric: true, render: (request) => request.impressions },
    { key: 'created', header: '등록', render: (request) => <span className="sa-num">{request.created}</span> },
    {
      key: 'open',
      header: '동작',
      hideHeader: true,
      render: (request) => (
        <Button size="sm" data-mock-nav aria-label={`요청 ${request.no} 열기`} onClick={() => onOpen(request)}>
          열기
        </Button>
      ),
    },
  ];
}

function countOf(filter: Filter) {
  return filter === 'all' ? REQUESTS.length : REQUESTS.filter((request) => request.stage === filter).length;
}

/** Processing records, newest first, for how far the request has gone. */
function historyOf(request: AdRequest) {
  const steps = [
    { id: 'received', time: `${request.created} 09:12`, text: '요청이 접수됐어요. 관리자에게 쪽지 알림을 보냈어요.' },
    { id: 'review', time: `${request.created} 10:31`, text: '예시 관리자가 검토를 시작했어요.' },
  ];
  const last = {
    received: [],
    review: [],
    revision: [
      { id: 'revision', time: `${request.created} 14:05`, text: '보완을 요청했어요. 클릭 URL을 다시 확인해 주세요.' },
    ],
    scheduled: [
      { id: 'approved', time: `${request.created} 15:20`, text: '승인했어요. 소재·캠페인·집행을 만들었어요.' },
    ],
    running: [{ id: 'approved', time: `${request.created} 15:20`, text: '승인했어요. 소재·캠페인·집행을 만들었어요.' }],
    ended: [{ id: 'ended', time: '09.30 23:59', text: '희망 기간이 끝나 집행을 마쳤어요.' }],
    rejected: [
      { id: 'rejected', time: `${request.created} 16:40`, text: '반려했어요. 광고 운영 기준에 맞지 않는 업종이에요.' },
    ],
  } satisfies Record<RequestStage, { id: string; time: string; text: string }[]>;

  return [...(request.stage === 'received' ? steps.slice(0, 1) : steps), ...last[request.stage]].reverse();
}

function RequestDetail({ request }: { request: AdRequest }) {
  return (
    <>
      <div className="sa-split">
        <Card title="요청서" flush>
          <KeyValue
            label="요청서"
            rows={[
              { key: 'title', label: '광고 이름', value: request.title },
              { key: 'creative', label: '소재', value: '예시 소재 1개 · 1920×1080 · 15초' },
              { key: 'url', label: '클릭 URL', value: 'https://example.com/' },
              { key: 'period', label: '희망 기간', value: request.period, numeric: true },
              { key: 'position', label: '희망 위치', value: request.position },
              { key: 'impressions', label: '희망 노출 수', value: request.impressions, numeric: true },
              { key: 'body', label: '요청 내용', value: '예시 요청 내용이에요. 실제 요청서의 본문이 여기에 보여요.' },
            ]}
          />
        </Card>
        <Card title="처리">
          <Note>승인할 때 정하는 최종 집행 값(기간, 위치, 게시판, 목표, 스킵)은 실제 화면에서 이 자리에 들어가요.</Note>
          <div className="sa-row">
            <Button disabledReason={MOCK_WRITE_REASON}>검토 시작</Button>
            <Button disabledReason={MOCK_WRITE_REASON}>답변만 남기기</Button>
            <Button disabledReason={MOCK_WRITE_REASON}>보완 요청</Button>
            <Button variant="danger" disabledReason={MOCK_WRITE_REASON}>
              반려
            </Button>
            <Button variant="primary" disabledReason={MOCK_WRITE_REASON}>
              승인하고 집행 만들기
            </Button>
          </div>
        </Card>
      </div>
      <Card title="처리 기록">
        <ActivityLog label="처리 기록" entries={historyOf(request)} />
      </Card>
    </>
  );
}

function RequestList({ onOpen }: { onOpen: (request: AdRequest) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const searchReasonId = useId();
  const rows = filter === 'all' ? REQUESTS : REQUESTS.filter((request) => request.stage === filter);

  return (
    <>
      <ChipGroup label="상태별 보기">
        {(['all', ...STAGE_ORDER] satisfies Filter[]).map((value) => (
          <Chip key={value} pressed={filter === value} count={countOf(value)} onClick={() => setFilter(value)}>
            {value === 'all' ? '전체' : STAGES[value].label}
          </Chip>
        ))}
      </ChipGroup>
      <DataTable
        caption="광고 요청 목록 (예시)"
        hideCaption
        dense
        columns={requestColumns(onOpen)}
        rows={rows}
        rowKey={(request) => String(request.no)}
        empty={{ title: '이 상태의 요청이 없어요', description: '다른 상태를 골라 보세요.' }}
        toolbar={
          <>
            <h2 className="sa-card-title">요청 {rows.length}건</h2>
            <span className="sa-spacer" />
            <Input
              type="search"
              aria-label="제목이나 회원 검색"
              placeholder="제목, 회원"
              disabled
              aria-describedby={searchReasonId}
            />
            <Button size="sm" disabled aria-describedby={searchReasonId}>
              검색
            </Button>
            <span className="sa-help" id={searchReasonId}>
              {MOCK_WRITE_REASON}
            </span>
          </>
        }
      />
    </>
  );
}

/** GnuBoard ad requests: stage chips and the request table, and a request detail opened in place. */
export function MockGnuboardRequests() {
  const { openId, show, headingRef } = useMockView();
  const request = REQUESTS.find((item) => String(item.no) === openId);

  if (!request) {
    return (
      <MockPage
        title="광고 요청 관리"
        headingRef={headingRef}
        description="회원이 보낸 광고 요청이에요. 처리할 요청이 위에 보여요."
      >
        <RequestList onOpen={(item) => show(String(item.no))} />
      </MockPage>
    );
  }

  const stage = STAGES[request.stage];

  return (
    <MockPage
      title={request.title}
      headingRef={headingRef}
      before={
        <Button size="sm" data-mock-nav onClick={() => show(null)}>
          ← 광고 요청 목록
        </Button>
      }
      titleExtra={<StatusBadge status={stage.status} label={stage.label} />}
      description={
        <>
          요청 {request.no} · {request.member} · 등록 <span className="sa-num">{request.created}</span>
        </>
      }
    >
      <RequestDetail request={request} />
    </MockPage>
  );
}
