# CodeBlock

설치 코드나 옵션 예시처럼 그대로 복사해 쓰는 코드를 보여 주는 칸입니다. 복사 버튼과 복사 결과 문구를 함께 둡니다.

- 구조: `div.sa-codeblock` > `div.sa-codeblock-head`(`span.sa-codeblock-title` + `button.sa-btn.is-sm` 복사), `pre[role=region][aria-labelledby][tabindex=0] > code`, `p.sa-status`(결과).
- 코드는 줄바꿈하지 않고 가로로 스크롤합니다(`white-space: pre`). 탭은 두 칸으로 고정합니다. 글꼴은 `code` 글자 스타일(`--font-mono`, 12.5px/20px)입니다.
- 스크롤 영역은 키보드로 들어가 화살표로 움직일 수 있게 `tabindex=0`이고, 제목으로 이름을 붙입니다. 바로 위 제목이 이미 코드를 설명하면 제목을 화면 읽기용(`sa-sr`)으로만 둡니다.
- 복사 버튼의 이름은 "<제목> 복사"입니다(예: "설치 코드 복사").
- 복사는 `navigator.clipboard.writeText`를 씁니다. 성공하면 "복사했어요."를 알립니다. 클립보드가 없거나(보안 연결이 아닌 페이지) 거부되면 코드 영역으로 초점을 옮겨 전체를 선택하고 "복사하지 못했어요. 코드를 직접 선택해 복사해 주세요."를 알립니다. 결과 문구는 `role="status"`(실패는 `is-warn`)이고 코드가 바뀌면 지웁니다. 같은 결과가 이어져도 매번 알리도록 문구 노드를 새로 만듭니다. 실패하면 초점이 옮겨 간 코드 영역의 설명(`aria-describedby`)에도 실패 문구를 연결해, 영역 이름 다음에 안내가 읽히게 합니다.
- 바탕은 `panel-2`, 테두리는 `line`입니다. 어두운 테마에서도 같은 토큰을 따릅니다.
