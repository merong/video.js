# A1 플레이어 관리 근거표 (초기 설정·옵션·스킨·프리셋 스키마)

작성: ads-source-analyst(`w1:p2`), TASK A1-PLAYER-FACTS, 2026-10-20. 읽기 전용 조사다. 플레이어 관리 화면(`#/players/**`)의 초기 설정 안내, 설치 코드 생성기, 옵션 설명 표, 도움말 용어가 실제 소스와 어긋나지 않게 하는 기준이다. 임시 문서이며 병합 전에 지운다(AGENTS.md `.agents/plans/` 규칙).

## 0. 읽는 법

- 경로 약어: `A` = `integrations/ads-manager`, `E` = `A/public/examples`, `X` = `packages/extensions/ads/src`, `SK` = `packages/skins/src/styles`, `HT` = `packages/html/src`, `CDN` = `packages/cdn`, `DOC` = `site/src/content/docs/guides`, `AC` = `.agents/plans/ads-admin-app-contract.md`, `C1` = `.agents/plans/ads-contract-v1.md`, `GB` = `.agents/plans/ads-admin-gnuboard-spec.md`, `HF` = `.agents/plans/ads-admin-help-facts.md`.
- 줄 번호는 2026-10-20 20:40 무렵 작업 트리 기준이다. `A/src/App.php`, `A/src/Http.php`, `A/src/PlayerPresets.php`(미추적), `A/ui/src/player/**`(미추적)는 다른 담당이 고치는 중이라 줄이 밀릴 수 있다. 식별자로 다시 찾는다.
- **공개/내부:** `@videojs/ads`는 `"private": true`이고 모든 export가 `@internal`이다(`packages/extensions/ads/README.md:3`). `--ads-*`, part, `data-ad-state`도 통합 기간 동안 내부라고 README가 적는다(`README.md:85`). 사이트(`site/`)에 광고 문서는 없다. 문서로 공개된 안정 표면은 스킨 CSS 속성 8개(`--media-*`, `DOC/customize-skins.mdx:53-62`, 레지스트리 `SK/vars.ts:15-47` `kind: 'public'`)뿐이다. 표에서는 **공개**(사이트 문서가 있는 안정 표면), **내부**(`@internal` 또는 README가 내부라고 적은 것), **예제**(이 저장소 예제 페이지 전용)로 나눈다.
- 확인 방법: 줄 번호는 모두 파일을 읽어 확인했다. 설치·그누보드 절은 읽기 전용 하위 조사로 모은 뒤 핵심 줄(`E/example.js:55-95`, `A/hosts/GnuBoard.php:97`, `A/src/Http.php:69`, `A/README.md:75`, `E/README.md:1-22`)을 다시 대조했다. 빌드, 서버, 브라우저 실행으로 확인한 것은 없다. "추론"이라고 적은 것은 소스를 읽고 내린 결론이며 실행하지 않았다.

## 1. 호스트별 초기 설정 근거

### 1.1 필요한 파일

| 파일 | 역할 | 근거 | 저장소 상태 |
| --- | --- | --- | --- |
| `public/assets/ads.js` | `@videojs/ads` ESM CDN 번들. `createAdsController`, `MediaAdsElement`를 내보내고 가져오기만 해도 `<media-ads>`를 등록한다 | `X/cdn.ts:1-2`, `X/html/define.ts:6-7`, 태그 이름 `X/html/element.ts:38`, 번들 설정 `packages/extensions/ads/vite.config.ts:32-44`(`entry {ads}`, `outDir dist/cdn`, `hash:false`) | 생성 파일, 무시됨(`A/.gitignore`) |
| `public/assets/videojs/video.css` + `video.js` | 기본 스킨. `video.js` = i18n + 플레이어 + `<video-skin>` | `CDN/src/video.ts:1-3`, `DOC/cdn.mdx:28-33` | 생성 파일, 무시됨(`A/.gitignore:4`) |
| `public/assets/videojs/video-neutral.css` + `video-neutral.js` | neutral 스킨 `<video-neutral-skin>` | `CDN/src/video-neutral.ts`, `HT/presets/video/neutral-skin.ts:9-12` | 같음 |
| `public/assets/videojs/` 루트의 해시 청크, `ui/`, `media/`, `locales/`, `extensions/` | 스킨 번들이 가져오는 공유 청크와 모듈 | `E/README.md:16-20`("의존하는 청크와 UI·미디어 모듈을 함께 복사") | 같음 |
| `public/assets/videojs/media/hls-video.js` | `<hls-video>`(SPF 기반 HLS) | `HT/define/media/hls-video.ts:4`, `E/example.js:59,65` | 같음 |
| `public/assets/videojs/media/hlsjs-video.js` | `<hlsjs-video>`(hls.js 기반 HLS) | `E/example.js:59,65` | 같음 |
| `public/assets/admin/preview.js`, `model.js` | 예제 전용 재생 관찰 도구 | `E/example.js:1`, `E/README.md:46` | 추적됨 |

- 기본 video(`player.html`)는 Video.js CSS·JS가 필요 없고 `ads.js`만 쓴다(`E/player.html:8-11`, `E/example.js:63-67`).
- `media/native-hls-video.js`도 복사되지만 예제는 쓰지 않는다.
- compat·scaffold 스킨 파일(`video-compat.*`, `video-scaffold.*`)도 rsync로 함께 복사된다. 프리셋은 쓰지 않는다(3절).

### 1.2 빌드·복사 명령 (저장소 루트에서)

근거: `E/README.md:5-21`. 메인 `A/README.md:10`은 "루트가 생성 파일을 제공한다"고만 쓰고 명령은 없다(불일치 D-P6).

```sh
pnpm exec vp run @videojs/ads#build
mkdir -p integrations/ads-manager/public/assets
cp packages/extensions/ads/dist/cdn/ads.js integrations/ads-manager/public/assets/ads.js

pnpm exec vp run @videojs/cdn#build:cdn
mkdir -p integrations/ads-manager/public/assets/videojs
rsync -a --exclude=src --exclude=scripts --exclude=node_modules --include='*/' --include='*.js' --include='*.css' --exclude='*' packages/cdn/ integrations/ads-manager/public/assets/videojs/
```

- `@videojs/ads#build`는 `package.json` script가 아니라 `packages/extensions/ads/vite.config.ts:20-23`의 Vite+ task(`vp pack`)다.
- `@videojs/cdn#build:cdn`은 `CDN/vite.config.ts:223-224`(로케일 생성 후 `vp pack --filter cdn`)다.
- 설치 프로그램 옵션 `--player-module-url=/assets/ads.js`가 있다(`A/README.md:22`). 경로 접두어로 올릴 때는 `apiUrl`, `uploadUrl`, `playerModuleUrl`을 같이 바꾼다(`A/README.md:43`).
- 관리자 화면에서 쓸 문구 제안: "저장소 루트에서 두 번 빌드하고 결과를 `public/assets/`에 복사해요." 운영 서버에서 pnpm을 돌리라는 뜻으로 읽히지 않게 "빌드는 개발 PC에서, 결과 파일만 서버에 올림"을 함께 쓴다(추론: 운영 서버에 Node가 있다는 근거가 없다).

### 1.3 스크립트 로드 순서와 요소 구조

**Video.js (`E/videojs.html` + `E/example.js`)**

1. `<link rel="stylesheet" href="../assets/videojs/video.css">`(`E/videojs.html:7`). 스킨 CSS는 문서에 링크한다.
2. `<script type="module" src="./example.js">`(`E/videojs.html:9`). 이 안에서 동적 import를 차례로 한다.
3. `await import('../assets/videojs/video.js')`(`E/example.js:64`).
4. HLS면 `await import('../assets/videojs/media/${tag}.js')`, `tag`는 `engine=hlsjs`면 `hlsjs-video`, 아니면 `hls-video`(`E/example.js:59,65`).
5. `await import('../assets/ads.js')`(`E/example.js:67`).
6. 요소 생성(`E/example.js:71-92`):

```
#mount
└ <video-player>
  └ <video-skin>
    ├ <video | hls-video | hlsjs-video id="content" src="본편 URL" playsinline preload="metadata" aria-label="본편 영상">
    └ <media-ads for="content" src="<절대 URL>/api/index.php?action=schedule&videoId=…" video-id="…">
```

- `src`는 `new URL('../api/index.php', location.href).href`, 즉 절대 URL이다(`E/example.js:76-79`). **`<media-ads src>`는 `/`로 시작하는 경로나 `http(s)://` 절대 URL만 받는다.** `api/index.php?…`나 `../api/…` 같은 상대 경로는 `isAdsUrl`에서 거부되어 `ads-error invalid_schedule_reference`가 난다(`X/core/url.ts:5-20`, `X/html/element.ts:206-208`). 설치 코드 생성기는 루트 기준 경로(`/ads/api/index.php?…`)나 절대 URL을 내보내야 한다.
- 광고 화면(overlay)은 `<media-ads>`가 찾은 컨테이너에 붙는다. 순서는 직접 지정한 컨테이너 → 플레이어 컨텍스트 컨테이너 → `media.parentElement`(`X/html/element.ts:143`). 스킨 템플릿은 그림자 트리 안에 `<media-container class="media-skin …">`를 두므로(`HT/internal/skins/default-video/template.ts:5`) overlay는 스킨 안쪽에 놓인다(추론, 실행 안 함).

**기본 video (`E/player.html` + `E/example.js`)**

1. Video.js CSS 없음. `example.css`, `example.js`만(`E/player.html:8-11`).
2. `await import('../assets/ads.js')`.
3. `<video id="content" controls playsinline preload="metadata">`를 `#mount`에 넣는다.
4. 편성을 직접 받는다: `fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' })`(`E/example.js:100-104`).
5. `module.createAdsController({ media, container: #mount, schedule, tracking, onEvent })`. `tracking`은 응답 `data`에서 `schedule`을 뺀 나머지다(`E/example.js:121-129`).

**설치 코드 생성기에 주는 함의**

- Video.js: `<link>` 스킨 CSS → `<script type="module">`로 스킨 JS, (HLS면) 미디어 모듈, `ads.js` 순서. 정적 HTML로 쓰면 `<video-player><video-skin><video …></video><media-ads …></media-ads></video-skin></video-player>`. 정적 마크업이 모듈 로드 전에 있어도 custom element는 정의 후 업그레이드된다(추론, 실행 안 함). 이 형태는 예제와 다르므로(예제는 동적 생성) **정적 붙여넣기 코드가 재생된다는 증거는 아직 없다**(U-P1).
- 기본 video: 모듈 스크립트 안에서 편성 fetch → `createAdsController` 호출이 필요하다. `<media-ads>`는 Video.js 플레이어 컨텍스트 없이도 `media.parentElement`를 컨테이너로 쓸 수 있지만(`X/html/element.ts:143`) 예제는 기본 video에 `<media-ads>`를 쓰지 않는다. 기본 video + `<media-ads>` 조합은 증거 없음(U-P2).

### 1.4 영상 ID

- 공통: 문자열, UTF-8, 공백만 금지, 제어 문자 금지, 최대 128자(`A/src/Support.php:23-35`, `schedule` 호출 `A/src/App.php:46`). 클라이언트 쪽은 `video-id`가 비지 않아야 하고(`X/html/element.ts:206`), 응답 `schedule.videoId`가 `video-id`와 정확히 같아야 한다(`X/html/element.ts:271`, 다르면 `schedule_unavailable`).
- 단독 설치: 어떤 ID든 받는다. `video_contexts`에 없는 ID는 게시판·분류가 `null`이라 사이트·영상 규칙만 적용된다(`A/hosts/Standalone.php:70-74`). 등록은 `video-context-save`(`:76-95`). `E/README.md:29`는 등록하라고 쓰지만 필수는 아니다(불일치 D-P5).
- 그누보드: `게시판:글번호:영상키`, 정규식 `^([a-zA-Z0-9_]{1,20}):([1-9][0-9]{0,9}):([a-zA-Z0-9_-]{1,80})$`(`A/hosts/GnuBoard.php:97`). 글이 있어야 하고 댓글이면 안 된다(`:103`). 영상키 허용 목록은 설정 `gnuboardVideoKeys`(기본 `null` → `['main']`, 콜백 `($board, $post)`가 목록 반환, `:107-111`, `A/src/Config.php:23,44-45`). 현재 방문자가 그 글을 읽을 권한이 있어야 편성을 준다(읽기 레벨, 그룹, 본인확인, 비밀글, 포인트 열람 세션 `ss_view_<bo>_<wr>`, 기기, `:121-151`). 그누보드에서는 `video-context-save`가 거부된다(`A/hosts/Host.php:38-41`).
- 도움말 용어는 HF의 `fixed-video-id`를 그대로 링크한다(5절 `player-video-id`).

### 1.5 같은 출처와 `file://`

- 서버: `Sec-Fetch-Site: cross-site`면 403, `Origin`이 있으면 `scheme://HTTP_HOST`와 같아야 하고 아니면 403(`A/src/Http.php:8-20`, 모든 API 요청 `A/public/api/index.php:12`). PHP 어디에도 `Access-Control-*` 헤더가 없다. `C1:23`(관대한 CORS 금지), `C1:90`(기본 같은 출처).
- 클라이언트: `<media-ads>` 편성 fetch는 `credentials: 'same-origin'`, 5초 고정 시간 제한(`X/html/element.ts:259-262`). 수집 POST는 `mode: 'same-origin'`(`X/dom/tracking.ts`). `eventsUrl` = 설정 `apiUrl` + `?action=events`(`A/src/Events.php:23`).
- 문서: 같은 출처에서 예제를 열 것(`E/README.md:3`), HTTP로 서빙하고 `file://`로 열지 말 것(`E/README.md:31`), 페이지와 API가 같은 출처·세션 쿠키를 써야 함(`A/README.md:57`). 예제 `content`는 http/https가 아니면 예외(`E/context.js:29-30`).
- **결론:** 설치 코드는 매니저 API와 같은 출처 페이지에서만 동작한다. 다른 도메인 블로그·쇼핑몰에 붙여 넣으면 편성 요청이 403 또는 CORS 실패로 끝난다(추론, 서버 코드와 클라이언트 코드 근거). 그누보드는 방문자 세션 쿠키가 필요하므로 매니저를 그누보드 사이트 아래(`/ads/`)에 올려야 한다(`A/README.md:75`).

### 1.6 편성 API와 수집 시점

- 요청: `GET {apiUrl}?action=schedule&videoId=…`(`A/src/App.php:28,45-49`). 인증·CSRF 헤더 없음(`A/src/Http.php:69`가 `schedule`, `events`, `player-preset`을 CSRF 대상에서 뺀다).
- 응답: `{ok:true, data:{schedule, playbackSessionId, eventToken, expiresAt, eventsUrl}}`(`A/src/Events.php:17-24`). 세션 수명 `sessionSeconds` 기본 7200(`A/src/Config.php:23`). 편성 규칙이 없으면 `scheduleId: 'none'`.
- GET은 아무것도 쓰지 않는다(`A/README.md:97`). 세션은 첫 유효 `POST events` 때 저장된다(`A/src/Events.php:58`).
- 수집: `preview`가 아니고 `tracking`이 있을 때만 큐를 만든다(`X/dom/controller.ts:161`). 봉투 응답이면 `<media-ads>`가 tracking을 해석하고, 날 JSON이면 tracking 없음(`X/html/element.ts:268-275`). 따라서 `videojs.html`, `player.html`, 설치 코드로 재생하면 **실제 통계에 기록된다**(`E/README.md:44`, `E/videojs.html:37-39`). 미리보기(`preview: true` 또는 날 편성)는 기록하지 않는다.

### 1.7 그누보드 게시물에 플레이어를 넣는 방법

**결론: 없음.** 게시물에 플레이어를 넣는 스킨 파일, 훅(`add_event`/`add_replace`), `extend/` 연결 파일, 본문 자동 삽입 코드가 이 저장소에 없다.

- 검색 범위: `A/**`(node_modules·assets·demo-media 제외). 검색어 `add_event|add_replace|run_event|view.skin|bo_content|extend/|G5_EXTEND|hook|auto insert|자동 삽입|view_skin|skin/board|wr_content|plugin`, `\bskin\b|게시물|본문|삽입|embed|snippet|<media-ads`, 파일 이름 `skin|extend|hook|plugin`. 그누보드 관련 파일은 `A/hosts/GnuBoard.php`(인증, 영상 소속, 대상)와 `A/hosts/gnuboard-admin.php`(`admin.lib.php` require만)뿐이다.
- 문서가 말하는 것: `public/`을 `/ads/`에 올리고 기존 메뉴·사용자 메뉴 훅에서 관리자를 링크하며 코어 파일은 고치지 않는다(`A/README.md:75`). 관리자는 별도 창, 그누보드 관리자 메뉴에 진입 링크 하나(`GB:130`). 프런트 페이지는 `plugin/`이 아니라 `/ads/` 아래(`GB:179`). 게시물 삽입은 명세에 없다.
- 계획 문서와 구현의 차이: `.agents/plans/ads-module-plan.md:185`는 플러그인 관리자 화면 + 작은 `extend` 연결 파일을 권했지만 구현되지 않았다. `:74,85`는 첫 출시를 HTML/스크립트 삽입으로 적는다.
- 그누보드 원본 소스는 읽지 않았다(TASK 금지). 따라서 게시판 스킨 `view.skin.php`에 넣을지, 본문 HTML 편집기로 `<script type="module">`·custom element를 넣을 수 있는지(그누보드 본문 HTML 필터 동작)는 **확인하지 못했다**(U-P3).
- **화면 안내 제안:** "그누보드 게시물에 자동으로 넣는 기능은 준비 중이에요." + 근거가 있는 것만 안내한다: ① 매니저를 사이트 아래 `/ads/`에 설치(같은 출처), ② 영상 ID는 `게시판:글번호:영상키`이고 영상키 기본 `main`, ③ 방문자가 그 글을 읽을 권한이 있어야 광고가 나옴. "어느 파일에 붙여 넣으세요"는 근거가 없으므로 쓰지 않는다. 쓰려면 그누보드 원본 확인과 실제 설치 검증이 먼저다.

## 2. 옵션 근거

### 2.1 `<media-ads>` 속성 (`X/html/element.ts:39-54`) — 모두 내부

| 속성 | 프로퍼티 | 형식 | 기본값 | 동작 | 프리셋 |
| --- | --- | --- | --- | --- | --- |
| `for` | `for` | 문자열(미디어 요소 id) | 없음 | 미디어 요소 찾기 | 아니요(설치 코드가 정함) |
| `src` | `src` | `/경로` 또는 `http(s)://` URL | 없음 | 편성 GET. 상대 경로 거부(`:206`), 5초 시간 제한 고정(`:259`) | 아니요 |
| `video-id` | `videoId` | 문자열 | 없음 | 비면 `invalid_schedule_reference`, 응답 `videoId`와 정확히 일치해야 함(`:271`) | 아니요 |
| `skip-label` | `skipLabel` | 문자열 | 패키지 문구 | `ui.labels.skip`. 공백만이면 무시 | 예 |
| `skip-countdown-label` | `skipCountdownLabel` | 문자열, `{seconds}` | 패키지 문구 | `ui.labels.skipCountdown` | 예 |
| `timer-label` | `timerLabel` | 문자열, `{elapsed}` `{duration}` `{remaining}` | `{elapsed} / {duration}` | `ui.labels.timer`(자리표시자 `X/dom/overlay.ts:257-261`) | 예 |
| `media-alt` | `mediaAlt` | 문자열 | 소재 대체 텍스트 → 패키지 문구 | `ui.labels.mediaAlt`. **설정하면 소재별 대체 텍스트보다 우선**한다(`X/dom/overlay.ts:277`, 다듬지 않음) | 예(주의, 4절 제안 g) |
| `lang`(전역 속성) | — | `ko`·`en` 등 | 조상 `lang` → `en` | `resolveAdsLocale(this)`가 자신부터 조상(그림자 경계 포함)까지 `lang`을 찾는다(`X/dom/ui.ts:70-74`, `X/html/element.ts:337`) | 예 |

- 라벨 속성은 값이 참일 때만 넘긴다(`X/html/element.ts:329-335`). 길이 제한은 런타임에 없다.
- `preview`, 시간 제한, `locale` 전용 속성은 없다. 프리셋의 `ads.timeouts`를 Video.js에 쓸 수 없는 이유다(AC 3.2 "준비 중"과 일치, `A/src/PlayerPresets.php:180-185`가 Video.js 프리셋의 시간 제한을 거부).
- 이벤트: 바인딩·편성 오류의 `ads-error`는 `<media-ads>` 요소에서, 재생 중 오류는 컨테이너에서 발생한다(`X/html/element.ts:138,207,278,295`, `README.md:50`).

### 2.2 `createAdsController(options)` (`X/dom/controller.ts:30-46`) — 내부

| 옵션 | 형식 | 기본값 | 동작 | 프리셋 |
| --- | --- | --- | --- | --- |
| `media` | `AdsMedia`(HTMLMediaElement 호환) | 필수 | 본편 | 아니요 |
| `container` | `HTMLElement` | 필수 | overlay 부모. 기본 video 프리셋 CSS 속성을 넣는 곳 | 아니요 |
| `schedule` | `PlaybackSchedule` | 필수 | 형식이 틀리면 아무것도 안 하는 `{destroy, updateUI}`를 돌려주고 `ads-error invalid_schedule`(`:94-99`) | 아니요 |
| `preview` | `boolean` | `false` | 참이면 수집 큐를 만들지 않는다(`:161`) | 아니요(미리보기 전용) |
| `tracking` | `AdsTracking` | 없음 | 있으면 수집. 편성 응답 `data`에서 `schedule`을 뺀 것 | 아니요 |
| `onEvent` | `(event) => void` | 없음 | 관찰 이벤트 콜백 | 아니요 |
| `timeouts.loadSeconds` | 수 | 5 | 0 초과 60 이하 유한 수만, 아니면 **조용히 5**(`:76-78,159`). 소수 허용 | 예(native만) |
| `timeouts.stallSeconds` | 수 | 10 | 0 초과 120 이하 유한 수만, 아니면 조용히 10(`:160`) | 예(native만) |
| `ui.locale` | 문자열 | 컨테이너 기준 조상 `lang` → `en` | `ko`로 시작하면 한국어, 그 밖은 영어(`X/dom/ui.ts:70-74`) | 예 |
| `ui.labels` | `Partial<AdsLabels>` | 로케일 기본 문구 | 공백만이면 무시(`X/dom/ui.ts:92-103`), 모르는 자리표시자는 글자 그대로(`:106-108`) | 일부(4개) |

| 반환 메서드 | 동작 |
| --- | --- |
| `destroy()` | 정리. 여러 번 불러도 안전. 남은 수집 이벤트를 keepalive로 보낸다(`:216`) |
| `updateUI(ui)` | 표시 옵션 **교체**(병합 아님). 세션·편성·소재는 그대로(`:41-46,210-224`) |

### 2.3 `AdsLabels` 키와 기본 문구 (`X/dom/ui.ts:4-67`) — 내부

| 키 | 자리표시자 | ko | en | 프리셋 |
| --- | --- | --- | --- | --- |
| `advertisement` | — | 광고 | Advertisement | 아니요 |
| `sequence` | `{index}` `{count}` | 광고 {index}/{count} | Advertisement {index} of {count} | 아니요 |
| `playPause` | — | 광고 재생 / 일시정지 | Play / pause ad | 아니요 |
| `mute` | — | 광고 음소거 | Mute ad | 아니요 |
| `volume` | — | 광고 음량 | Ad volume | 아니요 |
| `advertiser` | — | 광고주 사이트 | Visit advertiser | 아니요 |
| `newWindow` | — | 새 탭에서 열림 | Opens in a new tab | 아니요 |
| `skip` | — | 광고 건너뛰기 | Skip ad | 예 |
| `skipCountdown` | `{seconds}` | {seconds}초 후 건너뛰기 | Skip in {seconds}s | 예 |
| `timer` | `{elapsed}` `{duration}` `{remaining}` | {elapsed} / {duration} | {elapsed} / {duration} | 예 |
| `mediaAlt` | — | 광고 | Advertisement | 예 |
| `loading` | — | 광고 불러오는 중… | Loading advertisement… | 아니요 |
| `paused` | — | 광고 일시정지 | Advertisement paused | 아니요 |
| `blocked` | — | 재생 버튼을 눌러 계속하세요 | Press Play to continue | 아니요 |
| `enterFullscreen` | — | 전체화면 시작 | Enter fullscreen | 아니요 |
| `exitFullscreen` | — | 전체화면 종료 | Exit fullscreen | 아니요 |
| `fullscreenError` | — | 전체화면을 사용할 수 없습니다 | Fullscreen unavailable | 아니요 |

- `resolveAdsLocale`, `resolveAdsLabels`, `formatAdLabel`은 `@internal`이고 `X/dom/index.ts:1-3`에서 내보내지 않는다(타입 `AdsLabels`, `AdsUIOptions`만 내보냄).

### 2.4 스킨 공개 CSS 속성 — **공개**(`DOC/customize-skins.mdx:53-62`)

문서 표에는 기본값 열이 없다. 아래 기본값은 스킨 CSS에서 읽었다.

| 속성 | 바꾸는 것 | default 스킨 기본 | neutral 스킨 기본 | 근거 | 프리셋 |
| --- | --- | --- | --- | --- | --- |
| `--media-accent-color` | 슬라이더 채움, 강조 컨트롤·메뉴, 주요 동작 | 흰색 `oklch(1 0 0)`(`--media-default-accent-color`) | 같음(`SK/themes/neutral.css`의 `.media-skin[data-theme="neutral"]`에 강조색 재정의 없음) | `SK/themes/theme.css:13,43` | 예 |
| `--media-accent-text-color` | 강조색 위 글자·아이콘 | `contrast-color()` 지원 시 자동 대비, 미지원 시 검정 `oklch(0 0 0)` | 같음 | `SK/themes/theme.css:15,44,102-110`, `DOC/customize-skins.mdx:64`(Chrome 147, Firefox 146, Safari 26) | 예 |
| `--media-border-color` | 플레이어 테두리 선 | `rgb(0 0 0 / .1)`(다크 스킴 `rgb(255 255 255 / .15)`) | `rgb(0 0 0 / .15)`(다크 동일 `.15`) | `SK/video/theme.css:6,47,95,99` | 예 |
| `--media-border-radius` | 플레이어 모서리 | **28px** | **12px** | `SK/themes/theme.css:89`, `SK/themes/neutral.css:29` | 예 |
| `--media-font-family` | 플레이어 글꼴 | `"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif`(Inter는 페이지가 불러와야 함) | 같음 | `SK/tailwind.css:111`, `DOC/customize-skins.mdx:66` | 예(`system`만) |
| `--media-object-fit` | 영상·포스터 채우기 | `contain`. 전체화면에서는 항상 `contain` | 같음 | `SK/base.css:75`, `SK/themes/theme.css:129-130` | 예 |
| `--media-object-position` | 채우지 않을 때 위치 | `center` | 같음 | `SK/base.css:76` | **아니요(스키마에 없음, 제안 d)** |
| `--media-scale-unit` | 간격·아이콘·글자 기준 크기 | `16px`, 전체화면 1920px 이상에서 최대 1.75배 | 같음 | `SK/themes/theme.css:92`, `DOC/customize-skins.mdx:84,92` | 예(`root`만) |

- 이 8개 말고는 스킨 내부 요소·클래스·사용자 정의 속성에 의존하지 말라고 문서가 적는다(`DOC/customize-skins.mdx:96-98`). 스킨 CSS는 이 속성들을 `.media-skin`에서 선언하지 않고 `var(--x, 기본)`로 읽기만 하므로(위 근거 줄들), 스킨 요소(`<video-skin>`)의 `style`에 넣으면 그림자 트리 안으로 상속된다(추론, `DOC/customize-skins.mdx:40-50`의 `<VideoSkin style>` 예와 일치). 예외로 전체화면의 `--media-object-fit: contain`은 안쪽에서 선언되어 프리셋 값을 덮는다.
- `--media-default-accent-color`, `--media-default-accent-text-color`, `--media-internal-accent-text-fallback`은 `kind: 'internal'`이다(`SK/vars.ts:140-150`). 옵션 표에 넣지 않는다.

### 2.5 광고 화면 CSS 속성 `--ads-*` (`X/dom/overlay.styles.ts:3-30`) — **내부**

`packages/extensions/ads/README.md:85`가 통합 기간 동안 내부라고 적는다. 사이트 문서 없음. 옵션 설명 화면에는 "내부(바뀔 수 있음)" 표시가 필요하다.

| 속성 | 대체 순서 | 최종 기본 | 쓰는 곳 | 프리셋 |
| --- | --- | --- | --- | --- |
| `--ads-color` | `--media-foreground` | `#fff` | 글자색 | 아니요 |
| `--ads-font-size` | — | `13px`. 컨테이너 280px 이하에서 패널 `11px` 고정 | 글자 크기 | 예(`ads.fontSize`) |
| `--ads-font-family` | `--media-font-family` | `system-ui` | 글꼴 | 간접(`theme.fontFamily`) |
| `--ads-background` | — | `#000` | 광고 패널 배경 | 아니요 |
| `--ads-radius` | `--media-video-border-radius` → `--media-border-radius` | `0` | 광고 패널 모서리. 스킨 안이면 스킨 모서리(28/12px)를 따른다 | 간접(`theme.borderRadius`) |
| `--ads-inset` | — | `12px` | 머리·바닥 여백 | 아니요 |
| `--ads-scrim` | — | `linear-gradient(transparent,#000b)` | 바닥 그라데이션 | 아니요 |
| `--ads-control-size` | `--media-control-size` | `36px` | 버튼 최소 크기 | 아니요 |
| `--ads-control-radius` | `--media-control-radius` | `8px` | 버튼 모서리 | 아니요 |
| `--ads-button-background` | — | `#0005` | 버튼 배경 | 아니요 |
| `--ads-hover-background` | — | `#ffffff26` | 마우스 올림 배경 | 아니요 |
| `--ads-skip-radius` | — | `6px` | 건너뛰기 버튼 모서리 | 예(`ads.skipRadius`) |
| `--ads-accent-color` | `--media-accent-color` | `#fff` | **음량 슬라이더 `accent-color`만** | 예(`ads.accentColor`) |
| `--ads-focus-color` | `--media-ring` → `--media-accent-color` | `#fff` | 키보드 포커스 테두리. 스킨 안에서는 `--media-ring`이 흰색으로 고정되어(`SK/themes/theme.css:21`) 강조색을 바꿔도 흰색이다. 강조색을 따르는 것은 `--media-ring`이 없는 기본 video 컨테이너뿐이다 | 아니요 |

- 고정 값(속성 없음): 머리 그라데이션 `#0008`, 상태 배지 `#0009`, 건너뛰기 테두리 `#ffffff80`, 광고주 링크 배경 `#0008`·모서리 6px, 컨테이너 쿼리 400px·280px, 강제 색 모드 처리.
- overlay는 `:host`를 가진 그림자 루트 안에 있으므로 `--ads-*`는 overlay 조상(스킨 요소 또는 기본 video 컨테이너)에 넣어야 한다. `<media-ads>` 요소 자체에 넣으면 overlay가 그 자손이 아니라 닿지 않는다(추론: overlay는 컨테이너에 붙고 `<media-ads>`의 자손이 아님, `X/html/element.ts:143`).
- 스킨 밖(기본 video)에서는 `--media-*` 대체 값이 없으므로 `--media-accent-color` 등을 컨테이너에 넣으면 overlay가 그것을 읽는다(`theme.*`를 native에서 거부하는 현재 PHP 규칙과는 별개, 제안 l).

### 2.6 예제 페이지 쿼리 (`E/context.js`) — 예제

| 쿼리 | 허용 값 | 기본값 | 근거 | 비고 |
| --- | --- | --- | --- | --- |
| `video` | 아무 문자열(클라이언트 검증 없음) | `video-1` | `:32` | 서버가 1.4 규칙으로 검증 |
| `content` | http/https 또는 상대 URL | HLS면 `../demo-media/content-master.m3u8`, 아니면 `../demo-media/content.mp4` | `:24-30` | 다른 프로토콜은 예외 |
| `media` | `hls`, 그 밖은 모두 `mp4` | `mp4` | `:5` | |
| `engine` | `hlsjs`, 그 밖은 모두 `spf` | `spf` | `:6` | Video.js 페이지만 사용(`E/example.js:59,65,71`). `player.html`에 엔진 링크 없음 |
| `preset` | 프리셋 id | 없음(패키지 기본값) | `E/example.js:66-103` | **구현됨(2026-10-20 재확인).** 공개 `player-preset&id=`로 받아 `E/preset.js` `readPresetRender`(`:280`)로 다시 검증한다. 플레이어 종류가 다르거나 검증에 실패하면 안내를 띄우고 패키지 기본값으로 재생한다. 쿼리가 없으면 요청하지 않으며, 사이트 기본 프리셋도 쓰지 않는다 |

- 링크 바꾸기는 쿼리 전체를 유지하고 `media`·`engine`만 바꾼다(`E/context.js:8-14`).
- 공개 `player-preset` 액션은 백엔드에 있다(`A/src/App.php:28,53-55`, `A/src/PlayerPresets.php:84-129`, CSRF 제외 `A/src/Http.php:69`). 예제 쪽 적용은 `E/preset.js`(검증·적용)와 `E/example.js:66-103`(`?preset=` 읽기)에 있다(2026-10-20 재확인, D-P2 해소).

## 3. 스킨

| 스킨 | 요소 | 파일 | 성격 | 근거 |
| --- | --- | --- | --- | --- |
| default | `<video-skin>` | `video.css`, `video.js` | 기본 디자인. 모서리 28px, Inter | `HT/presets/video/skin.ts:9-12`, `CDN/src/video.ts:1-3`, `DOC/cdn.mdx:30` |
| neutral | `<video-neutral-skin>` | `video-neutral.css`, `video-neutral.js` | 차분한 변형. 모서리 12px, 테두리 `.15` | `HT/presets/video/neutral-skin.ts:9-12`, `DOC/cdn.mdx:31` |
| compat | `<video-compat-skin>` | `video-compat.css`, `video-compat.js` | 단순 표면·기본 컨트롤, 넓은 브라우저 호환이 목표. 전체화면 확대 없음, 모서리 `.75rem` | `HT/presets/video/compat-skin.ts:9-12`, `DOC/skins.mdx:18`, `DOC/cdn.mdx:32` |
| scaffold | `<video-scaffold-skin>` | `video-scaffold.css`, `video-scaffold.js` | 직접 스킨을 만들 출발점. 모양을 바꾸라고 만든 최소 스타일. `contrast-color` 없음, 글꼴 상속, 모서리 0 | `HT/presets/video/scaffold-skin.ts:9-12`, `DOC/skins.mdx:18`. `DOC/cdn.mdx:28-33` 표에는 없음 |

- 네 스킨 모두 사이트 참조 페이지가 있고 실험 표시는 없다(`site/src/docs.config.ts:177-180`, `DOC/skins.mdx:18`). 즉 compat·scaffold도 공개 스킨이다.
- **default·neutral만 고른 것은 타당하다.** 근거: ① 공개 CSS 속성 8개가 같은 의미로 동작하는 완성 디자인 두 개다. ② compat은 전체화면 확대와 `contrast-color()` 같은 일부 동작이 달라 같은 테마 폼과 미리보기로 설명하면 어긋난다(위 성격 열). ③ scaffold는 "모양을 바꾸라고 만든" 출발점이라 프리셋 테마만으로는 완성 플레이어가 되지 않는다(`DOC/skins.mdx:18`). ④ CDN 문서 표가 video 기본 번들로 default·neutral·compat만 적고 scaffold는 빠져 있다(`DOC/cdn.mdx:28-33`).
- **"준비 중" 근거 문구 제안:** compat "넓은 브라우저 호환용 스킨이에요. 기본 컨트롤만 있고 일부 테마 속성이 다르게 보여 미리보기 검증 후 열 예정이에요." scaffold "직접 스킨을 만드는 출발점이라 테마 설정만으로는 완성되지 않아요."
- compat·scaffold의 개별 CSS 차이(전체화면 확대 없음, `.75rem`, 글꼴 상속, 모서리 0)는 하위 조사 결과이며 이번에 줄 번호를 다시 대조하지 않았다(U-P6).

## 4. 계약 4.1절 스키마 대조와 수정 제안

대조 대상: AC 4.1 표(현재 판), `A/src/PlayerPresets.php`(미추적, ads-admin-api 작업 중), `A/ui/src/player/preset.ts`(미추적, ads-implementer 작업 중), 2절 런타임.

| 행 | 대조 결과 | 비고 |
| --- | --- | --- |
| `id` | 맞음. PHP `default` 또는 `^p-[a-z0-9]{10}$`(`PlayerPresets.php:239-245`) | |
| `name` | 런타임 무관 | 앞뒤 공백·제어 문자 기준은 AC 4.1 "문자열 검증 기준"(JS `trim` 집합, `\p{Cc}`와 양방향 제어 문자 거부)을 따른다. 라벨 3개도 같다 |
| `playerType` | 맞음 | |
| `skin` | 맞음. 매핑 `PlayerPresets.php:11` | native면 `null`(`:187`) |
| `theme.accentColor` | 속성 맞음. "스킨 기본" = 흰색 | 광고 화면에서는 음량 슬라이더에만 상속된다. 포커스 테두리는 스킨의 `--media-ring`(흰색 고정)을 따른다(2.5) |
| `theme.accentTextColor` | 속성 맞음. "자동 대비"는 `contrast-color()` 지원 브라우저만 | 제안 k |
| `theme.borderColor` | 맞음. 기본은 스킨·색 스킴마다 다름 | |
| `theme.borderRadius` | 속성 맞음. "스킨 기본"은 default 28px, neutral 12px | 광고 패널 모서리도 따라감. 제안 c |
| `theme.fontFamily` | 속성 맞음. 기본은 Inter 우선 스택 | 광고 화면 글꼴도 바뀜. 제안 e |
| `theme.objectFit` | 맞음. 전체화면은 항상 `contain` | 광고 소재는 항상 `contain`(`overlay.styles.ts:12`). 제안 d |
| `theme.scaleUnit` | 맞음(16px) | 광고 화면에는 영향 없음(overlay가 `--media-scale-unit`을 읽지 않음) |
| `ads.locale` | Video.js `<media-ads lang>` 동작함(자신부터 탐색). native `ui.locale` 맞음 | 제안 h |
| `ads.labels.skip` | 맞음 | |
| `ads.labels.skipCountdown` | 맞음(`{seconds}`) | |
| `ads.labels.timer` | 런타임은 `{remaining}`도 지원 | 제안 b |
| `ads.labels.mediaAlt` | 동작은 맞으나 소재별 대체 텍스트를 덮음 | 제안 g. AC 4.1에서 스키마에서 뺐다(2026-10-20) |
| `ads.accentColor` | 속성 맞음. 실제 효과는 음량 슬라이더만 | 제안 a |
| `ads.skipRadius` | 맞음(6px) | |
| `ads.fontSize` | 맞음(13px). 280px 이하 컨테이너는 11px 고정 | 제안 m |
| `ads.timeouts.loadSeconds` | 맞음(5, 최대 60). 런타임은 범위 밖을 조용히 기본값으로 | 제안 f |
| `ads.timeouts.stallSeconds` | 맞음(10, 최대 120) | 제안 f |

**수정 제안 (오케스트레이터가 계약에 반영할지 판단)**

- **(a) `ads.accentColor` 설명:** "비우면 = 스킨 강조색"은 런타임과 맞지만(`--ads-accent-color` → `--media-accent-color` → `#fff`) 효과는 **광고 음량 슬라이더 색뿐**이다. 건너뛰기 버튼·포커스 테두리는 바뀌지 않는다(포커스는 `--ads-focus-color` → `--media-ring`). 폼 라벨·도움말을 "광고 음량 막대 색"으로 바꾸거나, 값어치가 작으면 행을 빼는 것을 제안.
- **(b) `ads.labels.timer`:** 허용 자리표시자에 `{remaining}`(남은 시간)을 더하거나, 일부러 막는다면 "런타임은 지원하지만 v1에서는 막음"을 적는다(`X/dom/overlay.ts:257-261`).
- **(c) "비우면" 열 수치화:** `theme.borderRadius` = default 28px / neutral 12px, `theme.accentColor` = 흰색, `theme.accentTextColor` = 자동 대비(미지원 브라우저는 검정), `theme.fontFamily` = Inter 우선(페이지가 Inter를 불러오지 않으면 시스템 글꼴), `theme.borderColor` = 반투명 검정(neutral이 더 진함). 옵션 표·폼 placeholder가 같은 숫자를 쓰게 한다.
- **(d) `--media-object-position` 누락:** 공개 속성 8개 중 유일하게 스키마에 없다(`PlayerPresets.php:93-99`, `preset.ts:118-124`에도 없음). `cover`를 고르면 잘리는 위치를 정할 수 없다. v1에서 뺄 거라면 옵션 표에 "프리셋에서 설정 불가"로 적고, 넣을 거라면 `theme.objectPosition`: `center` | `top` | `bottom` 정도의 선택지를 제안. 또 "전체화면에서는 항상 `contain`"을 `theme.objectFit` 설명에 더한다.
- **(e) `theme.fontFamily` 파급:** 광고 화면 글꼴도 `--ads-font-family` → `--media-font-family`로 같이 바뀐다고 적는다. 기본 스택이 Inter라 "스킨 기본"과 `system`의 차이는 페이지가 Inter를 불러올 때만 보인다(`DOC/customize-skins.mdx:66`). 미리보기 iframe이 Inter를 불러오는지에 따라 차이가 안 보일 수 있다(U-P5).
- **(f) 시간 제한 검증 책임:** 런타임 `boundedSeconds`는 범위 밖·NaN·0 이하를 오류 없이 기본값으로 바꾸고 소수도 받는다(`X/dom/controller.ts:76-78`). 계약의 "정수, 범위 밖 거부"는 PHP·TS·예제 JS 검증이 전부 책임진다는 문장을 더한다. PHP는 이미 정수 1–60/1–120으로 거부(`PlayerPresets.php:173-175`).
- **(g) `ads.labels.mediaAlt`:** 설정하면 소재 등록 때 입력한 소재별 대체 텍스트보다 우선한다(`X/dom/overlay.ts:277`: `ui.labels.mediaAlt || ad.alt || 기본`). 프리셋 하나가 모든 소재의 대체 텍스트를 같은 문구로 덮으므로 접근성 손실이다. 행을 빼거나 "소재 대체 텍스트가 없을 때만"으로 바꾸려면 런타임 변경이 필요하다(광고 패키지 담당 판단). 최소한 폼에 "입력하면 소재별 대체 텍스트 대신 이 문구를 써요" 경고를 둔다. 또 이 값은 다듬지 않고 그대로 쓰이므로 저장 시 앞뒤 공백 제거를 권한다.
- **(h) `ads.locale` 적용 문구:** "Video.js: `<media-ads lang>`"은 동작한다. 다만 `lang`은 `<media-ads>`의 프로퍼티가 아니라 전역 HTML 속성이고, 비우면 `<media-ads>`에서 위로 조상 `lang`(보통 `<html lang>`)을 찾는다는 뜻으로 "페이지 `lang`"을 풀어 쓴다. 조상 어디에도 없으면 영어다(`X/dom/ui.ts:73`). 한국어 사이트에서 `<html lang>`이 없으면 광고 문구가 영어로 나오므로 "비우면" 설명에 이 점을 적는다.
- **(i) CSS 적용 위치 명시:** 이미 "스킨 요소의 `style`" / "광고 컨테이너의 `style`"로 맞다. 덧붙일 것: `--ads-*`를 `<media-ads>` 요소에 넣으면 효과가 없다(2.5).
- **(j) `<media-ads>` 편성 요청 5초 고정:** Video.js 프리셋에서 `loadSeconds`를 막는 이유 설명에 "편성 요청은 5초 고정, 광고 소재 로드 시간 제한은 아직 속성이 없음"을 쓴다(`X/html/element.ts:259`). 둘은 다른 시간 제한이다.
- **(k) 자동 대비 브라우저 조건:** "비우면 = 자동 대비" 옆에 "Chrome 147, Firefox 146, Safari 26 미만은 검정 글자 고정이라 어두운 강조색이면 강조 글자색을 함께 정하세요"(`DOC/customize-skins.mdx:64`). 3.2절의 4.5:1 대비 경고는 강조 글자색이 비었을 때 무엇과 비교하는지 정해야 한다(검정 기준 제안).
- **(l) native와 테마:** 계약은 "기본 video에서는 스킨 항목을 숨긴다"이고 PHP도 native의 `theme.*`를 거부한다(`PlayerPresets.php:180-185`). 그런데 광고 화면은 `--media-accent-color`, `--media-font-family`, `--media-border-radius`를 대체 값으로 읽으므로 native에서도 광고 화면 모양에는 영향이 있을 수 있다. 현재 결정(거부)을 유지하되, native 광고 화면 강조색은 `ads.accentColor`(음량 막대)뿐이라는 점을 옵션 표에 적는다.
- **(m) `ads.fontSize`:** 컨테이너 폭 280px 이하에서는 패널 글자가 11px로 고정되어 설정값이 무시된다(`X/dom/overlay.styles.ts:29`). 설명에 적는다.
- **(n) 공개 액션 경로 형식:** 공개 `player-preset` 응답과 설치 코드의 `src`·`apiUrl`은 `/`로 시작하는 경로 또는 절대 URL이어야 한다(`X/core/url.ts`). `installSnippet` 입력 `apiUrl`에 상대 경로가 오면 거부하거나 절대화하라는 문장을 TS export 설명에 더한다.
- **(o) 계약 내 참조 수정:** AC `:125,127`의 `examples/player-preview.html`과 `preset.ts:2`의 `public/examples/preset.js`는 아직 없다(ads-implementer 작업 예정으로 보임). 완료 조건에서 확인할 파일 목록에 넣는다.

## 5. 플레이어 용어 (12개)

형식은 HF 2절과 같다. termId는 HF와 겹치지 않게 `player-` 접두어를 붙였다(`player-video-id`는 HF `fixed-video-id`로 이어 주는 별칭). 화면 이름은 AC 3.2 문구 기준이며 화면이 아직 없어 위치는 제안이다.

**`player-preset` — 프리셋** (`프리셋`, 메뉴 `플레이어`)
- 뜻: 플레이어 종류, 스킨, 테마, 광고 화면 설정을 이름 붙여 저장한 묶음이다. 저장하면 이 프리셋을 쓰는 페이지에 바로 적용된다(초안·게시 단계 없음).
- 수치: 이름 1–40자, 저장 프리셋 최대 20개, 동시 수정은 revision 409.
- 근거: AC 3.2·4.1, `A/src/PlayerPresets.php`(meta 키 `player_presets`), `A/ui/src/player/preset.ts`.
- 상태: 지금 동작. 예제 `?preset=` 적용도 구현됨(2.6, `E/example.js:66-103`).
- 모션: 색·모서리·글꼴 칩이 상자 하나로 묶여 이름표가 붙고, 그 상자가 페이지 두 개에 동시에 꽂힌다.
- HelpLink: `#/players` 목록 제목 옆, 편집 화면 `이름` 필드.

**`player-default-preset` — 기본 프리셋** (`기본으로 지정`, 목록 `기본` 표시)
- 뜻: 설치 코드 생성기와 재생 테스트에서 먼저 선택되는 프리셋이고, 공개 `player-preset`을 id 없이 부르면 돌려주는 프리셋이다(AC 3.2). `?preset` 없는 예제 페이지와 이미 붙여 넣은 설치 코드에는 적용되지 않는다(예제는 패키지 기본값, 설치 코드는 만든 시점의 값). 처음에는 내장 `default`이고 다른 프리셋으로 바꿀 수 있다. 기본 프리셋을 지우면 `default`로 돌아간다. 내장 `default`는 패키지 기본값 그대로이며 고치거나 지울 수 없고 복제만 된다.
- 근거: AC 3.2·4.1(`player-preset-default`, `player-preset-delete`), 공개 `player-preset`에 id가 없으면 기본 프리셋(AC 4.1).
- 상태: 지금 동작 예정(구현 중).
- 모션: 목록에서 별표가 한 프리셋에서 다른 프리셋으로 옮겨 가고, 생성기와 재생 테스트의 선택 칸이 별표 쪽으로 먼저 맞춰진다.
- HelpLink: 목록의 `기본으로 지정` 버튼 옆.

**`player-type` — 플레이어 종류** (`Video.js` / `기본 video`)
- 뜻: Video.js는 스킨과 테마가 적용되는 플레이어, 기본 video는 브라우저 기본 컨트롤이다. 기본 video에는 스킨 테마가 적용되지 않고, 광고 시간 제한은 기본 video에서만 정할 수 있다.
- 근거: `E/example.js:63-130`, `A/src/PlayerPresets.php:180-185`, 2.1·2.2.
- 상태: 지금 동작 예정.
- 모션: 같은 영상 틀에 스킨 컨트롤 막대와 브라우저 기본 막대가 번갈아 씌워진다.
- HelpLink: 편집 화면 `플레이어 종류`.

**`player-skin` — 스킨** (`스킨`: `기본`, `뉴트럴`)
- 뜻: Video.js 플레이어의 모양 묶음이다. 기본은 둥근 모서리 28px, 뉴트럴은 12px에 테두리가 조금 진하다. 스킨마다 CSS·JS 파일이 따로 있어 설치 코드도 달라진다. compat·scaffold는 준비 중이다.
- 근거: 3절, `SK/themes/theme.css:89`, `SK/themes/neutral.css:29`.
- 상태: default·neutral 지금 동작 예정, compat·scaffold 준비 중.
- 모션: 같은 플레이어가 모서리와 테두리만 바뀌며 두 스킨 사이를 오간다.
- HelpLink: 편집 화면 `스킨`.

**`player-theme-property` — 테마 속성** (`스킨 테마` 묶음)
- 뜻: 스킨 모양을 바꾸는 공식 설정값이다. Video.js가 공개한 8개(강조색, 강조 글자색, 테두리 색, 모서리, 글꼴, 채우기 방식, 채우기 위치, 크기 기준) 중 7개를 프리셋에서 정한다. 이 밖의 스킨 내부는 바뀔 수 있어 쓰지 않는다.
- 근거: `DOC/customize-skins.mdx:53-62,96-98`, `SK/vars.ts:15-47`.
- 상태: 지금 동작 예정. 채우기 위치(`--media-object-position`)는 스키마에 없음(4절 d).
- 모션: 슬라이더를 움직이면 미리보기 모서리가 실시간으로 둥글어진다.
- HelpLink: 편집 화면 `스킨 테마` 묶음 제목.

**`player-accent-color` — 강조색** (`강조색`, `강조 글자색`)
- 뜻: 진행 막대 채움, 강조 버튼, 메뉴 선택에 쓰는 색이다. 비우면 흰색이다. 강조 글자색을 비우면 브라우저가 대비되는 글자색을 고르지만 오래된 브라우저(Chrome 147, Firefox 146, Safari 26 미만)는 검정으로 고정된다. 대비가 4.5:1 미만이면 경고한다(저장은 됨). 광고 화면에서는 음량 막대만 이 색을 이어받는다. 포커스 테두리는 스킨이 정한 흰색(`--media-ring`)이다(`SK/themes/theme.css:21`).
- 근거: `SK/themes/theme.css:13-16,43-44,102-110`, `DOC/customize-skins.mdx:64`, `X/dom/overlay.styles.ts:26-27`, AC 3.2.
- 상태: 지금 동작 예정.
- 모션: 진행 막대가 노란색으로 차오르고 그 위 아이콘 글자가 검정으로 바뀐다.
- HelpLink: 편집 화면 `강조색`, `강조 글자색`.

**`player-object-fit` — 채우기 방식** (`화면 채우기`: `맞춤` / `채움`)
- 뜻: 영상 비율이 플레이어와 다를 때 맞춤(`contain`)은 전체가 보이고 빈 곳이 생기며, 채움(`cover`)은 빈 곳 없이 잘린다. 전체화면에서는 항상 맞춤이다. 광고 소재는 이 설정과 상관없이 항상 맞춤이다.
- 근거: `SK/base.css:75-76`, `SK/themes/theme.css:129-130`, `X/dom/overlay.styles.ts:12`.
- 상태: 지금 동작 예정.
- 모션: 세로 영상이 가로 틀 안에서 검은 띠가 생겼다가(맞춤) 확대되어 위아래가 잘린다(채움).
- HelpLink: 편집 화면 `화면 채우기`.

**`player-ad-overlay` — 광고 화면** (`광고 화면` 설정 묶음)
- 뜻: 광고가 재생될 때 본편 위에 덮이는 층이다. "광고" 표시, 건너뛰기 버튼, 광고 시간(기본 문구는 `{elapsed} / {duration}`, 즉 지난 시간 / 광고 길이이고, `{remaining}`을 쓰면 남은 시간), 광고주 링크, 음량이 있다. 프리셋에서는 건너뛰기 문구, 건너뛰기 대기 문구, 시간 문구, 언어, 음량 막대 색, 건너뛰기 버튼 모서리, 글자 크기를 정한다. 광고 화면 CSS 속성(`--ads-*`)은 아직 내부 설정이라 바뀔 수 있다.
- 수치: 글자 11–18px(기본 13, 폭 280px 이하 화면은 11 고정), 건너뛰기 모서리 0–24px(기본 6), 문구 0–40자.
- 근거: 2.1·2.3·2.5, `packages/extensions/ads/README.md:85`.
- 상태: 지금 동작 예정.
- 모션: 본편 위로 반투명 층이 내려오고 오른쪽 아래 건너뛰기 버튼의 카운트다운이 0이 되며 눌림 가능해진다.
- HelpLink: 편집 화면 `광고 화면` 묶음 제목.

**`player-ad-language` — 광고 문구 언어** (`광고 문구 언어`)
- 뜻: 광고 화면 기본 문구를 한국어로 쓸지 영어로 쓸지다. 비우면 페이지의 `lang`을 따르고, 페이지에 `lang`이 없으면 영어다. 직접 입력한 문구가 있으면 그 문구가 우선이다.
- 근거: `X/dom/ui.ts:49-74`, `X/html/element.ts:329-337`.
- 상태: 지금 동작 예정.
- 모션: `lang="ko"` 꼬리표가 붙자 "Skip ad"가 "광고 건너뛰기"로 바뀐다.
- HelpLink: 편집 화면 `광고 문구 언어`.

**`player-install-snippet` — 설치 코드** (`설치 코드`, `복사`)
- 뜻: 프리셋, 영상 ID, 본편 주소, 미디어 종류를 고르면 만들어지는 HTML 코드다. 매니저와 **같은 사이트(같은 출처)** 페이지에 붙여 넣어야 하며 다른 도메인에서는 광고 편성을 받지 못한다. 이 코드로 재생하면 실제 통계에 기록된다. 파일 경로는 `/`로 시작하는 경로나 전체 주소여야 한다.
- 근거: 1.3·1.5·1.6, `X/core/url.ts:5-20`, AC 3.2·4.1(`installSnippet`).
- 상태: 지금 동작 예정. 정적 붙여넣기 재생 증거 없음(U-P1). 그누보드 자동 삽입은 준비 중(1.7).
- 모션: 코드 상자가 복사되어 빈 페이지에 붙고 그 자리에 플레이어가 나타난다.
- HelpLink: `#/players/setup` 생성기 제목, `복사` 버튼 옆.

**`player-media-engine` — 미디어 형식** (`MP4` / `HLS-SPF` / `HLS-hls.js`)
- 뜻: 본편 파일 형식과 재생 엔진이다. MP4는 두 플레이어 모두, HLS는 Video.js에서만 고를 수 있다. HLS-SPF는 Video.js 자체 엔진(`<hls-video>`), HLS-hls.js는 hls.js 엔진(`<hlsjs-video>`)이다.
- 근거: `E/context.js:5-6`, `E/example.js:59-71`, AC 3.2.
- 상태: 지금 동작(예제), 생성기는 동작 예정.
- 모션: `.m3u8` 파일이 두 갈래 엔진 중 하나를 지나 플레이어에 들어간다.
- HelpLink: 생성기 `미디어`.

**`player-video-id` — 영상 ID (플레이어)** → HF `fixed-video-id`로 이동
- 뜻: 설치 코드의 `video-id`. 편성·통계가 영상을 구분하는 고정 ID다. 그누보드는 `게시판:글번호:영상키`(영상키 기본 `main`)이고 방문자가 그 글을 읽을 권한이 있어야 광고가 나온다.
- 근거: 1.4, HF `fixed-video-id`.
- 상태: 지금 동작.
- 모션: HF `fixed-video-id`와 같은 모션을 재사용한다.
- HelpLink: 생성기 `영상 ID`. 도움말 링크는 `#/help/fixed-video-id`로 보내고 별도 항목을 만들지 않는 것을 권한다(중복 방지).

용어 수: 12개(새 항목 11 + 기존 연결 1). AC 3.2가 요구한 7개(프리셋, 기본 프리셋, 스킨, 테마 속성, 강조색, 광고 화면, 설치 코드)와 TASK가 요구한 영상 ID를 모두 포함한다.

## 6. 확인하지 못한 항목과 불일치

### 6.1 확인하지 못한 항목 (7)

| 번호 | 항목 | 확인하려면 |
| --- | --- | --- |
| U-P1 | 정적 HTML로 붙여 넣은 `<video-player><video-skin><video><media-ads>`가 예제(동적 생성)와 같이 재생되는지. 모듈 로드 전 정적 마크업의 업그레이드 순서 | 격리 설치에서 빈 HTML 붙여넣기 실행(AC 6 완료 조건) |
| U-P2 | 기본 video + `<media-ads>`(컨테이너 = `media.parentElement`) 조합. 예제는 기본 video에 `createAdsController`만 쓴다 | 브라우저 실행 |
| U-P3 | 그누보드 게시판 스킨·본문 HTML에 `<script type="module">`과 custom element를 넣을 수 있는지(본문 HTML 필터) | 그누보드 원본 확인(이번 TASK 금지) 후 실제 설치 검증 |
| U-P4 | 스킨 요소 `style`에 넣은 `--media-*`·`--ads-*`가 그림자 트리 안 `<media-container>`와 overlay까지 상속되는지 | 브라우저 계산된 스타일 확인 |
| U-P5 | 미리보기 iframe에서 `theme.fontFamily` 차이가 보이는지(Inter를 불러오지 않으면 둘 다 시스템 글꼴처럼 보일 수 있음) | `player-preview.html` 구현 후 확인 |
| U-P6 | compat·scaffold 스킨의 세부 CSS 차이(전체화면 확대 없음, `.75rem`, 글꼴 상속, 모서리 0). 하위 조사 결과이며 줄을 다시 대조하지 않음 | `SK/` compat·scaffold CSS 직접 대조 |
| U-P7 | rsync 명령이 `video.js`가 쓰는 청크를 빠짐없이 복사하는지(디렉터리는 완전해 보이나 명령은 실행 안 함) | 빈 디렉터리로 rsync 후 예제 실행 |

### 6.2 코드와 문서의 불일치 (8)

| 번호 | 내용 | 근거 |
| --- | --- | --- |
| D-P1 | `A/README.md:77`은 schedule·events만 공개·토큰 없음이라 쓰지만 `player-preset`도 CSRF 제외 공개 액션이다. README에 플레이어 프리셋 액션 설명이 없다 | `A/src/Http.php:69`, `A/src/App.php:28,53-55` |
| D-P2 | **해소(2026-10-20 재확인).** 처음 작성할 때는 `E/preset.js`, `E/player-preview.html`이 없었고 `?preset=`도 적용되지 않았다. 지금은 세 가지 모두 있다 | `E/preset.js`, `E/player-preview.html`, `E/example.js:66-103` |
| D-P3 | capabilities 표류: C1 `:96`은 `{host, manualTargets, uploads, loginUrl}`인데 코드는 그누보드 `siteUrl`·`adminUrl`(`H/GnuBoard.php:78`)과 `playerPresets: true`(`A/src/App.php:38`)도 낸다 | — |
| D-P4 | `.agents/plans/ads-module-plan.md:185`(플러그인 + `extend` 연결)와 실제 구현(`/ads/` 마운트 + 메뉴 링크, 연결 코드 없음)이 다르다 | 1.7 |
| D-P5 | `E/README.md:29`는 단독 설치에서 영상 ID를 등록하라고 하지만 코드는 미등록 ID도 받는다(게시판·분류 맥락만 없음) | `A/hosts/Standalone.php:70-74` |
| D-P6 | `A/README.md:10`은 루트가 생성 파일을 제공한다고만 하고 빌드 명령이 없다. 명령은 `E/README.md:10-20`에만 있고 `ads.js` 빌드는 package script가 아닌 Vite+ task다 | `packages/extensions/ads/package.json:41-46` |
| D-P7 | `<media-ads>` 편성 fetch는 `mode: 'same-origin'`이 없고 수집 POST에는 있다. 실제로는 서버 Origin 검사로 같은 출처가 강제된다 | `X/html/element.ts:262`, `X/dom/tracking.ts` |
| D-P8 | `DOC/cdn.mdx:28-33` 번들 표에 `video-scaffold.js`가 없지만 `CDN/src/video-scaffold.ts`가 있고 스킨 문서는 scaffold를 공개 스킨으로 적는다 | `DOC/skins.mdx:18` |

## 7. 이번 조사에서 실행한 것과 하지 않은 것

- 실행: 파일 읽기(`sed`, `cat`), `grep`, `ls`, `git status`. 읽기 전용 하위 조사 3개(광고 요소·컨트롤러 옵션, 스킨·테마 CSS, 설치·그누보드)를 돌리고 핵심 줄을 직접 대조했다.
- 하지 않음: 빌드, 테스트, 서버, 브라우저, DB, 그누보드 원본 소스·`/private/tmp/ads-qa-*` 읽기, 이 파일 외 수정, Git commit/push.
