# L 강의(LMS) 플레이어 프리셋, 진도 관리, 강의 자료 싱크

- 작성: 2026-10-22, 오케스트레이터. 근거: `ads-lms-facts.md`(코드 사실), 웹 조사(오케스트레이터 scratchpad `lms-research/lms-features.md`). 이 문서와 다른 문서가 다르면 이 문서를 따른다. 바꿀 때는 오케스트레이터에게 먼저 알린다.
- 사용자 요청(원문 요지): 동영상 강의 전용(LMS) 플레이어 프리셋을 만든다. 플레이어 안에 LMS용 UI/UX를 더한다. 진도 관리, 강의 자료와 플레이어 싱크 표시 등이다.
- 사용자 결정(2026-10-22)
  1. 진도 저장: 둘 다. 학습자별로 솔애드 서버에 저장한다(그누보드 회원, 또는 외부 LMS가 서명한 학습자 ID). 외부 LMS용 JS 이벤트도 낸다.
  2. 수강 규칙: 프리셋 옵션. "본 곳까지만 앞으로 이동", 배속 상한, 완료 기준 진도율. 기본은 자유 시청과 진도 기록이다. 탭 이탈 일시정지, 중복 재생 막기, 확인 팝업 같은 원격훈련 수준 기능은 이번 범위가 아니다.
  3. 자료 싱크: 목차(챕터), 슬라이드·자료, 스크립트, 메모·북마크 네 가지 모두.
  4. 광고: LMS 프리셋은 기본으로 광고를 끈다. 켜면 프리롤만 허용하고, 광고 시간은 진도에 넣지 않는다.

## 0. 지키는 것

- `packages/`는 고치지 않는다. 막히면 고치지 말고 오케스트레이터에게 먼저 알린다. 내부 API(`@internal` extension)를 쓰는 곳은 한 파일에 모으고 주석으로 표시한다.
- **18766은 작업 트리를 그대로 서빙한다**(`-t …/integrations/ads-manager/public`). 18765도 같은 코드를 쓸 수 있다. 그래서 코드가 바뀌면 두 서버에 바로 반영된다.
  - 기존 설치가 그대로 동작해야 한다. 핵심 `schema_version` 검사(`App.php:16`, 값 '1')는 바꾸지 않는다.
  - LMS 표가 없는 설치에서 LMS 액션은 503 `lms_unavailable`을 돌려준다. 플레이어는 이 브라우저에만 저장하는 방식으로 넘어간다. 다른 액션과 화면은 그대로다.
- v2 초안의 마이그레이션 번호 002(광고 도메인, `ads-admin-v2-spec.md:297`)는 건드리지 않는다. LMS 표는 따로 번호를 매긴다(3.1).
- 학습자가 보낸 값은 믿지 않는다. 학습자는 서버가 정한다. 그누보드는 회원 세션으로, 외부 LMS는 서명 토큰으로 정한다. 진도율도 서버가 다시 계산한다.
- 같은 출처 원칙은 그대로 둔다(permissive CORS 없음). 다른 도메인의 LMS는 JS 이벤트로 자체 저장한다. 이 한계는 도움말에 적는다.
- 관리자 문구는 해요체이고, 문구표가 원본이다. 플레이어 화면 문구도 해요체다.

## 1. 프리셋 그룹 `lms`

### 1.1 필드

비운 값은 `null`이고 아래 기본값으로 동작한다. 검증은 세 곳(`public/player/preset.js`, `ui/src/player/preset.ts`, `src/PlayerPresets.php`)이 같다. 공용 fixture `tests/fixtures/player-preset-v2.json`에 케이스를 먼저 더한다.

| 필드 | 허용 값 | 비우면 | 뜻 |
| --- | --- | --- | --- |
| `lms.enabled` | bool | `false` | 강의 기능을 켠다. 꺼져 있으면 아래 값은 저장만 하고 쓰지 않는다 |
| `lms.resume` | `ask` \| `auto` \| `off` | `ask` | 이어보기. 물어보기 / 바로 이어서 / 처음부터 |
| `lms.seekLimit` | `free` \| `watched` | `free` | 앞으로 건너뛰기. 자유 / 본 곳까지만 |
| `lms.maxRate` | step `1`, `1.2`, `1.5`, `1.7`, `2` | `2` | 최대 배속(Video.js 목록 `DEFAULT_RATES` 안의 값) |
| `lms.completion` | 정수 50–100 | `90` | 완료 기준 진도율(%). 사업주훈련 80% 같은 규정은 이 값으로 맞춘다 |
| `lms.tabs.chapters` | bool | `true` | 패널 "목차" 탭 |
| `lms.tabs.materials` | bool | `true` | 패널 "자료" 탭 |
| `lms.tabs.transcript` | bool | `true` | 패널 "스크립트" 탭 |
| `lms.tabs.notes` | bool | `true` | 패널 "메모" 탭 |
| `lms.bookmarks` | bool | `true` | 컨트롤 막대의 북마크 버튼과 `b` 키 |
| `lms.ads` | `off` \| `preroll` | `off` | 광고. 끔 / 프리롤만 |

- `playerType: "native"`에 `lms.*` 값이 하나라도 있으면 422 `player_type`이다(theme와 같은 규칙).
- 탭 넷이 모두 꺼지면 패널을 그리지 않는다. 진도 줄은 플레이어 아래에 혼자 남는다(2.6).
- render: `lms.enabled`가 `true`일 때만 `render.lms = {resume, seekLimit, maxRate, completion, tabs:{chapters, materials, transcript, notes}, bookmarks, ads}`를 싣는다. 값은 기본값을 채운 결과다. 꺼져 있으면 키가 없다. `readPresetRender`가 손실 없이 되돌려야 한다(fixture render 케이스에 넣는다).
- `structure()` 비교에 `lms`가 들어간다. 그래서 값이 바뀌면 다시 마운트한다. 이 동작은 그대로 받아들인다.
- 편집 폼은 `lms` 그룹을 직접 편집한다(5.1). 아직 편집기가 없는 버전에서는 `kept`로 보존한다.

### 1.2 내장 프리셋 `lms`

- 내장은 5개이고 순서는 `default`, `flat`, `rounded`, `accent`, `lms`다. 이름은 "강의"다.
- 값: `{ lms: { enabled: true }, controls: { seekButtons: 10, captions: true } }`. 다른 값은 비운다(자유 시청, 최대 2×, 완료 90%, 탭 넷, 광고 끔).
- id 목록 5곳(`preset.js:47`, `preset.ts:324`, `PlayerPresets.php:22`, `loader.js:21`, `install-snippet.ts:247`)과 fixture `builtIn`을 함께 고친다.
- 내장 목록 문장: "내장 프리셋은 기본, 플랫, 둥근 테두리, 강조색, 강의 다섯 가지예요."

## 2. 플레이어 (`public/player/lms.js`, 로더, 스킨)

### 2.1 불러오기와 입력

- 로더는 `render.lms`가 있을 때만 `lms.js`를 동적 import한다(ads.js와 같은 방식).
- 새 입력

| 입력 | 형식 | 뜻 |
| --- | --- | --- |
| `data-lecture` | URL(http(s) 또는 `/`로 시작) | 강의 자료 매니페스트 JSON(2.5) |
| `data-learner-token` | 문자열 ≤ 1024자 | 외부 LMS가 서명한 학습자 토큰(3.2) |
| mount 옵션 `lecture` | 매니페스트 객체 | `data-lecture` 대신 JS로 넘긴다. 둘 다 있으면 옵션이 이긴다 |
| mount 옵션 `learnerToken` | 문자열 | `data-learner-token` 대신 |

- 서버 저장에는 `data-video-id`가 필요하다. 없으면 이 브라우저에만 저장한다(키는 `src`의 해시).
- 미리보기(`preview.*`)와 관리자 미리보기에서는 아무것도 저장하지 않는다. 진도는 메모리에서만 센다. 상태 줄에 "미리보기는 진도를 저장하지 않아요"를 보인다.

### 2.2 진도 계산

- 실제로 재생한 구간만 센다. `timeupdate`마다 앞 시각과의 차이가 0 초과이고 `1.5 × 배속`초 이하이면 `[앞 시각, 지금]`을 구간에 더한다. seek 중, 일시정지 중, 광고 중에는 더하지 않는다.
- 구간은 겹치면 합친다(0.5초 미만 틈도 합친다). 진도율은 `합친 길이 ÷ duration`이다. 표시는 내림 정수 %다.
- `maxWatched`는 재생으로 도달한 가장 먼 시각이다(seek로 간 곳은 넣지 않는다). "본 곳까지만"의 한계다.
- `activeSeconds`는 실제로 재생한 벽시계 초다. 배속과 관계없다(국내 규정의 학습 시간 기준).
- 완료: 진도율이 `lms.completion` 이상이 되는 순간이다. 끝까지 seek하거나 `ended`가 나는 것만으로는 완료가 아니다. 완료는 되돌리지 않는다.
- 광고: `lms.ads`가 `off`이면 `<media-ads>`를 만들지 않는다. `preroll`이면 편성 요청에 `breaks=preroll`을 붙이고 서버가 프리롤만 돌려준다(3.3). 광고가 재생되는 동안(광고 시작부터 끝·건너뛰기·오류까지) 본편의 `pause`·`play`·`seeking`·`timeupdate`는 진도 계산과 보고에서 뺀다.

### 2.3 이어보기

- 저장된 위치가 5초 이상이고 `duration − 10초` 미만일 때만 이어본다. 그 밖에는 처음부터 재생한다.
- `ask`: 첫 재생 전에 플레이어 안 오버레이를 보인다. "지난번 mm:ss까지 봤어요"와 버튼 "이어서 보기"(기본 초점), "처음부터"를 둔다. Esc는 "처음부터"와 같다. 오버레이가 떠 있는 동안 컨트롤은 `inert`다.
- `auto`: 메타데이터를 읽으면 그 위치로 옮기고 알림 "mm:ss부터 이어서 재생해요"를 보인다.
- `off`: 처음부터 재생한다. 위치는 계속 저장한다.

### 2.4 수강 규칙

- **본 곳까지만(`seekLimit: watched`)**
  - 허용 한계는 `maxWatched + 1초`다. 뒤로는 늘 자유롭다. 완료한 뒤에는 제한을 푼다.
  - 막는 자리는 하나로 모은다. extension `mediaOverride`의 `currentTime` setter가 한계로 잘라서 실제로 쓴다(no-op 금지, `seeked`가 오지 않아 멈춘다). 다른 경로(OS 미디어 키, PiP 창)용으로 `seeking` 되돌리기를 안전망으로 둔다. 슬라이더, ±초 버튼, ←/→/j/l, 숫자키, Home/End, 더블탭, 목차·스크립트 클릭이 모두 이 규칙을 따른다.
  - 막히면 알림 "아직 보지 않은 구간이에요. mm:ss까지만 이동할 수 있어요."를 보이고 `solad-lms-seek-blocked` 이벤트를 낸다. 같은 알림은 2초 안에 다시 띄우지 않는다.
  - 슬라이더에 한계 지점 표시(얇은 세로 막대)를 그린다. 목차에서 한계 뒤의 장은 잠금 표시와 `aria-disabled`를 단다.
  - seek indicator는 입력 기준으로 방향을 표시해서 막힌 seek에도 뜬다. 처리는 스파이크 결과를 보고 정한다(템플릿 사본에서 빼거나 그대로 둔다).
- **최대 배속(`maxRate`)**
  - 설정 메뉴의 배속 항목 중 상한보다 큰 값은 숨긴다.
  - `>`·`<` 단축키는 템플릿 사본에서 빼고 직접 처리한다. 목록 안에서 한 칸씩 움직이고, 상한과 첫 값에서 멈춘다(돌아가지 않음).
  - 다른 경로로 상한을 넘으면 `ratechange`에서 상한으로 되돌린다.
  - `maxRate`가 `2`이고 제한이 없어도 `>`의 2×→0.2× 순환은 막는다(강의 중 갑자기 느려지는 문제).

### 2.5 강의 자료 매니페스트

```json
{
  "version": 1,
  "chapters": [{ "start": 0, "title": "들어가며" }],
  "slides": [{ "start": 0, "image": "/examples/lecture/slide-01.svg", "alt": "…", "title": "…" }],
  "files": [{ "title": "강의 자료(PDF)", "url": "/demo-media/lecture/slides.pdf", "size": "1.2MB" }],
  "transcript": { "src": "/examples/lecture/transcript.ko.vtt", "lang": "ko" }
}
```

- 제한: chapters ≤ 100(start 오름차순, title 1–80자), slides ≤ 300(alt 필수 1–160자, title ≤ 80자), files ≤ 50(title 1–80자, size ≤ 16자). URL은 http(s) 또는 `/`로 시작한다(logo.href 규칙, 2048자).
- 틀린 항목은 버리고 나머지를 쓴다. 버린 것이 있으면 패널 아래에 "강의 자료 중 n개를 읽지 못했어요"를 보인다. 매니페스트 자체를 못 읽으면 자료가 없는 것으로 동작하고 같은 안내를 보인다.
- `transcript`가 없으면 `data-captions` VTT를 스크립트로 쓴다. 둘 다 없으면 스크립트 탭을 숨긴다.
- 챕터는 로더가 VTT로 바꿔 `<track kind="chapters" default>`로 붙인다. 그러면 타임라인이 장마다 나뉘고 미리보기에 장 제목이 뜬다. blob URL과 data URL 중 어느 쪽이 커스텀 media와 기본 `<video>`에서 동작하는지는 스파이크로 정한다.
- 스크립트와 슬라이드는 `lms.js`가 VTT와 매니페스트를 직접 읽고 `timeupdate`로 현재 항목을 고른다. 네이티브 `cuechange`에 기대지 않는다.

### 2.6 화면

- **플레이어 안**(스킨 템플릿 사본, `solad-video-skin.js` 방식)
  - 시간 슬라이더: 시청한 구간 층(여러 구간)과 한계 지점 표시. `pointer-events: none`.
  - 이어보기 오버레이(2.3), 알림(이어서 재생, seek 막힘, 북마크 추가, 완료). 알림은 `aria-live="polite"` 한 곳에서 낸다.
  - 북마크 버튼(`lms.bookmarks`): 컨트롤 막대 오른쪽 묶음 앞. 누르거나 `b`를 누르면 지금 시각에 북마크를 더한다. 알림 "북마크를 추가했어요 · mm:ss".
  - 제목은 두 줄까지 보이고 말줄임한다. 모든 프리셋에 적용한다(A2-E-QA-DELTA 관찰, 왼쪽 위 로고와 긴 제목).
- **플레이어 밖 패널 `<solad-lms-panel>`**(플레이어 컨테이너가 `overflow: clip`이라 밖에 둔다)
  - 로더 root 안에서 플레이어 옆에 둔다. root 폭이 960px 이상이면 옆(플레이어 2 : 패널 1, 패널 높이는 플레이어와 같음), 그보다 좁으면 아래(최대 높이 24rem, 안에서 스크롤)다. 컨테이너 쿼리로 정한다.
  - 머리: 진도 줄 "진도 42% · 완료 기준 90%"와 막대, 상태 "학습 중" 또는 "완료"(완료 시각). 저장 위치 안내는 머리 아래 한 줄이다(2.7).
  - 탭: 목차 | 자료 | 스크립트 | 메모. 접근성 탭 패턴(roving tabindex, ←/→/Home/End). 데이터가 없는 탭은 숨긴다. 마지막으로 연 탭을 이 브라우저에 기억한다.
  - 목차: 시각과 제목, 지금 장 강조(`aria-current="true"`), 장별 시청 비율(작은 막대, 완료 기준 이상이면 체크). 누르면 그 장 시작으로 이동한다(2.4 규칙).
  - 자료: 지금 슬라이드 크게, 이전·다음 넘기기, "n / 전체". 넘기면 따라가기가 멈춘다. "영상 따라가기"로 다시 켠다. "이 장면으로 이동"은 2.4 규칙을 따른다. 아래에 파일 목록(새 탭으로 열림)을 둔다.
  - 스크립트: 문장 목록, 지금 문장 강조, "자동 스크롤" 켜기·끄기(사용자가 스크롤하면 꺼짐), 검색(맞은 개수, 이전·다음 결과), 문장을 누르면 그 시각으로 이동한다.
  - 메모: 입력칸 "mm:ss에 메모"와 "저장", 시간순 목록(시각 버튼으로 이동, 글, 고치기, 지우기). 북마크도 같은 목록에 아이콘과 함께 나온다. 메모 ≤ 1000자, 한 영상에 메모와 북마크를 합쳐 200개까지다.
  - 내장 전체화면에서는 영상만 보인다(v1, 사실표 §3). 도움말에 적는다.
- 겹침 순서는 `solad-video-skin.js:81-83`을 따른다. 오버레이는 controls(30)와 dialog(40) 사이, 알림은 controls 위다. 광고(100)가 가장 위다.
- 색과 글꼴은 프리셋의 `--media-accent-color`, `--media-font-family`를 따른다. 패널 CSS는 `public/player/` 안에 둔다(관리자 디자인 시스템 CSS를 불러오지 않는다).

### 2.7 저장과 보고

- 저장 위치는 셋이다. 패널 머리 아래 한 줄로 알린다.

| 경우 | 저장 | 안내 |
| --- | --- | --- |
| 서버 학습자 있음(3.2) | 서버 | "학습 기록이 저장돼요" |
| 학습자 없음, 또는 LMS 표 없음(503) | 이 브라우저(localStorage, try/catch) | "로그인하지 않아 이 브라우저에만 저장돼요" |
| 미리보기 | 없음 | "미리보기는 진도를 저장하지 않아요" |

- 보고 시점: 재생 중 15초마다, 그리고 바로 보고(일시정지, 끝남, seek 끝, 배속 바꿈, 탭 숨김). `pagehide`에서는 `fetch(keepalive, application/json)` 한 번이다(sendBeacon 문자열은 서버가 거부한다).
- `seq`는 세션 안에서 1씩 오른다. 실패하면 마지막 상태 하나만 남겨 다음 보고와 합친다. 서버 응답의 진도율·완료가 화면 값을 이긴다.
- 서버 저장일 때도 같은 상태를 이 브라우저에 사본으로 둔다. 서버가 503이나 네트워크 오류를 내면 사본으로 계속한다.

### 2.8 JS 이벤트

로더 placeholder 요소에서 `bubbles: true`로 낸다. `detail`은 아래와 같다. 이름과 모양은 도움말에 그대로 싣는다.

| 이벤트 | detail |
| --- | --- |
| `solad-lms-ready` | `{videoId, storage: 'server'\|'local'\|'none', learner: 'member'\|'external'\|null, progress}` |
| `solad-lms-progress` | `{videoId, sessionId, seq, reason, position, duration, rate, segments: [[s,e]], playedSegments, progress, percent, threshold, maxWatched, activeSeconds, completed}` |
| `solad-lms-complete` | progress와 같은 모양 + `completedAt` |
| `solad-lms-chapter` | `{index, title, start}`(장이 바뀔 때) |
| `solad-lms-seek-blocked` | `{requested, allowed}` |
| `solad-lms-note` | `{op: 'save'\|'delete', note: {id, kind, time, text}}` |

- `reason`: `interval` \| `pause` \| `ended` \| `seeked` \| `ratechange` \| `hidden` \| `pagehide`.
- `playedSegments`는 xAPI Video Profile 형식(`"0.000[.]12.000[,]14.000[.]21.000"`)이다. `progress`는 0–1, `threshold`는 0–1이다. 외부 LMS가 xAPI·SCORM으로 옮겨 쓸 수 있다.
- 외부 LMS가 자체 저장할 때 쓰는 이벤트이고, 서버 저장 여부와 관계없이 늘 낸다(미리보기 제외).

## 3. 서버 (`src/`, `hosts/`, `database/`)

### 3.1 표와 마이그레이션

- 파일 `database/lms/001.sql`. `CREATE TABLE IF NOT EXISTS`, 두 엔진(SQLite, MySQL) 공통이고 엔진별 JSON 쿼리를 쓰지 않는다. 설치기 CLI(`bin/install.php`)로만 실행한다.
- 완료되면 meta `lms_schema_version = '1'`을 쓴다. 핵심 `schema_version`과 `App.php:16` 검사는 그대로다.
- 운영 권한 가정(SELECT/INSERT/UPDATE, `README.md:65`)을 지킨다. 지우기는 `deleted_at`으로 한다.

| 표 | 칼럼 | 키 |
| --- | --- | --- |
| `lms_progress` | site_id, learner, video_id, segments(TEXT JSON), position, duration, max_watched, watched_seconds, percent, active_seconds, completed_at, reported_at, created_at, updated_at | PK(site_id, learner, video_id) |
| `lms_notes` | site_id, id(`n-` + 10자), learner, video_id, kind(`note`\|`bookmark`), time_seconds, text, created_at, updated_at, deleted_at | PK(site_id, id), 인덱스(site_id, learner, video_id) |

- `learner`는 `g:<mb_id>`(그누보드 회원) 또는 `x:<sub>`(외부 토큰)다. IP는 저장하지 않는다.

### 3.2 학습자 정하기

- Host에 `learnerId(): ?string`을 더한다.
  - 그누보드: 공개 액션에서도 `$member`가 있다. 로그인 회원이면 `mb_id`, 아니면 `null`이다.
  - 독립 설치: 늘 `null`이다.
- 외부 학습자 토큰: 형식은 `base64url(payload) "." base64url(HMAC-SHA256(LMS 연동 키, payload 부분))`이다. payload는 `{"v":1,"sub":"<학습자 ID>","exp":<unix 초>,"dur"?:<초>}`다.
  - `sub`는 1–64자 `[A-Za-z0-9._:@-]`다. `exp`는 지금보다 미래이고 지금 + 86400 이하여야 한다.
  - `dur`(선택)는 LMS가 아는 영상 길이다. 있으면 서버가 이 값을 영상 길이로 쓴다.
- 우선순위: 그누보드 회원 → 유효한 학습자 토큰 → 없음(이 브라우저 저장)이다. 틀리거나 만료된 토큰은 오류로 멈추지 않는다. 학습자 없음으로 처리하고 응답에 `learnerError: 'invalid'|'expired'`를 싣는다.
- LMS 연동 키: meta `lms_key`(32바이트 랜덤, hex)다. 관리자가 만들고 바꾼다. 바꾸면 기존 토큰은 모두 무효다.
- 서명 함수는 용도를 나눈다. 광고 이벤트 토큰(`signing_key`)과 LMS 세션 토큰은 다른 키 유도(예: `hash_hmac('sha256', 'lms-session', signing_key)`)를 쓴다. 학습자 토큰은 `lms_key`로만 검증한다.

### 3.3 공개 액션 (POST JSON, 같은 출처, 인증 없음)

- `lms-session` `{videoId, presetId?, learnerToken?}`
  - 응답: `{storage: 'server'|'local', learner: 'member'|'external'|null, learnerError?, lmsToken?, expiresAt?, rules: {completion, seekLimit, maxRate}, progress: {segments, position, duration, maxWatched, percent, completedAt}|null, notes: [...]}`
  - 규칙은 서버가 `presetId`(없으면 사이트 기본 프리셋)에서 읽는다. LMS가 꺼진 프리셋이면 내장 `lms` 값을 쓴다.
  - `lmsToken`의 claims는 `{siteId, learner, videoId, completion, maxRate, seekLimit, exp}`이고 3.2의 분리된 키로 서명한다. 유효 시간은 세션 설정(`Config` 7200초)을 따른다. 만료 전에 다시 `lms-session`을 불러 갱신한다.
  - 학습자가 없으면 `storage: 'local'`이고 토큰이 없다. LMS 표가 없으면 503 `lms_unavailable`이다.
- `lms-progress` `{lmsToken, seq, reason, segments, position, duration, rate, activeSecondsDelta}` → `{percent, completedAt, maxWatched, segments}`
  - 서버가 구간을 합치고 `[0, duration]`으로 자른다. 구간은 ≤ 500개이고, 넘으면 400이다.
  - 영상 길이는 토큰의 `dur`, 없으면 처음 보고된 값으로 고정한다. 그 뒤 2초보다 크게 다른 `duration`은 그 보고를 400 `duration_mismatch`로 거부한다.
  - 그럴듯함 검사: 이번 보고로 새로 늘어난 시청 길이는 `(지금 − reported_at + 5초) × maxRate` 이하만 받는다. 넘는 부분은 버린다. 첫 보고는 `30초 × maxRate`까지다.
  - `seekLimit: watched`이면 `maxWatched`보다 뒤에서 시작하는 구간을 버린다(+1초 허용). 완료 뒤에는 검사하지 않는다.
  - 진도율과 완료는 서버가 계산한다. `completed_at`은 한 번 정해지면 바뀌지 않는다. `active_seconds`는 보고마다 `min(activeSecondsDelta, 지금 − reported_at + 5)`를 더한다.
  - 같은 `seq` 이하는 중복으로 보고 지금 상태를 돌려준다(멱등).
- `lms-notes` `{lmsToken, op: 'list'|'save'|'delete', note?: {id?, kind, time, text}}` → `{notes}`
  - 메모 ≤ 1000자, 북마크 글은 ≤ 80자(비워도 된다). 학습자·영상마다 200개까지이고, 넘으면 400 `note_limit`이다. 제어 문자 규칙은 프리셋 이름과 같다.
- 레이트 리밋: LMS 세션당 60회/분이다. 설치 전체는 광고와 다른 버킷이고 기본 6000회/분이다(설정 `lmsRateLimitPerMinute`). 넘으면 429다. 플레이어는 다음 주기로 미룬다.
- 쓰기 잠금: 진도와 메모는 설치 전체 `write_lock`을 쓰지 않고 한 행 트랜잭션으로 처리한다. 쓸 수 없으면 이유를 계약 문서에 적는다. 부하 측정은 SQLite에서 동시 50 학습자 × 15초 주기와 버스트 200회/초다.
- 편성 `schedule`에 `breaks=preroll`을 받는다. 있으면 프리롤만 돌려주고, 세션 스냅샷도 그 결과로 만든다. 없으면 지금 그대로다.

### 3.4 관리자 액션 (인증, 쓰기는 CSRF)

| 액션 | 내용 |
| --- | --- |
| `GET lms-settings` | `{installed: boolean, keySet: boolean, keyHint: '…abcd'|null, rotatedAt}` |
| `POST lms-key-rotate {}` | 새 키를 만들고 `{key, keyHint, rotatedAt}`를 한 번만 돌려준다. 이후에는 끝 4자리만 보인다 |
| `POST lms-test-token {learnerId, minutes(1–1440), dur?}` | 데모·확인용 학습자 토큰 `{token, expiresAt}`. 키가 없으면 400 `lms_key_missing` |
| `GET lms-progress-list {videoId?, learner?, status?: 'all'|'done'|'doing', page}` | `{rows: [{learner, videoId, percent, completedAt, activeSeconds, position, duration, updatedAt}], total, page, pageSize: 50}` |
| `GET lms-progress-csv` | 같은 거름으로 CSV(UTF-8 BOM, 셀 앞 `=`,`+`,`-`,`@`는 `'`로 막음) |

- 그누보드는 관리자 권한이 있을 때만 쓸 수 있다(기존 `authenticated`). 학습자 ID 표시는 그누보드 회원 아이디 그대로다.
- `bootstrap.capabilities.lms: {installed: boolean}`을 더한다.
- 새 액션과 학습자 ID 저장은 `ads-admin-app-contract.md`에 "4.x 강의(LMS)" 절로 먼저 기록한다. `ads-contract-v1.md:105`의 "방문자 계정 저장 없음(v1)" 옆에 "LMS 프리셋에서 식별된 학습자 ID는 진도·메모 표에만 저장한다. IP는 저장하지 않는다"는 주석을 단다.

## 4. 데모와 도움말 (`public/examples/`)

- 새 페이지 `examples/lecture.html` "샘플 강의"
  - 내장 `lms` 프리셋, 패널, 상태 줄을 보여 준다.
  - 옵션: 이어보기, 앞으로 건너뛰기, 최대 배속, 완료 기준, 탭 넷, 북마크, 광고(끔·프리롤).
  - 학습자 토큰 칸: 관리자 "LMS 연동"의 시험 토큰을 붙여 넣는다. 비우면 이 브라우저 저장이다.
  - 서버 저장 중에는 서버가 프리셋 규칙으로 진도와 완료를 정한다. 그래서 완료 기준, 앞으로 건너뛰기, 최대 배속 옵션을 프리셋 값으로 막고 "서버에 저장할 때는 프리셋 규칙을 써요"를 보인다.
  - 이벤트 기록(최근 20개), "이 브라우저 기록 지우기", 설치 코드 복사를 둔다.
  - 기존 데모(`index.html`)의 내장 목록에도 "강의"가 나온다. 거기서는 매니페스트 없이 진도 줄만 보이고 "샘플 강의에서 자료 싱크를 볼 수 있어요" 링크를 둔다.
- 샘플 강의 자료(추적되는 텍스트 파일): `public/examples/lecture/`에 둔다.
  - `manifest.json`, `transcript.ko.vtt`
  - 슬라이드 SVG 8장 1280×720(`slide-01.svg` …)
- 샘플 영상과 PDF(추적 안 함): `public/demo-media/lecture/lecture.mp4`, `slides.pdf`(슬라이드 8장을 묶은 것). 슬라이드 8장 × 10초, 1280×720 H.264, 무음, 약 80초. 슬라이드마다 장 번호를 크게 넣어 싱크를 눈으로 확인할 수 있게 한다.
  - 다시 만드는 스크립트 `bin/sample-lecture.sh`를 둔다. `rsvg-convert`로 SVG를 PNG·PDF로 바꾸고 `ffmpeg`(libx264)로 영상을 만든다. 이 ffmpeg에는 SVG 디코더와 drawtext가 없다.
  - 영상이 없으면 데모는 "샘플 강의 영상이 없어요. bin/sample-lecture.sh로 만들어 주세요."를 보인다.
- 도움말(`help.html`)에 아래를 고정 앵커로 싣는다.
  - `lms.*` 필드, `data-lecture`, `data-learner-token`, 매니페스트 형식, 이벤트 6개
  - 학습자 토큰 만드는 법(PHP 예시)
  - 한계: 같은 출처, 전체화면에서 패널 숨김, 원격훈련 수준 기능 없음
- 설치 코드(`install-code.js`와 `install-snippet.ts`, 두 파일이 같아야 함): LMS 프리셋이면 `data-lecture`, `data-learner-token` 줄과 안내 주석을 더한다.

## 5. 관리자 앱 (`ui/`)

### 5.1 프리셋 편집기 "강의(LMS)" 섹션

- 섹션 순서는 basic, theme, controls, playback, **lms**, language, ads다.
- 필드: "강의 기능 사용" 체크(끄면 아래가 막힘), 이어보기, 앞으로 건너뛰기(라디오: 자유롭게 / 본 곳까지만), 최대 배속, 완료 기준(%), 패널 탭 4개, 북마크 버튼, 광고(끔 / 프리롤만).
- native이면 섹션을 막고 이유를 보인다: "강의 기능은 Video.js 플레이어에서만 써요."
- 미리보기: 편집기·대화상자 미리보기에 진도 줄과 한계 표시가 보인다. 저장은 하지 않는다. 패널은 미리보기에서 그리지 않고, 안내 "자료 패널은 샘플 강의에서 볼 수 있어요"와 링크를 둔다.

### 5.2 새 화면

- 메뉴 "강의" 아래에 "학습 진도"(`#/lms/progress`)와 "LMS 연동"(`#/lms/settings`)을 둔다. 메뉴 자리와 모양은 디자인 handoff가 정한다.
- LMS 연동
  - 설치 상태: 표가 없으면 "LMS 표가 아직 없어요. 서버에서 `php bin/install.php`를 다시 실행해 주세요."
  - 연동 키: 만들기·바꾸기(확인 대화상자), 새 키는 한 번만 보임 + 복사
  - 토큰 형식 설명과 PHP 서명 예시(CodeBlock)
  - 시험 토큰 만들기(학습자 ID, 유효 시간)
- 학습 진도: 거름(영상 ID, 학습자, 상태), 표(학습자, 영상, 진도율, 완료, 학습 시간, 마지막 위치, 갱신), 쪽 넘김, "CSV 내려받기". 빈 상태와 LMS 미설치 상태를 따로 둔다.
- 도움말 용어: 진도율, 완료 기준, 본 곳까지만, 학습자 토큰, LMS 연동 키, 강의 자료 매니페스트.

## 6. 단계와 담당

| 단계 | 담당 | 할 일 | 결과 |
| --- | --- | --- | --- |
| L-1 | ads-admin-designer | 플레이어 안 UI, 패널(390·768·1280, 상태별), 편집기 섹션, 두 화면, 문구표. 샘플 슬라이드 8장, 스크립트 VTT, 매니페스트 | `.agents/plans/ads-lms-design-handoff.md`, `public/examples/lecture/` 텍스트 자료 |
| L-1 | ads-admin-api | 3절 전부. 1절의 세 검증기(PHP, preset.js, preset.ts)와 내장 `lms`, fixture, 계약 문서, 부하 측정, 백엔드 테스트. 서빙 중인 옛 관리자 번들이 깨지지 않게 PHP 내장 목록 추가는 마지막에 하고, 오케스트레이터가 바로 다시 빌드한다 | 코드, `ads-admin-app-contract.md` 절 |
| L-1 | ads-implementer | 스파이크(아래 7절 1–8) | `.agents/plans/ads-lms-spike.md` |
| L-2 | ads-implementer | 2절 전부와 4절(lms.js, loader, 스킨, lecture.html, help, install-code, 샘플 영상 스크립트, ja·zh-CN 문구, tests/admin) | 코드 |
| L-2 | ads-admin-ui | 5절 전부(편집기, 설치 코드, 두 화면, 도움말 용어, ui 테스트) | 코드 |
| L-2 | ads-admin-designer | 새 관리자 컴포넌트가 필요하면 `design/components/` | 컴포넌트 |
| L-3 | ads-qa | 인수 시험(8절) | `workspaces/ads-lms-20261022/qa/` |

- `public/assets/` 쓰기와 관리자 빌드는 오케스트레이터만 한다.

## 7. 스파이크로 정할 것 (ads-implementer, L-1)

1. CDN 빌드에서 손으로 쓴 JS가 `Symbol.for('@videojs/extension')` context 요청으로 extension을 등록하고 `mediaOverride.currentTime`을 덮을 수 있는지.
2. 잘라서 쓰는 setter로 seek가 정상으로 끝나는지(`seeked`, 스토어 `seeking:false`). 슬라이더 드래그 중 썸 위치.
3. 광고 extension과 함께 등록할 때 override 순서. 잘린 seek가 미드롤 예약에 주는 영향(프리롤만 허용이라 영향이 적은지).
4. 설정 메뉴 배속 항목을 상한으로 숨기는 방법(템플릿 사본 CSS 또는 속성). `>`·`<` 바인딩 제거와 직접 처리.
5. 챕터 VTT를 blob·data URL `<track kind=chapters default>`로 붙일 때 Video.js 기본 media와 hls media에서 타임라인 분할이 되는지.
6. 시간 슬라이더 템플릿 사본에 여러 구간 층과 한계 표시를 넣을 자리. 포인터·키 동작에 영향이 없는지.
7. seek indicator를 그대로 둘지 뺄지(막힌 seek 때 무엇이 보이는지).
8. `pagehide`의 `fetch keepalive`(JSON)가 Chrome·Safari·Firefox(Playwright)에서 서버에 닿는지.

- 스파이크는 자기 격리 폴더와 빈 포트에서 한다. `public/`, `packages/`에는 쓰지 않는다. 결과마다 "됨 / 조건부 / 안 됨"과 재현 코드 경로를 적는다. 안 되는 항목은 대안을 "제안"으로 적는다.

## 8. 인수 기준 (L-3)

- 프리셋: 세 검증기와 fixture가 같다. 내장 다섯 개 순서와 이름. native에 lms 값이 있으면 422.
- 진도: 처음부터 끝까지 1×로 보면 100%이고 2×로 보면 activeSeconds가 절반쯤이다. 앞뒤로 seek해도 겹친 구간을 두 번 세지 않는다. 광고(프리롤) 시간은 진도에 들어가지 않는다. 완료 기준을 넘는 순간 완료 이벤트가 한 번 난다.
- 서버: 학습자 둘이 섞이지 않는다. 틀린 서명, 만료, 다른 videoId 토큰은 거부된다. 그럴듯함 검사가 부풀린 구간을 버린다. 미설치(503)일 때 플레이어가 이 브라우저 저장으로 넘어가고, 다른 기능은 그대로다.
- 규칙: "본 곳까지만"에서 슬라이더, 키(→, l, 숫자, End), ±초 버튼, 더블탭, 목차·스크립트 클릭이 모두 한계에서 멈춘다. 완료 뒤에는 풀린다. 최대 배속 1.5에서 메뉴에 1.7·2가 없고 `>`가 1.5에서 멈춘다.
- 싱크: 장, 슬라이드, 스크립트 문장이 영상 시각(±0.5초)과 맞는다. 클릭 이동, 검색, 자동 스크롤, 따라가기를 확인한다.
- 메모·북마크: 서버 저장, 새로고침 뒤 유지, 다른 학습자에게 안 보임, 200개 제한.
- 화면: 390·768·1280에서 패널 배치, 가로 스크롤 없음, 키보드만으로 모든 기능, 스크린 리더 이름과 알림.
- 회귀: 기존 프리셋 넷, 데모, 관리자, play-test, 광고 통계가 그대로다. 18765·18766 응답이 바뀌지 않는다(공개 액션 셋과 기존 화면).

## 9. 이번 범위가 아닌 것

- 탭 이탈 일시정지, 같은 학습자 중복 재생 막기, 학습 중 확인 팝업, 하루 학습 시간 상한
- 영상 속 퀴즈, 다음 차시 자동 이동
- xAPI·cmi5·SCORM 어댑터(이벤트 모양만 맞춘다)
- 다른 도메인 LMS용 CORS
- 관리자 앱의 강의 자료 편집기와 영상 목록(영상 엔티티가 없다, 결정 28)
- 전체화면에서 패널 보이기

## 10. L-1 디자인 결정 (2026-10-22, 오케스트레이터)

`ads-lms-design-handoff.md` 6절 제안 11개는 모두 받는다. 이 문서의 해당 줄보다 handoff가 앞선다. 7절 질문은 아래로 정한다.

1. 북마크 버튼은 `lms.bookmarks`와 `lms.tabs.notes`가 모두 켜졌을 때만 보인다(`b` 키도 같다). 목록 없는 북마크는 만들지 않는다. 편집기는 메모 탭을 끄면 북마크 칸을 막고 "메모 탭을 켜야 북마크를 쓸 수 있어요"를 보인다.
2. 시청 층 자리는 스파이크 7-6 결과로 정한다.
3. seek indicator는 스파이크 7-7 결과로 정한다. 막힘 알림과 겹치면 뺀다.
4. 패널 입력칸에서 플레이어 단축키가 먹지 않아야 한다. L-2 구현과 시험에 넣는다.
5. 패널 밝기 기본값은 OS가 아니라 **밝게**다. 고객 페이지는 대부분 밝은데, OS가 어두운 모드일 때 밝은 페이지에 어두운 패널이 끼면 어색하기 때문이다. 고객 페이지는 `solad-lms-panel { color-scheme: dark }` 또는 `light dark`로 바꾼다. 도움말에 적는다.
