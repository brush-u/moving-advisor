/**
 * LH(한국토지주택공사) 청약센터의 "공지사항 목록 조회 서비스"로 특정 지역명을 제목에 포함한
 * 최근 공지(모집공고 등)를 가져옵니다. 국토부 실거래가처럼 시/군/구 코드로 정확히 필터링할
 * 수 있는 API가 아니라, 제목/본문 키워드 검색만 지원합니다 — 그래서 "구/군 이름이 제목에
 * 들어간 공지"만 잡히는 최선의 노력(best-effort) 성격의 부가 정보입니다(0건이어도 정상).
 *
 * data.go.kr 데이터셋: 15058222 (LH 청약센터 공지사항 목록/상세 조회 서비스)
 * 엔드포인트: https://apis.data.go.kr/B552555/lhNoticeInfo1/getNoticeInfo1
 * 요청 파라미터(문서로 확인됨): ServiceKey, PG_SZ(페이지 크기), PAGE(페이지 번호),
 *   SCH_ST_DT/SCH_ED_DT(검색 시작/종료일, YYYY-MM-DD), BBS_TL(제목 키워드),
 *   BBS_DTL_CTS(본문 키워드) 등
 * 응답 항목 필드(문서로 확인됨): BBS_SN(공지번호), BBS_TL(제목), DEP_NM(담당부서),
 *   BBS_WOU_DTTM(등록일시), AIS_TP_CD_NM(분류명), INQ_CNT(조회수), LINK_URL(상세페이지 URL)
 *
 * 주의: 이 응답을 감싸는 최상위 래퍼 키 이름은 활용신청 승인 전이라 문서에서 확인하지
 * 못했습니다 — lib/netFetch.js의 extractItemArray로 방어적으로 찾아냅니다.
 * 서비스키가 없으면(LH_NOTICE_SERVICE_KEY 미설정) 항상 빈 배열로 조용히 폴백합니다.
 */

import { netFetch, describeFetchError, extractItemArray } from "./netFetch";

const ENDPOINT = "https://apis.data.go.kr/B552555/lhNoticeInfo1/getNoticeInfo1";
const FETCH_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분
const cache = new Map();

export function isLhNoticeKeyConfigured() {
  return Boolean(process.env.LH_NOTICE_SERVICE_KEY);
}

/**
 * keyword(보통 구/군 이름, 예: "강남구")가 제목에 포함된 최근 LH 공지를 최대 limit건 가져옵니다.
 * 반환: [{id, title, dept, date, url}, ...] (조회 실패/키 미설정/0건 시 빈 배열)
 */
export async function fetchLhNotices(keyword, { limit = 5 } = {}) {
  if (!isLhNoticeKeyConfigured() || !keyword) return [];

  const cacheKey = keyword;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value.slice(0, limit);

  const url = new URL(ENDPOINT);
  url.searchParams.set("ServiceKey", process.env.LH_NOTICE_SERVICE_KEY);
  url.searchParams.set("PG_SZ", String(Math.max(limit, 10)));
  url.searchParams.set("PAGE", "1");
  url.searchParams.set("BBS_TL", keyword);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await netFetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`lh notice http ${res.status}`);
    const json = await res.json();
    const items = extractItemArray(json);
    const notices = items
      .filter((it) => it && it.BBS_TL)
      .map((it) => ({
        id: it.BBS_SN != null ? String(it.BBS_SN) : it.BBS_TL,
        title: it.BBS_TL,
        dept: it.DEP_NM || null,
        date: it.BBS_WOU_DTTM || null,
        url: it.LINK_URL || null,
      }));
    cache.set(cacheKey, { at: Date.now(), value: notices });
    return notices.slice(0, limit);
  } catch (err) {
    console.warn(`[lhNotice] "${keyword}" LH 공지사항 조회 실패(표시만 안 될 뿐, 다른 기능에는 영향 없음): ${describeFetchError(err)}`);
    return [];
  }
}
