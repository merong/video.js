import { useId } from 'react';

import { MockBadge, UnimplementedCard } from '../components';
import { MockPage } from './MockPage';

const V2_SPEC = '.agents/plans/ads-admin-v2-spec.md';
const GNUBOARD_SPEC = '.agents/plans/ads-admin-gnuboard-spec.md';

/** Approvals inbox: not built yet. */
export function MockApprovals() {
  return (
    <MockPage title="승인함">
      <UnimplementedCard
        title="승인함"
        purpose="소재 심사, 지면 편성, 집행 승인 요청을 탭으로 모아 게시본과 제출본의 차이를 보고 승인하거나 반려해요."
        specPath={`${V2_SPEC} §8.5`}
      />
    </MockPage>
  );
}

/** Line item creation, reached from the "집행 만들기" header action: not built yet. */
export function MockNewLineItem() {
  return (
    <MockPage title="집행 만들기">
      <UnimplementedCard
        title="집행 만들기"
        purpose="캠페인 아래에 집행을 기본, 기간·요일·시간대, 등급별 조건, 타겟, 소재 연결, 스킵 정책, 검토·제출 순서로 단계별로 만들어요."
        specPath={`${V2_SPEC} §8.2 집행 편집`}
      />
    </MockPage>
  );
}

/** V2 report area placed under the live basic stats inside the report screen. */
export function MockReportV2() {
  const titleId = useId();

  return (
    <section className="sa-card" aria-labelledby={titleId}>
      <div className="sa-card-h">
        <h2 className="sa-card-title" id={titleId}>
          리포트 v2
        </h2>
        <MockBadge />
      </div>
      <UnimplementedCard
        title="차원별 리포트"
        headingLevel={3}
        purpose="기간, 광고주, 캠페인, 위치 같은 조건으로 거르고 1–2개 기준으로 나눠 KPI, 추이, 표를 보고 같은 결과를 CSV로 내려받아요."
        specPath={`${V2_SPEC} §8.6`}
      />
    </section>
  );
}

/** Standalone settings: not built yet. */
export function MockSettings() {
  return (
    <MockPage title="설정">
      <UnimplementedCard
        title="설정"
        purpose="노출로 인정하는 시간(영상·이미지), 자기 승인 허용 여부, 광고주 리포트 링크의 기본 만료일을 정해요."
        specPath={`${V2_SPEC} §8.9`}
      />
    </MockPage>
  );
}

/** GnuBoard popup settings: not built yet. */
export function MockGnuboardSettings() {
  return (
    <MockPage title="설정">
      <UnimplementedCard
        title="설정"
        purpose="요청 기능 사용 여부, 요청할 수 있는 최소 회원 레벨, 안내 문구, 알림 받을 관리자, 업로드 제한, 기본 스킵·노출 인정 시간을 정해요."
        specPath={`${GNUBOARD_SPEC} §10.2 설정`}
      />
    </MockPage>
  );
}
