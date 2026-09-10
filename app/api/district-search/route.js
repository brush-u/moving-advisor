import { NextResponse } from "next/server";
import { findDistrictByCode } from "../../../lib/districts";
import { HOUSE_TYPES, DEAL_TYPES, isServiceKeyConfigured } from "../../../lib/molit";
import { findCandidates, computePriceRange } from "../../../lib/candidates";
import { enrichCandidatesWithCoords } from "../../../lib/geocode";

/**
 * "지역 먼저 선택" 플로우 전용 API.
 * 1) 구/시/군을 고르면 그 지역·평형·주택유형·거래유형 기준 "필요 예산" 범위를 계산해서 돌려주고
 *    (자동 폴백 포함)
 * 2) 예산 범위(+집 조건)를 함께 보내면 그 조건에 맞는 실제 매물 후보를 지도용 좌표까지 붙여 반환합니다.
 *
 * 지역은 이름이 아니라 lawdCd(법정동코드)로 식별합니다 — 전국에는 "중구"처럼 같은 이름을 쓰는
 * 지역이 여러 곳 있어 이름만으로는 어느 지역인지 특정할 수 없기 때문입니다.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lawdCd,
      houseType,
      dealType,
      pyeong,
      maxBuildAge,
      desiredRooms,
      desiredBathrooms,
      budgetMin,
      budgetMax,
      mode, // "estimate" (예산 힌트만) | "search" (매물 후보까지)
    } = body;

    const district = findDistrictByCode(lawdCd);
    if (!district) {
      return NextResponse.json({ error: "알 수 없는 지역입니다." }, { status: 400 });
    }

    const houseTypeKey = HOUSE_TYPES[houseType] ? houseType : "apt";
    const dealTypeKey = DEAL_TYPES[dealType] ? dealType : "trade";
    const pyeongNum = Number(pyeong) > 0 ? Number(pyeong) : 25;
    const liveEnabled = isServiceKeyConfigured();

    // 예산 힌트: 실거래 표본이 있으면 실제 표본 기반 범위, 없으면 조사 참고 평당가로 추정.
    // 서울 25개 구 외 나머지 전국 지역은 조사 참고 평당가(district.pricePerPyeong)가 아직 없어서
    // (indexResearched: false) 실거래 표본도 없고 참고값도 없으면 estimatedRange가 null일 수
    // 있습니다 — 이 경우 화면에서 "예산 참고값 없음"을 정직하게 보여주고 사용자가 직접 입력하게
    // 합니다.
    let priceRange = null;
    let estimateError = null;
    if (liveEnabled) {
      try {
        priceRange = await computePriceRange({ district, houseType: houseTypeKey, dealType: dealTypeKey, pyeong: pyeongNum });
      } catch (err) {
        // 국토부 API 인증/서비스 오류 등으로 실시간 조회가 실패해도 조사 참고값으로 안전하게
        // 폴백하되, 원인은 estimateError로 화면에 보여줘서 "왜 매물이 하나도 안 나오는지"를
        // 사용자가 바로 알 수 있게 합니다(이 오류는 보통 매물 검색 단계에서도 그대로 재현됩니다).
        estimateError = String(err?.message || err);
      }
    }
    let estimatedRange = priceRange;
    if (!estimatedRange && district.pricePerPyeong != null) {
      const seedEstimateCenter = (district.pricePerPyeong * pyeongNum) / 10000;
      estimatedRange = {
        min: Math.round(seedEstimateCenter * 0.82 * 100) / 100,
        median: Math.round(seedEstimateCenter * 100) / 100,
        max: Math.round(seedEstimateCenter * 1.18 * 100) / 100,
        sampleSize: 0,
        seedFallback: true,
      };
    }

    const responseBase = {
      liveEnabled,
      district: { name: district.name, sido: district.sido, lawdCd: district.lawdCd, lat: district.lat, lng: district.lng },
      estimatedRange, // null일 수 있음 — 실거래 표본도 조사 참고값도 없는 지역
      estimateError,
      houseTypeLabel: HOUSE_TYPES[houseTypeKey].label,
      dealTypeLabel: DEAL_TYPES[dealTypeKey].label,
      dealType: dealTypeKey,
    };

    if (mode === "estimate" || !liveEnabled) {
      return NextResponse.json({ ...responseBase, candidates: [] });
    }

    const budgetMinNum = budgetMin != null && budgetMin !== "" ? Number(budgetMin) : null;
    const budgetMaxNum = budgetMax != null && budgetMax !== "" ? Number(budgetMax) : null;
    const maxBuildAgeNum = Number(maxBuildAge) > 0 ? Number(maxBuildAge) : 0;
    const desiredRoomsNum = Number(desiredRooms) > 0 ? Number(desiredRooms) : 0;
    const desiredBathroomsNum = Number(desiredBathrooms) > 0 ? Number(desiredBathrooms) : 0;

    let candidates = [];
    let candidateError = null;
    try {
      candidates = await findCandidates({
        district,
        houseType: houseTypeKey,
        dealType: dealTypeKey,
        pyeong: pyeongNum,
        maxBuildAge: maxBuildAgeNum,
        desiredRooms: desiredRoomsNum,
        desiredBathrooms: desiredBathroomsNum,
        budgetMin: budgetMinNum,
        budgetMax: budgetMaxNum,
        // budgetMin/budgetMax로 이미 하드 필터링되므로, 뱃지/지도 색상용 budgetEok도 함께 넘겨
        // 통과한 후보가 모두 "예산 이내"로 표시되게 합니다.
        budgetEok: budgetMaxNum,
        limit: 15,
      });
      candidates = await enrichCandidatesWithCoords(candidates, { lat: district.lat, lng: district.lng }, district.sido, district.name);
    } catch (err) {
      // 실거래 API 응답 형식이 예상과 달라 파싱이 깨지는 등의 문제가 있어도, 화면에는
      // "매물 없음" 상태로 안전하게 보여주고 원인은 candidateError로 남깁니다.
      candidateError = String(err?.message || err);
      candidates = [];
    }

    return NextResponse.json({ ...responseBase, candidates, candidateError });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
