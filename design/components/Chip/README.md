# Chip

짧은 선택지를 눌러 고르는 버튼 묶음입니다. 목록 필터, 요일, 스킵 정책, 차트 지표 전환에 씁니다.

- 구조: `div.sa-chips[role=group][aria-label]` 안에 `button.sa-chip[aria-pressed]`. 여러 개를 고를 수 있으면 묶음에 `data-multi`를 붙입니다.
- 눌린 칩은 `primary` 바탕에 `on-primary` 글자입니다. 건수는 `<b>`로 넣으면 Inter로 표시됩니다.
- 요일처럼 한 글자 칩은 묶음에 `is-days`를 붙여 정사각형으로 만듭니다.
- 선택지가 다섯 개를 넘거나 이름이 길면 칩 대신 선택 목록을 씁니다.
- 상태별 목록처럼 주소가 바뀌는 탭은 `nav.sa-chips[aria-label]` 안에 `a.sa-chip`을 두고 현재 탭에 `aria-current="page"`를 붙입니다. 모양은 눌린 칩과 같습니다.

## 고를 수 없는 링크 칩 (A2-D)

재생 테스트 페이지의 전환 줄처럼 링크 칩 묶음에서 지금 고를 수 없는 값은 링크를 두지 않고 `span.sa-chip.is-off`로 글자만 둡니다(점선 테두리, `faint`).

- 이유는 묶음 아래 `span.sa-help`에 적고 `nav`의 `aria-describedby`로 잇습니다. 예: "기본 video는 HLS를 재생하지 못해요."
- `aria-disabled` 링크로 두지 않습니다. 눌러도 갈 곳이 없는 링크를 Tab 순서에 남기지 않기 위해서입니다.
