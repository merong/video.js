# Pager

목록 아래 쪽 넘김입니다. 왼쪽에 전체 개수, 오른쪽에 "이전 · 3 / 12쪽 · 다음"을 둡니다. 처음 쓰는 곳은 강의 "학습 진도" 표(50개씩)입니다.

- 구조: `nav.sa-pager[aria-label="쪽 넘김"]` 안에 `span.sa-pager-total`("기록 1,234개")과 `div.sa-pager-nav`.
  - `div.sa-pager-nav` 안: `button.sa-btn.is-sm`"이전" · `span.sa-pager-now[aria-current="page"]`("3 / 12쪽") · `button.sa-btn.is-sm`"다음".
- 버튼은 기존 Button(`sa-btn is-sm`)입니다. 첫 쪽의 "이전", 마지막 쪽의 "다음"은 `disabled`입니다.
- 표 카드(`sa-card is-flush`) 안 맨 아래에 두면 카드 여백과 위 선이 붙습니다. 카드 밖에 둘 때는 위 여백만 있습니다.
- 쪽을 바꾸면 표가 새로 그려지고, 초점은 누른 버튼에 남습니다. 바뀐 쪽 번호는 `sa-pager-now`가 보여 줍니다. 따로 알림 영역을 두지 않습니다.
- 한 쪽뿐이면(전체 ≤ 쪽 크기) `sa-pager-nav`를 숨기고 개수만 둡니다. 0개면 Pager 전체를 숨기고 표의 빈 상태(`sa-empty`)를 씁니다.
- 숫자는 천 단위 쉼표를 씁니다. 좁은 폭에서는 개수와 버튼 줄이 두 줄로 접힙니다.
- 쪽 번호 목록(1 2 3 …)은 두지 않습니다. 관리 목록은 거름으로 좁혀 보는 것이 먼저라서 이전·다음으로 충분합니다.
