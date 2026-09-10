
/**
 * 국토교통부 실거래자료 공공데이터 API 클라이언트.
 *
 * 발급 방법(README 참고):
 *  1) https://www.data.go.kr 회원가입 후
 *     아래 3개 데이터셋에서 각각 활용신청 (즉시 승인, 무료 / 하나만 신청해도 나머지는 자동 승인되는 경우가 많습니다)
 *       - 국토교통부_아파트 매매 실거래자료
 *       - 국토교통부_연립다세대 매매 실거래자료
 *       - 국토교통부_오피스텔 매매 실거래자료
 *  2) 마이페이지 > 개발계정에서 발급된 "일반 인증키(Decoding)"를 복사
 *  3) .env.local 에 MOLIT_SERVICE_KEY=발급받은키 로 저장
 *
 * MOLIT_SERVICE_KEY가 설정되어 있으면 이 모듈이 최근 실거래 데이터를 실시간으로 조회합니다.
 * 설정되어 있지 않으면 호출부가 lib/districts.js의 조사된 참고값으로 자동 폴백합니다
 * (단, "실제 매물 후보" 기능은 개별 단지 데이터라 참고값으로 대체할 수 없어 API 키가 없으면 비활성화됩니다).
 *
 * 주의: 6개 데이터셋(아파트·연립다세대·오피스텔 × 매매·전월세) 전부 사용자가 제공한
 * 공공데이터포털 공식 기술문서(구/신규 API 코드 신구대조표 포함)로 실제 필드명과 서비스 URL을
 * 확인했습니다 — 신규 API는 camelCase 영문 태그(dealAmount/excluUseAr/umdNm/
 * aptNm·offiNm·mhouseNm/buildYear/deposit/monthlyRent 등)만 쓰고 한글 태그는 쓰지
 * 않습니다. 6개 API 모두 문서의 요청/응답 예제를 그대로 재현해 parseItems가 모든 필드를
 * 정확히 뽑아내는 것까지 확인했습니다(연립다세대 매매·오피스텔 전월세·아파트 전월세는 예제
 * 데이터로 전세/월세 필터링까지 재검증했습니다). 만약 그래도 응답이 비어 있거나 특정 필드가
 * 안 나오면 parseItems의 TAG_CANDIDATES에 실제 응답 태그명을 추가해 주세요.
 */

export const HOUSE_TYPES = {
  apt: {
    label: "아파트(주상복합 포함)",
    baseUrl: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
    rentUrl: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
  },
  rh: {
    label: "연립다세대 · 빌라",
    baseUrl: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
    rentUrl: "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
  },
  offi: {
    label: "오피스텔",
    baseUrl: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
    rentUrl: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent",
  },
};

/**
 * 거래유형(매매/전세/월세) 구분.
 * 국토부 전월세 API(RTMSDataSvcAptRent 등)는 전세·월세를 같은 데이터셋에서
 * "월세금액" 필드로만 구분해서 줍니다(월세금액이 0이면 전세, 0보다 크면 월세).
 * 전월세 API 3종(아파트·연립다세대·오피스텔) 모두 공식 기술문서의 예제 응답으로
 * deposit/monthlyRent 필드명과 전세/월세 필터링 로직까지 재현 검증을 마쳤습니다.
 */
export const DEAL_TYPES = {
  trade: { label: "매매" },
  jeonse: { label: "전세" },
  wolse: { label: "월세" },
};

// 같은 서버 프로세스 안에서 재사용하는 아주 단순한 인메모리 캐시
const priceCache = new Map();
const listingCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30분

export function isServiceKeyConfigured() {
  return Boolean(process.env.MOLIT_SERVICE_KEY);
}

/**
 * Node의 전역 fetch(undici)는 DNS 실패·연결 거부·TLS 오류 등을 전부 뭉뚱그려
 * `TypeError: fetch failed`로만 던지고, 진짜 원인은 err.cause(때로는 그 안에 또 cause)에
 * 담아둡니다. err.message만 로그로 남기면 "fetch failed"라는 말만 반복해서 찍혀 원인을
 * 전혀 알 수 없으므로(실사용자 테스트로 실제로 이렇게 나오는 것을 확인했습니다), cause
 * 체인을 최대 3단계까지 따라가며 code/message를 함께 남깁니다.
 */
function describeError(err) {
  const parts = [String(err?.message || err)];
  let cause = err?.cause;
  let depth = 0;
  while (cause && depth < 3) {
    parts.push(`원인: ${cause.code ? `${cause.code} — ` : ""}${cause.message || cause}`);
    cause = cause.cause;
    depth++;
  }
  return parts.join(" / ");
}

/**
 * 국토부/공공데이터포털 API가 "정상 HTTP 200"이지만 인증 실패·서비스 오류를 XML 바디로
 * 돌려주는 경우를 구분하기 위한 에러 타입. 이 오류가 나면 재시도해도 항상 같은 결과이므로
 * (달을 바꿔가며 재시도해도 소용없으므로) 호출부까지 명확하게 전달해 화면에 원인을 보여줍니다.
 */
export class MolitServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = "MolitServiceError";
  }
}

/**
 * 응답 XML이 정상 데이터가 아니라 인증/서비스 오류 메시지인지 확인합니다.
 * 공공데이터포털은 크게 두 가지 오류 형식을 씁니다:
 *  1) <OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>...
 *  2) <response><header><resultCode>30</resultCode><resultMsg>...</resultMsg></header></response> (성공은 보통 00/000)
 */
function detectApiError(xml) {
  const authMsg = extractTag(xml, "returnAuthMsg");
  const errMsg = extractTag(xml, "errMsg");
  if (authMsg || errMsg) return authMsg || errMsg;

  const resultCode = extractTag(xml, "resultCode");
  if (resultCode && resultCode !== "00" && resultCode !== "000") {
    const resultMsg = extractTag(xml, "resultMsg");
    return resultMsg ? `${resultMsg} (resultCode=${resultCode})` : `resultCode=${resultCode}`;
  }
  return null;
}

function recentDealMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

// 데이터셋마다 태그명이 다를 수 있어(한글 태그 vs 영문 태그) 후보를 여러 개 시도합니다.
// 사용자가 공유해 준 공공데이터포털 공식 기술문서 6종(아파트/연립다세대/오피스텔 ×
// 매매/전월세, 각각 "구 API/신규 API 코드 신구대조표" 포함) 전부로 실제 필드명을 확인
// 완료했습니다. 신규 API는 camelCase 영문 태그만 쓰고(예: aptNm, dealAmount) 한글 태그는
// 전혀 쓰지 않습니다 — 처음엔 이 사실을 몰라 한글 태그를 1순위 후보로 넣어뒀었고, 특히
// 단지명 필드는 "아파트"/"단지명"만 후보에 있고 실제 태그인 "aptNm"이 빠져 있어서 모든
// 매물이 "단지명 미상"으로 나오는 버그가 있었습니다(아파트 매매 문서로 발견/수정).
// 이제 문서로 확인된 신규 API 태그를 1순위로, 구 API(소문자) 태그를 2순위로 넣습니다.
// 나머지 5개 API(오피스텔 매매, 연립다세대 전월세, 연립다세대 매매, 오피스텔 전월세,
// 아파트 전월세)는 문서 대조 결과 아래 후보 목록에 실제 태그명(offiNm/mhouseNm/
// deposit/monthlyRent 등)이 이미 정확히 들어 있어서 추가 수정이 필요 없었고, 각 문서의
// 요청/응답 예제를 그대로 fetchRecentListings에 통과시켜 재현 검증까지 완료했습니다.
const TAG_CANDIDATES = {
  amount: ["dealAmount", "dealamount", "거래금액"],
  deposit: ["deposit", "보증금액", "보증금"],
  monthlyRent: ["monthlyRent", "월세금액", "월세"],
  area: ["excluUseAr", "excluusear", "전용면적"],
  buildYear: ["buildYear", "buildyear", "건축년도"],
  dong: ["umdNm", "umdnm", "법정동"],
  complexName: ["aptNm", "aptname", "mhouseNm", "offiNm", "아파트", "건물명", "단지명"],
  dealYear: ["dealYear", "dealyear", "년"],
  dealMonth: ["dealMonth", "dealmonth", "월"],
  dealDay: ["dealDay", "dealday", "일"],
  floor: ["floor", "층"],
};

function extractTag(chunk, tag) {
  // 예전엔 `[^<]*`로 태그 안쪽을 잡았는데, 공공데이터포털이 단지명처럼 특수문자가 섞일 수
  // 있는 필드는 <아파트><![CDATA[문정래미안]]></아파트> 처럼 CDATA로 감싸서 주는 경우가
  // 있습니다. CDATA 시작 부분(`<![CDATA[`) 자체가 `<`로 시작해서 `[^<]*`가 거기서 멈춰버려
  // 빈 문자열로 잘못 처리되던 버그였습니다(실사용자 실거래 API 테스트로 발견). `[\s\S]*?`로
  // 바꿔 CDATA 여부와 무관하게 태그 닫힘까지 통째로 캡처한 뒤, CDATA 래퍼가 있으면 벗겨냅니다.
  const match = chunk.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return null;
  let value = match[1].trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) value = cdata[1].trim();
  return value || null;
}

function extractField(chunk, field) {
  for (const tag of TAG_CANDIDATES[field]) {
    const value = extractTag(chunk, tag);
    if (value) return value;
  }
  return null;
}

/**
 * dealCategory: "trade"(매매, 거래금액 필드 사용) | "rent"(전월세, 보증금+월세금액 필드 사용).
 * 전월세는 "예산을 하나의 숫자로 단순화"하기로 한 설계에 따라 보증금을 amountManwon(예산
 * 기준액)으로 통일해서 담고, 월세금액은 monthlyRentManwon에 별도로 담아 화면에는 따로 보여줍니다.
 */
function parseItems(xml, dealCategory = "trade") {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  let rawCount = 0;
  while ((m = itemRegex.exec(xml)) !== null) {
    rawCount++;
    const chunk = m[1];
    const areaRaw = extractField(chunk, "area");
    if (!areaRaw) continue;
    const areaM2 = Number(areaRaw);
    if (!areaM2) continue;

    let amountManwon;
    let monthlyRentManwon = null;
    if (dealCategory === "rent") {
      const depositRaw = extractField(chunk, "deposit");
      const monthlyRaw = extractField(chunk, "monthlyRent");
      if (!depositRaw) continue;
      amountManwon = Number(depositRaw.replace(/,/g, "").trim());
      monthlyRentManwon = monthlyRaw ? Number(monthlyRaw.replace(/,/g, "").trim()) || 0 : 0;
      if (!amountManwon && !monthlyRentManwon) continue;
    } else {
      const amountRaw = extractField(chunk, "amount");
      if (!amountRaw) continue;
      amountManwon = Number(amountRaw.replace(/,/g, "").trim());
      if (!amountManwon) continue;
    }

    items.push({
      amountManwon,
      monthlyRentManwon,
      areaM2,
      buildYear: Number(extractField(chunk, "buildYear")) || null,
      dong: extractField(chunk, "dong"),
      complexName: extractField(chunk, "complexName"),
      dealYear: extractField(chunk, "dealYear"),
      dealMonth: extractField(chunk, "dealMonth"),
      dealDay: extractField(chunk, "dealDay"),
      floor: extractField(chunk, "floor"),
    });
  }
  // 진단용 로그: XML에는 <item>이 있는데(=API 자체는 데이터를 돌려줌) 파싱된 유효 거래가
  // 0건이면, 필터 조건이 아니라 TAG_CANDIDATES 필드명이 실제 응답과 안 맞는(응답 스키마가
  // 바뀌었거나 예상 못 한 데이터셋 변형인) "파싱 실패"일 가능성이 높습니다. 원인 파악을
  // 위해 응답 앞부분을 함께 남깁니다.
  if (rawCount > 0 && items.length === 0) {
    console.warn(
      `[molit] XML에 <item> ${rawCount}건이 있었지만 파싱된 유효 거래는 0건입니다(dealCategory=${dealCategory}) — ` +
      `필드명이 바뀌었을 수 있습니다. 응답 앞부분: ${xml.slice(0, 800)}`
    );
  }
  return items;
}

// 전월세 결과에서 전세(월세금액=0)만, 또는 월세(월세금액>0)만 골라냅니다. 매매는 그대로 통과.
function filterByDealType(items, dealType) {
  if (dealType === "jeonse") return items.filter((it) => !it.monthlyRentManwon);
  if (dealType === "wolse") return items.filter((it) => it.monthlyRentManwon > 0);
  return items;
}

// 국토부 기술문서에 "초당 최대 트랜잭션 30tps"라고 명시되어 있습니다. 전국 250개 이상
// 지역을 한꺼번에 Promise.all로 조회하면(① 모드 랭킹) 이 한도를 훨씬 넘겨 실제로 HTTP 429
// (요청 과다) 오류가 발생하는 것을 실사용자 테스트로 확인했습니다. Nominatim 지오코딩에 쓰던
// 것과 같은 방식으로 "요청 시작" 자체를 초당 최대치보다 여유 있게(약 20tps) 줄지어 세워서
// 보내고, 그래도 429가 오면 지수 백오프로 몇 차례 재시도합니다.
const MOLIT_MIN_INTERVAL_MS = 50; // 초당 최대 20건의 "새 요청 시작"만 허용 (30tps보다 여유있게)
const MOLIT_MAX_RETRIES = 3;
let molitLastCallAt = 0;
let molitQueue = Promise.resolve();

function scheduleMolitSlot() {
  const claimed = molitQueue.then(async () => {
    const wait = MOLIT_MIN_INTERVAL_MS - (Date.now() - molitLastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    molitLastCallAt = Date.now();
  });
  molitQueue = claimed;
  return claimed;
}

// 실사용자 테스트로 확인된 사례: 회사·기관 네트워크나 백신/보안 소프트웨어가 HTTPS 트래픽을
// 가로채 자체 서명 인증서로 다시 서명하는 "TLS 검사(SSL inspection)"를 하는 경우, Node의
// 기본 fetch는 이 자체 서명 인증서를 신뢰하지 않아 "fetch failed"(원인: SELF_SIGNED_CERT_IN_CHAIN
// 등)로 실패합니다. 가장 안전한 해결책은 그 보안 소프트웨어/네트워크의 루트 인증서를
// Node에 직접 신뢰시키는 것(NODE_EXTRA_CA_CERTS 환경변수 — README 13-1 참고)이지만, 그
// 인증서를 찾아 내보내기 번거로운 경우를 위해 .env.local에 MOLIT_ALLOW_INSECURE_TLS=1을
// 설정하면 "국토부 API 요청에 한해서만" 인증서 검증을 건너뛰도록 우회 옵션을 뒀습니다
// (기본값은 꺼져 있고, 앱의 다른 기능이나 Node 프로세스 전체에는 영향을 주지 않습니다 —
// 다만 이 우회를 켜면 그 API로 가는 트래픽이 중간에서 조작되어도 알아챌 수 없게 되므로,
// 신뢰할 수 없는 네트워크(공용 와이파이 등)에서는 켜지 않는 것을 권장합니다).
//
// `undici` 패키지는 이 기능이 실제로 켜졌을 때만 지연 로딩(import())합니다 — 맨 위에서
// 정적으로 import해 두면 이 기능을 안 써도 undici 내부의 `WeakRef` 참조 때문에
// Cloudflare Workers 배포가 "ReferenceError: WeakRef is not defined"로 깨졌습니다
// (lib/netFetch.js 상단 주석, README 31번 참고 — 같은 이유로 거기서도 지연 로딩으로
// 바꿨습니다).
let insecureMolitAgentPromise = null;
async function getMolitDispatcher() {
  if (process.env.MOLIT_ALLOW_INSECURE_TLS !== "1") return undefined;
  if (!insecureMolitAgentPromise) {
    insecureMolitAgentPromise = import("undici").then(
      ({ Agent }) => new Agent({ connect: { rejectUnauthorized: false } })
    );
  }
  return insecureMolitAgentPromise;
}

async function throttledMolitFetch(url, attempt = 0) {
  await scheduleMolitSlot();
  const dispatcher = await getMolitDispatcher();
  const res = dispatcher
    ? await (await import("undici")).fetch(url, { dispatcher })
    : await fetch(url, { next: { revalidate: 0 } });
  if (res.status === 429 && attempt < MOLIT_MAX_RETRIES) {
    const backoffMs = 500 * 2 ** attempt; // 500ms, 1000ms, 2000ms
    await new Promise((r) => setTimeout(r, backoffMs));
    return throttledMolitFetch(url, attempt + 1);
  }
  return res;
}

async function callApi(houseType, lawdCd, dealYmd, dealCategory = "trade") {
  const config = HOUSE_TYPES[houseType] || HOUSE_TYPES.apt;
  const url = new URL(dealCategory === "rent" ? config.rentUrl : config.baseUrl);
  url.searchParams.set("serviceKey", process.env.MOLIT_SERVICE_KEY);
  url.searchParams.set("LAWD_CD", lawdCd);
  url.searchParams.set("DEAL_YMD", dealYmd);
  url.searchParams.set("numOfRows", "500");
  url.searchParams.set("pageNo", "1");

  const res = await throttledMolitFetch(url.toString());
  const xml = await res.text();

  if (!res.ok) {
    if (res.status === 429) {
      throw new MolitServiceError(
        `국토부 실거래가 API가 HTTP 429(요청 과다) 오류를 반환했습니다. 전국 여러 지역을 한꺼번에 ` +
        `조회할 때 국토부가 명시한 초당 최대 트랜잭션(30tps)을 넘긴 것으로 보입니다 — 자동으로 몇 차례 ` +
        `재시도했지만 그래도 계속되면 잠시 후 다시 시도해 주세요.`
      );
    }
    if (res.status === 403 || res.status === 401) {
      // 다른 주택유형(예: 아파트)은 같은 서비스키로 정상 동작하는데 특정 유형만 403/401이
      // 나는 경우가 실제로 있었습니다. 원인은 인증키 자체가 아니라, 데이터셋마다 활용신청을
      // "따로" 해야 하는데 이 유형(config.label)만 아직 신청/승인이 안 된 경우였습니다.
      throw new MolitServiceError(
        `국토부 실거래가 API가 HTTP ${res.status}(권한 없음) 오류를 반환했습니다. 같은 서비스키라도 ` +
        `데이터셋(주택유형·매매/전월세)마다 공공데이터포털에서 "따로" 활용신청을 해야 하는데, ` +
        `"${config.label}" ${dealCategory === "rent" ? "전월세" : "매매"} 데이터셋은 아직 활용신청을 ` +
        `안 했거나 신청은 했지만 아직 승인 대기 중일 가능성이 높습니다(다른 주택유형은 정상 동작 ` +
        `중이라면 서비스키 자체는 문제가 없다는 뜻입니다). data.go.kr 마이페이지 > 개발계정에서 이 ` +
        `데이터셋의 활용신청 상태를 확인해 주세요.`
      );
    }
    throw new MolitServiceError(`국토부 실거래가 API가 HTTP ${res.status} 오류를 반환했습니다.`);
  }

  const apiError = detectApiError(xml);
  if (apiError) {
    throw new MolitServiceError(
      `국토부 실거래가 API 인증/서비스 오류: "${apiError}". MOLIT_SERVICE_KEY가 아직 승인 대기 ` +
      `중이거나(발급 후 활성화까지 시간이 걸릴 수 있음), 잘못된 키(활용신청 화면의 "일반 인증키 ` +
      `(Decoding)"이 아니라 "Encoding" 값을 넣었는지 확인)를 사용했거나, ${config.label} 데이터셋을 ` +
      `아직 활용신청하지 않았을 수 있습니다.`
    );
  }

  const items = parseItems(xml, dealCategory);
  // 진단용 로그: HTTP 200 + 오류 메시지 없음(=API 호출 자체는 성공)인데도 결과가 0건인
  // 경우가 "진짜로 그 달에 거래가 없어서"인지 "요청 자체가 잘못돼서"인지 구분하기 위해
  // 국토부 응답의 totalCount(전체 건수)를 함께 남깁니다. totalCount가 0보다 크면 API는
  // 데이터를 돌려줬다는 뜻이라 위 parseItems 경고(필드명 문제)를 먼저 의심하면 되고,
  // totalCount 자체가 0이거나 안 잡히면 정말 그 달에 신고된 거래가 없다는 뜻입니다.
  const totalCount = extractTag(xml, "totalCount");
  console.log(
    `[molit] ${config.label} ${dealCategory === "rent" ? "전월세" : "매매"} LAWD_CD=${lawdCd} DEAL_YMD=${dealYmd} ` +
    `→ totalCount=${totalCount ?? "?"}, 파싱된 유효 거래=${items.length}건`
  );
  return items;
}

/**
 * 특정 자치구(법정동코드 5자리)의 최근 실거래 평균 평당가(만원/평)를 반환. (구 단위 가격 지표용)
 * dealType이 "trade"가 아니면 보증금 기준 평당가를 계산합니다(월세는 보증금만 반영, 월세금액은
 * 별도이므로 이 평당가에는 포함되지 않습니다).
 */
export async function fetchAvgPricePerPyeong(lawdCd, houseType = "apt", dealType = "trade") {
  if (!isServiceKeyConfigured()) return null;
  const dealCategory = dealType === "trade" ? "trade" : "rent";

  const cacheKey = `${dealType}:${houseType}:${lawdCd}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  for (let offset = 0; offset < 3; offset++) {
    const dealYmd = recentDealMonth(offset);
    try {
      let items = await callApi(houseType, lawdCd, dealYmd, dealCategory);
      if (dealCategory === "rent") items = filterByDealType(items, dealType);
      if (items.length < 5) {
        // 진단용 로그: 이 달은 건너뛰고 다음 달로 넘어간다는 뜻인데, 이게 조용히 반복되다가
        // 3개월 다 소진하면 화면엔 아무 설명 없이 그냥 "조사 참고값"으로 표시됩니다 —
        // 왜 건너뛰었는지(표본 부족 자체는 정상 동작) 터미널에서 보이게 남깁니다.
        console.log(
          `[molit] ${lawdCd} ${houseType}/${dealType} ${dealYmd}: 표본 ${items.length}건(<5) — 평균가 계산에 부족해 다음 달로 넘어갑니다.`
        );
        continue;
      }

      const pyeongPrices = items.map((it) => it.amountManwon / (it.areaM2 / 3.3058));
      const avg = pyeongPrices.reduce((sum, v) => sum + v, 0) / pyeongPrices.length;

      const value = { pricePerPyeong: Math.round(avg), dealYmd, sampleSize: items.length };
      priceCache.set(cacheKey, { value, at: Date.now() });
      return value;
    } catch (err) {
      // 진단용 로그: 이전에는 에러 종류(인증오류/429/네트워크 등)를 구분하지 않고 조용히
      // 다음 달로 넘어갔습니다. 3개월 다 실패하면 null을 반환해 화면엔 그냥 "조사 참고값"만
      // 보이고 원인은 전혀 남지 않았습니다 — 서버 터미널에 원인을 남깁니다.
      console.warn(`[molit] ${lawdCd} ${houseType}/${dealType} ${dealYmd} 평균가 조회 실패: ${describeError(err)}`);
      continue;
    }
  }
  return null;
}

/**
 * 특정 자치구 + 주택유형 + 거래유형의 최근 개별 거래(=실제 매물 후보의 재료) 목록을 반환.
 * 구 단위 평균이 아니라 단지명/법정동/전용면적/건축년도가 담긴 원자료(raw record)입니다.
 */
export async function fetchRecentListings(lawdCd, houseType = "apt", monthsBack = 2, dealType = "trade") {
  if (!isServiceKeyConfigured()) return [];
  const dealCategory = dealType === "trade" ? "trade" : "rent";

  const cacheKey = `listings:${dealType}:${houseType}:${lawdCd}:${monthsBack}`;
  const cached = listingCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const monthErrors = [];
  const monthResults = await Promise.all(
    Array.from({ length: monthsBack }, (_, i) => recentDealMonth(i)).map((dealYmd) =>
      callApi(houseType, lawdCd, dealYmd, dealCategory)
        .then((items) => items.map((it) => ({ ...it, dealYmd })))
        .catch((err) => {
          // 인증/서비스 오류(MolitServiceError)는 달을 바꿔가며 재시도해도 항상 같은 결과이므로
          // 조용히 넘기지 않고 호출부까지 전달해 화면에 원인을 보여줍니다. 그 외 일시적인
          // 네트워크 오류 등은 기존처럼 해당 달만 건너뛰고 계속 진행합니다.
          const desc = describeError(err);
          console.warn(`[molit] ${lawdCd} ${houseType}/${dealType} ${dealYmd} 매물 조회 실패: ${desc}`);
          monthErrors.push(desc);
          if (err instanceof MolitServiceError) throw err;
          return [];
        })
    )
  );

  let merged = monthResults.flat();
  if (dealCategory === "rent") merged = filterByDealType(merged, dealType);

  // 진단: 조회한 "모든" 달이 정상 응답이 아니라 에러로 실패했다면, 이건 "그 기간에 진짜
  // 거래가 없어서"가 아니라 요청 자체가 실패한 것입니다(예: 서버가 apis.data.go.kr에
  // 접속조차 못 하는 네트워크/방화벽/프록시 문제 — "fetch failed"류 에러는 이런 원인이
  // MolitServiceError로 감싸지지 않은 채 조용히 []로 넘어가곤 했습니다). 화면에 그냥
  // "조건에 맞는 거래를 찾지 못했습니다"로만 보이면 사용자가 원인을 알 방법이 없으므로,
  // 조용히 넘기지 않고 명확한 에러로 호출부(route.js)까지 전달해 화면에 원인을 보여줍니다.
  if (merged.length === 0 && monthErrors.length === monthsBack && monthsBack > 0) {
    throw new MolitServiceError(
      `국토부 실거래가 API 요청이 최근 ${monthsBack}개월치 전부 실패했습니다(데이터가 없어서가 아니라 ` +
      `요청 자체가 실패했습니다). 마지막 오류: ${monthErrors[monthErrors.length - 1]} — 서버가 ` +
      `apis.data.go.kr에 접속하지 못하는 상태(방화벽/프록시/DNS 문제 등)일 수 있습니다. 서버를 ` +
      `실행 중인 기기의 터미널에서 이 주소로 접속이 되는지(예: curl -v https://apis.data.go.kr) ` +
      `확인해 보세요.`
    );
  }

  listingCache.set(cacheKey, { value: merged, at: Date.now() });
  return merged;
}
