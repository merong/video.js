<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 댓글은 사이트에 설치된 그누보드 기본(basic) 게시판 스킨의 화면과 동작을 그대로 쓴다.
$sv_skin_url = $board_skin_url;
$board_skin_url = get_skin_url('board', 'basic');
add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);
include get_skin_path('board', 'basic').'/view_comment.skin.php';
$board_skin_url = $sv_skin_url;
