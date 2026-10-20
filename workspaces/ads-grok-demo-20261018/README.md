# 플레이어 모서리 옵션과 Grok 예제

2026-10-18. 현재 소스 확인, 기존 Grok 에이전트의 미디어 인계, 로컬 예제 연결을 수행했다.

## 모서리 설정

별도의 `flat` 또는 `borderRadius` 로딩 옵션은 발견되지 않았다. 공개 CSS 변수 `--media-border-radius`를 스킨 또는 상위 요소에 지정한다. `0px`는 직각이며 `16px`, `1rem` 등 유효한 border-radius 값을 사용할 수 있다. JS로는 `skin.style.setProperty('--media-border-radius', '16px')`로 설정한다.

근거: `packages/skins/src/styles/vars.ts:27`, `site/src/content/docs/guides/customize-skins.mdx:24`, `packages/skins/src/styles/themes/theme.css:89`. 기본 테마 fallback은 28px이고 현재 예제의 `example.css:89`는 8px를 지정한다. 전체화면은 내부 계산값을 0으로 사용한다. 외곽 반경과 버튼의 반경은 서로 다른 스타일이다.

광고의 `overlay.styles.ts:10`은 `--ads-radius` → `--media-video-border-radius` → `--media-border-radius` 순으로 값을 따른다. 이번에는 새 설정 API나 기본 반경을 추가·변경하지 않았다.

실제 Chromium에서 0px/16px 모두 내부 media-container와 광고 panel의 computed border-radius가 일치했다. 정지한 광고의 currentTime 0.251437은 반경 변경 중 유지됐다 (`radius-browser.json`, `radius-ad-browser.json`, `radius-0px.png`, `radius-16px.png`). 페이지의 검정 wrapper 배경은 스킨 바깥에 별도로 존재하므로 외부 wrapper 자체까지 둥글게 만들려면 해당 요소에도 border-radius를 적용해야 한다.

## Grok 소재

Herdr `tools`의 기존 `grok` 에이전트에 사용 가능한 본편과 광고를 요청했고, 4개 납품 파일을 인계받았다 (`grok-delivery.txt`). 원본은 `workspaces/ads-media/`에 보존했다. Grok Imagine 생성 출처는 해당 에이전트와 manifest 기록이며, root가 생성 작업을 실행한 것은 아니다.

| 예제 파일 | 용도 | 실제 길이 |
| --- | --- | --- |
| content-scene-01.mp4 | 해안 도시 본편 | 10초 |
| ad-coffee-6s.mp4 | 첫 프리롤·포스트롤 | 6초 |
| ad-earbuds-12s.mp4 | 두 번째 프리롤, 3초 후 스킵 | 12초 |
| ad-water-8s.mp4 | 본편 5초 미드롤, 3초 후 스킵 | 8초 |

네 파일은 1920×1080, H.264/AAC다. manifest의 해시·크기와 일치하며 ffprobe 재검사, HTTP 원본 bytes 일치, Range 206을 root가 확인했다 (`media-evidence.json`, `http-evidence.json`). 본편은 8개 세그먼트 중 첫 독립 장면이며 80초 연결본이 아니다. 새 유료 생성·병합·DB 변경은 수행하지 않았다.

## 실행과 검증

- Video.js: http://127.0.0.1:18766/examples/grok.html
- Native: http://127.0.0.1:18766/examples/grok.html?mode=native

두 예제는 기존 디자인과 실제 상태 관찰기를 재사용한다. 운영 API나 수집기로 보내는 추적 정보가 없는 raw JSON을 사용하며 native는 `preview:true`다. 기존 두 예제 페이지에 Grok 예제 링크를 추가했다. `schedule.json` 원본과 HTTP용 `.json.js`는 동일 bytes이며 실제 built parser가 수락했다.

Video.js 브라우저에서는 A 자연 완료 → B 4.561318초 스킵 → 본편 → C 8초 자연 완료 → 본편 종료 → A 6초 자연 완료를 확인했다. 8개 실제 광고 이벤트와 ended/Replay, 오류 없음, API 요청 0을 기록했다 (`browser-videojs.json`). 본편 및 광고 3종 캡처를 직접 확인했다 (`content.png`, `radius-0px.png`, `earbuds.png`, `water.png`).

기본 video 모드도 프리롤 A/B, 미드롤 C, 포스트롤 A를 모두 자연 완료했다. 실제 본편은 10초 ended, 오류 없음, API 요청 0이다 (`browser-native.json`). 390px 화면은 scrollWidth 390으로 가로 넘침이 없었다 (`mobile-ready.png`). TaskSpace 67을 한 번 종료하고 Video.js Grok 예제를 readyState 4·재생 대기 상태로 남겼다 (`browser-handoff.json`).

새 예제 JS 구문 검사는 통과했다. 일반 `vp lint`는 examples 제외 설정으로 파일을 선택하지 않아 root의 `lint.log`를 통과 증거로 사용하지 않는다. 구현 에이전트의 직접 Oxlint 검사 및 stdin DOM 연결 21개 통과 보고는 `example-agent-handoff.txt`에 있으며 실제 브라우저 재생 증거와 구분한다.

검증 환경은 데스크톱 Chromium이다. 실기기·Safari·오디오 청취 품질·전체 DB/통계 재검증이나 배포는 이번 작업에 포함하지 않았다.
