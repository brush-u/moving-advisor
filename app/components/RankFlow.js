"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { districts as allDistricts, groupDistrictsBySido, sidoShort } from "../../lib/districts";
import { scoreToColor, DISTRICT_MARKER_COLOR, budgetFitColor, SUBWAY_MARKER_COLOR, POI_CATEGORY_META } from "./mapColors";
import { haversineKm } from "../../lib/scoring";
import { unlockDartAudio } from "./dartAudio";
import useSubwayStations from "./useSubwayStations";
import usePOIs from "./usePOIs";
import RangeSlider from "./RangeSlider";
import SlideDrawer from "./SlideDrawer";
import MarketTrendChart from "./MarketTrendChart";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const FACTORS = [
  { key: "price", label: "예산/가격대", color: "var(--series-price)" },
  { key: "commute", label: "통근시간", color: "var(--series-commute)" },
  { key: "school", label: "학군/교육", color: "var(--series-school)" },
  { key: "life", label: "치안·생활편의", color: "var(--series-life)" },
];

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

// 예전엔 여기에 "희망 방(룸) 개수"/"희망 화장실 개수" 필터(ROOM_OPTIONS/BATHROOM_OPTIONS)도
// 있었는데, 국토부 실거래가 API에는 방/화장실 개수 데이터 자체가 없어서 전용면적만 보고
// 추정한 값으로 필터링하고 있었습니다(lib/roomEstimate.js). 사용자가 "정확하지 않으니
// 삭제해달라"고 요청해서 이 필터는 없앴습니다 — 추정치 자체는 매물 카드에 참고 정보로만
// 계속 보여줍니다(예: "2~3룸 · 욕실 1개(추정)").

// 목표예산/평형 범위 슬라이더의 양 끝값 — app/api/recommend/route.js의 BUDGET_FLOOR 등과
// 반드시 같은 값을 써야 합니다(손잡이가 끝에 그대로 있으면 그쪽은 "전체"로 해석됩니다).
const BUDGET_FLOOR = 0;
const BUDGET_CEIL = 40;
const BUDGET_STEP = 0.5;
const BUDGET_TICKS = [
  { value: 0, label: "최소" },
  { value: 10, label: "10억" },
  { value: 20, label: "20억" },
  { value: 30, label: "30억" },
  { value: 40, label: "최대" },
];

const PYEONG_FLOOR = 0;
const PYEONG_CEIL = 60;
const PYEONG_STEP = 1;
const PYEONG_TICKS = [
  { value: 0, label: "최소" },
  { value: 15, label: "15평" },
  { value: 30, label: "30평" },
  { value: 45, label: "45평" },
  { value: 60, label: "최대" },
];

// 손잡이가 끝에 그대로 있으면(전체) 숫자 대신 "전체"/"OO 이상"/"OO 이하"로 보여줍니다.
function rangeDisplayLabel(min, max, floor, ceil, unit) {
  const atFloor = min <= floor;
  const atCeil = max >= ceil;
  if (atFloor && atCeil) return "전체";
  if (atFloor) return `${max}${unit} 이하`;
  if (atCeil) return `${min}${unit} 이상`;
  return `${min}~${max}${unit}`;
}

const SIDO_LIST = groupDistrictsBySido().map((g) => g.sido);
const DEFAULT_ORIGIN = { lat: 37.5665, lng: 126.978, label: "서울시청 부근(기본값)" };

// "시/도로 찾기" 모드에서 지도를 전국이 한눈에 들어오는 축척으로 보여주기 위한 고정 시점.
// (반경 모드는 검색 중심점 기준으로 확대해서 보여주지만, 시/도 모드는 경계를 클릭해 고르는
// 방식이라 항상 전국 전도가 보여야 클릭할 수 있습니다.)
const KOREA_CENTER = { lat: 36.3, lng: 127.8 };
const KOREA_ZOOM = 7;

/**
 * 브라우저 Geolocation을 Promise로 감싼 공용 헬퍼. maximumAge를 주면 그만큼 최근 위치
 * 확인 결과를 브라우저가 캐시에서 즉시 돌려줄 수 있어, 페이지가 열리자마자 조용히 한 번
 * 확인해 둔 위치를 "내 위치" 버튼이나 탭 전환 시 다시 물어볼 때 매번 새로 몇 초씩 기다리지
 * 않고 바로 재사용할 수 있게 합니다(실패/미지원 시 null로 조용히 폴백).
 */
function requestCurrentLocation({ maximumAge = 0 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge }
    );
  });
}

// 결과 지도에 매물 후보 핀을 찍을 때, 구 하나당 지도에 표시할 최대 개수(전체 목록은 카드 쪽
// "더보기"로 다 볼 수 있으니, 지도에는 이미 가격 낮은 순으로 정렬된 상위 몇 건만 찍습니다 —
// 지오코딩(좌표 조회) 비용도 아끼고 지도도 덜 복잡해집니다). 원래 5였는데, 지오코딩·핀 낙하
// 애니메이션이 느리다는 피드백을 받아 3으로 줄여 체감 속도를 더 개선했습니다.
const CANDIDATE_MARKER_LIMIT_PER_DISTRICT = 3;

// 지도 포커스+다트 애니메이션이 재생되는 시간, 그리고 그 뒤 "분석 중" 연출을 최소한 유지하는
// 시간. 실제 API 응답이 이보다 빨리 와도 결과가 너무 갑자기 튀어나오지 않도록 뜸을 들입니다.
const FOCUS_MS = 900;
const MIN_SUSPENSE_MS = 1300;

// 처음엔 상위 10개 지역만 카드로 보여주고("더보기"로 더 펼침). 매물 후보는 서버가 대상
// 지역 전체(results 전부)에 대해 이미 조회해서 내려주므로, "더보기"를 눌러도 추가 API
// 호출 없이 이미 받은 데이터를 더 꺼내 보여주기만 합니다.
const RANK_INITIAL_VISIBLE = 10;
const RANK_PAGE_SIZE = 10; // "더보기"를 누를 때마다 이만큼씩 추가로 펼침

// 지도(위치 선택)는 항상 메인 화면에 보이고, "원하는 집 조건"+"무엇을 가장 중요하게"는
// 버튼을 눌러야 오른쪽에서 슬라이드로 나타나는 패널 안에 넣습니다(사용자가 다른 서비스의
// 필터 패널 예시를 보여주며 요청 — README 30번. 이전엔 "다음/이전" 버튼으로 넘기는
// 3단계 마법사였는데, "버튼 말고 오른쪽에서 슬라이드로"라는 명확한 피드백을 받아 이 방식
// 으로 바꿨습니다).

function budgetLabelFor(dealType) {
  if (dealType === "jeonse") return "목표 전세보증금";
  if (dealType === "wolse") return "목표 보증금 (월세는 별도)";
  return "목표 예산";
}

function naverLandUrl(dong, complexName) {
  const q = [dong, complexName].filter(Boolean).join(" ").trim();
  return `https://new.land.naver.com/search?query=${encodeURIComponent(q || "부동산")}`;
}

// 국토부 API는 거래연/월/일을 각 필드로 따로 주는데, lib/molit.js에서 이미 8자리
// YYYYMMDD(일자까지 정확한 실제 거래일)로 합쳐서 넘겨줍니다 — 아주 드물게 일자 필드가 없는
// 옛 데이터면 6자리 YYYYMM(월까지만)으로 대체됩니다. 화면에는 있는 만큼만 보여줍니다.
function formatDealYmd(dealYmd) {
  if (!dealYmd) return "미상";
  const y = dealYmd.slice(0, 4);
  const mo = dealYmd.slice(4, 6);
  const d = dealYmd.length >= 8 ? dealYmd.slice(6, 8) : null;
  return d ? `${y}.${mo}.${d}` : `${y}.${mo}`;
}

// 도보 환산: 부동산 정보에서 흔히 쓰는 기준(약 80m/분 ≈ 시속 4.8km)을 그대로 씁니다.
// 실제 도로/보행로를 따라간 거리가 아니라 직선거리 기준 추정치라, 실제 도보시간은 이보다
// 조금 더 걸릴 수 있습니다.
const WALK_SPEED_KMH = 4.8;
function walkMinutesFor(km) {
  return Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60));
}

// 후보 좌표에서 가장 가까운 지하철역을 찾습니다(직선거리 기준).
function nearestStationTo(lat, lng, stations) {
  if (!stations || stations.length === 0 || lat == null || lng == null) return null;
  let best = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const km = haversineKm(lat, lng, s.lat, s.lng);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return best ? { station: best, km: bestKm } : null;
}

// nearestStationTo와 같은 로직을 지하철역이 아닌 다른 카테고리(마트/백화점/병원/약국)에도
// 그대로 재사용하기 위한 얇은 래퍼입니다("station"이라는 이름이 지하철에 특화돼 있어
// 헷갈리지 않도록 poi로 키만 바꿔 돌려줍니다).
function nearestPoiTo(lat, lng, list) {
  const found = nearestStationTo(lat, lng, list);
  return found ? { poi: found.station, km: found.km } : null;
}

export default function RankFlow() {
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [pickerZoom, setPickerZoom] = useState(11);
  const [focusNonce, setFocusNonce] = useState(0);
  const [launchNonce, setLaunchNonce] = useState(null);

  const [searchMode, setSearchMode] = useState("radius"); // "radius" | "sido"
  const [radiusKm, setRadiusKm] = useState(15);
  const [selectedSido, setSelectedSido] = useState("서울특별시");
  const [sidoGeo, setSidoGeo] = useState(null); // 전국 시/도 경계(GeoJSON) — "시/도로 찾기"를 처음 쓸 때만 불러옵니다

  // "원하는 집 조건 · 중요도" 슬라이드 패널이 열려 있는지.
  const [conditionsDrawerOpen, setConditionsDrawerOpen] = useState(false);

  const [budgetMin, setBudgetMin] = useState(BUDGET_FLOOR);
  const [budgetMax, setBudgetMax] = useState(BUDGET_CEIL);
  const [pyeongMin, setPyeongMin] = useState(PYEONG_FLOOR);
  const [pyeongMax, setPyeongMax] = useState(PYEONG_CEIL);
  const [houseType, setHouseType] = useState("apt");
  const [dealType, setDealType] = useState("trade");
  const [maxBuildAge, setMaxBuildAge] = useState("0");
  const [weights, setWeights] = useState({ price: 30, commute: 30, school: 20, life: 20 });

  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  // 지도의 매물(집) 마커를 클릭했을 때, 어느 매물을 클릭했는지 기억해 뒀다가 (1) 그 매물
  // 카드로 스크롤 이동시키고 (2) 지도에 그 매물 기준 가까운 시설까지 연결선을 그리는 데
  // 씁니다. 마커 id 형식 그대로("lawdCd::cand::idx") 저장합니다.
  const [focusedCandidateKey, setFocusedCandidateKey] = useState(null);
  // 서로 다른 지역의 매물이라도 최대 2개까지 골라 나란히 비교할 수 있게 하는 선택 목록.
  const [compareItems, setCompareItems] = useState([]);

  function toggleCompare(item) {
    setCompareItems((prev) => {
      const exists = prev.some((p) => p.key === item.key);
      if (exists) return prev.filter((p) => p.key !== item.key);
      if (prev.length >= 2) return [prev[1], item]; // 이미 2개 선택돼 있으면 가장 오래된 것을 빼고 새로 담기
      return [...prev, item];
    });
  }

  function removeCompare(key) {
    setCompareItems((prev) => prev.filter((p) => p.key !== key));
  }

  function clearCompare() {
    setCompareItems([]);
  }

  // 기본조건: 페이지가 열리면 우선 내 위치를 조용히 확인해 지도에 표시해 봅니다(권한 거부/실패
  // 시에는 에러 없이 기본 위치를 그대로 씁니다 — 사용자가 아무 것도 안 눌렀는데 에러 문구가
  // 뜨면 당황스러우니까요). 이후에는 지도를 클릭하거나 "내 위치 사용" 버튼으로 언제든 바꿀 수 있습니다.
  useEffect(() => {
    requestCurrentLocation().then((loc) => {
      if (!loc) return;
      setUserLocation(loc);
      setOrigin({ ...loc, label: "내 위치" });
      setPickerZoom(13);
      setFocusNonce((n) => n + 1);
    });
  }, []);

  function moveOrigin(next, zoom) {
    setOrigin(next);
    if (zoom) setPickerZoom(zoom);
    setFocusNonce((n) => n + 1);
  }

  function handleMapClick({ lat, lng }) {
    moveOrigin({ lat, lng, label: "선택한 위치" }, 13);
  }

  // 반경/시·도 탭을 바꿀 때 지도가 현재 위치를 자동으로 다시 포커싱하게 합니다. 이미 알고
  // 있는 위치(직전에 확인한 origin/userLocation)로 먼저 즉시 한 번 이동하고, 그 사이
  // 위치를 새로 확인(대부분 브라우저 캐시로 거의 즉시 반환됨 — maximumAge)해서 다시 한 번
  // 정확히 포커싱합니다. 이미 선택돼 있는 탭을 또 눌렀을 때는(직접 고른 위치를 보존하기
  // 위해) 아무 것도 하지 않습니다.
  function selectSearchMode(mode) {
    if (mode === searchMode) return;
    setSearchMode(mode);
    setFocusNonce((n) => n + 1);
    requestCurrentLocation({ maximumAge: 60000 }).then((loc) => {
      if (!loc) return;
      setUserLocation(loc);
      setOrigin({ lat: loc.lat, lng: loc.lng, label: "내 위치" });
      if (mode === "radius") setPickerZoom((z) => Math.max(z, 13));
      setFocusNonce((n) => n + 1);
    });
  }

  // "시/도로 찾기" 탭을 처음 켤 때만 전국 경계(GeoJSON)를 불러옵니다(꽤 큰 파일이라 반경
  // 모드만 쓰는 사람에게는 굳이 내려받게 하지 않으려고 지연 로딩합니다). 실패해도(오프라인 등)
  // 드롭다운으로는 계속 시/도를 고를 수 있으니 조용히 무시합니다.
  useEffect(() => {
    if (searchMode !== "sido" || sidoGeo) return;
    let cancelled = false;
    fetch("/geo/skorea-sido.json")
      .then((res) => res.json())
      .then((geo) => {
        if (!cancelled) setSidoGeo(geo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [searchMode, sidoGeo]);

  // 전국 지도에서 시/도 영역을 직접 클릭해 골랐을 때: 그 시/도를 검색 대상으로 선택하고,
  // 클릭한 정확한 지점을 통근시간 계산 기준점(origin)으로도 함께 씁니다. 반경 모드의
  // moveOrigin과 달리 지도 확대/포커스는 그대로 전국 전도로 유지합니다(다른 시/도를 이어서
  // 눌러 바꿔볼 수 있게 하기 위함입니다).
  function handleSidoBoundarySelect(name, latlng) {
    setSelectedSido(name);
    if (latlng) {
      setOrigin({ lat: latlng.lat, lng: latlng.lng, label: `${name} 안에서 클릭한 위치` });
    }
  }

  function handleUseMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("이 브라우저에서는 내 위치 확인을 지원하지 않습니다.");
      return;
    }
    setLocating(true);
    // maximumAge를 줘서, 페이지가 열릴 때 이미 조용히 확인해 둔 위치(또는 방금 확인한
    // 위치)가 있으면 브라우저가 새로 몇 초씩 기다리지 않고 캐시에서 바로 돌려주게 합니다
    // ("버튼을 눌러도 바로 안 움직이고 delay가 있다"는 피드백으로 추가한 개선입니다).
    requestCurrentLocation({ maximumAge: 60000 }).then((loc) => {
      setLocating(false);
      if (!loc) {
        setError("위치 정보를 가져오지 못했습니다. 브라우저의 위치 권한 설정을 확인해 주세요.");
        return;
      }
      setUserLocation(loc);
      moveOrigin({ ...loc, label: "내 위치" }, searchMode === "sido" ? undefined : 14);
    });
  }

  function updateWeight(key, value) {
    setWeights((w) => ({ ...w, [key]: Number(value) }));
  }

  const inRangeCount = useMemo(() => {
    if (searchMode !== "radius") return null;
    return allDistricts.filter((d) => haversineKm(d.lat, d.lng, origin.lat, origin.lng) <= radiusKm).length;
  }, [searchMode, radiusKm, origin.lat, origin.lng]);

  // 검색 중심점 근처의 지하철역 — 위치를 고를 때 참고할 수 있게 지도 위에 작은 점으로 표시합니다.
  const originSubwayStations = useSubwayStations(origin.lat, origin.lng, 5);

  async function handleSubmit(e) {
    e.preventDefault();
    // 브라우저 자동재생 정책 때문에, 사용자가 직접 누른 이 클릭 핸들러 "안에서" 동기적으로
    // AudioContext를 만들어 둬야 아래 다트 착지음을 재생할 수 있습니다.
    unlockDartAudio();
    setError(null);
    // 버튼을 누른 즉시 이전 조회 결과를 지웁니다(사용자 요청) — 예전엔 새 결과가 도착할
    // 때까지 이전 검색 결과(지역 카드, 지도 핀)가 화면에 그대로 남아있어서, 지금 로딩 중인
    // 화면이 이전 결과인지 헷갈릴 수 있었습니다.
    setData(null);
    setSelectedDistrict(null);
    setFocusedCandidateKey(null);
    setCompareItems([]);
    setLoading(true);
    setLaunching(true);
    setPickerZoom((z) => Math.max(z, 13));
    setFocusNonce((n) => n + 1); // 지도를 검색 중심점으로 부드럽게 포커싱(줌인)
    setLaunchNonce((n) => (n || 0) + 1); // 그 지점에 다트가 "파팍" 꽂히는 연출 + 소리

    try {
      const fetchPromise = fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: origin.lat,
          originLng: origin.lng,
          originLabel: origin.label,
          searchMode,
          radiusKm,
          sido: selectedSido,
          budgetMin,
          budgetMax,
          pyeongMin,
          pyeongMax,
          weights,
          houseType,
          dealType,
          maxBuildAge,
        }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "요청에 실패했습니다.");
        return json;
      });

      // 포커싱+다트 애니메이션이 끝날 때까지 먼저 기다린 뒤 "분석 중" 문구로 전환하고,
      // 그 뒤로도 최소한의 시간은 결과가 튀어나오지 않게 뜸을 들입니다.
      await new Promise((r) => setTimeout(r, FOCUS_MS));
      setLaunching(false);
      setAnalyzing(true);

      const [json] = await Promise.all([fetchPromise, new Promise((r) => setTimeout(r, MIN_SUSPENSE_MS))]);
      setData(json);
      setSelectedDistrict(null);
      setFocusedCandidateKey(null);
      setCompareItems([]); // 새 검색 결과가 오면 이전 비교 선택은 비웁니다(다른 매물 목록이라 의미가 없어짐)
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLaunching(false);
      setAnalyzing(false);
    }
  }

  const weightSum = weights.price + weights.commute + weights.school + weights.life || 1;

  function handleMarkerClick(id) {
    // 지역 중심 마커의 id는 lawdCd 그대로지만, 매물 후보/지하철역/마트/백화점/병원/약국
    // 마커는 "lawdCd::cand::0", "subway::123", "mart::456" 처럼 접두어를 붙여 구분합니다.
    const idStr = String(id);
    const lawdCd = idStr.split("::")[0];
    setSelectedDistrict(lawdCd);

    // 매물(집) 마커를 클릭한 경우: 지역 카드가 아니라 그 매물 카드로 바로 이동시키고(사용자
    // 요청 5번), focusedCandidateKey를 기억해 지도에 그 매물 기준 가까운 시설까지 연결선을
    // 그립니다(사용자 요청 4번). 조건입력 위치처럼 매물이 아닌 마커(지역/지하철역 등)를
    // 클릭했을 때는 연결선을 지웁니다.
    const candMatch = idStr.match(/^(.+)::cand::(\d+)$/);
    if (candMatch) {
      setFocusedCandidateKey(idStr);
      const idx = candMatch[2];
      const cardEl = document.getElementById(`candidate-${lawdCd}-${idx}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    } else {
      setFocusedCandidateKey(null);
    }

    const el = document.getElementById(`district-card-${lawdCd}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const submitLabel = launching ? "위치를 확인하는 중..." : analyzing ? "지역을 분석하고 있어요..." : "이사 갈 곳 추천받기";

  // "시/도로 찾기" 지도의 기본 중심점: 실제로 확인된 현재 위치가 있으면 그쪽을 우선
  // 보여주고(자동 포커싱), 아직 위치를 확인 못했으면(권한 거부 등) 전국이 고르게 보이는
  // 좌표로 대신합니다. origin은 시/도 지도를 클릭해서 바뀔 수도 있어(그 지점이 통근시간
  // 기준점이 되므로) 이 중심점 계산에는 쓰지 않습니다 — 그러면 시/도를 클릭할 때마다 지도
  // 시점이 그 지점으로 계속 끌려다니게 됩니다.
  const sidoFocusCenter = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : KOREA_CENTER;

  return (
    <div>
      <p className="subtitle">
        기준 위치 + 검색 범위를 정하면 예산·통근시간·학군·치안으로 지역을 비교해 실제
        거래 단지까지 찾아드립니다.
      </p>

      <form className="panel" onSubmit={handleSubmit}>
        <h2>1. 어디서부터 찾아볼까요?</h2>

        <div className="search-mode-toggle">
          <button
            type="button"
            className={`toggle-tab ${searchMode === "radius" ? "active" : ""}`}
            onClick={() => selectSearchMode("radius")}
          >
            반경으로 찾기
          </button>
          <button
            type="button"
            className={`toggle-tab ${searchMode === "sido" ? "active" : ""}`}
            onClick={() => selectSearchMode("sido")}
          >
            시/도로 찾기
          </button>
        </div>

        {searchMode === "radius" ? (
          <p className="note" style={{ marginBottom: 10 }}>
            지도 클릭 또는 위치 버튼(⊙)으로 중심점을 정하세요.
          </p>
        ) : (
          <p className="note" style={{ marginBottom: 10 }}>
            지도에서 시/도를 클릭해 선택하세요(목록에서 골라도 됩니다).
          </p>
        )}

        <div className="map-wrap">
          <LeafletMap
            center={searchMode === "sido" ? sidoFocusCenter : { lat: origin.lat, lng: origin.lng }}
            zoom={searchMode === "sido" ? KOREA_ZOOM : pickerZoom}
            markers={[
              {
                id: "origin",
                lat: origin.lat,
                lng: origin.lng,
                color: DISTRICT_MARKER_COLOR,
                landing: true,
                popupHtml: `<strong>${origin.label}</strong>`,
              },
              ...(searchMode === "radius"
                ? originSubwayStations.map((s) => ({
                    id: `subway::${s.id}`,
                    lat: s.lat,
                    lng: s.lng,
                    color: SUBWAY_MARKER_COLOR,
                    size: 8,
                    popupHtml: `<strong>${s.name}</strong><br/>지하철역`,
                  }))
                : []),
            ]}
            interactive
            onMapClick={handleMapClick}
            circle={searchMode === "radius" ? { lat: origin.lat, lng: origin.lng, radiusKm } : null}
            userLocation={userLocation}
            focus={searchMode === "sido" ? { ...sidoFocusCenter, zoom: KOREA_ZOOM } : { lat: origin.lat, lng: origin.lng, zoom: pickerZoom }}
            focusKey={focusNonce}
            dropKey={launchNonce}
            height={320}
            sidoBoundaries={
              searchMode === "sido" ? { data: sidoGeo, selectedName: selectedSido, onSelect: handleSidoBoundarySelect } : null
            }
          />
          <button
            type="button"
            className="map-locate-btn"
            onClick={handleUseMyLocation}
            disabled={locating}
            title="내 위치 사용"
            aria-label="내 위치 사용"
          >
            {locating ? (
              "…"
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="3" fill="currentColor" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {searchMode === "radius" ? (
          <div className="field">
            <label htmlFor="radius">
              검색 반경: <strong>{radiusKm}km</strong> 안 {inRangeCount}개 지역
            </label>
            <input
              id="radius"
              type="range"
              min="3"
              max="50"
              step="1"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="sido">시/도 선택</label>
            <select id="sido" value={selectedSido} onChange={(e) => setSelectedSido(e.target.value)}>
              {SIDO_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <p className="note" style={{ marginTop: 6 }}>
          현재 검색 중심점: <strong>{origin.label}</strong> ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})
        </p>

        <button
          type="button"
          className="conditions-drawer-btn"
          onClick={() => setConditionsDrawerOpen(true)}
        >
          <span className="conditions-drawer-btn-text">
            <span className="conditions-drawer-btn-title">원하는 집 조건 · 중요도 설정</span>
            <span className="conditions-drawer-btn-hint">
              {budgetLabelFor(dealType)} {rangeDisplayLabel(budgetMin, budgetMax, BUDGET_FLOOR, BUDGET_CEIL, "억")} ·{" "}
              {rangeDisplayLabel(pyeongMin, pyeongMax, PYEONG_FLOOR, PYEONG_CEIL, "평")}
            </span>
          </span>
          <span className="conditions-drawer-btn-arrow" aria-hidden="true">›</span>
        </button>

        <SlideDrawer
          open={conditionsDrawerOpen}
          onClose={() => setConditionsDrawerOpen(false)}
          title="원하는 집 조건 · 중요도"
        >
          <h3>원하는 집 조건</h3>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="dealType">거래 유형</label>
              <select id="dealType" value={dealType} onChange={(e) => setDealType(e.target.value)}>
                {DEAL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="houseType">주택 유형</label>
              <select id="houseType" value={houseType} onChange={(e) => setHouseType(e.target.value)}>
                {HOUSE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="buildAge">준공 연식</label>
              <select id="buildAge" value={maxBuildAge} onChange={(e) => setMaxBuildAge(e.target.value)}>
                {BUILD_AGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <div className="range-slider-header">
              <span>{budgetLabelFor(dealType)}</span>
              <strong>{rangeDisplayLabel(budgetMin, budgetMax, BUDGET_FLOOR, BUDGET_CEIL, "억")}</strong>
            </div>
            <RangeSlider
              floor={BUDGET_FLOOR}
              ceil={BUDGET_CEIL}
              step={BUDGET_STEP}
              minValue={budgetMin}
              maxValue={budgetMax}
              onChange={(min, max) => {
                setBudgetMin(min);
                setBudgetMax(max);
              }}
              ticks={BUDGET_TICKS}
              ariaLabel="목표 예산"
            />
          </div>
          <div className="field" style={{ marginTop: 22 }}>
            <div className="range-slider-header">
              <span>원하는 평형</span>
              <strong>{rangeDisplayLabel(pyeongMin, pyeongMax, PYEONG_FLOOR, PYEONG_CEIL, "평")}</strong>
            </div>
            <RangeSlider
              floor={PYEONG_FLOOR}
              ceil={PYEONG_CEIL}
              step={PYEONG_STEP}
              minValue={pyeongMin}
              maxValue={pyeongMax}
              onChange={(min, max) => {
                setPyeongMin(min);
                setPyeongMax(max);
              }}
              ticks={PYEONG_TICKS}
              ariaLabel="원하는 평형"
            />
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            방/화장실 개수는 전용면적 기준 추정치로 걸러냅니다.
          </p>

          <div className="weights" style={{ marginTop: 24 }}>
            <h3>무엇을 가장 중요하게 볼까요?</h3>
            {FACTORS.map((f) => (
              <div className="weight-row" key={f.key}>
                <span>
                  <span className="dot" style={{ background: f.color }} />
                  {f.label}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights[f.key]}
                  onChange={(e) => updateWeight(f.key, e.target.value)}
                />
                <span style={{ textAlign: "right" }}>
                  {Math.round((weights[f.key] / weightSum) * 100)}%
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="submit-btn"
            style={{ marginTop: 24 }}
            onClick={() => setConditionsDrawerOpen(false)}
          >
            설정 완료
          </button>
        </SlideDrawer>

        <button className="submit-btn" type="submit" disabled={loading} style={{ marginTop: 18 }}>
          {submitLabel}
        </button>

        {(launching || analyzing) && (
          <p className="note suspense-note">
            {launching
              ? "선택하신 위치로 지도를 옮기는 중이에요..."
              : `${searchMode === "radius" ? `반경 ${radiusKm}km` : selectedSido} 안의 지역들을 비교하고 있어요...`}
          </p>
        )}
      </form>

      {error && <div className="error-box">오류가 발생했습니다: {error}</div>}

      {data && (
        <Results
          data={data}
          selectedDistrict={selectedDistrict}
          focusedCandidateKey={focusedCandidateKey}
          onMarkerClick={handleMarkerClick}
          compareItems={compareItems}
          onToggleCompare={toggleCompare}
        />
      )}

      <CompareTray items={compareItems} onRemove={removeCompare} onClear={clearCompare} />

      <p className="footer-note">
        예산 점수는 입력한 예산과 지역 예상 시세(평당가 × 평형)의 적합도를 계산한 값이고,
        통근시간은 선택한 위치와 각 지역 중심 간 직선거리를 대중교통 평균 이동속도로 환산한
        추정치입니다. 학군·치안/생활편의 지수는 서울 25개 구만 공개 통계를 참고해 만든 0~100
        상대 지수이며(그 외 전국 지역은 아직 조사되지 않아 중립값 50점으로 계산됩니다), 실제
        매물 후보의 방/화장실 개수는 전용면적 기반 추정치입니다. 매물 이름 아래 "네이버
        부동산에서 보기" 링크는 국토부 데이터에 정확한 주소가 없어 동+단지명으로 검색한
        결과로 연결됩니다 — 목록에서 실제 매물을 직접 확인해 주세요.
      </p>
    </div>
  );
}

// 지도에 "포커싱"할 때 지역이 몇 km 정도 퍼져 있는지에 맞춰 줌 레벨을 고르기 위한 표.
// 지역이 한두 곳뿐이면 바짝 당겨서 보여주고, 시/도 전체처럼 넓게 퍼져 있으면 멀리서 봅니다.
function zoomForSpreadKm(km) {
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  if (km <= 20) return 11;
  if (km <= 40) return 10;
  if (km <= 80) return 9;
  return 7;
}

function Results({ data, selectedDistrict, focusedCandidateKey, onMarkerClick, compareItems, onToggleCompare }) {
  // 시/도 전체를 대상으로 검색하면 지역이 30개 넘게 나올 수도 있는데, 처음엔 상위 10개만
  // 카드로 보여주고 "더보기"로 펼칩니다(평택/안성처럼 순위가 밀린 지역도 이렇게 볼 수
  // 있습니다). RANK_INITIAL_VISIBLE/RANK_PAGE_SIZE 주석 참고.
  const [visibleCount, setVisibleCount] = useState(RANK_INITIAL_VISIBLE);
  useEffect(() => {
    setVisibleCount(RANK_INITIAL_VISIBLE);
  }, [data]);

  const visibleResults = data.results.slice(0, visibleCount);
  const districtMarkers = visibleResults
    .map((r) => {
      const d = allDistricts.find((x) => x.lawdCd === r.lawdCd);
      if (!d) return null;
      const priceLabel = r.detail.pricePerPyeong != null ? `평당 ${r.detail.pricePerPyeong.toLocaleString()}만원` : "평당가 참고값 없음";
      return {
        id: r.lawdCd,
        lat: d.lat,
        lng: d.lng,
        color: scoreToColor(r.total),
        popupHtml: `<strong>${r.sido} ${r.name}</strong><br/>${r.total}점 · ${priceLabel}`,
      };
    })
    .filter(Boolean);
  const mapCenter = districtMarkers.length
    ? {
        lat: districtMarkers.reduce((s, m) => s + m.lat, 0) / districtMarkers.length,
        lng: districtMarkers.reduce((s, m) => s + m.lng, 0) / districtMarkers.length,
      }
    : { lat: 37.5665, lng: 126.978 };
  const spreadKm = districtMarkers.length
    ? Math.max(...districtMarkers.map((m) => haversineKm(m.lat, m.lng, mapCenter.lat, mapCenter.lng))) + 5
    : 10;

  // 지하철역/대형마트/백화점/병원/약국을 candidateMarkers보다 먼저 구해 둬서(아래로 옮기지
  // 않고 순서만 위로), 매물 후보 마커의 팝업/연결선에 "가장 가까운 시설까지 도보 시간"을
  // 함께 넣을 수 있게 합니다(사용자 요청 3·4·5번 — 예전엔 지하철역만 useSubwayStations로
  // 따로 조회했는데, 5개 카테고리를 한 번에 묶어 조회하는 usePOIs로 대체했습니다).
  const pois = usePOIs(mapCenter.lat, mapCenter.lng, Math.min(spreadKm, 25));
  const subwayStations = pois.subway;

  // 추천 결과(data)가 새로 나올 때마다: (1) 지도를 결과 중심으로 부드럽게 포커싱하고,
  // (2) 상위 지역들의 실제 매물 후보 좌표를 별도로 조회해서 다 도착하는 대로 지도에 "파팍"
  // 꽂히는 연출과 함께 표시합니다. 좌표 조회를 추천 결과 자체와 분리한 이유는
  // app/api/candidate-coords/route.js 상단 설명 참고.
  const [candidateCoords, setCandidateCoords] = useState({});
  const [focusNonce, setFocusNonce] = useState(0);
  const [dropNonce, setDropNonce] = useState(0);

  useEffect(() => {
    setFocusNonce((n) => n + 1);

    const payload = visibleResults
      .map((r) => {
        const d = allDistricts.find((x) => x.lawdCd === r.lawdCd);
        const list = data.candidatesByDistrict?.[r.lawdCd];
        if (!d || !list || list.length === 0) return null;
        // 이미 가격 낮은 순으로 정렬돼 있으니, 지도에는 그중 저렴한 상위 몇 건만 찍습니다.
        const picks = list
          .slice(0, CANDIDATE_MARKER_LIMIT_PER_DISTRICT)
          .map((c, idx) => ({ idx, complexName: c.complexName, dong: c.dong }));
        return { lawdCd: r.lawdCd, sido: d.sido, name: d.name, lat: d.lat, lng: d.lng, candidates: picks };
      })
      .filter(Boolean);

    if (payload.length === 0) {
      setCandidateCoords({});
      return;
    }

    // 예전엔 지역별로 실제 좌표(Nominatim 지오코딩)가 도착하는 대로 그 지역 다트만 그때그때
    // "파팍" 떨어지는 연출을 재생했는데, 지오코딩 자체가 초당 1건 제한이라 지역이 여러 개면
    // 뒤쪽 지역은 몇 초씩 늦게, 순서대로 떨어지는 것처럼 보였습니다. 사용자가 "따로따로 말고
    // 한꺼번에 빠르게 찍어달라"고 요청해서, 이제는 모든 지역의 다트를 일단 그 지역 중심
    // 좌표(임시 위치)로 채워서 네트워크 대기 없이 즉시 한 번에 떨어뜨립니다. 그 뒤 실제
    // 지오코딩 결과가 지역별로 하나씩 도착하면 이미 꽂혀 있는 다트의 위치만 조용히(애니메이션
    // 없이) 정확한 좌표로 다듬습니다 — dropNonce를 그때는 다시 올리지 않아서 낙하 연출이
    // 재생되지 않습니다(아래 candidateMarkers의 landing:true만 유지, settled 개념은 이제
    // dropNonce 하나로 충분해 없앴습니다 — LeafletMap.js의 isFreshDrop 참고).
    const placeholderCoords = {};
    payload.forEach((d) => {
      placeholderCoords[d.lawdCd] = d.candidates.map((c) => ({ idx: c.idx, lat: d.lat, lng: d.lng, geocoded: false }));
    });
    setCandidateCoords(placeholderCoords);
    setDropNonce((n) => n + 1);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/candidate-coords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ districts: payload }),
        });
        if (!res.body) {
          const json = await res.json().catch(() => null);
          if (!cancelled && json?.coordsByDistrict) {
            setCandidateCoords((prev) => ({ ...prev, ...json.coordsByDistrict }));
          }
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (!line.trim()) continue;
            const parsed = JSON.parse(line);
            if (!parsed?.lawdCd) continue;
            // 이미 임시 위치로 꽂혀 있는 다트의 좌표만 조용히 갱신합니다(dropNonce는 위에서
            // 이미 한 번 올렸으므로 여기서는 낙하 애니메이션이 다시 재생되지 않습니다).
            setCandidateCoords((prev) => ({ ...prev, [parsed.lawdCd]: parsed.coords }));
          }
        }
      } catch (err) {
        // 조회 실패해도 이미 꽂힌 임시 위치의 다트는 그대로 남아 있고, 순위/매물 목록 등 핵심
        // 기능에는 영향이 없습니다(지도 핀은 어디까지나 곁들이는 정보).
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const candidateMarkers = visibleResults.flatMap((r) => {
    const coordsList = candidateCoords[r.lawdCd];
    const list = data.candidatesByDistrict?.[r.lawdCd];
    if (!coordsList || !list) return [];
    return coordsList
      .filter((c) => c.lat != null && c.lng != null && list[c.idx])
      .map((c) => {
        const cand = list[c.idx];
        const priceLine =
          cand.dealType === "wolse"
            ? `보증금 ${cand.totalEok}억 · 월세 ${cand.monthlyRentManwon?.toLocaleString?.() ?? cand.monthlyRentManwon}만원`
            : `${cand.totalEok}억원`;
        // 이 매물 좌표에서 가장 가까운 지하철역까지 도보 거리/시간을 계산해 팝업에 함께
        // 보여줍니다(사용자 요청). 좌표가 아직 임시 위치(지역 중심, geocoded:false)인
        // 동안에는 실제 위치가 아니라서 부정확할 수 있으니 표시하지 않습니다.
        const near = c.geocoded ? nearestStationTo(c.lat, c.lng, subwayStations) : null;
        return {
          id: `${r.lawdCd}::cand::${c.idx}`,
          lat: c.lat,
          lng: c.lng,
          color: budgetFitColor(cand.withinBudget),
          approximate: !c.geocoded,
          landing: true,
          popupHtml: `<strong>${cand.complexName}</strong><br/>${r.sido} ${r.name} ${cand.dong}<br/>${priceLine}${
            near
              ? `<br/>🚇 ${near.station.name}역까지 도보 약 ${walkMinutesFor(near.km)}분(약 ${Math.round(near.km * 1000)}m, 직선거리 기준)`
              : ""
          }${!c.geocoded ? "<br/><em>(정확한 위치 아님)</em>" : ""}`,
        };
      });
  });

  // 지하철역/대형마트/백화점/병원/약국을 같은 방식(작은 원 마커 + 카테고리별 색+이모지)으로
  // 지도에 표시합니다(사용자 요청 3번). subwayMarkers는 기존 이름을 그대로 유지해 위
  // candidateMarkers 계산과의 연결(변수 순서)을 건드리지 않습니다.
  const poiMarkersFor = (category) =>
    (pois[category] || []).map((p) => ({
      id: `${category}::${p.id}`,
      lat: p.lat,
      lng: p.lng,
      color: POI_CATEGORY_META[category].color,
      glyph: POI_CATEGORY_META[category].glyph,
      size: 16,
      popupHtml: `<strong>${p.name}</strong><br/>${POI_CATEGORY_META[category].label}`,
    }));
  const subwayMarkers = poiMarkersFor("subway");
  const martMarkers = poiMarkersFor("mart");
  const departmentMarkers = poiMarkersFor("department");
  const hospitalMarkers = poiMarkersFor("hospital");
  const pharmacyMarkers = poiMarkersFor("pharmacy");

  // 지도의 매물(집) 마커를 클릭했을 때(handleMarkerClick이 focusedCandidateKey를 채움),
  // 그 매물의 실제 좌표에서 카테고리별로 가장 가까운 시설까지 잇는 연결선 + 말풍선을
  // 준비합니다(사용자 요청 4번). 아직 임시 좌표(지역 중심, geocoded:false)인 매물은 실제
  // 위치가 아니라서 연결선이 오해를 줄 수 있으므로 만들지 않습니다.
  const focusedMatch = focusedCandidateKey ? String(focusedCandidateKey).match(/^(.+)::cand::(\d+)$/) : null;
  let focusedConnectors = [];
  if (focusedMatch) {
    const [, focusedLawdCd, focusedIdxStr] = focusedMatch;
    const focusedIdx = Number(focusedIdxStr);
    const coordEntry = candidateCoords[focusedLawdCd]?.find((c) => c.idx === focusedIdx);
    if (coordEntry?.geocoded && coordEntry.lat != null && coordEntry.lng != null) {
      focusedConnectors = ["subway", "mart", "department", "hospital", "pharmacy"]
        .map((category) => {
          const near = nearestPoiTo(coordEntry.lat, coordEntry.lng, pois[category]);
          if (!near) return null;
          const meta = POI_CATEGORY_META[category];
          return {
            id: `connector::${category}`,
            points: [
              [coordEntry.lat, coordEntry.lng],
              [near.poi.lat, near.poi.lng],
            ],
            color: meta.color,
            tooltip: `${meta.glyph} ${near.poi.name} · 도보 약 ${walkMinutesFor(near.km)}분(${Math.round(near.km * 1000)}m)`,
          };
        })
        .filter(Boolean);
    }
  }

  // 매물 카드 상세에도 "이 집 기준" 가까운 시설 정보를 보여주기 위한 준비(사용자 요청 5번).
  // 지역별로, 실제 좌표가 확인된(geocoded) 매물만 idx로 계산해 둡니다 — 지도에 마커가 찍힌
  // 매물(상위 CANDIDATE_MARKER_LIMIT_PER_DISTRICT건)과 정확히 같은 기준입니다.
  const poiInfoByDistrict = {};
  visibleResults.forEach((r) => {
    const coordsList = candidateCoords[r.lawdCd];
    if (!coordsList) return;
    const info = {};
    coordsList.forEach((c) => {
      if (!c.geocoded || c.lat == null || c.lng == null) return;
      info[c.idx] = {
        subway: nearestPoiTo(c.lat, c.lng, pois.subway),
        mart: nearestPoiTo(c.lat, c.lng, pois.mart),
        department: nearestPoiTo(c.lat, c.lng, pois.department),
        hospital: nearestPoiTo(c.lat, c.lng, pois.hospital),
        pharmacy: nearestPoiTo(c.lat, c.lng, pois.pharmacy),
      };
    });
    poiInfoByDistrict[r.lawdCd] = info;
  });

  // 6번 요청: "조회하는 그날까지의 부동산 거래 추이"를 지역별·월별로 비교할 수 있는 차트용
  // 데이터. API 키가 없으면(liveEnabled=false) 애초에 국토부 원자료 자체를 조회할 수 없어
  // 조용히 건너뜁니다 — 이 섹션은 곁들이는 정보라 없어도 추천 결과 자체에는 영향이 없습니다.
  // 상위 MAX_TREND_DISTRICTS(6)개 지역만 대상으로 합니다(README lib/marketTrend.js 참고).
  const [trends, setTrends] = useState({});
  useEffect(() => {
    if (!data.meta.liveEnabled) {
      setTrends({});
      return;
    }
    const lawdCds = visibleResults.slice(0, 6).map((r) => r.lawdCd);
    if (lawdCds.length === 0) {
      setTrends({});
      return;
    }
    let cancelled = false;
    fetch("/api/market-trend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lawdCds, houseType: data.meta.houseType, dealType: data.meta.dealType }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setTrends(json.trends || {});
      })
      .catch(() => {
        if (!cancelled) setTrends({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const TREND_COLORS = [
    "var(--series-price)",
    "var(--series-commute)",
    "var(--series-school)",
    "var(--series-life)",
    "var(--series-5)",
    "var(--series-6)",
  ];
  const trendEntries = Object.entries(trends).filter(([, arr]) => arr && arr.length > 0);
  const trendMonths = trendEntries[0]?.[1]?.map((p) => p.ym) || [];
  const trendLabelFor = (lawdCd) => {
    const d = allDistricts.find((x) => x.lawdCd === lawdCd);
    return d ? `${sidoShort(d.sido)} ${d.name}` : lawdCd;
  };
  const trendSeriesCount = trendEntries.map(([lawdCd, arr], i) => ({
    key: lawdCd,
    label: trendLabelFor(lawdCd),
    color: TREND_COLORS[i % TREND_COLORS.length],
    points: arr.map((p) => p.count),
  }));
  const trendSeriesPrice = trendEntries.map(([lawdCd, arr], i) => ({
    key: lawdCd,
    label: trendLabelFor(lawdCd),
    color: TREND_COLORS[i % TREND_COLORS.length],
    points: arr.map((p) => p.avgEok),
  }));

  const markers = [
    ...districtMarkers,
    ...candidateMarkers,
    ...subwayMarkers,
    ...martMarkers,
    ...departmentMarkers,
    ...hospitalMarkers,
    ...pharmacyMarkers,
  ];

  return (
    <div className="panel">
      <h2>
        4. 추천 결과
        <span className={`badge ${data.meta.liveEnabled ? "live" : ""}`}>
          {data.meta.liveEnabled ? "실거래가 실시간 연동 중" : "실거래가 참고값(2025~2026 조사치, 서울만) 사용 중 — API 키 미설정"}
        </span>
      </h2>

      {data.meta.districtPoolSize != null && (
        <p className="note" style={{ marginBottom: 10 }}>
          {data.meta.searchMode === "sido"
            ? `${data.meta.sido} 안 ${data.meta.districtPoolSize}개 지역`
            : `반경 ${data.meta.radiusKm}km 안 ${data.meta.districtPoolSize}개 지역`}{" "}
          비교 결과입니다. 점이 진할수록 고득점 지역, 초록/주황은 매물 후보입니다. 지도 위
          작은 원 마커는 보라 🚇 지하철역, 갈색 🛒 대형마트, 자주 🏬 백화점, 빨강 🏥 병원,
          청록 💊 약국이며, 매물(집) 마커를 클릭하면 그 매물에서 가장 가까운 시설까지 선으로
          이어 도보 시간을 보여주고 해당 매물 카드로 바로 이동합니다. LH 공공임대 단지·청약홈
          분양 공고 등 공공주택 정보는 상단 "③ 공공주택 정보" 탭에서 시/도 단위로 확인할 수
          있습니다.
        </p>
      )}
      <LeafletMap
        center={mapCenter}
        zoom={7}
        markers={markers}
        selectedId={focusedCandidateKey || selectedDistrict}
        onMarkerClick={onMarkerClick}
        height={360}
        focus={{ lat: mapCenter.lat, lng: mapCenter.lng, zoom: zoomForSpreadKm(spreadKm) }}
        focusKey={focusNonce}
        dropKey={dropNonce}
        connectors={focusedConnectors}
      />

      {!data.meta.liveEnabled && (
        <p className="note" style={{ marginBottom: 16 }}>
          API 키 미설정으로 실제 매물 후보는 표시되지 않습니다(README 4번 참고).
        </p>
      )}

      {data.meta.candidateErrors && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          일부 지역의 매물 후보를 불러오지 못했습니다.
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {Object.entries(data.meta.candidateErrors).map(([lawdCd, msg]) => {
              const d = allDistricts.find((x) => x.lawdCd === lawdCd);
              return <li key={lawdCd}>{d ? `${d.sido} ${d.name}` : lawdCd}: {msg}</li>;
            })}
          </ul>
        </div>
      )}

      {trendEntries.length > 0 && (
        <div className="trend-section">
          <h3>지역별·월별 실거래 추이 (최근 6개월)</h3>
          <p className="note">
            조회 시점 기준 국토부 실거래가 원자료를 지역별로 월별 집계한 값입니다. 거래
            건수로 어느 지역이 활발히 거래되는지, 평균 거래금액으로 가격이 오르는지 내리는지
            함께 볼 수 있습니다(예산 범위 등 조건과 무관하게 그 지역 전체의 실거래 기준입니다).
          </p>
          <MarketTrendChart
            title="월별 거래 건수"
            unit="건"
            months={trendMonths}
            series={trendSeriesCount}
            valueFormatter={(v) => (v == null ? "-" : v.toLocaleString())}
          />
          <MarketTrendChart
            title="월별 평균 거래금액"
            unit="억원"
            months={trendMonths}
            series={trendSeriesPrice}
            valueFormatter={(v) => (v == null ? "거래 없음" : v.toFixed(2))}
          />
        </div>
      )}

      {visibleResults.map((r) => (
        <ResultCard
          key={r.lawdCd}
          result={r}
          candidates={data.candidatesByDistrict?.[r.lawdCd]}
          houseTypeLabel={data.meta.houseTypeLabel}
          dealType={data.meta.dealType}
          compareItems={compareItems}
          onToggleCompare={onToggleCompare}
          isSelected={selectedDistrict === r.lawdCd}
          poiInfo={poiInfoByDistrict[r.lawdCd]}
          focusedCandidateKey={focusedCandidateKey}
        />
      ))}

      {visibleResults.length < data.results.length && (
        <button
          type="button"
          className="candidate-more-btn"
          onClick={() => setVisibleCount((n) => Math.min(n + RANK_PAGE_SIZE, data.results.length))}
        >
          지역 {Math.min(RANK_PAGE_SIZE, data.results.length - visibleResults.length)}개 더보기
          (남은 {data.results.length - visibleResults.length}개 — 순위 {visibleResults.length + 1}위부터)
        </button>
      )}
    </div>
  );
}

function ResultCard({
  result,
  candidates,
  houseTypeLabel,
  dealType,
  compareItems,
  onToggleCompare,
  isSelected,
  poiInfo,
  focusedCandidateKey,
}) {
  // 예산/통근/학군/치안 막대그래프와 순위·총점 배지, 그리고 예상 시세·예상 총액을 뺀 나머지
  // 세부 참고지수(예상 통근시간, 학군/치안·편의 참고지수)는 사용자가 "의미 없다"며 지워달라고
  // 요청해 화면에서 제거했습니다. 정렬 자체는 이 값들을 그대로 써서 매기므로(순위는 여전히
  // 점수 순), 카드가 나열되는 순서에는 영향이 없습니다 — 화면에 숫자로 보여주지만 않을 뿐입니다.

  // 25번 변경으로 검색 대상 지역 전체가 카드로 나오면서, 실제 매물 후보가 있는 지역과 0건인
  // 지역이 섞여 목록이 길어졌습니다. "지도의 매물 핀이 어느 구 것인지 목록에서 바로 안 보인다"는
  // 피드백을 받아, 실제 매물 후보가 1건이라도 있는 카드는 초록 테두리로 강조합니다(README
  // 28번). isSelected는 지도 마커를 클릭해서(handleMarkerClick) 이 카드로 스크롤해 왔을 때 —
  // 예전엔 스크롤만 되고 정작 어느 카드로 왔는지 티가 안 났는데, 파란 테두리+그림자로 눈에
  // 띄게 "포커싱"합니다.
  const hasCandidates = Boolean(candidates && candidates.length > 0);
  const cardClass = [
    "result-card",
    hasCandidates ? "has-candidates" : "",
    isSelected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} id={`district-card-${result.lawdCd}`}>
      <div className="result-head">
        <div>
          <span className="name">{result.sido} {result.name}</span>
          {hasCandidates && <span className="badge budget-ok">실제 매물 {candidates.length}건</span>}
        </div>
      </div>

      <div className="detail-grid">
        <div>
          예상 시세(평당)
          <strong>{result.detail.pricePerPyeong != null ? `${result.detail.pricePerPyeong.toLocaleString()}만원` : "참고값 없음"}</strong>
          {result.detail.priceLive ? (
            <span className="note">실거래가 {result.detail.priceDealYmd} 실시간</span>
          ) : result.detail.priceResearched ? (
            <span className="note">조사 참고값</span>
          ) : (
            <span className="note">미조사 지역(예산 점수는 중립값 50점)</span>
          )}
        </div>
        <div>
          예상 총액
          <strong>{result.detail.estimatedTotalEok != null ? `${result.detail.estimatedTotalEok}억원` : "-"}</strong>
        </div>
      </div>

      {candidates && (
        // candidates는 검색 대상 지역 전체에 대해 서버가 이미 조회해 둔 배열입니다(README 25번
        // — 예전엔 상위 10개 지역만 조회하고 나머지는 "미조회" 안내를 따로 보여줬지만, 이제는
        // 순위와 상관없이 전부 조회하므로 그런 구분이 필요 없습니다). 0건이면 CandidateList가
        // 알아서 "조건에 맞는 최근 거래를 찾지 못했습니다" 안내를 보여줍니다. candidates 자체가
        // 아예 없는 경우는 API 키 미설정(liveEnabled=false)뿐이며, 그건 상단 배지로 이미
        // 안내됩니다.
        <CandidateList
          candidates={candidates}
          houseTypeLabel={houseTypeLabel}
          districtName={`${sidoShort(result.sido)} ${result.name}`}
          lawdCd={result.lawdCd}
          dealType={dealType}
          compareItems={compareItems}
          onToggleCompare={onToggleCompare}
          poiInfo={poiInfo}
          focusedCandidateKey={focusedCandidateKey}
        />
      )}
    </div>
  );
}

const CANDIDATE_INITIAL_VISIBLE = 4; // 처음엔 이만큼만 보여줌
const CANDIDATE_PAGE_SIZE = 8; // "더보기"를 누를 때마다 이만큼씩 추가로 펼침

function CandidateList({
  candidates,
  houseTypeLabel,
  districtName,
  lawdCd,
  compareItems,
  onToggleCompare,
  poiInfo,
  focusedCandidateKey,
}) {
  const [visibleCount, setVisibleCount] = useState(CANDIDATE_INITIAL_VISIBLE);
  const visibleCandidates = candidates.slice(0, visibleCount);
  const hiddenCount = candidates.length - visibleCandidates.length;

  return (
    <div className="candidate-section">
      <div className="candidate-title">
        {/* 시/도 전체를 검색하면 카드가 구/군별로 여러 개 이어지는데, 어느 구/군 목록인지
            한눈에 구분되도록 지역명만 굵게+포인트 컬러로 강조합니다(사용자 요청, README 26번).
            "경기도"처럼 긴 정식 명칭 대신 sidoShort()로 줄인 "경기"를 써서 더 짧고 읽기
            쉽게 만들었습니다. */}
        <span className="candidate-title-district">{districtName}</span>의 실제 {houseTypeLabel} 매물 후보 (최근 실거래 기준)
        {candidates.length > 0 && <span className="candidate-count"> · 총 {candidates.length}건</span>}
      </div>
      {candidates.length === 0 ? (
        <p className="note">조건에 맞는 최근 거래를 찾지 못했습니다. 평형 범위나 준공연식, 방/화장실 조건을 완화해 보세요.</p>
      ) : (
        <div className="candidate-list">
          {visibleCandidates.map((c, idx) => {
            const isWolse = c.dealType === "wolse";
            const key = `${lawdCd}-${idx}`;
            const isComparing = compareItems?.some((p) => p.key === key);
            // 지도에서 이 매물 마커를 클릭해 이동해 왔는지(사용자 요청 5번 — 마커 id 형식이
            // handleMarkerClick과 candidateMarkers 양쪽에서 동일하게 "lawdCd::cand::idx"라
            // 그대로 비교할 수 있습니다).
            const isFocused = focusedCandidateKey === `${lawdCd}::cand::${idx}`;
            const poiNear = poiInfo?.[idx];
            const poiChips = poiNear
              ? ["subway", "mart", "department", "hospital", "pharmacy"]
                  .map((category) => {
                    const near = poiNear[category];
                    if (!near) return null;
                    const meta = POI_CATEGORY_META[category];
                    return { category, meta, near };
                  })
                  .filter(Boolean)
              : [];
            return (
              <div
                className={`candidate-item${isComparing ? " comparing" : ""}${isFocused ? " focused" : ""}`}
                id={`candidate-${lawdCd}-${idx}`}
                key={`${c.complexName}-${idx}`}
              >
                <div className="candidate-row1">
                  {/* 예전엔 아파트 이름 아래에 "네이버 부동산에서 보기 ↗" 링크를 따로 뒀는데,
                      사용자 요청으로 그 텍스트 링크는 없애고 아파트 이름 자체를 클릭하면
                      네이버 부동산 검색으로 연결되도록 바꿨습니다. */}
                  <a
                    className="candidate-name candidate-name-link"
                    href={naverLandUrl(c.dong, c.complexName)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.complexName}
                  </a>
                  <span className="candidate-price">
                    <span className="candidate-price-value">
                      {isWolse ? `보증금 ${c.totalEok}억 · 월세 ${c.monthlyRentManwon?.toLocaleString?.() ?? c.monthlyRentManwon}만원` : `${c.totalEok}억원`}
                    </span>
                    {c.withinBudget === true && <span className="badge budget-ok">예산 이내</span>}
                    {c.withinBudget === false && <span className="badge budget-over">예산 초과</span>}
                  </span>
                </div>
                {/* 같은 단지가 층·거래시점만 다른 채 여러 건 나올 때(예: 지제역더샵센트럴시티가
                    가격만 다르게 4건 보이는 경우) "가격만 다르고 나머지는 똑같아 보인다"는
                    혼동을 막기 위해, 실제로 서로 다른 매물임을 구분해 주는 핵심 정보(층·거래월)를
                    가격 바로 아래에 뱃지로 눈에 띄게 보여줍니다. 이 두 값이 다르면 진짜 다른
                    거래 건이고(dedupeLatest가 이미 단지명+면적+층까지 같은 경우만 최신 거래로
                    합쳐서 보여주므로, 층이나 거래월이 다르게 남아있다는 건 실제로 다른 매물이라는
                    뜻입니다 — lib/candidates.js dedupeLatest 주석 참고), 진짜 중복이 아니라서
                    삭제 대신 이렇게 구분 표시로 해결했습니다(README 27번). */}
                <div className="candidate-distinguish">
                  <span className="candidate-chip">{c.floor ? `${c.floor}층` : "층 미상"}</span>
                  <span className="candidate-chip">거래 {formatDealYmd(c.dealYmd)}</span>
                </div>
                <div className="candidate-meta">
                  {c.dong} · {c.pyeong}평({c.areaM2}㎡) · {c.buildYear ? `${c.buildYear}년 준공(${c.age}년차)` : "준공연도 미상"}
                </div>
                <div className="candidate-meta">
                  {c.layout.label}
                </div>
                {/* 이 매물의 실제 좌표(지오코딩 완료분만) 기준으로 가장 가까운 지하철역/
                    대형마트/백화점/병원/약국까지 도보 시간을 보여줍니다(사용자 요청 5번 —
                    "카드 상세에도 표시하는데 집 기준이 되어야 한다"). 지도 마커를 클릭하면
                    뜨는 연결선(사용자 요청 4번)과 정확히 같은 계산 결과입니다. */}
                {poiChips.length > 0 && (
                  <div className="candidate-poi-line">
                    {poiChips.map(({ category, meta, near }) => (
                      <span className="candidate-poi-chip" key={category}>
                        {meta.glyph} {near.poi.name} 도보 {walkMinutesFor(near.km)}분
                      </span>
                    ))}
                  </div>
                )}
                <div className="candidate-row2">
                  {onToggleCompare && (
                    <label className="compare-check">
                      <input
                        type="checkbox"
                        checked={Boolean(isComparing)}
                        onChange={() =>
                          onToggleCompare({
                            key,
                            complexName: c.complexName,
                            dong: c.dong,
                            districtName,
                            pyeong: c.pyeong,
                            areaM2: c.areaM2,
                            buildYear: c.buildYear,
                            age: c.age,
                            floor: c.floor,
                            totalEok: c.totalEok,
                            amountManwon: c.amountManwon,
                            monthlyRentManwon: c.monthlyRentManwon,
                            dealType: c.dealType,
                            withinBudget: c.withinBudget,
                            layout: c.layout,
                            dealYmd: c.dealYmd,
                          })
                        }
                      />
                      비교
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="candidate-more-btn"
          onClick={() => setVisibleCount((v) => Math.min(v + CANDIDATE_PAGE_SIZE, candidates.length))}
        >
          매물 {Math.min(hiddenCount, CANDIDATE_PAGE_SIZE)}건 더보기 (남은 {hiddenCount}건)
        </button>
      )}
      {visibleCount > CANDIDATE_INITIAL_VISIBLE && (
        <button type="button" className="candidate-more-btn" onClick={() => setVisibleCount(CANDIDATE_INITIAL_VISIBLE)}>
          접기
        </button>
      )}
    </div>
  );
}

function compareValueFor(item) {
  if (item.dealType === "wolse") {
    return `보증금 ${item.totalEok}억 · 월세 ${item.monthlyRentManwon?.toLocaleString?.() ?? item.monthlyRentManwon}만원`;
  }
  return `${item.totalEok}억원`;
}

function pricePerPyeongOf(item) {
  if (!item.pyeong) return null;
  return Math.round(item.amountManwon / item.pyeong);
}

// 두 매물 사이에서 특정 지표가 "더 나은" 쪽에만 살짝 강조 표시를 붙입니다(가격은 낮을수록,
// 평형은 넓을수록, 연식은 최근일수록 — 어디까지나 참고용 배지이고 실제 좋고 나쁨은
// 사람마다 다르니 절대적인 판단으로 보이지 않게 문구를 "더 저렴"처럼 사실 위주로 씁니다).
function CompareTable({ items }) {
  const [a, b] = items;
  const priceA = a.amountManwon;
  const priceB = b.amountManwon;
  const cheaperKey = priceA === priceB ? null : priceA < priceB ? a.key : b.key;
  const biggerKey = a.areaM2 === b.areaM2 ? null : a.areaM2 > b.areaM2 ? a.key : b.key;
  const newerKey =
    !a.buildYear || !b.buildYear || a.buildYear === b.buildYear ? null : a.buildYear > b.buildYear ? a.key : b.key;

  const rows = [
    { label: "위치", render: (it) => `${it.districtName} · ${it.dong}` },
    {
      label: "가격",
      render: (it) => compareValueFor(it),
      badgeKey: cheaperKey,
      badgeText: "더 저렴",
    },
    {
      label: "평당가(참고)",
      render: (it) => {
        const v = pricePerPyeongOf(it);
        return v ? `평당 ${v.toLocaleString()}만원` : "-";
      },
    },
    {
      label: "평형/전용면적",
      render: (it) => `${it.pyeong}평 (${it.areaM2}㎡)`,
      badgeKey: biggerKey,
      badgeText: "더 넓음",
    },
    {
      label: "준공년도",
      render: (it) => (it.buildYear ? `${it.buildYear}년 (${it.age}년차)` : "미상"),
      badgeKey: newerKey,
      badgeText: "더 신축",
    },
    { label: "층", render: (it) => (it.floor ? `${it.floor}층` : "미상") },
    { label: "방/화장실 구성(추정)", render: (it) => it.layout?.label || "-" },
    { label: "거래일", render: (it) => formatDealYmd(it.dealYmd) },
    {
      label: "예산 이내",
      render: (it) => (it.withinBudget === true ? "이내" : it.withinBudget === false ? "초과" : "-"),
    },
  ];

  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th></th>
            {/* 예전엔 표 아래에 "네이버 부동산" 행을 따로 두고 링크를 넣었는데, 사용자 요청으로
                그 행은 없애고 대신 여기 아파트 이름(헤더) 자체를 클릭하면 네이버 부동산 검색으로
                연결되도록 바꿨습니다. */}
            <th>
              <a className="naver-link-plain" href={naverLandUrl(a.dong, a.complexName)} target="_blank" rel="noopener noreferrer">
                {a.complexName}
              </a>
            </th>
            <th>
              <a className="naver-link-plain" href={naverLandUrl(b.dong, b.complexName)} target="_blank" rel="noopener noreferrer">
                {b.complexName}
              </a>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th>{row.label}</th>
              {[a, b].map((it) => (
                <td key={it.key}>
                  {row.render(it)}
                  {row.badgeKey === it.key && <span className="badge budget-ok compare-badge">{row.badgeText}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 매물 비교 트레이는 화면 하단에 떠 있는 sticky 영역이라(모달/오버레이가 아니라 배경도 그대로
// 조작 가능), "바깥을 클릭하면 닫힌다"를 만들려면 배경 클릭을 가로챌 백드롭이 없어서 document
// 전체에 pointerdown 리스너를 달아 트레이 바깥을 클릭했는지 직접 판단합니다. 단, 매물 카드의
// "비교하기" 체크박스(.compare-check)는 트레이 DOM 바깥에 있지만 이걸 눌러서 두 번째 매물을
// 담는 것까지 "바깥 클릭"으로 오인해 트레이를 닫아버리면 안 되므로 별도로 제외합니다.
function CompareTray({ items, onRemove, onClear }) {
  const trayRef = useRef(null);
  const hasItems = items && items.length > 0;

  useEffect(() => {
    if (!hasItems) return;
    function handlePointerDown(e) {
      if (trayRef.current && trayRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest(".compare-check")) return;
      onClear?.();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [hasItems, onClear]);

  if (!hasItems) return null;
  return (
    <div className="compare-tray" ref={trayRef}>
      <div className="compare-tray-head">
        <span className="compare-tray-title">매물 비교 ({items.length}/2)</span>
        <div className="compare-tray-chips">
          {items.map((it) => (
            <span className="compare-chip" key={it.key}>
              {it.complexName}
              <button type="button" onClick={() => onRemove(it.key)} aria-label={`${it.complexName} 비교에서 빼기`}>
                ×
              </button>
            </span>
          ))}
          {items.length < 2 && <span className="note compare-hint">매물을 하나 더 골라보세요</span>}
        </div>
      </div>
      {items.length === 2 && <CompareTable items={items} />}
    </div>
  );
}
