import { NextResponse } from "next/server";
import { districts as baseDistricts, findDistrictByCode } from "../../../lib/districts";
import { findWorkplace, workplaces } from "../../../lib/workplaces";
import { scoreDistricts, haversineKm } from "../../../lib/scoring";
import { fetchAvgPricePerPyeong, isServiceKeyConfigured, HOUSE_TYPES, DEAL_TYPES } from "../../../lib/molit";
import { findCandidates } from "../../../lib/candidates";

// 구 하나당 화면(API 응답)에 담아 보낼 매물 후보 최대 개수. 인위적으로 20~30건에서 끊지
// 않고, findCandidates가 실제로 조회·중복제거한 만큼(최근 monthsBack개월치 실거래 전부)을
// 그대로 넘깁니다 — "더보기"를 누를 때마다 화면에서 몇 건씩 더 펼쳐 보여주는 건
// RankFlow.js의 CandidateList가 이미 받은 이 배열 안에서 처리하므로, 여기서 한도를 너무
// 낮게 잡으면 아무리 더보기를 눌러도 그 이상은 볼 수 없게 됩니다.
const CANDIDATE_LIMIT_PER_DISTRICT = Infinity;
const NEAREST_FALLBACK_COUNT = 10; // 반경 안에 지역이 하나도 없을 때 대신 보여줄 최근접 지역 수
const DEFAULT_RADIUS_KM = 15;

// 프런트엔드 예산/평형 슬라이더의 양 끝값 — 손잡이가 이 끝에 그대로 있으면 "전체"(범위 지정
// 없음)로 취급합니다. 이 값들은 app/components/RankFlow.js의 BUDGET_RANGE/PYEONG_RANGE와
// 반드시 같아야 합니다.
const BUDGET_FLOOR = 0;
const BUDGET_CEIL = 40;
const PYEONG_FLOOR = 0;
const PYEONG_CEIL = 60;
const DEFAULT_REPRESENTATIVE_PYEONG = 25; // 평형을 "전체"로 두었을 때 지역 예상 총액 계산에 쓸 대표값

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      workplaceId,
      customLat,
      customLng,
      originLat, // 지도에서 클릭했거나 "내 위치"로 찾은 검색 중심점 (신규 지도 우선 플로우)
      originLng,
      originLabel,
      searchMode, // "radius" | "sido" (신규 지도 우선 플로우에서만 사용)
      radiusKm,
      sido,
      budgetMin, // 목표예산 슬라이더 최소값(억원). BUDGET_FLOOR 그대로면 "하한 없음"으로 취급
      budgetMax, // 목표예산 슬라이더 최대값(억원). BUDGET_CEIL 그대로면 "상한 없음"으로 취급
      pyeongMin, // 원하는 평형 슬라이더 최소값. PYEONG_FLOOR 그대로면 "하한 없음"
      pyeongMax, // 원하는 평형 슬라이더 최대값. PYEONG_CEIL 그대로면 "상한 없음"
      weights, // { price, commute, school, life } 0~100
      houseType, // "apt" | "rh" | "offi"
      dealType, // "trade" | "jeonse" | "wolse"
      maxBuildAge, // 숫자(년) 또는 0/null = 제한 없음
      desiredRooms, // 숫자 또는 0 = 제한 없음
      desiredBathrooms, // 숫자 또는 0 = 제한 없음
    } = body;

    // 신규 지도 우선 플로우는 지도에서 고른 위치(originLat/Lng)를 우선 사용하고,
    // 예전 방식(직장 드롭다운·직접 좌표 입력)은 하위 호환으로 계속 지원합니다.
    let workplace = null;
    if (originLat != null && originLng != null) {
      workplace = { name: originLabel || "선택한 위치", lat: Number(originLat), lng: Number(originLng) };
    } else if (workplaceId === "custom") {
      if (customLat != null && customLng != null) {
        workplace = { name: "직접 입력한 위치", lat: Number(customLat), lng: Number(customLng) };
      }
    } else {
      const w = findWorkplace(workplaceId);
      if (w) workplace = w;
    }

    // 반경/시도로 후보 지역 자체를 먼저 좁힙니다 — 전국 250개 이상을 매번 다 조회하지 않아
    // 실거래가 API 호출 수도 줄고(429 위험 감소), 결과도 사용자가 지정한 범위 안으로 좁혀집니다.
    let poolDistricts = baseDistricts;
    let effectiveRadiusKm = null;
    if (searchMode === "sido" && sido) {
      poolDistricts = baseDistricts.filter((d) => d.sido === sido);
    } else if (searchMode === "radius" && workplace) {
      effectiveRadiusKm = Number(radiusKm) > 0 ? Number(radiusKm) : DEFAULT_RADIUS_KM;
      poolDistricts = baseDistricts.filter(
        (d) => haversineKm(d.lat, d.lng, workplace.lat, workplace.lng) <= effectiveRadiusKm
      );
      if (poolDistricts.length === 0) {
        // 반경이 너무 좁아 하나도 안 걸리면(예: 도서산간), 가장 가까운 지역들로 안전하게 대체
        poolDistricts = [...baseDistricts]
          .sort(
            (a, b) =>
              haversineKm(a.lat, a.lng, workplace.lat, workplace.lng) -
              haversineKm(b.lat, b.lng, workplace.lat, workplace.lng)
          )
          .slice(0, NEAREST_FALLBACK_COUNT);
      }
    }

    // 슬라이더가 양끝(전체)에 그대로 있으면 그쪽 경계는 "지정 안 함"(null)으로 취급합니다.
    const budgetMinNum = Number(budgetMin) > BUDGET_FLOOR ? Number(budgetMin) : null;
    const budgetMaxRaw = Number(budgetMax);
    const budgetMaxNum = budgetMaxRaw > 0 && budgetMaxRaw < BUDGET_CEIL ? budgetMaxRaw : null;

    const pyeongMinRaw = Number(pyeongMin);
    const pyeongMaxRaw = Number(pyeongMax);
    const pyeongIsAll =
      !(pyeongMinRaw > PYEONG_FLOOR) && !(pyeongMaxRaw > 0 && pyeongMaxRaw < PYEONG_CEIL);
    const pyeongMinNum = pyeongMinRaw > PYEONG_FLOOR ? pyeongMinRaw : PYEONG_FLOOR;
    const pyeongMaxNum = pyeongMaxRaw > 0 ? pyeongMaxRaw : PYEONG_CEIL;
    // 지역별 "예상 총액"(랭킹용)은 평형 범위의 대표값(중앙값)으로 계산합니다 — 범위가 "전체"이면
    // 특정 평형을 가정할 수 없으니 앱 전체에서 쓰는 기본 평형(25평)을 대표값으로 씁니다.
    const pyeongNum = pyeongIsAll ? DEFAULT_REPRESENTATIVE_PYEONG : (pyeongMinNum + pyeongMaxNum) / 2;

    const houseTypeKey = HOUSE_TYPES[houseType] ? houseType : "apt";
    const dealTypeKey = DEAL_TYPES[dealType] ? dealType : "trade";
    const maxBuildAgeNum = Number(maxBuildAge) > 0 ? Number(maxBuildAge) : 0;
    const desiredRoomsNum = Number(desiredRooms) > 0 ? Number(desiredRooms) : 0;
    const desiredBathroomsNum = Number(desiredBathrooms) > 0 ? Number(desiredBathrooms) : 0;

    const safeWeights = {
      price: Number(weights?.price) || 0,
      commute: Number(weights?.commute) || 0,
      school: Number(weights?.school) || 0,
      life: Number(weights?.life) || 0,
    };
    if (Object.values(safeWeights).every((v) => v === 0)) {
      safeWeights.price = safeWeights.commute = safeWeights.school = safeWeights.life = 25;
    }

    const liveEnabled = isServiceKeyConfigured();

    // 실거래가 API 키가 설정된 경우에만 실시간 조회를 시도하고, 실패/미설정 시 조사된 참고값으로 폴백
    const enrichedDistricts = await Promise.all(
      poolDistricts.map(async (d) => {
        if (!liveEnabled) return d;
        const live = await fetchAvgPricePerPyeong(d.lawdCd, houseTypeKey, dealTypeKey);
        if (!live) return d;
        return {
          ...d,
          pricePerPyeong: live.pricePerPyeong,
          _priceLive: true,
          _priceDealYmd: live.dealYmd,
        };
      })
    );

    const results = scoreDistricts({
      districts: enrichedDistricts,
      workplace,
      budgetMin: budgetMinNum,
      budgetMax: budgetMaxNum,
      pyeong: pyeongNum,
      weights: safeWeights,
    });

    // 검색 대상(poolDistricts) 전체에 대해 "실제 매물 후보"를 조회합니다(API 키가 있을 때만
    // 의미 있음) — 예전엔 상위 10개 지역만 조회하고 나머지는 "미조회" 안내만 띄웠는데,
    // 사용자가 "화면에 보이는 순위와 상관없이 대상 지역 전체를 조회해달라, 임의로 자르지
    // 말라"고 요청해서 이 지역 수 제한을 완전히 없앴습니다. 지역이 많은 시/도(경기도 등)나
    // 반경을 넓게 잡은 경우 그만큼 실거래가 API 호출도 늘어나 응답이 느려질 수 있지만,
    // 한 구에서 조회가 실패해도(예: 실거래 API가 예상과 다른 응답을 주는 경우) 다른 구나
    // 전체 응답이 함께 무너지지 않도록 구별로 개별적으로 안전망을 둡니다.
    let candidatesByDistrict = {};
    const candidateErrors = {};
    if (liveEnabled) {
      const allDistrictCodes = results.map((r) => r.lawdCd);
      const entries = await Promise.all(
        allDistrictCodes.map(async (lawdCd) => {
          const district = findDistrictByCode(lawdCd);
          if (!district) return [lawdCd, []];
          try {
            const list = await findCandidates({
              district,
              houseType: houseTypeKey,
              dealType: dealTypeKey,
              pyeongMin: pyeongIsAll ? null : pyeongMinNum,
              pyeongMax: pyeongIsAll ? null : pyeongMaxNum,
              maxBuildAge: maxBuildAgeNum,
              desiredRooms: desiredRoomsNum,
              desiredBathrooms: desiredBathroomsNum,
              budgetMin: budgetMinNum,
              budgetMax: budgetMaxNum,
              // budgetMin/budgetMax로 이미 하드 필터링되므로, 통과한 후보는 전부 "예산 이내"로
              // 표시되게 budgetEok(배지용)도 상한값으로 함께 넘깁니다(② 모드와 같은 관례).
              budgetEok: budgetMaxNum,
              // 기본값(4건)은 실제 거래가 활발한 구에서는 너무 적어서, 조회·중복제거된 만큼
              // 전부 화면까지 전달합니다(화면에서는 처음엔 4건만 보여주고 "더보기"를 누를
              // 때마다 더 펼쳐 보여줍니다 — CANDIDATE_LIMIT_PER_DISTRICT 주석 참고).
              limit: CANDIDATE_LIMIT_PER_DISTRICT,
            });
            return [lawdCd, list];
          } catch (err) {
            candidateErrors[lawdCd] = String(err?.message || err);
            return [lawdCd, []];
          }
        })
      );
      candidatesByDistrict = Object.fromEntries(entries);
    }

    return NextResponse.json({
      results,
      candidatesByDistrict,
      meta: {
        liveEnabled,
        workplace: workplace ? { name: workplace.name, lat: workplace.lat, lng: workplace.lng } : null,
        searchMode: searchMode === "sido" ? "sido" : searchMode === "radius" ? "radius" : null,
        radiusKm: effectiveRadiusKm,
        sido: searchMode === "sido" ? sido || null : null,
        districtPoolSize: poolDistricts.length,
        pyeong: pyeongNum,
        pyeongMin: pyeongIsAll ? null : pyeongMinNum,
        pyeongMax: pyeongIsAll ? null : pyeongMaxNum,
        budgetMin: budgetMinNum,
        budgetMax: budgetMaxNum,
        weights: safeWeights,
        houseType: houseTypeKey,
        houseTypeLabel: HOUSE_TYPES[houseTypeKey].label,
        dealType: dealTypeKey,
        dealTypeLabel: DEAL_TYPES[dealTypeKey].label,
        maxBuildAge: maxBuildAgeNum,
        desiredRooms: desiredRoomsNum,
        desiredBathrooms: desiredBathroomsNum,
        candidateErrors: Object.keys(candidateErrors).length ? candidateErrors : undefined,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    workplaces,
    houseTypes: HOUSE_TYPES,
    dealTypes: DEAL_TYPES,
    liveEnabled: isServiceKeyConfigured(),
  });
}
