/** Which admin the help is shown in. Some names differ: 소재 ↔ 하우스 광고, 리포트 ↔ 통계. */
export type HelpHost = 'standalone' | 'gnuboard';

/** `live`: works now. `mock`: drawn with static data. `planned`: not built yet. */
export type HelpState = 'live' | 'mock' | 'planned';

/** Every help term id, matching `.agents/plans/ads-admin-help-facts.md` and `ads-admin-player-facts.md` §5. */
export const helpTerms = [
  'ad-break',
  'pre-roll',
  'mid-roll',
  'post-roll',
  'ad-item',
  'creative',
  'creative-source',
  'alt-text',
  'click-through-url',
  'image-display-time',
  'archive',
  'skip-offset',
  'ad-skip',
  'target-scope',
  'inherit',
  'replace',
  'disabled',
  'fixed-video-id',
  'video-context',
  'draft',
  'draft-revision',
  'revision-conflict',
  'publish',
  'publish-version',
  'preview',
  'play-test',
  'play-test-page',
  'player-preset',
  'player-default-preset',
  'player-type',
  'player-skin',
  'player-theme-property',
  'player-accent-color',
  'player-object-fit',
  'player-ad-overlay',
  'player-ad-language',
  'player-install-snippet',
  'player-loader',
  'player-placeholder',
  'player-media-engine',
  'player-demo-page',
  'player-guide-page',
  'player-help-page',
  'lms-progress-rate',
  'lms-completion',
  'lms-seek-limit',
  'lms-learner-token',
  'lms-key',
  'lms-manifest',
  'start',
  'completion',
  'click',
  'click-through-rate',
  'stats-csv',
  'advertiser',
  'campaign',
  'line-item',
  'approval',
  'tier',
  'delivery-status',
  'impression',
  'house-ad',
  'ad-request',
] as const;

export type HelpTermId = (typeof helpTerms)[number];

export function isHelpTermId(value: string | undefined): value is HelpTermId {
  return helpTerms.some((id) => id === value);
}

export const HELP_STATE_LABELS = {
  live: '지금 동작',
  mock: '목업',
  planned: '준비 중',
} satisfies Record<HelpState, string>;

export type HelpCategoryId =
  | 'position'
  | 'creative'
  | 'skip'
  | 'target'
  | 'publish'
  | 'playback'
  | 'player'
  | 'lms'
  | 'stats'
  | 'v2'
  | 'gnuboard';

export interface HelpCategory {
  id: HelpCategoryId;
  name: string;
  gnuboard?: string | undefined;
}

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  { id: 'position', name: '광고가 나오는 자리' },
  { id: 'creative', name: '소재', gnuboard: '하우스 광고(소재)' },
  { id: 'skip', name: '스킵' },
  { id: 'target', name: '편성 대상과 상속' },
  { id: 'publish', name: '초안과 게시' },
  { id: 'playback', name: '미리보기와 재생 테스트' },
  { id: 'player', name: '플레이어' },
  { id: 'lms', name: '강의' },
  { id: 'stats', name: '통계' },
  { id: 'v2', name: '캠페인과 승인' },
  { id: 'gnuboard', name: '그누보드 전용' },
];

interface TermWords {
  name: string;
  /** One or two sentences, read before the motion. */
  summary: string;
  /** Limits, defaults and exceptions worth knowing. */
  detail?: string | undefined;
  /** The motion in one sentence; it is the figure's accessible name. */
  motionLabel: string;
  /** Screen and label where the term shows up. */
  screens: string;
}

export interface HelpTermData extends TermWords {
  category: HelpCategoryId;
  state: HelpState;
  /** Hosts that show the term; both when omitted. */
  hosts?: readonly HelpHost[] | undefined;
  /** Terms to read next, linked under the card. */
  related?: readonly HelpTermId[] | undefined;
  /** GnuBoard wording where it differs. */
  gnuboard?: Partial<TermWords> | undefined;
}

const STATS_SCREEN = { standalone: '리포트 › 기본 통계', gnuboard: '통계' };
const PREVIEW_MOTION =
  '두 줄 그림이에요. 미리보기에서 나온 재생 신호는 통계로 가지 않고, 재생 테스트에서 나온 신호만 통계에 쌓여요.';
const PIPS_CLICKED =
  '시작 10칸 가운데 한 광고에서 링크를 두 번, 다른 광고에서 한 번 눌러요. 클릭은 3이고, 링크를 누른 시작은 2개예요.';

// Facts follow `.agents/plans/ads-admin-help-facts.md` (근거표). Keep every sentence traceable to it.
export const HELP_TERMS = {
  'ad-break': {
    category: 'position',
    state: 'live',
    name: '광고 구간',
    summary:
      '본편 시작 전, 재생 중 정한 초, 본편이 끝난 뒤 가운데 한 시점에 끼어드는 광고 묶음이에요. 한 구간에 광고를 1~20개 넣으면 차례로 재생돼요.',
    detail:
      '편성 하나에 구간은 100개까지 둘 수 있고, 광고가 없는 빈 구간은 저장할 수 없어요. 프리롤과 포스트롤은 하나씩, 미드롤은 같은 초에 하나만 둘 수 있어요.',
    motionLabel: '본편 앞에 프리롤, 본편 중간에 미드롤, 본편이 끝난 뒤 포스트롤이 차례로 재생되는 그림이에요.',
    screens: '지면 편성 › 광고 구간',
  },
  'pre-roll': {
    category: 'position',
    state: 'live',
    name: '프리롤',
    summary:
      '본편이 처음 재생되기 직전에 나오는 구간이에요. 시청자가 재생을 누른 뒤 시작하고, 끝나면 본편이 0초부터 재생돼요.',
    motionLabel: '프리롤 광고가 먼저 끝까지 재생된 뒤 본편이 0초부터 시작하는 그림이에요.',
    screens: '지면 편성 › 프리롤 · 시작 전',
  },
  'mid-roll': {
    category: 'position',
    state: 'live',
    name: '미드롤',
    summary: '본편 재생 위치가 정한 초를 지나면 나오는 구간이에요. 광고가 끝나면 본편이 멈췄던 자리부터 이어져요.',
    detail:
      '새 미드롤은 10초로 채워져요. 앞으로 건너뛰어 여러 미드롤을 한꺼번에 지나면 가장 이른 하나만 나오고, 한 번 나온 구간은 다시 나오지 않아요. 위치가 본편 길이와 같거나 길면 그 영상에서는 프리롤·포스트롤까지 편성 전체가 꺼져요. 서버는 본편 길이를 검사하지 않으니 위치를 직접 확인해 주세요.',
    motionLabel: '본편이 10초까지 재생되다 멈추고 미드롤 광고가 재생된 뒤 본편이 10초부터 이어지는 그림이에요.',
    screens: '지면 편성 › 본편 재생 위치 (초)',
  },
  'post-roll': {
    category: 'position',
    state: 'live',
    name: '포스트롤',
    summary: '본편이 끝난 뒤 나오는 구간이에요. 포스트롤이 끝나도 본편은 다시 재생되지 않아요.',
    detail: '끝까지 건너뛰면 남은 미드롤은 나오지 않고 포스트롤만 나와요.',
    motionLabel: '본편이 끝까지 재생된 뒤 포스트롤 광고가 재생되고 그대로 끝나는 그림이에요.',
    screens: '지면 편성 › 포스트롤 · 종료 후',
  },
  'ad-item': {
    category: 'position',
    state: 'live',
    name: '광고 항목과 순서',
    summary:
      '구간에 넣은 소재 하나와 그 재생 설정(클릭 목적지, 스킵, 이미지 표시 시간)이에요. 목록 순서대로 재생되고, 마지막 항목이 끝나면 본편이 이어져요.',
    detail:
      '항목은 넣을 때 고른 소재 버전을 계속 써요. 한 항목이 끝나거나 건너뛰거나 오류가 나면 다음 항목으로 넘어가요.',
    motionLabel: '한 구간 안의 광고 1, 2, 3이 차례로 재생된 뒤 본편이 이어지는 그림이에요.',
    screens: '지면 편성 › 추가할 소재',
  },

  creative: {
    category: 'creative',
    state: 'live',
    name: '소재',
    summary:
      '광고로 재생할 영상이나 이미지 파일과 그 이름·대체텍스트예요. 저장할 때마다 새 버전이 생기고 이전 버전은 남아요.',
    detail:
      'MP4·WebM 영상과 JPEG·PNG·WebP·GIF 이미지를 쓸 수 있고, GIF는 이미지로 다뤄요. 이미 편성에 넣은 항목은 그때 고른 버전을 계속 써요.',
    motionLabel: '소재 v1을 고쳐 저장하면 v2가 새로 생기고, 편성에 넣어 둔 항목은 v1을 그대로 쓰는 그림이에요.',
    screens: '소재',
    gnuboard: {
      summary:
        '사이트가 직접 내보내는 광고 영상이나 이미지예요. 그누보드에서는 하우스 광고 메뉴에서 관리해요. 저장할 때마다 새 버전이 생기고 이전 버전은 남아요.',
      screens: '하우스 광고',
    },
  },
  'creative-source': {
    category: 'creative',
    state: 'live',
    name: '등록 방식',
    summary:
      '외부 URL은 이미 공개된 파일 주소를 소재로 기록하고, 파일 업로드는 파일을 서버에 저장해요. 업로드한 파일의 형식은 서버가 파일 내용으로 판정해요.',
    detail:
      'URL은 http(s)://로 시작하는 주소나 /로 시작하는 경로만 받아요. 업로드 한도는 기본 100 MiB이고, 업로드를 쓸 수 없는 설치에서는 파일 업로드를 고를 수 없어요.',
    motionLabel:
      '두 줄 그림이에요. 외부 URL은 주소만 소재로 기록되고, 파일 업로드는 서버에 저장되어 형식을 확인한 뒤 소재가 돼요.',
    screens: '소재 › 등록 방식',
    gnuboard: { screens: '하우스 광고 › 등록 방식' },
  },
  'alt-text': {
    category: 'creative',
    state: 'live',
    name: '대체텍스트',
    summary:
      '화면을 볼 수 없는 사용자에게 광고 내용을 전하는 짧은 설명이에요. 비워도 저장되지만, 그러면 보조기기 사용자에게 광고 내용이 전달되지 않아요.',
    detail: '이미지 광고에는 꼭 쓰기를 권해요. 1000자까지 쓸 수 있어요.',
    motionLabel: '이미지 광고에 대체텍스트를 붙이면 화면 읽기 프로그램이 그 문장을 읽어 주는 그림이에요.',
    screens: '소재 › 대체텍스트',
    gnuboard: { screens: '하우스 광고 › 대체텍스트' },
  },
  'click-through-url': {
    category: 'creative',
    state: 'live',
    name: '클릭 목적지 URL',
    summary:
      '광고 재생 중 보이는 "광고주 사이트" 링크가 새 탭으로 여는 주소예요. 소재가 아니라 광고 항목마다 정하고, 비우면 링크도 클릭 기록도 없어요.',
    detail: '링크를 눌러도 광고는 멈추지 않아요. 광고 화면 전체가 아니라 링크만 누를 수 있어요.',
    motionLabel: '광고가 재생되는 동안 광고주 사이트 링크를 누르면 새 탭이 열리고 광고는 계속 재생되는 그림이에요.',
    screens: '지면 편성 › 클릭 목적지 URL',
  },
  'image-display-time': {
    category: 'creative',
    state: 'live',
    name: '이미지 · GIF 표시 시간',
    summary:
      '이미지 광고를 보여 주는 시간이에요. 이미지가 로드되고 페이지가 보이는 동안만 시간이 흐르고, 시간이 다 되면 완료로 기록돼요.',
    detail:
      '5초는 새 이미지 항목에 화면이 채워 넣는 값이에요. 서버와 플레이어에는 기본값이 없어서 비우면 저장할 수 없어요. 3600초까지 정할 수 있고, GIF 반복 횟수와는 상관없어요.',
    motionLabel: '이미지 광고 아래 막대가 5초 동안 차오른 뒤 본편으로 넘어가는 그림이에요.',
    screens: '지면 편성 › 이미지 · GIF 표시 (초)',
  },
  archive: {
    category: 'creative',
    state: 'live',
    name: '보관',
    summary: '소재를 새 편성에 더 쓰지 않게 하는 조치예요. 되돌릴 수 없고, 보관한 소재는 추가할 소재 목록에서 빠져요.',
    detail:
      '보관해도 노출이 바로 멈추지는 않아요. 이미 게시된 편성은 다음 게시 전까지 그 소재를 계속 재생하고, 그 소재가 든 초안은 저장·게시·미리보기가 거부돼요.',
    motionLabel: '소재를 보관해도 게시본에서는 계속 재생되고, 그 소재가 든 초안은 저장과 게시가 막히는 그림이에요.',
    screens: '소재 › 상태',
    gnuboard: { screens: '하우스 광고 › 상태' },
  },

  'skip-offset': {
    category: 'skip',
    state: 'live',
    name: '스킵 대기',
    summary:
      '광고가 재생을 시작한 뒤 건너뛰기 버튼을 누를 수 있을 때까지의 시간이에요. 대기 시간이 끝나야 버튼이 켜져요.',
    detail:
      '1~3600초 정수이고, 스킵을 켜면 1초로 채워져요. 이미지 광고는 표시 시간보다 짧아야 해요. 대기 시간이 광고 길이와 같거나 길면 버튼은 끝까지 켜지지 않아요.',
    motionLabel: '광고가 재생되는 동안 "5초 후 건너뛰기"가 1초씩 줄어든 뒤 "광고 건너뛰기" 버튼이 켜지는 그림이에요.',
    screens: '지면 편성 › 스킵 대기 (초)',
  },
  'ad-skip': {
    category: 'skip',
    state: 'live',
    name: '이 광고의 스킵',
    summary:
      '광고 항목마다 건너뛰기를 허용할지 정해요. 건너뛰면 지금 광고 하나만 끝나고 같은 구간의 다음 광고로 넘어가요.',
    detail:
      '새 항목은 스킵 불가로 시작해요. 구간 전체를 건너뛰는 기능은 없고, 다음 광고의 대기 시간은 처음부터 다시 세요.',
    motionLabel: '광고 A를 건너뛰면 A만 일찍 끝나고 광고 B와 C가 이어서 재생된 뒤 본편으로 돌아가는 그림이에요.',
    screens: '지면 편성 › 이 광고의 스킵',
  },

  'target-scope': {
    category: 'target',
    state: 'live',
    name: '적용 단위',
    summary:
      '편성을 사이트 기본·게시판·분류·개별 영상 가운데 어디에 붙일지 정해요. 재생할 때는 영상 → 분류 → 게시판 → 사이트 순서로 찾아 가장 가까운 게시 편성 하나만 써요.',
    detail:
      '편성끼리 합치지 않아요. 분류 단계는 영상에 게시판과 분류가 모두 있을 때만 적용돼요. 독립 설치에서는 대상 ID를 직접 입력해요.',
    motionLabel:
      '영상과 분류에는 편성이 없어 건너뛰고, 게시판 편성 B를 찾아 그것만 쓰는 그림이에요. 사이트 편성 A는 쓰지 않아요.',
    screens: '지면 편성 › 적용 단위',
    gnuboard: {
      detail:
        '편성끼리 합치지 않아요. 분류 단계는 영상에 게시판과 분류가 모두 있을 때만 적용돼요. 그누보드에서는 대상 검색으로만 고르고, 서버가 실제 게시판·분류·글을 확인해요.',
    },
  },
  inherit: {
    category: 'target',
    state: 'live',
    name: '상위 설정 상속',
    summary: '이 대상에 직접 편성을 두지 않고 위 단계의 게시 편성을 따르는 방식이에요.',
    detail:
      '사이트 기본은 상속을 고를 수 없어요. "현재 게시 설정 출처"는 게시본 기준으로 실제 적용되는 단계를 보여 주고, 초안은 반영하지 않아요.',
    motionLabel: '사이트 편성 A를 게시판, 분류, 영상이 차례로 물려받아 영상에서도 A가 재생되는 그림이에요.',
    screens: '지면 편성 › 이 대상의 광고',
  },
  replace: {
    category: 'target',
    state: 'live',
    name: '직접 편성 · 전체 대체',
    summary:
      '이 대상의 광고 구간을 직접 정하고, 위 단계 편성과 합치지 않고 통째로 바꾸는 방식이에요. 구간 편집기는 이 방식에서만 보여요.',
    detail: '구간이 하나도 없는 직접 편성을 게시하면 광고 없는 편성이 적용돼요.',
    motionLabel: '게시판이 사이트 편성 A 대신 직접 편성 B를 쓰고, 그 아래 분류와 영상은 B를 물려받는 그림이에요.',
    screens: '지면 편성 › 이 대상의 광고',
  },
  disabled: {
    category: 'target',
    state: 'live',
    name: '광고 비활성화 · 상속 중단',
    summary: '이 대상에서 광고를 끄고, 위 단계 편성이 내려오는 것도 막아요. 게시해야 적용돼요.',
    detail:
      '흔히 "사용 안 함"이라고 부르는 설정이에요. 화면에서는 "광고 비활성화 · 상속 중단"을 고르고, 저장되는 값은 disabled예요.',
    motionLabel: '게시판에서 광고를 비활성화하면 사이트 편성 A가 내려오지 못해 분류와 영상에도 광고가 없는 그림이에요.',
    screens: '지면 편성 › 이 대상의 광고',
  },
  'fixed-video-id': {
    category: 'target',
    state: 'live',
    name: '고정 영상 ID',
    summary:
      '편성·재생·통계가 영상을 구분하는 변하지 않는 식별자예요. 영상 주소가 바뀌어도 ID가 같으면 같은 영상으로 봐요.',
    detail: '1~128자예요. 미리보기와 재생 테스트도 이 ID로 편성을 찾아요.',
    motionLabel: '주소가 다른 영상 두 개가 같은 영상 ID를 가지면 같은 편성과 같은 통계로 이어지는 그림이에요.',
    screens: '지면 편성 › 고정 영상 ID, 플레이어 › 초기 설정 방법 › 영상 ID',
    related: ['player-placeholder', 'player-install-snippet'],
    gnuboard: {
      detail:
        '"게시판:글번호:영상키" 형식이고 영상키 기본값은 main이에요. 현재 회원이 그 글을 읽을 수 있어야 편성을 받아요. 미리보기와 재생 테스트도 이 ID로 편성을 찾아요.',
    },
  },
  'video-context': {
    category: 'target',
    state: 'live',
    hosts: ['standalone'],
    name: '영상 소속 연결',
    summary:
      '독립 설치에서 영상 ID가 어느 게시판·분류에 속하는지 기록해요. 기록이 없으면 그 영상은 영상과 사이트 단계 편성만 받아요.',
    detail: '영상 이름은 꼭 넣어야 하고, 분류를 넣으려면 게시판 ID도 필요해요. 새 재생 세션부터 적용돼요.',
    motionLabel: '영상 ID를 게시판과 분류에 연결하면 그 게시판과 분류의 편성도 받을 수 있게 되는 그림이에요.',
    screens: '지면 편성 › 독립 설치 영상의 게시판·분류 연결',
  },

  draft: {
    category: 'publish',
    state: 'live',
    name: '초안',
    summary: '대상별로 서버에 저장한 편집본이에요. 초안을 저장해도 재생에는 영향이 없고, 게시해야 반영돼요.',
    motionLabel: '편집한 내용을 초안으로 저장해도 시청자 화면의 광고는 게시본 그대로인 그림이에요.',
    screens: '지면 편성 › 초안 저장',
  },
  'draft-revision': {
    category: 'publish',
    state: 'live',
    name: '초안 revision',
    summary: '초안을 저장할 때마다 1씩 오르는 번호예요. 게시 버전과는 따로 세요.',
    detail: '저장하기 전에는 "저장 전 초안"이고, 처음 저장하면 r1이에요. 게시해도 revision은 바뀌지 않아요.',
    motionLabel: '초안을 저장하면 r2가 r3으로 오르고 게시 v4는 그대로인 그림이에요.',
    screens: '지면 편성 › 저장된 초안 배지',
  },
  'revision-conflict': {
    category: 'publish',
    state: 'live',
    name: '초안 충돌',
    summary:
      '다른 창이나 다른 운영자가 먼저 초안을 저장해 내가 불러온 revision이 낡으면 저장과 게시가 거부돼요. 지금 입력은 화면에 그대로 남아요.',
    detail: '"서버 초안 다시 불러오기"를 누르면 내 입력은 버려져요. 자동으로 다시 시도하지 않아요.',
    motionLabel:
      '두 창이 같은 r2를 불러온 뒤 한 창이 r3으로 저장하면, 다른 창의 저장은 충돌로 거부되고 입력은 남는 그림이에요.',
    screens: '지면 편성 › 서버 초안 다시 불러오기',
  },
  publish: {
    category: 'publish',
    state: 'live',
    name: '게시',
    summary: '저장한 초안을 재생에 쓰는 편성으로 확정해요. 게시 뒤 새로 시작하는 재생부터 적용돼요.',
    detail:
      '이미 편성을 받은 재생은 받은 편성을 끝까지 써요(기본 2시간). 저장하지 않은 변경이 있으면 게시할 수 없고, 게시할 때 서버가 초안을 다시 검사해요.',
    motionLabel:
      '게시 전에 시작한 재생은 이전 편성을 계속 쓰고, 게시 뒤 새로 시작한 재생부터 새 편성을 쓰는 그림이에요.',
    screens: '지면 편성 › 저장한 초안 게시',
  },
  'publish-version': {
    category: 'publish',
    state: 'live',
    name: '게시본과 게시 버전',
    summary: '게시할 때마다 1씩 오르는 그 대상 게시본의 번호예요. 가장 최근 게시본만 재생에 써요.',
    detail: '첫 게시는 v1이에요. 같은 초안을 두 번 게시해도 버전이 올라요. 게시본이 없으면 "게시본 없음"으로 보여요.',
    motionLabel: '게시하면 게시본 v3 위에 v4가 쌓이고 재생이 v4로 옮겨 가는 그림이에요.',
    screens: '지면 편성 › 게시 버전 배지',
  },

  preview: {
    category: 'playback',
    state: 'live',
    name: '게시 전 미리보기',
    summary: '편집 중인 초안을, 저장하기 전 내용까지 고른 플레이어 프리셋으로 재생해 봐요. 통계에는 기록하지 않아요.',
    detail:
      '게시판·분류는 영상 ID로 찾아요. 그래서 영상이 편집 중인 게시판에 속하지 않으면 편집 내용이 미리보기에 나오지 않을 수 있어요. 본편 주소는 /로 시작하는 경로나 다른 사이트의 http(s) 주소도 돼요. 편성을 바꾸거나 다른 메뉴로 가면 멈추고, 다시 준비해야 해요.',
    motionLabel: PREVIEW_MOTION,
    screens: '지면 편성 › 게시 전 미리보기',
  },
  'play-test': {
    category: 'playback',
    state: 'live',
    name: '게시본 재생 테스트',
    summary: '게시한 편성을 실제 서비스와 같은 수집 경로로 재생 테스트 페이지에서 재생해요. 재생 결과가 통계에 쌓여요.',
    detail:
      '저장하거나 게시하지 않은 변경은 반영되지 않아요. "기본 video로 재생"과 "Video.js로 재생" 가운데 하나로 새 탭을 열고, 그 페이지에서 플레이어와 미디어 형식을 바꿀 수 있어요. 고른 프리셋이 다른 플레이어용이면 기본 모습으로 재생해요.',
    motionLabel: PREVIEW_MOTION,
    screens: '지면 편성 › 게시본 재생 테스트',
    related: ['play-test-page'],
  },
  'play-test-page': {
    category: 'playback',
    state: 'live',
    name: '재생 테스트 페이지',
    summary: '게시한 편성을 실제 서비스와 같은 수집 경로로 재생하는 페이지예요. 재생 결과가 통계에 쌓여요.',
    detail:
      '지면 편성의 게시본 재생 테스트 링크로 열어요. 주소에 영상 ID가 있어야 재생하고, 그 페이지에서 플레이어, 미디어 형식, HLS 엔진을 바꿀 수 있어요.',
    motionLabel: PREVIEW_MOTION,
    screens: '지면 편성 › 게시본 재생 테스트 › Video.js로 재생 · 기본 video로 재생',
    related: ['play-test'],
  },

  'player-preset': {
    category: 'player',
    state: 'live',
    name: '프리셋',
    summary:
      '플레이어 종류, 테마, 재생 동작, 언어, 광고 화면 설정을 이름 붙여 저장한 묶음이에요. 초안·게시 단계 없이 저장하면 바로 적용돼요.',
    detail:
      '로더를 넣은 페이지는 사이트 적용 프리셋을 쓰고, 저장한 뒤 페이지를 새로고침하면 바뀐 모습이 나와요. 이 프리셋을 불러오는 재생 테스트 페이지와 데모, 프리셋 편집 화면의 플레이어 미리보기에도 적용돼요. 지면 편성의 게시 전 미리보기는 그 화면에서 고른 프리셋으로 재생해요. 내장 프리셋은 기본, 플랫, 둥근 테두리, 강조색, 강의 다섯 가지이고 고치거나 지울 수 없어 복제해서 써요. 이름은 1~40자, 저장 프리셋은 20개까지예요. 다른 창에서 먼저 저장했으면 저장이 거부되고 입력은 그대로 남아요.',
    motionLabel:
      '프리셋 하나를 저장하면 플레이어 미리보기와 재생 테스트의 플레이어 색과 모서리가 함께 바뀌는 그림이에요.',
    screens: '플레이어 › 프리셋',
    related: ['player-default-preset', 'player-loader'],
    gnuboard: {
      name: '플레이어 설정',
      summary:
        '사이트의 모든 영상 플레이어가 쓰는 설정 하나예요. 플레이어 종류, 테마, 로고, 재생 동작, 화면 표시, 단축키, 컨트롤, 광고 화면을 정하고, 초안·게시 단계 없이 저장하면 바로 적용돼요.',
      detail:
        '목록이나 복제 없이 한 설정을 고쳐서 써요. 처음 저장하기 전에는 내장 "기본" 값으로 보이고, 처음 저장하면 그 값이 사이트 설정이 돼요. 이전·이후 버튼은 컨트롤 막대, 화면 가운데, 또는 두 곳 모두에 둘 수 있어요. 저장한 뒤 영상 페이지를 새로고침하면 바뀐 모습이 나와요. 다른 창에서 먼저 저장했으면 저장이 거부되고 입력은 그대로 남아요.',
      motionLabel:
        '플레이어 설정을 저장하면 플레이어 미리보기와 영상 페이지의 플레이어 색과 모서리가 함께 바뀌는 그림이에요.',
      screens: '플레이어 설정',
    },
  },
  'player-default-preset': {
    category: 'player',
    state: 'live',
    // GnuBoard keeps one player setting, which is always the site's.
    hosts: ['standalone'],
    name: '사이트 적용 프리셋',
    summary:
      '로더를 넣은 모든 페이지의 플레이어가 쓰는 프리셋이에요. 프리셋은 여러 개여도 사이트에 적용되는 건 하나예요.',
    detail:
      '프리셋 목록에서 "사이트에 적용"을 누르고 확인하면 바뀌어요. 페이지의 코드는 고치지 않아도 되고, 방문자가 페이지를 새로고침하면 새 프리셋 모습이 나와요. 처음에는 내장 프리셋 "기본"이에요. 사이트 적용 프리셋을 지우면 "기본"으로 돌아가요. 예전 정적 코드 만들기와 재생 테스트에서도 처음 선택돼요. 예전 정적 코드는 만든 시점의 값을 써서 따라 바뀌지 않아요.',
    motionLabel:
      '프리셋 세 개 가운데 하나에 붙은 사이트 적용 배지가 "사이트에 적용"을 누르면 다른 프리셋으로 옮겨 가고, 로더를 넣은 페이지들이 코드를 고치지 않고 새로고침만으로 새 모습으로 바뀌는 그림이에요.',
    screens: '플레이어 › 프리셋 목록 › 사이트에 적용',
    related: ['player-loader', 'player-placeholder'],
  },
  'player-type': {
    category: 'player',
    state: 'live',
    name: '플레이어 종류',
    summary: 'Video.js 플레이어는 테마를 입힌 스킨 컨트롤을 쓰고, 기본 video는 브라우저 기본 컨트롤을 써요.',
    detail:
      '기본 video에는 테마와 제목 표시가 적용되지 않아요. 기본 video로 저장하면 이 값은 빼고 저장해요. 광고 불러오기 시간 제한(1~60초, 비우면 5초)과 멈춤 시간 제한(1~120초, 비우면 10초)은 기본 video에서만 정해요. Video.js의 광고 편성 요청 시간 제한은 5초로 고정이에요.',
    motionLabel:
      '같은 영상에 Video.js는 강조색이 들어간 스킨 컨트롤을, 기본 video는 브라우저 기본 컨트롤을 씌우는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 기본 › 플레이어 종류, 광고 화면 › 광고 시간 제한',
  },
  'player-skin': {
    category: 'player',
    state: 'live',
    name: '스킨',
    summary:
      'Video.js 플레이어의 모양 묶음이에요. 지금은 기본 스킨 하나만 쓰고, 프리셋에서 스킨을 고르지 않아요. 모양은 테마로 바꿔요.',
    detail:
      '스킨 선택이 없어지면서 중립 스킨을 쓰던 저장 프리셋은 기본 스킨으로 옮겨졌어요. 비슷한 모양이 되도록 모서리가 비어 있던 프리셋에 12px를 넣었고, 테두리 색은 그대로 두었어요. 옮긴 프리셋은 어떤 프리셋이든 저장·삭제하거나 사이트에 적용하기 전까지 목록에 "중립 스킨에서 옮김"으로 표시돼요. 안내의 확인했어요를 누르면 그 브라우저에서는 안내가 다시 보이지 않아요.',
    motionLabel: '중립 스킨을 쓰던 프리셋이 모서리 12px를 넣은 기본 스킨으로 옮겨 가는 그림이에요.',
    screens: '플레이어 › 프리셋 목록',
  },
  'player-theme-property': {
    category: 'player',
    state: 'live',
    name: '테마 속성',
    summary:
      'Video.js가 공개한 스킨 설정값이에요. 프리셋에서는 강조색, 강조 글자색, 테두리 색, 모서리, 글꼴, 화면 채우기, 크기 기준 7가지를 정해요.',
    detail:
      '비운 항목은 스킨 기본값을 써요. 공개된 8가지 가운데 채우기 위치는 프리셋에서 정하지 않아요. 플레이어 글꼴을 바꾸면 광고 화면 글꼴도 따라가요. 기본 video에서는 테마를 쓸 수 없어요.',
    motionLabel: '테마 속성 묶음이 플레이어에 들어가면 컨트롤 색과 모서리가 바뀌는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 테마',
    related: ['player-accent-color', 'player-object-fit'],
  },
  'player-accent-color': {
    category: 'player',
    state: 'live',
    name: '강조색',
    summary:
      '진행 막대 채움, 강조 버튼, 메뉴 선택에 쓰는 색이에요. 강조 글자색은 강조색 위에 놓이는 글자와 아이콘 색이에요.',
    detail:
      '강조색을 비우면 스킨 기본값인 흰색이에요. 강조색과 강조 글자색의 대비가 4.5:1보다 낮으면 경고하지만 저장은 돼요. 강조 글자색을 비우면 브라우저가 대비되는 색을 고르는데, 이 기능이 없는 브라우저는 검정을 써요. 그래서 강조색을 정했다면 강조 글자색도 지정해 주세요.',
    motionLabel: '강조색과 모서리 값을 넣으면 플레이어의 진행 막대·버튼 색과 모서리가 바뀌는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 강조색, 강조 글자색',
  },
  'player-object-fit': {
    category: 'player',
    state: 'live',
    name: '화면 채우기',
    summary:
      '영상 비율이 플레이어와 다를 때 맞춤은 영상 전체가 보이고 빈 곳이 생겨요. 채움은 빈 곳 없이 가장자리가 잘려요.',
    detail: '전체화면에서는 항상 맞춤이에요. 광고 소재는 이 설정과 상관없이 맞춤으로 보여요.',
    motionLabel: '세로 틀 안에서 맞춤은 위아래에 빈 곳이 생기고, 채움은 양옆이 잘리는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 화면 채우기',
  },
  'player-ad-overlay': {
    category: 'player',
    state: 'live',
    name: '광고 화면',
    summary:
      '광고가 재생될 때 본편 위에 덮이는 층이에요. 광고 표시, 건너뛰기 버튼, 재생 시간, 광고주 링크, 음량이 있어요.',
    detail:
      '프리셋에서는 건너뛰기·대기·시간 문구, 광고 강조색, 건너뛰기 버튼 모서리, 글자 크기(11~18px, 기본 13px)를 정해요. 시간 문구 기본은 "경과 / 전체"이고, 문구에 {remaining}을 넣으면 남은 시간이 나와요. 광고 강조색은 음량 막대와 진행 막대 색이고, 비우면 테마 강조색을 따라요. 폭 280px 이하에서는 글자가 11px로 고정돼요. 광고 문구는 늘 한국어예요. 광고 대체텍스트는 소재마다 정하고 프리셋에서는 정하지 않아요.',
    motionLabel: '본편 위에 광고 화면이 덮이고, 건너뛰기 버튼이 대기 시간을 센 뒤 켜지는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 광고 화면',
    related: ['player-ad-language', 'alt-text', 'skip-offset'],
  },
  'player-ad-language': {
    category: 'player',
    state: 'live',
    name: '플레이어 화면 언어',
    summary:
      '재생 버튼, 메뉴 같은 플레이어 화면의 언어예요. 한국어, 영어, 일본어, 중국어 간체 가운데 고르거나 비워요. 광고 문구는 늘 한국어로 나와요.',
    detail:
      '비우면 플레이어를 둘러싼 페이지의 lang을 따라요. 페이지에 lang이 없거나 네 언어가 아니면 영어로 나와요. 자리 요소의 data-lang으로 그 자리만 바꿀 수 있어요. 기본 video에서는 브라우저 컨트롤이 브라우저 언어로 나와서 이 값이 쓰이지 않아요.',
    motionLabel:
      'lang이 없는 페이지에서는 플레이어 화면이 영어로, lang="ko"인 페이지에서는 한국어로 나오고, 광고 문구는 두 페이지 모두 한국어인 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 언어',
  },
  'player-install-snippet': {
    category: 'player',
    state: 'live',
    name: '예전 정적 코드',
    summary:
      '로더 없이 플레이어를 직접 넣던 예전 설치 코드예요. 프리셋, 영상 ID, 본편 주소, 미디어 형식을 고르면 만들어져요. 새로 붙이는 페이지에는 로더 설치 코드를 써요.',
    detail:
      '코드에는 만든 시점의 프리셋 값이 들어가요. 프리셋을 바꿔도 이 코드는 따라 바뀌지 않아서 다시 복사해 붙여 넣어야 해요. 이미 붙인 페이지는 그대로 동작해요. 이 코드로 재생하면 실제 통계에 기록돼요. 관리자와 같은 사이트의 페이지에서만 동작하고, 파일 경로는 /로 시작하는 경로나 전체 주소여야 해요.',
    motionLabel:
      '파일 준비, 스타일·스크립트 넣기, 플레이어 배치, 영상 ID로 편성 연결, 재생 확인 순서로 설치하는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법 › 예전 정적 코드 보기',
    related: ['player-loader', 'fixed-video-id', 'player-media-engine'],
    gnuboard: {
      detail:
        '코드에는 만든 시점의 프리셋 값이 들어가요. 프리셋을 바꿔도 이 코드는 따라 바뀌지 않아서 다시 복사해 붙여 넣어야 해요. 이 코드로 재생하면 실제 통계에 기록돼요. 영상 ID는 "게시판:글번호:영상키" 형식이고, 방문자가 그 글을 읽을 수 있어야 광고가 나와요. 게시물에 자동으로 넣는 기능은 준비 중이에요.',
    },
  },
  'player-loader': {
    category: 'player',
    state: 'live',
    name: '로더',
    summary:
      '페이지에 한 줄 넣는 스크립트예요. 페이지의 자리 요소를 모두 찾아 사이트 적용 프리셋으로 플레이어를 만들어요.',
    detail:
      '한 페이지에 한 번만 넣어요. 페이지가 열린 뒤 생긴 자리 요소도 찾아요. 매니저와 같은 사이트의 페이지에서만 동작해요. 프리셋을 받지 못하면 기본 모습으로 재생하고, 방문자에게는 오류를 보이지 않고 브라우저 콘솔에 [solad]로 시작하는 경고를 한 번 남겨요. 프리셋을 다시 저장해도 코드를 고칠 필요가 없어요.',
    motionLabel:
      '페이지가 열리면 로더가 먼저 받아지고, 로더가 페이지의 자리 요소를 모두 찾아, 찾은 자리마다 사이트 적용 프리셋으로 플레이어를 만드는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법 › 설치 코드',
    related: ['player-placeholder', 'player-default-preset'],
  },
  'player-placeholder': {
    category: 'player',
    state: 'live',
    name: '자리 요소',
    summary:
      '본문에서 영상이 들어갈 곳에 두는 빈 div예요. data-video-id와 data-src처럼 영상마다 다른 값만 적고, 모양은 프리셋이 정해요.',
    detail:
      'data-video-id와 data-src는 꼭 있어야 하고, 빠진 자리는 건너뛰어요. data-poster와 data-title은 프리셋의 포스터 표시·제목 표시가 켜져 있을 때 보여요. 자동 재생, 음소거, 반복, 미리 불러오기, 화면 언어는 data-* 속성으로 그 자리만 바꿀 수 있어요. 테마, 컨트롤, 로고처럼 보이는 모습은 속성으로 바꿀 수 없어요. 한 페이지에 영상이 여러 개면 자리 요소만 여러 개 둬요.',
    motionLabel:
      '본문 중 영상이 들어갈 곳에 빈 div를 두고, 영상 이름·주소·제목처럼 영상마다 다른 값만 적으면, 그 자리가 프리셋 모양의 플레이어가 되는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법 › 설치 코드, 자리 요소 속성',
    related: ['player-loader', 'fixed-video-id'],
  },
  'player-media-engine': {
    category: 'player',
    state: 'live',
    name: '미디어 형식',
    summary: '본편 파일 형식과 재생 엔진이에요. MP4는 두 플레이어 모두, HLS는 Video.js에서만 고를 수 있어요.',
    detail: 'HLS-SPF는 Video.js 자체 엔진으로, HLS-hls.js는 hls.js 엔진으로 재생해요.',
    motionLabel: 'MP4는 Video.js와 기본 video 모두로, HLS 파일은 Video.js의 두 엔진 가운데 하나로 재생되는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법 › 미디어',
  },
  'player-demo-page': {
    category: 'player',
    state: 'live',
    name: '데모',
    summary:
      '프리셋을 고르고 설정을 바꿔 보며 플레이어를 확인하고, 그 상태의 설치 코드를 복사하는 공개 페이지예요. 저장하지 않고 통계에 남기지 않아요.',
    detail:
      'Grok 샘플 편성으로 재생해요. 누구나 내장 프리셋 다섯 가지와 사이트 적용 프리셋을 고를 수 있고, 같은 사이트에서 관리자로 로그인했으면 저장 프리셋도 고를 수 있어요. 프리셋 편집 화면의 "데모에서 열기"는 저장한 프리셋을 골라 둔 채로 열어요. 샘플 미디어가 없으면 준비 방법만 보여요.',
    motionLabel:
      '데모에서 프리셋을 고르면 플레이어 모습과 설치 코드가 함께 바뀌고, 통계에는 아무것도 쌓이지 않는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법, 옵션 설명 › 데모 열기 · 프리셋 편집 › 데모에서 열기',
    related: ['player-guide-page', 'player-help-page', 'player-preset'],
  },
  'player-guide-page': {
    category: 'player',
    state: 'live',
    name: '설명서',
    summary: '플레이어를 사이트에 설치하고 프리셋과 지면 편성을 운영하는 순서를 적은 공개 페이지예요.',
    motionLabel:
      '설명서의 순서대로 로더를 설치하고, 프리셋을 사이트에 적용하고, 편성을 게시한 뒤 재생 테스트로 확인하는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법, 옵션 설명 › 설명서',
    related: ['player-demo-page', 'player-help-page', 'player-loader'],
  },
  'player-help-page': {
    category: 'player',
    state: 'live',
    name: '도움말 페이지',
    summary:
      '설치 코드, 자리 요소 속성, JS API, 프리셋 설정 옵션을 모은 공개 참조 페이지예요. 관리자 화면의 옵션 설명 링크가 이 페이지로 와요.',
    detail: '관리자 안의 이 도움말과는 다른 페이지예요. 옵션 설명 표의 "?" 링크는 그 옵션 항목을 새 창으로 열어요.',
    motionLabel: '옵션 설명 표의 "?" 링크를 누르면 공개 도움말 페이지의 같은 옵션 항목이 새 창으로 열리는 그림이에요.',
    screens: '플레이어 › 초기 설정 방법, 옵션 설명 › 도움말, 옵션 설명 "?" 링크',
    related: ['player-demo-page', 'player-guide-page', 'player-placeholder'],
  },

  // Facts follow `.agents/plans/ads-lms-spec.md` (2.2–2.5, 3.2, 3.4) and the design handoff 3.2–3.4.
  'lms-progress-rate': {
    category: 'lms',
    state: 'live',
    hosts: ['standalone'],
    name: '진도율',
    summary:
      '영상 길이 가운데 실제로 재생한 구간이 차지하는 비율이에요. 겹쳐 본 구간은 한 번만 세고, 표시는 내림한 정수 %예요.',
    detail:
      '건너뛴 곳, 일시정지, 광고 시간은 들어가지 않아요. 학습 시간은 따로 세는 실제 재생 시간이라 배속과 관계없어요. 로그인 회원이나 학습자 토큰이 있는 학습자만 서버에 기록되고, 그 밖에는 그 브라우저에만 남아요.',
    motionLabel: '0–34% 구간을 보고 52–58% 구간을 또 보면, 두 구간을 더한 40%가 진도율이 되는 그림이에요.',
    screens: '강의 › 학습 진도 › 진도율, 플레이어 › 프리셋 편집 › 강의(LMS)',
    related: ['lms-completion', 'lms-seek-limit'],
  },
  'lms-completion': {
    category: 'lms',
    state: 'live',
    hosts: ['standalone'],
    name: '완료 기준',
    summary: '진도율이 이 값 이상이 되는 순간 완료로 기록해요. 50–100 정수이고 비우면 90%예요.',
    detail:
      '끝까지 건너뛰거나 영상이 끝나는 것만으로는 완료가 아니에요. 한 번 기록된 완료 시각은 바뀌지 않아요. 서버에 기록할 때는 서버가 프리셋 규칙으로 완료를 정해요.',
    motionLabel: '진도율이 완료 기준 90%에 닿는 순간 완료 시각이 한 번 기록되는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 강의(LMS) › 완료 기준, 강의 › 학습 진도 › 완료',
    related: ['lms-progress-rate'],
  },
  'lms-seek-limit': {
    category: 'lms',
    state: 'live',
    hosts: ['standalone'],
    name: '본 곳까지만',
    summary:
      '앞으로 건너뛰기를 "본 곳까지만"으로 두면, 재생으로 닿은 가장 먼 곳에서 1초 뒤까지만 앞으로 갈 수 있어요. 뒤로는 늘 자유로워요.',
    detail:
      '진행 막대, 건너뛰기 버튼, 단축키, 목차·스크립트 클릭이 모두 이 한계에서 멈추고 알림이 떠요. 완료하면 한계가 풀려요.',
    motionLabel: '진행 막대를 한계 표시 뒤로 끌면 한계에서 멈추고 "아직 보지 않은 구간이에요" 알림이 뜨는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 강의(LMS) › 앞으로 건너뛰기',
    related: ['lms-progress-rate', 'lms-completion'],
  },
  'lms-learner-token': {
    category: 'lms',
    state: 'live',
    hosts: ['standalone'],
    name: '학습자 토큰',
    summary:
      '외부 LMS가 "이 학습자예요"라고 알려 주는 서명된 글이에요. 자리 요소의 data-learner-token에 넣으면 진도와 메모가 그 학습자로 서버에 저장돼요.',
    detail:
      '학습자 ID(영문, 숫자, . _ : @ - 로 64자까지)와 만료 시각을 LMS 연동 키로 서명해요. 만료는 24시간 이내로 정해요. 틀리거나 만료된 토큰은 오류로 멈추지 않고 그 브라우저에만 기록해요. 그누보드 회원이 로그인해 있으면 회원이 먼저예요.',
    motionLabel:
      'LMS 서버가 학습자 ID와 만료 시각을 연동 키로 서명해 토큰을 만들고, 플레이어가 그 토큰으로 진도를 저장하는 그림이에요.',
    screens: '강의 › LMS 연동 › 학습자 토큰 만드는 법, 시험 토큰 만들기',
    related: ['lms-key'],
  },
  'lms-key': {
    category: 'lms',
    state: 'live',
    hosts: ['standalone'],
    name: 'LMS 연동 키',
    summary: '학습자 토큰을 서명하는 비밀 키예요. 만들거나 바꿀 때 한 번만 전체가 보이고, 그 뒤에는 끝 4자리만 보여요.',
    detail:
      '키는 LMS 서버에만 두고 브라우저로 보내지 않아요. 키를 바꾸면 지금까지 만든 학습자 토큰이 모두 무효가 되니, LMS 서버의 키도 함께 바꿔야 해요.',
    motionLabel: '키를 바꾸면 옛 키로 만든 토큰은 거부되고 새 키로 만든 토큰만 받아들여지는 그림이에요.',
    screens: '강의 › LMS 연동 › 연동 키 만들기, 연동 키 바꾸기',
    related: ['lms-learner-token'],
  },
  'lms-manifest': {
    category: 'lms',
    state: 'live',
    hosts: ['standalone'],
    name: '강의 자료 매니페스트',
    summary:
      '강의의 목차, 슬라이드, 내려받기 자료, 스크립트를 적은 JSON 파일이에요. 자리 요소의 data-lecture에 주소를 넣으면 패널에 나와요.',
    detail:
      '목차 100개, 슬라이드 300개, 자료 50개까지 읽어요. 틀린 항목은 버리고 나머지를 쓰며, 버린 것이 있으면 패널 아래에 알려요. 스크립트가 없으면 자막 파일을 스크립트로 써요.',
    motionLabel: '매니페스트의 목차, 슬라이드, 자료, 스크립트가 강의 패널의 네 탭으로 나뉘어 나오는 그림이에요.',
    screens: '플레이어 › 프리셋 편집 › 강의(LMS) › 패널 탭, 샘플 강의',
    related: ['lms-progress-rate'],
  },

  start: {
    category: 'stats',
    state: 'live',
    name: '시작',
    summary: '광고가 실제로 재생을 시작한 횟수예요. 완료율과 클릭률은 이 수로 나눠요.',
    detail:
      '영상은 광고 재생이 시작될 때, 이미지는 로드된 뒤 처음 보일 때 세요. 자동 재생이 막혀 시청자가 누르지 않으면 세지 않아요. 수집하는 기록은 시작·완료·스킵·클릭·오류·중단 여섯 가지이고 노출은 없어서, 시작이 노출 자리를 대신해요.',
    motionLabel: '광고 재생이 세 번 시작되면 시작 수가 0에서 3까지 하나씩 오르는 그림이에요.',
    screens: STATS_SCREEN.standalone,
    gnuboard: { screens: STATS_SCREEN.gnuboard },
  },
  completion: {
    category: 'stats',
    state: 'live',
    name: '완료와 완료율',
    summary: '완료는 시작한 광고 가운데 끝까지 재생된 수예요. 완료율은 완료 ÷ 시작이에요.',
    detail:
      '영상은 광고가 끝났을 때, 이미지는 표시 시간이 다 됐을 때 완료예요. 건너뛰거나 오류·중단으로 끝나면 완료가 아니에요. 시작이 0이면 완료율은 "—"로 보여요.',
    motionLabel: '시작 10칸 가운데 7칸이 끝까지 재생되어 완료율 70%가 되는 그림이에요.',
    screens: STATS_SCREEN.standalone,
    gnuboard: { screens: STATS_SCREEN.gnuboard },
  },
  click: {
    category: 'stats',
    state: 'live',
    name: '클릭',
    summary: '시작한 광고에서 "광고주 사이트" 링크를 누른 횟수의 합계예요. 한 광고에서 여러 번 누르면 모두 세요.',
    detail: '클릭 목적지 URL이 없는 광고는 클릭을 받지 않아요.',
    motionLabel: PIPS_CLICKED,
    screens: STATS_SCREEN.standalone,
    gnuboard: { screens: STATS_SCREEN.gnuboard },
  },
  'click-through-rate': {
    category: 'stats',
    state: 'live',
    name: '클릭률',
    summary: '링크를 한 번 이상 누른 시작 수 ÷ 시작 수예요. 클릭 횟수 합계로 나누지 않아요.',
    detail: '업계에서 흔히 쓰는 CTR(클릭 ÷ 노출)과 분모가 달라요. 시작이 0이면 "—"로 보여요.',
    motionLabel: `${PIPS_CLICKED} 그래서 클릭률은 2 ÷ 10 = 20%예요.`,
    screens: STATS_SCREEN.standalone,
    gnuboard: { screens: STATS_SCREEN.gnuboard },
  },
  'stats-csv': {
    category: 'stats',
    state: 'live',
    name: '조회 조건과 CSV',
    summary:
      '지금 조회 조건과 같은 결과를 행 단위 CSV 파일로 내려받아요. 조건을 바꾸면 이전 결과가 지워지니 다시 조회해 주세요.',
    detail:
      '광고·영상·게시판 ID는 정확히 같아야 걸려요. 스킵은 건너뛰어 끝난 시작 수, 오류는 오류가 한 번이라도 난 시도 수이고, 중단은 세지 않아요. 파일 이름은 ads-시작일-종료일.csv이고 합계 행은 없어요.',
    motionLabel: '조회 조건을 정해 통계를 조회하면 결과 표가 나오고, 같은 내용을 CSV 파일로 내려받는 그림이에요.',
    screens: `${STATS_SCREEN.standalone} › 현재 조건 CSV 다운로드`,
    gnuboard: { screens: `${STATS_SCREEN.gnuboard} › 현재 조건 CSV 다운로드` },
  },

  advertiser: {
    category: 'v2',
    state: 'mock',
    hosts: ['standalone'],
    name: '광고주',
    summary:
      '캠페인 위의 최상위 단위예요. 지금은 캠페인 목업 화면의 설명 문구로만 보이고, 광고주를 관리하는 화면은 아직 없어요.',
    motionLabel: '광고주 하나 아래 캠페인 두 개가 이어지는 그림이에요.',
    screens: '캠페인(목업)',
  },
  campaign: {
    category: 'v2',
    state: 'mock',
    hosts: ['standalone'],
    name: '캠페인',
    summary:
      '광고주와의 계약 단위예요. 실제 노출 조건은 캠페인 안의 집행에서 정해요. 지금은 목업 화면이라 저장되지 않아요.',
    motionLabel: '캠페인 계약 기간 안에 집행 두 개가 들어가고, 집행에 소재가 붙는 그림이에요.',
    screens: '캠페인(목업)',
  },
  'line-item': {
    category: 'v2',
    state: 'mock',
    hosts: ['standalone'],
    name: '집행',
    summary:
      '캠페인 안에서 기간·요일·시간대, 등급, 타겟, 소재, 스킵 정책 같은 실제 노출 조건을 정하는 단위예요. 캠페인 상세의 집행 표는 목업이고, 집행 만들기 화면은 준비 중이에요.',
    motionLabel: '캠페인 아래 집행 하나에 기간, 등급, 타겟, 소재, 스킵 조건이 차례로 붙는 그림이에요.',
    screens: '캠페인(목업) › 집행 표, 집행 만들기(준비 중)',
  },
  approval: {
    category: 'v2',
    state: 'planned',
    hosts: ['standalone'],
    name: '승인과 승인함',
    summary:
      '편집자가 제출한 지면 편성·집행 변경을 승인자가 승인하거나 사유와 함께 반려하는 절차예요. 승인함 화면은 준비 중이고, 지금 지면 편성 게시는 승인 없이 바로 적용돼요.',
    motionLabel: '제출한 변경이 승인 대기를 거쳐 승인되면 적용되고, 반려되면 사유와 함께 돌아오는 그림이에요.',
    screens: '승인함(준비 중)',
  },
  tier: {
    category: 'v2',
    state: 'mock',
    hosts: ['standalone'],
    name: '등급',
    summary:
      '집행이 광고 자리를 얻는 우선순위 종류예요. 기간제 → 보장 → 하우스 순서로 고르고, 셋 다 없으면 자리가 비어요. 지금은 목업 화면에서만 보여요.',
    detail: '기간제는 점유율 1~100%(100%는 독점)로, 보장은 목표 노출 수를 고르게 나눠 채워요.',
    motionLabel: '빈 광고 자리 하나에 기간제 집행을 먼저 찾고, 없으면 보장, 그다음 하우스 순서로 채우는 그림이에요.',
    screens: '캠페인(목업)',
  },
  'delivery-status': {
    category: 'v2',
    state: 'mock',
    hosts: ['standalone'],
    name: '집행 상태',
    summary:
      '집행의 진행 단계를 초안, 승인 대기, 예정, 진행, 일시중지, 종료, 미달 종료, 반려, 보관 9가지로 나눠요. 지금은 캠페인·대시보드 목업에서만 이 뜻으로 써요.',
    detail:
      '실제 화면에서는 같은 색 배지를 다른 뜻으로 빌려 쓰기도 해요. 소재의 "사용 가능", 지면 편성의 "게시 v{n}"은 집행 상태가 아니에요.',
    motionLabel:
      '집행 하나가 초안, 승인 대기, 예정, 진행, 종료로 넘어가고, 갈림길로 일시중지, 반려, 미달 종료가 있는 그림이에요.',
    screens: '캠페인·대시보드(목업)',
  },
  impression: {
    category: 'v2',
    state: 'planned',
    hosts: ['standalone'],
    name: '노출',
    summary:
      '광고를 정해진 시간 이상 보여 준 횟수예요. 명세상 영상은 2초, 이미지는 1초 이상 보이면 노출이에요. 지금은 노출을 수집하지 않고, 목업 화면의 노출 숫자는 예시예요.',
    motionLabel: '광고 재생이 2초를 넘는 순간 노출이 1 오르는 그림이에요. 지금은 수집하지 않는 지표예요.',
    screens: '대시보드(목업), 설정(준비 중)',
  },

  'house-ad': {
    category: 'gnuboard',
    state: 'live',
    hosts: ['gnuboard'],
    name: '하우스 광고',
    summary:
      '사이트가 직접 내보내는 광고예요. 하우스 광고 메뉴는 소재 화면과 같아서, 광고를 등록·수정·보관하고 지면 편성 구간에 넣으면 그 구간에서 재생돼요.',
    detail: '기획에 있는 기간·가중치에 따른 선택은 준비 중이에요. 지금은 지면 편성대로만 재생해요.',
    motionLabel: '하우스 광고를 등록해 지면 편성 구간에 넣으면 그 구간에서 재생되는 그림이에요.',
    screens: '하우스 광고',
  },
  'ad-request': {
    category: 'gnuboard',
    state: 'mock',
    hosts: ['gnuboard'],
    name: '광고 요청',
    summary: '회원이 사이트에 광고 게재를 신청하고 관리자가 검토하는 흐름이에요. 지금은 목업 화면이라 처리되지 않아요.',
    detail: '목업은 접수, 검토, 보완 요청, 집행 예정, 집행, 종료, 반려 7단계로 보여 줘요. 기획 초안과 다를 수 있어요.',
    motionLabel: '요청이 접수, 검토, 집행 예정, 집행, 종료로 넘어가고, 갈림길로 보완 요청과 반려가 있는 그림이에요.',
    screens: '광고 요청(목업)',
  },
} satisfies Record<HelpTermId, HelpTermData>;

/** The term in the host's wording. */
export function termFor(id: HelpTermId, host: HelpHost): HelpTermData {
  const term: HelpTermData = HELP_TERMS[id];

  return host === 'gnuboard' ? { ...term, ...term.gnuboard } : term;
}

export function categoryName(category: HelpCategory, host: HelpHost): string {
  return host === 'gnuboard' ? (category.gnuboard ?? category.name) : category.name;
}

/** Term ids the host shows, in dictionary order. */
export function termsFor(host: HelpHost): HelpTermId[] {
  return helpTerms.filter((id) => {
    const term: HelpTermData = HELP_TERMS[id];

    return term.hosts?.includes(host) ?? true;
  });
}
