# A1 광고 관리자 앱 최소 구현 계약

작성: 오케스트레이터(Claude, Herdr `tools` `w1:p1`), 2026-10-20. 상태: 배정 기준. 바꿀 때는 오케스트레이터가 이 파일을 먼저 고친 뒤 담당에게 알린다.

## 1. 사용자 결정 (2026-10-20)

- 관리자 API는 PHP다. UI/UX는 `design/` 디자인 시스템을 바탕으로 React + Vite로 컴포넌트를 빌드하고, vanilla HTML에서 그 번들을 불러와 쓴다.
- 이번 단계는 **현재 동영상 플레이어를 테스트할 수 있는 최소 기능**만 실제로 동작시킨다. 나머지는 "미구현" 또는 "목업"으로 표시한다.
- 화면은 Claude Design 캔버스를 참고한다. v2 독립 설치판: https://claude.ai/artifact/AxDbsGSWLWKGNQBke7EHZ6 . 그누보드5 팝업판: https://claude.ai/artifact/1qyzkCShsodgaV8Jn9wdfV . 기획 근거는 `ads-admin-v2-spec.md`, `ads-admin-gnuboard-spec.md`(초안)다.
- 이 결정은 v2 명세 §13의 "React 범위 밖"을 이번 단계에 한해 대체한다. v2 도메인(광고주·캠페인·집행·승인·impression)과 DB 마이그레이션 002는 A1 범위가 아니다.

## 2. 실제 동작 범위 (기존 v1 API 사용)

| ID | 기능 | 사용하는 v1 액션 |
| --- | --- | --- |
| F1 | 접속: bootstrap, 독립 설치 로그인·로그아웃, 그누보드 로그인 링크(`capabilities.loginUrl`) | `bootstrap`, `login`, `logout` |
| F2 | 소재: 목록, URL 등록, 파일 업로드, 수정(새 버전), 보관, 입력 소재 미리보기 | `creatives`, `creative-save`, `creative-upload`, `creative-archive` |
| F3 | 지면 편성: 대상 선택(site/board/category/video, 검색 또는 수동 ID), `inherit/replace/disabled`, pre·mid@초·post 구간, 광고 항목(소재·클릭 URL·스킵·이미지 표시 시간·순서), 초안 저장(409 충돌), 게시, 상속 출처 표시. 독립 설치 영상 소속 등록 | `targets`, `schedule-draft`, `schedule-save`, `schedule-publish`, `video-context-save` |
| F4 | 미리보기: 미리보기 스케줄을 실제 광고 모듈로 재생(`preview:true`), 이번 미리보기 실행 기록 표시. v1 `preview.js`와 같은 동작 | `schedule-preview`, `bootstrap.playerModuleUrl` |
| F5 | 재생 테스트: 게시본을 실제 수집 경로로 재생하는 예제 링크. `examples/player.html?video=&content=`, `examples/videojs.html?video=&media=mp4&content=` | 공개 `schedule`, `events` |
| F6 | 기본 통계: 기간·광고·영상·게시판 조회, CSV | `stats`, `stats-csv` |

F5는 지면 편성 화면 안의 "게시본 재생 테스트" 영역으로 둔다. 별도 메뉴를 만들지 않는다. 예제 `context.js`는 `content`를 예제 페이지 주소 기준으로 해석하므로, 링크에는 관리자 페이지 기준으로 정규화한 절대 http(s) URL을 넣는다. 기본 본편 URL은 `demo-media/grok-20261018/content-scene-01.mp4`다(생성물, Git 제외).

v1 규약을 그대로 지킨다: 봉투 `{ok, data}`/오류, GET 읽기·POST 쓰기, 관리자 응답마다(오류 응답 포함) `X-CSRF-Token`을 먼저 반영한 뒤 처리, multipart는 `csrfToken` 필드 허용, 모호한 네트워크 실패 뒤 쓰기를 자동 재시도하지 않음, 저장 실패 시 입력 보존, `preview:true`는 수집 요청을 보내지 않음.

## 3. 메뉴 구성과 목업

`bootstrap.capabilities.host`로 메뉴를 고른다. 같은 번들 하나가 두 호스트를 처리한다.

| 호스트 | 메뉴 (캔버스 순서) | 실제 동작 | 목업/미구현 |
| --- | --- | --- | --- |
| `standalone` | 대시보드 · 캠페인 · 소재 · 지면 편성 · 플레이어 · 승인함 · 리포트 · 설정, 우측 "도움말"·"집행 만들기" | 소재(F2), 지면 편성(F3–F5), 플레이어(3.2절), 리포트 안 "기본 통계"(F6) | 대시보드·캠페인(목록·상세)·승인함·리포트 v2 영역·설정·집행 만들기 |
| `gnuboard` | [사이트 이름] 광고 관리 · 광고 요청 · 하우스 광고 · 지면 편성 · 플레이어 · 통계 · 설정, 우측 도움말·사이트 보기·관리자·창 닫기 | 하우스 광고 = 소재(F2), 지면 편성(F3–F5), 플레이어(3.2절), 통계(F6) | 광고 요청(목록·상세)·설정 |

- 목업 화면은 캔버스 화면을 정적 데이터로 그린다. 화면 상단에 "목업 · 아직 동작하지 않아요" 표시를 항상 둔다. 목업은 API를 호출하지 않는다. 목업 안의 쓰기 버튼은 비활성화하고 이유를 함께 쓴다. 성공처럼 보이는 상태를 만들지 않는다.
- 우선순위가 낮은 목업은 "미구현" 안내 카드(무엇을 할 화면인지 한두 줄과 기획 문서 위치)로 대신해도 된다. 대시보드, 캠페인 상세(집행 표), 광고 요청 목록은 목업으로 그린다.
- 그누보드 "창 닫기"는 `window.opener`가 있을 때만 `window.close()`를 쓰고, 그 밖에는 숨긴다. 사이트 이름 표시를 위해 API를 바꾸지 않는다. 값이 없으면 "광고 관리"로 쓴다. "사이트 보기"와 "관리자"는 `capabilities.siteUrl`, `capabilities.adminUrl`로 연결하고, 값이 없으면 그 링크를 숨긴다.

### 3.1 도움말 (2026-10-20 사용자 요청)

- 두 호스트 모두 상단 오른쪽 액션 영역에 "도움말"을 둔다(독립 설치는 "집행 만들기" 앞, 그누보드는 "사이트 보기" 앞). 메뉴 항목이 아니라 숨김 route `help`다.
- 도움말은 두 부분이다. **기능 안내**: 메뉴별로 무엇을 하는 화면인지, 기본 작업 순서(소재 등록 → 지면 편성 → 미리보기 → 초안 저장 → 게시 → 재생 테스트 → 통계). 미리보기는 저장하지 않은 편집 중 초안도 재생하므로 게시 전 단계다(근거표 D1). **용어 사전**: 광고 용어와 화면 라벨의 뜻. 용어마다 HTML·CSS·SVG 모션 그림으로 개념을 보여 준다.
- 내용은 실제 동작 기준이다. 목업·미구현 기능을 설명할 때는 "지금 동작" / "목업" / "준비 중" 상태를 같이 표시하고, 동작하는 것처럼 쓰지 않는다. 호스트별 용어(소재 ↔ 하우스 광고, 리포트 ↔ 통계, 그누보드 전용 광고 요청)를 구분한다.
- 모션 규칙: 글 설명이 먼저이고 모션은 보조다. 모션 그림은 `aria-hidden`이거나 같은 내용의 대체 텍스트를 가진다. 5초를 넘거나 반복하는 모션에는 일시정지·다시 보기 컨트롤을 둔다. `prefers-reduced-motion: reduce`에서는 움직임 없이 최종 상태 그림을 보여 준다. 외부 라이브러리 없이 CSS 애니메이션과 인라인 SVG로 만들고 토큰만 쓴다.
- 화면 필드 옆 "?" 링크(`HelpLink`)로 해당 용어로 바로 간다. 링크 주소는 `#/help/<termId>`다.

### 3.2 플레이어 관리 (2026-10-20 사용자 요청)

- 메뉴 "플레이어"(route `players`)를 두 호스트 모두 "지면 편성" 다음에 둔다. 하위 화면은 해시 route이고, 화면 위 하위 탐색(링크와 `aria-current="page"`, ARIA 탭이 아님)으로 오간다: `#/players`(프리셋 목록), `#/players/new`, `#/players/edit/<presetId>`(프리셋 편집과 스킨 테마), `#/players/setup`(초기 설정 방법), `#/players/options`(옵션 설명).
- **프리셋(지금 동작):** 플레이어 종류, 스킨, 테마, 광고 화면 설정을 이름 붙여 저장한 묶음이다. 목록(이름, 플레이어 종류, 스킨, 기본 표시, 수정 시각), 새로 만들기, 복제, 수정, 삭제(앱 Dialog 확인), 기본으로 지정. 내장 `default`는 패키지 기본값 그대로인 읽기 전용 프리셋이다. 지우거나 고칠 수 없고 복제는 된다. 처음 기본 프리셋은 `default`다.
- 저장하면 바로 적용된다(초안·게시 단계 없음). 적용 대상은 `preset=<id>`로 프리셋을 불러오는 페이지(예제·재생 테스트)와 미리보기다. 설치 코드는 만든 시점의 값을 코드에 넣으므로, 이미 붙여 넣은 코드는 다시 만들어 붙여 넣어야 바뀐다. 저장 버튼 옆에 "저장하면 재생 테스트 페이지에 바로 적용돼요. 이미 붙여 넣은 설치 코드는 다시 복사해야 바뀌어요."를 쓴다. 기본 프리셋은 설치 코드 생성기와 재생 테스트에서 먼저 선택되는 프리셋이고, 공개 `player-preset`을 id 없이 부르면 돌려주는 프리셋이다. 동시 수정은 revision으로 막고, 409에서는 입력을 유지하고 다시 불러오기를 안내한다(지면 편성과 같은 방식).
- **스킨 테마(지금 동작):** 편집 화면은 설정 폼과 실시간 미리보기(`ThemePreview`)다. 폼 항목은 4절 프리셋 스키마 그대로다. 미리보기는 저장 전 입력도 바로 반영하고 수집 요청을 보내지 않는다. 강조색과 강조 글자색의 대비가 4.5:1 미만이면 경고한다(저장은 막지 않는다). 기본 video 종류에서는 스킨 항목을 숨기고 "기본 video는 브라우저 컨트롤을 써서 스킨 테마가 적용되지 않아요"를 쓴다.
- **초기 설정 방법(지금 동작):** 단계 안내(파일 준비 → 페이지에 스타일·스크립트 넣기 → 플레이어 배치 → 영상 ID로 편성 연결 → 재생 확인)와 설치 코드 생성기다. 프리셋, 영상 ID, 본편 URL, 미디어(MP4 / HLS-SPF / HLS-hls.js, 마지막 둘은 Video.js만)를 고르면 HTML 코드를 만들고 복사할 수 있다. 그누보드는 영상 ID 형식(`게시판:글번호:영상키`)과 코드를 넣을 위치를 근거표(`.agents/plans/ads-admin-player-facts.md`) 기준으로 안내한다. 근거가 없는 자동 삽입은 "준비 중"으로 둔다.
- **옵션 설명(지금 동작):** `<media-ads>` 속성, `createAdsController` 옵션과 반환 메서드, 스킨 CSS 속성(공개 `--media-*`), 광고 화면 CSS 속성(`--ads-*`), 예제 페이지 쿼리(`video`, `content`, `media`, `engine`, `preset`) 표다. 행마다 이름, 형식, 기본값, 설명, 프리셋에서 설정 가능 여부를 둔다. 표 내용은 소스와 대조하는 테스트로 지킨다.
- **준비 중:** 프리셋 ID로 불러와 저장 즉시 반영되는 설치 코드, 게시판·분류·영상별 프리셋 지정(상속), 프리셋 변경 이력과 되돌리기, 사용자 CSS 직접 입력, 로고·워터마크, 오디오·라이브 플레이어, compat·scaffold 스킨, `<media-ads>` 시간 제한 설정, 스킨 소스 내려받기(공식 안내 링크만). 해당 위치에 "준비 중" 표시와 이유를 둔다.
- 재생 테스트: F5 `PlayerTestLinks`에 고른 프리셋을 넘기면 예제 링크에 `preset=<id>`를 붙인다(`default`면 생략). 예제 페이지는 `preset`이 있으면 공개 `player-preset`으로 받아 적용한다.
- 도움말: 플레이어 용어(프리셋, 기본 프리셋, 스킨, 테마 속성, 강조색, 광고 화면, 설치 코드)를 용어 사전에 더하고 화면 필드 옆에 `HelpLink`를 둔다.

## 4. 구조와 경계

```
integrations/ads-manager/
  ui/                         @videojs/ads-manager-ui (private workspace package)
    src/main.tsx              mount 진입점
    src/components/**         디자인 시스템 React 컴포넌트 (designer)
    src/mocks/**              목업 화면과 정적 데이터 (designer)
    src/app/**, src/api/**, src/screens/**   앱 셸·라우팅·API·실동작 화면 (ads-admin-ui)
    src/player/**             미리보기 플레이어·재생 테스트 링크 (ads-implementer)
    tests/**                  Vitest (각 담당이 자기 영역 테스트 파일)
  admin/app.php               vanilla HTML 셸 (ads-admin-api)
  public/index.php            셸 선택 (ads-admin-api)
  public/assets/admin-app/    빌드 출력. Git 제외
```

- **빌드:** `vp build`(Vite lib, ES 모듈 1개). 출력은 `public/assets/admin-app/admin-app.js`, `admin-app.css` 고정 이름. React는 번들에 포함한다. lib 모드는 `process.env.NODE_ENV`를 자동 치환하지 않으므로 `define`으로 `"production"`을 지정한다. outDir가 패키지 밖이므로 `emptyOutDir: true`를 명시한다.
- **스타일:** 번들에서 `design/components/fonts.css`(Google Fonts 웹 글꼴), `design/tokens.css`, `design/components/bundle.css` 순서로 가져온다. `sa-` 클래스와 `var(--…)` 토큰만 쓴다. 디자인 시스템에 없는 컴포넌트 스타일은 designer가 `design/`에 정식으로 추가한다(`design/AGENTS.md` 절차). 앱 전용 배치 CSS는 `ui/src/**`에 두되 토큰만 쓴다.
- **셸 계약:** `admin/app.php`는 다음을 출력한다.
  - `<title>솔애드 관리자</title>`, `<div id="ads-admin-root"></div>`
  - `<script id="ads-config" type="application/json">{"apiUrl": …, "assetUrl": …}</script>` — `assetUrl`은 `…/assets/admin-app/`로 끝난다. v1 셸의 `apiUrl` 검증과 JSON 이스케이프를 그대로 쓴다.
  - `admin-app.css`, `admin-app.js`(module)를 `?v=<filemtime>`과 함께 불러온다.
  - 번들 파일이 없으면 화면을 꾸미지 말고 "관리자 화면 파일이 없습니다. `ui`를 빌드해 주세요." 안내와 503을 반환한다. `<noscript>` 안내를 둔다.
- **mount 계약:** 번들은 `mountAdsAdmin(element, config) → { unmount() }`를 export한다. 로드 시 `#ads-admin-root`와 `#ads-config`가 있으면 자동으로 mount한다. React 화면 상태는 URL 해시로 유지한다(새로고침 후 같은 메뉴).
- **진입:** `public/index.php`는 기본으로 `admin/app.php`를 쓴다. `?ui=v1`이면 기존 `admin/index.php`를 쓴다. v1 셸과 `public/assets/admin/**`는 비교·회귀용으로 수정하지 않는다.
- **담당 간 export 계약:** 화면(ads-admin-ui)은 아래 이름만 가져다 쓴다. 바꿀 때는 오케스트레이터를 거친다.
  - `src/components/index.ts`(designer): 디자인 시스템 컴포넌트. prop 계약은 `src/components/README.md`에 둔다.
  - `src/mocks/index.ts`(designer): `mockScreens = { standalone: { dashboard, campaigns, approvals, reportV2, settings, newLineItem }, gnuboard: { requests, settings } }`(newLineItem은 QA B12로 2026-10-21 추가). 값은 prop 없는 React 컴포넌트다.
  - `src/help/index.ts`(designer): `HelpScreen({ host, termId? })`는 기능 안내와 용어 사전을 그린다. `termId`가 있으면 그 용어로 스크롤하고 제목에 포커스한다. `HelpLink({ termId, children? })`는 `#/help/<termId>`로 가는 작은 "?" 링크다. `helpTerms`는 용어 id 목록이다(화면과 테스트가 잘못된 id를 쓰지 않게 한다). 도움말은 API를 호출하지 않는다.
  - `src/player/index.ts`(ads-implementer): `PreviewPlayer({ moduleUrl, schedule, contentUrl, loadModule? })`는 (`loadModule`은 테스트 주입용 선택 prop이고 화면은 넘기지 않는다) 받은 미리보기 스케줄을 `<video>` 하나에 `createAdsController({ preview: true })`로 재생하고, 상태와 이번 실행 기록을 보여 준다. unmount나 prop 변경 시 controller를 destroy한다. `PlayerTestLinks({ examplesUrl, videoId, contentUrl })`는 F5의 두 예제 링크를 새 탭으로 연다. 화면이 `schedule-preview` 호출과 오류 표시를 맡는다.
- **API 추가 (A1):** `bootstrap`의 인증 응답에 `user: {displayName}`을 더한다. 독립 설치는 로그인 아이디, 그누보드는 회원 닉네임(없으면 아이디)이다. 2차 검토(F-6)에 따라 `capabilities.siteUrl`, `capabilities.adminUrl`을 더한다. 그누보드는 `G5_URL`과 `G5_ADMIN_URL` 기준 절대 URL, 독립 설치는 `null`이다. 두 값은 인증 전 응답에도 실을 수 있다(`loginUrl`과 같은 공개 정보). 그 밖의 새 액션이 필요하면 담당이 오케스트레이터에게 요청하고, 이 파일에 먼저 기록한 뒤 구현한다.

### 4.1 플레이어 프리셋 (3.2절)

**스키마 v1.** PHP 검증, TS 검증(`parsePlayerPreset`), 예제 JS 검증이 이 표 하나를 따른다. 알 수 없는 키와 범위 밖 값은 거부한다(조용히 고치지 않는다). 비운 값은 `null`이고 해당 CSS 속성이나 HTML 속성을 내보내지 않는다.

| 필드 | 허용 값 | 비우면 | 적용 |
| --- | --- | --- | --- |
| `id` | 서버가 만든 `^p-[a-z0-9]{10}$`, 내장 `default` | — | — |
| `name` | 앞뒤 공백을 뺀 1–40자, 제어 문자 금지 | 필수 | — |
| `playerType` | `videojs` \| `native` | 필수 | — |
| `skin` | `default` \| `neutral` (`native`면 `null`) | `default` | `default` → `<video-skin>`, `video.css`, `video.js` / `neutral` → `<video-neutral-skin>`, `video-neutral.css`, `video-neutral.js` |
| `theme.accentColor` | 소문자 `#rrggbb` | 스킨 기본 | `--media-accent-color` |
| `theme.accentTextColor` | 소문자 `#rrggbb` | 자동 대비 | `--media-accent-text-color` |
| `theme.borderColor` | 소문자 `#rrggbb` | 스킨 기본 | `--media-border-color` |
| `theme.borderRadius` | 정수 0–32 | 스킨 기본 | `--media-border-radius: <n>px` |
| `theme.fontFamily` | `system` | 스킨 기본 | `--media-font-family: system-ui, sans-serif` |
| `theme.objectFit` | `contain` \| `cover` | 스킨 기본 | `--media-object-fit` |
| `theme.scaleUnit` | `root` | 스킨 기본(16px) | `--media-scale-unit: 1rem` |
| `ads.locale` | `ko` \| `en` | 페이지 `lang` | Video.js: `<media-ads lang>` / native: `ui.locale` |
| `ads.labels.skip` | 0–40자, 제어 문자·`{…}` 금지 | 패키지 문구 | `skip-label` / `ui.labels.skip` |
| `ads.labels.skipCountdown` | 0–40자, `{seconds}`만 허용 | 패키지 문구 | `skip-countdown-label` / `ui.labels.skipCountdown` |
| `ads.labels.timer` | 0–40자, `{elapsed}` `{duration}` `{remaining}`만 허용 | 패키지 문구 | `timer-label` / `ui.labels.timer` |
| `ads.accentColor` | 소문자 `#rrggbb` | 흰색(`--media-accent-color`가 있으면 그 값) | `--ads-accent-color`. 광고 음량 막대 색만 바뀐다. 화면 라벨은 "광고 음량 막대 색" |
| `ads.skipRadius` | 정수 0–24 | 6 | `--ads-skip-radius: <n>px` |
| `ads.fontSize` | 정수 11–18 | 13 | `--ads-font-size: <n>px` |
| `ads.timeouts.loadSeconds` | 정수 1–60 | 5 | native만 `timeouts.loadSeconds` |
| `ads.timeouts.stallSeconds` | 정수 1–120 | 10 | native만 `timeouts.stallSeconds` |

- CSS 속성은 Video.js에서는 스킨 요소의 `style`에, 기본 video에서는 광고 컨테이너의 `style`에 `setProperty`로 넣는다. `innerHTML`·문자열 결합 CSS를 쓰지 않는다. 표에 없는 속성 이름은 적용하지 않는다.
- **저장:** 기존 meta 저장소의 키 `player_presets` 하나에 JSON 문서(`{revision, defaultPresetId, presets[]}`)로 둔다. 스키마 버전, 테이블, DDL은 바꾸지 않는다(18765·18766과 기존 설치가 그대로 동작해야 한다). 키가 없으면 내장 `default`만 있는 것으로 읽고, 읽기는 쓰지 않는다. 쓰기는 기존 write lock 안에서 한다. 저장 프리셋은 최대 20개다.
- **관리자 액션(인증, 쓰기는 CSRF):** `GET player-presets` → `{revision, defaultPresetId, presets}`(내장 `default` 포함, `builtIn: true`). `POST player-preset-save {preset, revision}`(id 없으면 생성, 있으면 수정, `default` 수정은 400). `POST player-preset-delete {id, revision}`(`default`는 400, 기본 프리셋을 지우면 `default`로 돌아간다). `POST player-preset-default {id, revision}`. 세 쓰기 모두 문서 revision이 다르면 409이고 응답에 최신 목록을 싣지 않는다(화면이 다시 불러온다). 검증 오류는 기존 오류 봉투에 필드 경로를 싣는다.
- **공개 액션(인증 없음):** `GET player-preset[&id=]` → `{id, revision, playerType, skin, skinTag, styles: {css, js}, css: {이름: 값}, attributes: {이름: 값}, ui: {locale?, labels?}, timeouts?}`. `name`은 싣지 않는다. id가 없으면 기본 프리셋, 없는 id는 404 `preset_not_found`. `Cache-Control: no-store`. `styles`는 `public/assets/videojs/` 기준 상대 파일 이름이다.
- `bootstrap.capabilities.playerPresets: true`를 더한다.
- **플레이어 근거표 반영(2026-10-20, `.agents/plans/ads-admin-player-facts.md`):** `ads.labels.mediaAlt`는 스키마에서 뺀다. 런타임이 프리셋 값을 소재별 대체 텍스트보다 먼저 쓰기 때문이다(`overlay.ts:277`). 옵션 표에는 `media-alt` 속성을 남기되 "소재 대체 텍스트를 덮어써요" 경고와 "프리셋에서 설정 안 함"으로 둔다. 타이머는 `{remaining}`을 허용한다. 대비 경고는 강조색과 강조 글자색을 비교하고, 강조 글자색이 비었으면 `contrast-color()`가 없는 브라우저의 대체값인 검정과 비교해 "강조 글자색도 지정해 주세요"를 안내한다. 언어를 비우면 `<media-ads>`부터 위로 `lang`을 찾고 없으면 영어이므로, 설치 안내와 편집 화면에 이를 알리고 설치 코드에는 페이지 `lang` 확인 안내를 넣는다. 설치 코드의 `<media-ads src>`와 파일 경로는 절대 URL(또는 `/`로 시작하는 경로)이다(상대 경로는 거부된다). 옵션 표·편집 화면 주의 문구: `--ads-*`는 `<media-ads>`에 직접 넣으면 효과가 없다, 플레이어 글꼴을 바꾸면 광고 화면 글꼴도 따라간다, 폭 280px 이하에서는 광고 글자가 11px로 고정된다, `<media-ads>`의 편성 요청 시간 제한은 5초 고정이다, 전체화면에서는 채우기가 contain이다, `--media-object-position`은 A1 프리셋에서 설정하지 않는다. 그누보드 게시물 자동 삽입은 저장소에 근거가 없으므로 "준비 중"이고, 설치 안내는 `/ads/` 설치, 영상 ID 형식, 방문자의 글 읽기 권한 세 가지만 근거로 쓴다(붙여 넣을 파일 위치는 안내하지 않는다).
- **A1-API-4 확정(2026-10-20):** 검증 오류는 422 `validation`이고 `fields`에 경로 하나(예: `theme.accentColor`). 그 밖에 400 `preset_limit`·`preset_builtin`·`invalid_preset_id`, 404 `preset_not_found`, 409 `revision_conflict`. `native`에 `theme.*` 값이 있거나 `videojs`에 `ads.timeouts.*` 값이 있으면 422다. 입력의 `builtIn`·`createdAt`·`updatedAt`은 무시하고 `''`는 `null`이다. 세 쓰기는 `player-presets`와 같은 목록을 돌려주고 저장은 `preset`을 더 싣는다. 공개 렌더: Video.js는 `attributes`만(`ui`·`timeouts` 키 없음), native는 `skinTag`·`styles`가 `null`이고 `attributes` 키가 없다. 내장 프리셋 이름은 "기본". 실제 `Cache-Control`은 기존 API 공통값 `no-store, no-cache, must-revalidate`다. 확정 JSON 예시: ads-admin-api 증거 `a1-api-4/examples.json`.
- **문자열 검증 기준(2026-10-20, 독립 검토 R3-16·R3-18):** "앞뒤 공백"은 JS `String.prototype.trim`과 같은 집합(유니코드 공백·줄 끝 문자, U+FEFF 포함)이다. PHP도 이 집합으로 trim한다. "제어 문자 금지"는 `\p{Cc}`에 더해 양방향 제어 문자 U+202A–U+202E, U+2066–U+2069를 거부한다(이름과 라벨 모두. TS·JS는 코드 `control`, PHP는 그 필드의 422). 세 검증기(PHP, TS, 예제 JS)가 같아야 한다.
- **알려진 차이(받아들임):** 정수 `''`, id `''`, theme `[]` 처리와 정수 표기 `5.0`·`1e1`(R3-17). JSON을 읽은 뒤에는 TS·JS가 구분할 수 없고, 관리 화면은 정수만 보낸다.
- **검토 결정(2026-10-20):** 재생 테스트 링크는 프리셋의 플레이어 종류에 맞는 링크에만 `preset`을 붙인다(R3-1). 미리보기 중 도움말을 열면 미리보기가 멈추는 것은 의도된 동작이다(메뉴가 숨겨지면 재생과 수집을 멈춘다). 안내 문구로 알린다(R4-23).
- **TS export (`src/player/index.ts`, ads-implementer):** `type PlayerPreset`, `parsePlayerPreset(value: unknown)`, `presetRender(preset)`(공개 액션과 같은 모양을 만든다), `ThemePreview({ preset, examplesUrl })`(같은 출처 iframe `examples/player-preview.html`, Grok 샘플 raw 편성으로 재생해 수집 없음, 테마 변경은 `postMessage`로 다시 불러오지 않고 반영, 플레이어 종류·스킨이 바뀔 때만 다시 불러옴, unmount 때 정리), `installSnippet({ preset, host, videoId, contentUrl, media, assetsUrl, apiUrl })`(HTML 문자열. 속성 값은 HTML 이스케이프, 스크립트 안 값은 `JSON.stringify` 뒤 `<`를 `\u003c`로 바꾼다), `playerOptions`(옵션 설명 표 데이터). `PlayerTestLinks`에 선택 prop `presetId`를 더한다.
- **디자인 시스템 추가(designer):** `ColorField`(색 선택과 `#rrggbb` 글자 입력을 한 라벨로 묶고 오류를 연결), `CodeBlock`(코드 표시와 복사 버튼, 복사 결과를 상태 문구로 알리고 실패하면 직접 선택하도록 안내), `SubNav`(route 링크 묶음, 현재 항목 `aria-current="page"`). `design/components/`와 `src/components/index.ts`에 더한다.
- **iframe 메시지:** `player-preview.html`은 `event.origin === location.origin`이고 `event.source === window.parent`인 `{type: 'ads-player-preview', preset}`만 받고, 받은 프리셋을 같은 스키마로 다시 검증한다.
- **v1 영어 문구 되돌리기(2026-10-22, `ads-a2e-spec.md` 6.3):** v1 문서를 v2로 읽을 때 `ads.locale`이 `en`인 프리셋은 `ads.labels.*`를 모두 `null`로 바꾼다(`language: "en"`은 그대로 옮긴다). locale이 `null`이나 `ko`면 문구를 지킨다. `player-presets`와 세 쓰기 응답은 `migratedNeutral` 옆에 `migratedLabels: string[]`(실제로 문구를 버린 프리셋 id만, v2 문서면 `[]`)을 싣는다. 읽기는 쓰지 않고 다음 쓰기가 v2로 저장한다.

### 4.2 강의(LMS) (2026-10-22, `ads-lms-spec.md` 3절)

- **설치:** `database/lms/001.sql`(두 엔진 공통 `CREATE TABLE IF NOT EXISTS`)을 설치기 CLI(`bin/install.php`)만 실행하고 meta `lms_schema_version = '1'`을 쓴다. 핵심 `schema_version`과 `App.php:16` 검사는 그대로다. 이 meta가 없으면 공개 LMS 액션과 `lms-settings`를 뺀 관리자 LMS 액션은 503 `lms_unavailable`이고, `lms-settings`는 `installed: false`를 돌려준다. 다른 액션은 영향이 없다. `bootstrap.capabilities.lms: {installed}`.
- **표:** `lms_progress` PK(site_id, learner, video_id). 명세 칼럼에 `session_id`, `seq`(멱등 판정용)를 더했다. `lms_notes` PK(site_id, id), 고유 인덱스(site_id, learner, video_id, id). 지우기는 `deleted_at`이다. 운영 권한은 SELECT/INSERT/UPDATE만 쓴다(레이트 리밋 버킷은 기존 `rate_limits` 표).
- **학습자 ID 저장:** `learner`는 `g:<mb_id>`(그누보드 로그인 회원, `verify_mb_key` 통과 시) 또는 `x:<sub>`(외부 학습자 토큰)다. 진도·메모 표에만 저장한다. IP와 User-Agent는 저장하지 않는다. 우선순위는 그누보드 회원 → 유효한 학습자 토큰 → 없음(`storage: 'local'`, 토큰 없음)이다. 틀린 토큰은 `learnerError: 'invalid'`, 만료는 `'expired'`이고 요청은 실패하지 않는다.
- **토큰:** 학습자 토큰은 `base64url(payload).base64url(HMAC-SHA256(lms_key의 hex 글자, payload 부분))`, payload는 정확히 `{v:1, sub, exp, dur?}`(다른 키는 invalid, `dur`은 0 초과 86400 이하)다. `lmsToken`은 `hash_hmac('sha256', 'lms-session', signing_key)`로 서명해 광고 `eventToken`과 서로 쓰이지 않는다. claims는 명세 7개에 `sessionId`, `duration`을 더한다. 유효 시간은 `sessionSeconds`(기본 7200초)다. 그누보드 학습자 토큰은 요청마다 지금 로그인 회원과 같은지 다시 본다(다르면 403 `invalid_session`).
- **공개 액션(POST JSON, 인증 없음, 세션 쿠키 없음, `no-store`):**
  - `lms-session {videoId, presetId?, learnerToken?}` → 명세 3.3 모양. 규칙은 `presetId`(없거나 지워진 id면 사이트 기본 프리셋, 형식이 틀리면 400 `invalid_preset_id`)의 `lms` 그룹이고 꺼져 있으면 내장 `lms` 값이다.
  - `lms-progress {lmsToken, videoId, seq, reason, segments, position, duration, rate, activeSecondsDelta}` → `{percent, completedAt, maxWatched, segments}`. `videoId`는 토큰과 같아야 한다(다르면 403). 첫 보고(이 세션의 첫 보고)는 `30초 × maxRate`, 그 뒤는 `(지금 − reported_at + 5초) × maxRate`까지 새 시청을 받는다. 오류: 400 `duration_mismatch`·`segment_limit`, 403 `invalid_session`, 422 `validation`.
  - `lms-notes {lmsToken, videoId, op, note?}` → `{notes: [{id, kind, time, text}]}`. 메모는 줄바꿈을 포함한 제어 문자를 받지 않는다(프리셋 이름 규칙). 400 `note_limit`, 404 `note_not_found`.
- **레이트 리밋:** 학습자·영상마다 60회/분, 설치 전체 LMS 버킷 `lmsRateLimitPerMinute`(기본 6000, 1–1000000) 회/분이며 광고 버킷과 따로 센다. 넘으면 429 `rate_limit`. 학습자 버킷은 진도 트랜잭션 안에서 세므로 롤백된 요청은 세지 않는다.
- **쓰기 잠금:** 진도·메모는 설치 전체 `write_lock`을 쓰지 않는다. 한 행 트랜잭션이고 SQLite는 먼저 쓰기로 잠금을 잡는다(busy_timeout 10초). 부하(SQLite, `PHP_CLI_SERVER_WORKERS=8`, 50 학습자 × 15초 + 200회/초 × 10초): 버스트 p50 3.4ms·p95 122ms, 429·5xx·SQLite busy 0, 같은 때 광고 이벤트 p95 9.4ms → 61ms.
- **편성:** `schedule&breaks=preroll`은 `pre` 휴식만 돌려주고 세션 스냅샷·`eventToken` claims(`breaks: 'preroll'`)도 그 결과로 만든다. 다른 값은 422 `breaks`.
- **관리자 액션:** 명세 3.4 표 그대로다. `lms-key-rotate`의 `key`는 그 응답에만 실린다. `lms-progress-list`의 `learner`는 접두사(`g:`·`x:`)를 포함해 돌려주고, 거름 `learner`는 접두사 없이 받는다. `page`는 1부터, `status`는 `all|done|doing`이고 틀리면 422다. CSV 파일 이름은 `lms-progress.csv`.
- **확정 JSON 예시:** ads-admin-api 증거 `l1-api/evidence/examples.json`(키·토큰 값은 `<redacted>`).

## 5. 팀과 배정

2026-10-20 사용자 지시로 Codex 담당 5명을 Claude Opus 5.5(`claude-opus-5-5`, effort high)로 교체했다. 이름과 pane은 유지했다. 이전 Codex 세션 ID(필요 시 `codex resume`): ads-source-analyst `01a14840-dfc1-7630-9362-6f2a55cfd424`, ads-implementer `01a14841-332b-7561-9b3b-4b3c4fbbe6bd`, ads-admin-api `01a14874-e0de-7c33-b579-f716cdec5561`, ads-admin-ui `01a14876-0d6a-78a0-8123-142836ccc2d5`, ads-qa `01a14876-1831-7712-9015-a326b2f016a6`. `grok`(Grok 4.7, `w1:p7`)은 미디어 담당이라 그대로 둔다.

| TASK | 담당 | 소유 경로 | 선행 |
| --- | --- | --- | --- |
| A1-DS | ads-admin-designer (`w1:p8`) | `ui/src/components/**`, `ui/src/mocks/**`, `ui/src/help/**`, `ui/tests/components*.test.tsx`, `ui/tests/mocks.test.tsx`, `ui/tests/help.test.tsx`, `design/**` | 없음. 컴포넌트를 먼저 내고 목업은 그다음 |
| A1-UI | ads-admin-ui (`w1:p5`) | `ui/package.json`(scripts만), `ui/vite.config.ts`, `ui/tsconfig.json`, `ui/index.html`(개발용), `ui/src/main.tsx`, `ui/src/app/**`, `ui/src/api/**`, `ui/src/screens/**`, `ui/tests/**`(다른 담당 파일 제외), `integrations/ads-manager/README.md`의 관리자 화면 절 | 빌드·API·화면 로직은 즉시. 화면 마감은 A1-DS 컴포넌트 이후 |
| A1-PLAYER | ads-implementer (`w1:p3`) | `ui/src/player/**`, `ui/tests/player*.test.tsx`, `public/examples/**`(README 포함) | 없음 |
| A1-API | ads-admin-api (`w1:p4`) | `admin/app.php`, `public/index.php`, `src/**`, `hosts/**`, `tests/backend/**` | 없음 |
| A1-QA | ads-qa (`w1:p6`) | `workspaces/ads-admin-app-20261020/**` | 계획은 즉시, 실행은 빌드 후 오케스트레이터 지시 |
| A1-REVIEW | ads-source-analyst (`w1:p2`) | 읽기 전용 | 구현 완료 후 |

- 의존성(`ui/package.json`의 dependencies·devDependencies), `pnpm-lock.yaml`, `pnpm-workspace.yaml`, 루트 `tsconfig.json`·`vite.config.ts`, Git commit/push는 오케스트레이터만 바꾼다.
- 기존 18765·18766 서버를 재시작하거나 교체하지 않는다. 쓰기 검증은 새 격리 SQLite 설치와 새 포트에서 한다. 고객 DB에 연결하지 않는다.
- 같은 파일을 두 담당이 동시에 고치지 않는다. 다른 담당의 파일이 필요하면 오케스트레이터에게 요청한다.

## 6. 완료 조건

- `pnpm -F @videojs/ads-manager-ui build`가 고정 이름 두 파일을 만든다. UI 단위 테스트, `tsgo` 타입 검사(패키지 `typecheck` 스크립트), `vp check`(format·lint) 통과.
- 기존 검사 유지: 관리자 v1 Vitest 59, PHP SQLite 70, HTTP 110(셸 선택·번들 없음·`user.displayName` 단언 추가분 별도 집계), PHP lint.
- API 클라이언트 단위 테스트: 봉투·오류 해석, 오류 응답을 포함한 CSRF 토큰 반영, multipart 토큰, 409 처리, 쓰기 자동 재시도 없음.
- 실제 브라우저(격리 설치): 로그인 → Grok 데모 MP4 URL 소재 등록과 파일 업로드 → 사이트 기본 편성 pre/mid/post → 초안 저장 → 게시 → 미리보기에서 광고 재생과 수집 요청 0 → 재생 테스트 링크에서 게시본 재생 → 기본 통계에 start 반영. 1280px과 768px, 키보드로 메뉴·저장·게시 가능.
- 목업 화면은 표시가 보이고 API 요청 0, 쓰기 버튼 비활성.
- 플레이어 관리: 프리셋 생성·수정·복제·삭제·기본 지정이 격리 설치에 저장되고, 409에서 입력이 남는다. 편집 중 테마가 미리보기에 저장 전 반영되고 미리보기 수집 요청 0. 설치 코드 생성기의 코드를 빈 HTML에 붙여 넣으면 재생된다. 예제 `?preset=<id>`가 테마를 적용한다. 옵션 표 대조 테스트 통과. 기존 설치(meta 키 없음)에서 목록이 내장 `default`만 보이고 DB 쓰기가 없다.
- 도움말: 두 호스트에서 열리고, `#/help/<termId>` 직접 진입과 필드 옆 `HelpLink`가 해당 용어로 이동한다. 모션은 reduced-motion에서 멈춘 그림으로 바뀌고, 긴 모션은 일시정지할 수 있다. 도움말 API 요청 0.
- 증거는 `workspaces/ads-admin-app-20261020/`. 실행한 것, 이전 결과, 실행하지 않은 것을 나눠 적는다.
