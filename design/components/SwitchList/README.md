# SwitchList

켜고 끄는 항목을 스위치, 이름, 설명, 함께 꺼지는 단축키로 한 줄씩 묶은 목록입니다. 컨트롤, 재생 동작, 로고, 광고 화면 구획에 씁니다.

- 구조: `ul.sa-switches > li`. 행 안은 `button.sa-toggle[role=switch][aria-checked]`, `span.sa-switch-name`, `span.sa-switch-desc`, 필요하면 `span.sa-switch-keys`.
- 스위치의 이름은 `aria-labelledby`로 이름 글자를, 설명은 `aria-describedby`로 설명(과 단축키 줄) id를 연결합니다. 설명이 둘이면 공백으로 이어 씁니다(`aria-describedby="cap-d cap-k"`).
- 단축키는 `kbd.sa-kbd`로 씁니다. "끄면 단축키 <kbd>f</kbd>와 가운데 두 번 탭도 꺼져요."처럼 무엇이 함께 꺼지는지 문장으로 적습니다.
- 바꿀 수 없는 행은 `li.is-locked`와 `disabled`를 걸고, 왜 바꿀 수 없는지를 설명에 적습니다(DisabledReason). 값은 지우지 않습니다.
- 스위치 자체는 Toggle과 같습니다. 이 목록은 칸 배치와 설명 연결만 더합니다.
- 근거: 캔버스 C(로고), D(컨트롤), E(재생 동작), G(광고 화면).

## 딸린 칸과 편집기 컨트롤 절 (A2-E)

- 딸린 칸: 스위치를 켰을 때만 쓰는 값(건너뛰는 폭)은 같은 `li` 안 이름·설명 아래에 `div.sa-field.sa-switch-sub`로 둡니다. 둘째 열에 붙습니다. 끄면 `hidden`으로 숨기고, 스위치의 `aria-controls`로 잇습니다. `.sa-field`의 `display`가 `hidden`을 이기므로 `.sa-switch-sub[hidden]` 규칙이 따로 숨깁니다.
- 편집기 "컨트롤" 절(명세 3.4)에는 이번에 두 줄만 둡니다. 다른 컨트롤 항목은 이번 범위가 아니고 A2-2·A2-3 표시를 유지합니다.
  1. "이전·이후 버튼"(`controls.seekButtons`): 설명 "컨트롤 막대에 뒤로·앞으로 건너뛰기 버튼을 보여요." 켜면 딸린 칸 Segmented "건너뛰는 폭"(5초 · 10초 · 15초 · 30초, `is-num`). 처음 켜면 10초, 같은 화면에서 껐다 켜면 마지막 값. 끄면 `null`.
  2. "자막"(`controls.captions`, 기본 켬): 설명 "자막 버튼과 설정 메뉴의 자막 항목이에요. 영상에 자막이 없으면 버튼이 ‘자막 없음’으로 막혀 보여요.", 단축키 줄 "끄면 단축키 c도 꺼져요."
- 플레이어 종류가 기본 video면 절 머리 아래 DisabledReason "<b>기본 video에서는 컨트롤을 쓸 수 없어요.</b> 기본 구획의 플레이어 종류를 Video.js로 바꾸면 쓸 수 있어요."를 두고, 두 줄을 `is-locked` + `disabled`로 막습니다. 딸린 칸은 숨기고 값은 지우지 않습니다. 스위치의 `aria-describedby`는 이유 문장입니다.
- 자막 주소(`data-captions`)는 설치 속성이라 편집기에 두지 않습니다. 데모(DemoBench)에만 있습니다.
