# 광고 플레이어 커스터마이징 기능 명세 (A2 초안)

- 작성: 2026-10-21. 사용자 인터뷰 6회차의 결정과 현재 코드 조사를 근거로 쓴다.
- 범위: 광고 관리자(솔애드)의 플레이어 메뉴에서 운영자와 개발자가 설정하는 플레이어 테마, 컨트롤, 재생 동작, 언어, 로고, 광고 화면. 그리고 이 설정을 사이트에 적용하는 설치 방식.
- 성격: `.agents/plans/`의 임시 구현 메모다. 병합 전에 지우거나, 사용자가 요청하면 `internal/design/`의 기록으로 옮긴다.
- 표기:
  - **결정**은 사용자가 고른 것이다.
  - **제안**은 결정을 구현하려고 오케스트레이터가 정한 기본안이며, 확인이 필요하다.
  - **확인 필요**는 코드로 증명하지 못한 것이다.

## 1. 인터뷰 결정 요약

| # | 주제 | 결정 |
| --- | --- | --- |
| 1 | 누가 설정하나 | 운영자는 프리셋을, 개발자는 고급 설정을 맡는다 |
| 2 | 적용 방식 | 런타임에 프리셋을 받아 적용한다. 설치 코드를 다시 붙이지 않는다 |
| 3 | 확장 범위 | 테마, 컨트롤 구성, 재생 동작, 광고 화면 |
| 4 | 연결 단위 | 사이트 전체에 하나 |
| 5 | 프리셋 수 | 여러 개를 만들 수 있고, 그중 하나만 사이트에 적용한다 |
| 6 | 컨트롤 방식 | 광고 전용 스킨을 만든다(스킨 소스 복사, 버튼별 켜기·끄기) |
| 7 | 언어 | 프리셋 언어 하나로 플레이어와 광고 문구를 맞춘다. 비우면 페이지 `lang`을 따른다 |
| 8 | 재생 동작 | 자동재생, 음소거 시작, 포스터·제목 표시, 반복, 미리 불러오기, 단축키 끄기, 제스처 끄기 |
| 9 | 켜기·끄기 컨트롤 | 설정 메뉴 항목, PiP·전체화면, 탐색 보조. 재생·음량·시간 막대는 항상 보인다 |
| 10 | 테마 확장 | 로고·워터마크만 더한다. 컨트롤 크기, 아이콘 세트, 사용자 CSS는 하지 않는다 |
| 11 | 설치 코드 | 자리 요소 + 로더 스크립트 한 줄 |
| 12 | 개발자 설정 | `data-*` 속성으로 덮어쓰고, 더 많은 것은 JS API로 한다 |
| 13 | 광고 화면 | 광고 문구 전체 편집, 광고 진행 표시 |
| 14 | 로딩 실패 | 기본값으로 재생한다. 경고는 콘솔에만 남긴다 |
| 15 | 반영 방식 | 저장하면 바로 반영하고, 이력에서 되돌릴 수 있다. 이력은 A3에서 한다 |
| 16 | 캐스트·AirPlay | 광고 전용 스킨에서 뺀다 |
| 17 | 자동재생 + 프리롤 | 음소거로 광고부터 시작한다 |
| 18 | 포스터·제목 출처 | 설치 요소의 `data-poster`, `data-title`. 프리셋은 표시 여부만 정한다 |
| 19 | 로고 동작 | 위치(네 모서리), 여백, 크기, 투명도는 기본으로 있다. 광고 중 숨기기, 클릭 링크, 컨트롤과 함께 숨기기를 더한다 |
| 20 | 언어 범위 | 한국어, 영어, 일본어, 중국어 간체(`ko`, `en`, `ja`, `zh-CN`) |
| 21 | 스킨 바탕 | 기본 스킨(`video-skin`)을 복사한다. 프리셋의 스킨 선택은 없앤다 |
| 22 | 반영 지연 | 즉시. 플레이어가 뜰 때마다 서버에 확인한다(바뀌지 않았으면 304) |
| 23 | A2 범위 | 로더·재생 동작·언어, 광고 전용 스킨·컨트롤, 로고·광고 화면 확장. 변경 이력은 A3로 미룬다 |

### 1.1 디자인 검토 뒤 결정 (2026-10-21)

디자인 캔버스(6.6절)의 질문에 사용자가 답한 결정이다. 결정 7과 20은 결정 29로 범위가 바뀐다.

| # | 주제 | 결정 |
| --- | --- | --- |
| 24 | 시간 문구를 껐을 때 | 화면에서만 숨기고, 화면 읽기 프로그램용 시간 글자는 남긴다. 진행 막대는 장식이라 `aria-hidden`이다 |
| 25 | PiP | 기본 스킨의 동작만 구현한다. 좁은 폭에서 설정 메뉴로 옮기지 않는다 |
| 26 | 광고 색 이름 | "광고 음량 막대 색"을 "광고 강조색"으로 바꾼다. 광고 진행 막대도 이 색을 쓴다. 필드는 그대로 `ads.accentColor`다 |
| 27 | `native`로 바꿀 때 | 쓸 수 없는 값은 화면 입력에 남기고, 저장할 때 `null`로 보낸다. A1 규칙을 그대로 쓴다 |
| 28 | 열린 질문 기본안 | Q2, Q3, Q4, Q6, Q7과 로고 파일 한도(512KB, 1024px)를 7절 기본안대로 확정한다 |
| 29 | 광고 언어 | 광고는 한국어로만 한다. 광고 문구는 프리셋 언어와 관계없이 늘 한국어이고, `ja`·`zh-CN` 광고 문구는 만들지 않는다. 프리셋 언어(결정 7, 20)는 플레이어 화면에만 쓴다(**해석**: 플레이어 언어 네 개는 그대로 둔다) |
| 30 | 내장 프리셋 (2026-10-21) | 모양별 3개를 둔다: 기본(`default`, 지금과 같음), 둥근 테두리(모서리 12px), 강조색(강조색·광고 강조색 `#2563eb`, 강조 글자색 `#ffffff`) |
| 31 | 내장 프리셋 수정 | 서버 코드에 고정한다. 고치거나 지울 수 없고 복제해서 고친다. 20개 한도에 들지 않는다 |

A2-1 구현 계약(스키마 v2 필드·렌더·ETag·로더)은 `.agents/plans/ads-player-schema-v2.md`에 있다. 테두리 `#00000026`은 지금 색 형식에 담을 수 없어 A2-1에서는 비워 둔다(그 문서 5절).

## 2. 현재 코드에서 출발점

| 항목 | 지금 | 근거 |
| --- | --- | --- |
| 프리셋 스키마 | 스키마 v1의 필드는 `playerType`(`videojs`·`native`), `skin`(`default`·`neutral`), `theme` 7개, `ads`. `ads` 안에는 `locale`(`ko`·`en`), `labels` 3개, `accentColor`, `skipRadius`, `fontSize`, `timeouts`가 있다. 최대 20개 | `integrations/ads-manager/src/PlayerPresets.php:9-16,129-190` |
| 기본 프리셋 | `defaultPresetId`. 설치 코드 생성기와 재생 테스트에서 처음 선택되고, `player-preset`에 id가 없을 때 돌려준다. **사이트 전체에 자동 적용되지는 않는다**(R3-4) | `PlayerPresets.php:85-90`, 도움말 `player-default-preset` |
| 공개 렌더 | `player-preset`은 CSS 변수, 스킨 태그, 속성, `ui`, `timeouts`를 돌려준다. 캐시 헤더와 ETag는 없다 | `PlayerPresets.php:85-127` |
| 설치 코드 | 만든 시점의 값을 정적 마크업으로 낸다. `playsinline preload="metadata"`가 고정이다. 그누보드 자동 삽입은 "준비 중"이다 | `.agents/plans/ads-admin-player-facts.md` 1.3, 1.7 |
| 스킨 소스 | VJSC TSX(`packages/skins/src/skins/default/video/skin.tsx`)를 빌드해 정적 템플릿(`packages/html/src/internal/skins/default-video/template.ts`)을 만든다. 스킨에는 속성이 없고 `part=`도 없다 | 템플릿 머리 주석 |
| 기본 스킨 구성 | 재생, 음소거·음량, 시간, 시간 막대(썸네일 미리보기·챕터 포함), 자막 버튼, 설정 메뉴(화질, 오디오 트랙, 재생 속도, 자막), 캐스트, AirPlay, PiP, 전체화면, 제목, 포스터, 오류 대화상자. 단축키 17개와 제스처 5개가 들어 있다. ±초 건너뛰기 버튼은 없다 | `template.ts:116-366` |
| 끌 수 있는 단위 | `<media-hotkey>`와 `<media-gesture>`에 `disabled` 속성이 있다. `<media-seek-button>`에는 `seconds`가 있다 | `packages/html/src/ui/hotkey/element.ts:17`, `gesture/element.ts:24`, `seek-button/element.ts:15` |
| 재생 속도 목록 | 상수 `[0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2]` | `packages/core/src/dom/store/features/playback-rate.ts:7` |
| 플레이어 언어 | `<media-i18n lang>`으로 감싸야 바뀐다. 플레이어 로케일은 53개다(`ko`, `ja`, `zh-CN` 포함). 지금 설치 코드에는 이 감싸기가 없어 늘 영어다 | `packages/html/src/i18n/provider-element.ts:10`, `packages/core/src/core/i18n/locales/` |
| 광고 문구 | `AdsLabels`는 17개 키이고, 기본 문구는 `ko`와 `en`만 있다. `ko`로 시작하면 한국어, 그 밖은 영어다. 프리셋에서 바꿀 수 있는 것은 3개다(`mediaAlt`는 일부러 뺐다) | facts 2.3, `packages/extensions/ads/src/dom/ui.ts` |
| 광고 진행 | 상태 배지에 `광고 {index}/{count}`가 늘 보인다. 시간 문구는 `part="timer"`다. 진행 막대는 없다 | `packages/extensions/ads/src/dom/overlay.ts:139-141,232-239` |
| 광고 음소거 | 광고 소재는 본편의 `muted`를 따른다. 재생이 거부되면 `blocked` 상태가 되어 "재생 버튼을 눌러 계속하세요"를 보인다 | `controller.ts:416,585,594` |
| 광고 이벤트 | `ads-event`(start, complete, skip, click, cancel, error)가 `bubbles`·`composed`로 나간다 | `packages/extensions/ads/src/html/element.ts:312`, `core/events.ts:34-35` |
| 같은 출처 | API는 다른 출처 요청을 403으로 막고 CORS 헤더가 없다. 설치 코드는 매니저와 같은 출처 페이지에서만 동작한다 | facts 1.5 |

## 3. 설치 방식: 자리 요소 + 로더

### 3.1 설치 코드

```html
<div data-solad-player
     data-video-id="notice:12:main"
     data-src="/media/intro.mp4"
     data-poster="/media/intro.jpg"
     data-title="회사 소개 영상"></div>
<script type="module" src="/ads/player/loader.js"></script>
```

- 로더 한 줄은 페이지에 한 번만 넣는다. 자리 요소는 여러 개 둘 수 있다.
- 로더는 페이지의 `[data-solad-player]`를 모두 찾아 플레이어를 만든다. 나중에 DOM에 들어온 요소도 `MutationObserver`로 잡는다(**제안**).
- 영상마다 필요한 값은 `data-video-id`와 `data-src`다. 포스터와 제목은 영상마다 있는 데이터라서 프리셋이 아니라 자리 요소에 둔다(결정 18).
- 그누보드에서는 게시글 제목과 첨부 이미지로 `data-title`과 `data-poster`를 채울 수 있다. 다만 게시물 본문이나 스킨에 넣는 경로는 아직 확인하지 못했다(U-P3, 7절 Q1).
- 이전 정적 설치 코드는 계속 동작한다. 관리자 "초기 설정 방법"에서는 "이전 방식"으로 접어 두고, 새 방식을 기본으로 보인다.

### 3.2 로더 동작

1. **프리셋 받기:** 페이지에서 한 번만 `GET {api}?action=player-preset`을 보낸다. id 없이 보내므로 사이트 적용 프리셋이 온다. 자리 요소마다 따로 요청하지 않는다.
2. **검증:** 받은 값을 `preset.js`의 `readPresetRender`와 같은 검증기(스키마 v2)로 다시 확인한다.
3. **값 합치기:** 우선순위는 JS API 옵션 > `data-*` 속성 > 프리셋 > 내장 기본값이다.
4. **요소 만들기:**
   - `videojs` 종류: `<media-i18n lang>` > `<video-player content-title>` > `<solad-video-skin>` > `<video>` 또는 `<hls-video>`·`<hlsjs-video>`, 그리고 `<media-ads>`.
   - `native` 종류: 컨테이너 > `<video controls>`, 그리고 `createAdsController`.
5. **필요한 모듈만 불러오기:** 스킨 CSS·JS, HLS면 미디어 모듈, `ads.js`, 프리셋 언어의 플레이어 로케일. 광고는 `<media-ads lang="ko">`(기본 video는 `ui.locale: 'ko'`)로 늘 한국어다(결정 29).
6. **알리기:** 자리 요소에 `solad-ready` 이벤트를 보낸다. 광고 이벤트(`ads-event`)는 그대로 버블된다.

### 3.3 반영과 캐시 (결정 15, 22)

- `player-preset` 응답에 다음 헤더를 단다.
  - `Cache-Control: no-cache`
  - `ETag: "<revision>-<presetId>"`
- `If-None-Match`가 맞으면 304를 돌려준다. 로더는 기본 `fetch`를 쓰고, 재검증은 브라우저가 한다.
- 저장하면 다음 페이지 로드부터 반영된다. 이미 재생 중인 플레이어는 바꾸지 않는다.
- 사이트 적용 프리셋을 바꾸거나 삭제해도 `revision`이 오르므로 ETag가 바뀐다.

### 3.4 실패 처리 (결정 14)

| 경우 | 동작 |
| --- | --- |
| 네트워크 오류, 5xx, 시간 초과(**제안 3초**) | 내장 기본값(광고 전용 스킨, 기본 테마, 기본 동작, 페이지 `lang`)으로 재생한다. 영상과 광고는 그대로 나온다 |
| 사이트 적용 프리셋이 삭제됨 | 서버가 `defaultPresetId`를 `default`로 되돌린다(현재 동작, `PlayerPresets.php:63-65`). 내장 프리셋이 온다 |
| 검증 실패(형식 오류, 양방향 제어 문자, `__proto__` 등) | 그 필드만 버리지 않고 프리셋 전체를 버린 뒤 기본값으로 재생한다(**제안**. 일부만 적용하면 섞인 화면이 된다) |
| `data-video-id`나 `data-src`가 없음 | 그 자리 요소만 건너뛴다. 콘솔 경고를 남기고 `solad-error`를 보낸다 |

- 모든 경우에 방문자 화면에는 오류를 보이지 않는다. 콘솔에 `console.warn('[solad] …')`를 한 번 남긴다.

### 3.5 같은 출처

- 로더, API, 플레이어 자산은 매니저가 설치된 출처(`/ads/`)에서만 동작한다(facts 1.5). 다른 도메인에 붙이는 기능은 A2 범위가 아니다.
- 관리자 안내에 "매니저와 같은 사이트의 페이지에서만 동작해요"를 그대로 둔다.

## 4. 개발자 설정 (결정 12)

### 4.1 `data-*` 속성

자리 요소에서 프리셋 값을 덮어쓸 수 있는 항목만 둔다. 테마, 컨트롤, 로고처럼 보이는 모습은 운영자 몫이라 속성으로 열지 않는다(**제안**).

| 속성 | 값 | 덮어쓰는 것 |
| --- | --- | --- |
| `data-video-id` | 문자열(facts 1.4 규칙) | 필수 |
| `data-src` | `/경로` 또는 `http(s)://`. `.m3u8`이면 HLS | 필수 |
| `data-poster` | URL | 포스터 이미지(표시 여부는 프리셋) |
| `data-title` | 문자열 | 제목(표시 여부는 프리셋) |
| `data-autoplay` | `true`·`false` | `playback.autoplay` |
| `data-muted` | `true`·`false` | `playback.muted` |
| `data-loop` | `true`·`false` | `playback.loop` |
| `data-preload` | `none`·`metadata`·`auto` | `playback.preload` |
| `data-lang` | `ko`·`en`·`ja`·`zh-CN` | `language`(플레이어 화면만. 광고는 한국어) |
| `data-engine` | `spf`·`hlsjs` | HLS 엔진(지금 예제의 `engine`과 같다) |
| `data-preset` | 프리셋 id | 사이트 적용 프리셋 대신 쓸 프리셋. 재생 테스트와 예외 페이지용이다. 관리자 화면에서는 안내하지 않는다(결정 28) |
| `data-solad-manual` | 있음 | 자동으로 만들지 않는다. JS API로만 만든다 |

- 잘못된 속성 값은 무시하고 프리셋 값을 쓴다. 콘솔에 경고를 남긴다.

### 4.2 JS API

```js
import { mount } from '/ads/player/loader.js';

const handle = await mount(element, {
  videoId: 'notice:12:main',
  src: '/media/intro.mp4',
  poster: '/media/intro.jpg',
  title: '회사 소개 영상',
  preset: 'p_ab12',          // 선택. 없으면 사이트 적용 프리셋
  overrides: { playback: { autoplay: true } }, // 스키마 v2의 부분 객체. 같은 검증을 거친다
  onEvent(event) {},         // ads-event의 detail
  onError(error) {},         // 프리셋 대체, 바인딩 오류
});

handle.player; // <video-player> 또는 <video>
handle.destroy();
```

- `overrides`는 스키마 v2의 어떤 필드든 받는다. 검증에 실패한 필드가 있으면 `overrides` 전체를 버리고 `onError`로 알린다.
- 같은 요소에 `mount`를 두 번 부르면 먼저 만든 것을 정리하고 다시 만든다.
- 공개 범위: 로더와 API는 `integrations/ads-manager`의 제품 코드다. Video.js 패키지의 공개 API가 아니다.

## 5. 프리셋 스키마 v2

v1 필드는 그대로 두고 `skin`만 뺀다. 새 필드는 모두 비울 수 있으며, 비우면(`null`) 내장 기본값을 쓴다. 이 규칙은 v1과 같다.

| 경로 | 형식 | 기본 | 비고 |
| --- | --- | --- | --- |
| `language` | `ko`·`en`·`ja`·`zh-CN`·`null` | `null` = 페이지 `lang` | v1의 `ads.locale`을 대신한다. 플레이어 화면에만 쓴다. 광고 문구는 늘 한국어다(결정 29) |
| `playback.autoplay` | bool | false | 켜면 음소거 시작이 강제로 켜진다(결정 17). 화면에서 음소거 칸을 잠그고 이유를 보인다 |
| `playback.muted` | bool | false | |
| `playback.loop` | bool | false | 켜면 "포스트롤은 재생되지 않아요"를 보인다. 미드롤은 첫 회만(결정 28, 7절 Q3) |
| `playback.preload` | `none`·`metadata`·`auto` | `metadata` | 지금 고정값과 같다 |
| `display.poster` | bool | true | `data-poster`가 없으면 효과 없음 |
| `display.title` | bool | true | `data-title`이 없으면 효과 없음 |
| `input.hotkeys` | bool | true | 끄면 스킨의 `<media-hotkey>` 전체에 `disabled` |
| `input.gestures` | bool | true | 끄면 `<media-gesture>` 전체에 `disabled` |
| `controls.captions` | bool | true | 자막 버튼, 설정의 자막 항목, `c` 단축키 |
| `controls.quality` | bool | true | 설정의 화질 항목 |
| `controls.audioTrack` | bool | true | 설정의 오디오 트랙 항목 |
| `controls.playbackRate` | bool | true | 설정의 재생 속도 항목. 목록은 상수 그대로 둔다 |
| `controls.pip` | bool | true | PiP 버튼과 `i` 단축키 |
| `controls.fullscreen` | bool | true | 전체화면 버튼, `f` 단축키, 가운데 두 번 탭 |
| `controls.seekButtons` | `null`·5·10·15·30 | `null` = 숨김 | 새로 넣는 ±초 버튼. 두 번 탭 탐색 폭도 같은 값으로 맞춘다(**제안**) |
| `controls.thumbnails` | bool | true | 시간 막대 썸네일 미리보기. `data-thumbnails`(VTT URL)가 있을 때만 보인다(결정 28) |
| `logo.assetId` | 문자열·`null` | `null` = 로고 없음 | 업로드한 이미지 |
| `logo.position` | `top-left`·`top-right`·`bottom-left`·`bottom-right` | `top-right` | |
| `logo.margin` | 0–48 px | 12 | |
| `logo.width` | 24–240 px | 80 | 높이는 비율을 유지한다 |
| `logo.opacity` | 10–100 % | 80 | |
| `logo.href` | `http(s)://` URL·`null` | `null` | 새 창, `rel="noopener noreferrer"`. 접근 가능한 이름은 `logo.alt` |
| `logo.alt` | 1–80자 | 없음 | 링크가 있으면 필수. 4.1절 문자열 검증 기준을 따른다 |
| `logo.hideDuringAds` | bool | true | |
| `logo.hideWithControls` | bool | false | 컨트롤 숨김 상태를 읽는 방법은 구현 때 확인한다(7절 Q6) |
| `ads.labels.*` | 문자열·`null` | 한국어 기본 문구 | 16개 키. `mediaAlt`는 계속 뺀다. 자리표시자 규칙은 v1과 같다 |
| `ads.progress.sequence` | bool | true | `광고 {index}/{count}` |
| `ads.progress.timer` | bool | true | 시간 문구. 끄면 화면에서만 숨기고 화면 읽기용 글자는 남는다(결정 24) |
| `ads.progress.bar` | bool | false | 새로 넣는 광고 진행 막대. 색은 `ads.accentColor`(결정 26) |

- **`native` 종류:** `controls`, `input`, `logo`, `display.title`은 쓸 수 없다. 브라우저 기본 컨트롤이기 때문이다. 이 필드에 값이 있으면 지금처럼 422를 돌려준다.
- **v1 → v2 이전:** 읽을 때 바꾸고, 다음에 저장할 때 v2로 쓴다(지금 `mediaAlt` 처리와 같은 방식, `PlayerPresets.php:201-203`).
  - `ads.locale`은 `language`로 옮긴다. 이제 플레이어 언어만 정하므로, `ads.locale: en`이던 프리셋도 광고 문구는 한국어가 된다(결정 29).
  - `skin: neutral`은 `theme.borderRadius`가 비어 있으면 12로, `theme.borderColor`가 비어 있으면 `#00000026`으로 채운다. 모양을 대략 유지하기 위한 처리다(결정 28). 이전된 프리셋이 있으면 목록에 "모양이 조금 달라질 수 있어요" 안내를 한 번 보인다.
  - `skin` 필드는 버린다.
- `player-preset` 공개 렌더에도 새 필드를 같은 순서로 더한다. 공개 렌더에는 지금처럼 관리자용 이름을 넣지 않는다. 로고는 공개 URL로 바꿔서 준다.

## 6. 구현 단위

### 6.1 광고 전용 스킨 `solad-video-skin` (결정 6, 9, 16, 21)

- **복사 원본:** `packages/skins/src/skins/default/video/`와 이것이 쓰는 `shared/video/**`. 복사한 파일 머리에 원본 커밋 해시를 적는다.
- **바꾸는 것:**
  1. 캐스트와 AirPlay 버튼을 뺀다.
  2. ±초 건너뛰기 버튼(`<media-seek-button>`)을 컨트롤 막대에 더한다.
  3. 켜기·끄기 대상마다 호스트 속성(예: `no-pip`)을 받는다. 이 속성은 그림자 트리 CSS에서 숨김으로 바뀌고, 관련 단축키와 제스처에는 `disabled`로 이어진다.
  4. 로고 자리를 둔다.
  5. PiP는 기본 스킨의 동작을 그대로 둔다(결정 25).
  6. 재생 속도 항목을 끄면 `<`·`>` 단축키도 끈다. 설정 메뉴 항목이 모두 꺼지면 설정 버튼을 숨긴다. ±초 버튼을 켜면 두 번 탭 탐색 폭도 같은 값으로 맞춘다(**제안**, 디자인 캔버스).
- **위치:** **제안**은 `integrations/ads-manager/player/skin/`이다. 제품 전용 스킨이라 `packages/skins`에 넣지 않는다. 다만 VJSC 빌드(`packages/skins/build/packages/html.ts`)를 저장소 밖 경로로 돌릴 수 있는지는 확인해야 한다(7절 Q5). 안 되면 빌드된 템플릿을 복사해 손으로 고치는 방식을 쓴다. 이 경우 원본 동기화 비용을 따로 적는다.
- **원본 동기화:** Video.js를 올릴 때마다 원본 커밋과 현재 원본의 차이를 본다. `maintain-vjsc-skin-gaps` 스킬의 절차를 참고한다.
- **기존 프리셋:** 스킨 선택을 없애므로, 모든 `videojs` 프리셋이 이 스킨을 쓴다.

### 6.2 로더 (3절, 4절)

- 파일 `integrations/ads-manager/public/player/loader.js`. 빌드 산출물로 만들지 손으로 쓸지는 구현 단계에서 정한다.
- `public/examples/preset.js`의 검증·적용 코드를 로더로 옮기고, 예제는 로더를 쓰게 바꾼다.

### 6.3 광고 패키지 변경 (`packages/extensions/ads`, 모두 `@internal`)

| 변경 | 내용 |
| --- | --- |
| 로케일 | 바꾸지 않는다. 광고는 한국어로만 하므로(결정 29) 로더가 `lang="ko"`를 준다. `ja`·`zh-CN` 광고 문구는 더하지 않는다 |
| 문구 전달 | `<media-ads>`에 `labels` 프로퍼티(객체)를 더한다. 지금 속성으로 받는 3개는 그대로 둔다 |
| 진행 표시 | `ui.display = { sequence, timer, bar }`와 같은 이름의 속성을 더한다. 진행 막대는 `part="progress"`인 새 요소이고 `aria-hidden`이다. 시간 정보는 이미 시간 문구가 전한다 |

### 6.4 관리자 API (`integrations/ads-manager/src`)

- `PlayerPresets` 스키마 v2: 검증, 이전, 렌더를 v2로 바꾼다. 제한 20개는 그대로 둔다.
- `player-preset`에 ETag와 304를 더한다(3.3절).
- 로고 업로드:
  - 관리자 전용이고 CSRF를 거친다.
  - 형식은 PNG, JPEG, WebP. SVG는 받지 않는다(스크립트 위험).
  - 크기는 최대 512KB, 가로·세로 최대 1024px(**제안**).
  - 소재 업로드와 같은 저장소 규칙을 쓰고, 공개 경로로 내보낸다.
- "사이트 적용" 의미 변경: `defaultPresetId`가 로더의 사이트 적용 프리셋이 된다. 이름은 바꾸지 않는다(스키마 호환).

### 6.5 관리자 UI (`integrations/ads-manager/ui`)

- **프리셋 목록:** "기본" 배지를 "사이트 적용"으로 바꾼다. "기본으로 지정" 동작은 "사이트에 적용"으로 바꾸고, 확인 Dialog를 띄운다(사이트 전체가 바뀌기 때문이다).
- **프리셋 편집:** 구획은 기본, 테마, 로고, 컨트롤, 재생 동작, 언어, 광고 화면 순서다.
  - 스킨 선택 칸을 뺀다.
  - `native`에서 쓸 수 없는 구획은 비활성으로 보이고 이유를 적는다. 입력한 값은 화면에 남기고 저장할 때 `null`로 보낸다(결정 27).
  - 언어 구획 안내: "플레이어 화면 언어예요. 광고 문구는 늘 한국어로 나와요."
  - "광고 음량 막대 색" 칸 이름을 "광고 강조색"으로 바꾼다(결정 26).
  - 광고 문구 칸의 흐린 기본 문구는 늘 한국어다.
- **미리보기:** ThemePreview에 컨트롤 켜기·끄기, 로고, 광고 진행 표시를 반영한다. 지면 편성 미리보기는 프리셋을 쓰지 않는다는 규칙(R3-5)을 지금처럼 유지한다.
- **초기 설정 방법:** 새 설치 코드(3.1절)를 기본으로 보인다. 이전 정적 코드는 접어 둔다. `data-*` 표와 JS API 예를 더한다.
- **옵션 설명:** 5절 표와 4.1절 표를 옮긴다.
- **도움말:**
  - 고칠 용어:
    - `player-default-preset`: "사이트에 자동 적용되지 않는다"는 문장을 바꾼다.
    - `player-skin`: 스킨 선택이 사라지고 광고 전용 스킨 하나가 된다.
    - `player-ad-language`: 프리셋 언어는 플레이어 화면에만 쓰고 네 언어를 고를 수 있다. 광고 문구는 늘 한국어다(결정 29).
    - `player-install-snippet`: 자리 요소와 로더 방식으로 바뀐다.
  - 더할 용어: 로더, 자리 요소, 사이트 적용 프리셋, 로고, 광고 진행 표시.
  - 근거표는 `.agents/plans/ads-admin-help-facts.md`를 고친다.
- **"준비 중":** 변경 이력(A3)과 그누보드 자동 삽입만 남긴다.

### 6.6 디자인 시스템 (`design/`)

- 디자인 캔버스: "A2 플레이어 설정 디자인" https://claude.ai/artifact/MnQQakBwfjF4SHASB1EChB (비공개, A2-DESIGN-1). 아트보드 16개: 프리셋 목록과 사이트 적용 확인, 편집기 1280·768·390·기본 video, 구획 C–G, 테마 미리보기, 플레이어 화면, 초기 설정 방법, 도움말 모션 스토리보드, 부품 시트.
- 새 부품: `SectionNav`(구획 이동), `DisabledReason`(쓸 수 없는 이유), `SwitchList`(스위치와 설명, 함께 꺼지는 단축키), `Segmented`(값이 몇 개뿐인 라디오 묶음), `CornerPicker`(로고 네 모서리), `LogoUpload`, 단위 붙은 숫자 칸(`Input` 변형), `LabelField`(되돌리기 붙은 문구 칸), `PlayerMock`(미리보기·도움말용 플레이어 그림), `Storyboard`(도움말 움직임), `Disclosure`(접기 칸).
- 바뀌는 부품: 배지("사이트 적용", "옮김"), 프리셋 표(스킨 열 대신 사이트 적용 열), 확인 Dialog, 한 번만 보이는 안내(`Note`), 저장 막대(390에서 버튼 꽉 참), `ThemePreview`(장면 고르기, 컨트롤·로고·진행 표시 반영), `ColorField` 이름("광고 강조색").
- 플레이어 쪽(`design/` 밖): ±초 버튼, 로고 자리, 광고 진행 막대(높이 3px, `ads.accentColor`. **제안**)는 광고 전용 스킨과 광고 패키지 CSS에서 만든다.
- 바뀌는 부품은 A1 화면이 그대로 보이도록 새 클래스나 변형으로 더한다. 화면에 쓰는 일은 A2 화면 작업에서 한다.

## 7. 확인 필요와 열린 질문

| # | 질문 | 왜 | 기본안 |
| --- | --- | --- | --- |
| Q1 | 그누보드 게시물이나 게시판 스킨에 자리 요소와 `<script type="module">`을 넣을 수 있나 | 그누보드 본문 HTML 필터를 확인하지 않았다(U-P3) | A2에서는 "준비 중"으로 둔다. 실제 그누보드 설치 검증을 따로 잡는다 |
| Q2 | 자리 요소의 `data-preset`을 허용할까 | 결정 4(사이트에 하나)와 부딪힐 수 있다 | **확정(결정 28):** 허용한다. 관리자 화면에서는 안내하지 않고, 재생 테스트와 개발자만 쓴다 |
| Q3 | 반복 재생과 광고는 어떻게 함께 동작하나 | `loop`이면 브라우저가 `ended`를 보내지 않으므로 포스트롤이 나오지 않을 것이다(추론). 미드롤이 반복될지도 확인하지 않았다 | **확정(결정 28):** 반복을 켜면 화면에 "포스트롤은 재생되지 않아요"를 보인다. 미드롤은 첫 회만 나오게 하고 테스트로 확인한다 |
| Q4 | 썸네일 미리보기의 데이터는 어디서 오나 | 썸네일 트랙(VTT)이 영상마다 따로 있어야 한다 | **확정(결정 28):** `data-thumbnails`(VTT URL) 속성을 더한다. 없으면 숨긴다 |
| Q5 | VJSC 스킨 빌드를 `integrations/` 경로로 돌릴 수 있나 | 6.1절 위치 결정에 필요하다 | `ads-source-analyst`에 조사를 맡긴다 |
| Q6 | "컨트롤과 함께 숨기기"가 읽을 컨트롤 표시 상태가 스킨에 있나 | 스킨의 컨트롤 숨김 상태가 호스트에서 보이는지 확인하지 않았다 | **기능은 확정(결정 28), 기본 끔.** 복사한 스킨 안에 로고를 두면 같은 상태를 쓸 수 있다. 방법은 구현 때 확인한다 |
| Q7 | `neutral` 프리셋은 어떻게 이전하나 | 스킨 선택을 없애기 때문이다 | **확정(결정 28):** 모서리 12, 테두리 `#00000026`. 이전할 때 목록에 "모양이 조금 달라질 수 있어요" 안내를 한 번 보인다 |
| Q8 | 프리셋 로딩 시간 제한 | 길면 재생이 늦어지고, 짧으면 느린 망에서 기본값으로 떨어진다 | 3초 |
| Q9 | 일본어·중국어 광고 문구 검수는 누가 하나 | 기계 번역만으로는 부족하다 | **해당 없음(결정 29):** 광고는 한국어로만 한다. 플레이어 화면 문구는 Video.js의 기존 로케일을 쓴다 |

## 8. 단계

| 단계 | 내용 | 먼저 할 것 |
| --- | --- | --- |
| A2-1 | 스키마 v2, `player-preset` ETag·304, 로더(자리 요소, 값 합치기, 실패 처리, 언어), 재생 동작, `data-*`·JS API, 예제 전환 | 다른 묶음이 모두 이 위에 선다 |
| A2-2 | 광고 전용 스킨(복사, 캐스트·AirPlay 제거, 켜기·끄기, ±초 버튼), 스킨 선택 제거와 이전 | Q5 조사 결과가 먼저다 |
| A2-3 | 로고(업로드, 위치, 링크, 숨김), 광고 문구 16개(한국어), 광고 진행 표시 | 디자인 시스템 산출물과 함께 간다 |
| A3 | 변경 이력과 되돌리기, 그누보드 자동 삽입(Q1 확인 뒤) | |
| 하지 않음 | 컨트롤 크기·간격, 아이콘 세트, 사용자 CSS, 영상 목록 관리, 캐스트·AirPlay, 다른 출처 설치, 재생 속도 목록 편집 | 인터뷰에서 고르지 않았다 |

- 병렬화: A2-1의 스키마와 로더가 정해지면 A2-2와 A2-3을 함께 진행할 수 있다.
- 에이전트 배정 초안:
  - ads-admin-api: 스키마 v2, ETag, 로고 업로드
  - ads-implementer: 로더, 스킨, 광고 패키지
  - ads-admin-ui: 화면
  - ads-admin-designer: 디자인 시스템과 도움말
  - ads-source-analyst: Q5, 그리고 Q3·Q6 구현 확인
  - ads-qa: 인수

## 9. 인수 기준 (초안)

1. 설치 코드 두 줄을 같은 출처의 빈 HTML에 붙이면, 사이트 적용 프리셋의 테마·컨트롤·로고·언어로 재생되고 광고가 나온다.
2. 관리자에서 사이트 적용 프리셋의 강조색을 저장한 뒤 페이지를 새로고침하면 바뀐 색이 보인다. 바뀌지 않은 상태에서 새로고침하면 `player-preset` 응답이 304다.
3. API를 멈추거나 `player-preset`이 500을 돌려주면, 기본값으로 재생되고 광고도 나온다. 콘솔 경고는 한 번이다.
4. 자동재생을 켠 프리셋에서 프리롤은 음소거로 자동 시작한다. 브라우저가 막으면 재생 버튼이 보인다.
5. 컨트롤을 끄면 그 버튼, 관련 단축키, 관련 제스처가 모두 동작하지 않는다. 키보드 탐색 순서에도 남지 않는다.
6. `language: ja`이면 플레이어 문구는 일본어이고 광고 문구는 한국어다. 비우면 플레이어는 페이지 `lang`을 따르고, 네 언어 밖이면 영어다. 광고 문구는 어느 경우에도 한국어다.
7. 로고는 지정한 모서리에 보이고, 광고 중에는 숨는다. 링크가 있으면 새 창으로 열리고, 키보드로 갈 수 있으며, 이름이 읽힌다.
8. `data-autoplay="false"`가 프리셋의 자동재생을 이긴다. JS API `overrides`가 `data-*`를 이긴다.
9. 스키마 v1 문서를 가진 설치에서 업그레이드 뒤 목록·편집·렌더가 동작한다. 처음 저장할 때 v2로 바뀐다.
10. 기존 정적 설치 코드로 만든 페이지가 업그레이드 뒤에도 재생된다.
