# UX0-QA fixture 인계

두 독립 입력과 standalone HTML 준비 완료. **실제 브라우저 UI 검증은 NOT_RUN**이며 root의 TaskSpace63에서 수행한다. 제품 코드/테스트, 기존 미디어, 서버18766, DB, `../v10`, `workspaces/ads-media`는 변경하지 않았다.

| 입력 | 실제 로컬 HTTP URL | videoId / 의미 |
|---|---|---|
| Valid · Video.js | http://127.0.0.1:18766/demo-media/ux-review-valid-20261018.html?mode=videojs | `ux-review-valid-20261018`, 별도 승인 skip1 |
| Valid · native preview | http://127.0.0.1:18766/demo-media/ux-review-valid-20261018.html?mode=native | 같은 valid 입력, `preview:true` |
| Negative · Video.js | http://127.0.0.1:18766/demo-media/ux-review-requested-20261018.html?mode=videojs | `ux-review-20261018`, 원 요청 skip0 거부 |
| Negative · native preview | http://127.0.0.1:18766/demo-media/ux-review-requested-20261018.html?mode=native | 같은 negative 입력, `preview:true` |

두 페이지는 실제 `/assets/ads.js`와 Video.js `/assets/videojs/video.js`·`video.css`를 사용한다. Video.js 모드는 `video-player` / `video-skin` / `media-ads`, native 모드는 original `createAdsController`다. 프레임워크나 대체 광고 컨트롤을 추가하지 않았다. 직접 사용자 Play 또는 기존 컨트롤로 진입한다. 기본 `lang=ko`; native는 `ui:{locale:'ko'}`를 전달한다. 아직 UI 옵션을 지원하지 않는 기존 번들에서는 한국어 광고 문구를 주장하지 않는다.

원본 `.json` 두 개는 이 QA 디렉터리에 있다. 기존 PHP router가 정적 `.json`을 허용하지 않아 HTTP에는 동일 바이트를 `ux-review-*.json.js`로 제공한다. **JSON 데이터이며 script import 대상이 아니다.** Node의 실제 `fetch().json()`과 현재 빌드된 제품 파서로 확인했다. 서버 설정/라우터는 바꾸지 않았다.

편성은 pre 영상36초/skip3 → 이미지8초/skip1, mid10 이미지3초/non-skip, post 이미지3초/skip1이다. negative만 두 이미지 skip0을 보존한다. pre 이미지8초는 pause·focus 관찰 시간을 확보한 fixture 기본값이다. 첫 광고와 본편은 검증된 기존 `content.mp4`를 각각 참조한다. 3초인 `ad.mp4`는 skip3을 충분히 관찰할 수 없어 쓰지 않았다. PNG는 기존 `ad.png`다. 원본 복제·재인코딩도 하지 않았다. 첫 광고만 로컬 QA 링크 CTA를 가진다.

실행된 검증:

- `ffprobe`: content MP4 H.264/yuv420p 640×360/36초, ad MP4 320×180/3초, PNG 480×270. 영상은 audio stream 없음.
- 기존 미디어 3개와 번들/CSS 3개의 HTTP200·로컬 바이트 일치. content Range 0–1023은 HTTP206.
- 생성 HTML2/JSON2의 HTTP200·QA 원본 바이트 일치. JSON 응답이 `application/javascript`여도 실제 `Response.json()` 성공.
- 현재 빌드 파서: valid 수락, requested 첫 image skip0 거부, 격리한 post skip0도 거부. negative PASS는 **거부가 기대대로라는 뜻이며 0초 스킵 UI PASS가 아니다**.
- inline module 문법만 정적으로 검사. 사용자 브라우저 실행·디코딩·키보드·fullscreen·타이머·UI 언어 검증은 수행하지 않았다.

증거: `media-http-evidence.json`, `http-parser-evidence.json`, `syntax-evidence.json`. 준비 시 served ads.js SHA256은 `10812294dc033576dc3c03c5015b1200e7b5e16d691f21f62cf55a4b93373e08` (59,843 bytes). 이 값은 UX 변경 전 기준이며 root는 새 번들 배포 후 실제 로드값을 별도 기록해야 한다. 페이지는 ads.js에 방문 시각 query를 붙여 새 페이지에서 현재 served bundle을 읽는다.

페이지의 크기 output과 `window.uxReview.snapshot()`은 body/client/scroll/player 크기 및 실제 관측값을 제공한다. `window.uxReview.media`, `.ads`, `.controller`는 원본 객체다. 광고 타이머·seek·skip·focus를 보조 코드가 수정하지 않는다. 상세 `<details>`는 기본 접힘이고 가로 overflow를 CSS로 숨기지 않았다. iframe도 없다.

`scenarios.md`가 root 실행용 PASS/FAIL 기준이다. 기존 Q1 환경 `/tmp/ads-qa-txrhuzog/acceptance/QA-report.md`는 과거 증거로만 읽었으며 새 UX 성공으로 합산하지 않았다. API/DB 및 G5 통계 증거는 이 무추적 fixture의 범위가 아니다.

재현 도구는 이 디렉터리의 `prepare-fixtures.py`, `inspect-fixtures.py`, `verify-http-parser.mjs`다. 모두 기존 파일을 덮어쓰지 않도록 exclusive 생성한다. 이미 생성된 파일이 있으므로 무조건 재실행하지 않는다. 추가 검증 시 기존 evidence를 지우지 말고 새 출력 이름을 사용한다.
