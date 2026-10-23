import type { HelpHost, HelpState, HelpTermId } from './terms';

export interface MenuState {
  state: HelpState;
  /** Replaces the plain state name when one menu mixes states. */
  label?: string | undefined;
}

export interface HelpMenu {
  /** Route id; the card links to `#/<route>`. */
  route: string;
  name: string;
  summary: string;
  states: readonly MenuState[];
}

// Menus and states follow 근거표 §1.1; 플레이어 follows 계약 §3.2. 승인함 and 설정 are placeholder cards, so they read 준비 중 (D10).
const HELP_MENUS = {
  standalone: [
    {
      route: 'dashboard',
      name: '대시보드',
      summary: '오늘 노출·채움률·완료율·클릭률, 확인할 일, 최근 집행을 예시 값으로 보여 줘요.',
      states: [{ state: 'mock' }],
    },
    {
      route: 'campaigns',
      name: '캠페인',
      summary: '광고주와의 계약 단위 목록과 상세(집행 표, 승인 이력)를 예시로 보여 줘요.',
      states: [{ state: 'mock' }],
    },
    {
      route: 'creatives',
      name: '소재',
      summary: '영상·이미지·GIF 소재를 URL이나 파일로 등록하고, 새 버전으로 고치고, 보관해요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'schedule',
      name: '지면 편성',
      summary:
        '사이트·게시판·분류·영상의 광고 구간을 편집해 초안 저장과 게시를 하고, 미리보기와 재생 테스트를 해요. 구간마다 광고 하나만 무작위로 골라 보여 줄 수도 있어요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'players',
      name: '플레이어',
      summary:
        '플레이어 종류·테마·재생 동작·언어·광고 화면을 프리셋으로 저장하고, 사이트에 적용할 프리셋과 로더 설치 코드, 옵션 설명을 봐요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'lms',
      name: '강의',
      summary:
        '강의 프리셋 영상의 학습자별 진도와 완료를 보고 CSV로 내려받아요. 외부 LMS 연동 키와 시험 토큰도 만들어요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'approvals',
      name: '승인함',
      summary: '소재 심사, 지면 편성, 집행 승인 요청을 모아 승인하거나 반려할 화면이에요.',
      states: [{ state: 'planned' }],
    },
    {
      route: 'reports',
      name: '리포트',
      summary: '위쪽 기본 통계는 실제로 조회하고 CSV로 내려받아요. 아래 차원별 리포트는 아직 없어요.',
      states: [
        { state: 'live', label: '기본 통계 지금 동작' },
        { state: 'planned', label: '리포트 v2 준비 중' },
      ],
    },
    {
      route: 'settings',
      name: '설정',
      summary: '노출 인정 시간, 자기 승인 허용, 리포트 링크 만료일을 정할 화면이에요.',
      states: [{ state: 'planned' }],
    },
    {
      route: 'new-line-item',
      name: '집행 만들기',
      summary: '캠페인 아래 집행을 단계별로 만들 화면이에요. 메뉴 대신 상단 버튼으로 가요.',
      states: [{ state: 'planned' }],
    },
  ],
  gnuboard: [
    {
      route: 'requests',
      name: '광고 요청',
      summary: '회원이 보낸 광고 요청 목록과 상세, 처리 단계를 예시로 보여 줘요.',
      states: [{ state: 'mock' }],
    },
    {
      route: 'house',
      name: '하우스 광고',
      summary: '사이트가 직접 내보내는 광고 소재를 등록하고, 새 버전으로 고치고, 보관해요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'schedule',
      name: '지면 편성',
      summary:
        '게시판·분류·영상을 검색해 광고 구간을 편집하고, 초안 저장과 게시, 미리보기와 재생 테스트를 해요. 구간마다 광고 하나만 무작위로 골라 보여 줄 수도 있어요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'players',
      name: '플레이어 설정',
      summary:
        '사이트의 모든 영상 플레이어가 쓰는 설정 하나를 고쳐요. 플레이어 종류·테마·로고·재생 동작·화면 표시·단축키·컨트롤·광고 화면을 바꾸고 미리보기로 확인해요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'stats',
      name: '통계',
      summary: '기간·광고·영상·게시판 ID로 재생 기록을 조회하고 CSV로 내려받아요.',
      states: [{ state: 'live' }],
    },
    {
      route: 'settings',
      name: '설정',
      summary: '요청 기능 사용, 최소 회원 레벨, 업로드 제한, 기본 스킵 같은 값을 정할 화면이에요.',
      states: [{ state: 'planned' }],
    },
  ],
} satisfies Record<HelpHost, readonly HelpMenu[]>;

export function menusFor(host: HelpHost): readonly HelpMenu[] {
  return HELP_MENUS[host];
}

export interface WorkStep {
  id: string;
  label: string;
  /** Term that explains the step. */
  termId: HelpTermId;
}

// Preview plays the unsaved draft, so it comes before saving and publishing (근거표 D1).
export function workSteps(host: HelpHost): WorkStep[] {
  return [
    {
      id: 'creative',
      label: host === 'gnuboard' ? '하우스 광고 등록' : '소재 등록',
      termId: 'creative',
    },
    { id: 'schedule', label: '지면 편성', termId: 'ad-break' },
    { id: 'preview', label: '미리보기', termId: 'preview' },
    { id: 'draft', label: '초안 저장', termId: 'draft' },
    { id: 'publish', label: '게시', termId: 'publish' },
    { id: 'play-test', label: '재생 테스트', termId: 'play-test' },
    { id: 'stats', label: '통계', termId: 'start' },
  ];
}
