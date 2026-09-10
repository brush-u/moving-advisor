/**
 * 국토부 API(lib/molit.js)에서 실사용자 테스트로 확인했던 문제와 같은 원인이 지하철역
 * Overpass API·지오코딩 Nominatim API 호출에도 똑같이 나타날 수 있어 공용으로 뺐습니다:
 * 회사·기관 네트워크나 PC의 보안 소프트웨어가 HTTPS 트래픽을 가로채 자체 서명 인증서로
 * 다시 서명하는 "TLS 검사(SSL inspection)"를 하면, Node의 기본 fetch는 이 인증서를
 * 신뢰하지 않아 "fetch failed"(원인: SELF_SIGNED_CERT_IN_CHAIN)로 실패합니다 — 국토부
 * API만이 아니라 그 네트워크에서 나가는 모든 HTTPS 호출이 똑같이 막힙니다.
 *
 * .env.local에 MOLIT_ALLOW_INSECURE_TLS=1을 설정하면(README 13-2 참고, 이름은 처음
 * 발견된 국토부 API 문제에서 그대로 가져왔지만 이 앱이 만드는 모든 외부 API 호출에
 * 적용됩니다) 인증서 검증을 건너뜁니다. 꺼져 있으면 기존과 동일하게 Node 기본 fetch를
 * 그대로 씁니다.
 *
 * `undici` 패키지는 이 우회 기능(직접 TLS 검증을 끈 Agent/dispatcher를 만드는 것)에만
 * 필요합니다 — Node에는 이미 표준 fetch가 있어서 평소에는 전혀 쓸 일이 없습니다. 그래서
 * `import("undici")`로 실제 그 기능이 켜졌을 때만 지연 로딩합니다. 정적으로
 * `import ... from "undici"`를 맨 위에 써두면, 이 기능을 쓰지 않아도 undici 모듈이
 * 로드되면서 내부적으로 참조하는 `WeakRef`가 Cloudflare Workers 런타임에는 없어서
 * "ReferenceError: WeakRef is not defined"로 배포 자체가 깨지는 문제가 있었습니다
 * (README 31번 — Cloudflare Workers 배포 관련 문제 참고). 이 기능은 애초에 로컬
 * 회사망의 TLS 검사를 우회하기 위한 것이라 Cloudflare 등 실제 배포 환경에서는 켤 일이
 * 없으므로(그 네트워크 자체가 로컬 PC/회사망이 아니라 Cloudflare 서버니까요), 지연
 * 로딩으로 바꿔도 원래 용도에는 전혀 지장이 없습니다.
 */
let insecureAgentPromise = null;
async function getInsecureDispatcher() {
  if (process.env.MOLIT_ALLOW_INSECURE_TLS !== "1") return undefined;
  if (!insecureAgentPromise) {
    insecureAgentPromise = import("undici").then(
      ({ Agent }) => new Agent({ connect: { rejectUnauthorized: false } })
    );
  }
  return insecureAgentPromise;
}

export async function netFetch(url, options = {}) {
  const dispatcher = await getInsecureDispatcher();
  if (dispatcher) {
    const { fetch: undiciFetch } = await import("undici");
    return undiciFetch(url, { ...options, dispatcher });
  }
  return fetch(url, options);
}

/**
 * Node의 fetch는 DNS 실패·연결 거부·TLS 오류 등을 전부 "TypeError: fetch failed"로만
 * 뭉뚱그리고 진짜 원인은 err.cause(중첩 가능)에 담아둡니다. err.message만 로그로 남기면
 * "fetch failed"라는 말만 반복해서 찍혀 원인을 알 수 없으므로, cause 체인을 최대 3단계까지
 * 따라가며 함께 남깁니다(lib/molit.js의 describeError와 동일한 방식).
 */
export function describeFetchError(err) {
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
 * 공공주택 관련 API(마이홈포털 data.myhome.go.kr, LH 청약센터 apis.data.go.kr/B552555)는
 * 공식 문서에서 "각 항목의 필드명"은 확인했지만 "그 항목들을 감싸는 응답 최상위 래퍼 키
 * 이름"까지는 확인하지 못했습니다(data.go.kr 활용신청 승인 후에만 열람 가능한 첨부파일에
 * 있어서, 승인 전에는 실제로 호출해 보기 전까지 알 수 없습니다). 국토부 실거래가 API에서
 * 필드명을 잘못 짐작해 "단지명 미상"만 계속 나오던 사고(README 참고)를 반복하지 않기 위해,
 * 래퍼 키 이름을 하드코딩해서 짐작하는 대신 응답 객체 안에서 "배열 값을 가진 필드"를
 * 찾아내는 방어적인 방식을 씁니다 — 실제 항목 배열이 어떤 키 밑에 있든 상관없이 찾아냅니다.
 * (흔히 쓰이는 이름을 후보로 먼저 시도해 더 정확히 맞힐 확률을 높이고, 그래도 못 찾으면
 * 객체를 순회해 배열인 첫 번째 값을 씁니다.)
 */
export function extractItemArray(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const commonKeys = ["dsList", "list", "items", "item", "data", "results", "resultList"];
  for (const key of commonKeys) {
    if (Array.isArray(json[key])) return json[key];
  }
  // response.body.items.item처럼 한 단계 더 감싸져 있는 경우까지 한 단계만 더 내려가 봅니다.
  for (const key of Object.keys(json)) {
    const val = json[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") {
      for (const innerKey of Object.keys(val)) {
        if (Array.isArray(val[innerKey])) return val[innerKey];
      }
    }
  }
  return [];
}
