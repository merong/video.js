# Disclosure

자주 보지 않는 내용(예전 정적 설치 코드, 긴 data-* 표)을 접어 둡니다.

- 구조: `details.sa-disclosure > summary` + `div.sa-disclosure-b`. 네이티브 `details`라 Enter·Space로 열고 닫히고, 열림 상태를 브라우저가 알립니다. 스크립트나 `aria-expanded`를 따로 두지 않습니다.
- `summary` 글자는 무엇이 들어 있는지 적습니다. "예전 정적 코드 보기"처럼 씁니다. "더 보기"만 쓰지 않습니다.
- 화살표는 CSS로 그린 장식입니다. 움직임 줄이기 설정이 아닐 때만 `motion-fast`로 돌아갑니다.
- 접은 안에 오류가 생기면 열어서 보입니다(`open` 속성).
- 미리보기 칸처럼 접어도 자리를 지키는 패널은 버튼(`aria-expanded`, `aria-controls`)으로 접고 이 부품을 쓰지 않습니다.
- 근거: 캔버스 J(초기 설정 방법).
