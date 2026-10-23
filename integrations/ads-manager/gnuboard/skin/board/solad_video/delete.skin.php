<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/solad.lib.php');

// 글이 실제로 지워진 뒤 그 글의 HLS 폴더를 지운다.
add_event('bbs_delete', 'solad_hls_after_delete', G5_HOOK_DEFAULT_PRIORITY, 2);
