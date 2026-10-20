# 광고 UI/UX 구현 검증

2026-10-18. 오케스트레이터가 Ego TaskSpace 63에서 실행한 로컬 검증이다. QA 담당의 fixture 사전 검증과 구분한다. `../v10`은 읽기 전용으로 검토했다.

## 범위

전체 프레임 광고 소재, Video.js 스킨과 맞는 오버레이 조작부, 한국어/영어 및 동적 문구, 실제 광고 시간, 연속 광고 포커스, 컨테이너 전체화면, 예제 페이지와 관리자 미리보기 상태를 개선한다. 구현 계약과 v10 소스별 대응은 `.agents/plans/ads-ux-parity.md`에 있다.

원 요청 `skipAfterSeconds: 0`은 현재 C0 계약에서 지원하지 않는다. 요청 JSON을 보존했고 입력 거부 사례로 검증했다. 정상 UI 편성은 별도 승인한 `ux-review-valid-20261018`이며, 최소 1초 계약을 바꾸지 않았다.

## 실제 브라우저 관측

| 항목 | 관측 결과 | 증거 |
| --- | --- | --- |
| 원 요청 skip0 | HTML 편성 거부 진단 후 본편 재생 가능. 0초 스킵 성공을 의미하지 않음 | `browser-negative.json` |
| 모바일 영상 | 390px에서 소재와 오버레이 모두 358×201.375, 320px에서 모두 288×162. 컨트롤이 소재 높이를 차감하지 않고 가로 넘침 없음 | `browser-mobile.json`, `after-mobile-390.png`, `after-mobile-320.png` |
| 모바일 이미지 | 320px 이미지 광고에서도 전체 프레임과 조작부 표시 확인 | `browser-image-mobile.json`, `after-image-mobile-320.png` |
| 언어·문구 | KO→EN 및 카운트다운/타이머 재정의→KO 복귀. 동일 광고 시간·start 1회 유지 | `browser-locale.json` |
| 실제 스킵·연속 광고 | 첫 영상 실제 3초 이상 후 스킵, 다음 이미지 2/2 표시. 이미지 일시정지 시 2.1초 동안 타이머 유지, 포커스는 Play로 이동 | `browser-pod-image.json` |
| 키보드·음량 | K 재생/정지, M 음소거, range ArrowLeft로 1→0.95. 광고 seek 키가 본편 시간을 이동시키지 않음 | `browser-pod-image.json` |
| 본편 복귀 | 이미지 8초 완료 후 본편 재생 및 기존 MEDIA-PLAY-BUTTON 포커스 복귀 | `browser-content-return.json` |
| 미드롤·포스트롤 | 자연 10초 시점의 미드롤 스킵 비노출, 3초 완료 후 본편 복귀. 본편 35.5초로 테스트 seek 후 포스트롤 3초 자연 완료, 실제 본편 ended 유지 | `browser-mid-post.json` |
| 전체화면 | 본편 컨트롤로 전체화면 진입 후 광고 표시, 광고 버튼으로 종료 가능. Escape 미종료 결함을 별도 보존하고 수정 요청 | `after-fullscreen.png`, `browser-escape-observation.json` |
| 관리자 미리보기 | 실제 게시 편성 preview API, 광고 시작/일시정지, 중립적 진행 상태, 추적 수집 요청 0 | `browser-admin-preview.json`, `after-admin-preview.png` |
| 관리자 모바일·닫기 | 390px document overflow 없음, 모달 354px. 닫은 후 광고 제거·src 정리·원래 미리보기 버튼 포커스, 수집 요청 0 | `browser-admin-close-mobile.json`, `after-admin-preview-mobile.png` |

위 최초 UI 관측의 광고 번들은 `4ddf47d6c72afa4e444e166726a806d518ae6ea120c6e2a73f25c651bced85fe`다. 이후 수정된 번들의 재검증은 아래 최종 기록으로 구분한다. `browser-negative.json`은 UI 변경 전 번들에서 확인한 입력 거부 증거다.

## 발견과 수정 추적

- 예제 포스트롤 완료 후 전환 대기에 남음: 본편의 실제 ended를 반영하도록 수정, host 단위 회귀 검증 완료.
- BFCache 복원 후 예제 observer/controller 종료 상태 유지: persisted pageshow에서 reload, 수정 전 실패·수정 후 회귀 통과.
- 광고 일시정지와 외부 “재생 중” 문구 불일치: “진행 중”으로 수정, 관리자 실제 정지 화면 확인.
- 광고 내부 Escape 전체화면 종료 실패: 수정 후 실제 Escape 종료 및 정지 시간 보존 통과 (`browser-final-escape-paused-return.json`).
- 포스트롤 종료 후 본편의 실제 ended와 Play 버튼 Pause 표기 불일치: 상태 동기화 수정 후 Replay 표시 및 한 번 클릭으로 재생 통과 (`browser-final-seek-replay.json`). 최초 실패 상태는 `browser-mid-post.json`에 보존.
- 재생 중 편성 src/video-id만 바꿀 때 본편 버튼 Pause 잔류: 브라우저에서 재현 후 수정. 두 속성 모두 실제 paused 상태와 Play 표시 복귀 통과 (`browser-config-before-fix.json`, `browser-config-after-fix.json`). video-id 변경 사례는 원본 JSON과 ID 불일치에 따른 편성 거부가 예상된 입력이다.
- 취소 콜백 중 광고 요소 제거 후 오래된 update가 새 요청/재생 차단 리스너를 만드는 경계: 독립 소스 리뷰에서 발견 후 수정. 최종 브라우저에서 요소 제거 뒤 추가 fetch 0, Play 표시, 사용자 재생 후 본편 시간 진행을 확인했다 (`browser-cancel-remove-final.json`).

## 최종 검증

번들 `8158e3aa…`에서 Escape/일시정지 종료→Play, 탐색 5→15초 미드롤 1회, 같은 구간 재탐색 시 반복 없음, 포스트롤 자연 완료→Replay, 한 번 클릭으로 재생을 확인했다. Native `preview:true`에서도 `updateUI` KO/EN·이미지 대체텍스트 갱신, pre/mid/post 재생과 포스트롤 스킵, 최종 ended 및 수집 API 요청 0을 확인했다 (`browser-native-preview.json`).

번들 `64d90f1f…`에서는 src/video-id 변경 경계를 재검증하고, Escape·390/320px·연속 프리롤·탐색 미드롤·포스트롤 자연 완료·Replay 표시의 대표 흐름을 다시 통과했다 (`browser-final-64d90f.json`, `final-mobile-390.png`, `final-mobile-320.png`). 이 시점 root 재실행은 광고 148/148, 관리자 59/59, 패키지 빌드, 전체 타입 검사, 범위 lint, PHP lint, workspace 11/11 통과다.

예제 전환은 video/content/media/engine 쿼리를 보존했고, 실제 뒤로 가기 후 navigation type `reload`, 미디어 readyState 4와 정상 재생 대기를 확인했다 (`browser-example-navigation.json`). 두 예제의 기본 재생 준비와 모바일 가로 넘침 없음도 확인했다.

관리자 최종 모바일 화면은 긴 편성 hash 대신 영상 ID·구간 수·게시 전 미리보기를 표시한다. `browser-admin-final.json`, `final-admin-preview-mobile.png`에 실제 상태와 수집 요청 0을 기록했다.

Native/HTML 두 경로 모두 원 요청 skip0을 거부하고 본편을 계속 재생했다 (`browser-negative-both.json`). 당시 served 파일/파서 비교는 `final-http-parser.json`에 기록했다. negative PASS는 지원 불가 입력이 거부됐다는 의미다.

최종 번들은 `b6a7e8e4734fa37c7064d0869a51bdb9469298052631ed8ae30b90a15b88288c` (79,134 bytes)다. root가 실제 HTTP 응답과 dist 파일의 동일 bytes를 확인했고, valid 수락/원 요청 skip0 거부도 재확인했다 (`final-http-parser-b6a7e8.json`). 직전 번들 정보는 `bundle-before-disconnect-guard.json`에 보존했다.

최종 변경 후 root의 광고 테스트 **150/150**, 패키지 빌드, 전체 타입 검사, 변경 파일 lint가 통과했다 (`ads-tests-150.log`, `build-b6a7e8.log`, `typecheck-b6a7e8.log`, `lint-b6a7e8.log`). 빌드/전체 타입 명령의 일부 작업은 Vite+ 캐시를 사용했다. 관리자 59/59·PHP lint·workspace 11/11과 넓은 범위 lint는 앞선 같은 작업에서 실행한 결과이며, 마지막 변경은 광고 패키지 HTML lifecycle과 그 테스트뿐이다.

최종 번들 브라우저 재검증은 취소 콜백 제거 경계와 정상 연속 프리롤→본편 복귀를 대상으로 했다. 실제 이벤트가 start→skip→start→skip이고, 영상 스킵 4.138245초·이미지 스킵 2.1375초로 각 계약 시점 이후임을 확인했다 (`browser-pod-b6a7e8.json`). 독립 읽기 전용 소스 리뷰는 마지막 경계에 잔여 결함이 없는 **SOURCE READY**다 (`source-review-final.txt`). 이 판정과 root 실행 증거는 별개다.

QA의 `qa/scenarios.md`는 준비 당시 NOT_RUN 원본으로 유지한다. root의 N01, V01–V06, V09–V12, V14–V15 관측은 위 증거에 있으며, V07은 skip 전환/본편 포커스 복귀를 실행했다. CTA가 사라질 때의 포커스 분기는 단위 테스트로 검증했다. V08은 K/M/음량 range/seek 차단을 실행했으나 모든 Tab·Shift+Tab·Space·Enter·영역 밖 키 조합을 이번 변경 후 다시 실행하지 않았다. V13은 실제 pause와 재생 상태만 관측했으며 autoplay 거부·미확정 길이 표시는 단위 테스트 경계다. 따라서 16개 시나리오 전체 통과로 표기하지 않는다.

테스트 플레이어와 관리자 페이지를 사용자에게 남기고 Ego TaskSpace 63을 한 번 종료했다 (`browser-handoff.json`). 플레이어는 readyState 4, 재생 대기 상태다. Herdr `tools` 세션의 기존 에이전트는 유지하며 탭별 pane 수는 2/2/2/1이다.

## 검증 경계

데스크톱 Chromium 및 모바일 뷰포트 에뮬레이션이다. Safari/iOS/Android 실기기, native video-only fullscreen, PiP/Cast, 실제 음향, 장시간 백그라운드·네트워크 stall은 이번 검증에 포함하지 않았다. 재생 권한 차단·미확정 길이 UI는 단위 테스트 경계이며 실제 브라우저에서 해당 거부를 유도하지 않았다. DB/통계의 전체 재검증이나 배포를 수행한 기록이 아니다. 관리자 편성은 조회와 미리보기만 사용했다.
