"use client";

/**
 * 공공주택(청약홈 분양 공고 / LH·지자체 공공임대 단지 / LH 공지사항) 정보를 보여주는
 * 섹션입니다("③ 공공주택 정보" 탭 전용, PublicHousingFlow.js에서만 씁니다). 세 API 모두
 * 서비스키가 없으면 조용히 빈 배열로 오므로(molit.js와 동일한 철학), 표시할 내용이 하나도
 * 없으면 섹션 자체를 렌더링하지 않습니다.
 *
 * 청약홈 분양 공고(subscriptions)는 청약홈 API 자체가 시/군/구가 아니라 시/도 단위로만
 * 지역을 구분해 주기 때문에(README 22-4), 제목에 "(시/도 전체)"를 붙여 이게 특정 구/군만의
 * 공고가 아니라 그 시/도 전체 공고라는 걸 명시합니다. LH 공공임대 단지는 API가 구/군
 * 단위라 시/도 안 모든 구/군을 합쳐서 받아오는데(app/api/public-housing-sido/route.js),
 * 각 항목이 어느 구/군인지 알 수 있도록 단지명 앞에 구/군 이름을 붙여 보여줍니다.
 */
export default function PublicHousingSection({ data, meta, sido }) {
  if (!meta) return null;
  const anyEnabled = meta.rentalEnabled || meta.noticeEnabled || meta.applyhomeEnabled;
  if (!anyEnabled || !data) return null;

  const { rentalComplexes = [], subscriptions = [], lhNotices = [], rentalTotalCount, rentalTruncated } = data;
  const totalCount = rentalComplexes.length + subscriptions.length + lhNotices.length;
  if (totalCount === 0) return null;

  return (
    <div className="public-housing-section">
      <div className="candidate-title">공공주택 정보</div>

      {subscriptions.length > 0 && (
        <div className="public-housing-group">
          <div className="public-housing-group-title">
            청약홈 분양 공고{sido ? ` (${sido} 전체)` : ""}
          </div>
          {subscriptions.map((s) => (
            <div className="public-housing-item" key={s.id}>
              <span className="public-housing-name">
                {s.houseName}
                {s.isOpen === true && <span className="badge budget-ok">접수중</span>}
              </span>
              <span className="note">
                {s.houseTypeName || ""}
                {s.houseTypeName ? " · " : ""}
                {s.receiptStart && s.receiptEnd
                  ? `접수 ${s.receiptStart}~${s.receiptEnd}`
                  : s.noticeDate
                    ? `공고일 ${s.noticeDate}`
                    : ""}
              </span>
              {s.homepageUrl && (
                <a className="naver-link" href={s.homepageUrl} target="_blank" rel="noopener noreferrer">
                  청약홈에서 보기 ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {rentalComplexes.length > 0 && (
        <div className="public-housing-group">
          <div className="public-housing-group-title">
            LH·지자체 공공임대주택 단지{sido ? ` (${sido} 전체)` : ""}
          </div>
          {rentalTruncated && (
            <p className="note" style={{ marginBottom: 6 }}>
              전체 {rentalTotalCount}건 중 최근 공고 {rentalComplexes.length}건만 표시합니다.
            </p>
          )}
          {rentalComplexes.map((c) => (
            <div className="public-housing-item" key={`${c.districtName || ""}-${c.id}`}>
              <span className="public-housing-name">
                {c.districtName ? `${c.districtName} · ` : ""}
                {c.name}
              </span>
              <span className="note">
                {[c.supplyType, c.houseType, c.households ? `${c.households}세대` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {c.address && <span className="note">{c.address}</span>}
            </div>
          ))}
        </div>
      )}

      {lhNotices.length > 0 && (
        <div className="public-housing-group">
          <div className="public-housing-group-title">LH 공지사항</div>
          {lhNotices.map((n) => (
            <div className="public-housing-item" key={n.id}>
              {n.url ? (
                <a className="naver-link" href={n.url} target="_blank" rel="noopener noreferrer">
                  {n.title} ↗
                </a>
              ) : (
                <span className="public-housing-name">{n.title}</span>
              )}
              <span className="note">{[n.dept, n.date].filter(Boolean).join(" · ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
