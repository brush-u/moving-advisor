import { NextResponse } from "next/server";
import { computeTrendsForDistricts } from "../../../lib/marketTrend";
import { isServiceKeyConfigured } from "../../../lib/molit";

// 추천 결과 화면 하단의 "지역별·월별 실거래 추이" 차트용 데이터를 가져옵니다. 추천 결과
// 자체(/api/recommend)와는 무관한 곁들이는 정보라 별도 엔드포인트로 분리했고, API 키가 없으면
// (liveEnabled=false) 빈 결과를 조용히 돌려줘 화면에서는 차트 섹션 자체가 나타나지 않습니다.
export async function POST(request) {
  try {
    const { lawdCds, houseType, dealType } = await request.json();
    if (!Array.isArray(lawdCds) || lawdCds.length === 0 || !isServiceKeyConfigured()) {
      return NextResponse.json({ trends: {} });
    }
    const trends = await computeTrendsForDistricts({ lawdCds, houseType, dealType });
    return NextResponse.json({ trends });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
