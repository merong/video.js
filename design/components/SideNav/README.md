# SideNav

관리자 화면 틀(`sa-shell`)의 왼쪽 메뉴와 그 옆 상단 막대(`sa-topbar`)입니다. 바탕은 `panel`, 오른쪽 테두리는 `line`입니다.

- 틀: `div.sa-shell` 안에 `div.sa-side`(왼쪽 메뉴, 폭 224px, 화면 높이에 붙음)와 `div.sa-shell-main`(상단 막대와 본문)을 나란히 둡니다.
- 머리(`sa-side-head`)는 높이 `nav-h`(52px)이고 로고(`span.sa-logo`)를 둡니다. 솔애드는 `솔애드 <em>관리자</em>`, 그누보드 팝업은 `광고 관리` 글자만 씁니다.
- 메뉴는 `nav.sa-side-nav[aria-label]` 하나입니다. 구획마다 `p.sa-side-label`(12px/600, `sub`)을 두고, 그 아래 `ul[aria-labelledby]`에 링크를 넣습니다.
- 링크는 높이 34px, 13px/500, `ink`입니다. 앞에 16px 선 아이콘(`svg.sa-ico`, `aria-hidden`)을 두고 색은 `sub`입니다. 현재 화면은 `aria-current="page"`로 `primary` 채움을 받고 아이콘도 `on-primary`가 됩니다. 대기 건수는 라임 `<b>`로 붙입니다.
- 바닥(`sa-side-foot`)에는 `sa-avatar`와 이름·역할(`sa-side-user`)을 둡니다. 이름은 아바타의 `aria-label`이 읽으므로 글자는 `aria-hidden`입니다.
- 상단 막대(`header.sa-topbar`)는 높이 `nav-h`, 왼쪽에 현재 위치(`p.sa-topbar-crumb`, 구획 / 화면 이름), 오른쪽(`sa-topbar-r`)에 도움말, 화면당 하나의 라임 버튼, 사이트 보기 · 관리자, 로그아웃, 창 닫기를 둡니다. 현재 위치는 페이지 제목과 겹치므로 `aria-hidden`입니다.
- 960px 미만에서는 왼쪽 메뉴가 서랍이 됩니다. 상단 막대 맨 앞의 메뉴 단추(`button.sa-topbar-menu`, `aria-expanded`, `aria-controls`)로 열고, 열리면 `sa-side.is-open`, 뒤에 `div.sa-side-scrim`(`dark` 55%)을 깔고 본문 쪽은 `inert`로 둡니다. 서랍 머리에는 메뉴 닫기 단추(`sa-side-close`)가 보입니다.
- 서랍을 열면 현재 화면 링크로 포커스가 가고, Esc·닫기 단추·바깥 누르기로 닫으면 메뉴 단추로 돌아옵니다. 링크를 누르면 닫히고 새 화면 제목으로 포커스가 갑니다.
- 599px 이하에서는 현재 위치에서 구획 이름을 숨깁니다. 움직임 줄이기 설정이 아니면 서랍은 `motion-fast`로 미끄러져 들어옵니다.
