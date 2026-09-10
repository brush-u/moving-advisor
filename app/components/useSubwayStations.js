"use client";

import { useEffect, useState } from "react";

// 지도 위에 지하철역 핀을 표시하기 위한 훅. lat/lng/radiusKm이 바뀔 때마다 /api/subway를
// 호출해 역 목록을 가져옵니다. 조회 실패/지연은 이 훅 안에서 조용히 빈 배열로 처리되어,
// 이 정보가 없어도 지도의 다른 기능(추천 결과, 매물 후보)에는 영향이 없습니다.
export default function useSubwayStations(lat, lng, radiusKm) {
  const [stations, setStations] = useState([]);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;

    fetch("/api/subway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, radiusKm }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setStations(json.stations || []);
      })
      .catch(() => {
        if (!cancelled) setStations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, radiusKm]);

  return stations;
}
