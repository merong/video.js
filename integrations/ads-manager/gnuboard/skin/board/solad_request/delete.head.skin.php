<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

// 집행 예정부터는 회원이 요청을 지울 수 없다. 처리 기록과 집행 근거가 함께 사라지기 때문이다.
if (!$is_admin && !empty($write['wr_id']) && solad_request_is_locked($write['ca_name'])) {
    alert($write['ca_name'].' 상태의 요청은 지울 수 없어요. 필요하면 처리 기록에 남겨 주세요.');
}
