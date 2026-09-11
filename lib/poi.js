/**
 * 지도 위에 지하철역/대형마트/백화점/병원/약국을 함께 표시하기 위해 OpenStreetMap의 무료
 * Overpass API로 반경 안의 시설 위치를 "최선을 다해(best-effort)" 가져옵니다.
 *
 * 처음엔 5개 카테고리를 Overpass 질의 하나로 묶어서 보냈는데(왕복 횟수를 줄이려는
 * 의도였습니다), 실사용자 테스트에서 "지하철역/대형마트/백화점/병원/약국 마커가 전부 안
 * 나온다"는 문제가 확인됐습니다. 원인으로 보이는 것: 병원/백화점/대형마트 카테고리는
 * way(면, 건물 윤곽) 검색까지 포함되는데, way 검색은 node 검색보다 Overpass 서버 부담이
 * 훨씬 크고, 넓은 반경(최대 25km)에 여러 개를 한 번에 묶으면 무료 공용 서버의 처리
 * 시간/복잡도 한도를 넘기기 쉽습니다. 5개를 한 질의로 묶었기 때문에 무거운 하위 질의
 * 하나만 느려지거나 거부돼도 "질의 전체"가 실패해서, 원래 단순한 node 질의라 잘 동작하던
 * 지하철역 조회까지 통째로 못 쓰게 되는 구조였습니다.
 *
 * 그래서 카테고리마다 완전히 독립된 질의로 나눠(병렬로는 함께 실행) 원래 지하철역 전용
 * 조회(lib/subway.js)와 똑같이 가볍고 안정적인 구조로 되돌렸습니다 — 하나가 느리거나
 * 실패해도 나머지 카테고리 조회에는 전혀 영향이 없습니다. 국토부 API처럼 서비스키가
 * 필요 없지만, 공용 서버라 응답이 느리거나(수 초~십수 초) 가끔 실패할 수 있습니다.
 * 실패해도 지도의 다른 기능(추천 결과, 매물 후보)에는 전혀 영향이 없도록 항상 빈 배열로
 * 조용히 폴백합니다.
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
// /api/poi 요청 전체(카테고리 5개 + 미러 최대 3곳씩)가 이 시간을 넘기지 않도록 하는 전체
// 예산입니다. 미러 하나당 최대 9초씩 최대 3곳을 순서대로 시도하면 카테고리 하나가 최악의
// 경우 27초까지 걸릴 수 있는데, Vercel 같은 서버리스 플랫폼은 함수 실행 시간에 자체 상한이
// 있어서(예: 기본/무료 플랜 기준 10초 안팎), 우리 쪽 "느리면 빈 배열로 폴백" 로직이 채
// 끝나기도 전에 플랫폼이 요청 자체를 강제 종료시켜 버릴 수 있습니다. 그러면 프론트엔드는
// 조용한 빈 배열이 아니라 504/타임아웃을 받게 되어 지도에 마커가 전혀 안 뜨는 채로
// 남는데, 카테고리별로 질의를 쪼갠 것만으로는 이 문제를 못 고칩니다(쪼갠 각 카테고리도
// 여전히 미러 3곳을 순서대로 최대 27초까지 시도할 수 있기 때문입니다). 그래서 카테고리별
// 시도 시각을 이 하나의 절대 마감 시각 기준으로 제한해서, 전체 응답이 항상 이 예산 안에
// 끝나도록(플랫폼이 강제 종료하기 전에 우리 스스로 먼저 빈 배열로 폴백하도록) 합니다.
const TOTAL_BUDGET_MS = 8000;
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
//
// 카테고리별 Overpass 필터. mart/department/hospital은 건물 하나 전체가 way(면)로
// 매핑된 경우가 흔해서 node뿐 아니라 way도 함께 조회합니다(단, 위 이유로 각자 독립된
// 질의라 way 검색이 무거워도 다른 카테고리에는 영향을 주지 않습니다).
const CATEGORIES = [
  {
    key: "subway",
    requireName: true,
    filters: (around) =>
      `node["railway"="station"]["station"="subway"](${around});` +
      `node["railway"="station"]["station"="light_rail"](${around});`,
  },
  {
    key: "mart",
    requireName: true,
    filters: (around) => `node["shop"="supermarket"](${around});way["shop"="supermarket"](${around});`,
  },
  {
    key: "department",
    requireName: true,
    filters: (around) => `node["shop"="department_store"](${around});way["shop"="department_store"](${around});`,
  },
  {
    key: "hospital",
    requireName: false,
    filters: (around) => `node["amenity"="hospital"](${around});way["amenity"="hospital"](${around});`,
  },
  {
    key: "pharmacy",
    requireName: false,
    filters: (around) => `node["amenity"="pharmacy"](${around});`,
  },
];

const EMPTY_POIS = Object.freeze({ subway: [], mart: [], department: [], hospital: [], pharmacy: [] });

const cache = new Map(); // key -> { at, list }

function cacheKey(categoryKey, lat, lng, radiusKm) {
  return `${categoryKey}:${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
}

async function fetchCategory(category, lat, lng, radiusKm, deadlineAt) {
  const key = cacheKey(category.key, lat, lng, radiusKm);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.list;

  const radiusM = Math.round(radiusKm * 1000);
  const around = `around:${radiusM},${lat},${lng}`;
  const query = `[out:json][timeout:20];(${category.filters(around)});out center;`;

  const errors = [];
  for (let i = 0; i < OVERPASS_URLS.length; i++) {
    const url = OVERPASS_URLS[i];
    // 전체 예산(TOTAL_BUDGET_MS)에서 남은 시간이 거의 없으면 새 미러 시도를 시작하지 않고
    // 바로 폴백합니다 — 안 그러면 이 카테고리 하나가 다른 카테고리와의 병렬 실행과 무관하게
    // 혼자 예산을 넘겨 플랫폼 타임아웃을 유발할 수 있습니다.
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 300) {
      errors.push(`${url}: 남은 시간 예산 부족으로 시도하지 않음(${TOTAL_BUDGET_MS}ms 예산 소진)`);
      break;
    }
    // 남은 시간을 "남은 미러 개수"로 나눠서 씁니다. 처음엔 그냥 남은 시간 전체를 한 번의
    // 시도에 다 줬었는데, 그러면 첫 번째 미러(예: overpass-api.de)가 응답 없이 계속
    // 멈춰만 있는 네트워크 환경(실사용자 테스트로 확인 — 방화벽 등으로 연결 자체가 조용히
    // 막히면 "실패"가 아니라 "응답 없음"이라 오히려 더 오래 버팁니다)에서는 예산을 전부
    // 첫 미러 혼자 다 써버려서 정작 잘 될 수도 있는 두 번째·세 번째 미러는 한 번도
    // 시도조차 못 해보고 끝나 버렸습니다. 미러 개수만큼 나눠 주면, 앞 미러가 느려도 뒤에
    // 남은 미러들이 최소한의 시간은 보장받고 시도될 수 있습니다.
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
      const list = (json.elements || [])
        .map((el) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLng = el.lon ?? el.center?.lon;
          if (elLat == null || elLng == null) return null;
          const name = el.tags?.name;
          if (category.requireName && !name) return null;
          return { id: `${el.type}/${el.id}`, name: name || CATEGORY_LABELS[category.key], lat: elLat, lng: elLng };
        })
        .filter(Boolean);
      cache.set(key, { at: Date.now(), list });
      return list;
    } catch (err) {
      // 이 카테고리의 이 미러가 막혀 있거나 느려도 다음 미러로 계속 시도합니다(전부
      // 실패해야만 빈 배열로 폴백). 다른 카테고리 조회에는 전혀 영향이 없습니다.
      errors.push(`${url}: ${describeFetchError(err)}`);
    }
  }
  console.warn(
    `[poi] ${category.key}(${CATEGORY_LABELS[category.key]}) 조회 실패(미러 ${OVERPASS_URLS.length}곳 모두 실패 — 지도에는 표시되지 않을 뿐, 다른 기능에는 영향 없음):\n  ` +
      errors.join("\n  ")
  );
  return [];
}

/**
 * lat/lng 중심으로 radiusKm 안의 지하철역/대형마트/백화점/병원/약국을 카테고리별로 돌려줍니다.
 * 반환: { subway: [...], mart: [...], department: [...], hospital: [...], pharmacy: [...] }
 *   각 항목은 { id, name, lat, lng } (조회 실패 시 그 카테고리만 빈 배열 — 나머지 카테고리는
 *   독립적으로 정상 반환될 수 있습니다).
 */
export async function fetchNearbyPOIs(lat, lng, radiusKm) {
  if (lat == null || lng == null) return EMPTY_POIS;
  const boundedRadiusKm = Math.min(Math.max(Number(radiusKm) || 5, 1), MAX_RADIUS_KM);
  const deadlineAt = Date.now() + TOTAL_BUDGET_MS;

  const results = await Promise.all(
    CATEGORIES.map((category) => fetchCategory(category, lat, lng, boundedRadiusKm, deadlineAt))
  );
  const pois = { ...EMPTY_POIS };
  CATEGORIES.forEach((category, i) => {
    pois[category.key] = results[i];
  });
  return pois;
}
