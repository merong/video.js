# A2-1 플레이어 프리셋 스키마 v2·로더 계약

- 작성: 2026-10-21, 오케스트레이터. `.agents/plans/ads-player-customization-spec.md`(이하 명세)의 결정 1–31을 구현 단위로 고정한다. 명세와 이 문서가 다르면 이 문서를 따르고, 바꿀 때는 오케스트레이터에게 먼저 알린다.
- PHP(`src/PlayerPresets.php`), TS(`ui/src/player/preset.ts`), JS(`public/player/`의 검증기)가 이 표 하나를 따른다. v1 계약(`.agents/plans/ads-admin-app-contract.md` 4.1)의 문자열 검증, 오류 봉투, 저장 위치, 관리자 액션은 여기서 바꾸는 것 말고는 그대로다.
- 원칙(v1과 같음): 알 수 없는 키와 범위 밖 값은 422로 거부하고 조용히 고치지 않는다. `''`는 `null`이다. `null`은 "내장 기본값"이다.

## 1. 문서

- 저장: meta 키 `player_presets` 하나. v2 문서는 `{"schema": 2, "revision", "defaultPresetId", "presets": []}`이다. 테이블·DDL·DB 스키마 버전은 바꾸지 않는다.
- `schema` 키가 없으면 v1 문서다. 읽을 때 메모리에서만 v2로 바꾸고(2.3절), 읽기는 쓰지 않는다. 다음 쓰기(저장·삭제·사이트 적용)가 문서 전체를 v2로 쓴다.
- `GET player-presets` 응답에 `migratedNeutral: string[]`을 더한다. v1 문서에서 `skin: "neutral"`이던 저장 프리셋 id 목록이다. v2 문서면 늘 `[]`다. 화면은 비어 있지 않을 때 "모양이 조금 달라질 수 있어요" 안내를 보인다. 문서가 v2로 쓰이면 사라지므로 "한 번" 보인다.
- 저장 프리셋 한도 20개는 그대로다. 내장 프리셋은 세지 않는다.

## 2. 프리셋

### 2.1 필드

모든 그룹은 입력에서 생략할 수 있고, 생략하면 그 안의 값은 모두 `null`이다. 저장·목록·`preset` 응답은 늘 아래 순서의 전체 모양(값이 없으면 `null`)이다.

| 경로 | 허용 값 | `null`일 때 | `native` |
| --- | --- | --- | --- |
| `id` | 내장 `default`·`flat`·`rounded`·`accent`, 저장 `^p-[a-z0-9]{10}$` | — | — |
| `name` | v1과 같음 | 필수 | — |
| `playerType` | `videojs`·`native` | 필수 | — |
| `language` | `ko`·`en`·`ja`·`zh-CN` | 페이지 언어(4.4절) | 쓸 수 있음 |
| `theme.*` (7개) | v1과 같음. 단 `theme.borderColor`는 `#rrggbb` 또는 `#rrggbbaa`(A2-E) | 스킨 기본 | 값이 있으면 422(v1과 같음) |
| `playback.autoplay` | bool | false | 쓸 수 있음 |
| `playback.muted` | bool | false. `autoplay`가 true면 `false`는 422(`playback.muted`, "자동재생을 켜면 음소거로 시작해야 해요.") | 쓸 수 있음 |
| `playback.loop` | bool | false | 쓸 수 있음 |
| `playback.preload` | `none`·`metadata`·`auto` | `metadata` | 쓸 수 있음 |
| `display.poster` | bool | true | 쓸 수 있음 |
| `display.title` | bool | true | 값이 있으면 422 |
| `input.hotkeys`, `input.gestures` | bool | true | 값이 있으면 422 |
| `controls.captions`, `.quality`, `.audioTrack`, `.playbackRate`, `.pip`, `.fullscreen`, `.thumbnails` | bool | true | 값이 있으면 422 |
| `controls.seekButtons` | 정수 5·10·15·30 | 숨김 | 값이 있으면 422 |
| `logo.assetId` | **A2-1에서는 `null`만**. 값이 있으면 422("로고 업로드는 아직 준비 중이에요."). A2-3에서 업로드 id를 받는다 | 로고 없음 | 값이 있으면 422 |
| `logo.position` | `top-left`·`top-right`·`bottom-left`·`bottom-right` | `top-right` | 값이 있으면 422 |
| `logo.margin` | 정수 0–48 | 12 | 값이 있으면 422 |
| `logo.width` | 정수 24–240 | 80 | 값이 있으면 422 |
| `logo.opacity` | 정수 10–100 | 80 | 값이 있으면 422 |
| `logo.href` | `http://` 또는 `https://`로 시작하는 절대 URL, 2048자 이하, 공백·제어 문자 없음 | 링크 없음 | 값이 있으면 422 |
| `logo.alt` | `name`과 같은 문자열 규칙, 1–80자. `href`가 있으면 필수(422 `logo.alt`, "링크가 있으면 대체 텍스트를 입력해 주세요.") | 없음 | 값이 있으면 422 |
| `logo.hideDuringAds` | bool | true | 값이 있으면 422 |
| `logo.hideWithControls` | bool | false | 값이 있으면 422 |
| `ads.labels.*` (16개, 2.2절) | 0–40자, 라벨 문자열 규칙(v1과 같음), 자리표시자는 2.2절 것만 | 한국어 기본 문구 | 쓸 수 있음 |
| `ads.accentColor`, `ads.skipRadius`, `ads.fontSize` | v1과 같음. 화면 이름은 "광고 강조색"(결정 26) | v1과 같음 | 쓸 수 있음 |
| `ads.progress.sequence`, `ads.progress.timer` | bool | true | 쓸 수 있음 |
| `ads.progress.bar` | bool | false | 쓸 수 있음 |
| `ads.timeouts.*` | v1과 같음 | v1과 같음 | `videojs`면 값이 있으면 422(v1과 같음) |

- 순서: `id`, `name`, `playerType`, `language`, `theme`, `playback`, `display`, `input`, `controls`, `logo`, `ads`. `ads` 안은 `labels`, `accentColor`, `skipRadius`, `fontSize`, `progress`, `timeouts`.
- bool 자리에 `0`·`1`·`"true"`는 422다.
- 없어진 키: `skin`, `ads.locale`, `ads.labels.mediaAlt`는 입력에 오면 422("알 수 없는 항목입니다."). 저장된 v1 값은 2.3절로 읽는다.
- `native`에서 "값이 있으면 422"인 필드는 화면이 저장할 때 `null`로 보낸다(결정 27).

### 2.2 광고 문구 16개

`packages/extensions/ads/src/dom/ui.ts`의 `AdsLabels` 순서에서 `mediaAlt`만 뺀다.

| 키 | 자리표시자 |
| --- | --- |
| `advertisement`, `playPause`, `mute`, `volume`, `advertiser`, `newWindow`, `skip`, `loading`, `paused`, `blocked`, `enterFullscreen`, `exitFullscreen`, `fullscreenError` | 없음(`{`·`}` 금지) |
| `sequence` | `{index}` `{count}` |
| `skipCountdown` | `{seconds}` |
| `timer` | `{elapsed}` `{duration}` `{remaining}` |

- 순서: `advertisement`, `sequence`, `playPause`, `mute`, `volume`, `advertiser`, `newWindow`, `skip`, `skipCountdown`, `timer`, `loading`, `paused`, `blocked`, `enterFullscreen`, `exitFullscreen`, `fullscreenError`.
- 비운 문구의 기본값은 늘 한국어(`KO`)다(결정 29).

### 2.3 v1 → v2 읽기

저장 프리셋마다 다음을 한다. 문서가 v2로 쓰일 때 이 결과가 저장된다.

1. `ads.locale`(`ko`·`en`·`null`)을 `language`로 옮기고 지운다. 광고 문구는 이제 늘 한국어다(결정 29).
2. `skin`이 `neutral`이고 `theme.borderRadius`가 `null`이면 12로 채운다. `theme.borderColor`는 바꾸지 않는다(5절 참고). `skin`을 지운다.
3. `ads.labels.mediaAlt`를 지운다(지금 동작).
4. 새 그룹(`playback`, `display`, `input`, `controls`, `logo`, `ads.progress`)과 새 문구 13개는 `null`로 채운다.

### 2.4 내장 프리셋 (결정 30, 31)

서버 코드에 고정한다. 고치거나 지울 수 없고(400 `preset_builtin`), 사이트에 적용할 수 있으며, 화면에서 복제해 고친다. 목록 맨 앞에 이 순서로 온다. 모두 `playerType: "videojs"`, `builtIn: true`, `createdAt`·`updatedAt`은 `null`이다. 적지 않은 값은 모두 `null`이다.

| id | 이름 | 값 |
| --- | --- | --- |
| `default` | 기본 | 없음(지금과 같음) |
| `flat` | 플랫 | `theme.borderRadius: 0`, `theme.borderColor: "#00000000"` (A2-E) |
| `rounded` | 둥근 테두리 | `theme.borderRadius: 12` |
| `accent` | 강조색 | `theme.accentColor: "#2563eb"`, `theme.accentTextColor: "#ffffff"`, `ads.accentColor: "#2563eb"` |

- 사이트 적용 프리셋을 지우면 지금처럼 `default`로 돌아간다.
- `#2563eb`와 `#ffffff`의 대비는 5.2:1이다.

## 3. 공개 렌더 `GET player-preset[&id=]`

인증 없음. `id`가 없으면 사이트 적용 프리셋(`defaultPresetId`). `name`은 싣지 않는다. 없는 id는 404 `preset_not_found`. 기본값을 채운 "적용할 값"을 준다(2.1절의 `null`일 때 열).

```json
{
  "id": "accent", "revision": 7, "playerType": "videojs",
  "language": null,
  "playback": { "autoplay": false, "muted": false, "loop": false, "preload": "metadata" },
  "display": { "poster": true, "title": true },
  "input": { "hotkeys": true, "gestures": true },
  "controls": { "captions": true, "quality": true, "audioTrack": true, "playbackRate": true, "pip": true, "fullscreen": true, "thumbnails": true, "seekButtons": null },
  "logo": null,
  "progress": { "sequence": true, "timer": true, "bar": false },
  "labels": {},
  "skinTag": "video-skin",
  "styles": { "css": "video.css", "js": "video.js" },
  "css": { "--media-accent-color": "#2563eb", "--media-accent-text-color": "#ffffff", "--ads-accent-color": "#2563eb" },
  "attributes": { "lang": "ko" }
}
```

- `playback.muted`는 프리셋의 `muted`(비었으면 false)이고, `autoplay`로 바꾸지 않는다. "자동재생이면 음소거"는 로더와 이전 방식 설치 코드가 값을 합친 뒤에 적용한다(4.2절). 그래야 `data-autoplay="false"`가 자동재생을 끌 때 음소거도 함께 풀린다(2026-10-21 A2-1-FIX에서 바꿈).
- `labels`는 값이 있는 문구만 2.2절 순서로 싣는다.
- `css`는 v1과 같은 표와 순서다.
- **`videojs`:** `input`, `controls`, `logo`가 있다. `logo`는 A2-1에서 늘 `null`이다. A2-3에서 `{url, position, margin, width, opacity, href, alt, hideDuringAds, hideWithControls}`가 된다. `skinTag`은 A2-1에서 `video-skin`, 파일은 `video.css`·`video.js`다(A2-2에서 광고 전용 스킨으로 바뀐다). `attributes`는 `<media-ads>`에 넣을 HTML 속성이고 늘 `lang: "ko"`가 있다. v1의 `skip-label`, `skip-countdown-label`, `timer-label`도 값이 있으면 싣는다. `ui`·`timeouts` 키는 없다.
- **`native`:** `display`는 `{poster}`만 있다. `input`, `controls`, `logo`, `attributes` 키는 없다. `skinTag`·`styles`는 `null`이다. `ui`는 `{locale: "ko", labels?}`이고 `labels`는 위 `labels`와 같다. `timeouts`는 값이 있을 때만 싣는다(v1과 같음).
- `skin` 키는 없다.

### 3.1 캐시 (결정 15, 22)

- 이 액션만 `Cache-Control: no-cache`와 `ETag`를 단다. 다른 액션은 지금 공통 헤더 그대로다.
- `ETag`는 응답 `data`(위 JSON)를 JSON으로 만든 바이트의 sha256 앞 32자를 큰따옴표로 감싼 강한 태그다. 명세 3.3절의 `"<revision>-<presetId>"` 대신 이것을 쓴다. 이유: 매니저를 업그레이드해 렌더 모양이나 내장 프리셋 값이 바뀌어도 revision이 그대로면 옛 응답이 304로 살아남기 때문이다.
- `If-None-Match`가 `*`이거나 쉼표 목록 중 하나(`W/` 접두사는 떼고 비교)가 같으면 304와 `ETag`·`Cache-Control`만 보내고 본문은 없다.
- 404·4xx·5xx에는 `ETag`를 달지 않는다.

## 4. 로더 `public/player/loader.js`

- 설치 경로는 `/ads/player/loader.js`이고 파일은 `integrations/ads-manager/public/player/`다. 손으로 쓴 ES 모듈이고 빌드하지 않는다. API는 `new URL('../api/index.php', import.meta.url)`이고, 자산은 `../assets/videojs/`와 `../assets/ads.js`다. 같은 출처에서만 동작한다(명세 3.5절).
- `public/examples/preset.js`의 검증·적용 코드를 `public/player/` 아래로 옮긴다. 예제와 `player-preview`는 그것을 가져다 쓴다.

### 4.1 자동 만들기

- 모듈을 불러오면 `[data-solad-player]` 가운데 `data-solad-manual`이 없는 것을 모두 만든다. 그 뒤 DOM에 들어온 요소는 `MutationObserver`로 잡는다. 한 요소는 한 번만 만든다.
- 프리셋 요청은 페이지에서 프리셋 id(사이트 적용 프리셋은 id 없음)마다 한 번이다. 기본 `fetch`(`credentials: 'same-origin'`, `cache` 옵션 없음)를 써서 재검증은 브라우저가 한다.

### 4.2 값 합치기

- 우선순위: JS API `overrides` > `data-*` > 프리셋 렌더 > 내장 기본값(2.1절).
- 합친 뒤 `autoplay`가 true면 `muted`를 true로 둔다. `data-muted="false"`가 이것과 부딪히면 콘솔 경고를 남긴다.
- `data-*` 속성(명세 4.1절)과 `data-thumbnails`(VTT URL, 결정 28). 잘못된 값은 그 속성만 무시하고 경고를 남긴다.
- `overrides`는 2.1절 프리셋의 부분 객체(`id`·`name`·`playerType` 제외)이고 같은 검증을 거친다. 하나라도 틀리면 `overrides` 전체를 버리고 `onError`로 알린다.

### 4.3 요소

- `videojs`: `<media-i18n lang>` > `<video-player>` > 스킨(`skinTag`) > 미디어(`video`, `.m3u8`이면 `data-engine`에 따라 `hls-video`·`hlsjs-video`) + `<media-ads for src video-id ...attributes>`. 스킨에 `css`를 `setProperty`로 넣는다(v1과 같음).
- `native`: 컨테이너 > `<video controls>` + `createAdsController({ ui, timeouts, ... })`. 편성은 지금 예제처럼 받는다.
- 공통: `playsinline`은 늘 단다. `autoplay`·`muted`·`loop`·`preload`를 미디어에 둔다. `display.poster`가 true이고 `data-poster`가 있으면 포스터를 보인다. `display.title`이 true이고 `data-title`이 있으면 제목을 보인다. 둘 다 Video.js가 정한 방법을 쓰고, 그 방법은 코드로 확인해 보고에 근거를 적는다.
- A2-1에서 `input`·`controls`·`logo`·`progress`·`labels`(속성 3개 밖)는 렌더에서 읽고 검증만 하고 화면에는 아직 적용하지 않는다. A2-2와 A2-3이 적용한다.

### 4.4 언어

- 플레이어 언어 = 합친 `language` ?? 자리 요소부터 위로 찾은 `lang` ?? `document.documentElement.lang`.
- 이 값을 정리한다: `ko*` → `ko`, `en*` → `en`, `ja*` → `ja`, `zh`·`zh-CN`·`zh-SG`·`zh-Hans*` → `zh-CN`. 그 밖(`zh-TW`·`zh-HK`·`zh-Hant*` 포함)은 `en`이다. 대소문자는 가리지 않는다.
- 광고는 늘 한국어다. `<media-ads lang="ko">`이고, native는 `ui.locale: 'ko'`다(결정 29).

### 4.5 실패와 이벤트

| 경우 | 동작 |
| --- | --- |
| 네트워크 오류, 5xx, 3초 시간 초과, 렌더 검증 실패 | 프리셋 전체를 버리고 `default` 렌더(내장 기본값)로 만든다. 영상과 광고는 그대로 나온다. 페이지에서 `console.warn('[solad] …')` 한 번 |
| 404(`data-preset`의 id가 없음) | 위와 같다 |
| `data-video-id`·`data-src`가 없거나 틀림 | 그 요소만 건너뛴다. 경고를 남기고 요소에 `solad-error`(`detail: {code, message}`, code는 `missing_video_id`·`missing_src`·`invalid_src`)를 보낸다 |

- 만들기가 끝나면 자리 요소에 `solad-ready`(`detail: {player, presetId, fallback}`)를 보낸다. `fallback`은 내장 기본값으로 대체했는지다.
- 방문자 화면에는 오류를 보이지 않는다. `ads-event`는 지금처럼 버블된다.

### 4.6 JS API

```js
import { mount } from '/ads/player/loader.js';
const handle = await mount(element, { videoId, src, poster, title, thumbnails, preset, engine, overrides, onEvent, onError });
handle.player; // <video-player> 또는 <video>
handle.destroy();
```

- 같은 요소에 두 번 부르면 먼저 만든 것을 정리하고 다시 만든다.
- `destroy()`는 만든 요소, 광고 컨트롤러, 관찰자를 모두 정리한다.
- `onEvent`는 `ads-event`의 `detail`을, `onError`는 `{code, message}`를 받는다.

## 5. 남은 차이와 결정 기록

- **둥근 테두리 색:** 명세 결정 28과 사용자가 고른 내장 프리셋은 테두리 `#00000026`이다. 하지만 `theme.borderColor`는 `#rrggbb`만 받으므로 이 값을 담을 수 없다. A2-1에서는 테두리 색을 비워 기본 스킨 값(`#0000001a`, 10% 검정)을 쓴다. 15% 검정과 거의 같다. 사용자에게 보고했다. 투명도 있는 색이 꼭 필요하면 이 필드만 `#rrggbbaa`를 받도록 넓힌다. **A2-E에서 넓혔다**(`ads-a2e-spec.md` 1.3절). `rounded`는 그대로 비워 둔다.
- **ETag:** 3.1절처럼 내용 해시를 쓴다(명세 3.3절에서 바꿈).
- **Q3(반복과 광고):** 반복을 켜면 포스트롤은 나오지 않고, 미드롤은 첫 회만 나와야 한다. ads-implementer가 컨트롤러 동작을 코드와 테스트로 확인한다. 반복 때 미드롤이 다시 나오면 고치고 테스트를 더한다.
