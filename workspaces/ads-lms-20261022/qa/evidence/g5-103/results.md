# qa-103 솔애드 그누보드 배포본 1.0.3 실설치 (2026-11-03, ads-qa)

- 환경: 보관한 깨끗한 그누보드(5.6.34, basic 테마, `g5-clean/snapshot`)로 되돌린 뒤 시작. 자체 mysqld 5.7(socket 전용), `php -S 127.0.0.1:18840`. 화면은 ego-browser만 썼다.
- zip: `integrations/ads-manager/dist/solad-gnuboard-1.0.3.zip` 45,860,231 bytes.
- 모바일 390은 그누보드가 세션에 PC/모바일을 기억하므로 `/?device=mobile`로 바꾼 뒤 찍었다(모바일 스킨 `mobile/skin/board/*_light` 로드 확인).

| 단계 | 결과 | 근거 |
| --- | --- | --- |
| 1 업로드(README만) | 통과 | upload 안 파일 복사, 덮어쓴 파일 없음. skin·mobile에 solad_video_light·solad_request_light 있음. |
| 2 setup.php 점검 | 통과 | 14항목 모두 "확인"(밝은 테마 스킨 2개 포함). 체크 2개 기본 체크. |
| 3 [설치하기] | **부분 실패** | 게시판·메뉴는 만듦. "예제 넣기: 필요 입력값을 확인해 주세요."(Q103-01). 예제 글은 생겼고 예제 광고·편성은 없음. |
| 4 게시판·스킨·메뉴·용량 | 부분 통과 | video·adreq 그룹 community, PC·모바일 스킨 `*_light`, 업로드 67108864(64MB). adreq 분류 7개·비밀글 항상(2). 메뉴 2개 중 광고 요청 링크가 `/bbs/adreq.php`(404, Q103-02). |
| 5 프리롤·본편 | 통과(우회) | 예제 광고가 없어 관리자 API로 같은 내용(`/ads/demo-media/ad.mp4`, video 게시판 프리롤)을 만들어 게시한 뒤 확인. 1280·390 모두 "광고 1/1" 3초 → 본편 content.mp4 재생. 이벤트 start·complete 기록. |
| 6 목록·보기·쓰기 캡처 | 통과(결함 1) | 1280·390, 동영상·광고 요청 각 3화면. 스킨 안 저대비 글자 0건, 가로 넘침 0건. 390 동영상 스킨 좌우 여백 0(Q103-03). |
| 7 다시 누르기 | 부분 실패 | [게시판 만들기] 다시: 게시판 그대로, 광고 요청 메뉴가 하나 더 생김(Q103-02). [예제 넣기] 다시: 글·광고·편성 중복 없음(광고는 우회 소재가 같은 주소라 "이미 있어요", alt 버그 재확인은 가려짐). [DB 갱신]: 변화 없음. [설치하기]는 설치 뒤 화면에 없어 다시 누를 수 없었다. |
| 8 소재 주소 안내 | 통과 | 하우스 광고 소재 URL placeholder `https://… 또는 /data/media/…`. docs/install.html 버전 표기도 1.0.3. |

## 결함

- **Q103-01 (높음) 예제 광고·편성이 만들어지지 않음.** `ads/setup.php:448`이 `Creatives::save(['alt' => null, …])`를 부르는데 `Value::text()`(`src/Support.php`)가 문자열이 아니면 `입력값을 확인해 주세요.`로 막는다. 결과 화면 "예제 넣기 필요", README 4단계("프리롤 광고가 먼저 나오면 끝")가 그대로는 안 된다. [예제 넣기]를 다시 눌러도 같은 오류.
- **Q103-02 (높음) 광고 요청 메뉴 링크가 `/bbs/adreq.php`(404).** 같은 요청에서 video를 만든 뒤 `get_pretty_url()`가 `get_board_names()`의 static 캐시로 게시판 목록을 들고 있어, 뒤에 만든 adreq를 게시판으로 모르고 폴더 주소로 만든다(`ads/setup.php:335`). [게시판 만들기]를 다시 누르면 맞는 링크로 "광고 요청" 메뉴가 하나 더 생겨 메뉴가 3개(광고 요청 2개, 하나는 404)가 된다(`1280-menu-after-rerun.png`).
- **Q103-03 (중) 390에서 solad_video_light 좌우 여백 0.** 목록·보기·쓰기에서 `article#sv_view.sv-watch`, `h2.sv-watch-title`, `div.sv-source`, `form.sv-search` 등이 화면 왼쪽·오른쪽 끝(L0 R0)에 붙는다. basic 모바일 `#wrapper` padding 0px. 같은 조건의 solad_request_light와 basic free 게시판은 붙는 요소 0개.
- **Q103-04 (낮음) 완료 화면 [예제 글 보기] 링크 이중 이스케이프.** href가 `board.php?bo_table=video&amp;wr_id=1`라 글이 아니라 목록이 열린다. `get_pretty_url()`이 이미 `&amp;`를 넣은 값을 `solad_setup_h()`로 한 번 더 이스케이프(`ads/setup.php:659`).

## 깨진 곳 검사(글자색·배경색)

- 스킨 영역: 1280·390 모든 화면에서 대비 3 미만 글자 0건, 어두운 칸 없음(동영상 썸네일 `a.sv-thumb` 검정 배경 제외). Q102-01(흰 제목)은 고쳐짐: `h2.sv-watch-title` 검정 글자.
- 그누보드 basic 테마 자체: `#hd`·`#ft` 배경 rgb(33,32,32), `#ft_copy` 글자 rgb(91,91,91) 대비 2.39, `a#ol_after_logout` rgb(160,160,161)/흰 배경 2.61. 솔애드와 무관.
- 목록 큰 카드 썸네일이 비어 회색(예제 글은 주소 형식이고 커버 이미지를 만들지 않음). 결함 아님, 참고.

## 하지 않은 것

- 설치 뒤 [설치하기] 다시 누르기(버튼 없음).
- Q103-01이 고쳐진 상태의 예제 광고 자동 생성과 그 재실행 중복 확인(우회 소재가 같은 주소라 가려짐).
- solad_video(어두운) 스킨의 390 여백, 로그아웃 상태 화면, nginx·httpd.

## 캡처(이 폴더)

2-setup-check.png, 2-setup-done.png, 1280-·390-{video-list, video-view, video-view-preroll, video-view-content, video-write, adreq-list, adreq-view, adreq-write}.png, 1280-menu-after-rerun.png, 1280-admin-house-placeholder.png. 검사 값은 1280-scan.json, 1280-scan-view.json, 390-scan.json.
