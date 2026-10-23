# Check

체크박스와 라디오 한 개를 라벨과 묶은 선택지입니다. 여러 개를 고르면 체크박스, 하나만 고르면 라디오를 씁니다. 상태 필터처럼 화면을 바로 바꾸는 선택은 Chip을 씁니다.

- 클래스: `label.sa-check` 안에 `input`과 글자를 넣습니다. 묶음은 `fieldset.sa-fieldset`과 `legend.sa-label`로 이름을 붙입니다. 범례 옆에 도움말 링크를 둘 때는 `fieldset.sa-fieldset.has-aside`에서 `legend` 바로 뒤에 `span.sa-fieldset-aside`를 둡니다. 범례를 다른 요소로 감싸지 않습니다(그룹 이름이 사라집니다). 링크는 그룹 이름과 설명에 들어가지 않습니다.
- 높이는 `control-h-sm`(28px), 글자는 본문 13px입니다. 표시 색은 `accent-color: primary`입니다.
- 바꿀 수 없는 선택지는 `disabled`를 걸면 글자가 `sub` 색으로 바뀝니다.
