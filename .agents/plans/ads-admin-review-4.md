# A1-REVIEW-4 독립 리뷰: 도움말과 플레이어 관리 (2부, 화면)

- 리뷰어: ads-source-analyst (w1:p2). 읽기 전용이다. 이 파일 말고는 수정하지 않았다.
- 기준: AGENTS.md, `.agents/plans/ads-admin-app-contract.md`(§3.1, §3.2, §4.1), `.agents/plans/ads-contract-v1.md`
- 대상:
  - `ui/src/api/presets.ts`
  - `ui/src/screens/`의 `preset-form.ts`, `PresetEditor.tsx`, `PlayersScreen.tsx`, `PlayerSetup.tsx`, `PlayerOptions.tsx`, `PlaybackPanel.tsx`
  - `ui/src/app/`의 `routes.ts`, `Workspace.tsx`(`App.tsx`의 `run`과 `setDirty`는 참고로 읽음)
  - HelpLink를 붙인 화면: `ui/src/screens/`의 `BreakEditor.tsx`, `ScheduleScreen.tsx`, `CreativesScreen.tsx`, `StatsScreen.tsx`
  - 테스트: `ui/tests/`의 `presets.test.ts`, `preset-form.test.ts`, `admin-players.test.tsx`, `admin-help.test.tsx`, `app.test.tsx`
  - 위치표: `workspaces/ads-admin-app-20261020/qa/inputs/a1-ui-6-helplinks.md`
- 1부의 R3-2와 R3-3(ColorField)은 이미 알려진 결함이라 다시 적지 않는다. 1부의 R3-1(테스트 링크), R3-14(HelpLink 설명 소음)와 겹치는 것은 번호만 참조한다.
- 경로는 `integrations/ads-manager/`를 기준으로 쓴다.

## 요약

| 심각도 | 개수 |
| --- | --- |
| 높음 | 0 |
| 중간 | 6 |
| 낮음 | 17 |

데이터가 손상되거나 잘못 저장되는 경로는 찾지 못했다.
- 저장 요청은 클라이언트의 소재 목록과 무관하다(`api/model.ts` `editorPayload`).
- 서버가 보관 소재를 거부한다(`src/Schedules.php:78-82`).
- 프리셋 저장은 검증을 통과한 `parsed.preset`만 보낸다.

## 발견

### R4-1 [중간] 404·400 안내는 "목록을 다시 불러와 주세요"인데 다시 불러오기 버튼은 409에서만 나옴

- 위치:
  - 안내 문구: `ui/src/screens/preset-form.ts:372-378`
  - 버튼 조건: `ui/src/screens/PresetEditor.tsx:335-339`, `ui/src/screens/PlayersScreen.tsx:593-597`(`conflict`일 때만)
  - `conflict`를 켜는 곳: `ui/src/screens/PlayersScreen.tsx:156-163`(`report.conflict`, 즉 409)
- 재현:
  1. 탭 A에서 `#/players/edit/p-…`를 열고 값을 바꾼다.
  2. 탭 B에서 같은 프리셋을 삭제한다.
  3. 탭 A에서 저장하면 서버 revision이 바뀌었으므로 보통 409가 온다.
  - 탭 A의 목록 revision이 최신인 상태에서 id만 사라진 경우(직접 API 호출 등)에는 404 `preset_not_found`가 온다. 이때 "프리셋을 찾지 못했어요. … 목록을 다시 불러와 주세요."만 보이고 버튼은 없다.
  - 목록 화면의 삭제와 기본 지정에서 나는 404, `invalid_preset_id`도 같다.
- 기대: 안내대로 그 자리에서 목록을 다시 불러올 수 있다.
- 실제: 브라우저를 새로고침해야 하고, 그러면 모든 메뉴의 입력이 사라진다(beforeunload 경고가 뜬다).
- 담당 추정: ads-admin-ui
- 제안: `preset_not_found`와 `invalid_preset_id`에서도 다시 불러오기 버튼을 보인다. 예를 들어 상태를 `conflict` 대신 `reloadable`로 둔다.

### R4-2 [중간] 다른 곳에서 지워진 프리셋의 편집 초안이 "저장하지 않은 변경"으로 계속 남음

- 위치:
  - `ui/src/screens/PlayersScreen.tsx:100-102`: `dirty`는 모든 draft를 본다.
  - `ui/src/screens/PlayersScreen.tsx:362-372`: entry가 없으면 안내만 보인다.
  - `ui/src/screens/PlayersScreen.tsx:276`: draft를 지우는 곳은 이 탭에서 삭제했을 때뿐이다.
- 재현: R4-1에서 409를 받고 "프리셋 목록 다시 불러오기"를 누른다.
  1. 목록에 그 프리셋이 없으므로 편집 화면이 "프리셋을 찾지 못했어요" 안내로 바뀐다.
  2. 그런데 `drafts['edit:p-…'].dirty === true`가 남는다.
- 실제:
  - 그 입력은 어디에서도 볼 수 없고, 새 프리셋으로 살릴 수도 버릴 수도 없다.
  - 그런데도 `setDirty('players', true)`가 유지된다. 그래서 탭을 닫을 때와 로그아웃할 때 "저장하지 않은 변경이 있어요"가 계속 나온다.
  - 계약 §3.2의 "409에서는 입력을 유지"가 이 경우에는 지켜지지 않는다.
- 기대: 지워진 프리셋의 초안을 "새 프리셋으로 저장"할 수 있게 하거나, 버린다고 확인한 뒤 dirty를 정리한다.
- 담당 추정: ads-admin-ui
- 제안:
  - entry가 없고 draft가 있으면 "입력한 값으로 새 프리셋 만들기"(draft를 `new`로 옮기고 id를 null로)와 "입력 버리기"를 보인다.
  - 다시 불러온 목록에 없는 `edit:` draft는 dirty 계산에서 뺀다.

### R4-3 [중간] 소재 목록에 로딩 상태가 없어, 받기 전 빈 목록을 "소재 없음"으로 보여 줌

- 위치:
  - `ui/src/app/Workspace.tsx:41`: `creatives`가 `[]`로 시작하고, loading과 loaded를 구분하지 않는다.
  - 소재 화면: `ui/src/screens/CreativesScreen.tsx:241`("등록한 소재 0개"), `:297`("아직 등록한 소재가 없어요.")
  - 지면 편성: `ui/src/screens/BreakEditor.tsx:203`("먼저 사용할 소재를 등록해 주세요"), `:213-215`(추가 버튼 사유 "사용할 소재가 없어요.")
  - 편성을 먼저 받으면 `ui/src/screens/BreakEditor.tsx:192`의 `creative`가 undefined가 된다. 그래서 `:272` legend에 이름 대신 `creativeId`가 보이고, `:277`의 "보관된 소재" 경고가 빠진다.
- 재현: 느린 네트워크에서 `#/players`나 `#/help`로 들어온 뒤 지면 편성이나 소재 메뉴로 간다. 지연 로드 때문에 이제 이 경로가 생긴다.
- 기대: "소재 목록을 불러오고 있어요" 같은 상태 표시. 추가 버튼의 사유도 "불러오는 중"으로 구분한다.
- 실제: 빈 상태 문구가 거짓 안내가 되어, 같은 소재를 다시 등록하게 만들 수 있다(추정). 저장 데이터는 손상되지 않는다(위 요약 참고).
- 담당 추정: ads-admin-ui
- 제안: context에 `creativesState: 'loading' | 'ready' | 'error'`를 더하고, 세 화면이 이 상태로 빈 상태와 로딩을 나눈다.

### R4-4 [중간] 소재 목록 첫 로드가 실패하면 지면 편성에서 다시 시도할 방법이 없고, 오류 배너가 모든 메뉴에 남음

- 위치:
  - `ui/src/app/Workspace.tsx:56-77`: effect가 `[api, needsCreatives]`에만 의존한다. `visited`는 줄지 않으므로 다시 실행되지 않는다.
  - `ui/src/app/Workspace.tsx:100`: 배너가 `main` 최상단에 있다.
  - `listError`를 지우는 곳은 `reloadCreatives` 성공(`:52`)뿐이다. 이를 부르는 곳은 소재 화면(`ui/src/screens/CreativesScreen.tsx:149`, `:193`, `:201`)뿐이다.
- 재현: `#/schedule`로 들어오고 `creatives`가 500을 돌려준다.
- 실제:
  - 지면 편성에는 재시도 버튼이 없다.
  - 플레이어나 도움말 같은 관련 없는 메뉴에도 배너가 계속 보인다.
  - 소재 화면은 오류 배너와 "아직 등록한 소재가 없어요."를 함께 보여 주어 서로 모순된다.
- 기대: 배너 옆이나 지면 편성 화면에 "다시 불러오기"가 있다. 실패했을 때는 빈 상태 대신 오류 상태를 보여 준다.
- 담당 추정: ads-admin-ui
- 제안: 배너에 `reloadCreatives`를 부르는 버튼을 단다. 배너는 소재를 쓰는 메뉴(creatives, schedule)에서만 보인다.

### R4-5 [중간] 소재 목록 로드의 401·403이 재연결 흐름으로 이어지지 않음

- 위치:
  - `ui/src/app/Workspace.tsx:62-72`: 지연 로드는 `run`을 거치지 않는다.
  - `ui/src/app/App.tsx`의 `run`: `if (report.auth) setReconnect(true)`.
  - `creatives`는 관리자 인증이 필요하다(`src/App.php`의 `requireAdmin`).
- 재현: 로그인한 뒤 플레이어나 도움말 메뉴에 오래 머물러 세션이 만료되게 한다. 그다음 지면 편성을 처음 연다.
- 실제:
  - 배너에 "로그인이 만료됐어요… 다시 로그인한 뒤 작업을 이어가 주세요"가 뜨지만, 재연결 버튼이나 로그인 화면은 나오지 않는다.
  - 다른 작업으로 다시 인증해도 Workspace가 다시 마운트되지 않는다(`key=sessionKey`는 로그아웃 때만 바뀐다). 그래서 목록은 계속 비어 있다.
- 기대: 401·403이면 재연결을 표시하고, 다시 인증한 뒤 목록을 다시 받는다.
- 담당 추정: ads-admin-ui
- 제안: 지연 로드 실패를 `describeError(...).auth`로 검사해 재연결을 알리는 콜백(App에서 내려 주는 값)을 부른다. 다시 인증한 뒤에는 R4-4의 재시도를 자동으로 부른다.

### R4-6 [중간] 지금 열려 있는 용어로 가는 HelpLink를 누르면 아무 일도 일어나지 않음

- 위치:
  - `ui/src/help/HelpLink.tsx:20-26`: 클릭 처리가 없는 `<a href>`다.
  - `ui/src/app/Workspace.tsx:301`: 경로는 `hashchange`로만 갱신된다.
  - `ui/src/help/HelpScreen.tsx:60-64`(필터 해제), `:66-76`(스크롤과 포커스, `[target]`에 의존)
- 재현:
  1. `#/help/fixed-video-id`에서 아래로 스크롤한 뒤, '설치 코드' 카드의 "함께 보기 · 고정 영상 ID"를 누른다.
  2. `#/help/draft`에서 분류 칩으로 '초안'이 빠지는 분류를 고른 뒤, 기본 작업 순서의 "초안 저장" 단계 링크를 누른다.
- 기대: 그 용어로 다시 스크롤하고 제목에 포커스한다. 재현 2에서는 필터도 해제한다.
- 실제: 해시가 같아서 이벤트가 없다. 스크롤도 포커스도 없고, 재현 2에서는 용어가 계속 보이지 않는다.
- 담당 추정: ads-admin-designer(help)와 ads-admin-ui
- 제안: HelpLink의 onClick에서 `location.hash === href`이면 기본 동작을 막는다. 대신 HelpScreen에 "다시 열기" 신호(카운터)를 보내거나 직접 스크롤, 포커스, 필터 해제를 한다.

### R4-7 [낮음] PlayersScreen의 하위 페이지 포커스 effect가 객체 identity에 의존해, Workspace가 다시 그려질 때마다 포커스를 h2로 옮김

- 위치:
  - `ui/src/screens/PlayersScreen.tsx:126-133`: 의존성이 `[shownPath, page, titleId]`다.
  - `ui/src/app/Workspace.tsx:145`: `page={path === null ? null : parsePlayerPath(path)}`가 렌더마다 새 객체를 만든다.
- 재현:
  - 시작 메뉴가 소재(그누보드는 하우스 광고)라 시작하면 소재 목록 요청이 나간다. 응답이 오기 전에 플레이어 메뉴로 가서 프리셋 이름을 입력한다.
  - 응답이 오면 `setCreatives` 때문에 Workspace가 다시 그려지고, 입력하던 칸에서 포커스가 "프리셋 수정" h2로 옮겨진다.
  - `run`의 busy가 바뀔 때도 같은 effect가 돈다. 그래서 저장, 삭제, 기본 지정 뒤에는 포커스가 항상 h2로 간다.
  - busy 동안 `main`이 inert라 포커스가 이미 사라지므로, 이 경우는 우연히 복구 역할을 한다.
- 기대: 주석대로 "메뉴 안 페이지가 바뀔 때"에만 포커스를 옮긴다.
- 담당 추정: ads-admin-ui
- 제안: 의존성을 `[shownPath, page !== null, titleId]`로 바꾼다. 저장 뒤 포커스 위치는 따로 정한다.

### R4-8 [낮음] 첫 소재 목록 응답이 나중 재조회 결과를 덮어쓸 수 있음

- 위치: `ui/src/app/Workspace.tsx:48-54`, `:62-68`. 순번이나 취소 장치가 없고, `current` 가드는 언마운트만 막는다.
- 재현:
  1. 소재 화면에 처음 들어와 첫 요청 A가 지연되는 동안 새 소재를 저장한다. 저장 뒤 재조회 B가 나간다.
  2. B가 먼저 오고 A가 나중에 오면, 방금 만든 소재가 목록과 지면 편성 선택지에서 사라진다.
  3. A만 실패하면 B가 성공했는데도 오류 배너가 뜬다.
- 담당 추정: ads-admin-ui
- 제안: 마지막 요청 번호만 반영하거나 AbortController를 쓴다.

### R4-9 [낮음] 소재 저장 뒤 재조회 실패를 지면 편성은 알 수 없고, 메뉴를 다시 열어도 다시 받지 않음

- 위치: `ui/src/screens/CreativesScreen.tsx:148-152`(소재 화면의 `listStatus`에만 표시), `:192-194`(보관이 성공했어도 재조회가 실패하면 실패로 표시)
- 상황:
  - 지면 편성에서는 새 소재가 왜 안 보이는지 알 수 없다.
  - 다른 탭이나 다른 관리자의 변경도 메뉴를 다시 열 때 반영되지 않는다. 시작 때 로드하던 방식에서도 같았으므로 회귀는 아니다(추정).
- 담당 추정: ads-admin-ui
- 제안: 재조회 실패를 전역 `listError`에도 반영한다. 지면 편성에 소재 목록 새로고침을 둔다.

### R4-10 [낮음] 호스트가 숨기는 용어가 정규 해시로 바뀌지 않음

- 위치: `ui/src/app/routes.ts:89`(호스트를 보지 않는 `isHelpTermId`), `ui/src/help/HelpScreen.tsx:53`
- 재현: 독립 설치에서 `#/help/house-ad`, 그누보드에서 `#/help/advertiser`를 연다.
- 실제: 시작 페이지가 나오는데 주소는 그대로다. "모르는 용어는 `#/help`"라는 규칙(`ui/src/app/routes.ts:88`)과 다르다. 포커스는 h1로 가서 문제없다.
- 숨김 용어:
  - 그누보드: video-context, advertiser, campaign, line-item, approval, tier, delivery-status, impression
  - 독립 설치: house-ad, ad-request
- 담당 추정: ads-admin-ui
- 제안: `subPath`에 호스트의 `termsFor(host)`를 넘겨 검사한다.

### R4-11 [낮음] 해시 파싱 경계

- 위치: `ui/src/app/routes.ts:78`, `:89`, `:113-120`

| 입력 | 결과 |
| --- | --- |
| `#/help?x=1` | 메뉴 id가 `help?x=1`이 되어 기본 메뉴로 떨어진다. 도움말이 열리지 않는다. |
| `#/help/skip-offset?x=1`, `#/help/skip-offset/` | 용어를 버리고 시작 페이지(`#/help`)로 간다. |
| `#/players/new/`, `#/players/setup/`, `#/players/edit/default/` | 목록(`#/players`)으로 간다. |
| `%2F`, `%E2%80%A6`, 깨진 `%E0%A4%A` | `decodeURIComponent`를 쓰지 않아 예외가 없고, 시작 페이지나 목록으로 간다. 안전하다. |

- 잘못된 하위 경로는 `replaceState`로 정규화되고, 히스토리 항목은 생기지 않는다. 안내 문구는 없다.
- 형식은 맞지만 없는 프리셋 id는 `ui/src/screens/PlayersScreen.tsx:366-372`의 안내가 나온다.
- 담당 추정: ads-admin-ui
- 제안: 경로를 나누기 전에 `?` 뒤를 버린다. 끝 슬래시 하나는 허용한다.

### R4-12 [낮음] Field `help` 안의 HelpLink 때문에 설명(aria-describedby)이 어색하게 읽힘 (R3-14의 구체 사례)

- 위치: `ui/src/components/Field.tsx:55`, `:63-66`. help span 전체가 describedby가 된다.

| 필드 (위치) | 읽히는 설명 |
| --- | --- |
| 클릭 목적지 URL (`ui/src/screens/BreakEditor.tsx:310`), 이 광고의 스킵 (`:322`), 적용 단위 (`ui/src/screens/ScheduleScreen.tsx:281`) | 라벨을 반복한다: "클릭 목적지 URL 도움말" |
| 이 대상의 광고 (`ui/src/screens/ScheduleScreen.tsx:388-393`) | "…아래 편성 전체로 대체해요. 직접 편성 · 전체 대체 도움말". 선택값과 같은 말이 두 번 나온다. |
| 시작일 (`ui/src/screens/StatsScreen.tsx:116`) | "조회 조건과 CSV 도움말". 시작일에만 붙어서 날짜와 무관한 설명처럼 읽힌다. |
| 강조 글자색 (`ui/src/screens/PresetEditor.tsx:153-161`) | 라벨은 강조 글자색인데 "…강조색 도움말"로 끝난다. |

- BreakEditor는 광고 항목마다 "?" 탭 정지가 3–4개씩 반복된다.
- 담당 추정: ads-admin-ui와 ads-admin-designer
- 제안: R3-14처럼 링크만 있는 help는 describedby에서 뺀다. 통계 링크는 패널 제목이나 CSV 버튼 옆으로 옮긴다.

### R4-13 [낮음] 표 머리칸 안의 HelpLink

- 위치: `ui/src/screens/CreativesScreen.tsx:262-266`(`상태 <HelpLink termId="archive" />`)
- 실제: `<th>` 이름이 "상태 보관 도움말"이 되어, 셀을 옮길 때마다 열 머리로 길게 읽힌다.
- 담당 추정: ads-admin-ui
- 제안: 링크를 표 caption 옆이나 toolbar로 옮긴다.

### R4-14 [낮음] 옵션 표와 편집 화면의 용어 연결이 다름

- 위치: `ui/src/screens/PlayerOptions.tsx:36-38`(`ads.`로 시작하면 모두 `player-ad-overlay`)
- 상황:
  - `ads.accentColor` 행은 옵션 표에 '광고 화면' 링크가 있다. 그런데 편집 화면의 같은 칸(`ui/src/screens/PresetEditor.tsx:261-265`)에는 링크가 없다. 위치표 37행은 "맞는 용어 없음"이라고 하지만, `ui/src/help/terms.ts:511`에 음량 막대 색 설명이 있다.
  - `ads.timeouts.*` 행도 '광고 화면'에 연결되지만, 그 용어에는 시간 제한 설명이 없다.
- 담당 추정: ads-admin-designer
- 제안: 둘 중 한 기준으로 맞춘다. 시간 제한 행은 링크를 빼거나 용어에 설명을 더한다.

### R4-15 [낮음] 재생 테스트의 프리셋 목록을 다시 받다 실패하면 안내와 선택이 모순됨

- 위치: `ui/src/screens/PlaybackPanel.tsx:55-75`, `:216-238`
- 재현: 지면 편성을 다시 열 때 `player-presets` 요청이 실패한다(이전에는 성공했음).
- 실제: `presetsError=true`이지만 `presets`는 예전 목록 그대로다. 그래서 select는 예전 목록을 보여 주고 링크도 그 프리셋을 쓰는데, 도움말은 "불러오지 못해 패키지 기본값으로 재생해요"라고 말한다.
- 담당 추정: ads-admin-ui
- 제안: 실패할 때 예전 목록을 유지한다면 문구를 "최신 목록을 불러오지 못했어요. 이전 목록으로 보여 줘요"로 바꾼다.

### R4-16 [낮음] 설치 코드 생성기의 상태 표시

- 위치: `ui/src/screens/PlayerSetup.tsx:124-130`, `:171`, `:227-228`
- 상황:
  - 목록 로드가 실패해도 오류 문구를 `tone="info"`로 보여 준다. 다시 불러오기 버튼도 없다. 목록과 편집 화면에는 있다(`ui/src/screens/PlayersScreen.tsx:474-485`). 새 프리셋 화면도 저장 버튼 사유로만 보여 준다.
  - `problem`의 StatusMessage는 문구를 가진 채 마운트되어, 처음 문구가 읽히지 않을 수 있다(R3-10과 같은 패턴).
  - 고른 프리셋이 다른 곳에서 지워지면 select는 첫 항목을 보여 주는데, 아래 안내는 "고른 프리셋이 목록에 없어요"라고 한다.
- 담당 추정: ads-admin-ui
- 제안: `ListState`를 다시 쓴다. 지워진 선택은 기본 프리셋으로 되돌린다(PlaybackPanel `:77-79`처럼).

### R4-17 [낮음] 저장하지 않은 변경 표시가 값을 되돌려도 남음

- 위치: `ui/src/screens/PlayersScreen.tsx:172-184`(`dirty: true` 고정)
- 재현: 이름을 바꿨다가 원래 이름으로 되돌린다.
- 실제: "저장하지 않은 변경" 배지와 이탈 경고가 남는다. 흔한 단순화이지만, 이번 TASK 기준인 "표시가 정확한지"에는 어긋난다.
- 담당 추정: ads-admin-ui
- 제안: `presetInput(form)`과 base를 비교해 dirty를 계산한다.

### R4-18 [낮음] 이 탭에서 삭제할 때 그 프리셋의 편집 초안을 조용히 버림

- 위치: `ui/src/screens/PlayersScreen.tsx:256-263`(확인 문구), `:276`(draft 삭제)
- 실제: 확인 대화상자가 저장하지 않은 편집이 있는지 말하지 않는다.
- 담당 추정: ads-admin-ui
- 제안: `drafts['edit:'+id]?.dirty`이면 확인 본문에 "저장하지 않은 수정도 함께 사라져요"를 더한다.

### R4-19 [낮음] 복제 이름이 40자를 넘을 수 있음

- 위치: `ui/src/screens/preset-form.ts:168-170`(`${name} 복사본`)
- 재현: 37자 이상인 이름의 프리셋을 복제한 뒤 저장한다.
- 실제: 바로 이름 오류("1–40자")가 난다. 계약은 복제 이름 규칙을 정하지 않았다.
- 담당 추정: ads-admin-ui
- 제안: 원래 이름을 잘라 40자 안에 맞추거나, 복제 안내 문구에 길이 확인을 넣는다.

### R4-20 [낮음] 문구

- `ui/src/screens/PlayersScreen.tsx:298`의 `"${name}"을 기본 프리셋으로…`: 받침이 없는 이름 뒤에서는 '를'이어야 한다. 예: `"기본"을`은 맞고 `"브랜드A"을`은 틀리다.
- 목록 화면의 409 문구가 편집 화면과 같아서, 입력이 없는 화면에서 "입력은 그대로 두었어요"라고 말한다(`ui/src/screens/PlayersScreen.tsx:161` → `ui/src/screens/preset-form.ts:339`).
- 담당 추정: ads-admin-ui
- 제안: `"${name}" 프리셋을 기본으로…`처럼 조사 없는 구조로 바꾼다. 목록에서 쓸 409 문구를 따로 둔다.

### R4-21 [낮음] 새 프리셋 저장이 시간 초과 뒤 실제로는 됐을 때 같은 프리셋이 두 번 만들어질 수 있음 (추정)

- 위치: `ui/src/api/client.ts`(시간 초과 문구 "저장됐는지 다시 확인해 주세요"), `ui/src/screens/PlayersScreen.tsx:186-232`
- 재현:
  1. 생성 요청이 서버에서는 반영됐지만 응답이 시간 초과된다.
  2. 다시 저장하면 409가 나고, 다시 불러오면 목록에 새 프리셋이 있다. 그런데 `new` draft가 남아 있다.
  3. 여기서 또 저장하면 두 번째 프리셋이 생긴다.
- 담당 추정: ads-admin-ui
- 제안: 409 뒤 다시 불러왔을 때 `new` draft와 이름이 같은 새 항목이 있으면 알린다. 낮은 우선순위다.

### R4-22 [낮음] 플레이어 메뉴의 프리셋 목록은 다시 들어와도 갱신되지 않음

- 위치: `ui/src/screens/PlayersScreen.tsx:104-123`(`list`가 있으면 다시 받지 않음). 반면 `ui/src/screens/PlaybackPanel.tsx:54`는 방문할 때마다 다시 받는다.
- 실제: 다른 탭에서 만든 프리셋이 목록과 생성기에 보이지 않다가, 쓰기에서 409가 난 뒤에야 맞춰진다. 두 화면의 동작이 다르다.
- 담당 추정: ads-admin-ui
- 제안: activation이 바뀔 때 목록을 다시 받는다. 초안은 유지한다.

### R4-23 [낮음] 미리보기 중 "?"를 누르면 미리보기가 멈춤 (알아 둘 점)

- 위치: `ui/src/screens/PlaybackPanel.tsx:88-93`, `:185`
- 상황: 메뉴가 숨겨지면 미리보기를 멈추는 설계라서, 게시 전 미리보기 옆의 "?"를 누르면 멈춘다. 돌아오면 "다른 메뉴로 이동해서 미리보기를 멈췄어요"가 보인다.
- 담당 추정: 오케스트레이터(의도 확인)
- 제안: 그대로 둔다면 "?" 옆이나 미리보기 안내에 "도움말을 열면 미리보기가 멈춰요"를 적는다.

## 확인했지만 문제없는 중점 항목

### 1. 계약 3.2절과 4.1절
- route 다섯 개를 파싱하고 정규화한다(`ui/src/app/routes.ts:102-129`). 잘못된 하위 경로는 목록으로 가고 `replaceState`로 정규화된다. 프리셋 id 형식은 PHP와 같다(`src/PlayerPresets.php:243`, `:260`).
- 내장 default: 목록의 수정과 삭제에 `disabledReason` "내장 프리셋은 바꿀 수 없어요. 복제해서 쓰세요."가 있다. `#/players/edit/default`는 읽기 전용 안내와 "복제해서 새로 만들기"를 보인다.
- 20개 제한: 새로 만들기 버튼, 복제, 내장 프리셋 복제, 새 프리셋 저장(직접 `#/players/new`로 들어와도)이 모두 같은 `LIMIT_REASON`이다. 기존 프리셋 수정은 막지 않는다.
- 복제는 `${name} 복사본`, id null, dirty true다. 새 초안이 있으면 확인한다.
- 기본 지정은 목록 revision을 쓰고, 이미 기본인 항목은 막는다. 안내 문구가 계약의 기본 프리셋 범위와 맞는다.
- 저장 버튼 옆 문구(`ui/src/screens/PresetEditor.tsx:16-17`)가 계약 문장과 같다. 기본 video 안내 문구(`:140`)도 같다.
- 종류를 바꿔도 숨긴 값은 폼에 남고, 전송할 때는 null이다(`ui/src/screens/preset-form.ts:251-281`). 시간 제한은 native에서만 보내고, Video.js에는 "준비 중" Note가 있다.
- 대비 경고: 4.5:1 미만이면 경고하고 저장은 막지 않는다. 강조 글자색이 비면 검정과 비교하고 "강조 글자색도 지정해 주세요"를 안내한다(`ui/src/screens/preset-form.ts:319-337`).
- 생성기:
  - `assetsUrl`은 `playerModuleUrl` 디렉터리의 절대 URL이고, 쿼리를 버린다(`ui/src/screens/PlayerSetup.tsx:41-43`).
  - `apiUrl`은 `location` 기준이다(`:150`).
  - native에서는 HLS 라디오가 비활성이고, `installSnippet`도 거부한다.
  - `playerModuleUrl`이 없으면 이유 Note를 보인다.
  - 처음에는 기본 프리셋이 선택된다(`presetId: null`, `:132`). PlaybackPanel도 같다(`:77-79`).
- 옵션 표의 `presetField` 값 17개가 모두 편집 라벨로 바뀐다(`ads.labels`는 묶음 라벨).

### 2. 오류 경로
- 422의 `fields`는 `PresetPath`와 정확히 같은 키일 때만 표시한다. 중첩 경로 `theme.*`, `ads.labels.*`, `ads.timeouts.*`도 그대로 맞는다. 서버 문구는 화면에 내지 않고(`presetError`가 fields 없는 ApiError로 다시 만든다), 첫 오류 칸으로 포커스한다(테스트 있음).
- 409: 입력을 유지하고 "프리셋 목록 다시 불러오기"를 보인다. 다시 불러온 뒤에도 입력이 남는다(테스트 있음). 상태 문구는 `run`의 공통 409 문구 다음에 `PRESET_CONFLICT_TEXT`로 덮어쓴다.
- 400 `preset_limit`·`preset_builtin`·`invalid_preset_id`, 404 `preset_not_found`의 문구를 해요체로 바꾼다(테스트 있음). 버튼이 없는 문제는 R4-1이다.
- 네트워크 실패와 시간 초과는 클라이언트 공통 문구("입력은 그대로 남아 있어요" 또는 "저장됐는지 다시 확인해 주세요")를 쓴다.

### 3. 상태
- 저장하면 draft를 지우고 응답 목록을 쓰므로 dirty가 false다. 복제 직후는 true, 다시 불러온 뒤에는 true를 유지한다. 예외는 R4-2와 R4-17이다.
- 요청 중에는 `main`이 inert라 입력할 수 없으므로, 응답이 늦게 와도 사용자 입력을 덮어쓰지 않는다.
- revision은 매번 쓰기 응답의 목록(`setList(result.list)`) 값을 다음 요청에 쓴다.
- 메뉴를 옮기거나 도움말로 가도 입력이 유지된다(QA D9 기준). 한 번 연 메뉴는 hidden으로 계속 마운트되고, players는 마지막 하위 페이지를 기억한다.
- 숨겨질 때 ThemePreview(`ui/src/screens/PlayersScreen.tsx:323`)와 PreviewPlayer는 언마운트된다(테스트 있음).

### 4. 도움말 연결
- 포커스 양보: 자식 effect(HelpScreen)가 먼저 용어 제목에 포커스하고, Workspace는 그 제목이 DOM에 있을 때만 그대로 둔다. 숨김 용어나 모르는 용어는 h1로 간다. 첫 진입 때 이미 포커스가 있으면 건드리지 않는다.
- 다른 메뉴를 거쳐 같은 용어로 돌아오면, 숨겨진 동안 path가 null이라 다시 포커스한다. 같은 화면에서 다시 누르는 경우는 R4-6이다.
- 인코딩된 값은 디코드하지 않아 예외가 없다. 용어 id는 ASCII뿐이다.
- 위치표 32행과 실제 `<HelpLink>` 배치가 모두 같다(누락, 추가, termId 다름, 위치 다름 없음). 라벨 안에는 링크를 넣지 않아 컨트롤 이름이 깨끗하다.
- 호스트 전용 링크(그누보드의 house-ad, 독립 설치 영상 대상의 video-context)는 조건대로만 나온다.

### 5. 지연 로드
- 도움말, 목업, 플레이어, 통계, 리포트만 방문하면 `creatives`를 요청하지 않는다. 하우스 광고(`kind: 'creatives'`)는 포함된다.
- 소재와 지면 편성을 오가거나 다시 들어가도 추가 요청이 없다. StrictMode에서는 개발 모드에서만 두 번 요청하고, 첫 응답은 버린다.
- 소재 화면에서 만들거나 보관한 결과는 같은 context로 지면 편성에 바로 반영된다.

## 테스트 공백

1. 프리셋: 404·400 뒤 다시 불러오기 경로(R4-1). 지워진 프리셋의 초안과 dirty(R4-2). 되돌린 값의 dirty(R4-17). 다른 탭 삭제 뒤 409 → 다시 불러오기 → 안내.
2. 포커스: Workspace가 다시 그려져도 편집 칸의 포커스가 유지되는지(R4-7). 저장 성공 뒤 포커스 위치.
3. 소재 지연 로드:
   - `#/players`로 진입하면 `creatives` 요청이 없고, 지면 편성을 열면 한 번만 요청하는지.
   - 실패 배너, 재시도, 재시도 성공 뒤 배너가 사라지는지(R4-4).
   - 401 재연결(R4-5).
   - 로딩 표시(R4-3).
   - 응답 순서 역전(R4-8).
   - 소재가 있는 편성: 지금 테스트는 모두 `creatives: { items: [] }`라 이름 legend와 보관 경고(`ui/src/screens/BreakEditor.tsx:272`, `:277`)를 전혀 검증하지 않는다.
4. 해시: `#/help?x`, 끝 슬래시(`#/help/x/`, `#/players/new/`), 그누보드 숨김 용어, 숨김 용어의 `location.hash` 정규화(R4-10, R4-11).
5. 도움말: 같은 해시 다시 누르기, 필터가 걸린 상태에서 다시 들어가기(R4-6). `app.test.tsx`에는 도움말 테스트가 없다.
6. HelpLink:
   - 배치 테스트가 `getAllByRole(...)[0]`만 본다(`ui/tests/admin-help.test.tsx:331`).
   - 다루지 않는 위치: post-roll, inherit 모드, revision-conflict, 그누보드의 video-context 부재, 미드롤 구간 제목 무링크.
   - describedby 결과 문자열(R4-12), 표 머리 이름(R4-13), 옵션 표의 `ads.accentColor`·`ads.timeouts.*` 연결(R4-14).
   - 독립 설치 `#/reports`의 통계 링크.
7. 도움말로 갔다가 돌아왔을 때 players 하위 페이지와 프리셋 입력이 유지되는지. 지금 입력 유지 테스트는 소재와 지면 편성 사이만 본다.
8. 생성기: 목록 로드 실패 표시와 재시도, 고른 프리셋이 지워진 경우(R4-16). 재생 테스트의 프리셋 재조회 실패(R4-15).

## 실행한 검사

| 검사 | 결과 | 로그 |
| --- | --- | --- |
| `pnpm -F @videojs/ads-manager-ui test` | 16개 파일, 394개 통과, exit 0 | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r4-test.log` |
| `pnpm -F @videojs/ads-manager-ui typecheck` (tsgo) | exit 0 | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r4-tc.log` |
| `php tests/backend/run.php` | PASS 70 + 7 + 95, exit 0 | `/private/tmp/claude-501/-Users-brian-works-tools-videojs-video-js/4d20f4bf-e231-4a6b-8092-fb52f7d95ab1/scratchpad/r4-php.log` |
| 읽기, grep | 대상 파일 전체와 `App.tsx`, `status.tsx`, `client.ts`, `Support.php`, `HelpScreen.tsx`, `HelpLink.tsx`를 읽음 | — |

- 하위 조사 두 건(도움말 경로와 HelpLink 위치표, 소재 지연 로드)도 읽기 전용으로 진행했다. 핵심 줄은 직접 다시 읽어 확인했다: `ui/src/screens/CreativesScreen.tsx:241`, `:262-266`, `:297`, `ui/src/screens/BreakEditor.tsx:192`, `:200-216`, `:270-279`, `ui/src/help/HelpScreen.tsx:52-76`, `ui/src/help/HelpLink.tsx:18-27`, `ui/src/screens/ScheduleScreen.tsx:386-394`.

## 실행하지 않은 것

- 브라우저, 화면 읽기 프로그램, 서버, DB, build, `/private/tmp/ads-qa-*`: 금지 범위다.
- 이번 대상에는 예제 JS 변경이 없어서 `node --check`는 돌리지 않았다.
- 아래는 코드를 읽고 판단한 것이고, 실행해서 재현하지 않았다.
  - R4-7: 포커스 이동
  - R4-8: 응답 경합
  - R4-21: 시간 초과 뒤 중복 생성
  - R4-3: 중복 등록 가능성
  - R4-1 재현에서 409와 404 중 어느 것이 오는지
- `tests/backend/http_test.py`: 서버가 필요해서 돌리지 않았다.
