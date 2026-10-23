<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/solad.lib.php');

// 선택삭제가 끝난 뒤 실제로 지워진 글의 HLS 폴더만 지운다.
add_event('bbs_delete_all', 'solad_hls_after_delete_all', G5_HOOK_DEFAULT_PRIORITY, 2);
