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
export const MART_MARKER_COLOR = "#b8860b";
export const DEPARTMENT_MARKER_COLOR = "#c2185b";
export const HOSPITAL_MARKER_COLOR = "#d64545";
export const PHARMACY_MARKER_COLOR = "#009688";

// 지도의 지하철역/대형마트/백화점/병원/약국 핀 + "매물 상세" 카드 안의 주변 시설 정보에서
// 공통으로 쓰는 카테고리별 색/이모지/라벨. 색만으로는 5가지 카테고리를 한눈에 구분하기
// 어려워(사용자가 지도에 여러 시설을 함께 표시해 달라고 요청) 마커 안에 작은 이모지를 함께
// 그려 넣습니다(LeafletMap의 buildPlainMarkerHtml glyph 옵션).
export const POI_CATEGORY_META = {
  subway: { color: SUBWAY_MARKER_COLOR, glyph: "🚇", label: "지하철역" },
  mart: { color: MART_MARKER_COLOR, glyph: "🛒", label: "대형마트" },
  department: { color: DEPARTMENT_MARKER_COLOR, glyph: "🏬", label: "백화점" },
  hospital: { color: HOSPITAL_MARKER_COLOR, glyph: "🏥", label: "병원" },
  pharmacy: { color: PHARMACY_MARKER_COLOR, glyph: "💊", label: "약국" },
};

// 매물 후보 지도 핀 색: 예산 이내(초록)/초과(주황)/모름(회색). ②모드(지역 우선)와 ①모드(지도
// 우선) 둘 다 같은 기준으로 표시하도록 여기 한 곳에 모았습니다.
export function budgetFitColor(withinBudget) {
  if (withinBudget === true) return BUDGET_OK_COLOR;
  if (withinBudget === false) return BUDGET_OVER_COLOR;
  return BUDGET_UNKNOWN_COLOR;
}
