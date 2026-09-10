/**
 * 한국부동산원이 운영하는 "청약홈 분양정보 조회 서비스"로 현재 진행 중이거나 최근 접수한
 * 아파트 청약 공고를 가져옵니다. 민간분양뿐 아니라 공공분양·신혼희망타운도 이 안에 포함되어
 * 나옵니다(청약홈 자체가 공공/민간을 함께 다루는 통합 창구라서 그렇습니다).
 *
 * data.go.kr 데이터셋: 15098547 (한국부동산원_청약홈 분양정보 조회 서비스)
 * 이 데이터셋은 주택유형별로 5개 세부 오퍼레이션(APT/오피스텔/무순위/민간임대/임의공급)을
 * 묶어 제공하는데, 그중 APT(아파트, 신혼희망타운·민간사전청약 포함) 오퍼레이션만 필드명을
 * 문서로 확인했습니다 — 나머지 4개는 필드 스키마가 서로 달라(문서 미확인) 잘못 짐작해 값을
 * 못 읽어오는 사고(국토부 실거래가 API에서 실제로 있었던 문제, README 참고)를 반복하지
 * 않기 위해 이번엔 포함하지 않았습니다. 필요하면 문서 확인 후 추가할 수 있습니다.
 *
 * 엔드포인트: https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail
 * 요청 파라미터(문서로 확인됨): serviceKey, page, perPage — 지역으로 서버 단에서 걸러주는
 * 파라미터는 문서에 없어서, 넉넉히 받아온 뒤 이 파일에서 지역명으로 직접 걸러냅니다.
 * 응답 항목 필드(문서로 확인됨): HOUSE_NM(단지명), SUBSCRPT_AREA_CODE_NM(지역명, "서울"처럼
 *   축약형으로 옴), HOUSE_SECD_NM(주택유형명), RCRIT_PBLANC_DE(모집공고일),
 *   TOT_SUPLY_HSHLDCO(총공급세대수), RCEPT_BGNDE/RCEPT_ENDDE(청약접수 시작/종료일),
 *   PRZWNER_PRESNATN_DE(당첨자발표일), HMPG_ADRES(홈페이지 URL)
 * 응답 래퍼: odcloud.kr에 올라온 API들은 공통적으로 { data: [...], currentCount, matchCount,
 *   page, perPage, totalCount } 형식을 씁니다(이 플랫폼 전반의 공통 규격이라 이 부분은 다른
 *   두 API(lhRental/lhNotice)보다 신뢰도가 높지만, 혹시 이 데이터셋만 다를 경우를 대비해
 *   역시 extractItemArray로 한 번 더 방어합니다).
 *
 * 서비스키가 없으면(APPLYHOME_SERVICE_KEY 미설정) 항상 빈 배열로 조용히 폴백합니다.
 */

import { netFetch, describeFetchError, extractItemArray } from "./netFetch";
import { SIDO_SHORT_NAME } from "./districts";

const ENDPOINT = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";
const FETCH_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분
const FETCH_PAGE_SIZE = 300; // 지역 필터를 서버가 아니라 우리가 직접 하므로 넉넉히 받아둠
let cache = null; // { at, all: [...] } — 전국 공고를 한 번에 캐시해 지역별로 재사용

// 청약홈/odcloud 쪽 SUBSCRPT_AREA_CODE_NM은 "서울특별시"가 아니라 "서울"처럼 행정구역
// 접미사를 뗀 축약형으로 오는 경우가 흔합니다(청약홈 화면 자체가 이 축약형을 씁니다).
// lib/districts.js의 정식 시/도 이름 -> 이 축약형으로 변환하는 매핑입니다. LH 공지사항을
// 시/도 단위로 검색할 때도(제목에 "서울특별시"보다 "서울"이 들어갈 가능성이 높아) 같은
// 매핑을 재사용합니다(app/api/public-housing-sido/route.js). 이제 추천 결과 화면(RankFlow)의
// 구별 매물 후보 타이틀에도 같은 축약형이 필요해져 lib/districts.js로 옮겨 공용화했고,
// 여기서는 하위 호환을 위해 그대로 재수출만 합니다(README 26번 참고).
export { SIDO_SHORT_NAME };

export function isApplyhomeKeyConfigured() {
  return Boolean(process.env.APPLYHOME_SERVICE_KEY);
}

function sidoMatches(sidoFullName, apiRegionName) {
  if (!apiRegionName) return false;
  const short = SIDO_SHORT_NAME[sidoFullName] || sidoFullName;
  return apiRegionName === short || apiRegionName.includes(short) || short.includes(apiRegionName);
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// RCEPT_ENDDE 등은 문서상 정확한 구분자(하이픈 포함 "2026-09-01" vs 미포함 "20260901")를
// 확인 못 했으니 숫자만 남겨 비교합니다.
function ymdOnly(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

async function fetchAllRecent() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.all;

  const url = new URL(ENDPOINT);
  url.searchParams.set("serviceKey", process.env.APPLYHOME_SERVICE_KEY);
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", String(FETCH_PAGE_SIZE));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await netFetch(url.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`applyhome http ${res.status}`);
  const json = await res.json();
  const items = Array.isArray(json?.data) ? json.data : extractItemArray(json);

  const all = items
    .filter((it) => it && it.HOUSE_NM)
    .map((it) => {
      const receiptEnd = ymdOnly(it.RCEPT_ENDDE);
      return {
        id: it.PBLANC_NO != null ? String(it.PBLANC_NO) : `${it.HOUSE_NM}-${it.RCRIT_PBLANC_DE || ""}`,
        houseName: it.HOUSE_NM,
        region: it.SUBSCRPT_AREA_CODE_NM || null,
        houseTypeName: it.HOUSE_SECD_NM || null,
        noticeDate: it.RCRIT_PBLANC_DE || null,
        totalUnits: it.TOT_SUPLY_HSHLDCO != null ? Number(it.TOT_SUPLY_HSHLDCO) || null : null,
        receiptStart: it.RCEPT_BGNDE || null,
        receiptEnd: it.RCEPT_ENDDE || null,
        winnerAnnounceDate: it.PRZWNER_PRESNATN_DE || null,
        homepageUrl: it.HMPG_ADRES || null,
        isOpen: receiptEnd ? receiptEnd >= todayYmd() : null,
      };
    });

  cache = { at: Date.now(), all };
  return all;
}

/**
 * sidoFullName(예: "서울특별시") 기준으로 청약 공고를 가져옵니다. 진행 중(접수기간 내)인
 * 공고를 최근 공고일 순으로 우선 보여주고, 부족하면 마감된 최근 공고로 채웁니다.
 * 반환: [{id, houseName, region, houseTypeName, noticeDate, totalUnits, receiptStart,
 * receiptEnd, winnerAnnounceDate, homepageUrl, isOpen}, ...] (실패/키 미설정 시 빈 배열)
 */
export async function fetchApplyhomeSubscriptions(sidoFullName, { limit = 5 } = {}) {
  if (!isApplyhomeKeyConfigured() || !sidoFullName) return [];
  try {
    const all = await fetchAllRecent();
    const matched = all.filter((r) => sidoMatches(sidoFullName, r.region));
    matched.sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1; // 진행 중인 공고를 먼저
      return String(b.noticeDate || "").localeCompare(String(a.noticeDate || "")); // 최신 공고일 순
    });
    return matched.slice(0, limit);
  } catch (err) {
    console.warn(`[applyhome] ${sidoFullName} 청약홈 분양정보 조회 실패(표시만 안 될 뿐, 다른 기능에는 영향 없음): ${describeFetchError(err)}`);
    return [];
  }
}
