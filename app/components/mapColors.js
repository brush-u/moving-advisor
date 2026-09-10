// dataviz 스킬의 검증된 순차(sequential) 블루 램프(100~700)에서 5단계만 뽑아 점수 색상에 사용
export function scoreToColor(score) {
  if (score >= 90) return "#0d366b";
  if (score >= 80) return "#1c5cab";
  if (score >= 70) return "#3987e5";
  if (score >= 60) return "#86b6ef";
  return "#cde2fb";
}

export const DISTRICT_MARKER_COLOR = "#0b0b0b";
export const BUDGET_OK_COLOR = "#0ca30c";
export const BUDGET_OVER_COLOR = "#eb6834";
export const BUDGET_UNKNOWN_COLOR = "#898781";
export const SUBWAY_MARKER_COLOR = "#6f42c1";

// 매물 후보 지도 핀 색: 예산 이내(초록)/초과(주황)/모름(회색). ②모드(지역 우선)와 ①모드(지도
// 우선) 둘 다 같은 기준으로 표시하도록 여기 한 곳에 모았습니다.
export function budgetFitColor(withinBudget) {
  if (withinBudget === true) return BUDGET_OK_COLOR;
  if (withinBudget === false) return BUDGET_OVER_COLOR;
  return BUDGET_UNKNOWN_COLOR;
}
