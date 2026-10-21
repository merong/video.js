# HelpMotion

도움말 용어 카드와 그 안의 모션 그림입니다. 광고 용어를 글로 먼저 설명하고, 같은 내용을 CSS 애니메이션과 인라인 SVG 그림으로 한 번 더 보여 줍니다. 필드 옆 "?" 링크(`sa-help-link`)도 여기서 다룹니다.

## 구조

- 용어 카드: `article.sa-term` 안에 `div.sa-term-h`(`h4` 이름 + 상태 배지), 설명 `p.sa-body`, 자세한 값 `p.sa-small`, 그림 `figure.sa-motion`, 관련 화면 `p.sa-small` 순서입니다. 카드 목록은 `ul.sa-terms`, 메뉴 안내 카드 목록은 `ul.sa-help-menus`입니다.
- 상태 배지는 `sa-badge`를 빌려 씁니다. 지금 동작 = `active`, 목업 = `draft`, 준비 중 = `archived`. 목업·준비 중 기능을 동작하는 것처럼 쓰지 않습니다.
- 그림: `figure.sa-motion` > `div.sa-motion-stage[role="img"][aria-label]` > `div.sa-mo`(장면) 그리고 `div.sa-motion-ctrl[role="group"]`(일시정지·다시 보기 버튼).
- `aria-label`은 그림이 보여 주는 내용을 한 문장으로 적습니다. 설명 글에 없는 사실을 그림에만 넣지 않습니다.
- 필드 옆 링크: `a.sa-help-link[href="#/help/<용어 id>"][aria-label="<용어> 도움말"]`, 글자는 "?"입니다. 원은 20px, 누르는 면은 24px입니다.

## 움직임 규칙

- 마크업만으로 핵심 상태 한 장이 그려집니다. 애니메이션은 `@media (prefers-reduced-motion: no-preference)` 안에서만 붙고, 움직임 줄이기 설정에서는 그 한 장만 보입니다. 이때 앱은 일시정지·다시 보기 버튼을 숨깁니다.
- 길이는 토큰입니다. 반복 그림은 `motion-help-loop`(8초)마다 처음부터 다시 돌고 일시정지·다시 보기 버튼을 둡니다. 한 번만 도는 그림(`.sa-motion.is-once`)은 `motion-help-once`(5초)이고 다시 보기 버튼만 둡니다.
- 화면 밖(`is-offscreen`)에서는 그 자리에서 멈춥니다(`animation-play-state: paused`). 일시정지(`is-paused`)는 움직임을 빼고 완성된 그림 한 장을 보입니다. 반복 사이의 빈 장면에 멈추지 않게 하려는 것이고, 다시 누르면 처음부터 돕니다. 다시 보기는 장면을 새로 그려 처음부터 돌립니다.
- 눌린 일시정지는 배경색으로 보이고, 고대비 모드(`forced-colors: active`)에서는 `Highlight` 테두리로 보입니다.
- 미리보기(`preview.html`)도 앱처럼 움직임 줄이기 설정에서 버튼을 숨깁니다.
- 깜빡임은 없습니다. 가장 빠른 변화도 한 바퀴에 몇 번 나타나거나 사라지는 정도이고, 1초에 3번을 넘지 않습니다.
- 색은 토큰만 씁니다. 광고 = `accent`(라임), 강조 = `primary`, 끊김·거부 = `bad` 테두리, 비어 있음 = 점선(`is-ghost`)입니다.

## 장면 부품

| 클래스 | 쓰임 |
| --- | --- |
| `sa-mo-in1` ~ `sa-mo-in5` | 한 바퀴의 4–12%, 20–28%, 36–44%, 52–60%, 68–76%에 나타납니다. 최종 상태는 보이는 상태입니다. |
| `sa-mo-segs` > `sa-mo-seg.is-ad` / `.is-content` | 재생 순서 막대. 막대 안 `i.sa-mo-fill1` ~ `fill5`가 차례로 찹니다. |
| `sa-mo-screen` | 어두운 플레이어 화면. `sa-mo-tag`(광고 표시), 아래 `sa-mo-bar > i.sa-mo-play`(진행), `sa-mo-skip`(오른쪽 아래 버튼 자리), `sa-mo-leave`(끝나면 흐려짐). |
| `sa-mo-wait` / `sa-mo-go` | 스킵 대기 문구와 켜진 "광고 건너뛰기". `sa-mo-roll.sa-mo-count`가 5 → 1을 1초씩 셉니다. 처음부터 켜진 링크는 `sa-mo-link`입니다. |
| `sa-mo-tree` | 사이트 → 게시판 → 분류 → 영상 4칸. 줄 제목은 `sa-mo-cap.sa-mo-span`입니다. |
| `sa-mo-doc`, `sa-mo-stack` | 초안·버전 문서 카드와 그 겹침. |
| `sa-mo-lane` > `sa-mo-pipe` > `i.sa-mo-dot1~3` | 신호가 흘러가는 줄. 점이 없는 줄은 보내지 않는 경로입니다. 도착 수는 `sa-mo-roll.sa-mo-tally`(0 → 3)입니다. |
| `sa-mo-pips` > `sa-mo-pip` | 시작 10칸. `is-done`은 36–44%에 라임으로 바뀌고, `is-click`은 굵은 테두리입니다. |
| `sa-mo-box`, `sa-mo-flow`, `sa-mo-item` | 상자, 화살표로 잇는 줄, 배지 같은 임의 요소의 등장. |
| `sa-mo-device` > `sa-mo-player` > `sa-mo-ctl` (`sa-mo-knob`, `sa-mo-track > i`) | 미니 플레이어와 아래 이름. `is-theme`은 36–44%에 강조색이 들어오고 모서리가 둥글어집니다. `is-plain`(테마 전), `is-skin-default`·`is-skin-neutral`(스킨 모서리), `is-native`(브라우저 기본 컨트롤 막대)는 멈춘 모양입니다. |
| `sa-mo-device` > `sa-mo-fit` | 세로 틀에 가로 그림. 맞춤은 위아래가 비고, 채움은 양옆이 잘립니다. |

React에서는 `ui/src/help/scenes.tsx`의 부품과 `HelpMotion`을 씁니다. 용어별 장면은 `ui/src/help/motions.tsx`, 글은 `ui/src/help/terms.ts`에 있습니다.
