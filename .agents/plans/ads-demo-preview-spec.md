# 데모 페이지·관리자 미리보기 보강 계약 (A2-D)

2026-10-21 사용자 요청: 예제 페이지와 관리자 미리보기를 바뀐 디자인과 기능(A2-1)에 맞춰 보강한다. 플레이어 데모에 설명서와 도움말(설정 옵션 포함)을 더한다. 데모는 프리셋을 미리 골라 두고 바꿀 수 있다. 기존 `public/examples/`는 모두 지우고 다시 만든다.

## 1. 결정

| 번호 | 결정 |
| --- | --- |
| D-1 | `public/examples/`의 파일을 모두 지우고 새로 만든다. `public/assets/admin/`와 `public/demo-media/`는 그대로 둔다. |
| D-2 | 데모의 프리셋 목록은 두 경우로 나뉜다. 누구나 내장 3개와 사이트 적용 프리셋을 고를 수 있다. 같은 출처에서 관리자로 로그인했으면 저장 프리셋 전부가 더해진다(기존 `player-presets` 읽기). 공개 API는 늘리지 않는다. |
| D-3 | 데모에서는 프리셋을 미리 골라 두고(사이트 적용 또는 `?preset=`), 다른 프리셋으로 바꿀 수 있다. 설정 옵션도 바로 바꿀 수 있다. 저장하지 않으며, 지금 설정에 맞는 설치 코드를 보여 준다. |
| D-4 | 데모와 관리자 미리보기는 Grok 샘플 raw 편성으로 재생하고 통계를 남기지 않는다. 실제 게시 편성으로 재생하고 통계를 수집하는 재생 테스트 페이지는 따로 만든다. 관리자 "재생 테스트 링크"는 이 페이지를 연다. |
| D-5 | 모든 플레이어 페이지는 `player/loader.js` 하나로 만든다. 예제마다 따로 쓴 만들기 코드를 두지 않는다. |
| D-6 | 화면은 `design/`(솔애드 관리자 디자인 시스템)을 따른다. 공개 페이지는 빌드 산출물 `assets/admin-app/design.css`(fonts → tokens → bundle 순서)를 불러온다. 페이지 CSS는 배치만 쓰고 색·간격·모양은 토큰만 쓴다. |

## 2. 페이지 (`public/examples/`, 설치 경로 `/ads/examples/`)

| 파일 | 하는 일 | 통계 |
| --- | --- | --- |
| `index.html` | 플레이어 데모. 프리셋 고르기, 설정 옵션, 플레이어, 광고 진행 기록, 설치 코드. 설명서·도움말로 가는 길 | 없음 |
| `guide.html` | 설명서. 설치와 운영 순서 | 해당 없음 |
| `help.html` | 도움말. 설정 옵션 참조(4절) | 해당 없음 |
| `play-test.html` | 재생 테스트. `?video=&type=videojs\|native&media=mp4\|hls&engine=spf\|hlsjs&content=&preset=`. 실제 게시 편성 | 수집 |
| `preview.html` | 관리자 미리보기 iframe(6절). 단독으로 열면 안내만 보인다 | 없음 |

- 공통 파일은 `examples/` 안에 둔다(예: `demo.css`, `demo.js`, `options.js`). 손으로 쓴 ES 모듈이고 빌드하지 않는다. `innerHTML`에 값을 넣지 않는다.
- 데모와 미리보기의 샘플은 `public/demo-media/grok-20261018/`이다.
  - 본편은 `content-scene-01.mp4`, 편성은 `schedule.json.js`(raw JSON)이고, 영상 ID는 `grok-demo-scene-01`이다.
  - 이 폴더는 Git에 없다. 없으면 데모와 미리보기는 대체 소재를 만들지 않는다. "샘플 미디어가 없습니다"와 준비 방법을 보이고, 플레이어 자리를 비운다.
  - 편성 안의 광고 주소는 `/demo-media/…`로 시작한다. 그래서 서버 루트가 `public/`일 때만 광고가 나온다. 이 제약을 README와 설명서에 적는다.
- 세 문서 페이지(`index`·`guide`·`help`)는 같은 위쪽 탐색을 쓴다. 현재 페이지는 `aria-current="page"`로 표시한다. 문서 페이지는 왼쪽 목차(좁은 폭에서는 위)를 둔다.
- 390·768·1280에서 가로 스크롤이 없다. 긴 코드와 표는 안에서 스크롤한다. 키보드로 모든 조작을 할 수 있고, `prefers-reduced-motion`을 따른다.
- `play-test.html`은 이전 `player.html`·`videojs.html`의 일을 한 페이지에서 한다.
  - 플레이어·미디어·엔진 전환 링크는 다른 쿼리를 유지한다.
  - 프리셋은 `preset`, 없으면 사이트 적용 프리셋이다.
  - 다른 플레이어용 프리셋이면 로더처럼 기본값으로 재생하고 이유를 보인다.
  - 이 페이지가 실제 수집 API로 보낸다는 안내를 화면에 둔다.

## 3. 데모 `index.html`

- **처음 상태:** `?preset=<id>`가 있으면 그 프리셋을 고른 채로 시작한다. 없으면 사이트 적용 프리셋을 고른 채로 시작한다.
- **프리셋 목록:**
  - 내장은 고정 이름(기본, 둥근 테두리, 강조색)으로 보인다.
  - 사이트 적용 프리셋은 로그인하지 않았으면 "사이트 적용 프리셋"으로 보인다.
  - 로그인했으면 `player-presets`의 이름과 "(사이트 적용)" 표시가 보인다.
  - `player-presets`가 401·403이면 조용히 공개 목록만 쓴다. 다른 오류면 목록 아래에 한 줄 안내한다.
- **설정 옵션(저장 안 함):**
  - 바꿀 수 있는 것: `autoplay`, `muted`, `loop`, `preload`, `language`(비움·ko·en·ja·zh-CN), 페이지 언어(language를 비웠을 때 따를 값), 포스터 표시와 포스터 주소, 제목 표시와 제목, 썸네일 VTT, 미디어(MP4·HLS)와 HLS 엔진.
  - 바꾼 값은 로더의 `overrides`(프리셋 필드)와 자리 요소 값(`data-*`)으로 넘긴다.
  - 자동재생을 켜면 음소거는 켜진 채 잠기고 이유가 보인다. 로더 규칙과 같다.
  - "프리셋 값으로 되돌리기"가 있다.
- **플레이어:**
  - 고른 프리셋 또는 옵션이 바뀌면 플레이어를 다시 만든다. 테마만 바뀌면 다시 만들지 않아도 된다.
  - 장면 바로가기: 처음부터 / 미드롤 앞 / 끝 직전.
  - 폭 보기: 좁게 390, 보통 768, 넓게(자리 폭). 보이는 크기가 자리보다 크면 줄여 보이고, 줄인 비율을 글자로 표시한다.
- **광고 진행 기록:** `ads-event`를 받아 최근 20개를 보인다(시간, 위치 pre/mid/post, 종류). 통계를 남기지 않는다는 안내를 붙인다.
- **설치 코드:**
  - 지금 상태에 맞는 로더 설치 코드(자리 요소 + 로더 한 줄)와 JS API 예를 보이고 복사할 수 있다.
  - 사이트 적용 프리셋이면 `data-preset`을 빼고, 다른 프리셋이면 넣는다.
  - 프리셋과 같은 값은 `data-*`로 쓰지 않는다.
  - 결과는 관리자 `loaderSnippet`과 같은 꼴이다(7절 테스트).
- **주소 상태:** 고른 프리셋과 바꾼 옵션을 쿼리에 담는다(`history.replaceState`). 주소를 열면 같은 상태가 된다. 잘못된 쿼리 값은 무시하고 안내 한 줄을 남긴다.

## 4. 도움말 `help.html`와 설명서 `guide.html`

- **도움말 절:**
  1. 설치 코드 두 줄
  2. 자리 요소 `data-*` 전체
  3. JS API(`mount` 옵션, `destroy`, `onEvent`, `onError`)
  4. 이벤트(`solad-ready`, `solad-error`, `ads-event`)와 오류 코드
  5. 값의 우선순위(overrides > `data-*` > 프리셋 > 기본값)
  6. 자동재생과 음소거 규칙
  7. 언어 정리 규칙(스키마 계약 4.4절)
  8. 프리셋 설정 옵션 전체: 필드, 받는 값, 기본값, 설명, 적용 단계
  9. 실패 처리(3초, 기본값, 경고 1회)
  10. 같은 출처 제한
- **적용 단계 표시:**
  - A2-1에서 화면에 적용하는 값: 테마, 재생 동작, 표시, 언어, 광고 문구 3개, `timeouts`.
  - 검증만 하는 값(`input`·`controls`·`logo`·`progress`·나머지 광고 문구)은 "준비 중(A2-2)" 또는 "준비 중(A2-3)"으로 글자 표시한다.
- **옵션 표의 원본:**
  - `examples/options.js`의 데이터 하나로 만든다. 데모의 옵션 칸 설명도 같은 데이터를 쓴다.
  - 표는 두 가지다.
    - 설치 옵션: 관리자 `ui/src/player/player-options.ts`의 `playerOptions` 행(data-*, 요소 속성, JS API, CSS 변수)과 이름·받는 값·기본값이 같아야 한다.
    - 프리셋 필드: `ui/src/player/preset.ts`의 `DEFAULT_PLAYER_PRESET`와 검증 규칙과 필드 경로·기본값이 같아야 한다.
    - 둘 다 7절 테스트로 묶는다.
  - `playerOptions`의 `exampleQuery` 묶음은 새 페이지(`play-test.html`, `index.html`)의 쿼리로 고친다.
- **앵커 규칙:**
  - 설치 옵션은 `#opt-<이름>`이다. 이름에서 앞의 `--`를 빼고 영문 소문자·숫자·`-`만 남긴다(예: `#opt-data-preset`, `#opt-media-ads-accent-color`).
  - 프리셋 필드는 `#field-<경로>`이다. 점을 `-`로 바꾼다(예: `#field-playback-autoplay`).
  - 절은 `#install`, `#attributes`, `#js-api`, `#events`, `#precedence`, `#autoplay`, `#language`, `#preset-fields`, `#failure`, `#same-origin`이다.
  - 앵커 함수는 관리자(`ui/src/player/`)와 데모(`examples/options.js`)에 하나씩 둔다. 모든 행에서 두 함수의 결과가 같은지 테스트한다.
- **설명서:**
  1. 이 매니저가 하는 일
  2. 설치 순서(같은 출처, 로더 두 줄, 자리 요소)
  3. 프리셋 만들기·복제·사이트 적용
  4. 지면 편성과 게시
  5. 재생 테스트로 확인하기
  6. 그누보드에서 쓰기(지금 되는 것과 준비 중인 것)
  7. 예전 정적 코드에서 옮기기
  8. 문제 해결(콘솔 `[solad]` 경고, 304, 자동재생이 막힐 때)
- 문장은 한국어이고, 관리자 도움말(`ui/src/help/terms.ts`)과 같은 용어를 쓴다(예: 사이트 적용 프리셋, 자리 요소, 로더). 용어가 다르면 관리자 쪽을 따른다.
- 각 옵션과 절에는 위 앵커 규칙의 고정 앵커가 있다. 관리자 화면이 이 앵커로 링크한다.

## 5. 로더 미리보기 모드 (`public/player/loader.js`)

`mount(element, { ..., preview })`에 미리보기 전용 옵션을 더한다. 사이트 설치용이 아니고, 도움말에는 "미리보기 전용"으로 적는다.

```js
await mount(element, {
  src, videoId, poster, title, thumbnails, engine, lang, overrides, onEvent, onError,
  preset,                 // id (지금과 같음)
  preview: {
    schedule,             // raw 편성: 같은 출처 URL 문자열 또는 편성 객체(schedule-preview 응답 포함)
    preset,               // 선택: 저장하지 않은 전체 프리셋 객체. 있으면 프리셋 요청을 하지 않고 parsePlayerPreset로 검증한 렌더를 쓴다
  },
});
```

- `preview`가 있으면 통계를 보내지 않는다. 확인한 근거:
  - `<media-ads src>`가 envelope가 아닌 raw 편성을 받으면 `tracking`이 없는 세션을 만든다(`packages/extensions/ads/src/html/element.ts:270-276`).
  - tracking이 없거나 `preview: true`이면 이벤트 큐를 만들지 않는다(`packages/extensions/ads/src/dom/controller.ts:161`).
  - 그래서 Video.js에 URL 편성을 넘기면 `<media-ads src>`에 그 raw 편성 URL을 넣는다. native는 `createAdsController({ preview: true })`를 쓴다.
- 편성 객체(관리자 `schedule-preview` 응답)를 Video.js에 넘기는 방법은 구현이 정한다.
  - `<media-ads src>`는 같은 출처 경로나 http(s) URL만 받는다. `blob:`은 받지 않는다(`packages/extensions/ads/src/core/url.ts:5`).
  - 후보는 Video.js 미디어와 스킨에 `createAdsController({ preview: true })`를 붙이는 방법이다. 이 방법이 `<media-ads>`와 같은 광고 화면(컨트롤 숨김, 건너뛰기, 문구)을 내는지 확인한다.
  - `packages/extensions/ads`를 고쳐야 하면 고치기 전에 오케스트레이터에게 묻는다.
- `preview.preset`이 틀리면 기본값으로 만들고 `onError`(`invalid_preview_preset`)로 알린다.
- `lang` 옵션(또는 `data-lang`)은 4.4절의 "자리 요소 lang"보다 앞선다. 이미 있으면 그대로 쓴다.
- 핸들에 미리보기 전용 메서드를 둔다.
  - `handle.seek(target)`: `target`은 `'start' | 'before-midroll' | 'before-end'`. 미드롤 위치는 편성에서 읽는다.
  - 핸들이 테마만 바꾸는 메서드를 가질지는 구현이 정한다. 없으면 데모와 미리보기가 다시 만든다.

## 6. 관리자 미리보기 보강

- **편집기 미리보기(`ThemePreview` → 플레이어 미리보기):**
  - `examples/preview.html` iframe이 편집 중인 프리셋 전체를 적용한다.
  - 적용 범위: 테마, 재생 동작, 표시, 언어, 광고 문구, `timeouts`. 테마·문구는 다시 만들지 않고 적용하고, 나머지는 다시 만든다.
  - 메시지는 같은 출처만 주고받는다. 받는 쪽은 `event.origin`과 `event.source`를 둘 다 검사한다.
    - 부모 → 프레임
      - `{type:'ads-player-preview', preset, pageLang?, schedule?, content?, title?}`
        - `preset`은 전체 프리셋 객체다. 프레임이 `parsePlayerPreset`로 다시 검사한다.
        - `schedule`(raw 편성 객체)과 `content`(본편 주소)를 함께 주면 Grok 샘플 대신 그것을 재생한다. 지면 편성 미리보기가 쓴다.
        - `content`는 로더 `data-src`와 같은 규칙이다. `/경로` 또는 http(s) 주소를 받고, 다른 출처 본편도 된다.
        - `title`(A2-D-FIX): 본편 제목. 로더 `data-title`과 같은 규칙(앞뒤 공백을 뺀 글, 제어 문자 없음)이고, 틀리면 없는 것으로 본다.
      - 프레임은 프리셋의 "포스터 표시·제목 표시"가 보이도록 mount에 `title`·`poster`를 넘긴다(A2-D-FIX, 결함 A2D-02).
        - 샘플: 제목은 `SAMPLE_TITLE`, 포스터는 Git에 넣는 자리 그림 `examples/sample-poster.svg`
        - 부모가 준 본편: 제목은 `title`, 없으면 편성의 `videoId`. 포스터는 같은 자리 그림
        - 표시를 켜고 끄는 것은 다시 만들어 반영한다. 미리보기 전용 값이라 설치 코드나 데모 주소 상태에는 넣지 않는다.
        - 부모는 프레임의 `load`마다, 그리고 값이 바뀔 때마다 보낸다(지금과 같음).
      - `{type:'ads-player-preview-command', command:'restart'|'start'|'before-midroll'|'before-end'}`
    - 프레임 → 부모
      - `{type:'ads-player-preview-status', status:'loading'|'ready'|'error'|'missing-sample', message, reason?}`
        - `reason`(A2-D-FIX): `missing-sample`일 때만 `'missing'|'invalid'`. 샘플 편성 파일의 형식이 틀리면 `invalid`이고, 관리자는 그에 맞는 문구를 보인다.
      - `{type:'ads-player-preview-event', event:{kind, position, at, index, count}}`
        - `index`·`count`는 그 광고가 광고 구간 안에서 몇 번째인지(1부터)와 광고 수다. 프레임이 편성의 `breakId`·`itemId`로 계산한다. 관리자는 "프리롤 1/2 · 시작"처럼 보인다.
    - 프레임 주소는 `preview.html?type=videojs|native`이다. 플레이어 종류가 바뀔 때만 주소가 바뀐다.
  - 미리보기 아래에 다음을 둔다.
    - 장면 바로가기 3개
    - 폭 보기(좁게 390 / 보통 768 / 넓게). 자리보다 크면 줄여 보이고 비율을 글자로 보인다.
    - language가 비었을 때 따를 페이지 언어 고르기
    - 최근 광고 진행 한 줄("프리롤 1/2 재생 중" 같은)
  - "데모에서 열기"는 저장된 프리셋만 된다(`examples/index.html?preset=<id>`, 새 창). 저장하지 않은 입력이 있으면 비활성이고 이유를 보인다.
  - 내장 프리셋 읽기 전용 화면(A2-D-FIX)도 같은 미리보기를 보인다. 입력이 없으니 "데모에서 열기"는 늘 열린다(`?preset=default|rounded|accent`).
- **지면 편성 재생 확인(`PlaybackPanel`의 초안 미리보기):**
  - 고른 프리셋을 적용해 재생한다. 위와 같은 플레이어 미리보기 프레임에 `schedule-preview` 응답의 `schedule`, 본편 주소, 프리셋 객체를 보낸다.
  - 관리자 문서에 로더나 플레이어 스킨을 직접 불러오지 않는다. 프레임 안에서만 만든다.
  - 통계는 지금처럼 남기지 않는다. 이 일을 하던 `preview-player.tsx`는 쓰지 않게 되면 지운다.
- **재생 테스트 링크(`PlayerTestLinks`):** `examples/play-test.html`의 Video.js·기본 video 링크를 만든다. 쿼리 규칙은 지금과 같다.
  - 고른 프리셋과 다른 플레이어 링크에는 `preset`을 넣지 않는다. 그 링크는 설치한 페이지처럼 사이트 적용 프리셋으로 재생하고, 사이트 적용 프리셋도 다른 플레이어용이면 기본값으로 재생한다. 안내 문구가 이 동작과 같아야 한다(A2-D-FIX, 결함 A2D-04).
- **재생 테스트 페이지의 프리셋 안내(A2-D-PLAYER-3 결정):** 없는 `?preset`은 로더처럼 내장 기본 설정으로 재생하고 그렇게 안내한다. 사이트 적용 프리셋으로 바꾸지 않는다. 설치한 페이지와 같은 결과를 보이기 위해서다.
- **초기 설정·옵션 화면:** "데모 열기", "설명서", "도움말" 링크를 둔다. 옵션 설명 옆에 `help.html#opt-…` 링크를 둔다.
- 관리자 도움말 용어에 데모·설명서·도움말·재생 테스트 페이지를 더하거나 고친다.

## 7. 테스트

- `tests/admin`:
  - 데모 쿼리 읽기·쓰기
  - 설치 코드 생성이 `loaderSnippet`과 같은지: 사례 표로 비교. `data-preset` 빠짐·들어감, 기본값과 같은 값 빠짐, 자동재생+음소거.
  - `options.js` ↔ `playerOptions`의 키·받는 값·기본값 일치
  - 로더 `preview`: 수집 요청 0, `preview.preset` 검증 실패, `seek`
  - `play-test` 쿼리와 전환 링크
  - `preview.html` 메시지 출처 검사와 명령
- `ui/tests`:
  - 플레이어 미리보기 메시지와 명령, 폭 보기, 데모 링크 비활성 이유
  - PlaybackPanel이 프리셋을 넘기는지
  - PlayerTestLinks의 새 경로
- 지운 예제를 가리키는 테스트·문서·코드가 없어야 한다(`grep`으로 확인).
  - 대상 이름: `player.html`, `videojs.html`, `grok.html`, `player-preview`, `context.js`, `example.js`, `example.css`.
  - 기록 문서(`workspaces/`, `.agents/plans/`의 이전 기록)는 예외다.

## 8. 하지 않음

- 데모에서 저장하기
- 다른 출처 설치
- 공개 프리셋 목록 API
- A2-2·A2-3 기능을 화면에 적용하기(도움말에는 "준비 중"으로 적는다)
- `public/assets/admin/` 정리

## 9. 인수 기준

1. 로그인하지 않은 브라우저에서 데모를 연다.
   - 사이트 적용 프리셋이 고른 상태로 시작하고, 내장 3개로 바꿀 수 있다.
   - 같은 브라우저로 관리자에 로그인한 뒤 새로고침하면 저장 프리셋이 목록에 더해진다.
2. 데모에서 바꾼 옵션이 플레이어에 바로 반영된다. 설치 코드가 그 상태에 맞는다. 그 코드를 빈 페이지에 붙이면 같은 모습으로 재생된다(편성은 실제 편성).
3. 데모·미리보기는 `events` 요청을 한 번도 보내지 않는다. 재생 테스트는 보낸다.
4. 도움말의 옵션 표가 관리자 옵션 화면과 같은 키·기본값을 보인다. 관리자 화면의 도움말 링크가 맞는 앵커로 간다.
5. 관리자 편집기 미리보기에서 바꾸면 다음이 저장 전에 미리보기에 보인다.
   - 재생 동작(자동재생·반복)
   - 언어(ja로 바꾸면 플레이어 문구 일본어, 광고 문구 한국어)
   - 포스터·제목 표시와 광고 문구
   - 장면 바로가기로 미드롤·포스트롤 화면을 바로 볼 수 있다.
6. 지면 편성의 초안 미리보기가 고른 프리셋 모양으로 재생된다.
7. 390·768·1280에서 데모·설명서·도움말·관리자 미리보기에 가로 스크롤이 없다. 키보드만으로 모든 조작이 된다.
8. 지운 예제 이름을 가리키는 코드·테스트·문서가 남아 있지 않다.
