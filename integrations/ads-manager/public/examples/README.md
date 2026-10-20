# 광고 연동 예제 실행

[광고 관리자](../../README.md)를 설치한 뒤 같은 출처에서 예제를 여세요. `player.html`은 기본 `<video>`에 컨트롤러를 연결하고, `videojs.html`은 Video.js와 `<media-ads>` 요소를 연결합니다.

## 브라우저 파일 준비

저장소 루트에서 광고 패키지를 빌드하세요.

```sh
pnpm exec vp run @videojs/ads#build
mkdir -p integrations/ads-manager/public/assets
cp packages/extensions/ads/dist/cdn/ads.js integrations/ads-manager/public/assets/ads.js
```

Video.js 예제에는 CDN 빌드 파일도 필요합니다. 의존하는 청크와 UI·미디어 모듈을 함께 복사하세요.

```sh
pnpm exec vp run @videojs/cdn#build:cdn
mkdir -p integrations/ads-manager/public/assets/videojs
rsync -a --exclude=src --exclude=scripts --exclude=node_modules --include='*/' --include='*.js' --include='*.css' --exclude='*' packages/cdn/ integrations/ads-manager/public/assets/videojs/
```

이 복사 경로는 로컬 실행용 생성물이며 Git에 포함하지 않습니다. 관리자 설정의 `playerModuleUrl`도 이 광고 번들을 가리키게 설정하세요.

## 편성을 게시하고 재생

1. 관리자에서 광고 파일을 업로드하거나 실제 소재 URL을 등록하세요.
2. 사이트 기본 편성에 광고를 넣고 **초안 저장 → 저장한 초안 게시**를 누르세요.
3. 독립 설치에서는 관리자에서 본편의 고정 영상 ID와 게시판·분류 문맥을 등록하세요. 그누보드에서는 실제 게시물의 `게시판:글번호:main`을 사용하세요.
4. `public/demo-media/content.mp4`에 본편을 준비하거나, 예제 URL의 `content` 매개변수에 같은 출처의 본편 URL을 지정하세요. 이 예제의 SPF HLS 미디어에는 코덱을 선언한 상위 재생목록(`content-master.m3u8`), fMP4 미디어 재생목록, 초기화 MP4와 세그먼트가 필요합니다. 직접 미디어 재생목록과 MPEG-TS HLS는 이 예제의 지원 범위에 포함되지 않습니다.
5. HTTP 서버에서 다음 경로를 여세요. `file://`로 직접 열지 마세요.

| 경로 | 연동 방식 |
| --- | --- |
| `examples/player.html?video=video-1` | 기본 MP4와 `createAdsController` |
| `examples/videojs.html?video=video-1&media=mp4` | Video.js와 HTML 광고 요소 |
| `examples/videojs.html?video=video-1&media=hls` | SPF HLS 미디어와 HTML 광고 요소 |
| `examples/videojs.html?video=video-1&media=hls&engine=hlsjs` | 기존 hls.js 미디어와 HTML 광고 요소 |

예제는 본편 URL을 절대 URL로 정규화해 HLS 하위 재생목록도 같은 기준으로 해석합니다.

`video`는 편성·통계에 사용하는 고정 영상 ID입니다. 본편 URL과 구분하세요. 그누보드에서는 호스트가 확인한 `게시판:글번호:영상키`를 사용하세요.

이 예제는 실제 수집 API로 이벤트를 전송합니다. 통계를 남기지 않고 확인하려면 관리자의 **실제 플레이어 미리보기**를 사용하세요. 예제에서 영상이 재생됐다는 사실만으로 저장·집계 성공을 판단하지 말고 관리자 통계와 API 응답을 함께 확인하세요.

두 예제는 `example.js`·`example.css`를 공유합니다. 페이지 상태 표시는 관리자의 `assets/admin/preview.js`와 `model.js`를 사용하므로 예제를 별도로 복사할 때도 이 파일들을 함께 제공하세요. 별도 프레임워크나 페이지 빌드는 필요하지 않습니다.

플레이어·미디어 전환 링크는 `video`, `content`와 나머지 쿼리를 유지하며 선택한 `media` 또는 `engine`만 바꿉니다. 명시한 `content` 주소를 MP4/HLS 전환에 맞춰 자동 변환하지 않습니다. 기본 video의 HLS 지원은 브라우저에 따라 다르며, HLS 엔진 비교에는 Video.js 페이지를 사용하세요.

화면의 재생 기록은 현재 페이지에서 관측한 최근 20개 광고 이벤트와 본편 복귀입니다. 로딩·재생 대기와 실제 광고 시작을 구분하며, 오류 안내는 본편이 재개되어도 남습니다. 이 기록은 서버 수집 성공을 보증하지 않습니다.

## Grok Imagine 예제

`examples/grok.html`은 Video.js, `examples/grok.html?mode=native`는 브라우저 기본 video를 사용합니다. 본편은 Grok 납품물의 **10초짜리 독립 해안 도시 장면**입니다. 80초 전체 연결 영상이 아닙니다.

두 모드는 `public/demo-media/grok-20261018/content-scene-01.mp4`와 같은 디렉터리의 `schedule.json.js`를 읽습니다. `.json.js` 파일은 실행할 스크립트가 아닌 raw JSON 편성입니다. 본편·광고 파일과 JSON은 별도로 제공되어야 하며, 페이지가 대체 소재나 편성을 만들지 않습니다. 고정 영상 ID는 `grok-demo-scene-01`입니다.

편성은 프리롤 A(6초, 스킵 불가) → B(12초, 3초 후 스킵), 본편 5초의 미드롤 C(8초, 3초 후 스킵), 포스트롤 A(6초, 스킵 불가)입니다. 실제 완료는 영상 재생 이벤트로 판정합니다.

운영 통계를 수집하지 않습니다. 기본 video는 `preview: true`로 연결하며, HTML 광고 요소는 추적 정보가 없는 raw 편성을 읽습니다. 기존 `example.css`와 `observePlayback`을 사용하고, 페이지 복원 시 다시 로드하여 새 세션을 시작합니다. 재생·전체화면·포커스는 기존 플레이어와 광고 모듈의 동작을 따릅니다.
