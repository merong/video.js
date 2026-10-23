# LMS 플레이어 프리셋 사전 사실 정리 (TASK LMS-0-FACTS)

- 작성: ads-source-analyst, 2026-10-22, 읽기만 함(코드 수정, 빌드, 서버, 브라우저 실행 없음).
- 경로 약어: `P/` = `packages/`, `AM/` = `integrations/ads-manager/`, `SKIN/` = `P/html/src/internal/skins/default-video/`(생성된 기본 스킨: `template.ts`, `skin.css`, `register.ts`).
- 표시: ✔ = 작성자가 그 줄을 직접 다시 열어 확인함. 표시가 없는 줄은 하위 조사(읽기 전용)에서 인용한 행 번호이며, 행 번호가 한두 줄 어긋날 수 있음. "미확인" = 실행하거나 확인하지 않음.
- 이 문서는 사실만 적는다. 추천은 **제안**으로 따로 표시했다.
- **정책(사용자 결정, 2026-10-23):** LMS 플레이어는 별도 정책으로 만든다. 범용 기능과 충돌하면 LMS 전용 플레이어에서는 LMS 정책을 우선 적용하도록 커스텀 구현한다. 충돌 지점과 분리 지점은 §5에 정리했다.

## 0. 후보 기능별 결론

| 후보 기능 | 결론 | 근거 요약(자세한 내용은 해당 절) |
|---|---|---|
| 이어보기(마지막 위치) | 클라이언트 저장은 가능, 서버 저장은 조건부 가능 | 위치는 `store.state.currentTime`과 `seek()`으로 읽고 쓸 수 있음(§1.5). 서버 저장에는 학습자 식별, 새 액션, 새 테이블이 필요함(§2.3~2.5) |
| 진도율(시청 구간 합)과 완료 기준 | 가능 | 스토어에 `played`가 없어 네이티브 `video.played`나 자체 구간 기록을 써야 함. 광고 시간은 섞이지 않지만 광고 때 생기는 `pause`/`play`/`seeking` 이벤트는 걸러야 함(§1.5, §2.7) |
| 서버로 진도 보고(주기, 이탈 시) | 조건부 가능 | 새 공개 액션과 새 테이블이 필요함. 본문은 JSON만 받으므로 sendBeacon 기본형은 거부됨. 같은 출처만 허용하고, 레이트 리밋과 쓰기 잠금이 설치 전체에 걸림(§2.3, §2.5) |
| 앞으로 건너뛰기 제한 | 조건부 가능 | 공개된 seek 가드가 없음. `@internal` extension `mediaOverride`(광고 선례)와 `seeking` 되돌리기로 구현함. 슬라이더에 한계 지점 표시는 따로 그려야 함(§1.4) |
| 배속 선택과 상한 | 조건부 가능 | 메뉴는 있으나 목록 `DEFAULT_RATES`가 하드코딩이고 상한 장치가 없음. 로더는 `controls.playbackRate`를 적용하지 않음(§1.1, §2.2) |
| 챕터 목록과 타임라인 표시 | 타임라인은 가능, 목록은 직접 만들어야 함 | 슬라이더가 이미 `kind=chapters` 트랙으로 분할됨. 목록 UI는 없지만 `chaptersCues`를 읽어 만들 수 있음. 로더에 챕터 입력이 없음(§1.2, §1.3, §2.2) |
| 시간에 맞춰 바뀌는 슬라이드나 자료 | 가능 | 네이티브 `TextTrack`의 `cuechange`를 직접 구독함. 스토어는 cue 변화를 노출하지 않음(§1.2) |
| 스크립트 하이라이트와 눌러서 이동 | 가능 | 위와 같음. 앞으로 이동은 건너뛰기 제한 규칙을 따름 |
| 타임스탬프 메모·북마크 | UI는 가능, 서버 저장은 조건부 가능 | 이어보기와 같은 조건(식별, 액션, 테이블) |
| 영상 속 퀴즈 | 조건부 가능 | metadata cue로 시점을 잡고 오버레이를 띄울 수 있음. 컨트롤을 막는 방법은 광고 오버레이의 `inert` 방식이 선례(§1.6, §2.7) |
| 다음 차시 | 가능 | `ended` 이벤트와 오버레이로 구현함. 포스트롤 광고와의 순서는 미확인 |
| 탭을 벗어나면 일시정지 | 가능 | packages에 관련 로직이 없어 `visibilitychange`를 직접 듣고 처리함(§1.5) |
| 같은 학습자 중복 재생 막기 | 조건부 가능(완전히 새 기능) | 학습자 식별, 서버 상태, 하트비트가 모두 없음(§2.4, §2.5) |
| 옆·아래 패널(목차, 스크립트, 자료) | 조건부 가능 | 플레이어 컨테이너가 `overflow: clip`이라 패널은 플레이어 밖에 둬야 함. 그러면 내장 전체화면에서 패널이 보이지 않음(§1.6) |

## 1. Video.js 10 (packages, 읽기만)

### 1.1 배속

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 기본 video 스킨에는 배속 **버튼이 없음**. 설정(톱니) 메뉴 안 "Speed" 하위 메뉴에 `<media-playback-rate-radio-group>`이 있음 | `P/skins/src/skins/shared/video/menus/settings-menu.tsx:16`, `P/skins/src/components/menus/playback-rate-submenu.tsx:13-34`, `SKIN/template.ts:208-238` | 두 단계를 들어가야 배속을 고를 수 있음 |
| 목록은 `DEFAULT_RATES = [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2]` 상수 하나뿐. state `playbackRates`에 그대로 들어감 | ✔`P/core/src/dom/store/features/playback-rate.ts:7,12` | 기본 최대값은 2× |
| `setPlaybackRate`는 값을 검사하지 않고 `media.playbackRate = rate`를 그대로 넣음. 저장소 전체에서 상한이나 clamp 코드를 찾지 못함 | ✔`playback-rate.ts:14-18`, `P/media/src/dom/html-media-adapter/html-media-adapter.ts:263` | 상한을 강제하는 장치가 없음 |
| 라디오 그룹 요소의 속성은 `value`, `disabled`, JS 속성 `formatRate`뿐. `rates` 속성은 없음 | `P/html/src/ui/playback-rate-radio-group/element.ts:26-32` | HTML 속성으로 목록을 바꿀 수 없음 |
| `playbackRates`는 readonly이고 feature에 `config`가 없음. 원본 state가 바뀔 때마다 공개 state를 `replace`로 통째로 덮어씀 | `P/media/src/core/state.ts:235`, `P/store/src/core/store.ts:186-194` | 스토어 값을 바꾸는 우회도 다음 갱신 때 덮어써질 가능성이 큼(미확인) |
| 메뉴는 목록에 있는 값만 고를 수 있음(`includes`). 목록 밖 값이 들어오면 체크 표시가 없음 | `P/core/src/core/ui/playback-rate-radio-group/core.ts:99-123` | 외부 코드가 상한을 걸어도 메뉴에는 2×까지 보임 |
| 단축키 `>`=speedUp, `<`=speedDown. speedUp은 마지막 값(2×)에서 0.2×로 돌아가고, speedDown은 첫 값에서 2×로 감 | ✔`P/core/src/dom/media-actions.ts:88-108`, `SKIN/template.ts:352-355` | 강의 중 `>`를 반복해 누르면 2×에서 0.2×로 떨어짐 |
| CDN에 `ui/playback-rate-button.js`, `ui/playback-rate-radio-group.js`가 따로 있고 `AM/public/assets/videojs/ui/`에도 복사되어 있음. 기본 스킨 `register.ts`는 버튼을 import하지 않음 | ✔`ls P/cdn/ui`, ✔`ls AM/public/assets/videojs/ui`, `SKIN/register.ts:44` | 템플릿에 배속 버튼을 넣으려면 그 파일을 따로 import해야 함(seek 버튼과 같은 방식) |

### 1.2 텍스트 트랙(chapters, metadata, subtitles/captions)

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| textTrack state: `textTrackList`(id, kind, label, language, mode), `subtitlesShowing`, `toggleSubtitles()`, `selectSubtitlesTrack()`, `chaptersCues`, `thumbnailsTrack` | `P/core/src/dom/store/features/text-track.ts:74-131,158-164`, `P/media/src/core/state.ts:291-353` | 외부에서 읽을 수 있는 필드 |
| 챕터는 `kind==='chapters'`인 **첫 트랙**의 cue만 씀. `{startTime, endTime, text}`로 복사하고 끝 시각은 duration으로 자름 | `text-track.ts:152,173`, `P/core/src/dom/store/text-cues.ts:11-21` | 챕터 데이터를 스토어에서 바로 읽을 수 있음 |
| 썸네일은 `kind==='metadata'`이고 `label==='thumbnails'`인 첫 트랙 | `text-track.ts:154-187` | 로더가 이미 이 규칙대로 트랙을 붙임(§2.2) |
| 그 밖의 metadata 트랙은 목록에만 나오고 cue는 스토어에 없음. `cuechange`와 `activeCues`는 packages(core, html, media, utils, skins, store) 어디에서도 쓰지 않음 | `text-track.ts:149-169`, grep 0건 | 슬라이드, 퀴즈 시점, 스크립트 하이라이트는 네이티브 `TextTrack`의 `cuechange`를 직접 구독해야 함 |
| 스토어가 트랙을 다시 읽는 시점은 `addtrack`, `removetrack`, `change`, `loadstart`, `durationchange`, `<track>`의 `load` | `text-track.ts:189-221` | JS `addCue`로 나중에 넣은 cue가 반영되는지는 미확인 |
| 자막은 브라우저 네이티브로 렌더링함(`::-webkit-media-text-track-container` 스타일만 있음). 자막 메뉴는 captions/subtitles만 다루고 한 번에 하나만 `showing` | `P/media/src/dom/custom-media-element/custom-media-element.ts:50-57`, `P/utils/src/dom/text-track.ts:9-21` | 스크립트 패널용 트랙은 `hidden` 모드로 두고 cue를 읽어야 함 |
| 챕터 메뉴나 목록 컴포넌트는 없음(grep 0건). 챕터 UI는 타임라인 분할과 미리보기 챕터 제목뿐 | `SKIN/template.ts:83-94,106-107` | 목차 목록은 직접 만들어야 함 |
| 커스텀 media(hls-video 등)는 기본 slot의 `<track>`과 `<source>`를 복제해 내부 video에 붙이고 MutationObserver로 동기화함. chapters/metadata 트랙은 `default`가 있으면 `hidden`으로 바꿔 줌 | `custom-media-element.ts:156-159,303-309,409-471` | 챕터와 metadata 트랙에는 `default`를 붙여야 cue가 로드됨. 네이티브 `<video>`에서의 동작은 미확인 |

### 1.3 시간 슬라이더

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 구조: `media-time-slider` > `media-time-slider-chapters`. chapters 안의 `<template>`(`div.media-time-slider-chapter` > track, buffer, fill)을 챕터마다 복제함. 그 밖에 thumb와 preview(thumbnail, chapter-title, pointer 값)가 있음 | `SKIN/template.ts:82-112`, `P/skins/src/components/sliders/time-slider.tsx:26-48` | 챕터가 있으면 타임라인이 이미 구간으로 나뉨 |
| chapters 요소는 `<template>`가 아닌 자식을 모두 지움. 챕터 사이 빈 곳은 `cue:null` 구간이 됨 | `P/html/src/ui/time-slider/chapters.ts:107-123`, `P/core/src/core/ui/time-slider/chapters/core.ts:45-66` | 마커를 넣으려면 챕터 template 안이나 `media-time-slider`의 다른 자식으로 넣어야 함 |
| 슬라이더 host에 `--media-slider-fill`, `--media-slider-pointer`, `--media-slider-buffer`(%)가 붙음. 챕터마다 `--media-slider-chapter-start/end/width/fill/buffer`와 `data-active`가 붙음 | `P/html/src/ui/time-slider/element.ts:231-234`, `P/core/src/core/ui/time-slider/chapters/vars.ts:6-12`, `chapters.ts:78-85` | 직접 추가한 요소도 이 변수를 읽을 수 있음 |
| 버퍼는 `media-slider-buffer`의 `:before`로 그림. % 값은 **마지막 buffered 구간의 끝** 하나만 씀 | `SKIN/skin.css:1220-1265`, `P/core/src/core/ui/time-slider/core.ts:91-93` | 여러 구간(시청 구간) 표시는 내장 기능으로 안 됨 |
| 썸네일은 JS `thumbnails` 속성이 우선이고, 없으면 `thumbnailsTrack` cue(`url#xywh=`)를 씀. shadow 안에 `<slot name="thumbnail">`이 있음 | `P/html/src/ui/thumbnail/element.ts:101-112,162-173`, `SKIN/template.ts:98-101` | 영상별 썸네일 VTT가 있으면 지금 그대로 동작함 |
| 슬라이더 전체가 스킨 **shadow root(open)** 안에 있음. SkinElement가 `static template`과 `static styles`로 그림 | `P/html/src/presets/skin.ts:20-47`, `P/html/src/presets/video/skin.ts:9-13` | `solad-video-skin.js`처럼 템플릿 사본을 고쳐 track 안에 "시청 구간"이나 "한계 지점" 요소를 넣을 수 있음. 위치는 외부 JS가 계산해 CSS 변수로 넣어야 함 |
| 슬라이더 속성에 `value`, `min`, `max`가 없음. `disabled`만 있음 | ✔`P/html/src/ui/time-slider/element.ts:38-45` | 이동 가능한 범위를 시청한 지점까지로 줄이는 내장 기능이 없음 |
| 추가한 마커 요소가 포인터를 가로채는지 | 미확인 | **제안:** `pointer-events:none`(buffer와 같은 방식, `SKIN/skin.css:1221`) |
| CSS는 `@layer` 안에 있음 | `SKIN/skin.css:1, 92, 2679-2907` | `solad-video-skin.js`의 CSS 추가 방식을 따름 |

### 1.4 탐색(seek) 가로채기

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 모든 사용자 seek가 스토어 액션 `time.seek(time)`으로 모임. 이 액션은 0~duration으로 자르고, `set({currentTime, seeking:true})` 다음 `media.currentTime = clampedTime`을 쓴 뒤 `seeked`를 기다림 | ✔`P/core/src/dom/store/features/time.ts:21-41` | 가로챌 지점은 이 한 곳 |
| 경로별 합류: 슬라이더(드래그, 클릭, 키) → `media.seek()`, 단축키 `seekStep`(←/→/j/l), `seekToPercent`(0-9, Home=0, End=100), 더블탭 `seekStep`, `<media-seek-button>` | `P/html/src/ui/time-slider/element.ts:80-88,112-123`, `P/core/src/dom/media-actions.ts:70-77`, ✔`P/core/src/dom/hotkey/actions.ts:48-67`, `P/core/src/dom/gesture/actions.ts:29`, `P/core/src/core/ui/seek-button/core.ts:88-92` | 숫자키와 End로 끝까지 바로 이동할 수 있음 |
| 공개된 가드가 없음. 스토어 액션은 클로저이고 state는 `Object.freeze`. middleware, 취소 가능한 `beforeseek`, request guard가 모두 없음 | `P/store/src/core/store.ts:163-184`, `P/store/src/core/state.ts:51,75,85` | 액션 몽키패치 방식은 쓸 수 없음 |
| 플레이어가 media를 extension facade(Proxy)로 감싸 스토어에 붙임. facade의 `set`은 extension의 `mediaOverride[prop]`에 먼저 맡김 | ✔`P/core/src/dom/extensions/media.ts:31-69`, `P/html/src/player/element.ts:259-267` | `currentTime` setter를 덮으면 모든 UI 경로의 seek를 한곳에서 자를 수 있음 |
| extension과 context는 `@internal`. 키는 `Symbol.for('@videojs/extension')`. CDN `video.js`는 아무것도 export하지 않음 | ✔`P/html/src/player/context.ts:74-89`, ✔`P/core/src/dom/extensions/extension.ts:28-39`, `P/cdn/src/video.ts:1-3` | CDN 환경에서는 같은 키로 context 요청을 보내 등록해야 함 |
| **선례:** 광고 확장(`ads.js`)은 따로 번들(`alwaysBundle`)되지만 같은 `extensionContext` 소비자로 등록되고 `mediaOverride`를 줌 | ✔`P/extensions/ads/vite.config.ts:31-43`, ✔`P/extensions/ads/src/html/element.ts:15-29,73-82` | 별도 번들이 Symbol 키로 등록하는 방식이 이미 쓰이고 있음. 손으로 쓴 JS에서 `context-request`를 보내는 방식은 미확인 |
| 광고의 seek 차단은 두 겹: ① 광고 중 `mediaOverride`의 `currentTime` setter를 no-op로 하고 getter를 고정값으로 둠 ② `seeking`/`seeked`에서 `#restoreContentTime` | `P/extensions/ads/src/dom/controller.ts:186-208,265-276,719-721` | LMS도 같은 두 겹 구조를 쓸 수 있음 |
| no-op setter를 쓰면 `time.seek()`가 `seeking:true`인 채로 `seeked`를 기다리게 됨 | ✔`time.ts:36-39` | **제안:** no-op 대신 "허용한 최대 지점으로 잘라서 실제로 쓰기". 실행 검증 안 함 |
| 되돌리기만 쓸 때의 비용: 실제 seek가 한 번 시작되고(네트워크 요청, 프레임 깜빡임 가능), 되돌리는 seek가 한 번 더 일어남. 루프 방지 비교가 필요하고, 스토어와 UI가 잠깐 요청한 값을 보여줌 | `controller.ts:719-721`, `time.ts:36,133` | 안전망으로만 쓰는 편이 나음 |
| 슬라이더 키는 capture 단계에서 처리하고 `isDisabled`만 확인함. 단축키 coordinator는 `defaultPrevented`와 `disabled` 바인딩을 건너뜀 | `P/core/src/dom/ui/slider/slider.ts:293-347`, ✔`P/core/src/dom/hotkey/coordinator.ts:168,174` | 바깥에서 capture 단계 `preventDefault`로 단축키를 막을 수 있음(슬라이더 키 차단은 미확인) |
| seek indicator는 실행 결과가 아니라 입력 기준으로 방향을 표시함 | `P/core/src/core/ui/seek-indicator/status.ts:35-51` | 막힌 seek에도 "앞으로 10초" 표시가 뜰 수 있음 |
| MediaSession `setActionHandler`는 쓰지 않음. OS나 PiP 창의 seek 경로는 facade를 거치는지 미확인 | grep 0건 | `seeking` 되돌리기 안전망이 필요한 이유 |

### 1.5 스토어에서 읽을 수 있는 값

- 접근: `document.querySelector('video-player').store`(✔`P/html/src/player/element.ts:142-148`).
- `store.state`, `store.subscribe(cb, {signal})`를 쓸 수 있음(`P/store/src/core/store.ts:86-108,268-270,318-327`).

| 값 | feature / 키 | 근거 |
|---|---|---|
| currentTime, duration, seeking | `time`: `currentTime`, `duration`, `seeking`, `seek()` | `time.ts:15-41` |
| played 구간 | **없음**. 네이티브 `video.played`를 써야 함. iframe 계열용 `MediaPlayedRangesMixin`이 따로 있음 | `P/core/src/dom/store/features/buffer.ts:9-12`, `P/media/src/dom/media-played-ranges/media-played-ranges.ts:36-48`, `html-media-adapter.ts:281-282` |
| buffered, seekable | `buffer`: `[number,number][]` | `buffer.ts:7-22` |
| paused, ended, started, waiting | `playback` | `P/core/src/dom/store/features/playback.ts:9-13` |
| 배속 | `playbackRate`: `playbackRate`, `playbackRates`, `setPlaybackRate()` | `playback-rate.ts:9-18` |
| 볼륨 | `volume`: `volume`, `muted` | `volume.ts:10-16` |
| 전체화면 | `fullscreen`: `isFullscreen` | `fullscreen.ts:8-41` |
| PiP | `pip`: `isPictureInPicture` | `pip.ts:15-19` |
| 문서 visibility | **없음**. 숨긴 탭에서는 시간 동기화만 하고 일시정지하지 않음 | `P/core/src/dom/store/features/presets.ts:25-41`, ✔`time.ts:128` |

### 1.6 스킨에 커스텀 영역 더하기

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| `solad-video-skin.js`는 `customElements.get('video-skin')`을 상속해 템플릿 사본을 고침(cast/AirPlay 제거, play 뒤에 seek 버튼 삽입). CSS는 `adoptedStyleSheets`에 추가함 | `AM/public/player/solad-video-skin.js:190,214-224,252-277,361-380` | 메뉴 항목, 버튼, 슬라이더 안 요소를 같은 방식으로 더할 수 있음 |
| 로고는 property이고 바뀌면 바로 반영됨. shadow `media-container` 안 `media-controls` 앞에 div를 넣음 | `solad-video-skin.js:332-359,382-390` | 오버레이 추가의 기준 패턴 |
| 겹침 순서: 영상 0, backdrop 10, 로고/제목 20, controls 30, dialog 40/50, 광고 100 | `solad-video-skin.js:81-83` | 퀴즈나 다음 차시 오버레이는 이 순서 안에서 자리를 정해야 함 |
| 호스트 속성(`seek-buttons`, `captions`)은 연결될 때 한 번 읽음. 값이 바뀌면 로더가 다시 마운트함 | ✔`AM/public/player/loader.js:465-471`, `solad-video-skin.js:392-407` | LMS 설정도 같은 방식으로 넘길 수 있음 |
| `media-container`는 `position:relative; overflow:clip; container: media-root/inline-size; width/height 100%` | ✔`SKIN/skin.css:464-489`(overflow는 :487) | 옆 패널을 컨테이너 안에 넣으면 잘림 |
| 전체화면 대상은 스토어에 등록된 container이고, 그 container는 스킨 shadow 안의 `<media-container>`가 스스로 등록함 | ✔`P/core/src/dom/store/features/fullscreen.ts:15-22`, ✔`P/html/src/ui/container/element.ts:28,86` | 플레이어 밖 패널은 내장 전체화면 버튼(`f` 포함)으로 전체화면을 켜면 보이지 않음 |
| 로더는 placeholder에 root를 append만 하고 기존 자식은 지우지 않음 | `loader.js:509,540,726` | 호스트 페이지가 플레이어 옆에 패널을 둘 수 있음 |
| i18n 문자열은 `registerI18n`으로 언어별로 추가함 | `solad-video-skin.js:193-201` | LMS 문구도 같은 방식 |

### 1.7 키보드 단축키

기본 바인딩(`P/skins/src/skins/shared/behaviors/playback-hotkeys.tsx:10-23`, `P/skins/src/skins/shared/video/behaviors/hotkeys.tsx:12-15`, `SKIN/template.ts:328-361`):

| 키 | action |
|---|---|
| Space, k | togglePaused |
| m | toggleMuted |
| ArrowRight, l / ArrowLeft, j | seekStep ±10초 |
| ArrowUp / ArrowDown | volumeStep ±5% |
| 0-9 | seekToPercent(숫자×10%) |
| Home / End | seekToPercent 0 / 100 |
| `>` / `<` | speedUp / speedDown |
| f | toggleFullscreen |
| c | toggleSubtitles |
| i | togglePictureInPicture |

제스처(`SKIN/template.ts:362-371`): 탭 중앙 togglePaused(마우스), 탭 toggleControls(터치), 더블탭 좌/우 seekStep, 더블탭 중앙 toggleFullscreen.

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| `<media-hotkey>` 속성: keys, action, value, disabled, target. 속성이 바뀌면 다시 등록함 | `P/html/src/ui/hotkey/element.ts:13-25,46-53` | 템플릿 사본에서 지우거나 `disabled`를 줌(`captions=off` 때 `c`를 지운 선례) |
| action은 10개로 고정됨(togglePaused, toggleMuted, toggleFullscreen, toggleSubtitles, togglePictureInPicture, seekStep, volumeStep, speedUp, speedDown, seekToPercent). 모르는 action은 등록되지 않음 | `P/core/src/core/ui/hotkey/core.ts:1-11`, `hotkey/actions.ts:71-78` | 사용자 정의 action(예: 북마크 `b`)은 직접 keydown 리스너로 만들어야 함 |
| `<media-gesture disabled>` 지원 | `P/html/src/ui/gesture/element.ts:24,32` | 더블탭 seek를 끌 수 있음 |

## 2. ads-manager

### 2.1 프리셋(`AM/public/player/preset.js`, PHP, TS)

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 최상위 키는 id, name, playerType, language, theme, playback, display, input, controls, logo, ads로 고정. 그 밖의 키는 `unknown_key` | `preset.js:48-60,99,222` | 새 그룹(예: `lms`)은 topKeys에 추가해야 함 |
| 값 읽는 함수: text, bool(true/false만), integer(범위), step(허용 목록), choice, color(`#rrggbb`), label(40자, 자리표시자 제한), href(http(s), 2048자) | `preset.js:102-213` | 새 필드도 이 타입으로 표현하면 세 구현을 맞추기 쉬움 |
| `playerType`은 `videojs`/`native` 두 가지. native는 theme, display.title, input, controls, logo에 값이 있으면 `player_type` 오류 | `preset.js:224-236,328-346` | LMS 그룹이 videojs 전용이면 native 거부 목록에 넣어야 함 |
| `controls`는 bool 7개 + `seekButtons ∈{5,10,15,30}`. `captions`와 `seekButtons`도 controls 안에 있음. "colors" 그룹은 없고 색은 theme와 ads에 있음 | `preset.js:239-326` | |
| render: videojs는 `skinTag:'video-skin'`, `styles:{css:'video.css',js:'video.js'}` 상수 | `preset.js:402-475` | 로더가 `video-skin`을 `solad-video-skin`으로 바꿔 씀(`loader.js:31`) |
| 로더는 render를 다시 프리셋으로 읽어 render한 결과가 **원래 render와 같아야만** 받아들임(`readPresetRender`). 다르면 `preset_invalid`로 처리하고 default를 씀 | `preset.js:484-578` | 새 그룹은 render에서 손실 없이 되돌릴 수 있어야 함 |
| `applyPresetCss`는 허용된 CSS 변수 10개만 씀 | `preset.js:8-22,581-593` | 새 CSS 변수도 목록에 추가해야 적용됨 |
| 같은 검증이 세 곳에 있음: `preset.js`, `AM/ui/src/player/preset.ts`, `AM/src/PlayerPresets.php`. PHP는 첫 오류에서 422로 멈추고 JS/TS는 오류를 모음 | `PlayerPresets.php:184-298`, `preset.ts:435-547` | 세 곳의 검사 순서를 맞춰야 함 |
| 세 구현은 공용 fixture `AM/tests/fixtures/player-preset-v2.json`으로만 맞춰짐(normalize 162건, render 7건, migrate 6건) | `AM/ui/tests/player-preset.test.tsx:59-160`, `AM/tests/admin/loader.test.ts:1061-1117`, `AM/tests/backend/run.php:285-306` | fixture의 builtIn과 케이스를 먼저 고쳐야 함 |
| 내장 프리셋 4개: default, flat, rounded, accent(모두 videojs) | `PlayerPresets.php:22-27,357`, `preset.js:47` | 내장 LMS 프리셋을 넣으려면 id 목록 5곳(`preset.js:47`, `preset.ts:324`, `PlayerPresets.php:22`, `loader.js:21`, `install-snippet.ts:247`)과 fixture를 고쳐야 함 |
| 저장 위치: meta 키 `player_presets`에 JSON 문서 하나(schema 2, 최대 20개, revision 다르면 409). DDL 없음 | `PlayerPresets.php:9-11,339-353` | 프리셋 설정 자체는 DDL 변경 없이 넣을 수 있음 |
| 편집 폼은 controls 중 seekButtons와 captions만 편집하고, 나머지는 `kept`로 보존함. 섹션은 basic, theme, controls, playback, language, ads | `AM/ui/src/screens/preset-form.ts:28-77`, `AM/ui/src/screens/PresetEditor.tsx:44-71` | 새 그룹은 처음에는 `kept`로 보존만 할 수 있음 |
| 목록 API 응답도 `parsePlayerPreset`로 검증함 | `AM/ui/src/api/presets.ts:71-112` | 서버가 새 필드를 먼저 보내면 구 UI의 목록 전체가 실패함. 배포 순서에 주의 |

### 2.2 로더(`AM/public/player/loader.js`)와 설치 코드

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 입력: `[data-solad-player]`의 data-* = video-id, src(필수), poster, title, thumbnails, captions, engine, preset, autoplay, muted, loop, preload, lang. URL 파라미터와 window 전역은 읽지 않음 | `loader.js:153-224` | 챕터, 스크립트, 자료, 학습자 입력이 없음 |
| mount 옵션: overrides(부분 프리셋, 하나라도 틀리면 전부 버림), preview, onEvent, onError. 우선순위는 overrides > data-* > 프리셋 > 기본값 | `loader.js:246-291,699-708,748-802` | |
| 프리셋은 `api/index.php?action=player-preset`에서 id별로 한 번, 3초 제한으로 받음. 실패하면 defaultRender | `loader.js:18,63-116,799` | |
| `structure()`는 css, attributes, ui, labels, id, revision, logo를 뺀 render를 JSON으로 비교함. 다르면 다시 마운트함. restyle은 preview 핸들에만 있음 | `loader.js:380-385,850-911` | LMS 그룹 값이 바뀌면 다시 마운트됨 |
| 실제로 적용하는 render 값은 playback, language, display, controls.seekButtons, controls.captions뿐. **input.*과 controls.quality/audioTrack/playbackRate/pip/fullscreen/thumbnails는 적용 코드가 없음**(검증만 함) | ✔`loader.js:461-476`, ✔grep `playbackRate|pip|fullscreen|hotkeys|gestures` 0건 | 배속 끄기, PiP 끄기, 단축키 끄기는 아직 동작하지 않음 |
| 트랙: thumbnails는 metadata(`label='thumbnails'`, `default`), captions는 subtitles 1개(플레이어 언어, 기본 꺼짐) | ✔`loader.js:481-501` | 다국어 자막과 챕터 트랙이 없음. 코어는 chapters 트랙을 읽으므로 트랙만 붙이면 됨 |
| DOM: `media-i18n > video-player > solad-video-skin > [media, media-ads]`. `ads.js`는 동적 import | `loader.js:440-460,537-540` | |
| 이벤트: `solad-error`, `solad-ready`를 보냄. `ads-event`를 다시 보냄 | `loader.js:771-772,915-917,503,525,606` | LMS 이벤트도 같은 방식으로 낼 수 있음 |
| 설치 코드: 데모 `AM/public/examples/install-code.js:39-106`과 관리자 `AM/ui/src/player/install-snippet.ts:256-319`가 줄 단위로 같고 테스트로 비교함 | `AM/tests/admin/examples.test.ts:346-382` | 새 data-* 속성은 두 파일을 함께 고쳐야 함 |
| 관리자 PlayerSetup은 videoId, contentUrl, posterUrl, title만 넘김(thumbnails, captions, preset 없음) | `AM/ui/src/screens/PlayerSetup.tsx:183-190` | |

### 2.3 이벤트·통계와 공개 액션 보호

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 공개 액션은 `schedule`, `events`, `player-preset` 셋뿐 | ✔`AM/src/Http.php:9` | 진도 액션을 공개로 두려면 여기와 `App.php`의 reads/writes 배열에 추가해야 함 |
| 액션 화이트리스트와 GET/POST 구분 | ✔`AM/src/App.php:28-35` | |
| 모든 요청에 같은 출처 검사: `Sec-Fetch-Site: cross-site`이거나 Origin이 호스트와 다르면 403 | ✔`Http.php:11-23` | 다른 도메인의 LMS 페이지는 그대로 쓸 수 없음. 계약도 permissive CORS를 금지함(`.agents/plans/ads-contract-v1.md:23,90`) |
| POST 본문은 `application/json`만 받고, 아니면 400 `content_type`. 1 MiB 제한 | ✔`Http.php:37-46` | `navigator.sendBeacon(url, 문자열)`은 text/plain이라 거부됨. 광고 추적은 `fetch(keepalive, application/json)`을 씀(`P/extensions/ads/src/dom/tracking.ts:66-73`) |
| 보호 방식은 HMAC-SHA256 토큰. `schedule`이 claims(siteId, videoId, boardId, categoryId, scheduleId/Version, playbackSessionId, expires)에 서명해 발급함 | ✔`AM/src/Events.php:12-24` | 쿠키 없는 공개 쓰기의 기준. 학습자 ID는 claims에 없음 |
| 서명 키는 meta `signing_key`(설치 때 `random_bytes(32)`). HMAC 함수는 `Events::sign()`(private) 하나뿐 | ✔`AM/src/Database.php:96`, ✔`Events.php:12-15` | 용도를 나눈 공용 서명 헬퍼가 없음 |
| 검증: 8192자 이하, `hash_equals`, 만료, siteId 일치, 본문 `playbackSessionId` 일치. nonce나 재사용 방지는 없음 | `Events.php:26-42` | 만료 전까지 토큰을 재사용할 수 있음 |
| 세션 유효 시간 기본 7200초(60~86400) | `AM/src/Config.php:23,42` | 2시간이 넘는 강의는 토큰 갱신 경로가 필요함 |
| 레이트 리밋: 세션당 120회/분, 설치 전체 2000회/분(`rate_limits` 테이블, 60초 창) | ✔`Events.php:54-55`, `Database.php:103-118` | 설치 전체 한도를 모든 시청자가 함께 씀. 학습자가 많으면 주기 보고만으로 429가 날 수 있음(규모는 미확인) |
| 쓰기는 meta `write_lock` 행을 UPDATE하는 설치 전체 잠금 안에서 처리함 | `Database.php:58-73` | 진도 보고가 모두 직렬화됨(처리량은 미확인) |
| 요청 형태 `{playbackSessionId, eventToken, events:[1~50]}`. `type`은 start/complete/skip/click/error/cancel만 허용 | `Events.php:47-50,97-120` | 광고 전용 스키마라 진도 데이터는 넣을 수 없음 |
| 중복 제거: `(site_id, event_id)` PK. 같은 내용이면 duplicate, 다르면 409 | `Events.php:158-165`, `AM/database/001.sql:11` | 진도도 고정 ID로 재전송하는 멱등 규약을 따를 수 있음 |
| 서버 수신 시각 `received_at`을 따로 기록함 | `Events.php:121-133,217` | 계약은 서버 시각을 기준으로 함(`ads-contract-v1.md:100`) |
| 통계는 광고 지표 전용. `retentionDays`는 설정값일 뿐 자동 삭제 코드가 없음 | `AM/src/Statistics.php:10-68`, `Config.php:23` | 진도 집계 기능 없음. 데이터가 계속 쌓임 |
| 새 액션 절차: "담당이 오케스트레이터에게 요청하고, 이 파일에 먼저 기록한 뒤 구현" | `.agents/plans/ads-admin-app-contract.md:90` | 진도 액션은 계약 문서에 먼저 기록해야 함 |
| 계약: 방문자 계정과 IP는 저장하지 않음(v1) | `.agents/plans/ads-contract-v1.md:105` | 학습자 ID 저장은 현재 계약 범위 밖 |

### 2.4 사용자 식별

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| Host의 추상 메서드는 관리자용(`authenticated`, `displayName`, `csrfToken`, `resolveVideoContext` 등). 학습자 ID 메서드가 없음 | `AM/hosts/Host.php:10-17` | |
| 그누보드 `authenticated()`는 관리자 권한(super 또는 메뉴 권한 'r')이 있을 때만 true | `AM/hosts/GnuBoard.php:8-22,35-38` | 일반 회원 학습자는 false |
| 그누보드 호스트는 공개 액션에서도 `common.php`를 불러오므로 서버에 `$member`가 있음. `resolveVideoContext`가 공개 `schedule`에서 `mb_id`, 레벨, 그룹 권한을 검사하지만 ID는 반환하지 않음 | `AM/src/bootstrap.php:7-28`, `GnuBoard.php:93-154`, `App.php:45-48` | 그누보드에서는 진도 수신 때 서버가 쿠키 세션으로 `mb_id`를 직접 얻을 수 있음. 클라이언트 값을 믿을 필요가 없음 |
| 독립 설치는 공개 액션에서 PHP 세션을 시작하지 않고 방문자 개념이 없음 | `bootstrap.php:29-37`, `AM/hosts/Standalone.php:8-12` | 외부 LMS의 사용자 ID를 서명해 넘기는 방법을 새로 만들어야 함 |
| 플레이어에 학습자를 넘기는 data-*가 없고, 서명 URL, JWT, 외부 공유 키 설정도 없음 | `loader.js:212-222`, `Config.php:23`, grep `hash_hmac` 1건 | **지금은 서명된 학습자 값을 넘길 방법이 없음** |
| 계약: 방문자가 주장하는 값은 믿지 않고, 서명된 컨텍스트나 호스트가 해석한 값만 인정함 | `ads-contract-v1.md:73,100` | 학습자 ID에도 같은 원칙을 적용해야 함 |
| 동시 재생 방지 기능 없음. 세션은 videoId 단위 | `Events.php:19-23` | |

### 2.5 DB

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| PDO `sqlite`와 `mysql`만 지원. MySQL은 utf8mb4_bin, SQLite는 busy_timeout과 foreign_keys | `Database.php:24-32` | 새 DDL은 두 엔진에서 같이 동작해야 함(README는 엔진별 JSON 쿼리를 피함, `AM/README.md:8`) |
| 접두어는 `/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/`. `table()`은 `[a-z_]+` 이름에 접두어를 붙임(기본 `ads_`) | `Database.php:13-16,37-44`, `Config.php:23` | 새 테이블 이름은 소문자와 `_`만 |
| `migrate()`는 `database/001.sql` **하나만** 읽음. `{{name}}`은 접두어 테이블로, `{{options}}`는 엔진 옵션으로 바꿈. 설치기(CLI)에서만 실행됨 | ✔`Database.php:80-91`, `AM/bin/install.php:4-8,55-56` | 002 파일을 추가해도 지금은 실행되지 않음. migrate를 고쳐야 함 |
| `schema_version`은 값이 없을 때만 '1'로 INSERT함(갱신 로직 없음). App 생성자는 `!== '1'`이면 500 `installation_required` | ✔`Database.php:96-100`, ✔`App.php:16` | 버전을 올리려면 App 검사와 migrate를 둘 다 고쳐야 함 |
| 기존 테이블 13개: meta, admins, creatives, creative_versions, video_contexts, drafts, publications, sessions, break_attempts, attempts, events, rejections, rate_limits. `CREATE TABLE IF NOT EXISTS` | `AM/database/001.sql:1-13` | |
| 선례: 프리셋은 테이블 대신 meta JSON에 저장함("스키마 버전, 테이블, DDL은 바꾸지 않는다") | `PlayerPresets.php:10`, `.agents/plans/ads-admin-app-contract.md:120` | 진도처럼 행이 많은 데이터는 meta에 넣을 수 없음 |
| 마이그레이션 002는 v2 광고 도메인용으로 초안이 있음("CLI로만 실행, 멱등, 두 엔진 공통") | `.agents/plans/ads-admin-v2-spec.md:297-303` | 새 테이블 규칙의 유일한 문서 근거. 번호 002는 v2가 먼저 잡아 둠 |
| 운영 DB 권한은 SELECT/INSERT/UPDATE만 가정하고 DDL은 설치 때만 | `AM/README.md:65` | 오래된 진도 행을 지우는(DELETE) 정책은 권한 가정 밖 |

### 2.6 관리자 앱: 영상별 데이터

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 영상 엔티티, 목록, 편집 화면이 없음. `video_contexts(video_id, label, board_id, category_id)` 한 테이블과 `video-context-save`(독립 설치 전용)뿐 | `001.sql:5`, `App.php:29,70`, `Standalone.php:70-95` | 자막, 썸네일 VTT, 챕터, 자료를 붙일 칼럼이 없음 |
| 그누보드는 `video-context-save`가 403. videoId는 `board:post:key`이고 영상 정보는 게시물이 가짐 | `Host.php:38-41`, `GnuBoard.php:93-101` | 그누보드에서는 영상별 메타를 게시물이나 호스트 콜백(`gnuboardVideoKeys`, `Config.php:44-46`)에서 받아야 함 |
| UI의 영상 관련 화면은 편성 화면 안 `VideoContextForm`뿐 | `AM/ui/src/screens/ScheduleScreen.tsx:399,504-560` | |
| 자막과 썸네일 VTT는 서버가 아니라 페이지의 data-*로 받음. 썸네일 VTT는 영상마다 다르므로 `data-thumbnails`로 받기로 확정함(결정 28) | `loader.js:218-219,481-502`, `.agents/plans/ads-player-customization-spec.md:199,298` | 영상별 미디어 메타는 현재 설치 페이지가 책임짐 |
| "영상 목록 관리"는 하지 않는 범위로 명시됨. "영상별 프리셋 지정"은 준비 중 | `ads-player-customization-spec.md:313`, `.agents/plans/ads-admin-app-contract.md:56` | 영상 엔티티를 만들면 범위가 넓어지므로 계약을 고쳐야 함 |

### 2.7 광고와 겹치는 곳

| 사실 | 근거 | LMS 관점 |
|---|---|---|
| 광고는 오버레이 shadow 안의 별도 `<video>`/`<img>`에서 재생됨 | `P/extensions/ads/src/dom/overlay.ts:64,200-212` | 본편 `currentTime`에 광고 시간이 들어가지 않음 |
| 광고 시작 때 `#contentTime`을 저장하고 본편을 `pause()`함. 광고가 끝나면 `play()`를 부르고 합성 `timeupdate`를 한 번 보냄 | `controller.ts:362-364,662-664,684-696,712-729` | 본편에서 실제 `pause`/`play` 이벤트가 생김. 진도 추적기가 이를 학습자의 일시정지로 오해할 수 있음 |
| 광고 중 `mediaOverride`가 currentTime/paused/ended를 고정하고, 본편 seek는 되돌림 | `controller.ts:186-208,265-276` | 광고 중 생기는 seeking/seeked는 진도 계산에서 빼야 함 |
| **미드롤 스냅백은 없음.** 앞으로 seek하면 지나친 구간에서 가장 이른 미드롤 1개만 예약하고, 광고는 도착 지점에서 재생한 뒤 그 자리에서 계속함. 뒤로 가면 예약을 취소함 | `P/extensions/ads/src/core/scheduler.ts:81-134`, `controller.ts:279,362` | 광고 쪽에 건너뛰기 방지가 없음. LMS 제한과 함께 쓰면 "제한 지점으로 자른 seek"가 미드롤을 예약하는지 미확인 |
| 광고 중 오버레이가 컨테이너 자식 전체를 `inert`로 만들고, ←/→/Home/End/j/l/숫자 키를 막음 | `overlay.ts:172-179,340-377,410-417` | 퀴즈 오버레이가 컨트롤을 막을 때 참고할 선례 |
| `visibilitychange`는 광고 이미지 타이머에서만 씀 | `controller.ts:158,179,540-544` | |
| 광고 이벤트 전송은 fetch POST, 20개씩, 3회 재시도, 종료 때 keepalive 1회. sendBeacon은 쓰지 않음 | `tracking.ts:37-129` | 진도 전송도 같은 관례를 따르면 서버(JSON 전용)와 맞음 |
| 두 extension(광고, LMS 가로채기)이 모두 `currentTime`을 덮으면 첫 번째 override가 이김(`findOverride`) | ✔`P/core/src/dom/extensions/media.ts:60-69` | 등록 순서에 따라 광고 중 고정과 LMS 자르기가 충돌할 수 있음. 실제 순서는 미확인 |

## 3. packages를 고치지 않고는 안 되는 것

| 항목 | 이유(근거) | packages 없이 쓸 수 있는 대체 수단 |
|---|---|---|
| 배속 목록 변경과 내장 메뉴의 상한 표시 | `DEFAULT_RATES` 상수이고 setter, config, 속성이 없음(`playback-rate.ts:7-18`) | 내장 메뉴를 템플릿에서 빼고 자체 메뉴로 `media.playbackRate`를 다루거나, `ratechange`를 보고 값을 되돌림 |
| speedUp/speedDown의 2×→0.2× 순환 동작 | `media-actions.ts:88-108` | `>`/`<` 단축키를 지우고 직접 keydown을 처리함 |
| 사용자 정의 단축키 action | action 목록 고정(`hotkey/actions.ts:71-78`) | 직접 keydown 리스너 |
| 공개된 seek 가드(beforeseek, middleware) | 없음(`store.ts:163-184`) | `@internal` extension `mediaOverride`와 `seeking` 되돌리기. 내부 API라 업스트림 변경에 깨질 수 있음 |
| 슬라이더의 이동 가능 범위(max)를 시청 지점으로 제한 | `value/min/max` 속성 없음(`time-slider/element.ts:45`) | 위의 seek 자르기와 템플릿 사본에 그린 "한계 지점" 표시 |
| 여러 구간(시청 구간) 내장 표시 | 버퍼는 마지막 구간 끝 하나만 씀(`time-slider/core.ts:91-93`) | 템플릿 사본에 직접 만든 요소를 넣고 CSS 변수로 칠함 |
| 스토어의 `played`, 활성 cue, metadata cue, 문서 가시성 상태 | feature 목록 고정(`features/presets.ts:25-41`, `text-track.ts:149-169`) | 네이티브 `video.played`, `TextTrack.cuechange`, `document.visibilitychange`를 직접 씀 |
| 막힌 seek에서 seek indicator가 뜨지 않게 하기 | 입력 기준 표시(`seek-indicator/status.ts:35-51`) | 템플릿 사본에서 indicator를 빼는 것만 가능 |
| 플레이어 밖 패널을 포함한 내장 전체화면 | 전체화면 대상은 shadow 안 `media-container`(`container/element.ts:86`) | 패널을 플레이어 안 오버레이로 넣음. 또는 자체 전체화면 버튼으로 바깥 wrapper를 띄움(이때 `isFullscreen` 상태와 내장 버튼 표시가 어긋날 수 있음, 미확인) |
| 커스텀 자막 렌더링 | 네이티브 렌더링뿐(`custom-media-element.ts:50-57`) | 스크립트 패널은 트랙을 `hidden`으로 두고 cue를 직접 그림 |

## 4. 미확인 목록

1. 손으로 쓴 JS가 `context-request`로 extension을 등록하는 것이 CDN 빌드에서 동작하는지.
2. clamp setter를 쓸 때 seek가 정상적으로 끝나는지(`seeked`).
3. capture 단계의 `stopPropagation`/`preventDefault`로 슬라이더 썸 키가 막히는지.
4. OS 미디어 키, PiP 창, 접근성 도구의 seek가 facade를 거치는지.
5. 광고 extension과 LMS extension을 같이 등록할 때 override 순서. 잘린 seek가 미드롤 예약에 주는 영향.
6. `application/json` Blob을 sendBeacon으로 보낼 때 브라우저별 허용 여부. 쓰기 잠금 아래에서 주기 보고의 처리량.
7. 네이티브 `<video>`(native playerType)에서 chapters 트랙 `default` 처리.
8. JS `addCue`로 추가한 cue가 스토어 `chaptersCues`에 반영되는지.
9. 포스트롤 광고와 "다음 차시" 오버레이의 순서.
10. 다른 도메인 LMS 페이지에서 쓰는 방법(같은 출처 원칙과 충돌함. 대안을 적은 문서는 없음).

## 5. LMS 정책 우선 원칙에서 본 충돌 지점과 분리 지점

정책은 머리말에 있음(범용 기능과 충돌하면 LMS 정책이 우선). 이 절은 "범용 동작이 무엇이고, LMS가 어디에서 그것을 덮을 수 있는가"를 사실로만 정리한다. 무엇을 덮을지는 설계에서 정한다.

### 5.1 충돌 지점

| # | 범용 동작(지금) | 근거 | LMS가 덮을 수 있는 자리 | packages 수정 |
|---|---|---|---|---|
| C1 | 자유 탐색: 슬라이더, ←/→/j/l, 0-9, Home/End, 더블탭, ±초 버튼 | §1.4 | extension `mediaOverride.currentTime`(모든 UI 경로), 템플릿 사본에서 단축키·제스처·버튼 제거 또는 `disabled` | 불필요(`@internal` API 사용) |
| C2 | 광고 확장도 `currentTime`을 덮음. 여러 extension이 같은 속성을 덮으면 **먼저 등록된 클래스가 이김**: 클래스별 Map이고, 같은 클래스를 다시 등록해도 순서가 유지되며, facade는 Map 순서대로 첫 override를 고름 | ✔`P/core/src/dom/extensions/coordinator.ts:47-63,108-114`, ✔`P/core/src/dom/extensions/media.ts:60-69` | LMS extension을 광고(`media-ads`)보다 먼저 등록하면 LMS가 이김. 그러면 광고 중 고정(`controller.ts:186-208`)이 가려지므로, 광고 상태를 LMS override 안에서 따로 다뤄야 함. 광고의 `seeking` 되돌리기(`controller.ts:265-276`)는 순서와 상관없이 계속 동작함 | 불필요 |
| C3 | 미드롤은 seek로 건너뛴 구간에서 1개만 예약하고 도착 지점에서 계속함(스냅백 없음) | `P/extensions/ads/src/core/scheduler.ts:81-134` | LMS에서 앞으로 seek를 자르면 건너뛰는 구간 자체가 줄어듦. 둘이 함께 동작하는 결과는 미확인 | 미확인 |
| C4 | 배속 목록 0.2~2×, `>`/`<`가 끝에서 순환, 상한 없음 | §1.1 | 템플릿 사본에서 내장 배속 메뉴와 `>`/`<` 단축키를 빼고 자체 메뉴 사용, `ratechange` 되돌리기 | 내장 메뉴의 목록을 바꾸려면 필요 |
| C5 | 숨긴 탭에서도 계속 재생함 | ✔`P/core/src/dom/store/features/time.ts:128` | `document.visibilitychange`를 LMS 코드에서 처리 | 불필요 |
| C6 | 전체화면 대상이 shadow 안의 `media-container`라서 플레이어 밖 패널은 전체화면에서 사라짐 | ✔`P/html/src/ui/container/element.ts:86` | 패널을 컨테이너 안 오버레이로 넣거나, 자체 전체화면 버튼으로 바깥 wrapper를 띄움(내장 `isFullscreen`과 어긋날 수 있음, 미확인) | 내장 버튼으로 wrapper를 띄우려면 필요 |
| C7 | seek indicator가 입력 기준으로 표시됨 | `P/core/src/core/ui/seek-indicator/status.ts:35-51` | 템플릿 사본에서 indicator를 빼거나 숨김 | 막힌 seek만 숨기려면 필요 |
| C8 | 단축키 action 10개로 고정, 사용자 정의 action 없음 | §1.7 | LMS 키(북마크 등)는 자체 keydown. 범용 키는 템플릿 사본에서 정리 | 불필요 |
| C9 | 자막은 subtitles 트랙 1개, 한 번에 하나만 표시, 네이티브 렌더링 | §1.2, `loader.js:493-501` | 스크립트용 트랙을 `hidden`으로 따로 붙이고 cue를 패널에 직접 그림 | 불필요 |
| C10 | 프리셋 스키마가 고정: topKeys, `playerType` 2종, 세 곳 동일 검증 + fixture, `readPresetRender` 동일성, render `skinTag:'video-skin'` 상수 | §2.1 | 새 그룹 또는 새 playerType 추가. 어느 쪽이든 세 구현, fixture, 로더를 함께 고쳐야 함 | 불필요(ads-manager 안 수정) |
| C11 | 로더 입력이 고정(data-* 13개). `controls.playbackRate/pip/fullscreen`, `input.*`는 적용 안 함 | §2.2 | LMS 전용 data-*와 적용 코드 추가. `skinTags` 맵(✔`loader.js:31`)에 LMS 스킨 태그 연결 | 불필요 |
| C12 | 서버 계약: 방문자 계정·IP를 저장하지 않음(v1), 같은 출처, JSON 전용, 설치 전체 레이트 리밋, 쓰기 잠금 | §2.3, `.agents/plans/ads-contract-v1.md:105` | LMS 전용 액션, 토큰, 테이블, 한도. **계약과 충돌하므로 계약 문서에 먼저 기록해야 함**(`.agents/plans/ads-admin-app-contract.md:90`) | 불필요 |
| C13 | DB: `001.sql` 하나, `schema_version` '1' 고정 검사 | §2.5 | migrate와 App 검사를 고쳐 LMS 테이블을 추가. 002 번호는 v2 초안이 먼저 잡아 둠 | 불필요 |
| C14 | 범위: "영상 목록 관리"는 하지 않음 | `.agents/plans/ads-player-customization-spec.md:313` | LMS에서 영상별 챕터, 자료, 퀴즈를 서버에 두려면 범위를 바꿔야 함 | 불필요 |

### 5.2 범용 경로를 건드리지 않고 LMS를 분리할 수 있는 지점

| 분리 지점 | 사실 | 근거 |
|---|---|---|
| 스킨 | 기본 스킨을 상속한 하위 클래스를 다른 태그로 정의할 수 있음(`solad-video-skin` 선례). 로더는 render의 `skinTag`를 `skinTags` 맵으로 바꿔 씀 | `AM/public/player/solad-video-skin.js:190`, ✔`AM/public/player/loader.js:31` |
| 재생 정책 | extension은 클래스 단위로 따로 등록되고, 같은 클래스만 교체됨. LMS 클래스를 따로 두면 광고 클래스와 공존함(우선순위는 C2) | ✔`coordinator.ts:47-63` |
| 프리셋 | `playerType` enum 또는 최상위 그룹으로 나눌 수 있음. native/videojs처럼 타입별 거부 규칙을 이미 쓰고 있음 | `preset.js:224-236,328-346` |
| API | 공개 액션은 목록(`PUBLIC_ACTIONS`, reads/writes)으로 추가함. 광고 `events`와 다른 액션으로 두면 광고 스키마와 섞이지 않음 | ✔`AM/src/Http.php:9`, ✔`AM/src/App.php:28-35` |
| 서명 | 서버 비밀 `signing_key`가 있음. 서명 함수는 `Events` 안의 private 하나뿐이라 LMS 토큰을 따로 쓰려면 공용 헬퍼로 빼야 함 | ✔`AM/src/Database.php:96`, ✔`AM/src/Events.php:12-15` |
| 설치 코드 | 데모와 관리자 설치 코드가 줄 단위 동일성 테스트로 묶여 있음. LMS 설치 코드를 따로 두려면 테스트도 따로 필요 | `AM/tests/admin/examples.test.ts:346-382` |

- **제안:** LMS 전용 플레이어를 "LMS 스킨 하위 클래스 + LMS extension 클래스 + LMS 프리셋 타입 + LMS 전용 API와 테이블"로 묶으면 범용 경로(`solad-video-skin`, 광고 `events`, 기본 프리셋)는 바뀌지 않는다. 결정은 오케스트레이터 몫이다.
