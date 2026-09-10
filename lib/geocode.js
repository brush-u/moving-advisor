/**
 * 지도에 실제 매물 후보를 표시하려면 각 후보의 위도/경도가 필요한데, 국토교통부
 * 실거래가 API는 좌표를 주지 않고 "법정동 + 단지명" 정도의 텍스트 주소만 줍니다.
 *
 * 이 모듈은 OpenStreetMap의 무료 Nominatim 지오코딩 서비스로 "최선을 다해(best-effort)"
 * 좌표를 찾습니다. 어떤 API 키도 필요 없지만 두 가지 한계가 있습니다:
 *   1) Nominatim 사용 정책상 초당 1건으로 제한해야 해서, 매물이 많으면 응답이 느려집니다
 *      (구별로 최대 NOMINATIM_MAX_LOOKUPS건까지만 지오코딩합니다).
 *   2) 개별 아파트 단지명까지는 정확히 찾지 못할 수 있어, 실패하면 그 구의 중심좌표 근처에
 *      살짝 흩뿌려(jitter) 표시하고 "정확한 위치 아님"이라고 표시합니다.
 * 더 정확하고 빠른 위치가 필요하면 카카오/네이버 지도의 로컬 검색 API(키 필요)로
 * 교체하는 것을 권장합니다 (README 참고).
 */

import { netFetch } from "./netFetch";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "moving-advisor-prototype/0.1 (educational project; contact: set-your-email@example.com)";
const MIN_INTERVAL_MS = 1100; // Nominatim 정책: 초당 1건 이하
const FETCH_TIMEOUT_MS = 8000; // Nominatim이 응답을 안 주고 멈춰버리면(타임아웃 없으면) 이후 모든
                                 // 대기 중인 지오코딩 요청까지 큐에서 함께 멈춰버리므로 반드시 필요
const cache = new Map();

let lastCallAt = 0;
let queue = Promise.resolve();

function jitter(lat, lng, seed) {
  // 실패 시 구 중심 좌표 근처에 결정적(deterministic)으로 흩뿌려 매번 같은 위치에 찍히게 함
  const angle = (seed * 47) % 360;
  const radiusDeg = 0.01 + ((seed * 13) % 10) / 1000; // 대략 1~2km 반경
  const rad = (angle * Math.PI) / 180;
  return {
    lat: lat + Math.cos(rad) * radiusDeg,
    lng: lng + Math.sin(rad) * radiusDeg,
  };
}

async function throttledFetch(url) {
  queue = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  await queue;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await netFetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko" }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeOne(query) {
  if (cache.has(query)) return cache.get(query);
  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`;
    const res = await throttledFetch(url);
    if (!res.ok) throw new Error(`geocode http ${res.status}`);
    const json = await res.json();
    if (!json || !json.length) {
      cache.set(query, null);
      return null;
    }
    const value = { lat: Number(json[0].lat), lng: Number(json[0].lon) };
    cache.set(query, value);
    return value;
  } catch (err) {
    cache.set(query, null);
    return null;
  }
}

const NOMINATIM_MAX_LOOKUPS = 6; // 호출 하나당(예: 구 하나) 기본으로 시도할 실제 지오코딩 개수 상한

/**
 * candidates: findCandidates()가 반환한 배열
 * districtFallback: { lat, lng } 지오코딩 실패 시 대체 중심
 * sidoName: 검색어에 넣을 시/도 이름 (예: "서울특별시", "경기도") — 예전엔 "서울특별시"로
 *   고정되어 있어서 서울 밖 지역은 검색어 자체가 틀렸었습니다(①모드가 전국 검색을 지원하면서
 *   드러난 문제라 함께 고쳤습니다).
 * districtNameForQuery: 구/시/군 이름
 * budget: { remaining } 형태의 공유 카운터. 여러 지역을 한 번에 처리할 때 전체 실제 지오코딩
 *   호출 수를 하나의 상한으로 묶어서 관리하고 싶을 때 넘깁니다(넘기지 않으면 이 호출 하나에만
 *   적용되는 기본 상한(NOMINATIM_MAX_LOOKUPS)을 새로 만들어 씁니다).
 * 반환: 각 항목에 lat/lng/geocoded(boolean)가 추가된 새 배열
 */
export async function enrichCandidatesWithCoords(candidates, districtFallback, sidoName, districtNameForQuery, budget) {
  const effectiveBudget = budget || { remaining: NOMINATIM_MAX_LOOKUPS };
  const uniqueQueries = new Map(); // complexName+dong -> query string
  candidates.forEach((c) => {
    const key = `${c.complexName}::${c.dong}`;
    if (!uniqueQueries.has(key)) {
      uniqueQueries.set(key, `대한민국 ${sidoName || ""} ${districtNameForQuery} ${c.dong} ${c.complexName}`.replace(/\s+/g, " ").trim());
    }
  });

  const keys = Array.from(uniqueQueries.keys());
  const geocodedMap = new Map();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (effectiveBudget.remaining > 0) {
      effectiveBudget.remaining -= 1;
      const result = await geocodeOne(uniqueQueries.get(key));
      geocodedMap.set(key, result);
    } else {
      geocodedMap.set(key, null); // 개수 제한 초과분은 바로 폴백 처리
    }
  }

  return candidates.map((c, idx) => {
    const key = `${c.complexName}::${c.dong}`;
    const geo = geocodedMap.get(key);
    if (geo) {
      return { ...c, lat: geo.lat, lng: geo.lng, geocoded: true };
    }
    const fallback = jitter(districtFallback.lat, districtFallback.lng, idx + 1);
    return { ...c, lat: fallback.lat, lng: fallback.lng, geocoded: false };
  });
}
