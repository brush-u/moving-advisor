import { NextResponse } from "next/server";
import { fetchNearbyPOIs } from "../../../lib/poi";

// 지도에 표시된 위치 주변의 지하철역/대형마트/백화점/병원/약국을 가져옵니다. 추천 결과
// 자체와는 무관한 "곁들이는" 정보라, 이 조회가 느리거나 실패해도 추천 결과 API
// (/api/recommend)에는 전혀 영향이 없도록 별도 엔드포인트로 분리했습니다(예전 /api/subway와
// 같은 구조이며, 5개 카테고리를 한 번에 묶어 조회하도록 대체합니다).
export async function POST(request) {
  try {
    const { lat, lng, radiusKm } = await request.json();
    if (lat == null || lng == null) {
      return NextResponse.json({ error: "lat/lng가 필요합니다." }, { status: 400 });
    }
    const pois = await fetchNearbyPOIs(Number(lat), Number(lng), Number(radiusKm) || 8);
    return NextResponse.json({ pois });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
