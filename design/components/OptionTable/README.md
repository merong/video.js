# OptionTable

도움말의 설치 옵션 표와 프리셋 필드 표입니다. 넓은 폭에서는 표, 카드 폭 600px 이하에서는 행마다 카드로 바뀌어 390에서도 가로 스크롤이 없습니다. 각 행은 관리자 화면이 링크하는 앵커 대상입니다.

- 구조: `div.sa-card.is-flush.sa-opts` > `div.sa-scroll` > `table.sa-table.sa-optt[aria-labelledby=<표 위 h3 id>]`.
  - 머리: 이름 · 받는 값 · 기본값 · 설명 · 적용 단계(`th scope="col"`).
  - 행: `tr[id]` > `th[scope=row]`(`span.sa-optt-name` 안에 `code` 이름과 `a.sa-anchor`) + `td` 넷. 각 `td`는 `span.sa-optt-k[aria-hidden]`(칸 이름) + `span`(값)입니다.
  - 받는 값·기본값의 글자 값은 `code`로 씁니다(`true`, `ko`). 설명은 해요체 한두 문장입니다.
  - 적용 단계 칸에는 PhaseTag를 둡니다. 설치 옵션 표도 같은 다섯 칸입니다.
- 카드 꼴(컨테이너 쿼리 `sa-opts`, 600px 이하)
  - 머리 줄은 화면에서만 숨기고, 각 칸 앞의 `sa-optt-k`가 보입니다. `sa-optt-k`는 `aria-hidden`이라 화면 읽기 프로그램은 표 머리로 칸 이름을 읽습니다.
  - 표 요소의 `display`를 바꾸면 표 의미를 잃는 브라우저가 있어, `table`·`thead`·`tbody`·`tr`·`th`·`td`에 `role`(table, rowgroup, row, columnheader, rowheader, cell)을 적습니다.
  - 화면 폭이 아니라 카드 폭으로 바뀌므로 관리자 화면에 넣어도 같은 규칙입니다.
- 앵커(명세 4절): 설치 옵션은 `#opt-<이름>`(앞의 `--`를 빼고 영문 소문자·숫자·`-`만), 프리셋 필드는 `#field-<경로>`(점을 `-`로). 이름 옆 `#` 링크는 DocShell의 제목 앵커와 같은 꼴이고, 화면 읽기용 글자는 "‘<이름>’ 항목 주소"입니다.
- 주소 대상 행(`tr:target`)은 바탕을 `accent-soft`로 바꿉니다. 관리자 화면의 "?" 링크로 왔을 때 어느 행인지 보입니다. 위쪽 탐색이 붙지 않으므로 `scroll-margin-top`은 16px입니다.
- 표가 넓은 폭에서도 넘치면(긴 CSS 변수 이름) 이름 칸이 줄바꿈합니다(`overflow-wrap: anywhere`). 그래도 넘치면 `sa-scroll` 안에서 가로로 스크롤합니다.
- 행 데이터는 `examples/options.js` 하나에서 만듭니다(명세 4절). 데모 옵션 칸의 설명도 같은 데이터를 씁니다. 미리보기의 행 값은 모양을 보이는 예입니다. 실제 받는 값·기본값·설명은 ads-implementer가 코드에서 씁니다.
- 표 묶음: 설치 옵션은 "자리 요소 data-* 속성", "요소 속성", "JS API", "CSS 변수" 네 표, 프리셋 필드는 "테마", "재생 동작", "표시", "언어", "입력", "컨트롤", "로고", "광고 화면" 표입니다. 표마다 `h3.sa-doc-h3` 제목을 두고 `aria-labelledby`로 잇습니다.
