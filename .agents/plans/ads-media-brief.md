# 예제 영상 제작 담당 Grok

## 연결 대상

- Herdr session: `tools`
- Workspace: `video.js` (`w1`)
- Agent name: `grok`
- Agent runtime: Grok CLI (`herdr agent start --kind grok`)
- Pane: `w1:p7`, tab: `w1:t1` (오케스트레이터 옆)
- Repository: `/Users/brian/works/tools/videojs/video.js`
- 조회: `herdr --session tools agent get grok`
- 메시지 전달: `herdr --session tools agent prompt grok '<요청 내용>'`
- 결과 확인: `herdr --session tools agent read grok --source recent-unwrapped --lines 80`

사용자는 Grok Imagine이 이 에이전트와 소통하며 필요한 영상을 만들도록 지정했다. 실제 Grok Imagine 앱 연결/생성/다운로드 여부는 각각 관측한 증거로 기록한다. 이름과 pane 등록만으로 앱 연동 또는 영상 생성을 완료했다고 쓰지 않는다.

## 담당 범위

광고 플러그인 데모용 본편과 광고 소재의 제작 요청, 프롬프트, 전달 결과, 파일 규격을 관리한다. 초기에는 이 문서와 광고 예제 안내를 읽고 준비 상태를 보고한 뒤 Grok Imagine의 구체적인 제작 요청을 기다린다. 별도 생성 요청 없이 대량 제작이나 기존 큐 재개를 시작하지 않는다.

파일 작성 소유권은 `workspaces/ads-media/**`에 한정한다. 다른 작업자가 있으므로 제품 코드, 기존 예제 미디어, 서버 설정, 다른 작업자의 파일을 덮어쓰지 않는다. 예제 페이지에 연결하거나 관리자에 등록할 때는 오케스트레이터에게 결과 경로를 전달한다. `.agents/plans/ads-*`는 오케스트레이터 소유다.

## 초기 제작 후보

아래는 Grok Imagine과 협의할 초안이며 생성 완료 목록이 아니다.

| 용도 | 초기 목표 | 검증하려는 동작 |
| --- | --- | --- |
| VOD 본편 | 16:9, 약 60–90초; 짧은 장면 여러 개로 구성 가능 | 본편 재생, 탐색, 미드롤, 본편 복귀, 종료 |
| 짧은 광고 A | 약 6초, 본편과 구분되는 장면 | 단일 프리롤, 스킵 불가 |
| 광고 B | 약 10–15초 | N초 후 스킵, 여러 광고 연속 재생 |
| 광고 C | 약 6–10초 | 미드롤, 포스트롤 |

브라우저 기본 전달 형식은 MP4(H.264, 오디오가 있으면 AAC), 16:9, 가능하면 1920×1080이다. 생성기가 지원하는 길이와 해상도를 먼저 확인하고 실제 파일 값을 기록한다. WebM, GIF, 이미지 파생물이 필요하면 원본에서 별도 파일로 만든다. 실제 브랜드나 광고 문구는 별도 요청이 없으면 가상 콘셉트를 사용한다.

## 요청·결과 기록

Grok Imagine과 주고받을 때 `requestId`, 용도(`content`, `preroll`, `midroll`, `postroll`), 프롬프트, 목표 길이/화면비, 요청 상태를 포함한다. 결과에는 실제 파일 경로 또는 다운로드 가능한 URL, 실제 길이/해상도/코덱, 생성/다운로드/재생 확인 여부를 구분해 기록한다. 불확실한 제출은 상태를 확인하고 중복 생성하지 않는다.

파일을 받으면 `workspaces/ads-media/` 아래 고유한 요청 ID 디렉터리에 보존하고 manifest에 원본/파생물과 출처를 구분한다. 초기 브리프 수신 단계에서는 빈 영상이나 성공한 것처럼 보이는 결과물을 만들지 않는다.

참조: `integrations/ads-manager/public/examples/README.md`, `.agents/plans/ads-module-plan.md`, `.agents/plans/ads-orchestration.md`.

## 2026-10-18 실제 예제 연결

사용자는 동영상·광고 예제 소재를 Grok 에이전트에 요청해 사용하도록 지시했다. 앞으로 예제용 소재를 준비할 때 이 담당 경로를 사용한다.

G1에서 기존 Grok 납품물의 경로·해시·미디어 규격을 다시 요청하여 인계받았다. 원본은 수정하지 않고 `public/demo-media/grok-20261018/`에 같은 bytes로 복사했다. 본편은 `ads-content-001/segment-01.mp4` 하나인 10초 해안 도시 장면이다. 광고는 `ads-preroll-a-001`의 커피 6초, `ads-preroll-b-001`의 이어폰 12초, `ads-midroll-c-001`의 생수 8초다. 80초 전체 본편을 연결하거나 새로 생성한 기록이 아니다.

실행 경로는 `examples/grok.html`과 `examples/grok.html?mode=native`다. 추적 정보 없는 raw JSON 및 native `preview:true`를 사용한다. 원본 manifest, Grok 인계와 root의 HTTP·브라우저 증거는 `workspaces/ads-grok-demo-20261018/`에서 구분한다. 기존 QA 미디어·편성·운영 통계는 이 예제의 소재로 대체하지 않았다.
