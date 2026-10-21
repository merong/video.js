# A1-UI-6 HelpLink 위치

ads-admin-ui의 A1-UI-6 완료 보고(2026-10-20)에서 옮겼다. 오케스트레이터 확인: ui 테스트 16개 파일 394개 통과, typecheck 통과, lint 오류 0·경고 13(기존).

## 붙인 HelpLink

**라벨 안에 넣지 않았습니다.** `Field` 라벨 안에 링크를 넣으면 컨트롤 이름이 "스킵 대기 (초) 스킵 대기 도움말"로 바뀝니다. 그래서 필드는 `help` 슬롯 끝에, 카드는 `actions`에, 제목은 옆에 두었습니다. 그 대신 필드 설명(`aria-describedby`)에 "… 도움말"이 함께 읽힙니다.

| 화면 | 위치(라벨) | termId |
|---|---|---|
| 지면 편성 · 구간 | 카드 `광고 구간 {n}개`의 actions | ad-break |
| | 구간 제목 `프리롤 · 시작 전` / `포스트롤 · 종료 후` | pre-roll / post-roll |
| | `본편 재생 위치 (초)` | mid-roll |
| | `추가할 소재` | ad-item |
| | `클릭 목적지 URL` · `이 광고의 스킵` · `스킵 대기 (초)` · `이미지 · GIF 표시 (초)` | click-through-url · ad-skip · skip-offset · image-display-time |
| 지면 편성 | `적용 단위` | target-scope |
| | `이 대상의 광고`(지금 선택한 모드만) | inherit / replace / disabled |
| | 배지 `게시 v{n}` 옆 / `저장된 초안 r{n}` 옆 | publish-version / draft-revision |
| | 저장 막대 문구 / `저장한 초안 게시` 옆 / `서버 초안 다시 불러오기` 옆 | draft / publish / revision-conflict |
| | 영상 소속 연결 설명 문단(독립 설치, 영상 대상일 때만) | video-context |
| 재생 확인 | `고정 영상 ID` / 제목 `게시 전 미리보기` / 제목 `게시본 재생 테스트` / `플레이어 프리셋` | fixed-video-id / preview / play-test / player-preset |
| 소재·하우스 광고 | 패널 설명 / `등록 방식` / `대체텍스트` / 표 열 `상태` | creative / creative-source / alt-text / archive |
| | PageHead 설명(그누보드만) | house-ad |
| 통계 | `시작일` | stats-csv |
| | KPI 아래 "지표 설명" 줄(글자 링크) | start · completion · click · click-through-rate |
| 프리셋 편집 | `이름` / `플레이어 종류` / `스킨` | player-preset / player-type / player-skin |
| | 카드 `스킨 테마` / 카드 `광고 화면` | player-theme-property / player-ad-overlay |
| | `강조색` · `강조 글자색` | player-accent-color |
| | `화면 채우기` / `광고 문구 언어` | player-object-fit / player-ad-language |
| 프리셋 목록 | 하단 안내 문단 | player-preset, player-default-preset |
| 초기 설정 | 카드 `설치 코드 만들기` / `프리셋` / `영상 ID` / `미디어` | player-install-snippet / player-preset / fixed-video-id / player-media-engine |
| 옵션 설명 | 각 행의 "프리셋 설정" 칸(`presetFieldTerm`이 경로를 용어로 연결) | accent-color · object-fit · ad-language · theme-property · ad-overlay |

## 붙이지 않은 곳
- **designer 소유 목업:** 캠페인(advertiser, campaign, line-item 열, tier, delivery-status), 대시보드(impression), 광고 요청(ad-request), 승인함 미구현 카드(approval). 붙이려면 designer 작업이 필요합니다.
- **상단 "집행 만들기" 옆 line-item:** 바로 옆이 도움말 버튼이라 "?"를 더하지 않았습니다. 원하시면 바로 붙이겠습니다.
- **프리셋 편집 `광고 강조색`(`ads.accentColor`):** 이 필드에 맞는 용어가 없어 비워 두었습니다.
