# A1-REVIEW-3 독립 리뷰: 도움말과 플레이어 관리 (1부)

- 리뷰어: ads-source-analyst (w1:p2). 읽기 전용이며, 이 파일 말고는 수정하지 않았다.
- 기준: AGENTS.md, `.agents/plans/ads-admin-app-contract.md`(§3.1, §3.2, §4.1), `.agents/plans/ads-contract-v1.md`
- 범위: PHP `PlayerPresets.php`, `App.php`의 프리셋 액션, 백엔드 테스트의 프리셋 단언, `ui/src/player/**`, `ui/tests/player*.test.tsx`, `public/examples/`(preset.js, player-preview.html·js, example.js, context.js, videojs.html, README.md), 컴포넌트 ColorField·CodeBlock·SubNav와 `design/components/` 해당 폴더, `ui/src/help/**`
- 범위 밖: `ui/src/screens/**`·`app`의 화면 흐름은 2부에서 본다. 다만 컴포넌트 결함을 재현하려고 일부 화면 줄을 인용했다.
- 경로 약어: 아래에서 경로는 `integrations/ads-manager/`를 기준으로 쓴다. `design/`은 저장소 루트의 `design/`이다.

## 요약

| 심각도 | 개수 |
| --- | --- |
| 높음 | 0 |
| 중간 | 4 |
| 낮음 | 21 |

보안 중점 항목에서는 높음이나 중간 결함을 찾지 못했다. 설치 코드 이스케이프, CSS 이름과 값 주입, postMessage 검사, 위조된 render 거부, 공개 액션의 정보 노출, 읽기와 쓰기 경계를 모두 확인했다.

## 발견

### R3-1 [중간] 재생 테스트 링크 두 개에 같은 프리셋 ID가 붙음

- 위치: `ui/src/player/player-test-links.tsx:47`, `:61`, `:65`
- 재현: Video.js 프리셋(id `p_x`)을 고른 상태에서 재생 테스트 링크 두 개를 연다.
  - `player.html?preset=p_x`(기본 플레이어)를 열면 `example.js loadPreset`이 playerType이 다르다고 판단한다. 그러면 "이 프리셋은 … 플레이어용입니다" 안내를 띄우고 패키지 기본값으로 돌아간다.
  - native 프리셋이면 `videojs.html` 쪽이 같은 방식으로 실패한다.
- 기대: 프리셋의 playerType에 맞는 링크에만 `preset`을 붙이거나, 맞지 않는 링크는 감추거나 "이 프리셋과 다른 플레이어" 라고 표시한다.
- 실제: 두 링크 중 하나는 항상 안내 문구와 함께 기본값으로 재생된다.
- 담당 추정: ads-implementer (ui/src/player)
- 제안: `PlayerTestLinks`에 `playerType` prop을 추가해 해당 링크에만 `presetId`를 넘긴다. 테스트에서 링크별 `preset` 파라미터 유무를 단언한다.

### R3-2 [중간] ColorField: 색 고르기 칸에 오류·경고·도움말과 `aria-invalid`가 연결되지 않음

- 위치: `ui/src/components/ColorField.tsx:111-118`, `ui/src/components/Field.tsx:55`, `:88-95`. 디자인 미리보기 `design/components/ColorField/preview.html:50`, `:53`(c3 오류 예시)도 같다.
- 상황: `Field`의 describedby와 invalid 값은 `useFieldControl`을 쓰는 `Input`에만 들어간다. `<input type="color">`는 `aria-describedby={empty ? stateId : undefined}`만 가진다.
  - 그래서 서버 오류(`error`), 낮은 대비 경고(`warning`), `help`가 색 고르기 칸에서 읽히지 않는다.
  - 대비 경고는 색 고르기로 고른 값과 직접 관련되는데도 연결되지 않는다.
- 기대: 바깥 오류와 경고, 도움말은 두 입력 모두의 describedby와 `aria-invalid`에 연결된다. 형식 오류(#rrggbb)만 글자 입력에 둔다.
- 실제: 글자 입력에만 연결된다.
- 담당 추정: ads-admin-ui (공통 컴포넌트), 미리보기는 ads-admin-designer
- 제안: `FieldContext`의 `describedBy`와 `invalid`를 color input에도 합친다. 테스트도 추가한다.

### R3-3 [중간] ColorField: Enter로 제출하면 형식 오류가 보이는데도 이전 정상값이 저장됨

- 위치: `ui/src/components/ColorField.tsx:131-135`(Enter → `commitText()`, `preventDefault` 없음), `ui/src/screens/PresetEditor.tsx:88-91`(`submit` → `save()`)
- 재현: 프리셋 편집에서 강조색 글자 칸에 `#12`를 입력하고 Enter를 누른다.
  1. `commitText`가 `setInvalid(true)`만 한다. 폼 값은 마지막 정상 색 그대로다.
  2. 암묵 제출이 이어지고 저장이 성공한다.
- 기대: 형식 오류가 있으면 제출을 막는다(Enter에서 `preventDefault`). 또는 폼에 오류 상태를 전달해 저장을 거부한다. WCAG 3.3.1 관련이다.
- 실제: 화면에는 "#과 16진수 6자리로…" 오류가 보이는데 다른 값이 저장되고 저장 성공 알림이 나온다.
- 담당 추정: ads-admin-ui
- 제안: invalid 상태에서 Enter를 누르면 `event.preventDefault()`를 한다. 형식 오류를 부모에 알리는 콜백도 둔다. "Enter 후 save가 호출되지 않음" 테스트를 추가한다.

### R3-4 [중간] 용어 `player-default-preset`이 적용 범위를 실제보다 넓게 설명함

- 위치: `ui/src/help/terms.ts:442`, `:446`. 같은 오류가 내 근거표 `.agents/plans/ads-admin-player-facts.md:307`에도 있다.
- 상황: 문구는 "프리셋을 따로 고르지 않은 곳이 쓰는 프리셋"이다. 그러나 id 없이 공개 `player-preset`을 부르는 페이지는 없다.
  - `?preset` 없는 예제 페이지(`example.js`)는 기본 프리셋이 아니라 패키지 기본값을 쓴다.
  - 이미 붙여 넣은 설치 코드는 생성 시점의 값이다.
- 기대: 실제 범위를 적는다. 설치 코드 생성기와 재생 테스트에서 처음 선택되는 프리셋이고, id 없이 공개 API를 부를 때 돌려주는 값이다.
- 실제: 사이트 전체에 자동으로 적용되는 것처럼 읽힌다.
- 담당 추정: ads-admin-designer (help). 근거표는 내가 고친다(아래 "근거표 정정").
- 제안: 문구를 위 범위로 줄인다.

### R3-5 [낮음] 용어 `player-preset`의 "미리보기"가 편성 미리보기로 읽힘

- 위치: `ui/src/help/terms.ts:433-434`
- 상황: 도움말에서 "미리보기"는 보통 편성의 "게시 전 미리보기"(:408)를 뜻한다. 하지만 그 PreviewPlayer는 프리셋을 쓰지 않는다. 프리셋이 적용되는 곳은 편집 화면의 테마 미리보기(ThemePreview)다.
- 기대: "프리셋 편집 화면의 테마 미리보기"라고 적는다.
- 담당 추정: ads-admin-designer
- 제안: 문구를 위처럼 고친다. motionLabel(:434)도 같이 고친다.

### R3-6 [낮음] CodeBlock: 같은 결과를 반복하면 화면 읽기 프로그램이 다시 알리지 않음

- 위치: `ui/src/components/CodeBlock.tsx:51`, `:60`, `:88`
- 재현: 복사를 두 번 누른다. 두 번 다 `{tone:'good', text: COPY_DONE_TEXT}`라서 `role="status"`의 DOM이 바뀌지 않고, 두 번째는 조용하다. 실패를 반복해도 같다.
- 기대: 매번 결과를 알린다.
- 담당 추정: ads-admin-ui
- 제안: 결과를 먼저 비운 뒤 다음 틱에 다시 쓴다. 또는 카운터나 key로 문구 노드를 바꾼다.

### R3-7 [낮음] CodeBlock: 실패할 때 초점 이동이 polite 알림을 가림

- 위치: `ui/src/components/CodeBlock.tsx:55-60`
- 상황: `element.focus()`로 "설치 코드, 영역"과 선택된 긴 본문이 먼저 읽히고, polite 실패 안내가 밀리거나 잘릴 수 있다.
- 담당 추정: ads-admin-ui
- 제안: 실패할 때만 pre에 `aria-describedby`로 실패 문구를 연결한다.

### R3-8 [낮음] `.sa-code` 클래스 이름 충돌

- 위치: `design/components/bundle.css:1096`(인라인 code)과 `:1328`(CodeBlock 상자). 사용처는 `ui/src/components/UnimplementedCard.tsx:27`.
- 상황: CodeBlock 상자가 인라인 규칙의 padding과 `word-break: break-all`을 받는다. 반대로 인라인 `<code class="sa-code">`는 상자 규칙(grid, 테두리)을 받는다.
- 담당 추정: ads-admin-designer
- 제안: 둘 중 하나의 이름을 바꾼다(예: 인라인은 `sa-code-inline`).

### R3-9 [낮음] SubNav: 편집·새 프리셋 화면에는 현재 항목이 없음

- 위치: `ui/src/screens/PlayersScreen.tsx:63-67`. 디자인 미리보기는 `design/components/SubNav/preview.html:19-21`.
- 상황: `SUB_PAGES`는 list, setup, options뿐이라서 edit나 new에서는 `aria-current`가 없다. 미리보기는 편집 중 항목을 현재로 보여 주는데, 구현과 다르다. h2 제목으로 위치는 보완된다.
- 담당 추정: ads-admin-ui (2부와 겹침)
- 제안: edit와 new에서는 "프리셋 목록"을 `aria-current="page"`(또는 `location`)로 둔다. 아니면 미리보기를 구현에 맞춘다.

### R3-10 [낮음] ThemePreview: 처음 '준비 중'과 '준비 완료'가 알려지지 않음

- 위치: `ui/src/player/theme-preview.tsx:71-72`, `:152`, `ui/src/screens/PlayersScreen.tsx:324-325`(`key={previewKey(...)}`)
- 상황:
  - live region이 문구를 가진 채로 마운트돼서 대부분 읽히지 않는다.
  - 플레이어 종류를 바꾸면 key가 바뀌어 다시 마운트되므로 같은 일이 반복된다.
  - ready가 되면 문구가 비워져 완료도 알리지 않는다.
  - 오류(`role=alert`, :153)는 처음부터 빈 채로 있어서 잘 알려진다.
- 담당 추정: ads-implementer
- 제안: status를 빈 값으로 마운트한 뒤 문구를 넣는다. 준비가 끝나면 "미리보기가 준비됐어요"처럼 짧게 알린다.

### R3-11 [낮음] ThemePreview: 오류 상태의 iframe과 재로드 감시

- 위치: `ui/src/player/theme-preview.tsx:124-136`, `:143-151`
- 상황:
  - iframe `onError`는 HTTP 404에서 발생하지 않아 사실상 쓰이지 않는다. 실패는 3초 침묵 타이머가 잡는다.
  - 오류 상태에서도 iframe이 보이고 초점을 받는다.
  - `heard=true`가 된 뒤 frame이 다시 로드되면 침묵 타이머가 다시 걸리지 않는다.
- 담당 추정: ads-implementer
- 제안: 오류일 때 iframe에 `inert`나 `hidden`을 건다. `load`마다 heard를 초기화한다.

### R3-12 [낮음] HelpMotion: 고대비 모드에서 일시정지 눌림이 보이지 않고, 정지 화면이 빌 수 있음

- 위치: `ui/src/help/HelpMotion.tsx:88-90`, `design/components/bundle.css:1574-1579`, `:1957-1968`, `:2277-2280`
- 상황:
  - 눌림은 배경색과 테두리색으로만 표시되는데, bundle.css에 `forced-colors` 규칙이 없다(grep 0건).
  - `sa-mo-cycle`의 0-3%, 92-100% 구간에서 멈추면 거의 빈 그림이 된다.
- 담당 추정: ads-admin-designer
- 제안: `@media (forced-colors: active)`에서 `[aria-pressed=true]`에 `outline`이나 `Highlight`를 준다. 일시정지할 때 장면을 마지막 키프레임에 고정하는 것도 검토한다.

### R3-13 [낮음] HelpMotion 디자인 미리보기가 reduced-motion에서 컨트롤을 숨기지 않음

- 위치: `design/components/HelpMotion/preview.html:252-266`. README:15는 "앱은 숨깁니다"라고 적는다.
- 상황: 미리보기에는 matchMedia 검사가 없어서, 움직임 줄이기에서도 효과 없는 버튼이 남는다. 앱은 숨기므로 앱과 미리보기가 다르다.
- 담당 추정: ads-admin-designer
- 제안: 미리보기에도 같은 검사를 넣거나, 미리보기에 차이를 적는다.

### R3-14 [낮음] HelpLink가 Field `help`로 들어가면 입력 설명이 "<용어> 도움말"이 됨

- 위치: `ui/src/screens/BreakEditor.tsx:170` 등(BreakEditor :200, :310, :322, :336, :351, `StatsScreen.tsx:116`, `ScheduleScreen.tsx:281`)
- 상황: `sa-help` span 전체가 describedby가 되어 "스킵 대기 도움말"이 덧붙어 읽힌다. 해는 없지만 소음이다.
- 담당 추정: ads-admin-ui (2부와 겹침)
- 제안: 링크만 있는 help는 describedby에서 빼거나, 라벨 옆으로 옮긴다.

### R3-15 [낮음] PHP: `skin`에 배열이나 객체를 보내면 422 대신 500이 날 것으로 추정 (미실행)

- 위치: `src/PlayerPresets.php:142` `isset(self::SKINS[$skin])`
- 재현 입력: 관리자 세션과 CSRF로 `player-preset-save`에 `{"playerType":"videojs","skin":["x"],…}`를 보낸다.
- 기대: `fields.skin: type` 422
- 실제(추정): PHP 8에서 배열 offset으로 isset을 하면 TypeError가 나고, `Http::error`가 500을 돌려준다. 인증된 관리자만 닿을 수 있다. 실행해서 확인하지는 않았다.
- 담당 추정: ads-admin-api
- 제안: `isset` 전에 `is_string($skin)`을 검사한다. run.php에 skin `[]`, `{}`, `1` 케이스를 추가한다.

### R3-16 [낮음] 검증기 불일치: 라벨의 유니코드 공백 trim

- 위치: PHP `src/PlayerPresets.php:322` `trim()`(ASCII 공백만), TS `ui/src/player/preset.ts:294`, JS `public/examples/preset.js:110` `.trim()`(유니코드 공백)
- 재현 입력: 직접 API로 `ads.labels.skip: " 건너뛰기"`를 저장한다.
  1. PHP는 값을 그대로 저장하고 render도 그대로 돌려준다.
  2. 예제 `readPresetRender`는 parse할 때 trim한 값으로 다시 render한다. `sameValue`가 실패해 프리셋 전체를 거부하고 기본값으로 돌아간다.
  3. 관리 화면에서는 TS가 trim하므로 다시 저장하면 해소된다.
- 기대: 세 검증기가 같은 공백 집합을 쓴다. 계약 §4.1은 "앞뒤 공백 제거"로만 적혀 있다.
- 담당 추정: ads-admin-api와 ads-implementer. 기준은 오케스트레이터가 정한다.
- 제안: PHP에서 `preg_replace('/^[\s\p{Z}]+|[\s\p{Z}]+$/u', '', …)`를 쓰거나, TS와 JS를 ASCII 공백으로 맞춘다. 공유 fixture에 NBSP와 U+3000을 추가한다.

### R3-17 [낮음] 검증기 불일치: 정수 `5.0`·`1e1`

- 위치: TS `ui/src/player/preset.ts:280`, JS `public/examples/preset.js:98`(`Number.isInteger`), PHP `Value::integer`(`is_int`)
- 재현 입력: `timeouts.loadMs: 5000.0`
- 기대: 세 검증기의 판정이 같다.
- 실제: PHP는 type 오류로 거부하고, TS와 JS는 허용한다. JSON.parse 후에는 구분할 수 없으므로 실사용 영향은 적다. 이미 알려진 차이(정수 `''`, id `''`, theme `[]`)와 같은 부류다.
- 담당 추정: 오케스트레이터(차이 목록에 추가할지)
- 제안: 계약의 "알려진 차이"에 추가한다.

### R3-18 [낮음] 검증기 공통: 서식 문자(Cf)를 허용함

- 위치: 세 검증기의 label 검사. 제어 문자 검사가 `\p{Cc}`만 본다.
- 재현 입력: `ads.labels.skip: "‮기뛰너건"`(RLO)
- 실제: 세 곳 모두 허용한다. 광고 버튼 글자의 방향이 뒤집혀 보일 수 있다. 쓸 수 있는 사람은 관리자뿐이다.
- 담당 추정: 오케스트레이터
- 제안: 양방향 제어 문자(U+202A–202E, U+2066–2069)를 거부할지 계약에서 정한다.

### R3-19 [낮음] 예제 `readPresetRender`: 프로토타입 이름 키에서 예외가 남

- 위치: `public/examples/preset.js:294` `const target = cssFields[name];`
- 재현 입력: render의 `css`에 `{"constructor":"x"}`나 `{"toString":"x"}`를 넣는다(서버가 위조됐거나 중간자가 조작한 경우).
- 기대: `{ok:false, unknown_key}`
- 실제: `Object.prototype` 멤버가 잡혀 다음 단계에서 TypeError가 난다. `example.js loadPreset`이 try/catch로 감싸므로 결국 기본값으로 돌아가고, 보안 영향은 없다.
- 담당 추정: ads-implementer
- 제안: `Object.hasOwn(cssFields, name)`으로 바꾸거나 `Object.create(null)`이나 Map을 쓴다. attributes 조회도 같이 고친다. 테스트도 추가한다.

### R3-20 [낮음] 옵션 설명: 초점 테두리가 강조색을 이어받는다는 문구

- 위치: `ui/src/player/player-options.ts:217`, `ui/src/screens/PresetEditor.tsx:148`. 내 근거표(아래 정정 참고)도 같다.
- 상황: Video.js 스킨은 `.media-skin`에서 `--media-ring`을 `oklch(1 0 0)`으로 고정한다(skins `themes/theme.css:21`). `--ads-focus-color`는 `--media-ring`을 먼저 보므로, 스킨 안에서는 강조색을 바꿔도 초점 테두리가 흰색이다. 같은 파일 :386-387의 기본값 체인 설명은 맞다.
- 담당 추정: ads-implementer, ads-admin-ui
- 제안: 217과 PresetEditor:148에서 "초점 테두리" 부분을 지우거나 "기본 플레이어에서만"이라고 한정한다.

### R3-21 [낮음] 옵션 설명: `--ads-font-family`의 "비우면 플레이어 글꼴을 따라가요"

- 위치: `ui/src/player/player-options.ts:317`
- 상황: `--media-font-family`가 비어 있으면 플레이어는 자체 대체 스택(Inter 우선)을 쓰고, 광고 화면은 system-ui를 쓴다. 따라서 "따라간다"는 `--media-font-family`를 지정했을 때만 맞다.
- 담당 추정: ads-implementer
- 제안: "플레이어 글꼴(--media-font-family)을 지정했으면 그것을 따라가요"라고 고친다.

### R3-22 [낮음] 옵션 설명: `--ads-control-radius` 기본값에 스킨 값이 빠짐

- 위치: `ui/src/player/player-options.ts:363` 행
- 상황: 이어받는 `--media-control-radius`는 default 스킨이 99px(알약 모양), neutral 스킨이 `calc(spacing*2)`다. 행에는 이 차이가 없다.
- 담당 추정: ads-implementer
- 제안: 기본값 칸에 스킨별 값을 적는다.

### R3-23 [낮음] 용어 문구의 작은 사실 오류

- `ui/src/help/terms.ts:509` `player-ad-overlay`는 "남은 시간"이라고 하지만, 기본 타이머는 `{elapsed} / {duration}`이다. 남은 시간은 `{remaining}`으로 바꿨을 때만 나온다.
- `ui/src/help/terms.ts:267` 스킵 대기는 "대기 시간이 광고 길이보다 길면"이라고 하지만, 같을 때도 버튼은 켜지지 않는다. "같거나 길면"이 맞다.
- 담당 추정: ads-admin-designer
- 제안: 위 두 곳을 고친다. 근거표도 정정한다.

### R3-24 [낮음] 설치 코드: 고정 id와 native 응답 처리

- 위치: `ui/src/player/install-snippet.ts:98`, `:118-119`(`id="ads-content"`, `id="ads-player"`), `:128-132`
- 상황:
  - 한 페이지에 두 개를 붙이면 id가 겹쳐, 두 번째 `media-ads for`와 `getElementById`가 첫 번째 요소를 잡는다.
  - native 코드는 `response.json()`을 `ok` 확인보다 먼저 부른다. 서버가 HTML 오류 페이지를 돌려주면 처리되지 않은 rejection이 생긴다(본편 재생에는 영향 없음).
  - `installSnippet`은 프리셋을 다시 검증하지 않는다. 다만 호출부가 `api/presets.ts:87`에서 `parsePlayerPreset`을 거친 값만 넘기므로 실제 위험은 없다.
  - 그누보드 영상 ID 형식은 생성기에서 검사하지 않고 주석으로만 안내한다(:71).
- 담당 추정: ads-implementer
- 제안: id를 영상 ID에서 만든 값으로 바꾸거나 "한 페이지에 하나" 주석을 단다. `if (!response.ok) return;` 뒤에 json을 부른다.

### R3-25 [낮음] native 미리보기: 시간 제한을 바꿔도 다시 만들 때까지 반영되지 않음

- 위치: `public/examples/player-preview.js:159`
- 상황: `timeouts`는 컨트롤러를 만들 때 한 번만 읽힌다. 다시 만드는 것은 종류나 스킨이 바뀔 때뿐이라서, 편집 화면에서 시간 제한만 바꾸면 미리보기는 예전 값으로 동작한다. 시간 제한은 화면에서 보이지 않는 값이라 영향이 작다.
- 담당 추정: ads-implementer
- 제안: `previewKey`에 timeouts를 넣거나, 미리보기 안내에 "시간 제한은 재생 테스트에서 확인"이라고 적는다.

## 확인했지만 문제없는 중점 항목

### 보안
- 설치 코드 속성 값: `escapeAttribute`가 `& < > " '`를 숫자 참조로 바꾼다(install-snippet.ts:33-35). 스크립트 값은 JSON에서 `<`를 `<`로 바꾼다(:38-40). 테스트는 player-snippet.test.tsx에 있다.
- 설치 코드 주소: `isInstallUrl`이 `http(s)://`와 `/`만 허용하고, `//`, 제어 문자, 공백, 역슬래시, 자격 증명을 거부한다(:62-66).
- CSS 주입: 이름은 표에 있는 10개만 쓰고, 값은 세 검증기의 색·길이·글꼴 문법을 통과한 값만 쓴다. 예제는 `setProperty`로만 적용한다(preset.js `applyPresetCss`).
- postMessage: 프레임은 `origin === location.origin && source === window.parent`를 검사한 뒤 `parsePlayerPreset`으로 다시 검증한다. 부모도 origin과 source를 검사한다(theme-preview.tsx:93). 상태 메시지의 targetOrigin은 `location.origin`이다.
- `readPresetRender`: 위조된 skinTag, `../evil.js` styles, 추가 키, 알 수 없는 css나 속성 이름을 거부한다(테스트 있음). 동적 import 경로는 `PLAYER_SKINS` 표에서만 나온다.
- 공개 `player-preset`: render에 name이 없다(PlayerPresets.php:85-126, http_test 단언). `requireAdmin` 전에 분기한다(App.php:53-55). CSRF 예외는 이 액션 하나다(Http.php:69). `Cache-Control: no-store`다(api/index.php:7). 프리셋 id는 무작위라 열거할 수 없다.
- 읽기와 쓰기 경계: 읽기 액션은 메타를 쓰지 않는다(run.php의 파일 해시 단언). 저장과 삭제는 `db->write`(트랜잭션과 write lock) 안에서 revision을 비교하고, 맞지 않으면 409를 돌려준다(:209-223). 기본 프리셋은 수정과 삭제가 막혀 있다. LIMIT 20(21번째는 거부)도 단언된다.

### 일치
- render 모양: PHP `render`와 TS `presetRender`, JS 렌더러의 출력이 같다(JS↔TS는 테스트, PHP는 run.php 고정값과 대조).
- 계약 4.1절 반영 사항: mediaAlt가 스키마에 없고 레거시 값은 읽을 때 버린다. timer는 `{remaining}`을 허용한다. `ads.accentColor` 라벨은 "광고 음량 막대 색"이다(player-options.ts:292-293). 언어 기본값 주석이 설치 코드에 있다(:73-74). 설치 코드 주소는 절대 주소이거나 `/` 경로다.
- 알려진 차이(정수 `''`, id `''`, theme `[]`) 말고 새로 찾은 차이는 R3-15, R3-16, R3-17이다.

### 계약 준수
- 그누보드 자동 삽입: "준비 중"으로 표시되고, 동작하는 것처럼 보이는 코드 경로가 없다.
- `?preset=`: example.js에 구현됐고, playerType 불일치나 검증 실패 때 textContent 안내와 함께 기본값으로 돌아간다.
- 도움말: 51개 용어 가운데 "준비 중" 기능을 동작하는 것처럼 쓴 곳이 없다. guide.ts 순서가 §3.1과 맞는다. `HelpLink termId`는 `HelpTermId` 타입이라 깨진 링크가 없다.

### 접근성
- ColorField 글자 입력: label for, 형식 오류일 때 `aria-invalid`와 describedby가 있다. 색 고르기 이름은 "강조색 색 고르기", 지우기 버튼 이름은 "강조색 지우기"이고, 지우기 후 초점이 글자 입력으로 간다.
- CodeBlock: `pre role=region tabIndex=0`이고 aria-labelledby가 있다. 복사 버튼 이름에 보이는 글자가 들어 있다. status는 처음부터 마운트돼 있다. 클립보드가 없거나 거부되면 선택과 안내로 대체한다.
- SubNav: `nav aria-label`과 `a href`, `aria-current="page"`를 쓰고 tablist가 없다. 현재 항목은 색 말고 굵기와 밑줄로도 표시된다.
- ThemePreview: iframe title "플레이어 테마 미리보기", 처음부터 마운트된 `role=alert`, 3초 침묵을 실패로 처리하는 것이 모두 있다.
- HelpMotion: `role=img`와 aria-label이 있다. 반복 그림에는 일시정지와 다시 보기가 있어 2.2.2를 충족한다. 애니메이션은 `prefers-reduced-motion: no-preference` 안에만 있고, 기본 마크업은 최종 상태다. reduced이면 컨트롤을 숨기고 안내 Note를 보여 준다. 화면 밖에 있으면 멈춘다.
- HelpLink: 링크 의미가 맞고, 누르는 면이 24px이다.

## 테스트 공백

1. PHP: `skin`이 문자열이 아닌 경우(배열, 객체, 숫자). R3-15를 확인할 수 있다.
2. 세 검증기 공유 fixture: 지금 PHP와 TS의 "확정" 표는 손으로 복사한 것이다. NBSP, U+3000, `5.0`, Cf를 한 JSON fixture에 모아 run.php와 vitest가 함께 읽게 한다.
3. `readPresetRender`에 `constructor`, `__proto__`, `toString` 키를 넣는 경우(R3-19).
4. `PlayerTestLinks`: playerType별 링크의 `preset` 파라미터(R3-1).
5. ColorField: 색 고르기의 describedby와 `aria-invalid`, 경고와 도움말 연결, Enter 제출 차단(R3-2, R3-3).
6. CodeBlock: 같은 결과를 반복할 때 다시 알리는지, 실패 tone이 `is-warn`인지.
7. ThemePreview: 로딩 문구가 `role=status` 안에 있는지(지금은 getByText), 오류일 때 iframe 처리, 다시 마운트할 때의 알림.
8. HelpMotion: matchMedia change 이벤트에 반응하는지(지금 stub은 이벤트를 보내지 않음), IntersectionObserver로 화면 밖에서 멈추는지.
9. 그누보드 호스트의 공개 `player-preset` HTTP 테스트(http_test.py는 Standalone 기준).

## 근거표 정정 (내가 쓴 `.agents/plans/ads-admin-player-facts.md`)

이 TASK에서는 보고서 말고 다른 파일을 수정할 수 없어서, 정정할 내용만 적는다. 반영을 지시하면 고치겠다.

- §2.5와 §5 `player-accent-color`: "초점 테두리도 강조색"은 틀렸다. 스킨 안에서는 `--media-ring`이 흰색으로 고정된다(R3-20).
- :307 `player-default-preset`: 범위가 과장됐다(R3-4).
- :349: "남은 시간"은 틀렸다. 기본값은 `{elapsed} / {duration}`이다(R3-23).
- :229, :232, :302, :405(D-P2): "`?preset=` 미구현"은 이제 틀렸다. example.js에 구현됐다.

## 실행한 검사

| 검사 | 결과 | 로그 |
| --- | --- | --- |
| `pnpm -F @videojs/ads-manager-ui test` | 15개 파일, 375개 통과, exit 0 | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r3-test.log` |
| `pnpm -F @videojs/ads-manager-ui typecheck` (tsgo) | exit 0 | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r3-tc.log` |
| `php tests/backend/run.php` | PASS 70 + 7 + 95, exit 0 | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r3-php.log` |
| `node --check` (public/examples의 context.js, example.js, grok.js, player-preview.js, preset.js) | 모두 ok | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r3-nodecheck.log` |
| 읽기, grep, git status/diff | — | — |

## 실행하지 않은 것

- `tests/backend/http_test.py`: 서버가 필요해서 실행하지 않았다(금지 범위).
- R3-15(PHP 500): 코드를 읽고 추정한 것이고, 실행해서 확인하지 않았다.
- videojs.html과 player-preview.html의 인라인 스크립트: `node --check` 대상이 아니라 읽기로만 확인했다.
- 브라우저와 화면 읽기 프로그램 실측: 금지 범위다. R3-6, R3-7, R3-10, R3-12는 코드와 명세에 근거한 판단이다.
- 대비 수치: 토큰 값으로 계산했고, 렌더링해서 재지 않았다.
- build, 서버, DB, `/private/tmp/ads-qa-*`: 손대지 않았다.
