import { NextResponse } from "next/server";
import { fetchNearbySubwayStations } from "../../../lib/subway";

// 지도에 표시된 위치 주변의 지하철역을 가져옵니다. 추천 결과 자체와는 무관한 "곁들이는" 정보라,
// 이 조회가 느리거나 실패해도 추천 결과 API(/api/recommend)에는 전혀 영향이 없도록 별도
// 엔드포인트로 분리했습니다(프런트에서 결과가 뜬 뒤 이어서 호출합니다).
export async function POST(request) {
  try {
    const { lat, lng, radiusKm } = await request.json();
    if (lat == null || lng == null) {
      return NextResponse.json({ error: "lat/lng가 필요합니다." }, { status: 400 });
    }
    const stations = await fetchNearbySubwayStations(Number(lat), Number(lng), Number(radiusKm) || 8);
    return NextResponse.json({ stations });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
