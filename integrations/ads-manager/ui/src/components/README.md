# 디자인 시스템 컴포넌트

`design/`(솔애드 관리자) 시스템을 React로 감싼 컴포넌트입니다. 모두 `./index.ts`에서 가져옵니다.

- 스타일은 앱 진입점이 `design/tokens.css` → `design/components/bundle.css` 순서로 한 번 불러옵니다. 컴포넌트는 CSS를 import하지 않고 `sa-` 클래스만 붙입니다.
- 클래스 규칙과 쓰임은 `design/components/<이름>/README.md`가 기준입니다. 여기에는 prop 계약만 적습니다.
- 선택 prop은 `exactOptionalPropertyTypes`에서도 `undefined`를 넘길 수 있게 `| undefined`를 포함합니다.
- 문구는 짧은 해요체로 넘깁니다. 라임(`accent`) 버튼은 화면당 하나, `dense`는 표 카드에만 씁니다.

## 틀

| 컴포넌트 | 주요 prop |
| --- | --- |
| `TopNav` | `brand?`(솔애드 / 사이트 이름, 없으면 `tag`만 일반 글자), `tag`(관리자 / 광고 관리), `items: TopNavItem[]`(`id`, `label`, `href`, `current?` → `aria-current="page"`, `count?` → 라임 건수, 0이면 숨김), `navLabel?`(기본 "주 메뉴"), `actions?`(오른쪽 영역), `onNavigate?(item, event)`(수정 키 없는 왼쪽 클릭만). 960px 미만 두 줄은 CSS가 처리합니다. |
| `Avatar` | `initial`(한 글자), `label`(화면 읽기용 이름 · 역할) |
| `Card` | `title?`(있으면 `h2`로 section 이름), `actions?`, `flush?`(제목이 `sa-toolbar`로), `dense?`, `label?`(제목 없을 때 이름), `children` |
| `Panel` | `title`, `description?`, `footer?`(오른쪽 정렬 버튼 줄), `onSubmit?`(있으면 `form`), `children` |
| `Dialog` | `open`, `onClose`(Esc, 닫기 버튼, `open=false` 어느 쪽이든 한 번), `title`, `aside?`(제목 옆 한 줄 `span.sa-small`, `div.sa-dialog-title`로 묶음), `footer?`, `closeLabel?`(기본 "닫기"), `describedBy?`(열 때 제목과 함께 읽을 본문 Note의 id), `wide?`, `children`. 네이티브 `dialog.showModal()`로 열고, 닫으면 열 때 포커스가 있던 요소로 돌아갑니다. `wide`는 플레이어를 담는 넓은 변형(`is-wide`, 본문만 스크롤)입니다. 안을 `form[method=dialog]`로 감싸 바닥줄의 `button[type=submit]`이 닫고, 처음 초점은 머리의 닫기 아이콘입니다. 바닥줄 왼쪽에 붙일 링크는 `is-start`를 줍니다. |
| `UnimplementedCard` | `title`(화면 이름), `purpose`(무엇을 하는 화면인지), `specPath`(기획 문서 경로와 절), `headingLevel?: 2 \| 3`(이미 `h2`가 있는 섹션 안이면 3) |
| `SubNav` | `label`(링크 묶음 이름, 예: "플레이어 화면"), `items: SubNavItem[]`(`id`, `label`, `href`, `current?` → `aria-current="page"`), `onNavigate?(item, event)`(수정 키 없는 왼쪽 클릭만). ARIA 탭이 아닌 `nav` 안 링크입니다. |
| `SectionNav` | 긴 폼 한 장의 구획 이동. `items: SectionNavItem[]`(`id`(구획 요소 id, 링크는 `#id`), `label`, `errors?`(→ "오류 N" 글자), `off?`(→ "쓸 수 없음" 글자)), `current`(→ `aria-current="true"`), `variant: 'column' \| 'row' \| 'select'`(1280 옆 목록 / 768 위 칩 / 390 "구획으로 이동" select, 오류가 있으면 select를 그 구획 이름으로 설명), `onNavigate(id)`(수정 키 없는 왼쪽 클릭과 select 변경). 주소는 바꾸지 않고, 구획 제목으로 포커스를 옮기는 일은 화면이 합니다. |
| `Disclosure` | `summary`(무엇이 접혀 있는지, "더 보기"만 쓰지 않음), `open?`, `children`. 네이티브 `details`라 Enter·Space와 열림 상태는 브라우저가 처리합니다. |

## 동작과 입력

| 컴포넌트 | 주요 prop |
| --- | --- |
| `Button` | `variant?: 'default' \| 'primary' \| 'accent' \| 'danger'`(accent = 라임), `size?: 'md' \| 'sm'`, `icon?`, `disabledReason?`(주면 비활성 + 옆에 이유, `aria-describedby` 연결). 그 밖의 `button` 속성은 그대로 넘어가고 `type` 기본값은 `button`입니다. |
| `ButtonLink` | `a` 속성 + `variant?`, `size?`, `icon?`. 사이트 보기, 페이지 이동처럼 주소를 바꾸는 버튼 모양 링크입니다. `aria-disabled="true"`를 주면 `href`·`target`·`rel`을 빼고 `role="link"`·`tabindex="0"`를 두며 누름(클릭, Enter, Space)을 무시합니다. 이유는 `aria-describedby`로 연결합니다(Button README "초점을 받는 비활성"). |
| `Field` | `label`, `labelAside?`(라벨 바로 뒤, 라벨 밖에 두는 요소. `HelpLink` 자리이고 컨트롤 이름과 `aria-describedby`에 들어가지 않습니다. 링크만 있는 도움말은 `help` 대신 여기에 둡니다), `help?`, `error?`(막는 오류, `aria-invalid`), `warning?`(막지 않는 경고, `error`가 있으면 무시), `id?`, `children`(아래 컨트롤 하나). `aria-describedby`는 오류 → 경고 → 도움말 순서입니다. |
| `Input` / `Select` / `Textarea` / `FileInput` | 각 HTML 요소 속성 그대로. `Field` 안에 두면 id·설명·`aria-invalid`를 자동으로 받습니다. `Input`은 `numeric?`(숫자·날짜 Inter), `Textarea`는 `rows` 기본 3입니다. |
| `Check` | `input` 속성 + `type?: 'checkbox' \| 'radio'`, `label` |
| `ColorField` | `label`, `labelAside?`(`Field`와 같음), `value: string \| null`(소문자 `#rrggbb`, `null` = 기본값 사용), `onChange(next: string \| null)`(항상 소문자, 형식이 틀린 글자는 보내지 않음), `onInvalidChange?(invalid: boolean)`(글자 칸의 형식 오류가 생기거나 없어질 때. 그동안 폼이 저장을 막는 데 씁니다), `help?`·`error?`(바깥 오류, 두 입력 모두 `aria-invalid`)·`warning?`(대비 경고 등)은 색 고르기와 글자 칸 모두에 연결됩니다. `emptyLabel?`(기본 "기본값 사용"), `fallback?`(비었을 때 색 고르기가 여는 색, 기본 `#000000`), `id?`(글자 입력 id), `disabled?`, `alpha?`(글자 칸이 `#rrggbbaa`도 받음. 색 고르기는 투명도가 없어 고르면 `#rrggbb`. 투명도가 `ff`도 `00`도 아니면 그 사실을 두 입력에 도움말로 연결), `none?`("테두리 없음"처럼 다른 곳에서 선 없음으로 정한 값: 두 입력을 막고 지우기 버튼을 없애고 `is-none` 빗금을 보이며 글자 칸은 값을 그대로 보임). 형식 오류(`COLOR_FORMAT_ERROR`, `alpha`이면 `ALPHA_COLOR_FORMAT_ERROR`)는 글자 칸에만 연결되고, 형식 오류인 채로 Enter를 누르면 제출을 막습니다. 오류가 보이는 동안 화면의 값은 마지막으로 맞았던 값입니다. |
| `Fieldset` | `legend`, `legendAside?`(범례 바로 뒤, 범례 밖에 두는 요소. `HelpLink` 자리이고 그룹 이름과 `aria-describedby`에 들어가지 않습니다), `help?`, `children`(`Check` 묶음) |
| `Toggle` | `checked`, `onCheckedChange?(next)`, `label?`(없으면 `aria-label` 필수), `disabled?`. `role="switch"`이고 라벨을 눌러도 바뀝니다. |
| `SwitchList` | 켜기·끄기 줄 목록(`sa-switches`). `items: SwitchItem[]`(`id`(스위치 id, 오류 칸으로 포커스를 옮길 때 씀), `name`(스위치 이름), `description`(설명), `checked`, `onCheckedChange(next)`, `badge?`(예: "자동 재생 때문에 켜짐"), `locked?`(바꿀 수 없는 이유와 바꾸는 방법. 스위치를 비활성으로 두고 값은 그대로, 설명 자리에 이유를 보임), `keys?`(함께 꺼지는 단축키 줄 `sa-switch-keys`, 설명 뒤에 연결), `sub?`(켰을 때만 쓰는 딸린 칸 `sa-switch-sub`, 예: "건너뛰는 폭". 끄거나 막히면 숨기고 스위치의 `aria-controls`로 이음), `error?`(→ `aria-invalid`, 설명 뒤에 연결)). 켜진 `DisabledReason` 안에서는 모든 줄이 `is-locked`·비활성이 되고 설명 대신 그 이유 문장으로 설명됩니다. |
| `Segmented` | 다섯 개 이하의 짧은 선택(`sa-seg`). `label`, `labelAside?`, `value`, `options: { value, label }[]`(기본값은 "정보만 (기본)"처럼 글자로 표시), `onChange(value)`, `help?`, `error?`(→ 그룹 `aria-invalid`), `id?`(선택된 라디오에 붙음), `disabled?`, `numeric?`. 안은 네이티브 라디오 묶음이라 Tab은 선택된 값으로, 방향키는 스크립트 없이 이동·선택합니다. |
| `DisabledReason` | 지금 설정으로 쓸 수 없는 구획을 막는 틀(`sa-off-reason` + `sa-off-body`). `active`, `reason`("<b>…쓸 수 없어요.</b> …바꾸면 쓸 수 있어요."), `children`. 안의 컨트롤은 `fieldset disabled` 하나로 막고 값은 남기며, 안의 `Field` 컨트롤은 이유로 설명됩니다(`aria-describedby`). |
| `Chip` | `pressed`(→ `aria-pressed`), `count?`, `button` 속성 |
| `ChipGroup` | `label`(그룹 이름), `days?`(정사각 요일 칩), `children` |
| `ChipLink` / `ChipNav` | 주소가 바뀌는 상태 탭. `ChipLink`는 `current?`(→ `aria-current="page"`), `count?`; `ChipNav`는 `label`, `children` |

## 상태와 데이터

| 컴포넌트 | 주요 prop |
| --- | --- |
| `StatusBadge` | `status: AdStatus`(draft 초안, pending 승인 대기, scheduled 예정, active 진행, paused 일시중지, done 종료, under 미달 종료, rejected 반려, archived 보관), `label?`(그누보드 용어 "접수", "검토", "보완 요청"처럼 같은 색에 다른 이름). 기본 이름은 `STATUS_LABELS`입니다. |
| `PresetMark` | `kind: 'site' \| 'moved' \| 'builtIn'`(사이트 적용 / 중립 스킨에서 옮김 / 내장). 플레이어 프리셋 표시라 상태 색(`data-st`)을 쓰지 않고, 이름은 `PRESET_MARK_LABELS`입니다. |
| `TierTag` | `tier: 'period' \| 'guaranteed' \| 'house'`, `label?`. 기본 이름은 `TIER_LABELS`입니다. |
| `DataTable<Row>` | `caption`(항상 렌더, 표와 가로 스크롤 영역의 이름), `hideCaption?`, `columns: DataTableColumn<Row>[]`(`key`, `header`, `numeric?`, `hideHeader?`, `pinEnd?`(마지막 동작 열을 가로 스크롤 중에도 오른쪽 끝에 고정, `is-pinned`), `render(row)`), `rows`, `rowKey(row)`, `empty: { title, description? }`, `dense?`, `isSelected?(row)`, `toolbar?`, `footer?`(tfoot 칸들), `after?`(페이지 이동 등) |
| `KeyValue` | `rows: { key, label, value, numeric? }[]`, `label?`. `Card flush` 안에 둡니다. |
| `ActivityLog` | `entries: { id, time, datetime?, text }[]`(최신 순), `label?` |
| `CodeBlock` | `code`, `label`(제목이자 코드 영역 이름, 복사 버튼 이름은 "<label> 복사"), `hideLabel?`(위 제목이 이미 있을 때 화면 읽기용만). 결과 문구는 `COPY_DONE_TEXT`·`COPY_FAILED_TEXT`이고 `role="status"`입니다. 실패하면 코드를 선택하고 초점을 옮깁니다. |
| `KpiRow` | `label`(영역 이름), `hero?`(대시보드·리포트만), `columns?`(기본은 자식 수), `children`(`KpiStat`) |
| `KpiStat` | `label`, `value`, `note?`, `delta?: { text, tone: 'good' \| 'bad', compare? }` |
| `Progress` | `value`(0–100), `expected?`(기대 진도 표시선), `behind?`(빨간 막대), `caption?`, `label?`(화면 읽기용) |
| `Stepper` | `label`, `steps: { id, label, state?: 'todo' \| 'done' \| 'current' \| 'error' }[]`, `variant?: 'list' \| 'flow'`(세로 단계형 폼 / 한 줄 처리 흐름) |
| `TodoBanner` | `label`(영역 이름, 왼쪽 위 태그), `title`, `description?`, `actions?`(라임 버튼 하나), `items: { id, title, detail?, count, bad? }[]` |

## 알림

| 컴포넌트 | 주요 prop |
| --- | --- |
| `StatusMessage` | `tone?: 'info' \| 'good' \| 'warn' \| 'bad'`, `id?`, `children`. `bad`는 `role="alert"`, 나머지는 `role="status"`입니다. 영역은 처음부터 두고 글자만 바꿉니다(비면 숨음). |
| `Note` | `tone?: 'info' \| 'warn' \| 'bad'`, `title?`(굵은 앞머리), `actions?`(한 번 보는 안내의 버튼, 예: [재생 테스트 열기][확인했어요], `has-actions`), `children`. 정적 안내(`role="note"`)입니다. |
| `MockBadge` | prop 없음. 문구는 `MOCK_BADGE_TEXT`("목업 · 아직 동작하지 않아요")로 고정입니다. 목업 화면의 쓰기 버튼은 `Button disabledReason`으로 이유를 적습니다. |

`cx(...parts)`는 거짓 값을 건너뛰고 클래스 이름을 잇는 도우미입니다.
