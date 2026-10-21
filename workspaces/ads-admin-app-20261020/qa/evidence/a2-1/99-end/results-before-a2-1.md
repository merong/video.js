# A1-QA-RUN 결과

실행: 2026-10-20 19:47–23:10 KST, ads-qa 단독(Playwright). 시나리오 원문은 `scenarios.md`, 증거는 `evidence/<ID>/`, 실행 스크립트는 `evidence/scripts/`에 있다. 이 문서와 증거 어디에도 설치 비밀번호, 쿠키 값, CSRF 토큰 값, 로그인 본문, 서명 토큰을 남기지 않았다(종료 때 유출 검사 0건).

## 환경

| 항목 | 값 |
| --- | --- |
| QA_DIR | `/private/tmp/ads-a1-qa-uy3hLqti` (유지, `admin-password`만 삭제) |
| 서버 | `php -S 127.0.0.1:18781`, docroot `integrations/ads-manager/public`, 라우터 `qa/fixtures/qa-router.php`, `ADS_CONFIG=$QA_DIR/config.php`, SQLite `$QA_DIR/ads.sqlite` |
| 런타임 | PHP 8.5.8, Node v24.2.0, Playwright 1.59.1, channel chrome (Chrome 155 headless) |
| 범위 | D1: [S]·[G-U]·[공통]만. G01–G08은 실행하지 않음 |
| 기준 해시 | admin-app.js `f12dbce6…d82d`, admin-app.css `7819b105…a36ca`, ads.js `b6a7e8e4…288c`, PHP·examples 트리 `bb3d0b4d…1d64` (32파일) |
| 종료 해시 | 4개 모두 기준과 같음 (`evidence/99-end/hashes-after.txt`, 23:06:20 KST) |
| 테스트 영상 ID | B 구간 `a1-qa-video-1`, D14에 따라 `a1-qa-preset-1`(PL16–PL19), `a1-qa-help-1`(HL15) |

## 18765·18766 비교

`evidence/00-env/lsof-before.txt`와 `evidence/99-end/lsof-after.txt`에서 LISTEN 줄을 비교했고 두 파일이 같다. 18765에는 php PID 9878, 18766에는 php PID 34509가 떠 있었다. 두 서버는 정지, 재시작, 요청, 쓰기 어느 것도 하지 않았다.

## 시나리오별 결과

### [공통] U·H

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| U01 | PASS (SHA 기록으로 대체) | 실행 중 지시로 빌드 대신 SHA 기록. `process.env.NODE_ENV` 0회, `mountAdsAdmin` export 있음 | `evidence/U01/baseline-sha.txt` |
| U02–U09 | NOT_RUN | 실행 중 지시: 검토 반영으로 소스를 수정하는 중이라 수정 회차 뒤에 재실행 | — |
| U10 | PASS | run.php 70 + 7 + 95(프리셋) 단언 PASS, FAIL 0, PHP lint 깨끗함 | `evidence/U10/backend-run.log`, `php-lint.log` |
| H01–H06 | PASS | http_test 110 + 25 + 16(프리셋) PASS, FAIL 0. 셸, 번들, 진입, bootstrap, 자산 확인 | `evidence/H/` |

### [S] B

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| B01 | FAIL | 비밀번호가 틀려 401이 오면 "로그인이 만료됐어요…"가 뜬다. 자격 증명 오류 문구가 아니다. 로그아웃과 새로고침은 정상 | `evidence/B01/`, `B01-B05/` |
| B02 | PASS | URL 소재 등록 | `evidence/B02/` |
| B03 | PASS | 파일 업로드 | `evidence/B03/` |
| B04 | PASS | 수정과 보관 | `evidence/B04/` |
| B05 | PASS | 입력 보존 | `evidence/B05/` |
| B06 | FAIL | 미드롤 "본편 재생 위치 (초)" 입력이 초점을 놓지 않는다. 광고 추가, select, 대기 칸을 클릭한 뒤 입력해도 위치 값이 5→53으로 바뀐다 | `evidence/B06/probe-mid.json`, `probe-mid2.json`, png |
| B07 | PASS | 편성 409 처리 | `evidence/B07/`, `B06-B08/` |
| B08 | PASS | 게시, 상속, 영상 소속 | `evidence/B08/` |
| B09 | PASS | 미리보기 재생 순서, 수집 0 | `evidence/B09/` |
| B10 | PASS | 재생 테스트(native, Video.js) | `evidence/B10/` |
| B11 | PASS | 통계와 CSV | `evidence/B11/` |
| B12 | FAIL | 목업 화면 중 집행 만들기에 목업 배지가 없다 | `evidence/B12/result.json`, `new-line-item.png` |
| B13 | PASS | 1280×800에서 페이지 가로 스크롤과 잘린 조작 없음 | `evidence/B13/`, `B13-B14/result.json` |
| B14 | FAIL | 768×1024 캠페인 화면의 "열기" 버튼이 잘린다(right 772 > 768) | `evidence/B14/campaigns.png`, `B13-B14/result.json` |
| B15 | FAIL | 미드롤 위치 칸에서 키보드가 갇힌다(Tab, Shift+Tab 모두 같은 칸에 머묾). 우회 경로로 저장과 게시는 확인 | `evidence/B15/result.json`, `result-workaround.json` |
| B16 | PASS | 오프라인 저장 실패 뒤 자동 재시도 없음, 입력 유지, 수동 재시도 성공 | `evidence/B16/`, `B16-B18/result.json` |
| B17 | REMOVED | 2026-10-20 계약 변경(런타임 CDN 허용)으로 삭제됨 | — |
| B18 | PASS | `/?ui=v1` 회귀 없음, 같은 세션에서 새 앱 진입 정상 | `evidence/B18/` |

### [G-U] G

| ID | 결과 | 사유 |
| --- | --- | --- |
| G01–G08 | NOT_RUN | D1: 실환경이 정해지지 않았고 기존 QA MySQL 쓰기가 금지됨 |

### HL 도움말

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| HL01 | PASS | 버튼 위치 | `evidence/HL01/` |
| HL02 | NOT_RUN | 단위(G-U)는 U02–U09와 같은 사유, 실환경 절반은 D1 | — |
| HL03 | PASS | 직접 진입 | `evidence/HL03/`, `HL03-04/` |
| HL04 | PASS | 잘못된 termId | `evidence/HL04/` |
| HL05 | PASS | 모든 화면에서 링크 76개, 이름은 모두 "<용어> 도움말". 서로 다른 termId 44개 모두 제목이 있고 초점을 받는다. D9: 편성과 프리셋 편집이 뒤로 가기와 메뉴 이동 뒤에도 남았다(쓰기 없음). UI 모드 전환 뒤 `disabled` 링크는 직접 대상만 확인했다 | `evidence/HL05/` |
| HL06 | PASS | 메뉴로 들어간 뒤 필터 9개, 일시정지, 다시 보기, 링크 5개를 조작해도 API 호출 0. 새로고침 때는 bootstrap만 | `evidence/HL06/`, `HL06-09/result.json` |
| HL07 | PASS | aria-pressed, 2초 정지, 재개, 다시 보기(약 33ms부터). 1회 그림은 다시 보기만 있고 5000ms | `evidence/HL07/`, `HL06-09/result.json` |
| HL08 | PASS | 화면을 벗어나면 `is-offscreen`으로 멈추고 돌아오면 재개 | `evidence/HL06-09/result.json` |
| HL09 | PASS | reduce: 애니메이션 0, 조작 0, 최종 상태 표시, 본문 49. no-preference로 바꾸면 즉시 반영(48 동작) | `evidence/HL09/`, `HL06-09/result.json` |
| HL10 | PASS | 모든 용어에서 본문이 그림 앞, 대체 텍스트 있음. 상태 42 지금 동작 / 5 목업 / 2 준비 중이 HF와 일치 | `evidence/HL10/terms.json` |
| HL11 | PASS | 키보드만으로 전 흐름 가능, 초점 고리 있음, 숨은 초점 없음 | `evidence/HL11/`, `HL11-12/result.json` |
| HL12 | PASS | 두 폭 모두 넘침 없음, 흐름 한 줄, 그림 잘림 없음 | `evidence/HL12/`, `HL11-12/result.json` |
| HL13 | S 절반 PASS / G-U 절반 NOT_RUN | S에 house-ad, ad-request 없음, 목업 용어 표시. G-U 절반은 D1 | `evidence/HL10/terms.json` |
| HL14 | DOM 대조 PASS / help.test.tsx NOT_RUN | DOM 49 = 52 − house-ad − ad-request(그누보드 전용) − player-video-id. 단위 테스트는 U02–U09와 같은 사유 | `evidence/HL10/terms.json` |
| HL15 | 부분 PASS (일부 NOT_RUN) | (1) 건너뛰기 문구가 약 3초에 "N초 후 건너뛰기"에서 "광고 건너뛰기"로 바뀜. 순서 pre → mid(본편 5.2초) → post 이미지(10초)가 도움말과 일치. (2) 관찰만 함. headless에서는 팝업이 앞에 있어도 원래 탭의 광고가 계속 재생됐고 visibilityState도 visible로 남아 판정 불가. 이미지 포스트롤은 클릭 URL이 비어 있어 이미지 타이머 경우를 실행하지 않음. (3) 새로 열 때마다 광고별 시작 +1. 같은 세션 안의 중복 없음은 UI로 재현할 수 없어 NOT_RUN | `evidence/HL15/result.json` |

### PL 플레이어 프리셋

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| PL01 | PASS | 저장, meta 키 확인(D13 읽기 전용) | `evidence/PL01/` |
| PL02–PL06 | PASS | 생성, 수정, 복제, 기본 지정, 앱 Dialog 삭제 | `evidence/PL02/`–`PL06/`, `PL03-04/` |
| PL07 | HTTP 절반 PASS / UI 절반 NOT_RUN | run.php:406 preset_limit 단언. UI 절반은 U02–U09와 같은 사유 | `evidence/PL07/backend-assertion.txt` |
| PL08 | FAIL | 409 뒤 "프리셋 목록 다시 불러오기"를 눌러도 낡은 초안이 남는다. 두 번째 저장이 A의 `ads.accentColor` 변경을 알림 없이 덮어쓴다 | `evidence/PL08/result-overwrite.json`, `result-reload.json`, png |
| PL09 | FAIL | `#GGG`를 넣으면 필드 오류는 보이지만 저장 요청이 null 값으로 나가 200을 받는다. 이름 공란, 41자, 반경 33, 타이머 문구는 막힘 | `evidence/PL09/result.json`, `accent-GGG.png` |
| PL10 | PASS | 기본 video 전환 | `evidence/PL10/` |
| PL11 | PASS | 대비 경고(관찰: 노랑 대비가 "1:1"로 표시) | `evidence/PL11/` |
| PL12 | PASS | ThemePreview(관찰: 미리보기 글꼴이 다름) | `evidence/PL12/`, `PL12-13/` |
| PL13 | PASS | 미리보기 수집 0 | `evidence/PL13/` |
| PL14 | PASS | 미리보기 정지 | `evidence/PL14/` |
| PL15 | PASS | 설치 코드 생성 | `evidence/PL15/` |
| PL16 | PASS (MP4 ×2) / HLS 2건과 PF U-P2 NOT_RUN | 생성기 출력을 고치지 않은 붙여 넣기 페이지에서 pre, mid, post, 본편 끝까지 재생. Video.js 테마(#0f5132, 12px, 15px, 영어 문구)와 native 한국어 문구 확인. 콘솔 404는 /favicon.ico뿐. 생성기가 native에 createAdsController를 쓰므로 U-P2는 해당 경로가 없음 | `evidence/PL16/`, `fixtures/paste/pl16-*.html` |
| PL17 | PASS | `?preset`: Video.js에 neutral, #0f5132, en 적용. native는 한국어. 형식이 맞지 않으면 알림과 함께 기본값으로 재생 | `evidence/PL17/`, `PL17-18/result.json` |
| PL18 | PASS | 404 preset_not_found와 400 invalid_preset_id 모두 알림 뒤 기본 재생. `<script>` 문자열은 텍스트로만 보임 | `evidence/PL18/`, `PL17-18/result.json` |
| PL19 | PASS | 기본은 preset 쿼리 없음. P-A/P-B는 `preset=` 추가, 연 페이지에 P-A 적용, 전환 중 API 0 | `evidence/PL19/result.json` |
| PL20 | PASS | 공개 `player-preset`: name 없음, 형식별 필드 구분, no-store, CSRF 없음, 미지 id 404, styles는 상대 파일명 | `evidence/PL20/` |
| PL21 | 브라우저 절반 PASS / 옵션 표 대조 테스트 NOT_RUN | 하위 탐색으로 API 0, 표 6개와 열, 경고·주석 있음, 넓은 표는 내부 스크롤. 단위 절반은 U02–U09와 같은 사유 | `evidence/PL21/`, `PL21-23/result.json` |
| PL22 | PASS | 1280과 768에서 페이지 넘침 없음. 키보드만으로 편집, 저장, 삭제 Dialog(Esc로 원래 버튼 복귀, 삭제 안 됨), 복사 확인 | `evidence/PL22/` |
| PL23 | FAIL | "준비 중"은 compat·scaffold 스킨과 `<media-ads>` 시간 제한에만 있다. 계약 56행 항목 7개에 표시가 없다 | `evidence/PL23/keyword-scan.json`, `PL21-23/result.json` |
| PL24 | NOT_RUN | G-U 단위와 실환경 모두 D1 및 U02–U09와 같은 사유 | — |

## 결함

모두 제품 결함이다. 수정하지 않았다.

| 순위 | ID | 심각도 | 추정 담당 | 재현 | 기대 | 실제 | 증거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | B06 / B15 | high | ads-ui | 편성 편집 → 미드롤 "본편 재생 위치 (초)" 칸에 초점 → 광고 추가나 대기 칸을 클릭하거나 Tab을 누름 | 초점이 다음 조작으로 이동 | 초점이 위치 칸에 남는다. 다음 입력이 위치 값을 바꾸고(5→53) 키보드가 갇힌다(Tab, Shift+Tab) | `evidence/B06/probe-mid*.json`, `evidence/B15/result.json` |
| 2 | PL08 | high | ads-ui | 두 탭에서 같은 프리셋 편집 → A 저장 → B 저장 409 → "프리셋 목록 다시 불러오기" → B 다시 저장 | 서버 최신값으로 폼을 다시 채우거나 충돌을 다시 알림 | 낡은 초안이 그대로 남고 두 번째 저장이 A의 `ads.accentColor`(#ff8800)를 null로 되돌린다(200) | `evidence/PL08/result-overwrite.json` |
| 3 | PL09 | medium–high | ads-ui | 프리셋 편집 → 강조색 `#GGG` → 저장 | 저장을 막고 필드 오류를 보임(422 또는 클라이언트 차단) | 필드 오류는 보이지만 null로 저장 요청이 나가 200, "저장했어요" 안내가 뜬다 | `evidence/PL09/result.json`, `accent-GGG.png` |
| 4 | B01 | medium | ads-ui | 로그인에 틀린 비밀번호 | 자격 증명 오류 문구 | "로그인이 만료됐어요…" | `evidence/B01/login-fail.png` |
| 5 | B12 | low | ads-ui | 캠페인 → 집행 만들기 | 목업 배지 | 배지 없음 | `evidence/B12/new-line-item.png` |
| 6 | B14 | low | ads-ui | 768×1024 → 캠페인 | 조작이 화면 안에 있음 | "열기" 버튼이 잘림(right 772) | `evidence/B14/campaigns.png` |
| 7 | PL23 | low | ads-ui | 플레이어 화면에서 "준비 중" 검색 | 계약 56행 항목마다 "준비 중" 표시 | 프리셋 ID 즉시 반영 설치 코드, 게시판·분류·영상별 지정, 변경 이력·되돌리기, 사용자 CSS, 로고·워터마크, 오디오·라이브, 스킨 소스 내려받기에 표시가 없음 | `evidence/PL23/keyword-scan.json` |

## 관찰 (판정에 반영하지 않음)

- HL14: `#/help/player-video-id` 별칭이 fixed-video-id로 가지 않고 도움말 첫 화면으로 간다.
- HL07: 다시 보기 뒤 문서 애니메이션 수가 2 늘어난다.
- HL15: "처음부터 다시 확인"을 누르면 편성을 다시 받아 오고 시작이 +1로 집계된다(합계 1→2→3).
- PL19: 플레이어 종류와 상관없이 두 재생 테스트 링크 모두에 preset이 붙는다(low).
- PL20: 쿠키 없이 공개 endpoint를 불러도 세션 Set-Cookie를 보낸다.
- PL09: `#ABCDEF`는 소문자로 저장된다. 첫 시도 때 `page.reload`가 미저장 변경 beforeunload 대화상자에 막혔다. 이는 브라우저 표준 이탈 확인이고 스크립트 쪽 문제로 분류해 재시도했다.
- PL11: 노랑 대비가 "1:1"로 표시된다. PL12: 미리보기 글꼴이 실제와 다르다.
- PL22: native 대화상자에서 Tab이 BODY(브라우저 크롬)를 거쳐 한 바퀴 돈다. 미리보기 iframe 안 조작의 초점 고리는 측정하지 않았다.
- 실패 분류: 스크립트 재시도(B09·B14·PL09·PL16 attempt 파일)는 모두 입력·브라우저 분류이고 제품 판정에 쓰지 않았다.

## D13 meta 최종 (읽기 전용)

`ads_meta` 키: player_presets, schema_version, signing_key, site_id, write_lock. player_presets revision 24, defaultPresetId `p-wkepup6b7d`. 프리셋은 P-A `p-wkepup6b7d`(videojs neutral)와 P-B `p-nln4iamtsc`(native)다. 비밀번호 해시 행은 남기지 않았다. 증거: `evidence/99-end/meta-final.txt`.

## 실행하지 않은 것과 이유

| 항목 | 이유 |
| --- | --- |
| G01–G08, HL13 G-U, PL24 | D1: 실환경이 정해지지 않았고 기존 QA MySQL 쓰기 금지 |
| U02–U09, PL07 UI, HL02, HL14 help.test.tsx, PL21 옵션 표 대조 테스트, PL24 G-U | 실행 중 지시: 소스 수정 회차 뒤 재실행 |
| U01 빌드 | SHA 기록으로 대체(빌드 실행 금지) |
| PL16 HLS 2건, PF U-P2 | MP4 2건만 실행. 생성기가 native에 createAdsController를 써서 U-P2 경로가 없음 |
| HL15 (2) 숨김 탭 멈춤, 이미지 타이머 / (3) 같은 세션 중복 없음 | headless에서 visibility가 바뀌지 않고, 이미지 클릭 URL이 비어 있으며, UI로 재현할 수 없음 |
| B17 | 계약 변경으로 삭제됨 |

---

# A1-QA-DELTA (2026-10-21)

실행: 2026-10-21 00:49–01:58 KST, ads-qa 단독. 수정 회차 뒤 차등 재실행이다. 위 A1-QA-RUN 행은 지우지 않았다. 증거는 `evidence/delta/<ID>/`, 스크립트는 `evidence/delta/scripts/`에 있다. 설치 비밀번호, 쿠키, Set-Cookie, X-CSRF-Token, csrfToken, 로그인 본문, 서명 토큰, signing_key 값은 증거와 이 문서에 남기지 않았다. 종료 때 유출 검사 0건이다(비밀번호 파일 값으로 grep, 쿠키·CSRF·토큰 패턴, signing_key 값).

## 환경 (delta)

| 항목 | 값 |
| --- | --- |
| QA_DIR | `/private/tmp/ads-a1-qa-MeLReeRU` (유지, `admin-password` 삭제함) |
| 서버 | `php -S 127.0.0.1:18781` PID 87190, 라우터 `qa/fixtures/qa-router.php`(`/__qa/paste/*.html` → `qa/fixtures/paste`). 종료 때 이 PID만 정지 |
| 런타임 | PHP 8.5.8, Node v24.2.0, Playwright 1.59.1, channel chrome (Chrome 155.0.8059.85 headless) |
| 재생 플래그 | 01:03 이후 재생 실행은 모두 `--disable-features=HardwareMediaKeyHandling,GlobalMediaControls`. 이 플래그가 없으면 OS 미디어 세션 명령이 광고를 약 3초에 멈춘다(`evidence/delta/B10/probe-stall-*.json`, `attempt-1-os-media-pause/`). 환경 요인이고 제품 판정에 쓰지 않았다 |
| 기준 해시 | admin-app.js `1a12b26e…ed82`, admin-app.css `633e6f2a…b3da5`, ads.js `b6a7e8e4…288c`, 서빙 트리 `4a289876…1c7c` (32파일) |
| 종료 해시 | 4개 모두 기준과 같음 (`evidence/delta/00-env/hashes-after.txt`, 01:56:35 KST) |
| 프리셋 | P-A `p-vym1rjw052` "QA Video.js 중립 v2"(기본), P-B `p-obxpj5v9m9` "QA 기본 video"(native, PL10에서 생성) |
| 콘솔 | 모든 페이지의 404는 `/favicon.ico`뿐(curl 확인). API·자산 비2xx 없음 |

## 18765·18766 비교 (delta)

`evidence/delta/00-env/lsof-before.txt`(00:49:46)와 `lsof-after.txt`(01:56:36)의 LISTEN 줄이 같다(LSOF_MATCH). 18765에는 php PID 9878, 18766에는 php PID 34509가 떠 있었다. 두 서버는 정지, 재시작, 요청, 쓰기 어느 것도 하지 않았다. 18781은 정지 뒤 비어 있다.

## 이전 FAIL 재실행

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| B01 | PASS | 틀린 비밀번호 401 `invalid_login`에서 "아이디나 비밀번호가 맞지 않아요. 다시 입력해 주세요."가 뜨고 "만료" 문구 0. 세션 만료 401 `login_required`에서는 "로그인이 만료됐어요…"가 뜬다. 새로고침 해시 유지, 로그아웃 정상 | `evidence/delta/B01/result.json`, `wrong-login.png`, `expired.png` |
| B06 | PASS | 위치 칸에서 select와 대기 칸 클릭 시 초점이 이동하고 위치 값 5가 유지된다. Tab과 Shift+Tab이 칸을 벗어난다. 재정렬 뒤에도 초점은 클릭한 칸에 남는다. 빈 값, 0, -3, abc는 요청 0건으로 막힌다(브라우저 기본 검증 문구, 아래 관찰) | `evidence/delta/B06/result.json`, png |
| B15 | PASS | 위치 칸에서 Tab과 Shift+Tab이 다음과 이전 조작으로 나가고 초점 고리가 보인다. 키보드로 저장 200과 게시 200 | `evidence/delta/B15/result.json` |
| B12 | PASS | 목업 7화면 모두 배지 1개(집행 만들기 포함). 비활성 버튼에 이유가 있고 API 0 | `evidence/delta/B12/result.json`, png |
| B14 | PASS | 768×1024에서 7화면 모두 가로 넘침 0, 잘림 0 | `evidence/delta/B13-B14/result.json`, `B14/` |
| PL08 | PASS | (1) 다른 필드: 409 → 다시 불러오기 → A의 광고 음량 막대 색 #ff8800 반영, B의 글자 크기 16 유지, 안내 문구가 바뀐 항목을 말한다. 두 번째 저장 뒤 서버에 둘 다 남는다. (2) 같은 필드: 강조색 충돌 선택 UI("다른 곳에서 저장한 값 쓰기"/"내 입력 유지"), 고르기 전 저장 비활성과 이유. "내 입력 유지" 뒤 덮어쓰기 경고 후 저장. P-A 원복 200 | `evidence/delta/PL08/result-case1-and-attempt.json`(case 1), `result-case2.json`, png |
| PL09 | PASS | `#GGG`일 때 저장 클릭, 칸 안 Enter, 다른 칸 Enter 모두 요청 0. alert "저장하지 못했어요. 표시한 항목을 확인해 주세요."와 강조색 칸 초점. 글자 칸 aria-invalid와 형식 오류 연결. 색 고르기 이름은 "강조색 색 고르기"이고 도움말 문구가 섞이지 않는다. 대비 경고는 글자 칸과 고르기 두 곳에 연결. `#ABCDEF`는 소문자로 정규화 | `evidence/delta/PL09/result.json`, `result-warning.json`, png |
| PL23 | PASS | 계약 56행 7항목이 모두 "준비 중"과 이유와 함께 보인다(설정 1, 목록 2, 새로 만들기와 수정 4) | `evidence/delta/PL23/result.json`, png |

## 이전 NOT_RUN 단위 항목

명령: `pnpm -F @videojs/ads-manager-ui test`(17파일, 486 통과, 0 실패, 0 건너뜀, exit 0), typecheck(tsgo) exit 0, `pnpm exec vp check integrations/ads-manager/ui`(형식 통과, lint 오류 0, anti-slop 경고 12, exit 0). 빌드는 하지 않았다. 대응표는 `evidence/delta/U02/unit-mapping.md`에 있다.

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| U01 | PASS (SHA 기록으로 대체) | 빌드 금지. 기준 해시 4개 시작과 종료 일치 | `evidence/delta/00-env/hashes-*.txt` |
| U02 | PASS | test, typecheck, vp check 모두 exit 0 | `evidence/delta/U02/test.log`, `typecheck.log`, `vp-check.log` |
| U03 | PASS | envelope와 ApiError 필드, 오류 응답의 토큰 채택, multipart 토큰, 409 재시도 없음, 네트워크 실패와 시간 초과 뒤 재시도 없음 | `unit-mapping.md`(api.test.ts) |
| U04 | FAIL (테스트 공백) | 화면 테스트는 편성 저장 409 하나뿐(app.test.tsx). F2·F3 저장의 422와 네트워크 실패, 소재 저장과 업로드 실패 화면 테스트가 없다 | `unit-mapping.md` |
| U05 | PASS | 두 호스트 메뉴(플레이어 포함), 집행 만들기, 사이트·관리자 링크 | `unit-mapping.md` |
| U06 | 부분 PASS (테스트 공백) | opener 없음에서 "광고 관리 창 닫기"가 숨는 것만 테스트한다. opener가 있을 때 보이고 `window.close()`를 부르는 테스트는 없다(구현은 `ui/src/app/Workspace.tsx:257,308`) | `unit-mapping.md` |
| U07 | PASS | 목업 배지, API 0, 쓰기 비활성과 이유 | `unit-mapping.md`(mocks.test.tsx) |
| U08 | PASS | PreviewPlayer: preview true, 수집 0, 해제, 교체 | `unit-mapping.md`(player.test.tsx) |
| U09 | PASS | PlayerTestLinks: 새 탭, 상대 주소 해석, preset | `unit-mapping.md` |
| HL02 (단위) | PASS | 그누보드 도움말이 사이트 보기 앞, standalone 도움말이 집행 만들기 앞, 메뉴에 도움말 없음. siteUrl이 없을 때의 순서는 단언하지 않는다(구조상 도움말이 항상 처음) | `unit-mapping.md` |
| HL14 (help.test.tsx) | PASS | id 중복 없음, 용어마다 그림, 호스트별 카드 | `unit-mapping.md` |
| PL07 (UI) | PASS (메모) | 프리셋 20개에서 새로 만들기와 복제 차단, preset_limit 문구 매핑. 서버 preset_limit 뒤 입력 유지 화면 테스트는 없다 | `unit-mapping.md` |
| PL21 (표 대조) | PASS | player-options.test.tsx가 packages/extensions/ads 소스와 대조 | `unit-mapping.md` |
| PL24 (G-U 단위) | 부분 PASS | 메뉴 순서(지면 편성 바로 뒤)는 테스트. 그누보드 설치 안내 문구(PlayerSetup.tsx:86-101)는 단언하는 테스트가 없다. 실환경은 D1로 NOT_RUN | `unit-mapping.md` |

## 브라우저 회귀

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| B02–B05 | PASS | URL 등록, 업로드, v2 수정과 보관, `javascript:`·`ftp:` 거절(요청 0, 입력 유지) | `evidence/delta/B01-B05/result.json`, `B02/`–`B05/` |
| B07–B08 | PASS | 편성 409, 게시와 상속 | `evidence/delta/B06-B08/result.json`, `B07/`, `B08/` |
| B09 | 수집 0 PASS / 재생 순서 BLOCKED | 00:58에 플래그 없이 실행해 광고가 약 3초에 멈추고 stall로 넘어갔다. 이는 환경 요인이다. 미리보기 중 events 0, 공개 schedule 0, schedule-preview 1. 서버 정지와 비밀번호 삭제 뒤 이 사실을 발견해 재실행하지 못했다. 같은 미리보기 재생 경로는 PL13(플래그 사용)에서 pre → pre → 본편 → mid 순서로 끝까지 확인했다 | `evidence/delta/B09/result.json` |
| B10 | PASS | 플래그로 재실행. native와 Video.js 새 탭 재생 | `evidence/delta/B10/result.json`, png |
| B11 | PASS | 통계와 CSV(오류 6은 B10 attempt-1의 OS 일시정지 영향) | `evidence/delta/B11/result-after-b10.json`, `stats-video.csv` |
| B13 | PASS | 1280×800 7화면 넘침 0 | `evidence/delta/B13-B14/result.json` |
| PL01 | PASS | 메뉴 진입 API는 player-presets 1건, 새로고침 뒤 유지. meta 키는 종료 D13에서 확인했다 | `evidence/delta/PL01/`, `D13/` |
| PL02–PL06 | PASS | 생성, 수정, 복제, 기본 지정, 삭제 | `evidence/delta/PL02/`–`PL06/`, `PL03-04/` |
| PL10 | PASS | native 전환 시 스킨과 테마를 숨기고 안내. P-B는 skin·theme null로 저장 | `evidence/delta/PL10/result.json` |
| PL11 | PASS | 대비 경고, 저장 허용. 정리 200 | `evidence/delta/PL11/result.json` |
| PL12–PL13 | PASS | 새로고침 없는 실시간 미리보기, 스킨 변경 시 문서 다시 불러옴. PL13 API 0 | `evidence/delta/PL12-13/result.json` |
| PL14 | PASS | 화면을 벗어나면 미리보기 iframe 제거, 이후 요청 0 | `evidence/delta/PL14/result.json` |
| PL15 | PASS | 클립보드 스텁이 늘 거절해도(시스템 클립보드 미사용) 실패마다 새 안내, pre 전체 선택(857/857)과 aria-describedby, 코드가 바뀌면 결과 지움. 코드 4종, native HLS 비활성, 이스케이프 `video-id="qa&#34;&#60;x&#62;&#38;1"` | `evidence/delta/PL15/result-delta.json`, `result-gen.json`, `code-*.html` |
| HL05 | PASS | 링크 77개, termId 35종 모두 제목이 초점을 받는다. 다시 열기: 숨기는 필터는 "전체"로, 보이는 필터는 유지, 제목 초점. D9: 편성과 프리셋 미저장 입력이 뒤로 가기와 메뉴 이동 뒤에도 남는다(쓰기 0) | `evidence/delta/HL05/result.json`, `result-reopen.json` |
| HL07 | PASS | 일시정지하면 완성 그림, 애니메이션 0. 다시 누르면 약 83ms에서 재시작. 화면 밖은 제자리 정지(6083→6083) 뒤 재개. forced-colors에서 눌린 버튼에 2px 실선 윤곽 | `evidence/delta/HL07/result.json`, png |
| PUBLIC-COOKIE | PASS | 익명과 로그인 상태 모두 player-preset, schedule, events 응답의 Set-Cookie 0. 관리자 player-preset-default는 CSRF가 있으면 200, 없으면 403 `csrf`. curl 404, 400, events 403에 Set-Cookie 없음(bootstrap만 설정) | `evidence/delta/PUBLIC-COOKIE/result.json`, `curl-headers.txt` |
| PL16 | PASS (MP4 ×2) | 생성기 출력을 고치지 않은 붙여 넣기 페이지(videojs, native)에서 pre, mid, post 이미지, 본편 끝까지 재생. 테마 #0f5132, 12px, 15px. attempt 1은 로그인 goto 시간 초과(스크립트 분류) | `evidence/delta/PL16/`, `fixtures/paste/pl16d-*.html` |
| PL17–PL18 | PASS | videojs에 P-A 적용, native는 P-B 한국어, player.html에 P-A면 안내 뒤 기본. 404와 400은 안내 뒤 기본 재생 | `evidence/delta/PL17-18/result.json` |
| PL19 | PASS | videojs 프리셋은 Video.js 링크에만, native 프리셋은 기본 video 링크에만 붙는다. 전환 중 API 0, 연 페이지에 P-A 적용 | `evidence/delta/PL19/result.json` |
| HL15 | 부분 PASS | 건너뛰기 문구가 약 3초에 바뀐다. 순서 pre → mid(5.1초) → post 이미지. 열기와 다시 보기마다 광고별 시작 +1(0→4→8→12, 기록만). 숨김 탭과 이미지 타이머, 같은 세션 중복 없음은 이전과 같은 사유로 NOT_RUN | `evidence/delta/HL15/result.json` |
| preset.js 방어 | PASS | 건너뛰기 문구의 RLO, LRI/PDI, C0 벨, attributes·css·ui.labels의 `__proto__`, css의 `constructor`, native의 bidi는 모두 거절되고 페이지 안내 뒤 기본 재생. 프로토타입 오염 없음, 콘솔 출력 없음. 대조 케이스는 적용된다 | `evidence/delta/PRESET-GUARD/result.json`, png |
| D9 | PASS | HL05 행 참고 | `evidence/delta/HL05/` |

## 새 결함 (delta)

제품 결함과 테스트 공백이다. 수정하지 않았다.

| 순위 | ID | 심각도 | 추정 담당 | 내용 | 증거 |
| --- | --- | --- | --- | --- | --- |
| 1 | U04 | low–medium | ads-ui | F2·F3 저장의 422·네트워크 실패, 소재 저장·업로드 실패의 화면 테스트 없음(브라우저 동작은 B05·B16에서 확인) | `evidence/delta/U02/unit-mapping.md` |
| 2 | B14-390 | low | ads-ui / ads-ds | 390×844 소재 화면의 페이지 scrollWidth가 560이다. 표는 `.sa-scroll` 안에 있지만 th 안의 절대 위치 `.sa-sr` 요소가 오른쪽 560까지 걸친다(추정 원인, 미확인). 다른 화면은 넘침 없음. 시나리오 기준 폭(768) 밖이다 | `evidence/delta/B14-390/probe-overflow*.json`, `creatives.png` |
| 3 | U06 | low | ads-ui | opener가 있을 때의 창 닫기 버튼 테스트 없음 | `unit-mapping.md` |
| 4 | PL24 | low | ads-ui | 그누보드 설치 안내 문구 단언 테스트 없음 | `unit-mapping.md` |
| 5 | PL07 | low | ads-ui | 서버 preset_limit 뒤 입력 유지 화면 테스트 없음 | `unit-mapping.md` |

## 관찰 (delta, 판정에 반영하지 않음)

- B06: 잘못된 위치 값은 브라우저 기본 검증(`validationMessage`)으로만 막힌다. 앱 alert와 aria-invalid는 없다.
- B15: 게시가 끝난 뒤 초점이 BODY로 간다(`publish.focusAfter`). PL08 "내 입력 유지" 뒤 초점도 BODY 쪽으로 보인다(측정값이 bootstrap 스크립트 텍스트였다, 미확인).
- PL23: "스킨 소스 내려받기" 항목에 공식 안내 링크가 없다(계약 56행 "공식 안내 링크만").
- PUBLIC-COOKIE: `schedule&videoId=<bad>`가 200을 주고 "<bad>"를 되돌려 준다(JSON, nosniff). delta 범위 밖이다.
- PL11 노랑/흰색 "1:1" 표시와 PL12 미리보기 글꼴(system-ui)은 이전과 같다.
- `player-video-id` 별칭은 결함이 아니다(지시). HL15 시작 수 증가는 기록만 한다.
- vp check anti-slop 경고 12건(no-unknown-parameters 9, no-unsafe-dictionary-type 2).
- 스크립트 재시도: PL08 case 2 attempt(blocked, noop), PL16 attempt 1, B10 attempt 1(OS 미디어 일시정지)은 입력·환경 분류이고 제품 판정에 쓰지 않았다.

## D13 meta 최종 (delta, 읽기 전용)

`sqlite3 -readonly`로 `$QA_DIR/ads.sqlite`의 `ads_meta`만 읽었다. 이름은 player_presets, schema_version, signing_key(값 미기록, 길이만), site_id, write_lock이다. 비밀번호 해시는 `ads_admins`에 있어 읽지 않았다. player_presets는 revision 26, defaultPresetId `p-vym1rjw052`이고, 프리셋은 P-A(videojs neutral, #0f5132, 12, 15, en)와 P-B(native, ko, loadSeconds 8) 2개다. PL08과 PL09는 원복 뒤 남은 변경이 없다. 증거: `evidence/delta/D13/meta-names.txt`, `player_presets.json`.

## 실행하지 않은 것과 이유 (delta)

| 항목 | 이유 |
| --- | --- |
| G01–G08, HL13 G-U, PL24 실환경, HL02 실환경 | D1 |
| B09 재생 순서 | 플래그 없이 실행된 것을 종료 절차 뒤에 발견. 비밀번호 파일을 지워 재로그인할 수 없음. 다음 회차에 재실행 필요 |
| PL16 HLS 2건, PF U-P2 | 이전과 같음 |
| HL15 숨김 탭 멈춤, 이미지 타이머, 같은 세션 중복 없음 | 이전과 같음(headless visibility, 이미지 클릭 URL 없음, UI로 재현 불가) |
| PL09 서버 오류(`error` prop)의 두 입력 연결 | 브라우저에서 서버 오류를 만들지 않음 |
| U01 빌드 | 빌드 금지, SHA 기록으로 대체 |

# A1-QA-DELTA-2 (2026-10-21)

실행: 2026-10-21 03:12–03:38 KST, ads-qa 단독. 후속 수정 뒤 두 번째 차등 재실행이다. 위 A1-QA-RUN과 A1-QA-DELTA 행은 지우지 않았다. 증거는 `evidence/delta2/<ID>/`, 스크립트는 `evidence/delta2/scripts/`에 있다. 설치 비밀번호, 쿠키, Set-Cookie, X-CSRF-Token, csrfToken, 로그인 본문, 서명 토큰, signing_key 값은 증거와 이 문서에 남기지 않았다. 종료 때 유출 검사 결과는 0건이다(비밀번호 파일 값과 signing_key 값으로 `grep -F`, 쿠키·CSRF·토큰 패턴).

## 환경 (delta-2)

| 항목 | 값 |
| --- | --- |
| QA_DIR | `/private/tmp/ads-a1-qa-5hIrOy8Y` (새 mktemp, chmod 700, SQLite 새 설치. `admin-password` 0600은 종료 때 삭제함) |
| 서버 | `php -S 127.0.0.1:18781` PID 81263, 라우터 `qa/fixtures/qa-router.php`. 18781은 18781부터 찾은 첫 빈 포트다. 종료 때 이 PID만 정지했다(`evidence/delta2/99-end/stop.txt`) |
| 런타임 | PHP 8.5.8, Node v24.2.0, Playwright 1.59.1, channel chrome (Chrome 155 headless) |
| 재생 플래그 | 모든 브라우저 실행에서 처음부터 `--disable-features=HardwareMediaKeyHandling,GlobalMediaControls`(`scripts/lib.mjs` launch 기본값) |
| 기준 해시 | admin-app.js `8ea803dc…b9ad`, admin-app.css `99816b2d…72fe`, ads.js `b6a7e8e4…288c`, 서빙 트리 `cc93cd00…9e9e` (32파일) |
| 시작과 종료 해시 | 4개 모두 기준과 같음(03:12:36 `00-env/hashes-before.txt`, 종료 `99-end/hashes-after.txt`). 빌드는 하지 않았다 |
| 프리셋 | P-A `p-qrgzuc8ste` "QA Video.js 중립 v2"(기본, PL02에서 생성), P-B `p-6aiokv34yw` "QA 기본 video"(native, PL10에서 생성) |
| 서버 로그 | PHP 오류 0. "error"가 들어간 줄은 자산 파일 이름(`error-dialog.js`, `media-error-*.js`)의 200 요청뿐 |

## 18765·18766 비교 (delta-2)

`evidence/delta2/00-env/lsof-before.txt`(03:12:36)와 `99-end/lsof-after.txt`의 LISTEN 줄이 같다. 18765에는 php PID 9878, 18766에는 php PID 34509가 떠 있었다. 두 서버는 정지, 재시작, 요청, 쓰기 어느 것도 하지 않았다. 18781은 정지 뒤 LISTEN 0이다.

## 이번 수정 확인

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| B09 | PASS | 플래그를 켜고 실행했다. 미리보기 순서는 pre 1/2 → pre 2/2 → 본편 → mid(5.2초) → 본편 → post 이미지이고 모두 complete다. 미리보기 중 events 0, 공개 schedule 0, schedule-preview 1이다. 화면을 벗어난 뒤 요청과 미디어가 0이다. DELTA의 BLOCKED가 풀렸다 | `evidence/delta2/B09/result.json`, `network.json`, png |
| B13 | PASS | 1280×800 소재·캠페인·대시보드·플레이어 목록·설치·옵션·리포트(행 있음)·지면 편성에서 페이지 넘침 0(scrollWidth = clientWidth), 잘림 0 | `evidence/delta2/widths/result.json`, `widths/B13/` |
| B14 | PASS | 768×1024 같은 8화면, 넘침 0, 잘림 0. 저장·게시 hit-test 정상, 메뉴 8/8 | `widths/result.json`, `widths/B14/`, `B13-B14/result.json` |
| B14-390 | PASS (DELTA 결함 해소) | 390×844 같은 8화면 모두 scrollWidth 390, 페이지를 넓히는 요소 0, 잘림 0. 화면 밖 조작(소재 21, 플레이어 15, 옵션 21 등)은 모두 `position: relative`인 `DIV.sa-scroll`이나 `NAV.sa-nav` 스크롤 영역 안에 있어 스크롤로 닿는다 | `widths/result.json`, `widths/B14-390/` |
| B15 | PASS | 키보드로 초안 저장 200 뒤 초점이 "초안 저장"에, 게시 200 뒤 "저장한 초안 게시"에 남고 초점 고리가 보인다(DELTA의 BODY 이동 해소). 위치 칸 Tab과 Shift+Tab이 칸을 벗어난다. 경로 이동 초점은 H1 "지면 편성" | `evidence/delta2/B15/result.json`, png |
| FOCUS | PASS | 마우스 쓰기 9건: 편성 저장, 게시 취소, 게시 확인, 영상 소속 저장, 새 소재 저장, 새 버전 저장, 통계 조회, CSV는 초점이 시작 버튼으로 돌아온다. 보관 뒤에는 시작 버튼이 비활성이 되어 초점이 H1 "소재"(`#aa-title-creatives`, tabindex -1)로 간다. 마우스라 focus-visible은 false(정상) | `evidence/delta2/FOCUS/result.json`, png |
| PL08 | PASS | 같은 필드(강조색) 409 → 다시 불러오기: 초점이 H2 "프리셋 수정"에 있고 안내가 강조색을 말하며, 고르기 전에는 저장이 비활성이고 이유가 붙는다. "내 입력 유지"와 "다른 곳에서 저장한 값 쓰기" 모두 고른 뒤 초점이 INPUT 강조색(focus-visible true)으로 가고 선택 버튼은 사라진다. 두 번째 저장 200(keep → #222222, theirs → #111111), P-A 원복 200(#0f5132) | `evidence/delta2/PL08/result-case2-keep.json`, `result-case2-theirs.json`, png |
| B06 | PASS | 위치 칸에 '', '0', '-3', 'abc'를 넣고 blur하면 aria-invalid true와 describedby "0.01 이상의 초를 숫자로 입력해 주세요. 예: 30"이 붙고 요청 0, 초점은 다음 칸으로 간다. 저장하면 요청 0, alert "저장하지 못했어요. 표시한 항목을 확인해 주세요.", 초점 "본편 재생 위치 (초)". 클릭과 키보드로 칸을 벗어나고 재정렬 뒤 초점 유지. attempt 1은 대기 칸 선택자 오류(스크립트) | `evidence/delta2/B06/result.json`, `attempt-1-wait-selector/`, png |
| VID-API | PASS | 공개 schedule(쿠키 없음)에서 RLO, LRI/PDI, U+3000 하나, U+3000×3, NBSP 하나, BOM 하나, C1 U+0085·U+009B, C0 벨, 129자는 모두 422 `validation`, `fields.videoId` "영상 ID를 확인해 주세요."이고 본문에 입력 echo가 없다. Set-Cookie 없음, nosniff. 빈 값도 422. 관리자 schedule-draft(target.id), schedule-preview(videoId), schedule-save(target.id), video-context-save(videoId)도 같은 10개 값이 422이고(`fields.target.id` 또는 `fields.videoId`) echo가 없으며 200으로 받아들인 쓰기는 0이다. 대조: `a1-qa-video-1`, `<bad>`, 128자는 200 | `evidence/delta2/VID/result.json` |
| VID-정상 ID | PASS | `a1-qa-video-1`로 예제 재생과 수집이 그대로 된다(B10, B11 행) | `evidence/delta2/B10/`, `B11/` |
| VID-화면 | 관찰 | 생성기와 재생 테스트는 화면에서 미리 막지 않는다(알려진 공백). 아래 관찰 참고 | `VID/result.json`, `VID/result-play-test.json`, png |

## 단위 대응 (delta-2)

명령: `pnpm -F @videojs/ads-manager-ui test`(17파일, 504 통과, 0 실패, exit 0. DELTA는 486), verbose 504건 이름, typecheck(tsgo) exit 0, `pnpm exec vp check integrations/ads-manager/ui`(형식 97파일 통과, lint 오류 0, 경고 12, exit 0). 대응표는 `evidence/delta2/U02/unit-mapping.md`에 있다.

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| U02 | PASS | 네 명령 모두 exit 0 | `evidence/delta2/U02/*.log` |
| U04 | PASS (DELTA FAIL 해소) | app.test.tsx > App flows: "keeps the schedule input and shows the error after {a 422, a network failure} on save (QA U04)", "keeps the creative input … on URL save (QA U04)" ×2, "keeps the chosen file … on upload (QA U04)" ×2. alert 문구, 입력 유지, 성공 문구 없음, 쓰기 1회를 단언한다 | `U02/test-names.txt`, `unit-mapping.md` |
| U06 | PASS (DELTA 공백 해소) | app.test.tsx > App > "offers 광고 관리 창 닫기 on GnuBoard only when an opener window exists (QA U06)": opener가 있으면 버튼 클릭이 `window.close` 1회, standalone은 opener가 있어도 버튼 없음 | 같음 |
| PL07 (UI) | PASS (DELTA 공백 해소) | admin-players.test.tsx > PlayersScreen > "keeps the new preset input after the server refuses a 21st preset (QA PL07)": 400 preset_limit 뒤 안내 alert, 이름과 글자 크기 유지, 해시 유지, 이탈 경고, 저장 1회 | 같음 |
| PL24 (G-U 단위) | PASS (단위). 실환경은 D1로 NOT_RUN | admin-players.test.tsx > PlayerSetup > "gives the GnuBoard install steps: /ads/ on the same origin, video IDs and read permission (QA PL24)"와 standalone에는 그누보드 형식이 없다는 테스트 | 같음 |

## 짧은 회귀 (delta-2)

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| B01–B05 | PASS | invalid_login 401 문구, URL 등록, 업로드, v2와 보관, `javascript:`·`ftp:` 거절(요청 0). 콘솔 401은 의도된 것이고 404는 favicon뿐 | `evidence/delta2/B01-B05/result.json`, `B01/`–`B05/` |
| B07–B08 | PASS | 편성 초안과 409, 게시 v1, 영상 소속(notice/1) 저장, 게시판 disabled와 inherit 원복 | `evidence/delta2/B06-B08/result.json`, `B07/`, `B08/` |
| B10 | PASS | player.html과 videojs.html 새 탭이 같은 순서로 재생되고 events 200 ×13 | `evidence/delta2/B10/result.json`, png |
| B11 | PASS | 합계 시작 8, 완료 8, 오류 0. 영상·게시판·무료 필터 정상, CSV 200 | `evidence/delta2/B11/result-after-b10.json`, `stats-video.csv` |
| PL01 | PASS | 메뉴 진입 API는 player-presets뿐. PL01 직후 meta 이름은 schema_version, signing_key, site_id, write_lock이고 player_presets는 없다 | `evidence/delta2/PL01/` |
| PL02 | PASS | P-A 생성과 새로고침 뒤 유지. attempt 1은 스크립트의 옛 경로로 시간 초과(`PL02/attempt-1-old-route/`). pl02-verify로 확인 | `evidence/delta2/PL02/result-reload.json` |
| PL03–PL04 | PASS | 수정으로 revision 증가, 복제본 생성 | `evidence/delta2/PL03-04/result.json` |
| PL05 | PASS | 기본 지정 p-qrgzuc8ste, 공개 무쿠키 호출 200 | `evidence/delta2/PL05/result.json` |
| PL06 | PASS | Esc와 취소는 초점이 삭제 버튼으로, 확인은 H2 "프리셋 목록"으로 간다. 기본 복제본 삭제 뒤 기본으로 대체, P-A 기본 복원 | `evidence/delta2/PL06/result.json` |
| PL10 | PASS | P-B native, ko, loadSeconds 8 | `evidence/delta2/PL10/result.json` |
| PL12–PL13 | PASS | 실시간 미리보기, PL13 API 0 | `evidence/delta2/PL12-13/result.json` |
| HL05 | PASS | 작업 화면 도움말 링크의 termId 35종 모두 대상 제목이 초점을 받는다. 다시 열기: 숨기는 필터는 "전체"로 바뀌고, 보이는 필터는 유지되며, 제목이 초점을 받는다 | `evidence/delta2/HL05/result.json`, `result-reopen.json` |
| D9 | PASS | 편성 미저장 입력과 프리셋 미저장 입력이 도움말 → 뒤로 가기, 메뉴 이동 뒤에도 남는다. 쓰기 0 | `evidence/delta2/HL05/result.json`(d9) |

## 새 결함 (delta-2)

수정하지 않았다.

| 순위 | ID | 심각도 | 추정 담당 | 내용 | 증거 |
| --- | --- | --- | --- | --- | --- |
| 1 | VID-1 | low | ads-ui (또는 ads-api 문구) | 지면 편성에서 개별 영상 고정 대상 ID에 RLO나 C1 값을 넣고 "편성 불러오기"를 누르면 schedule-draft가 422를 준다. 이때 alert가 "영상 ID를 확인해 주세요. 영상 ID를 확인해 주세요."로 같은 문장을 두 번 보여 준다(message와 `fields.target.id`가 같은 문장). ID 칸에는 aria-invalid와 오류 연결이 없다 | `evidence/delta2/VID/result.json`(screens.schedule-target:*), `VID/schedule-target-rlo.png` |

## 관찰 (delta-2, 판정에 반영하지 않음)

- VID 생성기: RLO나 C1이 든 영상 ID를 넣어도 aria-invalid와 경고 없이 그 문자를 그대로 넣은 설치 코드를 만든다(코드 줄에 U+202E, U+0085). U+3000 하나만 넣으면 빈 값으로 보고 코드를 감추며 "고정 영상 ID를 입력해 주세요."를 띄운다. 알려진 공백이다.
- VID 재생 테스트: 재생 확인의 "고정 영상 ID"에 RLO나 C1 값을 넣으면 두 새 탭 링크가 그 값을 담아(`video=a1%E2%80%AEqa`, `a1%C2%85qa`) 만들어진다. U+3000 하나는 링크를 숨긴다. 알려진 공백이다. RLO 링크로 player.html을 열면 schedule 422 뒤 "영상 ID를 확인해 주세요. 본편은 별도로 재생할 수 있습니다."가 상태 줄과 안내 상자에 함께 나오고 본편은 재생할 수 있다. 맥락 줄에는 RLO가 텍스트로 들어간다(HTML 해석 없음).
- VID 화면: RLO가 든 값은 입력칸에서 "a1aq"처럼 뒤집혀 보인다. U+3000 하나는 고정 대상 ID 화면 검증("128자 이내의 고정 대상 ID를 입력해 주세요.")이 요청 0으로 막는다.
- VID 규칙 밖: LRM(U+200E), ALM(U+061C), ZWSP만(U+200B)은 공개 schedule에서 200을 받고 입력이 그대로 되돌아온다. Value::videoId 규칙(`\p{Cc}`, U+202A–202E, U+2066–2069, 공백류만)에 들지 않는다. 지시 범위 밖의 후보로만 적는다. `<bad>`의 200 echo는 지시대로 정상이다.
- B06: 스킵 대기 0은 브라우저 기본 검증("값은 1 이상이어야 합니다.")으로 막힌다. aria-invalid는 없고 요청 0이다. 초점은 대기 칸에 있고 앱 alert가 뜨며, 그 alert는 이후 다른 칸의 blur에서도 남아 있다. 지시대로 관찰만 했다.
- vp check anti-slop 경고는 12건이다(no-unknown-parameters 9, no-unsafe-dictionary-type 3). 총수는 DELTA와 같다.
- 스크립트 재시도: PL02 attempt 1(옛 경로)과 B06 attempt 1(선택자)은 스크립트 문제로 분류했고 제품 판정에 쓰지 않았다.

## D13 meta 최종 (delta-2, 읽기 전용)

`sqlite3 -readonly`로 이번 `$QA_DIR/ads.sqlite`의 `ads_meta`만 읽었다. 이름은 player_presets, schema_version, signing_key(값 미기록), site_id, write_lock이다. player_presets는 revision 18, defaultPresetId `p-qrgzuc8ste`이고, 프리셋은 P-A "QA Video.js 중립 v2"와 P-B "QA 기본 video" 2개다. 증거: `evidence/delta2/99-end/meta-names.txt`, `player-presets.json`.

## 실행하지 않은 것과 이유 (delta-2)

| 항목 | 이유 |
| --- | --- |
| G01–G08, PL24 실환경, HL02·HL13 실환경 | D1 |
| B12, B16–B18, PL09, PL11, PL14–PL19, PL21–PL23, HL01–HL04, HL06–HL15, PRESET-GUARD, PUBLIC-COOKIE | 이번 차등 범위(항목 1–7)에 없음. DELTA 결과를 유지한다 |
| PL16 HLS 2건, HL15 숨김 탭·이미지 타이머·중복 없음 | 이전과 같은 사유, 이번 범위 밖 |
| 생성기와 재생 테스트의 영상 ID 사전 검증 | 지시대로 알려진 공백이라 관찰만 했다 |
| U01 빌드 | 빌드 금지. SHA 기록으로 대체 |

# A1-QA-DELTA-3 (2026-10-21)

실행: 2026-10-21 03:51–04:06 KST, ads-qa 단독. 영상 ID 화면 검증만 좁게 다시 확인했다. 위 A1-QA-RUN, A1-QA-DELTA, A1-QA-DELTA-2 행은 지우지 않았다. 증거는 `evidence/delta3/<ID>/`, 스크립트는 `evidence/delta3/scripts/`에 있다. 비밀번호, 쿠키, Set-Cookie, X-CSRF-Token, csrfToken, 로그인 본문, 서명 토큰, signing_key 값은 남기지 않았다. 종료 때 유출 검사는 0건이다.

## 환경 (delta-3)

| 항목 | 값 |
| --- | --- |
| QA_DIR | `/private/tmp/ads-a1-qa-OZM6ZZX8` (새 mktemp, chmod 700, SQLite 새 설치. `admin-password` 0600은 종료 때 삭제함) |
| 서버 | `php -S 127.0.0.1:18781` PID 28222, 라우터 `qa/fixtures/qa-router.php`. 종료 때 이 PID만 정지 |
| 런타임 | PHP 8.5.8, Node v24.2.0, Playwright 1.59.1, channel chrome (Chrome 155 headless). 모든 실행에서 `--disable-features=HardwareMediaKeyHandling,GlobalMediaControls` |
| 기준 해시 | admin-app.js `ba113998…ade80`, admin-app.css `99816b2d…72fe`, ads.js `b6a7e8e4…288c`, 서빙 트리 `cc93cd00…9e9e` (32파일) |
| 시작과 종료 해시 | 4개 모두 기준과 같음(`00-env/hashes-before.txt` 03:51:53, `99-end/hashes-after.txt`). 빌드하지 않음 |

## 18765·18766 비교 (delta-3)

`00-env/lsof-before.txt`(03:51:53)와 `99-end/lsof-after.txt`의 LISTEN 줄이 같다(18765 php 9878, 18766 php 34509). 두 서버에는 아무것도 하지 않았다. 18781은 정지 뒤 LISTEN 0이다.

## 영상 ID 화면 검증

| ID | 결과 | 사유 | 증거 |
| --- | --- | --- | --- |
| VID-1 재확인 | PASS | 지면 편성 → 개별 영상 → 고정 대상 ID에 RLO, C1 NEL, U+3000 하나, 129자(maxlength 우회)를 넣고 "편성 불러오기"를 누르면 요청 0이다. 칸은 aria-invalid true이고 describedby가 "영상 ID에는 제어 문자나 글자 방향 제어 문자를 쓸 수 없어요. 지우고 다시 입력해 주세요."(RLO, C1), "영상 ID를 입력해 주세요."(U+3000), "영상 ID는 128자 이내로 입력해 주세요."(129자)를 가리킨다. 초점은 고정 대상 ID 칸(`#aa-schedule-target-id`)이다. alert는 "편성을 불러오지 못했어요. 고정 대상 ID를 확인해 주세요." 한 문장이고 반복이 없다. 값을 `a1-qa-video-1`로 고치면 aria-invalid가 풀리고 schedule-draft 200으로 편집기가 열린다 | `evidence/delta3/VID/result.json`(schedule), `VID/schedule-rlo-blocked.png`, `VID/result-shot.json` |
| VID-1 서버 422 경로 | PASS (단위만) | 화면 검증을 우회한 422 `fields["target.id"]`의 칸 연결, 한 번만 말하기, 초점은 단위 테스트로만 대응한다: app.test.tsx > fixed video IDs > "links the server target.id message to the field and says it once", describeError > "says a field message that repeats the summary only once and keeps it by path" | `evidence/delta3/U02/unit-mapping.md` |
| 설치 코드 생성기 | PASS | 같은 4개 값에서 요청 0, 코드 없음, 상태 "영상 ID를 고치면 설치 코드를 만들어요.", 칸 aria-invalid true, describedby에 오류 문구와 기본 도움말이 함께 연결된다 | `VID/result.json`(setup), `VID/setup-rlo.png` |
| 재생 확인 | PASS | 같은 4개 값에서 요청 0, 재생 테스트 링크 0, "미리보기 준비" 비활성, 칸 aria-invalid true와 같은 오류 문구, 안내 "고정 영상 ID를 고치면 재생 테스트 링크를 만들어요." | `VID/result.json`(playTest), `VID/play-test-rlo.png` |
| 그누보드 형식 free:12:main | PASS (단위만, D1) | admin-players.test.tsx > PlayerSetup review fixes > "keeps building gnuboard install code for a 게시판:글번호:영상키 ID", model.test.ts > videoIdProblem > "accepts a gnuboard ID" | `U02/unit-mapping.md` |
| 정상 ID 생성기·링크 | PASS | `a1-qa-video-1`로 코드(`video-id="a1-qa-video-1"`, `videoId=a1-qa-video-1`)와 두 링크(`video=a1-qa-video-1`)가 만들어진다. 요청 0 | `VID/result.json`, `VID/setup-valid.png`, `VID/play-test-valid.png` |
| B10 | PASS | player.html과 videojs.html 새 탭이 pre → pre → mid → post 이미지 순서로 재생되고 본편이 끝까지 간다. 6초 대기 재실행에서 두 탭 모두 광고 4개의 start와 complete가 갖춰지고 events 200 ×14. 첫 실행(3초 대기)은 Video.js 탭의 post 이미지 complete 1건이 탭 종료 전에 나가지 않았다. 스크립트 대기(3초)가 post 이미지 길이(3초)와 같아 생긴 경합이다. ads.js와 예제 해시는 그대로다 | `evidence/delta3/B10/wait6s/result.json`, `B10/result.json`(첫 실행) |
| B11 | PASS | 합계 시작 16, 완료 15, 오류 0(첫 실행의 complete 1건 누락이 반영된 값). 영상 a1-qa-video-1, 게시판 notice 필터는 같은 값이고 free는 0, CSV 200(BOM) | `evidence/delta3/B11/result-after-b10.json`, `B11/run1-after-b10-3s/` |
| B02–B05 | PASS | URL 등록, 업로드 2건과 Range 206/416, v2 수정, 보관, `javascript:`·`ftp:` 거절(요청 0) | `evidence/delta3/B01-B05/result.json` |
| 편성 불러오기·저장·게시 | PASS | 사이트 초안 저장 r1, 409, 게시 v1, 영상 소속 저장, 게시판 disabled와 inherit 게시 모두 200(409 제외) | `evidence/delta3/B06-B08/result.json` |
| FOCUS(편성 저장) | PASS | 마우스로 초안 저장 200 뒤 초점이 "초안 저장" 버튼에 남는다 | `VID/result.json`(focus) |
| 단위 전체 | PASS | 17파일 537 통과, typecheck exit 0 | `evidence/delta3/U02/test-verbose.log`, `typecheck.log` |

## 새 결함 (delta-3)

없다.

## 관찰 (delta-3, 판정에 반영하지 않음)

- LRM(U+200E), ALM(U+061C), ZWSP만(U+200B)은 지금처럼 통과한다. 지면 편성 불러오기 200, 생성기 코드 생성(`video-id="a1<U+200E>qa"` 등), 재생 테스트 링크 2개가 만들어진다(사용자 결정 대기).
- 129자를 키보드나 붙여 넣기로 넣으면 `maxlength=128`이 128자로 자른다. 그래서 세 화면 모두 정상 128자로 진행한다(편성 불러오기 200, 코드와 링크 생성). 129자 거절은 native setter로 maxlength를 우회해 확인했다.
- 생성기와 재생 확인은 칸이 잘못되면 기본 도움말 문구도 오류 문구와 함께 빨간색으로 바뀐다(`VID/setup-rlo.png`, `VID/play-test-rlo.png`). 지면 편성 고정 대상 ID는 도움말 대신 오류 문구만 보인다.
- 생성기와 재생 확인은 Tab으로 칸을 벗어날 때 막히므로 초점을 옮기지 않는다(alert 없음, 상태와 describedby로 안내).
- 스크립트 재시도: VID attempt 1(같은 해시 goto라 새로 로드되지 않아 앞 상태가 남음, `VID/attempt-1-no-reload/`), attempt 2(maxlength 우회 케이스 빠짐, `VID/attempt-2-no-forced/`), B10 첫 실행(3초 대기)은 스크립트 문제로 분류했고 제품 판정에 쓰지 않았다.

## D13 meta 최종 (delta-3, 읽기 전용)

`sqlite3 -readonly`로 이번 `$QA_DIR/ads.sqlite`의 `ads_meta` 이름만 읽었다. schema_version, signing_key(값 미기록), site_id, write_lock이고, 이번에는 프리셋을 만들지 않아 player_presets 행이 없다. 증거: `evidence/delta3/99-end/meta-names.txt`.

## 실행하지 않은 것과 이유 (delta-3)

| 항목 | 이유 |
| --- | --- |
| 그누보드 실환경(free:12:main 실제 재생), G01–G08 | D1. 단위 테스트로만 대응 |
| 화면 검증을 우회한 서버 422의 화면 반영 | 지시대로 단위 테스트 이름으로만 대응 |
| B01, B06 위치 검증, B09, B12–B18, PL·HL 전반 | 이번 범위(항목 1–4) 밖. DELTA-2 결과 유지 |
| vp check, 루트 typecheck, check:workspace | 오케스트레이터가 실행함. 이번에는 UI test와 typecheck만 다시 실행 |
| U01 빌드 | 빌드 금지. SHA 기록으로 대체 |
