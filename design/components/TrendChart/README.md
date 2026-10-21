# TrendChart

최근 14일 노출·클릭 추이를 보여 주는 선 차트 카드입니다. 같은 데이터를 표로 볼 수 있습니다.

- 구조: `div.sa-card[data-trend]` 안에 지표 칩(`data-metric="imp|clk|table"`), `div.sa-chart`, 표 보기 `div.sa-scroll`.
- 선과 점은 `chart-line`, 면은 `chart-area`, 눈금선은 `line`, 축 글자는 `axis`(11.5px, Inter)입니다.
- 어제 값에는 채운 점과 숫자를, 집계 중인 오늘에는 빈 점과 점선을 쓰고 "집계 중"이라고 적습니다.
- 표 보기는 필수입니다. 차트만 두지 않습니다.
- 실제 화면은 Chart.js로 그리되 이 색과 글자 규칙을 옵션으로 넘깁니다.
