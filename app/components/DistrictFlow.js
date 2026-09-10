"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { groupDistrictsBySido, findDistrictByCode } from "../../lib/districts";
import { DISTRICT_MARKER_COLOR, budgetFitColor } from "./mapColors";
import { unlockDartAudio } from "./dartAudio";
import SlideDrawer from "./SlideDrawer";

// "1. 지역 선택"은 항상 메인 화면에 보이고, "2. 필요 예산(자동 계산)"은 버튼을 눌러야
// 오른쪽에서 슬라이드로 나타나는 패널 안에 넣습니다(①모드 RankFlow.js와 동일한 이유 —
// 사용자가 다른 서비스의 필터 패널 예시를 보여주며 요청. README 30번. 이전엔 "다음/이전"
// 버튼으로 넘기는 2단계 마법사였는데, "버튼 말고 오른쪽에서 슬라이드로"라는 명확한
// 피드백을 받아 이 방식으로 바꿨습니다).

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const HOUSE_TYPE_OPTIONS = [
  { value: "apt", label: "아파트 (주상복합 포함)" },
  { value: "rh", label: "연립다세대 · 빌라" },
  { value: "offi", label: "오피스텔" },
];

const DEAL_TYPE_OPTIONS = [
  { value: "trade", label: "매매" },
  { value: "jeonse", label: "전세" },
  { value: "wolse", label: "월세" },
];

const BUILD_AGE_OPTIONS = [
  { value: "0", label: "상관없음" },
  { value: "5", label: "5년 이내(신축)" },
  { value: "10", label: "10년 이내" },
  { value: "15", label: "15년 이내" },
  { value: "20", label: "20년 이내" },
];

const ROOM_OPTIONS = [
  { value: "0", label: "상관없음" },
  { value: "1", label: "1룸 이상" },
  { value: "2", label: "2룸 이상" },
  { value: "3", label: "3룸 이상" },
  { value: "4", label: "4룸 이상" },
];

const BATHROOM_OPTIONS = [
  { value: "0", label: "상관없음" },
  { value: "1", label: "1개 이상" },
  { value: "2", label: "2개 이상" },
];

const DISTRICT_GROUPS = groupDistrictsBySido();

// 거래유형에 따라 "예산"이 의미하는 금액이 달라져서(매매가 / 전세보증금 / 월세보증금) 문구를 분기합니다.
function naverLandUrl(dong, complexName) {
  const q = [dong, complexName].filter(Boolean).join(" ").trim();
  return `https://new.land.naver.com/search?query=${encodeURIComponent(q || "부동산")}`;
}

function amountWordFor(dealType) {
  if (dealType === "jeonse") return "전세보증금";
  if (dealType === "wolse") return "월세 보증금";
  return "매매가";
}

function budgetLabelFor(dealType) {
  if (dealType === "jeonse") return "필요 전세보증금(억원)";
  if (dealType === "wolse") return "필요 보증금(억원) · 월세는 매물별로 별도 표시";
  return "필요 예산(억원)";
}

export default function DistrictFlow() {
  const [lawdCd, setLawdCd] = useState("11680"); // 강남구
  const [houseType, setHouseType] = useState("apt");
  const [dealType, setDealType] = useState("trade");
  const [pyeong, setPyeong] = useState("25");
  const [maxBuildAge, setMaxBuildAge] = useState("0");
  const [desiredRooms, setDesiredRooms] = useState("0");
  const [desiredBathrooms, setDesiredBathrooms] = useState("0");

  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [budgetTouched, setBudgetTouched] = useState(false);

  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  // 매물 결과가 새로 나올 때마다 값을 바꿔서 지도에 "다트가 파팍 꽂히는" 애니메이션을
  // 딱 그 순간에만 재생시키는 트리거(후보 선택/해제 같은 재렌더링에는 반응하지 않음).
  const [searchNonce, setSearchNonce] = useState(0);

  // "필요 예산 (자동 계산)" 슬라이드 패널이 열려 있는지.
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);

  const district = findDistrictByCode(lawdCd);
  const districtLabel = district ? `${district.sido} ${district.name}` : "";

  const fetchEstimate = useCallback(async () => {
    setEstimating(true);
    try {
      const res = await fetch("/api/district-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawdCd, houseType, dealType, pyeong, mode: "estimate" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "예산 계산에 실패했습니다.");
      setEstimate(json);
      if (!budgetTouched && json.estimatedRange) {
        setBudgetMin(String(json.estimatedRange.min));
        setBudgetMax(String(json.estimatedRange.max));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEstimating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawdCd, houseType, dealType, pyeong]);

  useEffect(() => {
    fetchEstimate();
    setSearchResult(null);
    setSelectedIdx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawdCd, houseType, dealType, pyeong]);

  async function handleSearch(e) {
    e.preventDefault();
    // 브라우저 자동재생 정책 때문에, 사용자가 직접 누른 이 클릭 핸들러 "안에서" 동기적으로
    // AudioContext를 만들어 둬야 검색 결과가 도착했을 때 다트 착지음을 재생할 수 있습니다.
    unlockDartAudio();
    setSearching(true);
    setError(null);
    setSelectedIdx(null);
    try {
      const res = await fetch("/api/district-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lawdCd,
          houseType,
          dealType,
          pyeong,
          maxBuildAge,
          desiredRooms,
          desiredBathrooms,
          budgetMin,
          budgetMax,
          mode: "search",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "검색에 실패했습니다.");
      setSearchResult(json);
      // 새 매물 목록이 도착한 순간에만 지도 위 "다트 낙하" 연출이 재생되도록 트리거를 갱신
      setSearchNonce((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  const markers = [];
  if (district) {
    markers.push({
      id: "district-center",
      lat: district.lat,
      lng: district.lng,
      color: DISTRICT_MARKER_COLOR,
      popupHtml: `<strong>${districtLabel}</strong><br/>지역 중심`,
    });
  }
  (searchResult?.candidates || []).forEach((c, idx) => {
    const priceLine =
      c.dealType === "wolse"
        ? `보증금 ${c.totalEok}억 · 월세 ${c.monthlyRentManwon?.toLocaleString?.() ?? c.monthlyRentManwon}만원`
        : `${c.totalEok}억원`;
    markers.push({
      id: idx,
      lat: c.lat,
      lng: c.lng,
      color: budgetFitColor(c.withinBudget),
      approximate: !c.geocoded,
      landing: true,
      popupHtml: `<strong>${c.complexName}</strong><br/>${priceLine} · ${c.pyeong}평${!c.geocoded ? "<br/><em>(정확한 위치 아님)</em>" : ""}`,
    });
  });

  const mapCenter = district ? { lat: district.lat, lng: district.lng } : { lat: 37.5665, lng: 126.978 };

  return (
    <div>
      <p className="subtitle">
        갈 지역을 먼저 정하셨다면, 그 지역에서 필요한 예산이 얼마쯤인지 먼저 보여드리고, 그
        예산 안에서 조건에 맞는 실제 매물을 지도와 함께 찾아 드립니다. 이제 서울뿐 아니라 전국
        250개 이상 시/군/구를 대상으로 검색할 수 있습니다.
      </p>

      <form className="panel" onSubmit={handleSearch}>
        <h2>1. 지역 선택</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="district">가고 싶은 시/군/구</label>
            <select id="district" value={lawdCd} onChange={(e) => { setLawdCd(e.target.value); setBudgetTouched(false); }}>
              {DISTRICT_GROUPS.map((g) => (
                <optgroup key={g.sido} label={g.sido}>
                  {g.items.map((d) => (
                    <option key={d.lawdCd} value={d.lawdCd}>{d.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dealType2">거래 유형</label>
            <select id="dealType2" value={dealType} onChange={(e) => { setDealType(e.target.value); setBudgetTouched(false); }}>
              {DEAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="houseType2">주택 유형</label>
            <select id="houseType2" value={houseType} onChange={(e) => setHouseType(e.target.value)}>
              {HOUSE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pyeong2">원하는 평형(평)</label>
            <input id="pyeong2" type="number" min="10" step="1" value={pyeong} onChange={(e) => setPyeong(e.target.value)} />
          </div>
        </div>

        {district && !district.indexResearched && (
          <p className="note" style={{ marginTop: 8 }}>
            {districtLabel}은(는) 서울 25개 구 밖의 지역이라 학군·치안·생활편의 참고지수와 조사
            평당가는 아직 없습니다(위/경도와 국토부 지역코드는 실제 값입니다). 실거래가 API 키가
            설정되어 있으면 아래 예산은 이 지역의 실시간 실거래 표본으로 계산됩니다.
          </p>
        )}

        <button
          type="button"
          className="conditions-drawer-btn"
          onClick={() => setBudgetDrawerOpen(true)}
        >
          <span className="conditions-drawer-btn-text">
            <span className="conditions-drawer-btn-title">필요 예산 · 세부 조건 설정</span>
            <span className="conditions-drawer-btn-hint">
              {estimating
                ? "예산을 계산하고 있어요..."
                : budgetMin && budgetMax
                ? `${budgetMin}억 ~ ${budgetMax}억원`
                : "예산 미설정"}
            </span>
          </span>
          <span className="conditions-drawer-btn-arrow" aria-hidden="true">›</span>
        </button>

        <SlideDrawer
          open={budgetDrawerOpen}
          onClose={() => setBudgetDrawerOpen(false)}
          title="필요 예산 (자동 계산)"
        >
          {!estimate ? (
            <p className="note">
              {estimating ? "예산을 계산하고 있어요..." : "지역을 먼저 선택해 주세요."}
            </p>
          ) : (
            <div className="budget-reveal" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
              {estimate.estimateError && (
                <div className="error-box" style={{ marginBottom: 14 }}>
                  실거래 API 조회 중 문제가 있어 아래 예산은 참고값으로 대체했습니다. 이 문제가
                  있으면 "매물 찾기"를 눌러도 매물이 하나도 안 나올 가능성이 높습니다.
                  <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 12 }}>{estimate.estimateError}</div>
                </div>
              )}

              {estimate.estimatedRange ? (
                <p className="note">
                  {districtLabel}에서 {estimate.houseTypeLabel} · {estimate.dealTypeLabel} {pyeong}평형 기준,{" "}
                  {estimate.estimatedRange.seedFallback
                    ? "실거래 표본이 부족해 조사 참고 평당가로 추정한 값입니다."
                    : estimate.estimatedRange.percentileBased
                    ? `최근 실거래 ${estimate.estimatedRange.sampleSize}건 중 상하위 10%(극단적인 급매·신고가)를 제외한 실제 범위입니다.`
                    : `최근 실거래 ${estimate.estimatedRange.sampleSize}건 기준 실제 범위입니다(표본이 적어 최소~최대를 그대로 사용).`}
                  {" "}보통 <strong>{estimate.estimatedRange.min}억 ~ {estimate.estimatedRange.max}억원</strong>
                  {" "}(중앙값 {estimate.estimatedRange.median}억원) 정도의 {amountWordFor(dealType)}이 필요해요.
                  아래에서 직접 조정할 수 있습니다.
                </p>
              ) : (
                <p className="note">
                  이 지역·조건에 대한 예산 참고값이 아직 없습니다(조사 참고 평당가도 없고, 실거래
                  표본도 부족합니다). 아래 예산은 비워두거나 직접 원하는 범위를 입력해 주세요 —
                  비워두면 예산 필터 없이 조건에 맞는 매물을 모두 보여드립니다.
                </p>
              )}
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="budgetMin">최소 {budgetLabelFor(dealType)}</label>
                  <input id="budgetMin" type="number" min="0" step="any" value={budgetMin}
                    onChange={(e) => { setBudgetMin(e.target.value); setBudgetTouched(true); }} />
                </div>
                <div className="field">
                  <label htmlFor="budgetMax">최대 {budgetLabelFor(dealType)}</label>
                  <input id="budgetMax" type="number" min="0" step="any" value={budgetMax}
                    onChange={(e) => { setBudgetMax(e.target.value); setBudgetTouched(true); }} />
                </div>
                <div className="field">
                  <label htmlFor="buildAge2">준공 연식</label>
                  <select id="buildAge2" value={maxBuildAge} onChange={(e) => setMaxBuildAge(e.target.value)}>
                    {BUILD_AGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rooms2">희망 방(룸) 개수</label>
                  <select id="rooms2" value={desiredRooms} onChange={(e) => setDesiredRooms(e.target.value)}>
                    {ROOM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="bathrooms2">희망 화장실 개수</label>
                  <select id="bathrooms2" value={desiredBathrooms} onChange={(e) => setDesiredBathrooms(e.target.value)}>
                    {BATHROOM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            className="submit-btn"
            style={{ marginTop: 24 }}
            onClick={() => setBudgetDrawerOpen(false)}
          >
            설정 완료
          </button>
        </SlideDrawer>

        <button className="submit-btn" type="submit" disabled={searching || estimating} style={{ marginTop: 18 }}>
          {searching ? "검색 중..." : `${district ? district.name : ""}에서 매물 찾기`}
        </button>
      </form>

      {error && <div className="error-box">오류가 발생했습니다: {error}</div>}

      {district && (
        <p className="note" style={{ marginTop: -6, marginBottom: 14 }}>
          {districtLabel}의 LH 공공임대 단지·청약홈 분양 공고·LH 공지사항은 상단 "③ 공공주택
          정보" 탭에서 시/도 단위로 확인할 수 있습니다.
        </p>
      )}

      {searchResult && (
        <div className="panel">
          <h2>
            3. 매물 후보
            <span className={`badge ${searchResult.liveEnabled ? "live" : ""}`}>
              {searchResult.liveEnabled ? "실거래가 실시간 연동 중" : "실거래가 API 키 미설정"}
            </span>
          </h2>

          {searchResult.candidateError && (
            <div className="error-box" style={{ marginBottom: 14 }}>
              매물 후보를 불러오는 중 오류가 발생했습니다. 아래 내용을 캡처해 알려주시면
              원인을 확인하는 데 도움이 됩니다.
              <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 12 }}>{searchResult.candidateError}</div>
            </div>
          )}

          {!searchResult.liveEnabled && (
            <p className="note" style={{ marginBottom: 14 }}>
              API 키가 없어 실제 매물 목록은 보여드릴 수 없습니다(위 예산은 조사 참고값 기준
              추정치입니다). README 4번 안내대로 MOLIT_SERVICE_KEY를 설정하면 이 지역의 실제
              거래 단지가 지도와 함께 나타납니다.
            </p>
          )}

          {searchResult.liveEnabled && searchResult.candidates.length === 0 && (
            <p className="note" style={{ marginBottom: 14 }}>
              조건에 맞는 매물을 찾지 못했습니다. 예산 범위를 넓히거나 평형/연식/방개수 조건을
              완화해 보세요.
            </p>
          )}

          <div className="district-split">
            <div className="candidate-list-wrap">
              {(searchResult.candidates || []).map((c, idx) => (
                <DistrictCandidateItem
                  key={idx}
                  candidate={c}
                  selected={selectedIdx === idx}
                  onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                />
              ))}
            </div>
            <LeafletMap
              center={selectedIdx != null ? { lat: searchResult.candidates[selectedIdx].lat, lng: searchResult.candidates[selectedIdx].lng } : mapCenter}
              zoom={selectedIdx != null ? 16 : 13}
              markers={markers}
              selectedId={selectedIdx != null ? selectedIdx : "district-center"}
              onMarkerClick={(id) => setSelectedIdx(id === "district-center" ? null : id)}
              height={440}
              dropKey={searchNonce}
            />
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            지도의 검은 점은 {district ? district.name : ""} 중심 위치이고, 색이 있는 핀은 매물
            후보입니다(초록 = 예산 이내, 주황 = 예산 초과). 점선 테두리가 있는 핀은 정확한 단지
            좌표를 찾지 못해 지역 중심 근처에 대략 표시한 것입니다. 새로 검색할 때마다 매물 핀이
            지도 위에 "파팍" 소리와 진동(지원 기기 한정)을 동반하며 순서대로 꽂히는 연출이
            재생됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

function DistrictCandidateItem({ candidate: c, selected, onClick }) {
  const isWolse = c.dealType === "wolse";
  return (
    <div className={`candidate-item selectable ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="candidate-row1">
        <span className="candidate-name">{c.complexName}</span>
        <span className="candidate-price">
          <span className="candidate-price-value">
            {isWolse ? `보증금 ${c.totalEok}억 · 월세 ${c.monthlyRentManwon?.toLocaleString?.() ?? c.monthlyRentManwon}만원` : `${c.totalEok}억원`}
          </span>
          {c.withinBudget === true && <span className="badge budget-ok">예산 이내</span>}
          {c.withinBudget === false && <span className="badge budget-over">예산 초과</span>}
        </span>
      </div>
      {/* 같은 단지가 층·거래시점만 다르게 여러 건 나올 때 "가격만 다르고 나머지는 똑같아
          보인다"는 혼동을 막기 위한 뱃지입니다 — RankFlow.js CandidateList와 동일한 처리
          (README 27번). */}
      <div className="candidate-distinguish">
        <span className="candidate-chip">{c.floor ? `${c.floor}층` : "층 미상"}</span>
        <span className="candidate-chip">
          거래 {c.dealYmd ? `${c.dealYmd.slice(0, 4)}.${c.dealYmd.slice(4, 6)}` : "미상"}
        </span>
      </div>
      <div className="candidate-meta">
        {c.dong} · {c.pyeong}평({c.areaM2}㎡) · {c.buildYear ? `${c.buildYear}년 준공(${c.age}년차)` : "준공연도 미상"}
      </div>
      <a
        className="naver-link"
        href={naverLandUrl(c.dong, c.complexName)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        네이버 부동산에서 보기 ↗
      </a>

      {selected && (
        <div className="candidate-detail">
          <div className="detail-grid" style={{ borderTop: "none", paddingTop: 0 }}>
            <div>
              전용면적 / 평형
              <strong>{c.areaM2}㎡ / {c.pyeong}평</strong>
            </div>
            <div>
              층
              <strong>{c.floor ? `${c.floor}층` : "미상"}</strong>
            </div>
            <div>
              준공년도
              <strong>{c.buildYear || "미상"}{c.age != null ? ` (${c.age}년차)` : ""}</strong>
            </div>
            <div>
              {isWolse ? "보증금 / 월세" : "최근 거래가"}
              <strong>{isWolse ? `${c.totalEok}억원 / ${c.monthlyRentManwon?.toLocaleString?.() ?? c.monthlyRentManwon}만원` : `${c.totalEok}억원`}</strong>
              <span className="note">거래월 {c.dealYmd?.slice(0, 4)}.{c.dealYmd?.slice(4, 6)}</span>
            </div>
            <div>
              방/화장실
              <strong>{c.layout.label}</strong>
            </div>
            <div>
              위치
              <strong>{c.dong}</strong>
              <span className="note">{c.geocoded ? "지도 좌표 확인됨" : "정확한 좌표 아님(지역 중심 근사치)"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
