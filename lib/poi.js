/**
 * 지도 위에 지하철역/대형마트/백화점/병원/약국을 함께 표시하기 위해 OpenStreetMap의 무료
 * Overpass API로 반경 안의 시설 위치를 "최선을 다해(best-effort)" 가져옵니다.
 *
 * 예전엔 지하철역만 lib/subway.js로 따로 조회했는데, 사용자가 "지도에 지하철역, 대형마트,
 * 백화점, 병원, 약국 등을 표시해달라"고 요청해서 5개 카테고리를 한 번의 Overpass 질의로
 * 묶어 조회하도록 일반화했습니다(카테고리마다 따로 호출하면 왕복이 5배로 늘어남). 국토부
 * API처럼 서비스키가 필요 없지만, 공용 서버라 응답이 느리거나(수 초~십수 초) 가끔 실패할 수
 * 있습니다. 실패해도 지도의 다른 기능(추천 결과, 매물 후보)에는 전혀 영향이 없도록 항상 빈
 * 배열로 조용히 폴백합니다.
 */

import { netFetch, describeFetchError } from "./netFetch";

// lib/subway.js와 동일한 이유로 공개 미러 여러 곳을 순서대로 시도합니다.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const OVERPASS_USER_AGENT =
  "moving-advisor-prototype/0.1 (educational project; contact: set-your-email@example.com)";
const FETCH_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 시설 위치는 자주 안 바뀌니 30분 정도는 캐시를 재사용
const MAX_RADIUS_KM = 25;

export const POI_CATEGORIES = ["subway", "mart", "department", "hospital", "pharmacy"];

export const CATEGORY_LABELS = {
  subway: "지하철역",
  mart: "대형마트",
  department: "백화점",
  hospital: "병원",
  pharmacy: "약국",
};

// 지하철역/마트/백화점은 이름 없이 점만 찍히면 무슨 시설인지 알 수 없어 오히려 헷갈리므로
// (기존 지하철역 로직과 동일한 기준) 이름이 있는 것만 표시합니다. 반면 병원/약국은 국내
// OSM 태깅이 듬성듬성해서(건물 윤곽만 있고 이름 태그가 없는 경우가 흔함) 이름이 없어도
// "병원"/"약국"이라는 일반 라벨로라도 보여주는 편이 사용자에게 더 도움이 됩니다.
const REQUIRE_NAME = { subway: true, mart: true, department: true, hospital: false, pharmacy: false };

const EMPTY_POIS = Object.freeze({ subway: [], mart: [], department: [], hospital: [], pharmacy: [] });

const cache = new Map(); // key -> { at, pois }

function cacheKey(lat, lng, radiusKm) {
  return `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
}

function classify(tags) {
  if (!tags) return null;
  if (tags.railway === "station" && (tags.station === "subway" || tags.station === "light_rail")) return "subway";
  if (tags.shop === "supermarket") return "mart";
  if (tags.shop === "department_store") return "department";
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "pharmacy") return "pharmacy";
  return null;
}

/**
 * lat/lng 중심으로 radiusKm 안의 지하철역/대형마트/백화점/병원/약국을 카테고리별로 돌려줍니다.
 * 반환: { subway: [...], mart: [...], department: [...], hospital: [...], pharmacy: [...] }
 *   각 항목은 { id, name, lat, lng } (조회 실패 시 전부 빈 배열)
 */
export async function fetchNearbyPOIs(lat, lng, radiusKm) {
  if (lat == null || lng == null) return EMPTY_POIS;
  const boundedRadiusKm = Math.min(Math.max(Number(radiusKm) || 5, 1), MAX_RADIUS_KM);
  const key = cacheKey(lat, lng, boundedRadiusKm);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.pois;

  const radiusM = Math.round(boundedRadiusKm * 1000);
  const around = `around:${radiusM},${lat},${lng}`;
  // 병원/백화점/대형마트는 건물 하나 전체가 way(면)로 매핑된 경우가 흔해서 node뿐 아니라
  // way도 함께 조회하고, "out center;"로 way의 대표 좌표(중심점)를 함께 받습니다.
  const query =
    `[out:json][timeout:20];` +
    `(` +
    `node["railway"="station"]["station"="subway"](${around});` +
    `node["railway"="station"]["station"="light_rail"](${around});` +
    `node["shop"="supermarket"](${around});way["shop"="supermarket"](${around});` +
    `node["shop"="department_store"](${around});way["shop"="department_store"](${around});` +
    `node["amenity"="hospital"](${around});way["amenity"="hospital"](${around});` +
    `node["amenity"="pharmacy"](${around});` +
    `);out center;`;

  const errors = [];
  for (const url of OVERPASS_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res;
      try {
        res = await netFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": OVERPASS_USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) throw new Error(`overpass http ${res.status}`);
      const json = await res.json();
      const pois = { subway: [], mart: [], department: [], hospital: [], pharmacy: [] };
      (json.elements || []).forEach((el) => {
        const category = classify(el.tags);
        if (!category) return;
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (elLat == null || elLng == null) return;
        const name = el.tags?.name;
        if (REQUIRE_NAME[category] && !name) return;
        pois[category].push({
          id: `${el.type}/${el.id}`,
          name: name || CATEGORY_LABELS[category],
          lat: elLat,
          lng: elLng,
        });
      });
      cache.set(key, { at: Date.now(), pois });
      return pois;
    } catch (err) {
      errors.push(`${url}: ${describeFetchError(err)}`);
    }
  }
  console.warn(
    `[poi] 주변 시설 조회 실패(미러 ${OVERPASS_URLS.length}곳 모두 실패 — 지도에는 표시되지 않을 뿐, 다른 기능에는 영향 없음):\n  ` +
      errors.join("\n  ")
  );
  return EMPTY_POIS;
}
