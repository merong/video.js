# Button

하는 일을 그대로 적은 동작 버튼입니다. 화면에서 가장 중요한 한 가지는 `is-lime`(집행 만들기, 승인함 열기), 폼의 제출은 `is-primary`(승인 요청, 저장), 나머지는 기본 버튼을 씁니다.

- 클래스: `sa-btn`, 크기 `is-sm`, 종류 `is-primary` / `is-lime`. 아이콘은 글자 앞에 16px `sa-ico`로 넣습니다.
- 높이는 `control-h`(36px), `is-sm`은 `control-h-sm`(30px)입니다. `sa-dense` 안에서는 32px·28px로 줄고 글자도 13px이 됩니다.
- 라임 버튼은 화면당 하나만 둡니다. 둘 이상 필요하면 하나를 `is-primary`로 바꿉니다.
- 비활성 버튼에는 이유를 옆이나 도움말로 적습니다. 예: 자기 제출 건은 "자기 승인 금지 설정"을 표시합니다.
- 반려, 삭제처럼 되돌리기 어려운 동작은 `is-danger`(글자 `bad`)를 씁니다. 바탕은 기본 버튼과 같습니다.
- 비활성 이유는 `span.sa-btn-why`로 버튼과 `span.sa-help`를 묶고 `aria-describedby`로 잇습니다. 이유가 있는 버튼은 아래 `aria-disabled`로 막습니다. 목업 화면의 쓰기 버튼도 이렇게 이유를 적습니다.

## 초점을 받는 비활성 (`aria-disabled`)

이유를 읽어야 하는 동작 버튼과 링크 버튼은 `disabled` 대신 `aria-disabled="true"`로 막습니다. `disabled`는 Tab 순서에서 빠져서, 화면 읽기 프로그램을 쓰는 사람은 버튼에 닿지 못하고 `aria-describedby`의 이유도 듣지 못합니다. 예: "데모에서 열기"(저장하지 않은 입력), 자기 제출 건의 "승인".

- 모양은 `disabled`와 같습니다. 테두리 `line`, 바탕 `panel-2`, 글자와 아이콘 `faint`, 마우스 모양 `not-allowed`이고 hover로 바뀌지 않습니다. `is-primary`, `is-lime`, `is-danger`도 같은 회색이 됩니다.
- `opacity`를 쓰지 않습니다. 초점 테두리(`focus-ring`)가 흐려지지 않고 그대로 보입니다.
- 버튼: `button.sa-btn[type=button][aria-disabled="true"][aria-describedby]`. 누름(클릭, Enter, Space)은 스크립트가 무시합니다. 폼 안에서는 제출도 막습니다.
- 링크 버튼: `a.sa-btn[aria-disabled="true"]`는 `href`를 빼고 `role="link"`와 `tabindex="0"`를 둡니다. 스크립트가 없어도 이동하지 않습니다. 다시 쓸 수 있게 되면 `href`를 넣고 `role`과 `tabindex`를 뺍니다.
- 막혔다 풀려도 자리와 글자는 그대로 둡니다. 초점도 그 버튼에 남깁니다.
- `disabled`는 이유를 읽을 필요가 없는 잠깐의 막음에만 씁니다. 예: 적용하는 중(Dialog), 저장하는 중. 막힌 입력 칸은 DisabledReason을 따릅니다.
- 고를 수 없는 링크 칩은 이 규칙이 아니라 Chip의 `span.sa-chip.is-off`를 씁니다(칩마다 이유를 듣지 않아도 되는 선택지라서).
