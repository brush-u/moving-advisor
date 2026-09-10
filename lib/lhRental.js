/**
 * 마이홈포털(국토교통부)이 운영하는 "공공임대주택 단지정보 조회 서비스"로 특정 시/군/구 안의
 * LH·지자체 공공임대주택 단지 목록(국민임대·영구임대·행복주택 등)을 가져옵니다.
 *
 * data.go.kr 데이터셋: 15058476 (공공임대주택 단지정보 조회 서비스)
 * 엔드포인트: https://data.myhome.go.kr/rentalHouseList
 * 요청 파라미터(문서로 확인됨): ServiceKey, brtcCode(2자리 시도코드), signguCode(3자리
 *   시군구코드), numOfRows, pageNo — brtcCode+signguCode는 국토부 실거래가 API에 이미 쓰는
 *   lawdCd(5자리 법정동코드 앞부분)를 2자리+3자리로 그대로 나눠 쓰면 됩니다.
 * 응답 항목 필드(문서로 확인됨): hsmpSn, insttNm, brtcCode, brtcNm, signguCode, signguNm,
 *   hsmpNm(단지명), rnAdres(도로명주소), competDe(모집공고일), hshldCo(세대수),
 *   suplyTyNm(공급유형명), styleNm, suplyPrvuseAr/suplyCmnuseAr(전용/공용면적),
 *   houseTyNm(주택유형명), heatMthdDetailNm, buldStleNm, elvtrInstlAtNm, parkngCo,
 *   bassRentGtn(기본 임대보증금), bassMtRntchrg(기본 월임대료), bassCnvrsGtnLmt
 *
 * 주의: 이 응답을 감싸는 최상위 래퍼 키 이름(예: dsList 등)은 활용신청 승인 전이라 문서에서
 * 확인하지 못했습니다 — lib/netFetch.js의 extractItemArray로 방어적으로 찾아냅니다.
 * 서비스키가 없으면(MYHOME_SERVICE_KEY 미설정) 항상 빈 배열로 조용히 폴백합니다.
 */

import { netFetch, describeFetchError, extractItemArray } from "./netFetch";

const ENDPOINT = "https://data.myhome.go.kr/rentalHouseList";
const FETCH_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분 — 단지 목록은 자주 안 바뀜
const cache = new Map();

export function isMyhomeKeyConfigured() {
  return Boolean(process.env.MYHOME_SERVICE_KEY);
}

function toNumberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * lawdCd(5자리, 예: "11680" 강남구) 기준으로 그 시/군/구 안의 공공임대주택 단지 목록을
 * 반환합니다. 반환: [{id, name, address, institution, supplyType, houseType, households,
 * areaM2, noticeDate, deposit, monthlyRent}, ...] (조회 실패/키 미설정 시 빈 배열)
 */
export async function fetchLhRentalComplexes(lawdCd, { numOfRows = 30 } = {}) {
  if (!isMyhomeKeyConfigured() || !lawdCd || lawdCd.length < 5) return [];

  const brtcCode = lawdCd.slice(0, 2);
  const signguCode = lawdCd.slice(2, 5);
  const cacheKey = `${brtcCode}:${signguCode}:${numOfRows}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const url = new URL(ENDPOINT);
  url.searchParams.set("ServiceKey", process.env.MYHOME_SERVICE_KEY);
  url.searchParams.set("brtcCode", brtcCode);
  url.searchParams.set("signguCode", signguCode);
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("pageNo", "1");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await netFetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`myhome rentalHouseList http ${res.status}`);
    const json = await res.json();
    const items = extractItemArray(json);
    const complexes = items
      .filter((it) => it && (it.hsmpNm || it.rnAdres))
      .map((it) => ({
        id: it.hsmpSn != null ? String(it.hsmpSn) : `${it.hsmpNm || ""}-${it.rnAdres || ""}`,
        name: it.hsmpNm || "단지명 미상",
        address: it.rnAdres || null,
        institution: it.insttNm || null,
        supplyType: it.suplyTyNm || null,
        houseType: it.houseTyNm || null,
        households: toNumberOrNull(it.hshldCo),
        areaM2: toNumberOrNull(it.suplyPrvuseAr),
        noticeDate: it.competDe || null,
        deposit: toNumberOrNull(it.bassRentGtn),
        monthlyRent: toNumberOrNull(it.bassMtRntchrg),
      }));
    cache.set(cacheKey, { at: Date.now(), value: complexes });
    return complexes;
  } catch (err) {
    console.warn(`[lhRental] ${lawdCd} 공공임대주택 단지정보 조회 실패(표시만 안 될 뿐, 다른 기능에는 영향 없음): ${describeFetchError(err)}`);
    return [];
  }
}
