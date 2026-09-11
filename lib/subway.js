/**
 * 지도 위에 지하철역을 표시하기 위해 OpenStreetMap의 무료 Overpass API로 반경 안의 역
 * 위치를 "최선을 다해(best-effort)" 가져옵니다. 국토부 API처럼 서비스키가 필요 없지만,
 * 공용 서버라 응답이 느리거나(수 초~십수 초) 가끔 실패할 수 있습니다. 실패해도 지도의 다른
 * 기능(추천 결과, 매물 후보)에는 전혀 영향이 없도록 항상 빈 배열로 조용히 폴백합니다.
 */

import { netFetch, describeFetchError } from "./netFetch";

// 공개 Overpass 서버는 대표 인스턴스(overpass-api.de) 하나만 쓰면 트래픽이 몰릴 때 응답이
// 느려지거나 아예 요청을 거부하는 경우가 흔합니다. 같은 질의를 그대로 받아주는 미러 서버
// 몇 개를 순서대로 시도해서, 하나가 느리거나 막혀 있어도 지도에 지하철역이 표시될 확률을
// 높였습니다(전부 실패하면 기존처럼 빈 배열로 조용히 폴백합니다).
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
// lib/geocode.js가 Nominatim에 보내는 것과 같은 이유로, Overpass 공용 미러에도 요청을
// 보낼 앱을 알아볼 수 있는 User-Agent를 붙였습니다. Overpass는 Nominatim처럼 UA가
// 없으면 무조건 거부하지는 않지만, User-Agent가 없거나 흔한 값(범용 헤더)인 요청을
// 다른 요청보다 먼저 걸러내는 경우가 있어(실사용자 테스트에서 지역에 따라 406/429로
// 거부되는 것을 확인) 붙여 두면 통과율이 조금 더 나아질 수 있습니다. 다만 이 서버들은
// 완전히 무료·공용이라 User-Agent를 붙여도 트래픽이 몰리는 시간대에는 여전히 실패할 수
// 있고, 이 함수는 원래부터 "최선을 다해(best-effort)" 조회라 실패해도 지도의 다른
// 기능에는 영향이 없습니다.
const OVERPASS_USER_AGENT =
  "moving-advisor-prototype/0.1 (educational project; contact: set-your-email@example.com)";
const FETCH_TIMEOUT_MS = 9000;
// lib/poi.js와 같은 이유로 둔 전체 예산입니다: 미러 하나당 최대 9초씩 최대 3곳을 순서대로
// 시도하면 최악의 경우 27초까지 걸릴 수 있는데, 이는 서버리스 플랫폼(예: Vercel)의 함수
// 실행 시간 상한을 넘길 수 있어 "느리면 빈 배열로 폴백"하는 우리 코드가 채 끝나기도 전에
// 플랫폼이 요청을 강제 종료시켜 버릴 위험이 있습니다. 이 절대 마감 시각 안에서만 미러를
// 시도하도록 제한해 그 위험을 없앱니다.
const TOTAL_BUDGET_MS = 8000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 역 위치는 자주 안 바뀌니 30분 정도는 캐시를 재사용
const MAX_RADIUS_KM = 25; // 너무 넓은 범위를 한 번에 조회하면 응답이 느려지고 결과도 지나치게 많아짐

const cache = new Map(); // key -> { at, stations }

function cacheKey(lat, lng, radiusKm) {
  // 위경도를 약 1km 단위로 반올림해서, 거의 같은 위치의 재검색은 캐시를 재사용하게 함
  return `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
}

/**
 * lat/lng 중심으로 radiusKm 안의 지하철/경전철역을 돌려줍니다.
 * 반환: [{ id, name, lat, lng }, ...] (조회 실패 시 빈 배열)
 */
export async function fetchNearbySubwayStations(lat, lng, radiusKm) {
  if (lat == null || lng == null) return [];
  const boundedRadiusKm = Math.min(Math.max(Number(radiusKm) || 5, 1), MAX_RADIUS_KM);
  const key = cacheKey(lat, lng, boundedRadiusKm);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.stations;

  const radiusM = Math.round(boundedRadiusKm * 1000);
  const query =
    `[out:json][timeout:20];` +
    `(node["railway"="station"]["station"="subway"](around:${radiusM},${lat},${lng});` +
    `node["railway"="station"]["station"="light_rail"](around:${radiusM},${lat},${lng}););` +
    `out body;`;

  const deadlineAt = Date.now() + TOTAL_BUDGET_MS;
  const errors = [];
  for (let i = 0; i < OVERPASS_URLS.length; i++) {
    const url = OVERPASS_URLS[i];
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 300) {
      errors.push(`${url}: 남은 시간 예산 부족으로 시도하지 않음(${TOTAL_BUDGET_MS}ms 예산 소진)`);
      break;
    }
    // lib/poi.js와 같은 이유로 남은 시간을 남은 미러 개수로 나눠 씁니다 — 첫 미러가
    // 응답 없이 계속 멈춰 있는 네트워크에서도 뒤 미러들이 최소한의 시간을 보장받도록.
    const mirrorsLeft = OVERPASS_URLS.length - i;
    const perAttemptTimeout = Math.min(FETCH_TIMEOUT_MS, Math.floor(remainingMs / mirrorsLeft));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), perAttemptTimeout);
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
      const stations = (json.elements || [])
        .filter((el) => el.lat != null && el.lon != null && el.tags?.name)
        .map((el) => ({ id: el.id, name: el.tags.name, lat: el.lat, lng: el.lon }));
      cache.set(key, { at: Date.now(), stations });
      return stations;
    } catch (err) {
      // 이 미러가 막혀 있거나 느려도 다음 미러로 계속 시도합니다(전부 실패해야만 빈 배열로
      // 폴백). "fetch failed"만 찍히면 회사·기관 네트워크의 TLS 검사(SSL inspection) 같은
      // 진짜 원인을 알 수 없으므로, 국토부 API처럼 cause 체인까지 함께 남깁니다 — 만약
      // SELF_SIGNED_CERT_IN_CHAIN이 보이면 README 13-2의 MOLIT_ALLOW_INSECURE_TLS로
      // 해결할 수 있습니다(국토부 API 전용이 아니라 이 앱의 모든 외부 호출에 적용됩니다).
      errors.push(`${url}: ${describeFetchError(err)}`);
    }
  }
  console.warn(
    `[subway] 지하철역 조회 실패(미러 ${OVERPASS_URLS.length}곳 모두 실패 — 지도에는 표시되지 않을 뿐, 다른 기능에는 영향 없음):\n  ` +
      errors.join("\n  ")
  );
  return [];
}
