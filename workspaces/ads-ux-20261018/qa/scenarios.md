# UX0-QA 독립 인수 시나리오

2026-10-18. **아래 브라우저 시나리오는 모두 NOT_RUN**. 실행 주체는 root, Ego TaskSpace63이다. QA는 별도 브라우저·Playwright·서버·DB 작업을 실행하지 않았다. 사전 HTTP/파서 검증은 `http-parser-evidence.json`, 미디어 및 자산 검증은 `media-http-evidence.json`과 구분한다.

확정 요구: 전체 프레임 소재와 겹쳐진 조작부, 모바일 겹침/넘침 방지, 현재 스킨 토큰/스타일 훅, 실제 관측 시간, KO/EN·동적 문구, 상태 메시지, 포커스 복원, 컨테이너 전체화면, 광고 seek 차단, 기존 취소/통계 의미 보존. 근거: `.agents/plans/ads-ux-parity.md`의 이번 구현 계약 1–7.

입력 정책: C0의 스킵은 `null` 또는 정수 1–3600이다. 원 요청 image/post skip0은 **입력 검증 negative**이며 0초 UI 성공 기준이 아니다. 별도 승인 valid만 image/post skip1을 사용한다. 첫 광고는 기존 36초 영상/skip3이다. valid 프리롤 이미지의 8초 표시 시간은 QA 관찰용 기본값이다. mid10 이미지3초/non-skip, post 이미지3초/skip1은 고정 입력이다.

| ID | 경로·절차 | PASS 기준 / FAIL 신호 | 증거 |
|---|---|---|---|
| N01 | requested 페이지, Video.js 및 native 각각 Play | HTML `schedule_unavailable` 또는 native `invalid_schedule` 진단 후 본편 진행. 광고 시작·추적 없음. 전체 입력의 일부만 실행하거나 스킵0을 수락하면 FAIL | 진단, 본편 time, network |
| V01 | valid, 새 페이지, 사용자 Play/기존 컨트롤 진입 | 재생 전 광고 자동 실행 없음. 본편이 정지하고 프리롤 영상 실제 프레임·시간 진행. 첫 광고/총2 표기가 맞음 | bundle hash, source/time, 화면 |
| V02 | 첫 광고 재생 3초 전에 pause하여 2초 대기, resume 후 실제 광고시간 3초 경과 | 정지 동안 광고시간/skip 상태 불변. 실제 3초 전 스킵 불가, 이후 가능. wall clock만으로 가능해지면 FAIL | 두 시점 시간/버튼 상태 |
| V03 | 첫 광고 Skip, 다음 PNG에서 pause 2초 → resume | 현재 영상만 끝나고 PNG 시작. PNG 경과/skip이 새로 시작하고 1초 후 스킵. 이미지 pause 중 elapsed/total·남은 시간·본편 시간 유지. 자동 다음 전환 없음 | 순서, 로컬 start/skip, timer |
| V04 | PNG를 자연 완료시켜 본편 재생 → 10초 통과 | 본편을 멈추고 이미지 3초, skip 비노출/비초점. 실제 관측 3초 후 본편 복귀. 중복 mid 없음 | content/ad 이벤트와 UI |
| V05 | 별도 새 세션: pre 소비 후 본편 5→15 seek, 다시5→15 | 첫 crossing에 mid10 한 번만 실행, 이전 소비 구간 반복 없음. 광고 중 seek 키/기존 timeline이 광고/본편을 이동시키지 않음 | contentTime와 break 이벤트 |
| V06 | mid 소비 후 본편 자연 ended 또는 실제 끝으로 seek | post 이미지3초, 1초 이후 skip 가능. 자연완료/skip 각각 별도 새 페이지로 확인. post 종료 후 본편 ended 유지·재시작 없음 | post 이벤트, final media state |
| V07 | 외부 보조 Play 대신 **플레이어 내부 컨트롤**에 focus 후 시작. CTA 또는 skip에 focus한 채 pod 전환 | 첫 영상에 CTA, 다음 PNG에는 없음. 숨겨진 CTA/skip에 focus 잔류 없음, 실제 visible control로 이동. 전체 광고 종료 후 기존 본편 컨트롤로 복귀 | deep activeElement 경로, Tab 순서 |
| V08 | 광고 영역 안 Tab/Shift+Tab, Space/Enter, 미디어 단축키; 영역 밖 Space도 확인 | visible 컨트롤만 순회, 작동하는 accessible name, focus 표시. pause/resume 및 음소거 실행. 광고 seek 금지, 영역 밖 키를 광고가 가로채지 않음 | focus·keydown 전후 상태 |
| V09 | Video.js fullscreen을 본편 Play **이전**에 진입. 광고 중 진입/종료도 별도 수행 | fullscreen container 안 광고 소재/조작부 모두 보임. Escape 후 레이아웃/정지 상태 정상. 지원 없는 환경은 해당 동작 비노출 | fullscreenElement, 경계/화면 |
| V10 | desktop, 390px, 320px viewport에서 영상·PNG 각각 확인 | 소재 박스가 전체 프레임, object-fit contain. 조작부가 소재 높이를 빼앗지 않음. 버튼/시간/순서/CTA 겹침·잘림·프레임 밖 배치 없음. body horizontalOverflow=false | before-mobile 대비 화면, player/creative/control rect, fixture geometry |
| V11 | 기본 ko → 광고 재생 중 EN 전환 → KO 복귀 | 실제 문구/accessible name/시간 표기 변경, 번역이 불완전하게 섞이지 않음. 새 편성 요청·start/attempt 생성·elapsed 리셋 없음 | network, attemptId/time, 화면 |
| V12 | 최종 API 반영 후 root가 HTML label 속성/native `updateUI`로 늦은 문구 변경 | skip-label/skip-countdown-label/timer-label/media-alt와 해당 accessible text 반영. 타이머/광고 상태 유지, 편성 재요청 없음 | 변경 전후 속성·문구·network |
| V13 | 로딩/사용자 pause/재생 거부 상태가 실제로 관측된 경우에만 판정 | 상태 메시지가 readyState와 실제 paused/play 결과와 일치. 미확정 영상 길이를 0초 총길이로 표시하지 않음 | 실측 상태·거부 name/message. 관측 못 하면 NOT_RUN |
| V14 | valid native preview 모드 전체 pre/mid/post | 실제 native `<video>` + original createAdsController, preview:true. autoplay 없음. local 이벤트는 발생하되 manager/collector 네트워크 0 | DOM, 이벤트, network |
| V15 | 두 모드 전 구간에서 network 및 session 확인 | raw JSON에는 tracking/envelope 없음. schedule API·collector 호출 0. 성공 이벤트/DB 저장을 이 fixture에서 주장하지 않음 | request 목록, JSON |

공통 기록: URL/mode/videoId, 실제 로드한 번들 SHA, viewport, 기대/실제 결과, 화면, 이벤트·네트워크·focus를 남긴다. 실패는 setup/입력/제품/브라우저 경계를 나누고 최초 증거를 보존한다. 최소 관측값을 버튼 클릭 성공만으로 대체하지 않는다.

라벨 API는 root 통보 기준 `ui:{locale?,labels?}`, `controller.updateUI(ui)`, HTML `lang`과 v10 문구 속성이 구현 예정이다. fixture에는 기본 ko만 설정했다. `window.uxReview.ads` / `.controller`로 실제 객체에 접근할 수 있으나 **현재 번들의 지원 여부와 최종 값 형태를 root가 확인한 뒤** V11/V12를 실행한다. fixture가 광고를 재생성해 문구 변경을 흉내내지 않는다.

범위 밖/미실행: 실기기 Safari/iOS/Android, native video-only fullscreen(컨테이너 overlay와 별개), PiP/Cast, 실제 음향(소스에 audio stream 없음), 장시간 백그라운드/네트워크 stall, production tracking/DB/G5. 기존 Q1 결과는 UX 변경 후 통과 증거로 재사용하지 않는다.
