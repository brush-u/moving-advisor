"use client";

import { useEffect, useMemo, useState } from "react";
import { groupDistrictsBySido, districts as allDistricts } from "../../lib/districts";
import PublicHousingSection from "./PublicHousingSection";

/**
 * "③ 공공주택 정보" 탭입니다. 청약홈 분양 공고 API가 애초에 시/군/구가 아니라 시/도
 * 단위로만 지역을 구분해 주기 때문에(README 22-4), 구/군을 고르는 ①/② 화면 안에
 * 끼워 넣는 대신 시/도를 고르는 별도 화면으로 분리했습니다. LH 공공임대 단지처럼
 * 원래 구/군 단위인 데이터는 선택한 시/도 안 모든 구/군을 합쳐서 보여줍니다
 * (app/api/public-housing-sido/route.js, README 22-5).
 */
export default function PublicHousingFlow() {
  const sidoGroups = useMemo(() => groupDistrictsBySido(allDistricts), []);
  const [sido, setSido] = useState(sidoGroups[0]?.sido || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sido) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/public-housing-sido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sido }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "조회에 실패했습니다.");
        setResult(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sido]);

  const meta = result?.meta || null;
  const anyEnabled = meta && (meta.rentalEnabled || meta.noticeEnabled || meta.applyhomeEnabled);
  const totalCount = result
    ? (result.rentalComplexes?.length || 0) + (result.subscriptions?.length || 0) + (result.lhNotices?.length || 0)
    : 0;

  return (
    <div>
      <p className="subtitle">
        LH·지자체 공공임대주택 단지, 청약홈 분양 공고, LH 공지사항을 시/도 단위로 모아
        보여드립니다. 청약홈 분양 공고는 원래부터 시/도 단위로만 구분되는 정보라, 구/군이
        아니라 시/도를 기준으로 찾도록 만들었습니다.
      </p>

      <div className="panel">
        <h2>시/도 선택</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="ph-sido">시/도</label>
            <select id="ph-sido" value={sido} onChange={(e) => setSido(e.target.value)}>
              {sidoGroups.map((g) => (
                <option key={g.sido} value={g.sido}>{g.sido}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="error-box">오류가 발생했습니다: {error}</div>}

      <div className="panel">
        {loading && <p className="note">불러오는 중...</p>}

        {!loading && result && anyEnabled && totalCount > 0 && (
          <PublicHousingSection data={result} meta={meta} sido={sido} />
        )}

        {!loading && result && anyEnabled && totalCount === 0 && (
          <>
            <div className="candidate-title">공공주택 정보</div>
            <p className="note">{sido}에 해당하는 공공주택 정보를 찾지 못했습니다.</p>
          </>
        )}

        {!loading && result && !anyEnabled && (
          <>
            <div className="candidate-title">공공주택 정보</div>
            <p className="note">
              공공주택 API 키가 설정되어 있지 않습니다(README 22번 안내 참고). 키를 설정하면
              이 시/도의 LH 공공임대 단지, 청약홈 분양 공고, LH 공지사항이 표시됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
