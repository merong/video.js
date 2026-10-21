# PlayTest

재생 테스트 페이지(`examples/play-test.html`)입니다. 게시한 편성을 실제 수집 API로 재생합니다. 관리자의 재생 테스트 링크(`PlayerTestLinks`)가 새 탭으로 엽니다(명세 2절).

- 위쪽 탐색은 DocShell과 같고 현재 페이지 표시가 없습니다(문서 셋 가운데 하나가 아닙니다). 목차는 두지 않습니다.
- 본문은 `main.sa-main`(최대 1320px). 차례로
  1. `sa-phead`: 제목 "재생 테스트" + "게시한 편성을 실제 서비스와 같은 방법으로 재생해요."
  2. 수집 안내 Note `is-warn`: "<b>이 페이지는 실제 수집 API로 광고 기록을 보내요.</b> 여기서 재생한 시작·완료·클릭이 통계에 쌓여요." 닫을 수 없고 늘 보입니다.
  3. 전환 줄 `div.sa-card > div.sa-switchbar`: 플레이어(Video.js / 기본 video), 미디어(MP4 / HLS), HLS 엔진(Video.js 자체(SPF) / hls.js). 각 묶음은 `div.sa-field > span.sa-label[id] + nav.sa-chips[aria-labelledby] > a.sa-chip`이고 현재 값에 `aria-current="page"`입니다(Chip의 링크 칩).
  4. `sa-grid2`: 왼쪽 플레이어(PlayerStage에서 폭 보기·장면 바로가기를 뺀 꼴: 무대, 최근 광고 진행 한 줄, 상태 문구), 오른쪽 재생 조건 KeyValue와 광고 진행 기록(ActivityLog `sa-logbox`).
- 전환 링크는 바꾸는 값 하나만 바꾸고 다른 쿼리(`video`, `content`, `preset` 등)는 그대로 둡니다. 링크라서 새로 고침·새 탭·뒤로 가기가 됩니다. 라디오나 버튼으로 만들지 않습니다.
- 고를 수 없는 값은 링크를 두지 않고 `span.sa-chip.is-off`(점선, `faint`)로 글자만 둡니다. 이유는 묶음 아래 `sa-help`로 적고 `nav`의 `aria-describedby`로 잇습니다. 기본 video일 때 HLS("기본 video는 HLS를 재생하지 못해요.")가 여기에 해당합니다. 미디어가 MP4이면 HLS 엔진 묶음을 숨깁니다.
- 재생 조건(KeyValue): 프리셋(사이트 적용이면 " (사이트 적용)"), 영상 ID, 본편, 편성("게시본"), 통계("수집해요").
- 다른 플레이어용 프리셋: 전환 줄 아래 Note `is-warn` "<b>‘<이름>’은 Video.js용 프리셋이에요.</b> 기본 video에서는 이 프리셋 대신 기본값으로 재생해요. 로더도 같은 규칙이에요." 기본 video용 프리셋을 Video.js로 열 때도 같은 꼴입니다.
- 주소에 `video`가 없으면 플레이어 자리에 `sa-empty` "재생할 영상이 없어요" + "관리자의 지면 편성에서 재생 테스트 링크로 열어 주세요. 주소에 video 값이 있어야 해요."
- 광고 진행 기록은 데모와 같은 규칙(최근 20개, 새것이 위)이고, "통계에 남기지 않아요" 안내는 두지 않습니다(이 페이지는 남깁니다).
- 960 이하에서는 `sa-grid2`가 한 열이 됩니다. 전환 줄은 묶음 단위로 줄바꿈합니다.
