#!/usr/bin/env node
/**
 * 국토교통부 실거래가 API "단독" 테스트 스크립트.
 *
 * 이 앱(Next.js) 전체를 켜지 않고, 발급받은 MOLIT_SERVICE_KEY 하나만으로 국토부 API가
 * 실제로 응답하는지 바로 확인할 수 있습니다. 화면/브라우저 없이 터미널에서 실행됩니다.
 *
 * 왜 이 스크립트가 필요한가:
 *   AI(Claude)가 개발 중에 "테스트를 통과했다"고 말한 것은, 이 스크립트가 아니라 가짜로
 *   흉내 낸(mock) 국토부 API 응답으로 화면 로직을 검증한 것입니다. 이 개발 환경(샌드박스)은
 *   보안 정책상 apis.data.go.kr로 나가는 네트워크 요청 자체가 차단되어 있어서, 실제
 *   서비스키로 진짜 응답을 받아본 적이 한 번도 없습니다(아래 "실행 결과" 예시 참고).
 *   그래서 실제 키로 사용자가 테스트했을 때와 결과가 다를 수 있습니다 — 이 스크립트는
 *   그 간극을 없애기 위해, 사용자의 실제 네트워크·실제 키로 국토부 API 원본 응답을
 *   그대로 보여줍니다.
 *
 * 사용법:
 *   cd moving-advisor
 *   MOLIT_SERVICE_KEY=발급받은키 node scripts/test-molit-api.js
 *
 *   # 지역/주택유형/거래유형/월을 바꾸려면:
 *   MOLIT_SERVICE_KEY=발급받은키 node scripts/test-molit-api.js --lawdCd=41135 --houseType=apt --dealType=trade --month=202601
 *
 * 옵션:
 *   --lawdCd    법정동코드 5자리 (기본값 11680 = 강남구)
 *   --houseType apt | rh | offi (기본값 apt)
 *   --dealType  trade | jeonse | wolse (기본값 trade; jeonse/wolse는 같은 전월세 API를 씀)
 *   --month     YYYYMM (기본값: 이번 달)
 *   --all       위 옵션을 무시하고 apt/rh/offi × trade/rent 6가지 조합을 한 번에 테스트
 */

const HOUSE_TYPES = {
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

function parseArgs() {
  const args = { lawdCd: "11680", houseType: "apt", dealType: "trade", month: null, all: false };
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "all") args.all = true;
    else args[key] = value;
  }
  if (!args.month) {
    const d = new Date();
    args.month = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return args;
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : null;
}

// lib/molit.js의 detectApiError()와 동일한 로직 (독립 스크립트라 여기서도 그대로 재사용)
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

async function testOne({ serviceKey, lawdCd, houseType, dealType, month }) {
  const config = HOUSE_TYPES[houseType];
  const dealCategory = dealType === "trade" ? "trade" : "rent";
  const url = new URL(dealCategory === "rent" ? config.rentUrl : config.baseUrl);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("LAWD_CD", lawdCd);
  url.searchParams.set("DEAL_YMD", month);
  url.searchParams.set("numOfRows", "50");
  url.searchParams.set("pageNo", "1");

  const label = `${config.label} · ${dealType} · LAWD_CD=${lawdCd} · ${month}`;
  console.log(`\n=== ${label} ===`);
  console.log(`요청 URL: ${url.toString().replace(serviceKey, "***KEY***")}`);

  let res;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    console.log(`❌ 네트워크 요청 자체가 실패했습니다: ${err.message}`);
    console.log(`   (방화벽/프록시 문제일 수 있습니다. 이 컴퓨터에서 apis.data.go.kr 접속이 막혀있지 않은지 확인해 주세요.)`);
    return;
  }

  const xml = await res.text();
  console.log(`HTTP 상태: ${res.status}`);

  if (!res.ok) {
    console.log(`❌ HTTP 오류. 응답 본문 앞부분:\n${xml.slice(0, 500)}`);
    return;
  }

  const apiError = detectApiError(xml);
  if (apiError) {
    console.log(`❌ 국토부 API가 "정상 HTTP 200"이지만 오류를 반환했습니다: "${apiError}"`);
    console.log(`   흔한 원인: 1) 서비스키가 아직 승인 대기 중(발급 후 활성화까지 시간이 걸릴 수 있음)`);
    console.log(`             2) "Encoding" 키를 넣었음(활용신청 화면의 "일반 인증키(Decoding)"를 써야 함)`);
    console.log(`             3) 이 데이터셋(${config.label} ${dealCategory === "rent" ? "전월세" : "매매"})을 아직 활용신청하지 않음`);
    return;
  }

  const itemCount = (xml.match(/<item>/g) || []).length;
  console.log(`✅ 정상 응답. <item> 개수: ${itemCount}건`);

  if (itemCount === 0) {
    console.log(`   이 지역/월에는 거래가 없을 수 있습니다. --month를 다른 달로 바꿔서 다시 시도해 보세요`);
    console.log(`   (예: --month=202512, --month=202511 ...). 계속 0건이면 --lawdCd를 다른 지역으로 바꿔보세요.`);
    return;
  }

  const firstItemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  console.log(`\n첫 번째 <item> 원본 (이 태그명이 lib/molit.js의 TAG_CANDIDATES와 일치하는지 확인하세요):`);
  console.log(firstItemMatch ? firstItemMatch[1].trim() : "(item 태그를 찾지 못함)");
}

async function main() {
  const args = parseArgs();
  const serviceKey = process.env.MOLIT_SERVICE_KEY;
  if (!serviceKey) {
    console.error("MOLIT_SERVICE_KEY 환경변수가 없습니다. 예: MOLIT_SERVICE_KEY=발급받은키 node scripts/test-molit-api.js");
    process.exit(1);
  }

  console.log(`국토교통부 실거래가 API 단독 테스트`);
  console.log(`(이 스크립트는 Next.js 앱과 무관하게 fetch로 국토부 서버에 직접 요청합니다)`);

  if (args.all) {
    for (const houseType of Object.keys(HOUSE_TYPES)) {
      for (const dealType of ["trade", "jeonse"]) {
        // eslint-disable-next-line no-await-in-loop
        await testOne({ serviceKey, lawdCd: args.lawdCd, houseType, dealType, month: args.month });
      }
    }
  } else {
    await testOne({ serviceKey, lawdCd: args.lawdCd, houseType: args.houseType, dealType: args.dealType, month: args.month });
  }

  console.log(`\n끝. ❌ 표시가 있으면 그 원인을 먼저 해결한 뒤 앱(MOLIT_SERVICE_KEY 설정)을 다시 테스트해 주세요.`);
}

main();
