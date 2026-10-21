# Field

라벨, 입력란, 도움말을 묶은 입력 단위입니다. 라벨은 `label`(13px/500), 입력값은 `body`(14px), 도움말은 `small`(12.5px, `sub`)입니다.

- 구조: `sa-field` 안에 `label.sa-label`, `input.sa-input`, `span.sa-help`. 도움말은 `aria-describedby`로 연결합니다.
- 숫자·날짜 입력은 `is-num`을 붙여 Inter로 자릿수를 맞춥니다.
- 제출을 막는 검증 오류는 `is-error`(`bad`)와 `aria-invalid="true"`, 막지 않는 검토 경고는 `is-warn`(`warn`)입니다.
- 오류 문구는 무엇이 문제인지와 고치는 방법을 함께 적습니다.
- 입력란은 밀집 영역에서도 기본 높이를 유지합니다. 폼은 `sa-dense` 밖에 둡니다.
- 같은 `sa-input`을 `textarea`(여러 줄, 세로로만 늘림), `select`(오른쪽 화살표), `input type="file"`(왼쪽 파일 선택 버튼)에도 씁니다.
- 바꿀 수 없는 입력은 `disabled`를 걸면 `panel-2` 바탕과 `sub` 글자로 바뀝니다. 왜 바꿀 수 없는지는 값이나 도움말에 적습니다.
- 체크박스·라디오 묶음은 Check(`sa-check`, `sa-fieldset`)를 씁니다.

## 단위 붙은 숫자 칸 (A2)

px, % 단위가 붙는 숫자(로고 여백·폭·불투명도)는 `span.sa-unit` 안에 `input.sa-input.is-num`(96px)과 `span.sa-unit-text[aria-hidden="true"]`를 둡니다.

- 단위는 칸 옆 글자를 읽히지 않게 두고, 라벨 안에 `<span class="sa-sr"> (px)</span>`로 한 번만 넣습니다. 화면 읽기 프로그램이 "여백 (px)"로 읽고 단위를 두 번 읽지 않습니다.
- `type="number"`에 `min`·`max`·`step`을 걸고, 범위를 도움말에 글로 적습니다. 예: "0–48 정수예요. 모서리에서 떨어진 거리예요."
- 범위 밖 값은 `sa-field.is-error`와 `aria-invalid="true"`, 문구는 "240px보다 커요. 24–240 사이의 정수로 입력해 주세요."입니다.
- 기본 video 프리셋처럼 쓸 수 없을 때는 `disabled`를 걸고 값을 그대로 둡니다(DisabledReason).
- 단위 칸 여럿은 `div.sa-unit-grid`로 묶습니다(칸 폭 128px 이상, 남는 폭에 따라 줄바꿈). 360px 열에서는 두 칸씩 놓입니다(A2-E 데모 로고 묶음).
- `hidden`을 건 `sa-field`는 보이지 않습니다(`.sa-field[hidden]`). 고른 값에 따라 나타나는 칸(예: "주소 직접 넣기")에 씁니다.
