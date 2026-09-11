/**
 * 지역별·월별 실거래 추이(거래 건수, 평균 거래금액)를 계산합니다. "조회하는 그날까지의
 * 부동산 거래 추이를 챠트로 보고 싶다"는 요청에 따라, 어느 지역이 활발히 거래되는지(건수)와
 * 거래금액이 오르는지 내리는지(평균 거래금액)를 지역별로 비교할 수 있게 하는 것이 목적입니다.
 *
 * 국토부 API가 월 단위로만 조회되므로, 이미 있는 fetchRecentListings(monthsBack)로 최근
 * 몇 개월치 개별 거래 원자료를 한 번에 받아와서 dealYmd(YYYYMMDD, 8자리 — README 36번에서
 * dealYear/dealMonth/dealDay를 조합해 정밀하게 만든 값)의 앞 6자리(YYYYMM)로 묶기만 하면
 * 되므로, molit.js 자체는 건드리지 않습니다.
 */

import { fetchRecentListings, isServiceKeyConfigured } from "./molit";

export const MARKET_TREND_MONTHS_BACK = 6;
// 지역 하나당 최대 6개월어치 원자료 조회가 필요해, 지역 수를 너무 늘리면 국토부 API 호출이
// 크게 늘어납니다(기존 매물 후보 조회에 쓰는 레이트리밋 인프라를 그대로 재사용하지만, 화면에
// 넣을 수 있는 지역 수도 어차피 제한적이라 상위 몇 곳으로 캡을 둡니다).
export const MAX_TREND_DISTRICTS = 6;

function monthKey(offset) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 한 지역의 최근 monthsBack개월 월별 거래 추이를 반환합니다.
 * 반환: [{ ym, count, avgEok }, ...] (과거 → 현재 순, 거래가 0건인 달도 count:0으로 채움)
 *   avgEok은 그 달 거래금액(매매가/전월세 보증금 — lib/candidates.js와 동일한 amountManwon
 *   기준)의 평균을 억원 단위로 반올림한 값이며, 거래가 0건이면 null입니다(0원이 아니라
 *   "그 달은 알 수 없음"이라는 뜻이라 0으로 그리면 하락한 것처럼 오해할 수 있어 구분합니다).
 */
export async function computeMonthlyTrend({ lawdCd, houseType = "apt", dealType = "trade", monthsBack = MARKET_TREND_MONTHS_BACK }) {
  if (!isServiceKeyConfigured()) return [];
  const items = await fetchRecentListings(lawdCd, houseType, monthsBack, dealType);

  const buckets = new Map(); // ym -> { count, sumEok }
  for (const it of items) {
    if (!it.dealYmd || it.dealYmd.length < 6) continue;
    const ym = it.dealYmd.slice(0, 6);
    const eok = it.amountManwon / 10000;
    if (!Number.isFinite(eok)) continue;
    const bucket = buckets.get(ym) || { count: 0, sumEok: 0 };
    bucket.count += 1;
    bucket.sumEok += eok;
    buckets.set(ym, bucket);
  }

  const months = Array.from({ length: monthsBack }, (_, i) => monthKey(monthsBack - 1 - i));
  return months.map((ym) => {
    const bucket = buckets.get(ym);
    return {
      ym,
      count: bucket ? bucket.count : 0,
      avgEok: bucket ? Math.round((bucket.sumEok / bucket.count) * 100) / 100 : null,
    };
  });
}

/**
 * 여러 지역의 월별 추이를 한 번에 계산합니다(상위 MAX_TREND_DISTRICTS개까지만).
 * 반환: { [lawdCd]: [{ym,count,avgEok}, ...] } — 지역 하나가 실패해도 그 지역만 빈 배열로
 * 남고 나머지 지역은 정상적으로 반환됩니다(차트는 곁들이는 정보라, 일부 실패가 추천 결과
 * 자체에 영향을 주면 안 됩니다).
 */
export async function computeTrendsForDistricts({ lawdCds, houseType, dealType, monthsBack }) {
  if (!isServiceKeyConfigured()) return {};
  const limited = (lawdCds || []).slice(0, MAX_TREND_DISTRICTS);
  const entries = await Promise.all(
    limited.map(async (lawdCd) => {
      try {
        const trend = await computeMonthlyTrend({ lawdCd, houseType, dealType, monthsBack });
        return [lawdCd, trend];
      } catch (err) {
        console.warn(`[marketTrend] ${lawdCd} 거래 추이 계산 실패: ${err?.message || err}`);
        return [lawdCd, []];
      }
    })
  );
  return Object.fromEntries(entries);
}
