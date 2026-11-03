# qa-103b 1.0.3 재빌드 결함 재확인 (2026-11-03, ads-qa)

- zip 45,861,077 bytes, sha256 0fe2c6fb…a584. 깨끗한 스냅숏(g5-clean/snapshot)으로 되돌린 뒤 설치. 18840 + 자체 mysqld, ego-browser.

| 결함 | 결과 | 근거 |
| --- | --- | --- |
| Q103-01 | 통과 | 체크 기본값 [설치하기] 한 번: 예제 글·예제 광고("솔애드 예제 광고", /ads/demo-media/ad.mp4)·video 프리롤 게시 모두 "확인". 1280에서 광고(ad.mp4) → 본편(content.mp4) 재생. |
| Q103-02 | 통과 | 메뉴 2개: board.php?bo_table=video 200, board.php?bo_table=adreq 200. [게시판 만들기]·[예제 넣기] 각 2번 더 눌러도 게시판 6·메뉴 2·글 1·광고 1·게시 1 그대로. |
| Q103-03 | 통과 | 390 모바일 스킨 solad_video_light: 목록 #sv_list, 보기 #sv_view, 쓰기 #sv_write 모두 padding 16px, 가로 넘침 없음. 보기의 플레이어는 화면 폭 그대로(의도로 판단). |
| Q103-04 | 통과 | [예제 글 보기] href `board.php?bo_table=video&wr_id=1`, 눌러서 글(제목 "솔애드 예제 영상", 플레이어) 열림. |

캡처: setup-done.png, 1280-video-view-preroll.png, 1280-video-view-content.png, 390-video-list.png, 390-video-view.png, 390-video-write.png, 390-video-view-more-menu.png(더보기 메뉴 열림, 좌우 12px).
