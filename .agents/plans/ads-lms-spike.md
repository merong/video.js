# L-1 스파이크 결과: 강의(LMS) 플레이어 기능 (2026-10-22, ads-implementer)

명세 `ads-lms-spec.md` 7절 1–8과 덤 두 가지를 packages와 제품 코드를 고치지 않고 확인했다. 시험 페이지는 CDN 빌드(`public/assets/videojs/`)와 `/player/solad-video-skin.js`, `/assets/ads.js`, `/player/loader.js`를 그대로 불러온다.

- 격리 서버: `php -S 127.0.0.1:18791`, 문서 루트는 `integrations/ads-manager/public`(읽기만). 라우터는 `workspaces/ads-lms-20261022/spike/router.php`이고, API는 404를 돌려주므로 DB에 닿지 않는다. 작업 폴더는 scratchpad의 새 임시 폴더였다. 끝난 뒤 내 PID 35835만 내렸다.
- 라우터는 mp4에 Range(206)를 직접 준다. PHP 내장 서버는 Range를 무시하고, 그러면 Chromium에서 mp4 seek가 0으로 돌아간다(첫 실행에서 확인).
- Playwright 1.59.1(chromium, webkit, firefox)로 headless에서 돌렸다. 기준 화면은 900×620이다.
- 18765·18766 LISTEN 줄은 시작과 끝이 같다(PID 9878, 34509, 소켓 주소도 같음). 근거: `evidence/listen-start.txt`, `evidence/listen-end.txt`. 이 두 서버와 18810에는 요청을 보내지 않았다(스파이크 파일에 해당 포트 문자열이 없음).

경로 약어: `S/` = `workspaces/ads-lms-20261022/spike/`, `E/` = `S/evidence/`.

## 1. 항목표

| # | 항목 | 결론 | 근거 | 재현 |
| --- | --- | --- | --- | --- |
| 1 | 손으로 쓴 ES 모듈의 extension 등록과 `mediaOverride.currentTime` | **됨** | `registered:true`, store가 쓰는 media가 facade(`storeMediaIsReal:false`), 잘린 seek가 실제로 적용됨. 직접 조립과 `loader.js mount()` 둘 다 | `S/lms-spike.js:16-30,78-84,103-124`, `S/page.js`, `node S/run.cjs seek` / `seek-loader` → `E/seek-*.json` |
| 2 | 잘라서 쓰는 setter로 seek 끝나기 | **됨** | 모든 경로가 한계(11초)에서 멈춤, 매번 `seeked`, `state.seeking=false`, store 시각 = media 시각, 놓은 뒤 썸 위치 = 기대 위치(±0.01%). 안전망은 seeking 2번, seeked 1번으로 끝나고 루프 없음. 3개 브라우저(mp4), chromium은 hls·hlsjs·loader도 | `E/seek-{chromium,webkit,firefox}.json`, `E/seek-{hls,hlsjs,loader}-chromium.json`, `E/item2-after-drag-*.png` |
| 3 | `<media-ads>`와 override 순서(프리롤만) | **조건부** | 광고가 먼저 등록되면 광고 중 고정이 유지되고, 광고가 끝나면 LMS 자르기가 다시 동작함(3개 브라우저). LMS를 먼저 두고 양보하지 않으면 광고 중에도 LMS setter가 먼저 불림(충돌). `<media-ads>`는 다시 연결되면 맨 뒤로 재등록되므로, LMS가 광고 중에 스스로 null을 돌려줘야 함 | `E/ads-{adsfirst,lmsfirst-yield,lmsfirst-noyield,loader}-*.json`, `E/item3-during-ad-*.png` |
| 4 | 배속 상한 | **됨**(CSS와 `hidden`을 같이 쓸 때) | CSS만 쓰면 보이지는 않지만 메뉴 화살표 이동에 남아 키 입력 2번이 헛돎. `hidden` 속성을 붙이면 건너뜀. `>`·`<` 바인딩을 빼고 직접 처리하면 1→1.2→1.5에서 멈추고 0.2에서도 멈춤. 다른 단축키(m, ←, k)는 그대로. `ratechange` 되돌리기로 media와 store 모두 1.5 | `E/rate-keysoff-*.json`, `E/rate-keyson-chromium.json`, `E/rate-menu-{hidden,attr,all}-*.json`, `E/rate-store-3browsers.txt`, `E/item4-menu-keysoff-*.png` |
| 5 | 챕터 VTT(blob·data URL, `default`) | **됨** | 3개 브라우저 × `<video>`/`<hls-video>`/`<hlsjs-video>` × blob/data × 마운트 전/후 = 36개 모두 `chaptersCues=4`, 장 요소 4개, 미리보기 장 제목 표시. 단, SPF `<hls-video>`는 명세의 `content-fmp4.m3u8`을 못 읽어서 절대 URL `content-master.m3u8`로 확인함(아래 5절) | `node S/run.cjs chapters` → `E/chapters-*.json`, `E/item5-*.png`, `E/hls-probe.json` |
| 6 | 시간 슬라이더 사본에 시청 층·한계 표시 | **됨**(조건부: 챕터 틈) | 층의 위치와 크기가 챕터 track과 같고, 30% 지점 hit-test 결과는 track(층이 아님). 클릭·←/→·미리보기·채움·버퍼 그대로. CSS 변수 `--lms-start/--lms-end/--lms-limit`로 배치. 층이 챕터 사이 틈에도 칠해짐 | `S/lms-skin.js:72-82`, `S/lms-spike.js:233-253`, `E/layers-*.json`, `E/item6-*.png`, `E/item6-layers-player-chromium-slider-zoom.png` |
| 7 | seek indicator | **제안: 제한이 켜진 동안 뺀다** | 막힌 → 입력(0:11 그대로)에도 "› 10초"가 뜸(3개 브라우저 같음). 일부만 잘린 seek도 요청한 크기를 보임 | `E/item7-indicator-{on,off}-*.png`, `E/indicator-*.json` |
| 8 | `pagehide` 때 `fetch(keepalive, JSON)` | **조건부** | 이동, `window.close()`: 3개 브라우저 모두 fetch와 beacon(JSON Blob)이 `application/json`으로 도착(각 2회). 새로고침: chromium·webkit은 도착, firefox는 pagehide 처리기 자체가 실행되지 않음. Playwright `page.close()`: 3개 모두 도착 안 함. 실제 탭 닫기는 미확인 | `S/pagehide.html`, `S/beacon.php`, `E/pagehide-*.json`, `E/beacon-log.jsonl` |
| 덤 | 이어보기 오버레이와 컨트롤 `inert` 때 초점 | **조건부** | 첫 초점과 Tab 순서는 맞음. 그러나 초점이 오버레이 버튼에 있어도 플레이어 단축키가 먹음(k로 재생, →로 seek). 오버레이 keydown에서 전파를 막아야 함 | `E/overlay-*.json`, `E/extra-overlay-*.png` |
| 덤 | `b` 키 직접 처리 | **됨** | 기본 바인딩이 없어 coordinator와 부딪히지 않음. 한 번 눌러 한 번 기록(3개 브라우저). 플레이어 밖 입력칸에서 친 `>`는 무시됨 | `E/rate-keysoff-*.json`(key b, input), `E/overlay-*.json` |

## 2. 항목별 상세

### 2.1 등록 (항목 1)

- `context-request` 이벤트에 `context: Symbol.for('@videojs/extension')`와 `callback`을 담아, `<video-player>` 안 light DOM에 있는 media에서 bubbles·composed로 보낸다(`S/lms-spike.js:16-30`). provider(`packages/html/src/player/element.ts:136-139`)가 같은 틱에 `{ registerExtension }`을 준다.
- 등록하면 coordinator가 attach하고(`coordinator.ts:47-58`), override가 있으므로 store를 facade로 다시 붙인다. 그 뒤 `player.store.target.media !== media`가 된다(`E/seek-chromium.json` `facade`).
- 로더 모드에서는 `mount()`가 끝난 뒤 `handle.media`에서 같은 방식으로 요청했고 결과가 같다(`E/seek-loader-chromium.json`). 로더 기본 render에는 ±초 버튼이 없어서 그 두 단계는 해당이 없다(시간 초과로 기록됨).
- 의존하는 것은 모두 내부 API다: context 키, `PlayerExtension.mediaOverride`(`media.ts:16-21` `@internal`), facade의 첫 번째 우선 규칙(`media.ts:60-69`).

### 2.2 seek (항목 2)

`watched=10`이므로 허용 한계는 11초다. 아래는 chromium mp4 결과이고, webkit·firefox·hls·hlsjs도 같다.

| 경로 | 결과(media/store) | 이벤트 |
| --- | --- | --- |
| `store.seek(30)` | 11 / 11 | seeking, seeked |
| 슬라이더 드래그 10%→80%를 놓음 | 11 / 11, 썸 30.556% | 누름 때 seek 1번, 놓을 때 잘림 1번 |
| 슬라이더 90% 클릭 | 11 | seeked |
| 숫자 8, End, →, l, +10 버튼, 마우스 더블클릭(오른쪽) | 모두 11 | 매번 seeked |
| Home, ←, −10 버튼 | 0, 1, 1(뒤로는 자유) | seeked |
| 실제 media에 직접 `currentTime=30`(안전망) | 11 | seeking, seeking, seeked(되돌림 1번, 루프 없음) |
| 재생 중 `seek(30)`, 직접 `=33` | 한계로 잘리고 재생은 이어짐 | seeked |

- 잘린 setter도 한계값을 **실제로 쓴다**. 그래서 `time.seek()`가 기다리는 `seeked`가 온다(`time.ts:36-39`).
- 막힘 알림은 2초에 한 번만 나므로 일부 단계에는 `seek-blocked`가 없다(의도한 동작).
- Firefox 1회차에서 `숫자 8` 뒤 1.2초가 지나도 썸이 58%에 있었다(store와 media는 11). 2·3회차에서는 다시 나오지 않았다(`E/seek-firefox-run{1,2,3}.json`). 원인은 미확인이다.

### 2.3 광고와 순서 (항목 3)

| 변형 | 광고 중 `store.seek(20)` | 광고 중 직접 `=20` | 광고 뒤 |
| --- | --- | --- | --- |
| ads 먼저(3개 브라우저), loader | 본편 그대로(광고 no-op setter) | ads가 되돌림 | 잘림·안전망 동작, `start`·`complete` |
| LMS 먼저 + 양보(`[data-ads-overlay]`가 있으면 null) | ads 먼저와 같음 | 같음 | 같음 |
| LMS 먼저 + 양보 안 함 | **LMS setter가 먼저 불려** 본편을 한계로 옮김 → ads가 다시 되돌림 | 같음 | 같음 |

- 광고 시간은 진도에 들어가지 않았다(본편 약 2.5초 재생 뒤 `maxWatched≈2.4`).
- 순서를 고정할 수 없다. `<media-ads>`는 연결이 끊겼다 다시 붙으면 해제 후 재등록한다(`packages/extensions/ads/src/html/element.ts:99-127`). coordinator Map에서는 재등록한 것이 뒤로 간다(`coordinator.ts:47-54`).
- 양보 조건으로 쓴 overlay는 광고 시도보다 먼저 생기고 시도가 끝난 뒤 없어진다(`controller.ts:365,388,646-660`). 그래서 시도 구간 전체를 덮는다. 다만 이것은 광고 확장의 DOM 내부 사항이다.
- 광고 확장 쪽에서 본 별도 사항(LMS와 무관): 광고 중 `store.seek()`를 부르면 store가 `currentTime:20, seeking:true`로 남는다(썸 55%). 다음 `seeked`가 올 때까지 그대로다. 광고 화면이 컨트롤을 덮으므로 사용자 경로로는 드물다. ads 담당 과제로 따로 적는다.
- 미드롤 영향은 보지 않았다(프리롤만 편성).

### 2.4 배속 (항목 4)

- radio group이 항목마다 `data-rate`를 단다(`packages/html/src/ui/playback-rate-radio-group/element.ts:38`). 사본 CSS `media-menu-radio-item[data-rate="1.7"], …[data-rate="2"] { display: none }`로 숨겨진다.
- 메뉴 화살표 이동은 `hidden`, `data-hidden`, `aria-hidden="true"`만 건너뛴다(`packages/core/src/dom/ui/menu/menu.ts:147-161`). CSS만 쓰면 ↓로 1.5에서 2번, ↑로 "속도"에서 2번 초점이 움직이지 않는다(`E/rate-menu-hidden-*.json`). `hidden`을 달면 바로 건너뛴다(`E/rate-menu-attr-*.json`).
- radio group은 로케일이 바뀌면 항목을 다시 만든다(`radio-options/controller.ts:71-95`). 그래서 MutationObserver로 다시 단다(`S/lms-skin.js:86-98`).
- 기본 바인딩을 남겨 두면 문제가 생긴다(`E/rate-keyson-chromium.json`). 1.5에서 `>`는 1.7이 됐다가 1.5로 되돌아가며 `ratechange`가 2번 난다. 0.2에서 `<`는 2로 돌았다가 1.5로 되돌아간다(갑자기 빨라짐). 또 coordinator가 먼저 처리하고 `preventDefault`하므로 직접 처리기는 건너뛰어진다(`hotkey/coordinator.ts:168`).
- 기본 바인딩을 빼면(`S/lms-skin.js:65-68`) 직접 처리기(`S/lms-spike.js:260-282`)만 동작한다. 0.2와 1.5에서 멈추고 돌지 않는다.
- 관찰(미확인): 헤드리스 chromium에서 속도 하위 메뉴의 ↓가 한 번에 두 칸 움직였다. 숨김이 없을 때도 같았다(`E/rate-menu-all-ArrowDown-chromium.json`). ↑는 한 칸씩 움직였다.

### 2.5 챕터와 HLS (항목 5)

- 기본 `<video>`에서는 `default` 챕터 트랙의 mode가 `showing`이고, 커스텀 media에서는 `hidden`이다. 두 경우 모두 cue 4개가 store에 들어간다.
- "마운트 후"는 등록하고 0.5초 뒤에 track을 붙인 경우다. 이 경우도 `addtrack`·`load` 동기화로 들어갔다(`text-track.ts:192-213`).
- SPF `<hls-video>`(`E/hls-probe.json`, 3개 브라우저 같음):

| src | `<hls-video>` | `<hlsjs-video>` |
| --- | --- | --- |
| `/demo-media/content-fmp4.m3u8`(상대, media playlist) | 재생목록만 받고 멈춤(duration null) | 됨 |
| 같은 것, 절대 URL | 멈춤 | 됨 |
| `/demo-media/content-master.m3u8`(상대) | 멈춤 | 됨 |
| 같은 것, 절대 URL | **됨** | 됨 |

  LMS와 직접 관계는 없지만 로더와 데모에도 영향이 있다(6절 위험 참조). 원인은 보지 않았다(packages 범위).

### 2.6 시청 층 (항목 6)

- 자리: `media-time-slider`의 첫 자식으로 `div.lms-slider-layers`(`aria-hidden`, `pointer-events:none`)를 넣는다. 크기는 `top:50%`, `height: var(--media-spacing)`, `translate:0 -50%`이다. 앞에 두므로 챕터 track·버퍼·채움이 위에 그려진다.
- 측정값(chromium): 층은 x227 y430 w371 h4이고, 챕터 track 4개도 모두 같다. 구간 [0,14]은 w144, [22,26]은 x454 w41이다. 한계 막대는 x381이고 15초다.
- 동작: 25% 클릭은 9초로 이동했다. 초점을 둔 슬라이더에서 ←/→는 1초씩 움직였다. hover 미리보기 장 제목은 "3장 실습"이었다. 재생 뒤 구간도 늘었다([0,15.1]).
- 남은 점: 층이 챕터 사이 틈(약 2px)에도 칠해진다(zoom 이미지). 사본에서 장 track마다 층을 넣는 방법은 보지 않았다.

### 2.7 seek indicator (항목 7)

- 막힌 seek에도 `data-direction="forward"`, `data-open`, "10초"가 표시된다. 시간은 0:11 그대로다(`E/item7-indicator-on-chromium.png`).
- `lms-indicator="off"`로 사본에서 빼면 아무것도 뜨지 않는다. 막힘 알림이 그 역할을 한다.
- 명세 10절 3번("막힘 알림과 겹치면 뺀다")에 따라 **뺀다**를 제안한다.

### 2.8 pagehide (항목 8)

| 방법 | chromium | webkit | firefox |
| --- | --- | --- | --- |
| 다른 주소로 이동 | 둘 다 도착 ×2 | 둘 다 도착 ×2 | 둘 다 도착 ×2 |
| `reload()` | 둘 다 도착 ×2 | 둘 다 도착 ×2 | 안 옴(pagehide 처리기 미실행, sessionStorage 비어 있음) |
| 팝업 `window.close()` | 둘 다 도착 ×2(opener가 pagehide 메시지 받음) | 같음 | 같음 |
| `page.close({runBeforeUnload:true})` | 안 옴 | 안 옴 | 안 옴 |

- 받은 요청은 `Content-Type: application/json`, `Sec-Fetch-Mode: cors`이고 JSON으로 읽혔다. sendBeacon도 Blob 타입이 `application/json`이면 JSON으로 도착한다(문자열 beacon은 보지 않았다).
- `page.close()`와 firefox `reload()`에서는 처리기가 실행되지 않은 것으로 보인다. Playwright가 대상을 닫는 방식의 한계로 추정하지만 확인하지 않았다.

### 2.9 이어보기 오버레이와 초점 (덤)

- 오버레이를 `media-container` 안에 두고 `media-controls`에 `inert`를 주었다. 첫 초점은 "이어보기"였다.
- Tab 순서:
  - chromium: 처음부터 → 페이지 입력칸 → body → `media-container`(컨테이너 자체가 Tab 순서에 있음).
  - webkit: 기본 설정이라 버튼을 건너뛴다.
  - firefox: 입력칸에서 멈췄다(Playwright 동작으로 보임).
- 초점이 오버레이 버튼에 있어도 컨테이너 단축키가 먹었다. `k`는 재생을 시작했고 `→`는 seek(11로 잘림)했다. 광고 오버레이는 host keydown에서 `stopPropagation()`해서 이를 막는다(`packages/extensions/ads/src/dom/overlay.ts:340-341`). `lockInteractions`(`core/src/dom/ui/interaction-lock.ts`)는 CDN 공개 API가 아니어서 손으로 쓴 모듈에서는 쓸 수 없다.

## 3. L-2에서 쓸 방법 (제안)

1. **등록**: `lms.js`가 마운트 뒤 media에서 context 요청을 보낸다. 반환된 release는 destroy에서 부른다. 요청이 값을 받지 못하면(`registered=false`) LMS 규칙을 끄고 경고한다. 연결 전에 요청하는 경우는 보지 않았다.
2. **override**: `currentTime` getter·setter만 덮는다. setter는 `min(value, maxWatched + 1)`을 **실제로 쓴다**. 광고 중(`container > [data-ads-overlay]`가 있을 때), 완료 뒤, 미리보기 제한이 없을 때는 `null`을 돌려준다. 등록 순서에 기대지 않는다.
3. **안전망**: 실제 media의 `seeking`에서 한계 + 0.5초를 넘으면 한 번 되돌린다. 되돌리는 중임을 표시하는 플래그를 두고 `seeked`에서 푼다.
4. **템플릿 사본**: `solad-video-skin.js` 방식으로 `connectedCallback`에서 `lms-*` 속성을 한 번 읽는다.
   - `>`·`<` hotkey를 제거한다.
   - 제한이 켜지면 `media-seek-indicator`를 제거한다.
   - 슬라이더에 층을 넣는다.
   - 배속 CSS를 넣고, MutationObserver로 `hidden`을 단다.
5. **배속**: `ratechange`에서 상한으로 되돌린다. `>`·`<`·`b`는 `media-container` keydown에서 직접 처리한다. 수식키, 편집 가능한 대상, `defaultPrevented`이면 건너뛴다.
6. **챕터**: data URL을 권한다. revoke가 필요 없고, 장 100개 이하라 크기가 작다. track은 마운트 전에 media에 붙인다(로더 `buildVideojs`의 thumbnails·captions와 같은 자리).
7. **이어보기 오버레이**: host keydown에서 `stopPropagation()`한다. Tab과 Esc는 오버레이가 직접 처리한다. 컨트롤 `inert`는 그대로 둔다.
8. **보고**: `pagehide`에서 `fetch(keepalive)` JSON을 한 번 보내고, `visibilitychange`가 hidden이 될 때도 보고한다(명세의 `hidden`). `page.close`류에서 pagehide가 오지 않을 수 있으므로, hidden 보고가 마지막 상태를 주로 보내는 쪽이 된다.

코드 스케치(시험한 형태를 줄인 것, 전체는 `S/lms-spike.js`):

```js
const registrar = requestRegistrar(media); // context-request, Symbol.for('@videojs/extension')
const release = registrar?.registerExtension({
  attach: ({ media }) => lms.attachMedia(media),
  detach: () => lms.attachMedia(null),
  get mediaOverride() {
    if (!lms.media || !lms.limiting || container.querySelector(':scope > [data-ads-overlay]')) return null;
    return clampOverride; // { get currentTime(), set currentTime(v) { real.currentTime = Math.min(v, lms.allowed) } }
  },
});
// 주의: coordinator는 생성자(클래스)마다 하나만 둔다. 객체 리터럴은 Object 생성자를 공유하므로, 실제로는 S/lms-spike.js처럼 전용 class를 쓴다.
```

## 4. 명세 2절에서 바꿀 점 (제안)

| 자리 | 지금 | 제안 | 이유 |
| --- | --- | --- | --- |
| 2.4 seek indicator 줄 | 스파이크 결과로 정함 | "본 곳까지만이 켜져 있으면 템플릿 사본에서 `media-seek-indicator`를 뺀다. 완료 뒤에도 다시 넣지 않는다(다시 마운트할 때 반영)" | 막힌 seek에도 "› 10초"가 떠서 막힘 알림과 어긋남(2.7) |
| 2.4 본 곳까지만, 막는 자리 | override setter + 안전망 | "광고 overlay가 있는 동안 LMS override는 `null`을 돌려준다. 등록 순서에 기대지 않는다"를 더한다 | `<media-ads>` 재등록 때 순서가 바뀜(2.3) |
| 2.4 최대 배속, 숨김 | "숨긴다" | "CSS로 숨기고 `hidden` 속성도 단다(메뉴 화살표 이동에서 빠지게). 항목을 다시 만들면 다시 단다" | CSS만 쓰면 키 입력이 헛돎(2.4) |
| 2.5 챕터 | blob/data 중 스파이크로 정함 | "data URL `text/vtt`로 붙인다" | 둘 다 됨. data URL은 revoke가 필요 없음 |
| 2.3 이어보기 `ask` | 오버레이가 떠 있는 동안 컨트롤은 `inert` | "오버레이 keydown은 플레이어로 전파하지 않는다(광고 오버레이와 같다)"를 더한다 | `inert`만으로는 단축키가 먹음 |
| 2.6 시청 층 | 자리 미정(10절 2) | "`media-time-slider` 첫 자식, 높이 `--media-spacing`, 위치는 `--lms-start/--lms-end/--lms-limit`. 챕터 틈 처리는 L-2에서 정한다" | 입력·챕터·미리보기에 영향 없음(2.6) |
| 2.7 pagehide | fetch keepalive 한 번 | 그대로 두고, "탭 숨김(`hidden`) 보고가 마지막 상태를 주로 보내는 쪽이다"를 적는다. 서버가 `application/json` beacon을 받아도 되는지는 서버 담당이 정한다 | `page.close`류에서 pagehide가 오지 않는 경우가 있음(2.8) |

## 5. 가장 큰 위험 3개

1. **내부 API 의존.** context 키, `mediaOverride`(`@internal`), facade의 첫 번째 우선 규칙, `[data-ads-overlay]`에 기댄다. Video.js를 올리면 소리 없이 깨질 수 있다. 대책: CDN 자산을 갱신할 때마다 이 스파이크의 `seek`과 `ads` 시나리오를 다시 돌린다.
2. **광고와 겹침.** 양보하지 않거나 overlay 판별이 바뀌면 광고 중에 본편 seek가 일어나고 광고가 이를 되돌린다(2.3). 광고 쪽 표시가 바뀌면 LMS의 광고 중 판정도 같이 바꿔야 한다.
3. **마지막 진도 손실.** 실제 탭 닫기·브라우저 종료에서 pagehide 전송은 확인하지 못했다. Playwright `page.close()`에서는 3개 브라우저 모두 도착하지 않았다. 15초 주기와 hidden 보고 사이에 생긴 진도는 잃을 수 있다.

별도 발견(LMS 밖, 오케스트레이터 판단 필요): SPF `<hls-video>`가 상대 URL과 media playlist를 읽지 못한다(2.5 표). 로더는 `pageUrl()`로 절대 URL을 만들지만(`loader.js:450`), `data-src`가 media playlist이고 엔진이 `hls-video`이면 재생되지 않을 수 있다.

## 6. 남은 미확인

- 실제 브라우저의 탭 닫기와 종료, firefox 새로고침에서 pagehide 전송(Playwright 한계로 추정).
- 터치 더블탭, OS 미디어 키, PiP 창 seek. 안전망은 실제 media에 직접 쓰는 방식으로만 확인했다.
- 미드롤·포스트롤과 잘린 seek의 관계(프리롤만 봄).
- `<video-player>`가 연결·정의되기 전에 context 요청을 보낸 경우.
- Firefox 썸 58% 1회(3번 중 1번), 헤드리스 chromium 속도 메뉴 ↓ 두 칸 이동.
- 시청 층의 챕터 틈 처리, 좁은 화면(390px)과 실제 기기.
- keepalive 본문 64KB 한도와 `segments` 크기.
- SPF `<hls-video>`가 상대 URL과 media playlist를 못 읽는 원인.

## 7. 파일

- 시험 코드(`S/`):
  - `router.php`, `beacon.php`: 격리 서버 라우터(Range 포함)와 pagehide 수신 기록.
  - `lms-spike.js`: context 등록, 자르는 override, 안전망, 배속 되돌리기, 키 처리, 시청 층 칠하기, 챕터 VTT와 track 만들기.
  - `lms-skin.js`: `spike-lms-skin` 템플릿 사본(`lms-rate-keys`, `lms-indicator`, `lms-layers`, `lms-max-rate`, `lms-rate-hide`).
  - `page.html`, `page.js`: query로 시나리오를 고른다(media, mode, ads, order, yield, chapters, chapAt, maxRate, rateHide, watched, indicator, rateKeys, layers, keys).
  - `pagehide.html`, `preroll.json`(grok 편성에서 프리롤 1개만 남긴 것).
  - `run.cjs`: 시나리오 `seek`, `seek-hls`, `seek-hlsjs`, `seek-loader`, `ads`, `rate`, `rate-menu`, `chapters`, `layers`, `indicator`, `overlay`, `pagehide`. 실행은 `node run.cjs <scenario> <browser>`이고 서버가 18791에 떠 있어야 한다.
  - `hls-probe.cjs`, `smoke.cjs`.
- 증거(`E/`): 시나리오별 JSON, 스크린샷(`item2`–`item7`, `extra-overlay`), `beacon-log.jsonl`, `hls-probe.json`, `rate-store-3browsers.txt`, `server-requests.log`, `listen-start.txt`, `listen-end.txt`.
