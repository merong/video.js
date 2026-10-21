# Toggle

집행을 바로 켜고 끄는 스위치입니다. 집행 표의 첫 칸에 둡니다.

- 구조: `button.sa-toggle[role=switch][aria-checked]`. 표 안에서는 `aria-label`에 집행 이름을 넣습니다("프리롤 보장 켜기").
- 켜짐은 `primary`, 꺼짐은 `line-2`입니다. 손잡이 그림자 `shadow-knob`이 이 시스템의 유일한 그림자입니다.
- 종료·미달 종료·보관처럼 다시 켤 수 없는 집행은 `disabled`로 둡니다.
- 끄면 상태 배지가 "일시중지"로 바뀌고 사유와 시각을 표의 보조 줄에 남깁니다.
