# Claude 오케스트레이터 Takeoff — Video.js 광고 플러그인

작성일: 2026-10-20 KST

작업 디렉터리: `/Users/brian/works/tools/videojs/video.js`

참조 저장소: `../v10` — 읽기 전용

인수 대상: 광고 플레이어·관리자·Grok 예제의 기존 구현과 Herdr 팀

## 1. 인수 목적과 현재 상태

Claude는 이 프로젝트의 다음 오케스트레이터다. 기존 에이전트에게 범위가 명확한 작업을 배정하고, 코드와 실행 증거를 직접 검토한다. 처음부터 다시 구현하거나 인터뷰를 반복할 단계가 아니다.

현재 VOD 광고 플러그인, 독립 설치형/PHP 관리자, GnuBoard 연동, 플레이어에 맞춘 광고 UI, Grok 소재 예제가 구현돼 있다. 10월 18일까지 로컬 소스·테스트·일부 브라우저/API/DB 검증을 수행했다. 전체 플랫폼 검증이나 고객 배포가 완료된 것은 아니다. 세부 결과와 미실행 항목은 아래 증거 표를 따른다.

가장 최근 기능 요청인 플레이어 모서리 설정 확인과 Grok 소재 예제 연결도 처리했다. 새로운 기능 작업은 아직 배정돼 있지 않다. 먼저 현재 상태를 인수하고, 남아 있는 검증 공백 또는 다음 사용자 요청에 맞춰 후속 작업을 정한다.

이 문서 작성은 Claude 프로세스 시작이나 현재 오케스트레이터 pane 교체를 의미하지 않는다. 사용자가 실행한 Claude 세션이 아래 절차로 인수한다.

### 이번 요청의 권한

- 사용자는 이 takeoff 문서 작성에 이어 **작업 내용의 Git commit 및 push**를 요청했다.
- `origin`은 공식 `videojs/video.js`이며 현재 GitHub 계정의 권한은 READ다. 쓰기 가능한 기존 포크 `merong/video.js`는 ADMIN 권한으로 확인했다. 저장 대상은 해당 포크의 `feat/vod-ads-plugin` 브랜치다.
- 로컬에도 `feat/vod-ads-plugin` 브랜치와 `fork` remote를 만들었다. 원래 `origin`과 `main`은 보존했다. 커밋 전 재실행한 검사는 [publication-checks.md](publication-checks.md)를 따른다.
- 과거 C0/검증 문서의 “push 미승인” 문구는 당시 경계다. 이번 명시적 commit/push 요청에는 적용하지 않는다.
- 고객 배포, 운영 DB 마이그레이션, npm 공개 배포, main 병합, 강제 push는 이 요청의 범위가 아니다.
- 인수 시 `git status`, `git log`, 원격 ref를 다시 확인한다. 커밋 준비 전에는 광고 구현 대부분이 미추적 파일이었으므로 `git diff`만으로 전체 구현을 파악하면 안 된다.

## 2. 먼저 읽을 문서

아래 링크는 이 문서 기준 상대 경로다. 명령과 코드 경로는 별도 표시가 없으면 저장소 루트 기준이다.

1. [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), [CONTRIBUTING.md](../../CONTRIBUTING.md). 현재 `CLAUDE.md`는 `@AGENTS.md`를 가져온다.
2. [C0 공통 계약](../../.agents/plans/ads-contract-v1.md): JSON, 이벤트, 게시, 관리자 API, 수명주기의 기준.
3. [오케스트레이션 구성](../../.agents/plans/ads-orchestration.json), [작업 절차](../../.agents/plans/ads-orchestration.md): 담당 경로와 완료 작업. JSON 상태는 10월 18일 기록이다.
4. [광고 패키지 README](../../packages/extensions/ads/README.md), [관리자 README](../../integrations/ads-manager/README.md): 실제 사용법과 실행 조건.
5. [UX1 검증 보고서](../ads-ux-20261018/review.md): 최신 플레이어 수정과 번들별 검증 범위.
6. [모서리 설정·Grok 예제 보고서](../ads-grok-demo-20261018/README.md): 가장 최근 사용자 요청의 결과.
7. [초기 통합 검증](../../.agents/plans/ads-validation.md), [v10 비교](../../.agents/plans/ads-ux-parity.md), [인터뷰·구현 계획](../../.agents/plans/ads-module-plan.md), [미디어 브리프](../../.agents/plans/ads-media-brief.md).

실행 코드와 테스트가 동작의 기준이다. 초기 계획에 남은 `wB:*` pane, `default` 세션, 오래된 번들·테스트 수를 현재 값으로 사용하지 않는다. `.agents/plans/`는 임시 계획 공간이며 저장소 규칙상 merge 전 정리 대상이다. 지금 인수 중에는 계약과 이력을 임의 삭제하지 않는다.

## 3. 확정된 제품 범위

| 항목 | 결정 |
| --- | --- |
| 고객/설치 | 일반 커뮤니티의 동영상 수익화용 범용 플러그인. 고객별 독립 설치형 관리자와 GnuBoard/YoungCart 계열 연동 |
| 설치 형태 | JSON 기반 선택적 광고 모듈, HTML/ESM 스크립트 삽입. 플레이어와 관리자는 분리 |
| 재생 대상 | VOD 우선. Native MP4 및 기존 Video.js/SPF/hls.js 본편 연동. 호환성 주장은 실행한 조합으로 제한 |
| 편성 | 단일/연속 프리롤, 다중 미드롤, 포스트롤. 스킵은 현재 광고에만 적용 |
| 소재 | MP4/WebM 동영상, JPEG/PNG/WebP/animated GIF. 외부 URL과 파일 업로드 모두 |
| 스킵 | 불가 또는 N초 후 가능. C0 값은 `null` 또는 정수 `1..3600` |
| 탐색 | 앞으로 건너뛴 미시청 구간 중 가장 이른 한 구간만 즉시 실행. 나머지를 연속 보상하지 않음 |
| 반복 | 시작한 광고 구간은 해당 세션에서 소비됨. 같은 세션의 되감기/replay/reconnect로 반복하지 않음 |
| 설정 계층 | video > 해당 board의 category > board > site. 첫 비상속 게시 설정 전체를 사용. disabled는 fallback 중단 |
| 관리자 | 소재 등록·업로드·보관, 편성 초안/게시/미리보기, 영상 문맥, 통계·CSV |
| 로그 | 실제 관측 이벤트, attempt/session 연결, 재전송 중복 제거, 서버 수신 시점 기반 통계 |
| 제외 | Live, React 광고 UI, VAST/IMA, PiP/Cast 광고 지원, 경매/과금, 중앙 SaaS, 자동 보관기간 삭제, 별도 IIFE 배포 |

`skipAfterSeconds: 0`은 보존된 **미지원 입력 거부 사례**다. 1초로 조용히 바꾸거나 “0초 스킵 UI 성공”으로 기록하지 않는다. 지원 확장은 계약 변경이므로 별도 요청이 필요하다.

### 유지해야 할 동작

- controller 생성만으로 광고를 자동 재생하지 않는다. 실제 본편 play 의도에 반응한다.
- 영상 start/complete는 실제 재생/ended, 이미지 시간은 실제 표시·재생 상태에 따른다. pause 중 타이머는 멈추지만 GIF 자체 프레임까지 멈춘다는 계약은 아니다.
- 실패·timeout·cancel을 complete로 만들지 않는다. 기본 request/load timeout 5초, video stall timeout 10초다.
- 한 break가 시작되면 스킵/실패해도 소비된다. 시작 전 cancel은 소비하지 않는다. 누락 미드롤은 이후 다시 해당 구간을 건너뛸 때만 대상이 된다.
- 실제 ended에서는 포스트롤이 누락 미드롤 보상보다 우선한다. 포스트롤 완료 뒤 본편 ended를 유지하고 사용자 replay를 기다린다.
- 같은 소스의 초기 `emptied → loadstart`는 첫 부착 과정일 수 있다. 실제 source/video ID 교체와 구분한다.
- source/config 변경, disconnect, 취소 콜백 중 요소 제거 시 오래된 비동기 작업·추적·재생 차단이 살아나면 안 된다.
- `preview:true`는 수집 요청을 보내지 않는다. 로컬 `onEvent`는 가능하다. Grok raw JSON 예제도 DB 통계 검증용이 아니다.
- 초안 revision 충돌, immutable 게시 snapshot, GnuBoard의 소모성 CSRF와 갱신 헤더를 보존한다.
- 저장 실패는 입력을 유지하고 실제 오류를 표시한다. 성공처럼 보이는 임시 상태나 가짜 미리보기를 만들지 않는다.

## 4. 구현 지도

| 경로 | 역할/주의점 |
| --- | --- |
| `packages/extensions/ads/src/core/` | JSON parser, scheduler, 이벤트·URL 계약. DOM 의존성을 넣지 않는다 |
| `packages/extensions/ads/src/dom/` | controller, source lifecycle, tracking, overlay, UI·문구 |
| `packages/extensions/ads/src/html/element.ts` | `<media-ads>` 연결·해제·재설정과 extension 연동 |
| `packages/extensions/ads/src/cdn.ts` | 독립 ESM 광고 진입점. 플레이어 본체는 별도 |
| `integrations/ads-manager/src/` | PHP 서비스, 소재, 편성, 이벤트, 통계, 미디어 응답 |
| `integrations/ads-manager/hosts/` | Standalone/GnuBoard 인증과 호스트 문맥 |
| `integrations/ads-manager/admin/`, `public/assets/admin/` | 공통 PHP 관리자 화면과 점진적 JS/CSS |
| `integrations/ads-manager/public/examples/` | Native/Video.js/Grok 예제, 실제 상태 관찰 |
| `integrations/ads-manager/contract/playback-v1.json` | 오케스트레이터 소유 공통 fixture |
| `integrations/ads-manager/tests/` | 관리자 Vitest 및 격리 PHP/HTTP/호스트 테스트 |

`@videojs/ads`는 현재 `private:true`인 내부 패키지다. 이미 npm에 공개됐다는 의미가 아니다. 내부 `PlayerExtension`을 임의로 안정 공개 API로 승격하거나 HTML 비공개 base class를 deep import하지 않는다.

명령형 표면은 `createAdsController({ media, container, schedule, preview?, tracking?, onEvent?, ui? })`, `destroy()`, `updateUI()`다. HTML은 `<media-ads for="content" src="..." video-id="...">`를 사용한다. 현재 문구 갱신은 패키지 README와 실제 `ui.ts`/`element.ts`를 따른다. HTML에 없는 `labels` 프로퍼티를 가정하지 않는다. 문구 변경으로 광고 세션이나 경과 시간을 초기화하면 안 된다.

### 모서리 설정 답변

별도 `flat`/`borderRadius` 로딩 옵션은 발견되지 않았다. 공개 CSS 변수 `--media-border-radius`를 사용한다.

```css
/* 스킨 또는 적절한 상위 요소에 지정 */
--media-border-radius: 0px;  /* flat */
--media-border-radius: 16px; /* 사용자 지정 */
```

테마 fallback은 28px, 기존 예제는 8px다. 광고는 `--ads-radius` → `--media-video-border-radius` → `--media-border-radius`를 따른다. 외부 검정 wrapper 자체의 반경은 별개다. 0/16px의 media-container·광고 panel 일치와 광고 시간 보존을 실제 Chromium에서 확인했다. 확인 요청에 대해 새 로딩 API를 추가한 것은 아니다.

## 5. Herdr 팀 인수

현재 세션은 **`tools`**, workspace는 **`w1`**이다. 모든 명령에 `herdr --session tools`를 명시한다. 상속된 기본 세션이 과거 다른 작업을 가리킨 이력이 있다.

첫 제어 전에 `test "${HERDR_ENV:-}" = 1`로 Herdr 안에서 실행 중인지 확인한다. 실패하면 외부에서 사용자의 포커스 세션을 조작하지 않는다. `herdr --help`, `herdr --skill`로 설치된 CLI와 지침을 읽는다.

2026-10-20 live 조회:

| 에이전트 | pane / tab | 상태 | 담당 |
| --- | --- | --- | --- |
| 현재 Codex 오케스트레이터 | `w1:p1` / `w1:t1` | working | 통합·계약·검증·인수 문서 |
| `grok` | `w1:p7` / `w1:t1` | idle | `workspaces/ads-media/**` |
| `ads-source-analyst` | `w1:p2` / `w1:t2` | idle | 읽기 전용 소스 리뷰 |
| `ads-implementer` | `w1:p3` / `w1:t2` | idle | `packages/extensions/ads/**` |
| `ads-admin-api` | `w1:p4` / `w1:t3` | idle | 관리자 backend/API/DB/hosts/bin/backend tests 및 API 소유 진입점·router·설치 설정 |
| `ads-admin-ui` | `w1:p5` / `w1:t3` | done | `admin/**`, `public/assets/admin/**`, `public/examples/**`, `tests/admin/**` |
| `ads-qa` | `w1:p6` / `w1:t4` | done | 독립 QA. 쓰기는 명시 배정한 증거/fixture 경로만 |

탭별 pane 수는 **2/2/2/1**, 사용자의 제한은 **탭당 최대 2개**다. `t1`에 Claude를 세 번째 pane으로 추가하지 않는다. 현재 root를 강제 종료하거나 기존 탭을 재생성하지 않는다. 새 Claude의 pane과 기존 root의 작업 중단 여부는 인수 시 실제 상태로 확인한다.

기존 다섯 Codex worker의 기록상 모델은 `gpt-6-astra`, reasoning은 `xhigh`; 미디어 담당은 실제 `Grok 4.7 (high)`다. 이 값은 오케스트레이션 기록이며 오늘 모델을 재설정하지 않았다. 이름과 session ID를 재사용하고 동명 팀을 중복 생성하지 않는다. session ID 전체는 orchestration JSON에 있다.

```sh
herdr --session tools agent list
herdr --session tools tab list --workspace w1
herdr --session tools agent get ads-implementer
herdr --session tools agent read ads-implementer --source recent-unwrapped --lines 80
# 아래 prompt는 실제 작업 범위를 정한 뒤 사용한다.
herdr --session tools agent prompt ads-implementer 'TASK: ...'
herdr --session tools agent wait ads-implementer --timeout 45000
```

prompt 제출 성공은 작업 완료가 아니다. timeout 후 중복 제출하지 말고 get/read부터 한다. idle/done도 테스트 성공을 뜻하지 않는다. 결과 파일·diff·실행 증거를 검토한다.

### 배정 규칙과 템플릿

계약/공통 fixture/lockfile/tsconfig/배포용 asset 복사는 오케스트레이터가 조정한다. 같은 파일에 여러 worker를 동시에 배정하지 않는다. 구현자와 읽기 전용 reviewer는 분리한다.

```text
TASK <ID>
목표: 관측 가능한 결과 한 가지.
읽을 자료: C0, 해당 README, 관련 실패 증거.
소유 경로: <명시적 파일/디렉터리>.
금지 경로/행위: 다른 담당 경로, 기존 데이터, 서비스 재시작, Git commit/push.
선행 조건: <계약/API/빌드 또는 없음>.
완료 조건: 변경 파일, 실제 실행한 검사, 결과·증거 경로, 미실행 항목 보고.
공동 작업 중이다. 다른 사람의 변경을 되돌리지 말고 충돌은 보고한다.
```

영상·광고 소재가 필요하면 기존 **`grok`** 담당에게 먼저 요청한다. 이미 납품된 소재를 확인하기 전에 생성 비용을 다시 발생시키지 않는다.

## 6. 실행 환경과 Grok 소재

10월 20일 14:13 KST에 아래 네 URL이 HTTP 200으로 응답했다. 이는 접근 가능성 확인이며 오늘의 로그인·광고 재생·DB 검증은 아니다.

| 용도 | URL |
| --- | --- |
| 독립 관리자 | http://127.0.0.1:18766/ |
| Grok / Video.js | http://127.0.0.1:18766/examples/grok.html |
| Grok / Native | http://127.0.0.1:18766/examples/grok.html?mode=native |
| GnuBoard 관리자 마운트 | http://127.0.0.1:18765/ads/ |

기존 서비스는 재사용한다. PID는 오래된 문서 값만 보고 종료하지 않는다. 런타임 재구성이 필요할 때만 README와 현재 listener/process를 확인한다. 공개 document root는 `integrations/ads-manager/public/`다.

비공개 환경은 `/tmp/ads-qa-txrhuzog/`에 있다. 오늘 README, acceptance/QA-report.md, manager/config.php의 **존재만** 확인했다. 비밀번호·DSN·세션 키를 이 문서나 Git에 복사하지 않는다. 임시 디렉터리가 사라지면 별도 격리 환경을 구성하고 고객 DB에 대체 연결하지 않는다. 과거 환경은 PHP 8.5.8, MySQL 5.7.44 unix socket, GnuBoard 5.6.25였다. 오늘 DB 상태를 재검증한 것은 아니다.

현재 로컬 두 파일 및 실제 HTTP 응답의 SHA-256은 동일하다. 10월 20일 재확인 원본은 [http-bundle-check.json](http-bundle-check.json)에 있다:

```text
packages/extensions/ads/dist/cdn/ads.js
integrations/ads-manager/public/assets/ads.js
b6a7e8e4734fa37c7064d0869a51bdb9469298052631ed8ae30b90a15b88288c
79,134 bytes
```

패키지 빌드만으로 served copy가 갱신되지 않는다. 수정 후에는 담당자와 조정해 복사하고 dist·served 파일·HTTP bytes를 대조한다. 기존 해시는 수정 후 더 이상 최신 증거가 아니다.

Grok 원본은 `workspaces/ads-media/`의 4개 request 디렉터리에 총 11개 영상과 manifest로 있다. 예제는 아래 네 파일을 같은 bytes로 복사해 사용한다.

| 예제 파일 (`public/demo-media/grok-20261018/`) | 원본 | 편성 |
| --- | --- | --- |
| `content-scene-01.mp4` | `ads-content-001/segment-01.mp4` | 10초 본편 |
| `ad-coffee-6s.mp4` | `ads-preroll-a-001/video.mp4` | 프리롤 1·포스트롤, 스킵 불가 |
| `ad-earbuds-12s.mp4` | `ads-preroll-b-001/video.mp4` | 프리롤 2, 3초 후 스킵 |
| `ad-water-8s.mp4` | `ads-midroll-c-001/video.mp4` | 본편 5초 미드롤, 3초 후 스킵 |

본편은 8개 세그먼트 중 첫 장면이며 80초 연결본이 아니다. 네 예제 파일의 1080p H.264/AAC, manifest hash, ffprobe, HTTP 동일 bytes와 Range 206은 10월 18일 확인했다. 생성 출처는 Grok 담당과 manifest의 보고이며 root가 provider 생성을 실행하거나 직접 수락 결과를 확인한 것은 아니다.

`public/demo-media/`, 생성 player assets와 dist는 기존 ignore 대상이다. 새 checkout의 예제에는 빌드/복사가 필요하다. `workspaces/ads-grok-demo-20261018/schedule.json`을 같은 bytes의 `schedule.json.js`로 복사하는 이유는 개발 router가 `.json` 정적 응답을 허용하지 않기 때문이다. 내용은 JavaScript가 아니라 `fetch().json()`으로 읽는 raw JSON이다.

## 7. 증거와 검증 경계

다음은 **10월 18일까지의 결과**다. 10월 20일 다시 실행한 검사는 별도 [publication-checks.md](publication-checks.md)를 따른다.

| 층 | 기록된 결과 | 근거/범위 |
| --- | --- | --- |
| 광고 단위 검사 | 최종 150/150 | UX1 `ads-tests-150.log`; 마지막 lifecycle 수정 후 실행 |
| 빌드·타입·lint | 최종 변경 검사 통과 | UX1 `build-b6a7e8.log`, `typecheck-b6a7e8.log`, `lint-b6a7e8.log`; 일부 Vite+ 캐시 |
| 관리자 검사 | 59/59, PHP lint, workspace 11/11 | 마지막 HTML lifecycle 수정 전 같은 UX1 작업에서 실행 |
| 독립 소스 리뷰 | SOURCE READY | [source-review-final.txt](../ads-ux-20261018/source-review-final.txt). 실행·배포 승인과 구분 |
| 최신 번들 브라우저 | 취소 콜백 제거 뒤 추가 fetch 0, 연속 프리롤→본편 | `browser-cancel-remove-final.json`, `browser-pod-b6a7e8.json` |
| 넓은 UX 흐름 | 언어, 390/320px, 이미지 pause, 키보드 일부, seek, postroll/Replay, 관리자 preview | [UX1 보고서](../ads-ux-20261018/review.md)의 번들별 증거. 전 항목을 마지막 번들에서 다시 실행한 것은 아님 |
| Grok 실제 재생 | 두 모드 pre/mid/post, 최종 ended, 오류 없음, API 요청 0 | [G1 보고서](../ads-grok-demo-20261018/README.md), browser-videojs/native.json |
| 반경 | 0/16px 적용과 광고 시간 보존 | G1 `radius-browser.json`, `radius-ad-browser.json` |
| 이전 통합 | MySQL 70, HTTP 110, 독립 HTTP 55, GnuBoard HTTP 32 및 key 5; UI→DB→통계/CSV | [ads-validation.md](../../.agents/plans/ads-validation.md), private QA 자료. 최신 UX 번들 전체 행렬 재검증 아님 |

`*.log`는 기본 Git ignore 대상이라 위 과거 로그가 로컬에만 있을 수 있다. 다른 기계로 옮겼다면 실제 존재를 확인하고 누락을 명시한다. 보고서가 있다고 원본 실행 로그도 내려받았다고 가정하지 않는다.

반드시 유지할 구분:

- [QA scenarios.md](../ads-ux-20261018/qa/scenarios.md)의 16개 NOT_RUN은 준비 당시 원본이다. root 실행 결과는 별도 보고서다. 전체 16개 PASS로 바꾸지 않는다.
- V07 CTA 소멸 포커스 분기, V08 모든 Tab/Shift+Tab/Space/Enter/영역 밖 키 조합, V13 실제 autoplay 거부·미확정 길이 UI는 일부 단위 검사 또는 미실행 경계다.
- 일반 `vp lint`는 `examples/**`를 제외한다. G1 `lint.log`의 “No files found”는 통과가 아니다. 직접 Oxlint/DOM 검사에 대한 worker 보고와 root 실제 브라우저 증거를 분리한다.
- Safari/iOS/Android 실기기, native video-only fullscreen, 실제 음향·장시간 background/stall은 검증 완료가 아니다.
- 최신 번들에서 전체 GnuBoard/DB/HLS 행렬을 다시 실행하지 않았다. 과거 결과의 날짜와 번들을 유지한다.
- Grok preview의 수집 요청 0은 기대 동작이다. DB 저장 성공의 증거가 아니다.

과거 Ego TaskSpace 57/63/67은 종료됐고 남긴 탭은 사용자에게 인계됐다. 종료된 space를 재사용하거나 탭을 자동으로 되찾지 않는다. 브라우저가 필요하면 로컬 `/Users/brian/.agents/skills/ego-browser/SKILL.md`와 현재 `ego-browser skill`을 읽고 새 목표에 맞는 TaskSpace를 사용한다. 브라우저 조작 주체는 한 명으로 정한다.

## 8. 검사 명령

저장소 루트에서 실행한다. 알려진 실행 환경은 Node 24.14.0 + pnpm 12.6.0이며 저장소는 pnpm만 사용한다. 실제 manifest가 바뀌면 현재 설정을 우선한다.

```sh
mise exec node@24.14.0 -- corepack pnpm@12.6.0 -F @videojs/ads test
mise exec node@24.14.0 -- corepack pnpm@12.6.0 exec vp run @videojs/ads#build
mise exec node@24.14.0 -- corepack pnpm@12.6.0 typecheck
mise exec node@24.14.0 -- corepack pnpm@12.6.0 exec vp test run --config integrations/ads-manager/tests/admin/vite.config.ts
php -l integrations/ads-manager/admin/index.php
mise exec node@24.14.0 -- corepack pnpm@12.6.0 check:workspace
git diff --check
```

광고 패키지에는 literal `build` script가 없고 Vite+ task를 사용한다. 타입 변경 시 build 후 typecheck한다. 문서 인수만을 위해 전체 검사를 재실행할 필요는 없지만 구현 변경·커밋 검증에는 영향 범위에 맞게 실행한다. 검사 실패를 숨기거나 확인하지 않은 결과를 과거 성공으로 대체하지 않는다.

PHP/HTTP 격리 테스트는 관리자 README의 명령과 실제 스크립트를 먼저 읽는다. MySQL 옵션은 private fixture와 새 test table prefix를 쓰며 고객 데이터베이스를 대상으로 실행하지 않는다. 기존 18765/18766 서버를 테스트 편의상 교체하지 않는다.

## 9. Claude의 첫 작업 순서

1. cwd, `AGENTS.md`, Git 상태/branch/최근 커밋을 확인한다. 작성 전 기준 HEAD는 `2d40a220e9608c027e9800e6ff60e5a31cedd451`; `../v10`은 `9cb7abec09e6f22cfe95a21b51e5608f0063530f`이고 당시 clean이었다.
2. C0, 최신 UX1/G1 보고서를 읽고 현재 코드와 차이를 확인한다. takeoff 뒤의 commit/push 결과도 Git에서 확인한다.
3. Herdr 환경 확인 후 기존 여섯 담당과 tab별 pane 수를 조회한다. 다른 root가 작업 중이면 동시에 같은 파일을 수정하지 않도록 인수 상태를 맞춘다.
4. 필요하면 `ads-source-analyst`에게 **읽기 전용 인수 리뷰**를 배정한다. 목표는 C0 대비 현재 소스 차이, 이미 해결된 항목, 남은 결함을 구분하는 것이다.
5. `ads-qa`에게는 우선 **증거 목록 점검**을 배정할 수 있다. 준비/실행/미실행, 번들·날짜, 실제 브라우저/HTTP/DB 경계를 표로 정리한다. 이 배정만으로 서버·DB 변경이나 전체 브라우저 실행을 허용하지 않는다.
6. 남은 결함이나 사용자의 다음 목표가 정해지면 담당 경로·완료 조건을 배정한다. 구현→독립 소스 리뷰→영향 범위 실행 검증→오케스트레이터 인수 순으로 마무리한다.
7. 재검증한다면 미완료 키보드/CTA/blocked UI, 최신 번들 host/API 흐름 중 실제 영향이 있는 항목부터 선택한다. 미실행 플랫폼 전체를 자동으로 확장하거나 이미 완료된 기능을 재구현하지 않는다.
8. 새 결과는 별도 날짜의 evidence 디렉터리에 기록한다. 기존 실패/negative/NOT_RUN 원본과 다른 worker의 변경을 보존한다.

### 인수 완료 조건

- 현재 Git 보존 상태, 실행 URL, 기존 팀과 소유 경로를 확인했다.
- 사용자 결정과 미지원 기능을 구분했다.
- 다음 작업 한 가지의 담당자·검증 기준을 정했거나, 추가 기능 요청 없이 현재 상태 인수만 완료했음을 보고했다.
- 보고는 변경 내용, 실제 검사, 미실행 항목, 남은 결정 순서로 간결하게 한다. “테스트하지 않은 것은 완료로 쓰지 말 것.”

## 10. Claude 시작 프롬프트

```text
이 저장소의 광고 플러그인 작업을 이어받는 오케스트레이터로 행동하세요.
cwd: /Users/brian/works/tools/videojs/video.js
먼저 workspaces/ads-takeoff-20261020/CLAUDE-ORCHESTRATOR-TAKEOFF.md와 AGENTS.md를 읽으세요.

현재 작업 트리와 Git commit/push 결과를 확인하고, Herdr tools 세션의 기존 여섯 담당을
재사용하세요. 탭당 최대 두 pane을 유지하며 기존 root/서비스/사용자 탭을 강제 종료하지 마세요.
이미 합의된 C0 범위를 다시 인터뷰하거나 완료 기능을 처음부터 구현하지 마세요.

첫 단계는 현재 코드와 UX1/Grok 증거의 읽기 전용 인수 점검입니다.
그 결과로 다음 작업의 담당 경로와 완료 조건을 정하고, 구현 결과를 독립 리뷰와 실제 실행
증거로 확인하세요. 영상 소재는 기존 grok 에이전트에게 요청하세요.
과거 테스트 결과, 오늘 확인한 결과, 아직 실행하지 않은 검증을 분리해서 보고하세요.
고객 배포나 운영 DB 변경은 별도 요청 없이 진행하지 마세요.
```
