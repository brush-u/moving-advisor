import { fetchRecentListings } from "./molit";
import { estimateLayout, m2ToPyeong, pyeongToM2 } from "./roomEstimate";

function areaFilteredRaw(raw, minAreaM2, maxAreaM2) {
  return raw.filter((r) => r.areaM2 >= minAreaM2 && r.areaM2 <= maxAreaM2);
}

function applyConditionFilters(raw, { maxBuildAge, desiredRooms, desiredBathrooms, budgetMin, budgetMax }) {
  const currentYear = new Date().getFullYear();
  return raw.filter((r) => {
    if (maxBuildAge && r.buildYear && currentYear - r.buildYear > maxBuildAge) return false;
    const layout = estimateLayout(r.areaM2);
    if (desiredRooms && layout.roomsMax != null && layout.roomsMax < desiredRooms) return false;
    if (desiredBathrooms && layout.bathMax != null && layout.bathMax < desiredBathrooms) return false;
    const eok = r.amountManwon / 10000;
    if (budgetMin != null && eok < budgetMin) return false;
    if (budgetMax != null && eok > budgetMax) return false;
    return true;
  });
}

function dedupeLatest(raw) {
  const byKey = new Map();
  for (const r of raw) {
    // 층까지 묶음 기준에 넣습니다. 예전엔 "단지명+반올림 면적"만으로 묶어서, 같은 단지·같은
    // 평형이면 층이 달라도(=실제로는 서로 다른 매물) 화면엔 1건만 남았습니다. 오피스텔처럼
    // 건물 전체가 몇 가지 표준 평형으로만 이뤄진 경우 특히 심해서 — 예: 강남구에 신축
    // 오피스텔 실거래가 여러 층에서 있었는데도 "1건만 조회된다"는 사용자 신고로 발견했습니다.
    // 층까지 같으면 진짜 같은 매물일 가능성이 높으니(같은 호실이 기간 안에 두 번 거래된 경우
    // 등) 그때만 최신 거래로 합칩니다.
    const key = `${r.complexName || "이름미상"}::${Math.round(r.areaM2)}::${r.floor || "층미상"}`;
    const existing = byKey.get(key);
    if (!existing || r.dealYmd > existing.dealYmd) byKey.set(key, r);
  }
  return Array.from(byKey.values());
}

function toCandidate(r, district, currentYear, budgetEok, dealType) {
  const layout = estimateLayout(r.areaM2);
  const totalEok = Math.round((r.amountManwon / 10000) * 100) / 100;
  const withinBudget = budgetEok ? r.amountManwon / 10000 <= budgetEok * 1.05 : null;
  return {
    complexName: r.complexName || "단지명 미상",
    dong: r.dong || district.name,
    pyeong: m2ToPyeong(r.areaM2),
    areaM2: Math.round(r.areaM2 * 10) / 10,
    buildYear: r.buildYear,
    age: r.buildYear ? currentYear - r.buildYear : null,
    dealYmd: r.dealYmd,
    floor: r.floor,
    amountManwon: r.amountManwon, // 매매: 거래금액 / 전세·월세: 보증금 (예산 기준액으로 통일)
    totalEok, // 위 amountManwon을 억원으로 환산 (전세·월세는 "보증금 총액"을 의미)
    monthlyRentManwon: dealType === "wolse" ? r.monthlyRentManwon || 0 : null,
    dealType,
    withinBudget,
    layout,
  };
}

// 표본이 작을 때 단순 백분위로 튀는 것을 막기 위해 선형보간 방식의 백분위수를 씁니다.
function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

/**
 * 추천된 자치구 안에서 사용자가 지정한 집 조건(주택유형/평형/준공연식/희망 방·화장실 개수)에
 * 맞는 실제 거래 단지 후보를 찾아 반환합니다. 개별 단지 데이터는 참고값으로 대체할 수 없으므로,
 * MOLIT_SERVICE_KEY가 없으면 항상 빈 배열을 반환합니다 (호출부에서 안내 문구를 보여줍니다).
 *
 * budgetMin/budgetMax를 주면 그 범위로 강하게 걸러내고(지역 우선 선택 플로우, 그리고 이제는
 * 지도 우선 플로우의 예산 범위 슬라이더도 동일하게), 주지 않으면 budgetEok는 "예산 이내/초과"
 * 배지 표시에만 쓰입니다.
 *
 * 평형도 마찬가지로 두 가지 방식을 지원합니다: pyeongMin/pyeongMax를 주면(범위 슬라이더) 그
 * 범위를 그대로 전용면적 필터로 쓰고, 대신 단일 pyeong 값만 주면(하위 호환) 그 값을 중심으로
 * ±areaTolerance(기본 22%) 범위를 계산해서 씁니다. 두 값 모두 없으면(=범위/평형 모두 "전체")
 * 전용면적으로는 걸러내지 않습니다.
 */
export async function findCandidates({
  district,
  houseType,
  pyeong,
  pyeongMin,
  pyeongMax,
  areaTolerance = 0.22,
  maxBuildAge,
  desiredRooms,
  desiredBathrooms,
  budgetEok,
  budgetMin,
  budgetMax,
  dealType = "trade",
  monthsBack = 2,
  limit = 4,
}) {
  const currentYear = new Date().getFullYear();

  let minAreaM2 = 0;
  let maxAreaM2 = Infinity;
  if (pyeongMin != null || pyeongMax != null) {
    if (pyeongMin != null) minAreaM2 = pyeongToM2(pyeongMin);
    if (pyeongMax != null) maxAreaM2 = pyeongToM2(pyeongMax);
  } else if (pyeong) {
    const targetAreaM2 = pyeongToM2(pyeong);
    minAreaM2 = targetAreaM2 * (1 - areaTolerance);
    maxAreaM2 = targetAreaM2 * (1 + areaTolerance);
  }

  const raw = await fetchRecentListings(district.lawdCd, houseType, monthsBack, dealType);
  const areaMatched = areaFilteredRaw(raw, minAreaM2, maxAreaM2);
  const filtered = applyConditionFilters(areaMatched, {
    maxBuildAge,
    desiredRooms,
    desiredBathrooms,
    budgetMin,
    budgetMax,
  });

  const list = dedupeLatest(filtered).map((r) => toCandidate(r, district, currentYear, budgetEok, dealType));
  // 최근 실거래일 내림차순(최신 거래가 먼저) -> 같은 거래월이면 총액(전세/월세는 보증금
  // 총액) 오름차순(낮은 가격 먼저)으로 정렬합니다. 한때 가격순만 썼던 적이 있었는데,
  // 사용자 요청으로 원래 기준(최근 거래일 우선)에 가격을 보조 기준으로 되돌렸습니다.
  list.sort((a, b) => {
    const dateDiff = String(b.dealYmd || "").localeCompare(String(a.dealYmd || ""));
    if (dateDiff !== 0) return dateDiff;
    return a.amountManwon - b.amountManwon;
  });

  return list.slice(0, limit);
}

/**
 * "필요 예산" 힌트용: 평형·주택유형·거래유형 조건에 맞는(예산 필터 없이) 최근 거래들의
 * 대표적인 최소~최대 총액(억원)을 계산합니다. 지역을 먼저 고르면 이 값으로 예산 입력란을
 * 자동으로 채워 줍니다.
 *
 * 표본이 충분(5건 이상)하면 단순 최소/최대 대신 10~90 백분위수를 사용해서, 단 하나의 극단적인
 * 급매/신고가 거래 때문에 범위가 비정상적으로 넓어지는 것을 막습니다(percentileBased: true).
 * 표본이 적으면(2~4건) 백분위수가 오히려 왜곡될 수 있어 실제 최소/최대를 그대로 씁니다
 * (percentileBased: false). 실거래 표본이 아예 없으면(2건 미만) null을 반환하고, 호출부가
 * 조사 참고값(평당가 × 평형)으로 폴백합니다.
 */
export async function computePriceRange({ district, houseType, pyeong, dealType = "trade", areaTolerance = 0.22, monthsBack = 2 }) {
  const targetAreaM2 = pyeongToM2(pyeong);
  const raw = await fetchRecentListings(district.lawdCd, houseType, monthsBack, dealType);
  const areaMatched = areaFilteredRaw(raw, targetAreaM2 * (1 - areaTolerance), targetAreaM2 * (1 + areaTolerance));
  if (areaMatched.length < 2) return null;

  const eokList = areaMatched.map((r) => r.amountManwon / 10000).sort((a, b) => a - b);
  const sampleSize = eokList.length;
  const percentileBased = sampleSize >= 5;
  const min = percentileBased ? percentile(eokList, 0.1) : eokList[0];
  const max = percentileBased ? percentile(eokList, 0.9) : eokList[eokList.length - 1];
  const median = percentile(eokList, 0.5);

  return {
    min: Math.round(min * 100) / 100,
    median: Math.round(median * 100) / 100,
    max: Math.round(max * 100) / 100,
    sampleSize,
    percentileBased,
  };
}
