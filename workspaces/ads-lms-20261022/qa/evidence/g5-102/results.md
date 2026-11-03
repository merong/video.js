# qa-102 솔애드 그누보드 배포본 1.0.2 실설치 (2026-11-03, ads-qa)

- 환경: 그누보드 5.6.34(설치 마법사 기본값, 영카트 함께 설치), mysqld 5.7 자체 datadir·socket(--skip-networking), `php -S 127.0.0.1:18840`(PHP 8.5.8). 7단계만 같은 18840에서 macOS httpd 2.4.62로 바꿔 띄웠다.
- zip: `integrations/ads-manager/dist/solad-gnuboard-1.0.2.zip` 45,828,996 bytes. 화면 확인은 ego-browser만 썼다.

| 단계 | 결과 | 근거 |
| --- | --- | --- |
| 1 upload 복사 | 통과 | `upload/.` 전체를 루트에 복사. 기존 파일을 덮어쓴 것 없음. .htaccess 5개(ads/database·bin·admin·hosts·src) 포함. |
| 2 setup.php → 설치하기 | 통과 | 환경 점검 12항목 모두 "확인". 설치 뒤 "설치했어요"와 다음 할 일 3개. |
| 3 config·.htaccess | 통과 | uploadRoot = `<그누보드 루트>/data/media` 실제 경로, uploadUrl = `/data/media`. data/media/.htaccess 있음. |
| 4 /ads/ + 이미지 광고 | 통과 | /ads/ 200, "관리자 화면 파일이 없습니다" 없음. 파일 업로드로 PNG 저장 → `/data/media/6a4beb923e4864f57b1b49fbb0082581.png` 200 image/png 480×270(원본과 같은 바이트). |
| 5 빈 ads/public | 통과 | 빈 폴더를 만든 뒤에도 /ads/ 200, 관리자 화면 정상. |
| 6 solad_video 게시판 | 통과(결함 1) | 게시판 qavideo(PC·모바일 스킨 solad_video), "영상 주소"로 글 작성 → 글 보기에 video-player·solad-video-skin, 영상 readyState 4, 36초. 플레이어 아래 제목이 흰 글자에 흰 배경(Q102-01). |
| 7 httpd .htaccess | 통과 | 16진수 32자 .svg 200 + CSP·nosniff, 16진수 .png 200, logo.svg·notes.txt·16진수 .php·.htaccess 403. httpd에 mod_alias가 없으면 그누보드 자체 data/.htaccess(RedirectMatch) 때문에 data 아래 전부 500(시험 환경 설정 문제, 솔애드 원인 아님). |

## 결함

- Q102-01(중): basic 테마에서 solad_video 글 보기의 `h2.sv-watch-title`이 color #fff, 배경 body #fff라 제목이 안 보인다. 문서는 테마가 선택이고 스킨만 써도 된다고 한다. 파일 추정: `skin/board/solad_video/style.css`(어두운 테마 전제 색).
- Q102-02(낮음): 하우스 광고 "소재 URL" placeholder가 `https://… 또는 /media/…`다. 1.0.2 업로드 주소는 `/data/media/…`.
- Q102-03(낮음): docs/install.html "1. 구성 파일"의 폴더 그림 첫 줄이 `solad-gnuboard-1.0.1/`이다.

## 처음 설치한 사람 기준 막히는 점(README.txt·docs/install.html만 보고)

1. 그누보드 설치 마법사의 "쇼핑몰설치"가 기본 체크라 영카트까지 깔린다(솔애드와 무관, 메인 상단에 "쇼핑몰"이 생김).
2. 그룹: 이번 마법사 기본 설치는 그룹 community와 게시판 free·gallery·notice·qa를 만든다. 그래서 그룹이 없어 게시판 추가가 막히는 일은 이 환경에서는 없었다. 다만 문서 6절은 게시판 추가 양식의 필수 항목 "그룹"을 말하지 않아, 그룹이 없는 사이트라면 막힐 것으로 추정한다(미확인).
3. 문서 6절 표의 예시 TABLE(video)과 스킨만 안내한다. 게시판 추가 양식에는 필수 항목이 여럿(TABLE, 그룹, 제목)이고 PC·모바일 스킨을 각각 고른다(문서에 "같은 이름으로" 있음).
4. 1MB 한도: 새 게시판 bo_upload_size가 1048576이라 글쓰기 화면에 "MP4·WebM 파일, 1.0M 이하"로 나온다. 데모 영상(2.9MB)도 파일로는 못 올린다. 문서 7절에 "꼭 확인하세요"로 있으나, 11절 설치 확인은 "MP4를 올리면"으로 시작해 7절을 건너뛴 사람은 여기서 막힌다. 값이 바이트 단위인 것도 실수하기 쉽다.
5. 메뉴 없음: 새 그누보드는 메뉴가 0개라 메인에 "메뉴 준비 중입니다"만 나오고, 만든 동영상 게시판으로 가는 길이 사이트 화면에 없다. 문서에는 관리자 → 환경설정 → 메뉴설정 안내가 없다(주소 /bbs/board.php?bo_table=… 를 직접 알아야 함).
6. 6단계 결과 화면에서 제목이 안 보이는 문제(Q102-01)는 기본 basic 테마를 그대로 쓰는 사람이 바로 만난다.
7. 하우스 광고만 등록해서는 글에서 광고가 안 나온다. 지면 편성·게시까지는 도움말로 넘긴다(11절). 이번 배정 범위가 아니라 편성은 하지 않았다.
8. README "5.6.43에서 확인"이지만 받은 최신 원본은 5.6.34였다. 5.6.34에서 설치와 확인 항목은 문제없었다.

## 하지 않은 것

- 로그아웃 상태 setup.php(로그인 버튼), 지면 편성·광고 재생, 광고 요청 게시판(solad_request), 모바일 폭, nginx.
- 영상 "파일" 업로드 글쓰기(1MB 한도로 막히는 것은 화면 문구로만 확인, 한도를 올려 다시 해 보지는 않음).

## 캡처

0-clean-gnuboard-main.png, 2-setup-check.png, 2-setup-done.png, 4-ads-admin.png, 4-creative-saved.png, 4-media-png.png, 5-ads-with-empty-public.png, 6-board-view-player.png
