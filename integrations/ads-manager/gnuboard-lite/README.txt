솔애드 라이트 - 동영상 플레이어 + 프리롤 광고 for 그누보드5  (버전 {{VERSION}})
======================================================================

게시판에 첨부한 동영상(mp4·webm)을 Video.js 플레이어로 재생하고, 재생 전에 광고 영상 1개를 보여 줍니다.
광고는 프리롤(본편 앞) 1개이며, 5초가 지나면 [건너뛰기]를 누를 수 있습니다.

설치 가이드와 게시판 연동 가이드는 docs 폴더의 HTML 파일을 브라우저로 열어 보세요.
  docs/install.html   설치 가이드
  docs/guide.html     게시판 연동 가이드(스킨·페이지에 플레이어 넣기, 예제 코드)

필요 환경
  - 그누보드 5.6 이상 (5.6.43에서 확인)
  - PHP 7.4 이상
  - 별도 DB 설정이나 ffmpeg는 필요 없습니다.

빠른 설치
  1. upload 폴더 "안의" 파일을 그누보드 루트(common.php가 있는 곳)에 그대로 올립니다.
     extend/  plugin/  adm/
  2. 최고관리자로 로그인한 뒤 관리자 > 게시판관리 > 솔애드 라이트 광고를 엽니다.
     (처음 열 때 설정 테이블을 만듭니다.)
  3. 광고 영상(mp4·webm)을 올리고 [광고 사용]을 켠 뒤 [확인]을 누릅니다.
  4. 게시판 글에 mp4·webm 파일을 첨부하면 글 보기 화면 본문 위에 플레이어가 나옵니다.

들어 있는 파일
  upload/extend/solad_lite.extend.php         관리자 메뉴, 페이지마다 플레이어 스크립트 넣기
  upload/adm/solad_lite_form.php              광고 설정 화면
  upload/adm/solad_lite_form_update.php       광고 설정 저장
  upload/plugin/solad_lite/solad_lite.lib.php 설정·광고 편성·PHP 함수
  upload/plugin/solad_lite/solad-lite.js      플레이어 스크립트
  upload/plugin/solad_lite/solad-lite.css     플레이어 자리 스타일
  upload/plugin/solad_lite/vendor/            Video.js 플레이어와 광고 모듈(ads.js)
  upload/plugin/solad_lite/example.php        예제 페이지(최고관리자만)
  upload/plugin/solad_lite/sample/            예제 영상과 시험용 광고 영상

업데이트
  새 버전의 upload 폴더를 덮어 올립니다. 설정(DB)과 올린 광고 영상(data/solad_lite)은 그대로 남습니다.

삭제
  위 파일과 data/solad_lite 폴더를 지우고, DB에서 g5_solad_lite 테이블을 지웁니다.

라이선스
  구매한 사이트(도메인 1개)에서 사용할 수 있습니다. 재판매·재배포는 할 수 없습니다.
  포함된 Video.js는 Apache-2.0 라이선스를 따릅니다(docs/LICENSE-videojs.txt).
