import type { ReactNode } from 'react';

import { StatusBadge } from '../components';
import {
  Arrow,
  Box,
  Cap,
  Doc,
  Fit,
  Flow,
  Formula,
  Item,
  Lane,
  Legend,
  Pips,
  Picture,
  Player,
  Row,
  Scene,
  Screen,
  ScreenLink,
  SkipButton,
  Stack,
  Tally,
  Timeline,
  Tree,
} from './scenes';
import type { HelpHost, HelpTermId } from './terms';

export interface HelpMotionSpec {
  /** Plays once in `motion-help-once` (5s) instead of looping every `motion-help-loop` (8s). */
  once?: boolean | undefined;
  render: (host: HelpHost) => ReactNode;
}

function signals(focus: 'preview' | 'test'): ReactNode {
  return (
    <Scene>
      <Lane
        focus={focus === 'preview'}
        blocked
        from={<Box>미리보기</Box>}
        to={
          <Box tone="off" sub="통계">
            기록 안 함
          </Box>
        }
      />
      <Lane
        focus={focus === 'test'}
        from={<Box>재생 테스트</Box>}
        to={
          <Box tone="ad" sub="통계">
            +<Tally />
          </Box>
        }
      />
    </Scene>
  );
}

const CLICKED = [2, 6];

// Every scene must say what the term's `motionLabel` says; the label is the figure's accessible name.
export const HELP_MOTIONS = {
  'ad-break': {
    render: () => (
      <Scene>
        <Timeline
          segments={[
            { label: '프리롤', ad: true },
            { label: '본편' },
            { label: '미드롤', ad: true },
            { label: '본편' },
            { label: '포스트롤', ad: true },
          ]}
        />
      </Scene>
    ),
  },
  'pre-roll': {
    render: () => (
      <Scene>
        <Timeline segments={[{ label: '프리롤', ad: true }, { label: '본편 0초부터' }]} />
      </Scene>
    ),
  },
  'mid-roll': {
    render: () => (
      <Scene>
        <Timeline
          segments={[{ label: '본편 0~10초' }, { label: '미드롤 10초', ad: true }, { label: '본편 10초부터' }]}
        />
      </Scene>
    ),
  },
  'post-roll': {
    render: () => (
      <Scene>
        <Timeline segments={[{ label: '본편 끝까지' }, { label: '포스트롤', ad: true }]} />
        <Cap step={3}>여기서 끝나요</Cap>
      </Scene>
    ),
  },
  'ad-item': {
    render: () => (
      <Scene>
        <Cap>광고 구간 하나</Cap>
        <Timeline
          segments={[
            { label: '1. 광고', ad: true },
            { label: '2. 광고', ad: true },
            { label: '3. 광고', ad: true },
            { label: '본편' },
          ]}
        />
      </Scene>
    ),
  },

  creative: {
    render: () => (
      <Scene>
        <Row>
          <Doc label="v1" />
          <Arrow step={2} />
          <Doc label="v2" ad step={2} />
        </Row>
        <Row>
          <Box step={3} sub="v1 그대로">
            편성에 넣은 항목
          </Box>
        </Row>
      </Scene>
    ),
  },
  'creative-source': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>외부 URL</Box>
          <Arrow step={2} />
          <Box step={2}>주소만 기록</Box>
          <Arrow step={3} />
          <Box tone="ad" step={3}>
            소재
          </Box>
        </Flow>
        <Flow>
          <Box step={1}>파일 업로드</Box>
          <Arrow step={2} />
          <Box step={2} sub="형식 확인">
            서버에 저장
          </Box>
          <Arrow step={3} />
          <Box tone="ad" step={3}>
            소재
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'alt-text': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>이미지 광고</Box>
          <Arrow step={2} />
          <Box step={2} sub="대체텍스트">
            “봄 신상품 할인”
          </Box>
          <Arrow step={3} />
          <Box tone="ink" step={3}>
            화면 읽기 프로그램이 읽어요
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'click-through-url': {
    render: () => (
      <Scene>
        <Row>
          <Screen tag="광고">
            <ScreenLink>광고주 사이트 ↗</ScreenLink>
          </Screen>
          <Arrow step={3} />
          <Box step={3} sub="새 탭">
            광고주 사이트
          </Box>
        </Row>
        <Cap step={4}>광고는 계속 재생돼요</Cap>
      </Scene>
    ),
  },
  'image-display-time': {
    render: () => (
      <Scene>
        <Row>
          <Screen tag="이미지 광고" leave>
            <Picture />
          </Screen>
          <Arrow step={5} />
          <Box step={5}>본편</Box>
        </Row>
        <Cap>표시 시간 3초</Cap>
      </Scene>
    ),
  },
  archive: {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>소재</Box>
          <Arrow step={2} />
          <Box tone="faint" step={2}>
            보관
          </Box>
        </Flow>
        <Flow>
          <Box step={3} sub="다음 게시 전까지">
            게시본은 계속 재생
          </Box>
          <Box tone="off" step={4} sub="저장·게시 거부">
            이 소재가 든 초안
          </Box>
        </Flow>
      </Scene>
    ),
  },

  'skip-offset': {
    render: () => (
      <Scene>
        <Screen tag="광고">
          <SkipButton />
        </Screen>
        <Cap>스킵 대기 5초</Cap>
      </Scene>
    ),
  },
  'ad-skip': {
    render: () => (
      <Scene>
        <Timeline
          segments={[
            { label: 'A 건너뜀', ad: true },
            { label: 'B', ad: true },
            { label: 'C', ad: true },
            { label: '본편' },
          ]}
        />
        <Cap step={2}>B의 대기 시간은 처음부터 다시 세요</Cap>
      </Scene>
    ),
  },

  'target-scope': {
    render: () => (
      <Scene>
        <Tree
          rows={[
            {
              caption: '게시 편성',
              cells: [
                { label: 'A', tone: 'ad' },
                { label: 'B', tone: 'ad' },
                { label: '없음', tone: 'ghost' },
                { label: '없음', tone: 'ghost' },
              ],
            },
            {
              caption: '찾는 순서: 영상부터 위로',
              cells: [
                { label: '안 씀', tone: 'faint', step: 4 },
                { label: 'B 사용', tone: 'ink', step: 3 },
                { label: '건너뜀', tone: 'faint', step: 2 },
                { label: '건너뜀', tone: 'faint', step: 1 },
              ],
            },
          ]}
        />
      </Scene>
    ),
  },
  inherit: {
    render: () => (
      <Scene>
        <Tree
          rows={[
            {
              caption: '설정',
              cells: [
                { label: 'A', tone: 'ad' },
                { label: '상속', tone: 'ghost' },
                { label: '상속', tone: 'ghost' },
                { label: '상속', tone: 'ghost' },
              ],
            },
            {
              caption: '재생되는 편성',
              cells: [
                { label: 'A', tone: 'ad', step: 1 },
                { label: 'A', tone: 'ad', step: 2 },
                { label: 'A', tone: 'ad', step: 3 },
                { label: 'A', tone: 'ad', step: 4 },
              ],
            },
          ]}
        />
      </Scene>
    ),
  },
  replace: {
    render: () => (
      <Scene>
        <Tree
          rows={[
            {
              caption: '설정',
              cells: [
                { label: 'A', tone: 'ad' },
                { label: 'B', tone: 'ink' },
                { label: '상속', tone: 'ghost' },
                { label: '상속', tone: 'ghost' },
              ],
            },
            {
              caption: '재생되는 편성',
              cells: [
                { label: 'A', tone: 'ad', step: 1 },
                { label: 'B', tone: 'ink', step: 2 },
                { label: 'B', tone: 'ink', step: 3 },
                { label: 'B', tone: 'ink', step: 4 },
              ],
            },
          ]}
        />
      </Scene>
    ),
  },
  disabled: {
    render: () => (
      <Scene>
        <Tree
          rows={[
            {
              caption: '설정',
              cells: [
                { label: 'A', tone: 'ad' },
                { label: '비활성', tone: 'off' },
                { label: '상속', tone: 'ghost' },
                { label: '상속', tone: 'ghost' },
              ],
            },
            {
              caption: '재생되는 편성',
              cells: [
                { label: 'A', tone: 'ad', step: 1 },
                { label: '없음', tone: 'off', step: 2 },
                { label: '없음', tone: 'faint', step: 3 },
                { label: '없음', tone: 'faint', step: 4 },
              ],
            },
          ]}
        />
      </Scene>
    ),
  },
  'fixed-video-id': {
    once: true,
    render: (host) => {
      const id = host === 'gnuboard' ? 'free:12:main' : 'video-12';

      return (
        <Scene>
          <Flow>
            <Box step={1} sub={id}>
              주소 1
            </Box>
            <Box step={1} sub={id}>
              주소 2
            </Box>
            <Arrow step={2} />
            <Box tone="ad" step={2} sub="같은 통계">
              같은 편성
            </Box>
          </Flow>
        </Scene>
      );
    },
  },
  'video-context': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>영상 ID</Box>
          <Arrow step={2} />
          <Box step={2}>게시판</Box>
          <Arrow step={3} />
          <Box step={3}>분류</Box>
        </Flow>
        <Cap step={4}>이제 게시판·분류 편성도 받아요</Cap>
      </Scene>
    ),
  },

  draft: {
    render: () => (
      <Scene>
        <Row>
          <Doc label="편집" />
          <Arrow step={2} />
          <Doc label="초안" ad step={2} />
          <Box tone="ink" sub="게시본 그대로">
            시청자 화면
          </Box>
        </Row>
        <Cap step={3}>초안을 저장해도 재생은 바뀌지 않아요</Cap>
      </Scene>
    ),
  },
  'draft-revision': {
    render: () => (
      <Scene>
        <Row>
          <Doc label="r2" />
          <Arrow step={2} />
          <Doc label="r3" ad step={2} />
          <Box tone="ink" sub="그대로">
            게시 v4
          </Box>
        </Row>
      </Scene>
    ),
  },
  'revision-conflict': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="r2 불러옴">
            창 1
          </Box>
          <Box step={1} sub="r2 불러옴">
            창 2
          </Box>
          <Arrow step={2} />
          <Box tone="ad" step={2} sub="창 2 저장">
            r3
          </Box>
        </Flow>
        <Flow>
          <Box tone="off" step={3} sub="창 1 저장">
            충돌
          </Box>
          <Arrow step={4} />
          <Box step={4}>입력은 그대로 남아요</Box>
        </Flow>
      </Scene>
    ),
  },
  publish: {
    render: () => (
      <Scene>
        <Lane focus blocked from={<Box sub="게시 전 시작">재생 1</Box>} to={<Box>이전 편성</Box>} />
        <Lane
          focus
          from={
            <Box step={2} sub="게시 뒤 시작">
              재생 2
            </Box>
          }
          to={
            <Box tone="ad" step={3}>
              새 편성
            </Box>
          }
        />
      </Scene>
    ),
  },
  'publish-version': {
    render: () => (
      <Scene>
        <Row>
          <Stack>
            <Doc label="v3" />
            <Doc label="v4" ad step={2} />
          </Stack>
          <Arrow step={3} />
          <Box tone="ink" step={3} sub="v4">
            재생
          </Box>
        </Row>
      </Scene>
    ),
  },

  preview: { render: () => signals('preview') },
  'play-test': { render: () => signals('test') },
  'play-test-page': { render: () => signals('test') },

  'player-preset': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="색 · 모서리 · 글꼴">
            프리셋 저장
          </Box>
          <Arrow step={2} />
          <Player look="theme" label="플레이어 미리보기" step={2} />
          <Player look="theme" label="재생 테스트" step={2} />
        </Flow>
      </Scene>
    ),
  },
  'player-default-preset': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box tone="ghost">기본</Box>
          <Box tone="ghost">플랫</Box>
          <Box tone="ad" step={1} sub="사이트 적용">
            둥근 테두리
          </Box>
          <Box tone="ghost">강조색</Box>
        </Flow>
        <Flow>
          <Box tone="ink" step={2}>
            사이트에 적용
          </Box>
          <Arrow step={2} />
          <Box tone="ad" step={2} sub="배지가 옮겨 감">
            강조색
          </Box>
        </Flow>
        <Flow>
          <Doc label="페이지 A" step={3} />
          <Doc label="페이지 B" step={3} />
          <Cap step={3}>코드는 그대로</Cap>
          <Arrow step={4} />
          <Player look="theme" label="새로고침하면 새 모습" step={4} />
        </Flow>
      </Scene>
    ),
  },
  'player-type': {
    render: () => (
      <Scene>
        <Row>
          <Player look="theme" label="Video.js · 스킨 테마" />
          <Player look="native" label="기본 video · 브라우저 컨트롤" />
        </Row>
      </Scene>
    ),
  },
  'player-skin': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Player look="skin-neutral" label="중립 스킨 프리셋" />
          <Arrow step={2} />
          <Player look="skin-default" label="기본 스킨 · 모서리 12px" step={2} />
        </Flow>
      </Scene>
    ),
  },
  'player-theme-property': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="7가지">
            테마 속성
          </Box>
          <Arrow step={2} />
          <Player look="theme" label="컨트롤 색과 모서리" step={2} />
        </Flow>
      </Scene>
    ),
  },
  'player-accent-color': {
    render: () => (
      <Scene>
        <Row>
          <Player look="plain" label="비움 · 스킨 기본" />
          <Player look="theme" label="강조색 지정" />
        </Row>
      </Scene>
    ),
  },
  'player-object-fit': {
    render: () => (
      <Scene>
        <Row>
          <Fit fit="contain" label="맞춤 · 빈 곳" />
          <Fit fit="cover" label="채움 · 잘림" />
        </Row>
      </Scene>
    ),
  },
  'player-ad-overlay': {
    render: () => (
      <Scene>
        <Screen tag="광고">
          <SkipButton />
        </Screen>
        <Cap>본편 위에 덮이는 광고 화면</Cap>
      </Scene>
    ),
  },
  'player-ad-language': {
    render: () => (
      <Scene>
        <Flow>
          <Box tone="ghost">lang 없음</Box>
          <Arrow />
          <Box sub="플레이어 화면">영어</Box>
          <Box tone="ad" sub="광고 문구">
            한국어
          </Box>
        </Flow>
        <Flow>
          <Box tone="ink" step={2}>
            lang="ko"
          </Box>
          <Arrow step={2} />
          <Box step={2} sub="플레이어 화면">
            한국어
          </Box>
          <Box tone="ad" step={2} sub="광고 문구">
            한국어
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'player-install-snippet': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>파일 준비</Box>
          <Arrow step={2} />
          <Box step={2}>스타일·스크립트</Box>
          <Arrow step={3} />
          <Box step={3}>플레이어 배치</Box>
          <Arrow step={4} />
          <Box step={4}>영상 ID 연결</Box>
          <Arrow step={5} />
          <Box tone="ad" step={5}>
            재생 확인
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'player-loader': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Doc label="페이지" />
          <Arrow step={1} />
          <Box tone="ink" step={1} sub="먼저 받아져요">
            로더
          </Box>
          <Arrow step={2} />
          <Box step={2} sub="모두 찾기">
            자리 요소 ×2
          </Box>
          <Arrow step={3} />
          <Player look="theme" label="사이트 적용 프리셋" step={3} />
          <Player look="theme" label="사이트 적용 프리셋" step={3} />
        </Flow>
      </Scene>
    ),
  },
  'player-placeholder': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Doc label="본문" />
          <Arrow step={1} />
          <Box tone="ghost" step={1} sub="영상이 들어갈 곳">
            빈 div
          </Box>
          <Arrow step={2} />
          <Box step={2} sub="영상마다 다른 값">
            이름 · 주소 · 제목
          </Box>
          <Arrow step={3} />
          <Player look="theme" label="모양은 프리셋" step={3} />
        </Flow>
      </Scene>
    ),
  },
  'player-media-engine': {
    render: () => (
      <Scene>
        <Flow>
          <Box sub="MP4">본편 파일</Box>
          <Arrow />
          <Box tone="ink">Video.js · 기본 video</Box>
        </Flow>
        <Flow>
          <Box step={2} sub=".m3u8">
            HLS 파일
          </Box>
          <Arrow step={2} />
          <Box tone="ad" step={2} sub="HLS-SPF · HLS-hls.js">
            Video.js만
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'player-demo-page': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="프리셋 고르기">
            데모
          </Box>
          <Arrow step={2} />
          <Player look="theme" label="바뀐 모습" step={2} />
          <Box tone="ink" step={3} sub="복사">
            설치 코드
          </Box>
        </Flow>
        <Flow>
          <Box tone="off" step={4} sub="통계">
            기록 안 함
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'player-guide-page': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="로더 두 줄">
            설치
          </Box>
          <Arrow step={2} />
          <Box step={2} sub="사이트 적용">
            프리셋
          </Box>
          <Arrow step={3} />
          <Box step={3} sub="게시">
            지면 편성
          </Box>
          <Arrow step={4} />
          <Box tone="ad" step={4} sub="확인">
            재생 테스트
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'player-help-page': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub='"?" 링크'>
            옵션 설명
          </Box>
          <Arrow step={2} />
          <Box tone="ink" step={2} sub="같은 옵션 항목">
            도움말 페이지
          </Box>
        </Flow>
      </Scene>
    ),
  },

  start: {
    render: () => (
      <Scene>
        <Lane
          focus
          from={<Box>광고 재생 시작</Box>}
          to={
            <Box tone="ad" sub="시작">
              <Tally />
            </Box>
          }
        />
      </Scene>
    ),
  },
  completion: {
    render: () => (
      <Scene>
        <Pips done={7} />
        <Legend
          items={[
            { pip: 'start', label: '시작' },
            { pip: 'done', label: '완료' },
          ]}
        />
        <Formula step={4}>완료 7 ÷ 시작 10 = 완료율 70%</Formula>
      </Scene>
    ),
  },
  click: {
    render: () => (
      <Scene>
        <Pips clicked={CLICKED} />
        <Legend
          items={[
            { pip: 'start', label: '시작' },
            { pip: 'click', label: '링크를 누른 시작' },
          ]}
        />
        <Formula step={2}>3번째 칸 2번 + 7번째 칸 1번</Formula>
        <Formula step={4}>클릭 3</Formula>
      </Scene>
    ),
  },
  'click-through-rate': {
    render: () => (
      <Scene>
        <Pips clicked={CLICKED} />
        <Legend
          items={[
            { pip: 'start', label: '시작' },
            { pip: 'click', label: '링크를 누른 시작' },
          ]}
        />
        <Formula step={3}>클릭 3번이어도 누른 시작은 2</Formula>
        <Formula step={4}>2 ÷ 시작 10 = 클릭률 20%</Formula>
      </Scene>
    ),
  },
  'lms-progress-rate': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="0–34%">
            시청 구간
          </Box>
          <Arrow step={2} />
          <Box step={2} sub="52–58%">
            시청 구간
          </Box>
          <Arrow step={3} />
          <Box tone="ink" step={3} sub="겹친 곳은 한 번">
            진도율 40%
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'lms-completion': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>진도율 89%</Box>
          <Arrow step={2} />
          <Box step={2} sub="완료 기준">
            90%
          </Box>
          <Arrow step={3} />
          <Box tone="ink" step={3} sub="한 번만 기록">
            완료 시각
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'lms-seek-limit': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="본 곳 + 1초">
            한계
          </Box>
          <Arrow step={2} />
          <Box tone="ad" step={2} sub="한계에서 멈춤">
            앞으로 건너뛰기
          </Box>
          <Arrow step={3} />
          <Box step={3}>막힘 알림</Box>
        </Flow>
      </Scene>
    ),
  },
  'lms-learner-token': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="학습자 ID · 만료">
            LMS 서버
          </Box>
          <Arrow step={2} />
          <Box step={2} sub="연동 키로 서명">
            학습자 토큰
          </Box>
          <Arrow step={3} />
          <Box tone="ink" step={3} sub="학습자별 저장">
            진도 · 메모
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'lms-key': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>연동 키 바꾸기</Box>
          <Arrow step={2} />
          <Box tone="ad" step={2} sub="옛 키로 만든 것">
            토큰 무효
          </Box>
          <Arrow step={3} />
          <Box tone="ink" step={3} sub="LMS 서버도 바꿈">
            새 키
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'lms-manifest': {
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="data-lecture">
            매니페스트
          </Box>
          <Arrow step={2} />
          <Box tone="ink" step={2} sub="목차 · 자료 · 스크립트 · 메모">
            강의 패널
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'stats-csv': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1} sub="기간 · ID">
            조회 조건
          </Box>
          <Arrow step={2} />
          <Box step={2}>결과 표</Box>
          <Arrow step={3} />
          <Box tone="ad" step={3} sub="합계 행 없음">
            CSV
          </Box>
        </Flow>
      </Scene>
    ),
  },

  advertiser: {
    once: true,
    render: () => (
      <Scene>
        <Row>
          <Box tone="ink" step={1}>
            광고주
          </Box>
        </Row>
        <Arrow down step={2} />
        <Row>
          <Box step={2}>캠페인 1</Box>
          <Box step={3}>캠페인 2</Box>
        </Row>
      </Scene>
    ),
  },
  campaign: {
    once: true,
    render: () => (
      <Scene>
        <Box tone="ink" step={1} sub="계약 기간">
          캠페인
        </Box>
        <Row>
          <Box step={2}>집행 1</Box>
          <Box step={3}>집행 2</Box>
          <Arrow step={4} />
          <Box tone="ad" step={4}>
            소재
          </Box>
        </Row>
      </Scene>
    ),
  },
  'line-item': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box tone="ink">캠페인</Box>
          <Arrow />
          <Box tone="ad">집행</Box>
        </Flow>
        <Flow>
          <Box step={1}>기간·요일</Box>
          <Box step={2}>등급</Box>
          <Box step={3}>타겟</Box>
          <Box step={4}>소재</Box>
          <Box step={5}>스킵</Box>
        </Flow>
      </Scene>
    ),
  },
  approval: {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>제출</Box>
          <Arrow step={2} />
          <Item step={2}>
            <StatusBadge status="pending" />
          </Item>
          <Arrow step={3} />
          <Box tone="ad" step={3}>
            승인 → 적용
          </Box>
        </Flow>
        <Flow>
          <Item step={4}>
            <StatusBadge status="rejected" />
          </Item>
          <Box step={4}>사유와 함께 돌아와요</Box>
        </Flow>
      </Scene>
    ),
  },
  tier: {
    once: true,
    render: () => (
      <Scene>
        <Box tone="ghost">광고 자리 1개</Box>
        <Flow>
          <Box tone="ad" step={1}>
            기간제
          </Box>
          <Arrow step={2} />
          <Box step={2}>보장</Box>
          <Arrow step={3} />
          <Box step={3}>하우스</Box>
          <Arrow step={4} />
          <Box tone="faint" step={4}>
            빈 자리
          </Box>
        </Flow>
        <Cap step={5}>앞 등급이 없을 때만 다음으로 가요</Cap>
      </Scene>
    ),
  },
  'delivery-status': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Item step={1}>
            <StatusBadge status="draft" />
          </Item>
          <Item step={2}>
            <StatusBadge status="pending" />
          </Item>
          <Item step={3}>
            <StatusBadge status="scheduled" />
          </Item>
          <Item step={4}>
            <StatusBadge status="active" />
          </Item>
          <Item step={5}>
            <StatusBadge status="done" />
          </Item>
        </Flow>
        <Flow>
          <Cap step={5}>갈림길</Cap>
          <Item step={5}>
            <StatusBadge status="paused" />
          </Item>
          <Item step={5}>
            <StatusBadge status="rejected" />
          </Item>
          <Item step={5}>
            <StatusBadge status="under" />
          </Item>
        </Flow>
      </Scene>
    ),
  },
  impression: {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>광고 재생</Box>
          <Arrow step={2} />
          <Box step={2}>2초 지남</Box>
          <Arrow step={3} />
          <Box tone="ghost" step={3} sub="지금은 수집 안 함">
            노출 +1
          </Box>
        </Flow>
      </Scene>
    ),
  },

  'house-ad': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Box step={1}>하우스 광고 등록</Box>
          <Arrow step={2} />
          <Box step={2}>지면 편성 구간</Box>
          <Arrow step={3} />
          <Box tone="ad" step={3}>
            그 구간에서 재생
          </Box>
        </Flow>
      </Scene>
    ),
  },
  'ad-request': {
    once: true,
    render: () => (
      <Scene>
        <Flow>
          <Item step={1}>
            <StatusBadge status="draft" label="접수" />
          </Item>
          <Item step={2}>
            <StatusBadge status="pending" label="검토" />
          </Item>
          <Item step={3}>
            <StatusBadge status="scheduled" label="집행 예정" />
          </Item>
          <Item step={4}>
            <StatusBadge status="active" label="집행" />
          </Item>
          <Item step={5}>
            <StatusBadge status="done" label="종료" />
          </Item>
        </Flow>
        <Flow>
          <Cap step={5}>갈림길</Cap>
          <Item step={5}>
            <StatusBadge status="paused" label="보완 요청" />
          </Item>
          <Item step={5}>
            <StatusBadge status="rejected" label="반려" />
          </Item>
        </Flow>
      </Scene>
    ),
  },
} satisfies Record<HelpTermId, HelpMotionSpec>;

export function motionFor(id: HelpTermId): HelpMotionSpec {
  return HELP_MOTIONS[id];
}
