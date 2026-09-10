/**
 * 이사 갈 지역 추천 스코어링 엔진.
 *
 * 4개 요소(예산, 통근, 학군, 치안·생활편의)를 각각 0~100점으로 정규화한 뒤
 * 사용자가 지정한 가중치로 합산합니다.
 */

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 직선거리를 대중교통 통근시간(분)으로 아주 단순하게 추정.
 * - 서울 시내 대중교통 평균 이동속도를 약 18km/h로 가정 (환승/대기 포함 체감 속도)
 * - 역까지 도보, 환승 등 고정 오버헤드로 12분을 더함
 * - 업무 중심지(hub) 자치구는 노선이 조밀해 최대 5분 보정 감산
 * 실제 서비스에서는 카카오모빌리티/ODsay 등 대중교통 경로 API로 교체하는 것을 권장합니다(README 참고).
 */
export function estimateCommuteMinutes(distanceKm, isHub) {
  const overhead = 12;
  const speedKmh = 18;
  const raw = overhead + (distanceKm / speedKmh) * 60;
  return Math.max(8, Math.round(raw - (isHub ? 5 : 0)));
}

export function distanceToWorkplace(district, workplace) {
  return haversineKm(district.lat, district.lng, workplace.lat, workplace.lng);
}

// 값이 낮을수록 좋은 지표(가격, 통근시간)를 0~100 점수로 뒤집어 정규화
function invertNormalize(value, min, max) {
  if (max === min) return 100;
  const ratio = (max - value) / (max - min);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

// 값이 높을수록 좋은 지표(학군, 치안·편의)를 0~100으로 정규화
function normalize(value, min, max) {
  if (max === min) return 100;
  const ratio = (value - min) / (max - min);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * 예산 적합도 점수: 사용자가 슬라이더로 고른 예산 범위(억원, [budgetMin, budgetMax])와 지역의
 * 예상 매매가(평당가 * 평수)를 비교합니다. 슬라이더 양끝(=범위 지정 없음, "전체")은 각각
 * null로 들어옵니다.
 * - 범위가 아예 없으면("전체") 중립값
 * - 범위 안이면 높은 점수(범위 중앙에 가까울수록 살짝 더 높음)
 * - 범위를 벗어나면 벗어난 정도에 비례해 감점(하한 미만이면 "너무 저렴해서 예산을 낭비"하는
 *   쪽에 가깝다고 보고 상한 초과보다는 감점을 약하게 줍니다)
 */
export function budgetFitScore(estimatedTotalEok, budgetMin, budgetMax) {
  if (budgetMin == null && budgetMax == null) return 50; // "전체"(범위 지정 없음) -> 중립값
  const lo = budgetMin != null ? budgetMin : 0;
  const hi = budgetMax != null ? budgetMax : Infinity;

  if (estimatedTotalEok >= lo && estimatedTotalEok <= hi) {
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi === lo) return 96;
    const mid = (lo + hi) / 2;
    const halfWidth = (hi - lo) / 2;
    const distFromMid = Math.abs(estimatedTotalEok - mid) / halfWidth; // 0(중앙)~1(양끝)
    return Math.round(100 - distFromMid * 8); // 92~100
  }

  if (estimatedTotalEok > hi) {
    const scale = Number.isFinite(hi) && hi > 0 ? hi : 1;
    const overshoot = (estimatedTotalEok - hi) / scale;
    return Math.max(0, Math.round(90 - overshoot * 140));
  }
  // estimatedTotalEok < lo (예산 하한보다 저렴한 지역 — 너무 낮춰 잡은 것일 수 있어 약하게만 감점)
  const scale = lo > 0 ? lo : 1;
  const undershoot = (lo - estimatedTotalEok) / scale;
  return Math.max(40, Math.round(90 - undershoot * 60));
}

/**
 * districts는 전국 250개 이상 지역을 포함할 수 있고, 이름이 같은 지역(예: "중구"가 여러 시/도에
 * 존재)이 섞여 있을 수 있어 이름이 아니라 고유한 lawdCd(법정동코드)로 매칭합니다.
 *
 * 서울 25개 구는 학군/치안/생활편의 지수와 참고 평당가가 실제로 조사되어 있지만, 나머지 전국
 * 지역은 아직 조사되지 않아 pricePerPyeong/schoolIndex/safetyIndex/amenityIndex가 null입니다
 * (d.indexResearched === false). 이런 지역은 해당 항목 점수를 중립값(50점)으로 대체하고,
 * detail에 priceResearched/indexResearched 플래그를 그대로 남겨 화면에서 "조사 참고값 없음"을
 * 정직하게 표시할 수 있게 합니다 — 실거래가 API 키가 설정되어 있다면 pricePerPyeong은 실시간
 * 조회값으로 채워질 수 있으므로(호출부 참고), 이 플래그는 어디까지나 "정적 참고값" 유무입니다.
 */
export function scoreDistricts({ districts, workplace, budgetMin, budgetMax, pyeong, weights }) {
  const commuteRaw = new Map();
  districts.forEach((d) => {
    const distanceKm = workplace ? distanceToWorkplace(d, workplace) : null;
    const minutes = distanceKm != null ? estimateCommuteMinutes(distanceKm, d.hub) : null;
    commuteRaw.set(d.lawdCd, { minutes, distanceKm });
  });
  const minutesList = Array.from(commuteRaw.values()).filter((c) => c.minutes != null).map((c) => c.minutes);
  const minMinutes = minutesList.length ? Math.min(...minutesList) : 0;
  const maxMinutes = minutesList.length ? Math.max(...minutesList) : 1;

  const results = districts.map((d) => {
    const hasPrice = d.pricePerPyeong != null;
    const estimatedTotalEok = hasPrice ? (d.pricePerPyeong * pyeong) / 10000 : null; // 만원 -> 억원
    const priceScore = hasPrice ? budgetFitScore(estimatedTotalEok, budgetMin, budgetMax) : 50;

    const commuteInfo = commuteRaw.get(d.lawdCd);
    const commuteScore =
      commuteInfo && commuteInfo.minutes != null
        ? invertNormalize(commuteInfo.minutes, minMinutes, maxMinutes)
        : 50;

    const hasIndex =
      d.indexResearched !== false && d.schoolIndex != null && d.safetyIndex != null && d.amenityIndex != null;
    const schoolScore = hasIndex ? d.schoolIndex : 50;
    const lifeScore = hasIndex ? Math.round(d.safetyIndex * 0.5 + d.amenityIndex * 0.5) : 50;

    const wSum =
      weights.price + weights.commute + weights.school + weights.life || 1;
    const total =
      (priceScore * weights.price +
        commuteScore * weights.commute +
        schoolScore * weights.school +
        lifeScore * weights.life) /
      wSum;

    return {
      name: d.name,
      sido: d.sido,
      lawdCd: d.lawdCd,
      total: Math.round(total * 10) / 10,
      breakdown: {
        price: priceScore,
        commute: commuteScore,
        school: schoolScore,
        life: lifeScore,
      },
      detail: {
        pricePerPyeong: d.pricePerPyeong,
        estimatedTotalEok: estimatedTotalEok != null ? Math.round(estimatedTotalEok * 100) / 100 : null,
        commuteMinutes: commuteInfo ? commuteInfo.minutes : null,
        distanceKm: commuteInfo && commuteInfo.distanceKm != null ? Math.round(commuteInfo.distanceKm * 10) / 10 : null,
        safetyIndex: d.safetyIndex,
        amenityIndex: d.amenityIndex,
        schoolIndex: d.schoolIndex,
        priceLive: Boolean(d._priceLive),
        priceDealYmd: d._priceDealYmd || null,
        priceResearched: hasPrice,
        indexResearched: hasIndex,
      },
    };
  });

  results.sort((a, b) => b.total - a.total);
  return results;
}
