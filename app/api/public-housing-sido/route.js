import { NextResponse } from "next/server";
import { groupDistrictsBySido, districts as allDistricts } from "../../../lib/districts";
import { fetchLhRentalComplexes, isMyhomeKeyConfigured } from "../../../lib/lhRental";
import { fetchLhNotices, isLhNoticeKeyConfigured } from "../../../lib/lhNotice";
import { fetchApplyhomeSubscriptions, isApplyhomeKeyConfigured, SIDO_SHORT_NAME } from "../../../lib/applyhome";

// 시/도 안 공공임대 단지를 한 번에 너무 많이 끌어오지 않도록 구/군 하나당 상한을 낮추고
// (기본 30 -> 15), 합친 뒤에도 최종 개수를 한 번 더 자릅니다.
const PER_DISTRICT_ROWS = 15;
const MERGED_RENTAL_LIMIT = 60;

/**
 * "공공주택 정보" 탭 전용 엔드포인트입니다. /api/public-housing(구/군 단위, RankFlow·
 * DistrictFlow의 카드용)과 달리 이건 시/도 단위 조회입니다 — 청약홈 분양 공고 API 자체가
 * 시/도 단위로만 지역을 구분해 주기 때문에(README 22-4), 아예 화면도 시/도를 고르는
 * 방식으로 분리했습니다.
 *
 * - 청약홈 분양 공고: 애초에 시/도 단위 API라 그대로 호출합니다.
 * - LH 공지사항: 시/도 전체를 대상으로 하는 검색 파라미터가 없어(구/군 이름 키워드
 *   검색만 가능), 시/도의 축약형 이름("서울특별시" -> "서울")을 키워드로 씁니다.
 * - LH 공공임대주택 단지: API가 구/군 단위로만 문서화되어 있어, 이 시/도 안의 모든
 *   구/군을 병렬로 호출한 뒤 하나로 합칩니다(사용자 승인된 방식 — README 22-5 참고).
 *   구/군 개수가 많은 시/도(경기도 등)는 호출이 많아지지만, 구/군별 결과가 각각 30분
 *   캐시되므로 반복 조회 비용은 낮습니다.
 */
export async function POST(request) {
  try {
    const { sido } = await request.json().catch(() => ({}));
    if (!sido) {
      return NextResponse.json({ error: "sido가 필요합니다." }, { status: 400 });
    }

    const group = groupDistrictsBySido(allDistricts).find((g) => g.sido === sido);
    if (!group) {
      return NextResponse.json({ error: `알 수 없는 시/도입니다: ${sido}` }, { status: 400 });
    }

    const noticeKeyword = SIDO_SHORT_NAME[sido] || sido;

    const [subscriptions, lhNotices, rentalByDistrict] = await Promise.all([
      fetchApplyhomeSubscriptions(sido, { limit: 10 }).catch(() => []),
      fetchLhNotices(noticeKeyword, { limit: 10 }).catch(() => []),
      Promise.all(
        group.items.map((d) =>
          fetchLhRentalComplexes(d.lawdCd, { numOfRows: PER_DISTRICT_ROWS })
            .then((list) => list.map((item) => ({ ...item, districtName: d.name })))
            .catch(() => [])
        )
      ),
    ]);

    let rentalComplexes = rentalByDistrict.flat();
    const rentalTotalCount = rentalComplexes.length;
    // 모집공고일(competDe) 최신순 정렬 — 날짜가 없는 항목은 뒤로 보냅니다.
    rentalComplexes.sort((a, b) => String(b.noticeDate || "").localeCompare(String(a.noticeDate || "")));
    rentalComplexes = rentalComplexes.slice(0, MERGED_RENTAL_LIMIT);

    return NextResponse.json({
      sido,
      subscriptions,
      lhNotices,
      rentalComplexes,
      rentalTotalCount,
      rentalTruncated: rentalTotalCount > MERGED_RENTAL_LIMIT,
      meta: {
        rentalEnabled: isMyhomeKeyConfigured(),
        noticeEnabled: isLhNoticeKeyConfigured(),
        applyhomeEnabled: isApplyhomeKeyConfigured(),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
