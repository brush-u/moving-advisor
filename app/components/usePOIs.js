"use client";

import { useEffect, useState } from "react";

const EMPTY_POIS = { subway: [], mart: [], department: [], hospital: [], pharmacy: [] };

// 지도 위에 지하철역/대형마트/백화점/병원/약국 핀을 표시하기 위한 훅. lat/lng/radiusKm이
// 바뀔 때마다 /api/poi를 호출해 카테고리별 시설 목록을 가져옵니다. 조회 실패/지연은 이 훅
// 안에서 조용히 빈 목록으로 처리되어, 이 정보가 없어도 지도의 다른 기능(추천 결과, 매물
// 후보)에는 영향이 없습니다(useSubwayStations.js와 같은 구조이며, 카테고리 5개를 한 번에
// 묶어 조회하도록 대체합니다).
export default function usePOIs(lat, lng, radiusKm) {
  const [pois, setPois] = useState(EMPTY_POIS);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;

    fetch("/api/poi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, radiusKm }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setPois({ ...EMPTY_POIS, ...json.pois });
      })
      .catch(() => {
        if (!cancelled) setPois(EMPTY_POIS);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, radiusKm]);

  return pois;
}
