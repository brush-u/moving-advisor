import { enrichCandidatesWithCoords } from "../../../lib/geocode";

// ①모드(지도 우선) 결과 지도에 "실제 매물 후보" 핀을 찍기 위한 지오코딩 전용 엔드포인트.
// /api/recommend 응답에 지오코딩까지 포함시키면(구당 최대 몇 건 x 여러 구) Nominatim의
// 초당 1건 제한 때문에 추천 결과 자체가 10초 이상 늦게 뜨게 됩니다. 그래서 추천 결과(순위,
// 예산 점수, 매물 목록)는 먼저 즉시 보여주고, 지도 핀 좌표는 이 엔드포인트로 따로, 화면이
// 뜬 뒤에 이어서 조회합니다.
//
// 처음엔 지역 10곳 전부를 다 조회한 뒤 한 번에 응답했는데, 사용자가 "핀 꽂는 애니메이션이
// 너무 느리다, 지오코딩으로 빠르게 할 수 있으면 그렇게 해달라"고 요청했습니다. 실제로 느렸던
// 이유는 두 가지였습니다: (1) 지역이 다 끝날 때까지 기다렸다가 한꺼번에 응답하니 화면에
// 아무것도 안 뜨는 "먹통 구간"이 길었고, (2) 그 응답이 오면 50개 핀이 한꺼번에 긴 순서로
// 줄줄이 떨어지는 애니메이션이 재생돼 다 끝나는 데 또 시간이 걸렸습니다. 그래서:
//   1) 지역이 끝나는 대로 그 지역 결과를 즉시 한 줄(NDJSON)로 흘려보냅니다(스트리밍) — 첫
//      지역은 거의 바로 도착하고, 나머지는 이어서 도착하는 대로 그때그때 핀이 꽂힙니다.
//   2) 구당 지도에 찍는 매물 수를 5→3건으로, 실제 지오코딩 총 한도도 20→10건으로 줄여서
//      "진짜 좌표를 찾는" 지오코딩 자체의 총 소요 시간도 줄였습니다(나머지는 지역 중심 근처에
//      흩뿌려 표시 — 정확도보다 체감 속도를 우선한 트레이드오프입니다).
const TOTAL_GEOCODE_BUDGET = 10; // 요청 하나당 실제 Nominatim 조회 총 개수 상한(나머지는 지역 중심 근처에 흩뿌려 표시)

export async function POST(request) {
  const { districts } = await request.json().catch(() => ({}));
  if (!Array.isArray(districts)) {
    return new Response(JSON.stringify({ error: "districts 배열이 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const budget = { remaining: TOTAL_GEOCODE_BUDGET };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const d of districts) {
        if (!d || !Array.isArray(d.candidates) || d.candidates.length === 0) continue;
        try {
          const enriched = await enrichCandidatesWithCoords(
            d.candidates,
            { lat: d.lat, lng: d.lng },
            d.sido,
            d.name,
            budget
          );
          const coords = enriched.map((c) => ({ idx: c.idx, lat: c.lat, lng: c.lng, geocoded: c.geocoded }));
          controller.enqueue(encoder.encode(JSON.stringify({ lawdCd: d.lawdCd, coords }) + "\n"));
        } catch (err) {
          // 이 지역 하나만 건너뛰고(핀 없이) 나머지 지역은 계속 스트리밍합니다.
          console.warn(`[candidate-coords] ${d.lawdCd} 좌표 조회 중 오류(이 지역은 핀 없이 넘어감): ${err?.message || err}`);
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
