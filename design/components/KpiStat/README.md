# KpiStat

핵심 수치 한 개와 그 이름, 비교를 묶은 칸입니다. 여러 칸을 한 카드 안에 세로 구분선으로 나란히 둡니다.

- 구조: `section.sa-card.sa-kpis` 안에 `div.sa-kpi`(이름 `sa-kpi-label`, 값 `sa-kpi-value`, 비교 `sa-delta` 또는 `sa-small`). 칸 수는 `--n`으로 정합니다(기본 5).
- 기본 값은 `kpi`(20px/700)입니다. 대시보드 오늘 요약과 리포트 상단 KPI 줄에만 `is-hero`를 붙여 `kpi-hero`(26px/600)로 키웁니다.
- 비교는 `sa-delta is-good` / `is-bad`에 ▲/▼ 기호와 "어제 30,060" 같은 기준값을 함께 적습니다. 색은 좋아졌는지 나빠졌는지를 따릅니다(오류 증가는 `bad`).
- 오늘 수치는 기준 시각과 "어제 같은 시각" 비교를 함께 둡니다.
