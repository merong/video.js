# A1-QA 관리자 앱 최소 구현 인수 시나리오

2026-10-20 작성. 작성자는 ads-qa이고 TASK는 A1-QA-PLAN이다. **아래 시나리오는 모두 NOT_RUN이다.** 이번 TASK에서는 서버 시작, 설치, DB 접근, 브라우저 실행, 빌드와 테스트 실행을 하지 않았다. 실행은 빌드가 끝난 뒤 오케스트레이터가 따로 배정한다.

갱신 이력: 2026-10-20 A1-QA-PLAN-2. 사용자 결정으로 계약 4절의 런타임 CDN 금지가 없어졌다(관리자 앱은 `design/components/fonts.css`로 Google Fonts를 불러온다). 그래서 U01에서 CDN 단언을 지웠고, B17은 REMOVED로 바꿨다. 나머지 시나리오는 NOT_RUN 그대로다.

갱신 이력: 2026-10-20 A1-QA-PLAN-3. 사용자 요청 두 가지(도움말, 플레이어 관리)에 맞춰 3.1절 HL01–HL15, 3.2절 PL01–PL24, 3.3절 근거표 연결, 9절 D8–D14 제안을 더했다. 새로 더한 시나리오도 모두 NOT_RUN이다.

기준 문서:

- `.agents/plans/ads-admin-app-contract.md`: 2절 F1–F6, 3절 메뉴와 목업, 4절 셸·mount·export 계약, 6절 완료 조건
- `.agents/plans/ads-contract-v1.md`: 봉투, CSRF, `preview:true`, 이벤트
- `workspaces/ads-takeoff-20261020/CLAUDE-ORCHESTRATOR-TAKEOFF.md` 7절: 증거 경계
- `integrations/ads-manager/README.md`: 설치와 검증

증거 종류는 세 가지다. **단위**는 Vitest와 PHP 테스트 출력, **HTTP**는 실제 HTTP 응답(상태, 헤더, 본문 일부), **브라우저**는 실제 브라우저의 화면, DOM, 네트워크 목록, 포커스 기록이다. 버튼 클릭 성공만으로 관측값을 대신하지 않는다.

호스트 구분:

- **[S]**: 독립 설치(`capabilities.host = "standalone"`). 아래 "격리 실행 환경"의 새 SQLite 설치와 새 포트에서 실행한다.
- **[G-U]**: 그누보드 호스트 동작 가운데 단위 검사(bootstrap 응답 모의)로 확인할 수 있는 항목.
- **[G-실환경]**: 실제 그누보드 로그인, 메뉴 권한, 소모성 CSRF가 필요한 항목. **실행 환경이 정해지지 않았다**(미결정 D1). 정해지기 전까지 실행하지 않는다.
- **[공통]**: 호스트와 무관한 빌드, 셸, 회귀 항목.

## 1. 단위와 정적 검사

| ID | 계약 | 호스트 | 사전 조건 | 단계 | 기대 결과 | 증거 | 상태 |
|---|---|---|---|---|---|---|---|
| U01 | 6절 빌드 | 공통 | A1-UI, A1-DS, A1-PLAYER 구현 완료 | `pnpm -F @videojs/ads-manager-ui build` 실행 후 `public/assets/admin-app/` 목록과 SHA-256 기록 | `admin-app.js`, `admin-app.css` 두 고정 이름만 생성. JS가 ES 모듈이고 `mountAdsAdmin`을 export. 번들 안에 `process.env.NODE_ENV` 참조가 남지 않음 | 단위(빌드 로그, 파일 목록, 해시, grep 결과) | NOT_RUN |
| U02 | 6절 정적 검사 | 공통 | U01 | UI 패키지 `test`, `typecheck`(tsgo), `vp check` 실행 | 모두 종료 코드 0. 실패와 건너뛴 테스트 수를 그대로 기록 | 단위(로그 원본) | NOT_RUN |
| U03 | 2절 v1 규약, 6절 API 클라이언트 | 공통 | U02 | API 클라이언트 테스트 이름과 단언을 읽고 실행 결과와 맞춤 | 봉투 `{ok,data}`와 오류 해석, 오류 응답을 포함한 `X-CSRF-Token` 선반영, multipart `csrfToken` 필드, 409 처리, 모호한 네트워크 실패 뒤 쓰기 자동 재시도 없음. 다섯 항목 각각에 대응 테스트가 있음 | 단위(테스트 파일 경로·이름 대응표, 로그) | NOT_RUN |
| U04 | F2·F3 입력 보존 | 공통 | U02 | 저장 실패(검증 오류, 409, 네트워크 실패) 화면 테스트 확인 | 실패 뒤 입력값 유지, 실제 오류 문구 표시, 성공 상태 없음 | 단위 | NOT_RUN |
| U05 | 3절 호스트별 메뉴 | S, G-U | U02 | `capabilities.host`를 standalone과 gnuboard로 바꾼 렌더 테스트 확인 | 메뉴 항목과 순서가 3절 표와 같음. 독립: 대시보드·캠페인·소재·지면 편성·승인함·리포트·설정 + 우측 "집행 만들기". 그누보드: [사이트 이름] 광고 관리·광고 요청·하우스 광고·지면 편성·통계·설정 + 우측 사이트 보기·관리자·창 닫기 | 단위 | NOT_RUN |
| U06 | 3절 그누보드 셸 | G-U | U02 | `window.opener` 유무와 사이트 이름 유무 조합 테스트 확인 | opener가 있을 때만 "창 닫기"가 보이고 `window.close()`를 호출. 없으면 숨김. 사이트 이름이 없으면 "광고 관리" | 단위 | NOT_RUN |
| U07 | 3절 목업, 4절 mocks export | 공통 | U02 | `mockScreens` 키 구조와 목업 렌더 테스트 확인. 렌더 중 `fetch` 감시 | `standalone.{dashboard,campaigns,approvals,reportV2,settings}`, `gnuboard.{requests,settings}`가 prop 없는 컴포넌트. "목업 · 아직 동작하지 않아요" 표시. 쓰기 버튼 `disabled`와 이유 문구. `fetch` 호출 0 | 단위 | NOT_RUN |
| U08 | F4, 4절 player export | 공통 | U02 | `PreviewPlayer` 테스트 확인 | `createAdsController({preview:true})`로 생성. unmount와 prop 변경 시 `destroy()` 호출. 이번 실행 기록만 표시 | 단위 | NOT_RUN |
| U09 | F5, 4절 player export | 공통 | U02 | `PlayerTestLinks` 테스트 확인 | 두 링크가 `examples/player.html?video=&content=`, `examples/videojs.html?video=&media=mp4&content=` 형식이고 새 탭(`target="_blank"`, `rel="noopener"`)으로 열림. `content`를 `examples/` 페이지 기준으로 해석했을 때 `/demo-media/grok-20261018/content-scene-01.mp4`가 됨(미결정 D3) | 단위 | NOT_RUN |
| U10 | 6절 기존 검사 유지 | 공통 | 없음 | 관리자 v1 Vitest, `php tests/backend/run.php`, PHP lint(`admin/index.php`, `admin/app.php`, `public/index.php`) 실행 | v1 Vitest 59, PHP SQLite 70 유지. 수가 바뀌면 바뀐 이유를 기록 | 단위(로그) | NOT_RUN |

## 2. HTTP

H01은 격리 설치 서버에서 확인한다. H02와 H05는 저장소 HTTP 테스트(`tests/backend/http_test.py`)가 자체 임시 설치와 OS가 고른 포트로 확인한다. 공유 `public/assets/admin-app/`을 지우거나 옮겨 번들 없음 상태를 만들지 않는다.

| ID | 계약 | 호스트 | 사전 조건 | 단계 | 기대 결과 | 증거 | 상태 |
|---|---|---|---|---|---|---|---|
| H01 | 4절 셸 계약 | S | 격리 서버 실행, U01 | `GET /` 응답 본문과 헤더 저장 | 200. `<title>솔애드 관리자</title>`, `<div id="ads-admin-root">`, `<script id="ads-config" type="application/json">` 안의 `apiUrl`과 `/assets/admin-app/`로 끝나는 `assetUrl`. `admin-app.css`와 module `admin-app.js`에 `?v=<숫자>`. `<noscript>` 안내 | HTTP | NOT_RUN |
| H02 | 4절 번들 없음 | S | U01 | `http_test.py` 실행, 번들 없음 단언 출력 확인 | 503, "관리자 화면 파일이 없습니다. `ui`를 빌드해 주세요." 안내, 꾸민 화면 없음 | HTTP(테스트 로그) | NOT_RUN |
| H03 | 4절 진입 | S | 격리 서버 | `GET /?ui=v1` 응답 저장. `git diff --stat -- integrations/ads-manager/admin/index.php integrations/ads-manager/public/assets/admin` 확인 | 기존 v1 셸이 그대로 나옴. v1 셸과 `public/assets/admin/**` 변경 없음 | HTTP, Git diff | NOT_RUN |
| H04 | 4절 API 추가 | S | 격리 서버 | 로그인 전후 `GET ?action=bootstrap` 저장(쿠키와 토큰 값은 가림) | 로그인 뒤 `user.displayName`이 설치 때 쓴 로그인 아이디. 로그인 전에는 `user` 없음 또는 계약이 정한 값. 그 밖의 응답 필드는 v1과 같음 | HTTP | NOT_RUN |
| H05 | 6절 HTTP 110+ | S | U01 | `python3 integrations/ads-manager/tests/backend/http_test.py` | 기존 110 통과. 셸 선택, 번들 없음, `user.displayName` 추가 단언은 따로 집계 | HTTP(테스트 로그) | NOT_RUN |
| H06 | 4절 번들 | S | 격리 서버, U01 | `admin-app.js`, `admin-app.css`, `/assets/ads.js`의 상태 코드, Content-Type, 본문 SHA-256 | 200, JS는 JavaScript MIME, CSS는 `text/css`. HTTP 바이트 해시가 로컬 파일 해시와 같음 | HTTP | NOT_RUN |

## 3. 브라우저: 독립 설치 [S]

모든 B 시나리오는 격리 서버 한 곳에서 이 순서대로 실행한다. 앞 시나리오의 데이터를 다음 시나리오가 쓴다. 특별한 표시가 없으면 1280px에서 실행한다.

| ID | 계약 | 사전 조건 | 단계 | 기대 결과 | 증거 | 상태 |
|---|---|---|---|---|---|---|
| B01 | F1 | 격리 서버, H01 | 틀린 비밀번호로 로그인 → 올바른 비밀번호로 로그인 → 소재 메뉴로 이동 → 새로고침 → 로그아웃 → 새로고침 | 실패 시 오류 문구, 입력한 아이디 유지. 성공 뒤 `displayName` 표시. 새로고침 뒤 같은 해시와 메뉴 유지. 로그아웃 뒤 로그인 화면, 보호 화면 접근 불가 | 브라우저(화면, URL 해시, 네트워크) | NOT_RUN |
| B02 | F2 URL 등록 | B01 로그인 | 소재 → URL 등록: `/demo-media/grok-20261018/ad-coffee-6s.mp4`, 이미지 `/demo-media/ad.png` | 두 소재가 목록에 생김. 입력 소재 미리보기에서 실제 영상과 이미지가 보임. `creative-save` POST 각 1회, `X-CSRF-Token` 헤더 포함 | 브라우저(네트워크, 화면) | NOT_RUN |
| B03 | F2 파일 업로드 | B02 | 파일 업로드: `ad-earbuds-12s.mp4`(9.4MB), `ad-water-8s.mp4`(10.6MB) | 각각 `creative-upload` multipart 1회, 200. 목록과 미리보기 표시. 업로드된 미디어 URL이 `/media/<32hex>.mp4`이고 Range 요청에 206 | 브라우저(네트워크), HTTP(Range) | NOT_RUN |
| B04 | F2 수정·보관 | B03 | coffee 소재 이름 수정 → 저장. 별도 테스트용 URL 소재 하나를 만들어 보관 | 수정이 새 버전으로 저장됨. 보관 소재는 편성 소재 선택에서 고를 수 없음 | 브라우저 | NOT_RUN |
| B05 | F2 입력 보존 | B02 | URL 칸에 `javascript:alert(1)`, `ftp://x/a.mp4`를 넣고 저장 | 서버 검증 오류 문구가 보이고 입력 유지. 목록에 추가되지 않음. 다음 쓰기가 오류 응답의 새 CSRF 토큰으로 성공 | 브라우저(네트워크 헤더 순서) | NOT_RUN |
| B06 | F3 편성·초안 | B03, B04 | 사이트 기본, `replace`. pre: coffee(스킵 불가), earbuds(3초 후 스킵). mid@5초: water(3초 후 스킵). post: ad.png(표시 3초, 스킵 불가). 클릭 URL 하나 입력. 초안 저장 | 저장 성공, revision 증가. 새로고침 뒤 같은 값. 순서 변경과 삭제가 반영됨 | 브라우저(화면, `schedule-save` 응답) | NOT_RUN |
| B07 | F3 409 | B06 | 같은 편성을 두 탭에서 연다. 탭 A 저장 → 탭 B 수정 후 저장 | 탭 B는 409 충돌 안내. 입력 유지. 성공 표시 없음. 자동 재시도 없음 | 브라우저(두 탭 네트워크) | NOT_RUN |
| B08 | F3 게시·상속·영상 소속 | B06 | 게시. 영상 `a1-qa-video-1`을 게시판 `notice`, 분류 `1`로 등록(`video-context-save`). 대상 검색과 수동 ID로 그 영상을 연다. 게시판 대상을 `disabled`로 바꿨다가 `inherit`로 되돌림 | 게시 성공, 버전 표시. 영상 대상에서 상속 출처가 "사이트 기본"으로 보임. `disabled`일 때 출처 표시가 바뀜. 실험 뒤 게시 상태를 사이트 기본 상속으로 복원 | 브라우저 | NOT_RUN |
| B09 | F4 미리보기, 수집 0 | B08 | 네트워크 기록 시작 → 미리보기 실행 → pre 2개, mid, post, 본편 끝까지 재생 → 다른 메뉴로 이동 | 실제 광고 프레임과 시간 진행. 실행 기록 표시. 요청은 `schedule-preview` 1회와 미디어 GET만. `action=events` 0, 공개 `action=schedule` 0. 메뉴 이동 뒤 광고와 본편 소리, 요청 멈춤 | 브라우저(네트워크 전체 목록, 화면) | NOT_RUN |
| B10 | F5 재생 테스트 | B08, B09 | 지면 편성의 "게시본 재생 테스트"에서 player.html 링크와 videojs.html 링크를 각각 새 탭으로 연다. 각 탭에서 재생해 post까지 보냄 | 새 탭 열림. `content` 주소가 200 응답. 공개 `schedule` GET 200, `events` POST 200(accepted). 광고 pre/mid/post 재생 후 본편 ended | 브라우저(각 탭 네트워크, 화면) | NOT_RUN |
| B11 | F6 통계·CSV | B09 전후, B10 | B09 전, B09 뒤, B10 뒤 세 번 오늘 날짜 통계를 조회. 광고·영상·게시판 필터 각각 적용. CSV 내려받기 | B09 전후 starts 변화 없음. B10 뒤 해당 광고와 영상의 starts가 B10에서 시작한 attempt 수만큼 증가. 필터 결과가 일치. CSV가 UTF-8 BOM이고 화면 숫자와 같음 | 브라우저(화면, 네트워크), CSV 파일 | NOT_RUN |
| B12 | 3절 목업 | B01 로그인 | 네트워크 기록 시작 → 대시보드, 캠페인(목록, 상세 집행 표), 승인함, 리포트 v2 영역, 설정, "집행 만들기"를 메뉴 클릭으로 차례로 연다. 각 화면의 쓰기 버튼을 클릭하고 Enter도 눌러 본다 | 각 화면 상단에 "목업 · 아직 동작하지 않아요". 메뉴 클릭 뒤 API 요청 0. 쓰기 버튼은 비활성이고 이유 문구가 보임. 성공 메시지나 상태 변화 없음. "미구현" 안내 카드로 대신한 화면은 기획 문서 위치가 있음 | 브라우저(네트워크, 화면) | NOT_RUN |
| B13 | 6절 1280px | B06–B12 데이터 | 1280×800에서 로그인, 소재, 지면 편성(항목 4개 이상), 미리보기, 통계, 목업 2개 확인 | 가로 스크롤 없음(`documentElement.scrollWidth <= clientWidth`). 버튼, 표, 폼 잘림이나 겹침 없음 | 브라우저(스크린샷, 측정값) | NOT_RUN |
| B14 | 6절 768px | B13 | 768×1024에서 B13과 같은 화면 | B13과 같은 기준. 메뉴 접근 가능. 지면 편성의 게시와 저장 버튼이 보이고 누를 수 있음 | 브라우저(스크린샷, 측정값) | NOT_RUN |
| B15 | 6절 키보드 | B08 | 마우스 없이 Tab, Shift+Tab, Enter, Space만으로 메뉴 이동 → 지면 편성 → 항목 수정 → 초안 저장 → 게시 | 모든 단계 완료. 포커스 표시가 보임. 포커스가 숨겨진 요소에 갇히지 않음. 목업의 비활성 버튼이 동작하지 않음 | 브라우저(activeElement 기록, 네트워크) | NOT_RUN |
| B16 | v1 규약 재시도 금지 | B06 | 개발자 도구로 오프라인 전환 → 초안 저장 → 온라인 복귀 | 실패 안내, 입력 유지. 복귀 뒤 자동으로 쓰기 요청을 다시 보내지 않음. 사용자가 다시 눌렀을 때만 저장 | 브라우저(네트워크) | NOT_RUN |
| B17 | 삭제(2026-10-20 계약 변경: 런타임 CDN 허용) | B01–B12 기록 | 전체 네트워크 기록에서 요청 출처 집계 | 모든 요청이 격리 서버 출처. 외부 스크립트, 폰트, CDN 요청 0 | 브라우저(네트워크 목록) | REMOVED |
| B18 | 4절 v1 회귀 | 격리 서버 | `/?ui=v1`에서 로그인하고 소재 목록 확인 | 기존 v1 화면이 동작. 새 앱 상태와 섞이지 않음 | 브라우저 | NOT_RUN |

### 3.1 도움말 (HL)

계약 3.1절, 4절 `src/help` export, 6절 도움말 완료 조건을 확인한다. 근거는 `.agents/plans/ads-admin-help-facts.md`(이하 HF)다. [S] 항목은 B01 로그인 뒤 같은 격리 서버에서 실행한다. 도움말은 데이터를 쓰지 않으므로 B 시나리오와 순서가 얽히지 않는다.

이 문서를 쓸 때(2026-10-20) 확인한 코드 상태: `ui/src/help/`는 있다. `screens/**`와 `app/**`에는 아직 `HelpLink` 사용처와 `help` route 연결이 보이지 않았다. HL03, HL05는 연결이 끝난 뒤에 실행한다.

"API 요청 0"은 7절의 정의(`/api/index.php` 요청 수)와 D2의 기준(메뉴 클릭으로 들어간 뒤를 센다. 바로 새로고침하면 `bootstrap` 1회만 허용)을 따른다. Google Fonts 요청은 따로 기록하고 판정에 넣지 않는다(B17 REMOVED).

| ID | 계약 | 호스트 | 사전 조건 | 단계 | 기대 결과 | 판정 기준(FAIL 신호) | 증거 | 상태 |
|---|---|---|---|---|---|---|---|---|
| HL01 | 3.1 버튼 위치 | S | B01 로그인 | 상단 오른쪽 액션 영역의 버튼 순서를 기록하고 "도움말"을 누른다 | "도움말"이 "집행 만들기" 앞에 있다. 누르면 `#/help`로 가고 제목 "도움말"에 포커스가 간다. 왼쪽 메뉴에는 도움말 항목이 없다(숨김 route) | 위치가 다르다, 메뉴 항목으로 나온다, 포커스가 `body`에 남는다 | 브라우저(DOM 순서, activeElement, 해시) | NOT_RUN |
| HL02 | 3.1 버튼 위치 | G-U, G-실환경 | U05와 같은 그누보드 모의 bootstrap. 실환경은 D1 | 단위: gnuboard 렌더에서 액션 순서를 확인한다. 실환경: G01 화면에서 같은 확인을 한다 | "도움말"이 "사이트 보기" 앞에 있다. `siteUrl`이 없어 "사이트 보기"가 숨겨지면 "관리자"나 "창 닫기" 앞에 온다. 메뉴 항목이 아니다 | 순서가 다르다, 그누보드 화면에 독립 설치 전용 액션("집행 만들기")이 나온다 | 단위, 브라우저(실환경) | NOT_RUN |
| HL03 | 3.1 직접 진입 | S | HL01 | (1) 새 탭에 `#/help/mid-roll`을 열고 새로고침한다. (2) 도움말 안에서 범주 필터를 "통계"로 바꾼 뒤 주소를 `#/help/pre-roll`로 바꾼다. (3) `#/help/stats-csv`로 바꾼다 | 매번 해당 용어 제목(`#sa-help-<termId>`)이 화면 안에 보이고 포커스를 받는다. (2)에서는 필터가 "전체"로 풀려 용어가 보인다. 새로고침한 뒤에도 같은 용어가 열린다 | 제목이 화면 밖에 있다, 포커스가 없다, 필터 때문에 용어가 숨겨진다 | 브라우저(activeElement id, 제목 rect, 스크린샷) | NOT_RUN |
| HL04 | 3.1 잘못된 termId | S | HL01 | `#/help/not-a-term`, `#/help/house-ad`(그누보드 전용 용어), `#/help/`, `#/help/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E`를 차례로 연다 | 도움말 첫 화면이 나온다. 특정 용어로 이동하거나 강조하지 않는다. 오류 화면이나 빈 화면이 아니다. 주소의 문자열이 HTML로 해석되지 않는다 | 흰 화면, 잡히지 않은 콘솔 오류, 다른 용어로 이동, 스크립트 실행, 다른 호스트의 용어가 표시됨 | 브라우저(콘솔, DOM, 스크린샷) | NOT_RUN |
| HL05 | 3.1 `HelpLink` | S | HL01. 화면에 `HelpLink`가 연결돼 있어야 함 | (1) 소재, 지면 편성, 통계, 플레이어 화면에서 `a[href^="#/help/"]`를 모두 모은다. (2) 링크마다 열어 대상 제목이 있는지 확인한다. (3) 지면 편성에서 저장하지 않은 수정이 있는 상태로 "?"를 누른 뒤 브라우저 뒤로 가기를 한다 | (1)(2) 모든 링크가 존재하는 용어 제목으로 가고 포커스가 간다. 이름이 "?"뿐인 링크는 없고, 접근 가능한 이름에 용어 이름이 들어 있다. (3) 결과를 기록한다(판정은 D9) | 없는 용어로 가는 링크, 이름 없는 링크, 링크가 하나도 없는 실동작 화면 | 브라우저(링크 목록과 대상 결과표) | NOT_RUN |
| HL06 | 3.1 API 0 | S | HL01 | 네트워크 기록을 시작한다. 메뉴에서 도움말로 들어가 끝까지 스크롤한다. 필터를 모두 한 번씩 바꾸고, 모션 세 개에서 일시정지와 다시 보기를 누르고, 용어 링크 다섯 개를 누른다. 끝나고 `#/help/ad-break`를 바로 새로고침한다 | 메뉴로 들어간 뒤 `/api/index.php` 요청 0. 바로 새로고침한 경우에는 `bootstrap` 1회만 | `bootstrap`이 아닌 API 요청이 하나라도 있다 | 브라우저(네트워크 전체 목록) | NOT_RUN |
| HL07 | 3.1 일시정지·다시 보기 | S | HL01, 기본 `prefers-reduced-motion: no-preference` | (1) 반복 모션(예: `ad-break`)에서 "일시정지"를 누르고 2초 동안 애니메이션 시간을 두 번 잰다. 다시 눌러 재개한다. (2) "다시 보기"를 누른다. (3) 한 번만 도는 모션(`is-once`)에서 컨트롤을 확인한다 | (1) `aria-pressed="true"`가 되고 `getAnimations()`의 `currentTime`이 멈춘다. 다시 누르면 진행한다. (2) 애니메이션이 처음부터 다시 시작한다. (3) "일시정지" 없이 "다시 보기"만 있다. 컨트롤 묶음 이름은 "<용어> 그림 조작"이다 | 일시정지해도 시간이 흐른다, 다시 보기가 처음으로 돌아가지 않는다, 5초를 넘거나 반복하는 모션에 일시정지가 없다 | 브라우저(애니메이션 시간 측정, 접근성 트리) | NOT_RUN |
| HL08 | 3.1 화면 밖 멈춤 | S | HL07 | 모션 하나가 화면 밖으로 나가도록 스크롤한다. 2초 뒤 그 모션의 애니메이션 시간을 잰다. 다시 화면 안으로 스크롤한다 | 화면 밖에서는 `figure`에 `is-offscreen`이 붙고 애니메이션 시간이 멈춘다. 다시 보이면 이어서 진행한다 | 화면 밖에서도 시간이 흐른다, 다시 보여도 멈춰 있다 | 브라우저(class, 애니메이션 시간) | NOT_RUN |
| HL09 | 3.1 reduced-motion | S | HL01. Playwright `page.emulateMedia({ reducedMotion: 'reduce' })`(D10) | (1) reduce를 켠 채 `#/help`를 새로 연다. (2) 모든 모션 그림의 실행 중 애니메이션 수와 컨트롤을 확인하고 스크린샷을 찍는다. (3) 페이지 안에서 `no-preference`로 바꾼다 | (2) 실행 중인 애니메이션 0, 그림은 최종 상태다. "일시정지"와 "다시 보기"가 없다. 글 설명은 그대로다. (3) 바뀐 설정을 반영하는지 기록한다(판정 대상 아님) | reduce에서 움직이는 그림이 있다, 빈 그림이나 첫 프레임만 보인다, 컨트롤이 남아 있다 | 브라우저(`getAnimations()` 결과, 스크린샷) | NOT_RUN |
| HL10 | 3.1 모션 규칙 | S | HL01 | 모든 용어에서 글 설명과 그림의 DOM 순서, 그림의 `role="img"`와 `aria-label`(또는 `aria-hidden`)을 모은다. 상태 표시(지금 동작·목업·준비 중)와 HF 1.1, 3.1의 D1·D10을 대조한다 | 글 설명이 그림보다 먼저 나온다. 모든 그림에 대체 텍스트가 있거나 숨겨져 있다. 승인함·설정은 "준비 중", 대시보드·캠페인은 "목업"이다. 미리보기는 게시 전, 재생 테스트는 게시 후로 나뉜다 | 대체 텍스트도 숨김도 없는 그림, 목업이나 준비 중 기능을 동작하는 것처럼 설명 | 브라우저(DOM 추출표) | NOT_RUN |
| HL11 | 6절 키보드 | S | HL01 | 마우스 없이: 상단 "도움말"까지 Tab 후 Enter → 필터 변경 → 반복 모션의 "일시정지"를 Space로, "다시 보기"를 Enter로 누른다 → 소재 화면으로 돌아가 `HelpLink`까지 Tab 후 Enter | 모든 단계를 키보드로 끝낸다. 포커스 표시가 늘 보인다. 용어로 이동한 뒤 포커스가 제목에 있다. 포커스가 숨겨진 요소에 들어가지 않는다 | 키보드로 갈 수 없는 컨트롤, 포커스 표시가 안 보임, 포커스가 갇힘 | 브라우저(activeElement 기록) | NOT_RUN |
| HL12 | 6절 폭 | S | HL01 | 1280×800과 768×1024에서 도움말 첫 화면, 기본 작업 순서, 용어 사전 모션 세 개를 확인한다 | 가로 스크롤 없음(`documentElement.scrollWidth <= clientWidth`). 모션 그림과 컨트롤이 잘리거나 겹치지 않는다. 작업 순서 표시가 줄바꿈돼도 읽힌다 | 페이지 가로 넘침, 잘린 그림이나 버튼 | 브라우저(스크린샷, 측정값) | NOT_RUN |
| HL13 | 3.1 호스트별 용어 | S, G-U | HL01, U05 모의 | 독립 설치에서 용어 목록을 모은다. 단위 검사로 gnuboard 렌더의 목록도 모은다 | 독립 설치에는 v2 목업 용어(advertiser 등)가 상태 표시와 함께 있고 `house-ad`, `ad-request`가 없다. 그누보드에는 `house-ad`, `ad-request`가 있고 메뉴 이름이 "하우스 광고"와 "통계"다 | 다른 호스트 전용 용어가 섞인다, 메뉴 이름이 호스트와 맞지 않는다 | 브라우저, 단위 | NOT_RUN |
| HL14 | 4절 `helpTerms` (HF U7) | 공통 | U02 | `helpTerms`와 HF 2절 40개, 플레이어 근거표 5절 12개 termId를 비교한다. `ui/tests/help.test.tsx` 실행 결과도 확인한다 | 52개가 모두 있다(차이가 있으면 목록으로 기록). 용어마다 제목 id가 하나씩 있다 | 근거표에 없는 id, 빠진 id, 제목 없는 용어 | 단위(비교표, 테스트 로그) | NOT_RUN |
| HL15 | HF 서술 실측(U1·U2·U8) | S | B10과 같은 게시본, 별도 영상 ID `a1-qa-help-1`(D14) | (1) player.html 재생 중 스킵 버튼 문구가 "N초 후"에서 스킵 가능으로 바뀌는 순서와 pre→mid→post 순서를 기록한다. (2) 영상 광고와 이미지 광고에서 각각 클릭 URL을 눌러 새 탭이 앞에 올 때 원래 탭의 광고 시간과 이미지 타이머를 기록한다. (3) 같은 링크를 두 번 새로 열어 각각 끝까지 재생한 뒤 통계 starts를 확인한다 | (1) 순서가 도움말 설명과 같다. (2) 관측값을 기록하고 도움말 설명과 대조한다. (3) 새로 열 때마다 새 세션으로 집계된다(starts +2). 같은 세션에서 다시 재생해도 중복 집계되지 않는다 | 도움말 설명과 관측이 다르다(문구 수정 요청으로 보고) | 브라우저(네트워크, 화면, 통계 응답) | NOT_RUN |

### 3.2 플레이어 관리 (PL)

계약 3.2절, 4.1절, 6절 플레이어 완료 조건을 확인한다. 근거는 `.agents/plans/ads-admin-player-facts.md`(이하 PF)다.

실행 순서:

1. **PL01은 프리셋을 처음 쓰기 전에 실행한다.** 새 격리 설치에 meta 키가 없어야 한다.
2. **PL16–PL19는 실제 수집 경로로 재생한다.** 통계에 기록되므로 B11을 마친 뒤 실행하고, 영상 ID를 따로 쓴다(D14).

이 문서의 프리셋 이름:

- P-A: "QA Video.js 중립". `videojs`, `neutral`, 강조색 `#0a3d91`, 강조 글자색 `#ffffff`, 모서리 12, `ads.locale` `en`, `ads.labels.skip` "Skip ad", `ads.fontSize` 15
- P-B: "QA 기본 video". `native`, `ads.locale` `ko`, `ads.timeouts.loadSeconds` 8

| ID | 계약 | 호스트 | 사전 조건 | 단계 | 기대 결과 | 판정 기준(FAIL 신호) | 증거 | 상태 |
|---|---|---|---|---|---|---|---|---|
| PL01 | 4.1 저장, 6절 meta 키 없음 | S | 새 격리 설치, B01 로그인, 프리셋 쓰기 전 | 네트워크 기록을 켜고 메뉴 "플레이어"를 연다. 목록과 버튼 상태를 기록한다. 새로고침한다. 가능하면 D13 방식으로 meta 키를 읽기 전용으로 확인한다 | 목록에 내장 "기본"(`default`) 하나만 있고 기본 표시가 붙어 있다. 수정과 삭제는 없거나 비활성이고 이유가 보인다. 복제는 된다. 요청은 `GET player-presets`뿐이다. `player_presets` meta 키가 생기지 않는다 | 저장 프리셋이 보인다, 읽기만 했는데 POST가 나간다, meta 키가 생긴다 | 브라우저(네트워크, 화면), HTTP(목록 응답), D13 | NOT_RUN |
| PL02 | 3.2 생성 | S | PL01 | `#/players/new`에서 P-A를 입력하고 저장한다. 저장 버튼 옆 안내 문구를 확인한다. 새로고침한다 | 목록에 P-A가 생기고 id가 `^p-[a-z0-9]{10}$`이다. 안내 문구 "저장하면 재생 테스트 페이지에 바로 적용돼요. 이미 붙여 넣은 설치 코드는 다시 복사해야 바뀌어요."가 있다. 새로고침 뒤에도 값이 같다. `player-preset-save` 요청에 CSRF 헤더가 있다 | 저장 뒤 값이 다르다, 새로고침하면 사라진다, 성공 문구만 있고 목록이 그대로다 | 브라우저(네트워크, 화면) | NOT_RUN |
| PL03 | 3.2 수정 | S | PL02 | P-A의 이름과 강조색(`#0f5132`)을 바꿔 저장한다. 새로고침한다 | 바뀐 값이 유지되고 수정 시각과 revision이 오른다 | 이전 값으로 돌아간다, 다른 프리셋 값이 바뀐다 | 브라우저 | NOT_RUN |
| PL04 | 3.2 복제 | S | PL02 | 내장 "기본"과 P-A를 각각 복제해 저장한다 | 새 id를 가진 프리셋 두 개가 생긴다. 이름 말고는 원본 값과 같다. 복제본은 수정할 수 있다 | 원본이 바뀐다, 복제본이 읽기 전용이다, id가 원본과 같다 | 브라우저, HTTP(목록 응답) | NOT_RUN |
| PL05 | 3.2 기본 지정 | S | PL02 | P-A를 기본으로 지정한다. 새로고침한다. 쿠키 없이 `GET ?action=player-preset`을 부른다. 설치 코드 생성기와 지면 편성의 재생 테스트 영역에서 먼저 선택된 프리셋을 본다 | 기본 표시가 P-A로 옮겨지고 새로고침 뒤에도 유지된다. 공개 응답 id가 P-A다. 두 화면 모두 P-A가 먼저 선택돼 있다 | 표시만 바뀌고 공개 응답은 `default`다, 새로고침하면 되돌아간다 | 브라우저, HTTP | NOT_RUN |
| PL06 | 3.2 삭제(앱 Dialog) | S | PL04, PL05 | (1) PL04의 "기본" 복제본에서 삭제를 누르고 Esc로 닫는다. (2) 다시 눌러 "취소"를 누른다. (3) 다시 눌러 확인한다. (4) PL04의 P-A 복제본을 기본으로 지정한 뒤 지우고 새로고침한다. (5) P-A를 다시 기본으로 지정한다(뒤 시나리오가 P-A를 쓴다) | 브라우저 기본 `confirm` 창이 아니라 앱 Dialog(`role="dialog"`, 포커스가 안으로 들어가고 닫으면 삭제 버튼으로 돌아옴)다. (1)(2)에서는 지워지지 않는다. (3)에서는 지워지고 새로고침 뒤에도 없다. (4)에서는 기본이 `default`로 돌아간다. (5) 뒤에는 P-A가 기본이다 | 네이티브 대화상자가 뜬다, 취소했는데 지워진다, 기본 프리셋이 없어진 채로 남는다 | 브라우저(DOM, activeElement, 네트워크) | NOT_RUN |
| PL07 | 4.1 최대 20개 | S | U02, H05 | **브라우저 대신 단위와 HTTP 근거로 판정한다(D11).** 백엔드 테스트(`run.php` 또는 `http_test.py`)에서 21번째 저장의 `400 preset_limit` 단언을 확인하고, UI 단위 테스트에서 그 오류를 표시하는 부분을 확인한다 | 단언이 있고 통과한다. 화면은 실제 오류 문구를 보여 주고 입력을 남긴다 | 단언이 없다(이때는 브라우저로 20개를 만드는 방식으로 바꾸자고 보고한다) | 단위, HTTP(테스트 로그) | NOT_RUN |
| PL08 | 3.2 409 | S | PL03 | 같은 프리셋을 두 탭에서 연다. 탭 A에서 저장한다. 탭 B에서 다른 값을 넣고 저장한다. 이어서 탭 B에서 다른 프리셋을 기본으로 지정한다 | 탭 B의 두 쓰기 모두 409 `revision_conflict` 안내가 나온다. 입력이 남고 다시 불러오기를 안내한다. 자동 재시도는 없다. 다시 불러오면 탭 A의 값이 보인다 | 탭 B 값으로 덮어쓴다, 입력이 사라진다, 쓰기 요청이 다시 나간다 | 브라우저(두 탭 네트워크) | NOT_RUN |
| PL09 | 4.1 422 필드 오류 | S | PL02 | (1) 화면에서 이름을 비우고, 이름 41자, 강조색 `#GGG`, `#ABCDEF`(대문자), 모서리 33, 타이머 문구 `{foo}`를 하나씩 넣고 저장한다. (2) 화면이 서버로 보내지 않고 막은 경우, 서버 422 응답은 H05 HTTP 테스트의 `fields` 단언으로 확인한다 | 오류가 해당 필드 옆에 연결된다(`aria-invalid`, `aria-describedby`). 입력이 남는다. 서버로 간 경우 422 `validation`이고 `fields` 경로가 화면 필드와 맞는다. 범위 밖 값을 조용히 고치지 않는다 | 오류가 화면 위쪽에만 나온다, 값이 자동으로 바뀌어 저장된다, 입력이 사라진다 | 브라우저(DOM, 네트워크), HTTP(테스트 로그) | NOT_RUN |
| PL10 | 3.2 기본 video 전환 | S | PL02 | 새 프리셋에서 `videojs`, `neutral`, 강조색, 모서리를 넣은 뒤 플레이어 종류를 `native`로 바꾼다. 화면을 확인한다. P-B 값을 넣고 저장한다. 다시 `videojs`로 바꿨다가 저장하지 않고 나간다 | `native`에서는 스킨과 테마 항목이 숨겨지고 "기본 video는 브라우저 컨트롤을 써서 스킨 테마가 적용되지 않아요"가 보인다. 시간 제한 항목이 보인다. 저장은 422 없이 성공하고, 목록 응답에서 `skin`과 `theme.*`이 모두 `null`이다. 다시 `videojs`로 바꿨을 때 숨긴 값이 돌아오는지는 기록만 한다 | 숨긴 테마 값이 저장되거나 그 때문에 422가 난다, 안내 문구가 없다 | 브라우저, HTTP(목록 응답) | NOT_RUN |
| PL11 | 3.2 대비 경고 | S | PL02 | 강조색과 강조 글자색 조합을 바꿔 가며 경고를 본다: `#ffff00`/`#ffffff`, `#0a3d91`/`#ffffff`, `#000080`/비움 | 첫 번째는 4.5:1 미만 경고. 두 번째는 경고 없음. 세 번째는 검정과 비교해 경고하고 "강조 글자색도 지정해 주세요"를 안내한다. 세 경우 모두 저장할 수 있다. 경고가 해당 필드에 연결된다 | 경고 기준이 틀리다, 경고 때문에 저장이 막힌다 | 브라우저(DOM, 대비 계산 기록) | NOT_RUN |
| PL12 | 3.2 ThemePreview (PF U-P4, U-P5) | S | PL02 | 편집 화면에서 미리보기 재생을 시작하고 광고 프레임과 시간 진행을 확인한다. 저장하지 않고 강조색, 모서리, `ads.locale`, 스킵 문구, `theme.fontFamily`를 바꾼다. 스킨을 `default`↔`neutral`로 바꾼다 | 실제 Grok 광고와 본편이 재생된다. 저장 전 값이 iframe에 바로 반영되고, 이때 iframe 문서를 다시 요청하지 않는다. 스킨이나 플레이어 종류를 바꿀 때만 문서를 다시 요청한다. U-P4: 스킨 요소 `style`의 `--media-*`, `--ads-*` 값이 그림자 트리 안 `media-container`와 광고 overlay의 계산된 스타일까지 이어진다. U-P5: `system`과 스킨 기본 글꼴의 계산된 `font-family`와 화면 차이를 기록한다 | 저장해야 반영된다, 값을 바꿀 때마다 iframe을 다시 불러온다, 계산된 스타일에 값이 없다 | 브라우저(iframe 문서 요청 수, 계산된 스타일, 스크린샷) | NOT_RUN |
| PL13 | 3.2 미리보기 수집 0 | S | PL12 | 네트워크 기록을 켜고 PL12 미리보기를 pre, mid, post, 본편 끝까지 재생한다 | iframe과 관리자 페이지 모두 `/api/index.php` 요청 0이다(`events`, 공개 `schedule`, `player-preset` 모두 0). 미디어와 정적 파일 GET만 있다. 상태 메시지는 `ads-player-preview-status`로 들어온다 | 수집(`action=events`)이나 공개 편성 요청이 하나라도 있다 | 브라우저(네트워크 전체 목록) | NOT_RUN |
| PL14 | 3.2 미리보기 정지 | S | PL12 | 미리보기 재생 중에 메뉴 "소재"를 누른다. 다시 편집 화면으로 돌아온다. 하위 탐색 "옵션 설명"으로도 같은 확인을 한다 | 이동하면 iframe이 사라지고 소리와 미디어 요청이 멈춘다. 돌아오면 처음부터 새로 준비된다 | 이동 뒤에도 재생이 계속되거나 요청이 이어진다 | 브라우저(DOM, 네트워크 시각) | NOT_RUN |
| PL15 | 3.2 설치 코드 생성 | S | PL05 | `#/players/setup`에서 프리셋, 영상 ID `a1-qa-preset-1`, 본편 URL을 고르고 Video.js MP4, Video.js HLS-SPF, Video.js HLS-hls.js, 기본 video MP4 코드를 만든다. 기본 video에서 HLS를 고를 수 있는지 본다. 영상 ID에 `qa"<x>&1`을 넣은 코드도 만든다. 복사 버튼을 누른다 | 네 코드가 만들어진다. 기본 video는 HLS를 고를 수 없다. 모든 파일 경로와 `<media-ads src>`가 절대 URL이거나 `/`로 시작한다. 속성 값은 HTML 이스케이프되고(`&quot;&lt;`), 스크립트 안 값은 `<`로 바뀐다. 페이지 `lang` 확인 안내가 들어 있다. 복사 결과가 상태 문구로 나온다 | 상대 경로, 이스케이프 누락, 기본 video에 HLS 선택지, 복사 결과 안내 없음 | 브라우저(코드 원문 저장, 화면) | NOT_RUN |
| PL16 | 6절 붙여 넣기 재생 (PF U-P1) | S | PL15, B11 완료, D8 | PL15의 Video.js MP4 코드와 기본 video MP4 코드를 D8 위치의 빈 HTML 두 개에 그대로 붙여 넣는다. 같은 출처로 열어 끝까지 재생한다. HLS 두 코드는 D12에 따른다 | 두 페이지 모두 pre, mid, post 광고와 본편이 재생된다. Video.js 페이지에 P-A 테마와 영어 문구가 적용된다. 공개 `schedule` 200, `events` POST 200(accepted)이다. 콘솔 오류가 없다 | 재생되지 않는다(정적 마크업 업그레이드 문제면 U-P1 결함으로 보고), 테마가 빠진다, 수집이 거부된다 | 브라우저(페이지 원문, 네트워크, 화면) | NOT_RUN |
| PL17 | 3.2 예제 `?preset` (PF U-P4, U-P7 일부) | S | PL02, P-B 저장, B11 완료 | (1) `examples/videojs.html?video=a1-qa-preset-1&media=mp4&content=/demo-media/grok-20261018/content-scene-01.mp4&preset=<P-A>`. (2) `examples/player.html?…&preset=<P-B>`. (3) `player.html`에 P-A(다른 플레이어용)를 넣는다. 각 페이지에서 플레이어·미디어 전환 링크를 누른다 | (1) `<video-neutral-skin>`와 `video-neutral.css`를 쓰고, 스킨 요소의 계산된 `--media-accent-color`가 P-A 값이다. 광고 문구가 영어이고 스킵 문구가 "Skip ad"다. 화면 머리에 "프리셋 <id>"가 보인다. (2) 한국어 문구로 재생한다. (3) 이유를 적은 안내가 나오고 기본값으로 재생한다. 전환 링크에 `preset`이 남는다. U-P7 일부: 모든 스크립트와 청크 요청이 200이다 | 프리셋 값이 빠진다, 다른 플레이어용 프리셋을 그대로 적용한다, 404 청크가 있다 | 브라우저(DOM, 계산된 스타일, 네트워크) | NOT_RUN |
| PL18 | 3.2 잘못된 preset id | S | PL17 | `preset=p-zzzzzzzzzz`(형식은 맞지만 없음), `preset=%3Cscript%3E`(형식 오류), `preset` 없음으로 각각 연다 | 앞의 둘은 "프리셋 …을 적용하지 못해 기본값으로 재생합니다."와 이유가 보이고 기본값으로 재생한다. 응답은 404 `preset_not_found`와 400 `invalid_preset_id`다. 주소의 문자열이 HTML로 해석되지 않는다. `preset`이 없으면 `player-preset` 요청이 없다 | 재생이 멈춘다, 안내가 없다, 스크립트가 실행된다, 쿼리 없이도 프리셋 요청이 나간다 | 브라우저(네트워크, 화면) | NOT_RUN |
| PL19 | 3.2 재생 테스트 링크 preset | S | PL05, B11 완료 | 지면 편성의 "게시본 재생 테스트"에서 프리셋을 `default`, P-A로 바꿔 가며 두 링크의 주소를 확인한다. P-A 링크를 연다 | `default`면 주소에 `preset`이 없다. P-A면 `preset=<id>`가 붙는다. 연 페이지에 P-A가 적용된다 | 쿼리가 빠지거나 `default`가 붙는다 | 브라우저(링크 href, 화면) | NOT_RUN |
| PL20 | 4.1 공개 `player-preset` | S | PL05, P-B | 쿠키 없이 `GET ?action=player-preset`, `&id=<P-A>`, `&id=<P-B>`, `&id=default`, `&id=p-zzzzzzzzzz`를 부르고 본문과 헤더를 저장한다 | `name`이 없다. Video.js는 `attributes`가 있고 `ui`·`timeouts` 키가 없다. native는 `skinTag`·`styles`가 `null`이고 `attributes` 키가 없다. `Cache-Control: no-store, no-cache, must-revalidate`. `X-CSRF-Token` 헤더가 없다. 없는 id는 404 `preset_not_found`. `styles`는 `public/assets/videojs/` 기준 상대 파일 이름이다 | `name`이 실린다, 관리자 토큰 헤더가 실린다, 캐시 가능 | HTTP | NOT_RUN |
| PL21 | 3.2 옵션 설명 | S | PL01, U02 | 네트워크 기록을 켜고 하위 탐색으로 `#/players/options`에 들어간다. 표의 항목 묶음과 열을 모은다. 옵션 표 대조 테스트 결과를 확인한다 | `/api/index.php` 요청 0(D2 기준). `<media-ads>` 속성, `createAdsController` 옵션과 메서드, `--media-*`, `--ads-*`, 예제 쿼리(`video`, `content`, `media`, `engine`, `preset`) 표가 있고, 행마다 이름, 형식, 기본값, 설명, 프리셋 설정 여부가 있다. `media-alt`에 "소재 대체 텍스트를 덮어써요" 경고와 "프리셋에서 설정 안 함"이 있다. 4.1절의 주의 문구(`--ads-*` 직접 지정 무효, 280px 이하 11px, 시간 제한 5초 고정 등)가 있다. 대조 테스트가 통과한다 | API 요청이 나간다, 열이 빠진다, 대조 테스트가 없거나 실패한다 | 브라우저(네트워크, DOM 추출), 단위 | NOT_RUN |
| PL22 | 3.2 하위 탐색, 6절 폭과 키보드 | S | PL02–PL05 | 1280×800과 768×1024에서 목록, 편집(폼과 미리보기), 설치 안내, 옵션 표를 본다. 마우스 없이 하위 탐색 이동 → P-A 편집 → `ColorField` 입력 → 저장 → 삭제 Dialog 열고 닫기 → 코드 복사를 한다 | 하위 탐색은 링크이고 현재 항목에 `aria-current="page"`가 있다(ARIA 탭 아님). 페이지 가로 넘침이 없다(넓은 표는 표 영역 안에서만 스크롤). 768px에서 미리보기와 폼이 겹치지 않는다. 키보드만으로 모든 단계를 끝내고 포커스 표시가 보인다. Dialog 안에 포커스가 머무르고, 닫히면 원래 버튼으로 돌아온다. 화면 필드 옆 `HelpLink`가 `player-*` 용어로 간다(HL05와 같이 기록) | 페이지 넘침, 겹침, 키보드로 갈 수 없는 컨트롤, Dialog 포커스 이탈 | 브라우저(스크린샷, 측정값, activeElement) | NOT_RUN |
| PL23 | 3.2 준비 중 표시 | S | PL01 | 스킨 선택지와 화면에서 "준비 중" 항목(compat·scaffold 스킨, 게시판·분류·영상별 지정, 변경 이력, 사용자 CSS, 로고, 그누보드 자동 삽입 등)을 모은다 | 각 항목에 "준비 중" 표시와 이유가 있고, 고를 수 없거나 누를 수 없다. 성공처럼 보이는 상태를 만들지 않는다 | 준비 중 기능을 고를 수 있다, 이유가 없다 | 브라우저(DOM 추출) | NOT_RUN |
| PL24 | 3.2 그누보드 | G-U, G-실환경 | U05 모의. 실환경은 D1 | 단위: gnuboard 렌더에서 메뉴 순서(지면 편성 다음 플레이어), 설치 안내의 그누보드 문구를 확인한다. 실환경: 같은 화면과 공개 `player-preset`을 확인한다 | 메뉴가 "지면 편성" 다음에 "플레이어"다. 설치 안내는 `/ads/` 설치, 영상 ID `게시판:글번호:영상키`(기본 키 `main`), 방문자의 글 읽기 권한 세 가지만 안내한다. 붙여 넣을 파일 위치는 안내하지 않고 자동 삽입은 "준비 중"이다 | 근거 없는 파일 위치 안내, 자동 삽입을 동작하는 것처럼 표시 | 단위, 브라우저(실환경) | NOT_RUN |

### 3.3 근거표의 확인하지 못한 항목 연결

| 근거표 항목 | 연결 시나리오 | 이 계획에서 확인할 수 없는 부분과 NOT_RUN 사유 |
|---|---|---|
| HF U1 표시·재생 순서 | HL15 (1): 스킵 문구 전환과 pre→mid→post 순서 | 미드롤 seek와 이미지 타이머 정지는 플레이어 UX 범위다(`ads-ux-20261018` V02–V05). 이 계획에서 실행하지 않는다 |
| HF U2 새 탭이 가릴 때 영상·이미지 차이 | HL15 (2) | 브라우저 창 포커스와 `visibilitychange` 동작은 도구와 창 구성에 따라 다르다. 관측값만 기록하고 일반 규칙으로 판정하지 않는다 |
| HF U3 `retentionDays` 삭제 동작 | 없음 | NOT_RUN. 브라우저로 관측할 수 없고, README상 v1에는 자동 삭제가 없다. 소스 리뷰 대상이다 |
| HF U4 업로드 디렉터리 실행 금지 | 없음 | NOT_RUN. 운영 웹 서버 설정에 달렸다. 개발 router는 `/media/<32hex>.<확장자>`만 내보내므로 운영 증거가 되지 않는다 |
| HF U5 자동 재생 차단 뒤 시작 기록 시점 | 없음(관측될 때만) | NOT_RUN. 자동 재생 차단을 재현하려면 브라우저 정책 플래그가 필요하다. 실행 중 실제로 관측되면 B10에 기록한다(UX V13과 같은 원칙) |
| HF U6 한국어 문구 없는 오류 코드 표시 | 없음 | NOT_RUN. `invalid_ad_duration`, `unobserved_playback`을 재현하려면 손상된 미디어 fixture가 필요한데, 이 계획에는 만들지 않는다. 단위 테스트 근거로 대신하는 것을 제안한다 |
| HF U7 `helpTerms`와 termId 일치 | HL14 | 없음 |
| HF U8 재생 테스트 반복 시 통계 영향 | HL15 (3), B11 | 없음 |
| PF U-P1 정적 붙여 넣기 재생 | PL16 | D8(파일 위치)이 정해져야 실행할 수 있다 |
| PF U-P2 기본 video + `<media-ads>` | PL15에서 생성 코드 형태 확인 | 생성기가 기본 video에 `createAdsController`를 쓰면 제품 경로가 아니므로 NOT_RUN으로 남긴다. `<media-ads>`를 쓰면 PL16에서 함께 재생한다 |
| PF U-P3 그누보드 게시판 스킨·본문 HTML 삽입 | 없음 | NOT_RUN. 그누보드 원본 확인과 실환경 설치가 필요하다(D1, 이번 계획 범위 밖) |
| PF U-P4 CSS 속성의 그림자 트리 상속 | PL12, PL17 | 없음 |
| PF U-P5 미리보기의 `fontFamily` 차이 | PL12 | 차이가 보이지 않으면 결함이 아니라 관측값으로 기록한다 |
| PF U-P6 compat·scaffold CSS 차이 | 없음 | NOT_RUN. A1에서 두 스킨은 "준비 중"이라 화면 경로가 없다. 정적 CSS 대조는 소스 리뷰 대상이다 |
| PF U-P7 rsync 청크 누락 | PL17 일부(현재 `assets/videojs`의 청크 요청이 모두 200) | 빈 디렉터리에 rsync한 뒤 실행하는 재현은 NOT_RUN. 문서 루트를 바꿔야 해서 5절 절차와 맞지 않는다 |

## 4. 그누보드 [G-실환경]

실행 환경이 정해질 때까지 실행하지 않는다(미결정 D1). 그누보드 쪽 단위 검사는 U05와 U06이다.

| ID | 계약 | 사전 조건 | 단계 | 기대 결과 | 증거 | 상태 |
|---|---|---|---|---|---|---|
| G01 | 3절 메뉴 | 그누보드 관리자 로그인, 광고 메뉴 권한 | 그누보드 관리자 메뉴에서 광고 관리 팝업 열기 | 상단에 [사이트 이름] 광고 관리, 메뉴 순서 3절과 같음. 사이트 보기·관리자 링크 동작. 창 닫기가 보이고 누르면 팝업이 닫힘 | 브라우저 | NOT_RUN |
| G02 | F1 loginUrl | 그누보드 로그아웃 상태 | 관리자 앱 주소 직접 열기 | 로그인 폼 대신 `capabilities.loginUrl`(G5 `bbs/login.php`) 링크. 직접 연 탭에서는 창 닫기 숨김 | 브라우저, HTTP | NOT_RUN |
| G03 | F1 displayName | G01 | bootstrap 응답과 화면 확인 | 회원 닉네임 표시. 닉네임이 없는 계정은 아이디 | HTTP, 브라우저 | NOT_RUN |
| G04 | F2 CSRF 소모성 | G01 | 하우스 광고에서 URL 소재를 연속 2회 등록 → 잘못된 입력 저장(실패) → 바로 올바른 입력 저장 | 네 요청 모두 직전 응답의 `X-CSRF-Token`을 사용. 연속 쓰기와 실패 뒤 유효 쓰기 모두 성공 | 브라우저(네트워크 헤더) | NOT_RUN |
| G05 | F3 그누보드 대상 | G04 | 지면 편성 대상 검색으로 게시판·분류·게시물 선택 | `manualTargets:false`라 수동 ID 입력 없음. 영상 소속 등록(`video-context-save`) 화면 없음 | 브라우저 | NOT_RUN |
| G06 | F5 영상 ID | G05, 실제 공개 게시물 | 재생 테스트 링크의 `video` 값 확인 후 열기 | `게시판:글번호:main` 형식. 공개 `schedule` 200 | 브라우저 | NOT_RUN |
| G07 | 3절 목업 | G01 | 광고 요청(목록·상세), 설정을 메뉴 클릭으로 열기 | 목업 표시, 메뉴 클릭 뒤 API 요청 0, 쓰기 버튼 비활성과 이유 | 브라우저(네트워크) | NOT_RUN |
| G08 | 6절 폭 | G01 | 1280px과 768px에서 G01, G05, G07 화면 | B13, B14와 같은 기준 | 브라우저 | NOT_RUN |

## 5. 격리 실행 환경 (독립 설치)

이번 TASK에서는 실행하지 않았다. 실행 TASK에서 아래 순서를 따른다. 명령은 저장소 루트 기준이다.

1. **기존 서버 확인만 한다.** `lsof -nP -iTCP:18765 -sTCP:LISTEN`, `lsof -nP -iTCP:18766 -sTCP:LISTEN` 결과를 실행 전후로 저장해 두 서버가 그대로인지 비교한다. 두 서버를 멈추거나 재시작하지 않는다.
2. **새 private 디렉터리.** `mktemp -d /private/tmp/ads-a1-qa-XXXXXXXX`로 만들고 `chmod 700`을 적용한다. 저장소 안과 `/private/tmp/ads-qa-txrhuzog/`는 쓰지 않는다. 아래에서 `$QA_DIR`은 이 경로이며, Bash 호출마다 셸이 새로 뜨므로 실제 경로를 그대로 쓴다.
3. **비밀번호 없이 기록이 남는 설치.** 아래를 **한 번의 셸 실행**으로 처리한다. 비밀번호는 셸 변수에만 있고 설치 프로그램 stdin과 클립보드로만 전달한다. `echo`, `set -x`, 파일 저장을 쓰지 않는다. 설치 프로그램은 비밀번호를 출력하지 않는다.

   ```sh
   ( umask 077
     pw=$(openssl rand -base64 24 | tr -d '\n')
     printf '%s\n' "$pw" | php integrations/ads-manager/bin/install.php \
       --config="$QA_DIR/config.php" --sqlite="$QA_DIR/ads.sqlite" \
       --uploads="$QA_DIR/uploads" --admin=a1-qa-admin --password-stdin \
       --player-module-url=/assets/ads.js \
     && printf '%s' "$pw" | pbcopy
     unset pw )
   ```

   브라우저 로그인 때 비밀번호 칸에 붙여넣기(Cmd+V)를 하고, 곧바로 `pbcopy < /dev/null`로 클립보드를 비운다. 도구 호출 인자에 비밀번호를 쓰지 않는다. 비밀번호를 잃으면 새 디렉터리에 다시 설치한다. 클립보드 기록 앱이 켜져 있으면 이 방법이 맞지 않는다(미결정 D4).
4. **새 포트.** 후보는 18781이다. 실행 직전 `lsof -nP -iTCP:18781 -sTCP:LISTEN`이 비어 있는지 확인하고, 사용 중이면 18782부터 차례로 고른다. 18765와 18766은 쓰지 않는다.
5. **서버 시작.** 백그라운드로 띄우고 로그는 private 디렉터리에 둔다. 내장 서버 로그에는 요청 줄만 남고 POST 본문은 남지 않는다.

   ```sh
   ADS_CONFIG="$QA_DIR/config.php" php -d display_errors=0 \
     -d upload_max_filesize=100M -d post_max_size=101M \
     -S 127.0.0.1:18781 -t integrations/ads-manager/public \
     integrations/ads-manager/public/router.php > "$QA_DIR/server.log" 2>&1
   ```

6. **종료.** 이 실행에서 띄운 프로세스 PID만 멈춘다. 1번 비교 결과를 증거에 남긴다. `$QA_DIR`은 오케스트레이터 인수 전까지 남겨 두고, 지울지는 오케스트레이터가 정한다. 이 디렉터리에는 비밀번호 해시와 업로드 사본이 있다.

주의:

- 격리 서버는 DB와 업로드만 분리된다. 문서 루트는 저장소의 `integrations/ads-manager/public/`이고, 18766도 같은 작업 트리를 쓴다. `public/index.php`가 기본으로 `admin/app.php`를 쓰게 바뀌면 18766의 `/`도 새 셸을 보여 준다. QA가 바꾸는 것은 아니다. 오케스트레이터가 알고 있어야 한다.
- 증거 파일에서 가리는 값: 로그인 요청 본문, `Cookie`·`Set-Cookie`, `X-CSRF-Token` 값, `csrfToken` 필드, 공개 `schedule`의 서명 토큰. 키 이름은 남기고 값만 `<redacted>`로 바꾼다.
- 고객 DB와 `/private/tmp/ads-qa-txrhuzog/`의 MySQL은 이 시나리오에 쓰지 않는다.

## 6. 쓸 데모 미디어

모두 저장소 `integrations/ads-manager/public/demo-media/` 아래의 기존 파일이다(Git 제외 생성물). 실행 전에 파일이 있는지, SHA-256이 10월 18일 기록과 같은지 확인한다. 새로 생성하지 않는다. 없으면 grok 담당이 아니라 오케스트레이터에게 먼저 알린다.

| 용도 | 사이트 경로 | 크기(바이트) | 쓰는 곳 |
|---|---|---|---|
| 본편(10초) | `/demo-media/grok-20261018/content-scene-01.mp4` | 12,243,780 | F4 미리보기, F5 `content` |
| 프리롤 1·URL 등록, 스킵 불가 | `/demo-media/grok-20261018/ad-coffee-6s.mp4` | 3,900,834 | B02 |
| 프리롤 2·파일 업로드, 3초 후 스킵 | `/demo-media/grok-20261018/ad-earbuds-12s.mp4` | 9,365,072 | B03 |
| 미드롤 5초·파일 업로드, 3초 후 스킵 | `/demo-media/grok-20261018/ad-water-8s.mp4` | 10,602,955 | B03 |
| 포스트롤 이미지(Grok 아님) | `/demo-media/ad.png` | 실행 시 기록 | B02, B06 이미지 표시 시간 |

업로드할 때는 파일을 같은 경로에서 바로 고른다. 사본을 만들어야 하면 `$QA_DIR` 안에 만든다. 원본 출처는 `workspaces/ads-media/`의 manifest다.

## 7. 증거 위치와 기록 규칙

- 증거: `workspaces/ads-admin-app-20261020/qa/evidence/<시나리오 ID>-*` (실행 TASK에서 만든다)
- 결과: 같은 폴더의 `results.md`. 이 파일의 NOT_RUN 원본은 바꾸지 않는다. 실행한 것, 이전 결과, 실행하지 않은 것을 나눠 적는다.
- 매 시나리오 공통 기록: URL과 해시, 실제로 불러온 `admin-app.js`·`ads.js` SHA-256, viewport, 기대와 실제 결과, 화면, 네트워크, 포커스.
- 실패는 준비, 입력, 제품, 브라우저 문제 가운데 무엇인지 나누고 처음 증거를 보존한다.
- "API 요청 0"은 이 문서에서 `/api/index.php`로 가는 요청 수를 뜻한다. 미디어와 정적 파일 GET은 따로 센다.

## 8. 범위 밖과 실행하지 않는 것

- v2 도메인(광고주·캠페인·집행·승인·impression)과 마이그레이션 002의 동작. 목업 표시만 확인한다.
- MySQL 엔진 동작, HLS 본편, Safari·iOS·Android 실기기, 실제 음향.
- 광고 플레이어 자체의 UX(스킵 타이밍, 포커스 복원 등)는 `ads-ux-20261018` 시나리오의 범위다. 여기서는 관리자 화면 안에서 재생되고 수집 여부가 맞는지만 본다.
- 고객 배포, 18765·18766 재시작, Git commit과 push.

## 9. 실행 전에 정해야 할 것

| ID | 내용 | QA 제안 |
|---|---|---|
| D1 | G01–G08 실환경. 18765 그누보드 마운트를 쓰면 기존 QA MySQL의 `g5ads_` 테이블에 쓰기가 생긴다. 계약 5절은 "쓰기 검증은 새 격리 SQLite 설치"라고 정했다. 18765가 같은 작업 트리를 쓰는지도 확인되지 않았다 | 이번 A1 인수는 [S]와 [G-U]로 하고, G 항목은 별도 TASK로 미룬다. 18765를 쓸 경우 오케스트레이터가 읽기 전용(G01, G02, G03, G07, G08)과 쓰기(G04–G06)를 나눠 허가한다 |
| D2 | 목업 "API 요청 0"의 기준. 해시 주소로 목업을 바로 새로고침하면 앱 셸이 `bootstrap`을 부른다 | 메뉴 클릭으로 목업에 들어간 뒤의 요청을 센다. 바로 새로고침한 경우는 `bootstrap` 1회만 허용한다 |
| D3 | F5 `content` 값. 예제는 `content`를 `examples/` 페이지 기준으로 해석한다. `demo-media/...` 상대값을 그대로 넘기면 `/examples/demo-media/...`가 되어 404다 | A1-PLAYER가 절대 URL 또는 `/demo-media/...` 경로를 넘기게 한다. U09와 B10에서 확인한다 |
| D4 | 로그인 비밀번호 전달 방법(5절 3번의 클립보드 방식) | 클립보드 방식을 쓴다. 클립보드 기록 앱이 켜져 있으면 사용자가 직접 입력한다 |
| D5 | 브라우저 도구와 실행 주체. Takeoff 7절은 브라우저 조작 주체를 한 명으로 정하라고 했다 | 오케스트레이터가 ego-browser 또는 Playwright 가운데 하나와 실행 주체를 정한다 |
| D6 | 포스트롤 이미지 소재. Grok 납품물에는 이미지가 없다 | 기존 `/demo-media/ad.png`를 쓴다. 새 생성 요청은 하지 않는다 |
| D7 | B08 영상 ID와 게시판·분류 값(`a1-qa-video-1`, `notice`, `1`) | 격리 설치 전용 값이라 그대로 쓴다 |

아래 D8–D14는 A1-QA-PLAN-3에서 더한 **제안**이다. 결정은 실행 TASK에서 받는다.

| ID | 내용 | QA 제안 |
|---|---|---|
| D8 | PL16(PF U-P1) 붙여 넣기 페이지 위치. 같은 출처여야 하는데, 저장소 `public/`에는 파일을 만들 수 없다. 개발 router는 `public/` 정적 파일과 `/media/<32hex>.<확장자>`만 내보낸다. 별도 문서 루트 사본을 만들면 5절 절차가 바뀐다 | 두 파일을 QA 소유 경로에 둔다. 붙여 넣기 HTML은 `workspaces/ads-admin-app-20261020/qa/fixtures/paste/<case>.html`, 감싸는 router는 `workspaces/ads-admin-app-20261020/qa/fixtures/qa-router.php`다. qa-router는 `/__qa/paste/<case>.html` 경로만 그 폴더에서 내보낸다. 이름은 `^[a-z0-9-]+\.html$`만 허용하고 `realpath`로 폴더 밖을 막는다. 나머지 요청은 `return require '<저장소>/integrations/ads-manager/public/router.php';`로 넘긴다. 서버 명령에서 5절 5번의 마지막 인자(router 경로)만 이 파일로 바꾸고, `-t`와 `ADS_CONFIG`는 그대로 둔다. 18765와 18766에는 영향이 없다. 두 파일은 실행 TASK에서 만든다 |
| D9 | HL05 (3): 저장하지 않은 편성이 있을 때 `HelpLink`가 같은 탭에서 도움말로 이동하면 입력이 사라질 수 있다. 계약에 기준이 없다 | 실행 때는 관측만 하고 판정하지 않는다. 입력이 경고 없이 사라지면 결함 후보로 보고하고, 새 탭 열기, 이동 전 경고, 입력 유지 가운데 하나를 오케스트레이터가 정한다 |
| D10 | HL09의 reduced-motion 재현과 PL12의 그림자 트리 계산된 스타일 측정은 도구 기능이 필요하다(D5와 연결) | 두 시나리오는 Playwright(`emulateMedia`, `evaluate`)로 실행한다. D5에서 ego-browser를 고르면 이 두 시나리오만 Playwright로 실행할지, NOT_RUN으로 둘지 정한다 |
| D11 | PL07 저장 프리셋 최대 20개. 브라우저로 20개를 만들면 저장 20회와 정리가 필요하다 | 백엔드 테스트의 `400 preset_limit` 단언과 UI 단위 테스트로 대신한다. 단언이 없으면 브라우저 방식으로 바꾼다 |
| D12 | PL15·PL16의 HLS 코드. 8절은 HLS 본편을 범위 밖으로 두었는데, 생성기는 HLS-SPF와 HLS-hls.js를 낸다 | 코드 원문(PL15)은 네 가지 모두 확인한다. 붙여 넣기 재생(PL16)은 MP4 두 가지만 하고 HLS 두 가지는 NOT_RUN으로 둔다. 확장한다면 기존 `/demo-media/content-master.m3u8`(Grok 아님)을 쓴다 |
| D13 | PL01 "meta 키가 생기지 않음"을 보이려면 격리 SQLite를 읽어야 한다. 처음 지시는 DB 접근 금지였다 | 실행 TASK에서 `$QA_DIR/ads.sqlite`(격리 설치, 고객 DB 아님)를 `sqlite3 -readonly`로 읽는 SELECT 한 번을 허가받는다. 허가가 없으면 네트워크에 POST가 없다는 것과 `player-presets` revision 응답으로만 판정하고, meta 키 확인은 NOT_RUN으로 적는다 |
| D14 | PL16–PL19와 HL15는 실제 수집 경로로 재생해서 통계가 바뀐다 | B11을 마친 뒤 실행한다. 영상 ID는 따로 쓴다: 프리셋 재생은 `a1-qa-preset-1`, 도움말 실측은 `a1-qa-help-1`. B11에서 확인한 숫자가 뒤 시나리오 때문에 바뀌지 않게 한다 |

## 10. 실행 전 준비

1. A1-UI, A1-DS, A1-PLAYER, A1-API 구현 완료와 U01 빌드 산출물
2. `public/assets/ads.js`가 있고 현재 패키지 빌드와 해시가 같음(10월 20일 기록 `b6a7e8e4…`. 그 뒤 바뀌었으면 새 값 기록)
3. 6절 데모 미디어 다섯 파일 존재와 해시
4. D1–D7 결정, D8–D14 결정
5. 실행 TASK에서 허가할 행위: 격리 설치 1회, 새 포트 서버 시작과 종료, 브라우저 실행, `evidence/` 쓰기
6. 플레이어 관리와 도움말: `help` route와 화면 `HelpLink` 연결, `#/players/**` 화면, 공개 `player-preset`, `examples/player-preview.html`과 `preset.js`가 빌드 산출물과 함께 준비됨. `public/assets/videojs/`에 neutral 스킨 파일(`video-neutral.css`, `video-neutral.js`)이 있음
7. D8을 받아들이면 `qa/fixtures/qa-router.php`와 `qa/fixtures/paste/`를 실행 TASK에서 만들 허가
