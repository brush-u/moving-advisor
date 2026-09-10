/**
 * 전국 250개 시/군/구 기준 데이터.
 *
 * 데이터 성격이 factor마다, 그리고 지역마다 다르므로 각 항목에 source를 명시했습니다.
 *
 *  - "live"     : 서버가 매 요청마다 공공 API를 실시간 호출해 값을 갱신할 수 있음 (국토부 실거래가)
 *  - "cited"    : 실제 공개 통계를 조사해 반영한 값 (기준 시점 명시) — 현재는 서울 25개 구만 해당
 *  - "reference": 정확한 공공 API를 아직 연결하지 못해 일반적으로 알려진 순위/특성을 바탕으로 만든
 *                 "참고용 상대 지수(0~100)". 서울 25개 구만 해당하며, 실제 서비스로 발전시킬 때는
 *                 아래 안내(README §5)를 참고해 공공데이터포털의 학교/병원/공원/치안 API로
 *                 교체하는 것을 강력히 권장합니다.
 *  - (미조사)    : 서울 외 225개 지역은 학군/치안/생활편의 참고지수, 조사 참고 평당가를 개별적으로
 *                 조사하지 못해 `indexResearched: false`로 표시하고 pricePerPyeong/각 지수를
 *                 null로 둡니다. 점수 계산 시 중립값(50)으로 대체되며, 화면에는 "참고 지수
 *                 미제공 지역"이라고 명시됩니다. 실거래가는 MOLIT_SERVICE_KEY만 설정하면
 *                 서울과 동일하게 이 지역들도 실시간으로 조회됩니다(§4 참고).
 *
 * lawdCd: 국토교통부 실거래가 API에 쓰이는 법정동코드 앞 5자리(=시군구코드). 인구 50만 이상이라
 *   자치구(행정구)가 있는 시(수원/성남/안양/안산/고양/용인/청주/천안/전주/포항/창원)는 시
 *   전체가 아니라 각 구 단위 코드를 써야 실거래가 조회가 됩니다(정부 API의 실제 동작 방식).
 *   전국 코드는 행정안전부·공공데이터포털의 법정동코드 표준データ를 기준으로 구성했고,
 *   군위군(대구 편입)·강원/전북 특별자치도 전환 등 최근 개편분을 반영했습니다. 그래도 250개
 *   지역 전체를 실제 서비스키로 라이브 검증하지는 못했으니, 특정 지역에서 매물이 계속 0건이면
 *   README §4의 오류 메시지(화면에 뜨는 candidateError/estimateError)를 확인해 코드가 잘못됐을
 *   가능성을 알려주세요.
 * lat/lng: 시군구 경계의 도형 중심좌표(centroid) 근사값 (직선거리 기반 통근시간 추정, 지도 중심
 *   표시에 사용). 서울 25개 구는 기존에 조사해 둔 구청/중심가 근처 좌표를 그대로 유지했습니다.
 */

export const PRICE_SOURCE_NOTE =
  "서울 25개 구는 2025년 하반기~2026년 초 국민평형(전용 84㎡ 환산) 아파트 평당 매매가 기준 조사치이고, " +
  "그 외 225개 지역은 조사된 참고값이 없어 실거래가 API 키가 있을 때만 예산/가격 정보를 보여드립니다. " +
  "실시간 값이 필요하면 국토교통부 아파트매매 실거래가 API를 연결하세요(서비스키 설정 시 자동 전환).";

export const REFERENCE_SOURCE_NOTE =
  "학군/치안/생활편의 지수는 서울 25개 구에 한해 공개된 일반 순위·특성을 참고해 만든 0~100 상대 " +
  "지수(참고용)입니다. 그 외 지역은 아직 조사하지 못해 중립값(50)으로 대체되며 화면에 명시됩니다. " +
  "정확한 수치가 필요하면 학교알리미, 경찰청 범죄통계, 전국 병원/공원/대규모점포 표준데이터 API로 교체하세요.";

export const districts = [
  { name: "종로구", sido: "서울특별시", lawdCd: "11110", lat: 37.5735, lng: 126.9788, pricePerPyeong: 1475, schoolIndex: 55, safetyIndex: 62, amenityIndex: 78, hub: true, indexResearched: true },
  { name: "중구",   sido: "서울특별시", lawdCd: "11140", lat: 37.5641, lng: 126.9979, pricePerPyeong: 1683, schoolIndex: 45, safetyIndex: 58, amenityIndex: 80, hub: true, indexResearched: true },
  { name: "용산구", sido: "서울특별시", lawdCd: "11170", lat: 37.5326, lng: 126.9903, pricePerPyeong: 2463, schoolIndex: 60, safetyIndex: 66, amenityIndex: 82, hub: true, indexResearched: true },
  { name: "성동구", sido: "서울특별시", lawdCd: "11200", lat: 37.5633, lng: 127.0371, pricePerPyeong: 2329, schoolIndex: 58, safetyIndex: 64, amenityIndex: 76, hub: true, indexResearched: true },
  { name: "광진구", sido: "서울특별시", lawdCd: "11215", lat: 37.5385, lng: 127.0823, pricePerPyeong: 1899, schoolIndex: 57, safetyIndex: 60, amenityIndex: 74, hub: false, indexResearched: true },
  { name: "동대문구", sido: "서울특별시", lawdCd: "11230", lat: 37.5744, lng: 127.0396, pricePerPyeong: 1350, schoolIndex: 48, safetyIndex: 55, amenityIndex: 68, hub: false, indexResearched: true },
  { name: "중랑구", sido: "서울특별시", lawdCd: "11260", lat: 37.6063, lng: 127.0925, pricePerPyeong: 959, schoolIndex: 42, safetyIndex: 54, amenityIndex: 58, hub: false, indexResearched: true },
  { name: "성북구", sido: "서울특별시", lawdCd: "11290", lat: 37.5894, lng: 127.0167, pricePerPyeong: 1228, schoolIndex: 56, safetyIndex: 57, amenityIndex: 64, hub: false, indexResearched: true },
  { name: "강북구", sido: "서울특별시", lawdCd: "11305", lat: 37.6396, lng: 127.0257, pricePerPyeong: 969, schoolIndex: 40, safetyIndex: 52, amenityIndex: 55, hub: false, indexResearched: true },
  { name: "도봉구", sido: "서울특별시", lawdCd: "11320", lat: 37.6688, lng: 127.0471, pricePerPyeong: 882, schoolIndex: 46, safetyIndex: 61, amenityIndex: 54, hub: false, indexResearched: true },
  { name: "노원구", sido: "서울특별시", lawdCd: "11350", lat: 37.6542, lng: 127.0568, pricePerPyeong: 1062, schoolIndex: 72, safetyIndex: 63, amenityIndex: 66, hub: false, indexResearched: true },
  { name: "은평구", sido: "서울특별시", lawdCd: "11380", lat: 37.6027, lng: 126.9291, pricePerPyeong: 1172, schoolIndex: 47, safetyIndex: 58, amenityIndex: 60, hub: false, indexResearched: true },
  { name: "서대문구", sido: "서울특별시", lawdCd: "11410", lat: 37.5791, lng: 126.9368, pricePerPyeong: 1361, schoolIndex: 54, safetyIndex: 59, amenityIndex: 66, hub: false, indexResearched: true },
  { name: "마포구", sido: "서울특별시", lawdCd: "11440", lat: 37.5663, lng: 126.9019, pricePerPyeong: 1960, schoolIndex: 62, safetyIndex: 61, amenityIndex: 84, hub: true, indexResearched: true },
  { name: "양천구", sido: "서울특별시", lawdCd: "11470", lat: 37.5170, lng: 126.8664, pricePerPyeong: 1531, schoolIndex: 88, safetyIndex: 68, amenityIndex: 70, hub: false, indexResearched: true },
  { name: "강서구", sido: "서울특별시", lawdCd: "11500", lat: 37.5509, lng: 126.8495, pricePerPyeong: 1351, schoolIndex: 50, safetyIndex: 57, amenityIndex: 68, hub: false, indexResearched: true },
  { name: "구로구", sido: "서울특별시", lawdCd: "11530", lat: 37.4954, lng: 126.8874, pricePerPyeong: 1063, schoolIndex: 46, safetyIndex: 53, amenityIndex: 62, hub: false, indexResearched: true },
  { name: "금천구", sido: "서울특별시", lawdCd: "11545", lat: 37.4569, lng: 126.8956, pricePerPyeong: 923, schoolIndex: 41, safetyIndex: 52, amenityIndex: 56, hub: false, indexResearched: true },
  { name: "영등포구", sido: "서울특별시", lawdCd: "11560", lat: 37.5264, lng: 126.8962, pricePerPyeong: 1699, schoolIndex: 52, safetyIndex: 56, amenityIndex: 80, hub: true, indexResearched: true },
  { name: "동작구", sido: "서울특별시", lawdCd: "11590", lat: 37.5124, lng: 126.9393, pricePerPyeong: 1848, schoolIndex: 63, safetyIndex: 60, amenityIndex: 68, hub: false, indexResearched: true },
  { name: "관악구", sido: "서울특별시", lawdCd: "11620", lat: 37.4784, lng: 126.9516, pricePerPyeong: 1205, schoolIndex: 49, safetyIndex: 50, amenityIndex: 62, hub: false, indexResearched: true },
  { name: "서초구", sido: "서울특별시", lawdCd: "11650", lat: 37.4837, lng: 127.0324, pricePerPyeong: 2817, schoolIndex: 95, safetyIndex: 74, amenityIndex: 86, hub: true, indexResearched: true },
  { name: "강남구", sido: "서울특별시", lawdCd: "11680", lat: 37.5172, lng: 127.0473, pricePerPyeong: 3291, schoolIndex: 98, safetyIndex: 72, amenityIndex: 92, hub: true, indexResearched: true },
  { name: "송파구", sido: "서울특별시", lawdCd: "11710", lat: 37.5145, lng: 127.1059, pricePerPyeong: 2676, schoolIndex: 80, safetyIndex: 69, amenityIndex: 84, hub: true, indexResearched: true },
  { name: "강동구", sido: "서울특별시", lawdCd: "11740", lat: 37.5301, lng: 127.1238, pricePerPyeong: 1862, schoolIndex: 61, safetyIndex: 65, amenityIndex: 70, hub: false, indexResearched: true },
  { name: "춘천시", sido: "강원특별자치도", lawdCd: "42110", lat: 37.889863, lng: 127.740047, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "원주시", sido: "강원특별자치도", lawdCd: "42130", lat: 37.308281, lng: 127.929435, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "강릉시", sido: "강원특별자치도", lawdCd: "42150", lat: 37.709321, lng: 128.832351, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동해시", sido: "강원특별자치도", lawdCd: "42170", lat: 37.506873, lng: 129.055786, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "태백시", sido: "강원특별자치도", lawdCd: "42190", lat: 37.172412, lng: 128.980087, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "속초시", sido: "강원특별자치도", lawdCd: "42210", lat: 38.176089, lng: 128.519759, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "삼척시", sido: "강원특별자치도", lawdCd: "42230", lat: 37.277572, lng: 129.121979, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "홍천군", sido: "강원특별자치도", lawdCd: "42720", lat: 37.744816, lng: 128.074563, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "횡성군", sido: "강원특별자치도", lawdCd: "42730", lat: 37.508891, lng: 128.077167, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영월군", sido: "강원특별자치도", lawdCd: "42750", lat: 37.203851, lng: 128.500316, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "평창군", sido: "강원특별자치도", lawdCd: "42760", lat: 37.556848, lng: 128.482784, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "정선군", sido: "강원특별자치도", lawdCd: "42770", lat: 37.378768, lng: 128.739067, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "철원군", sido: "강원특별자치도", lawdCd: "42780", lat: 38.243509, lng: 127.413729, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "화천군", sido: "강원특별자치도", lawdCd: "42790", lat: 38.138433, lng: 127.685202, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "양구군", sido: "강원특별자치도", lawdCd: "42800", lat: 38.183986, lng: 127.999391, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "인제군", sido: "강원특별자치도", lawdCd: "42810", lat: 38.069131, lng: 128.263276, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고성군", sido: "강원특별자치도", lawdCd: "42820", lat: 38.377899, lng: 128.399525, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "양양군", sido: "강원특별자치도", lawdCd: "42830", lat: 38.004629, lng: 128.595311, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "수원시 장안구", sido: "경기도", lawdCd: "41111", lat: 37.313954, lng: 127.003423, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "수원시 권선구", sido: "경기도", lawdCd: "41113", lat: 37.260508, lng: 126.979782, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "수원시 팔달구", sido: "경기도", lawdCd: "41115", lat: 37.27745, lng: 127.016208, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "수원시 영통구", sido: "경기도", lawdCd: "41117", lat: 37.275094, lng: 127.056715, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "성남시 수정구", sido: "경기도", lawdCd: "41131", lat: 37.435297, lng: 127.10432, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "성남시 중원구", sido: "경기도", lawdCd: "41133", lat: 37.433431, lng: 127.16391, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "성남시 분당구", sido: "경기도", lawdCd: "41135", lat: 37.37934, lng: 127.106032, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "의정부시", sido: "경기도", lawdCd: "41150", lat: 37.73619, lng: 127.06843, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "안양시 만안구", sido: "경기도", lawdCd: "41171", lat: 37.404124, lng: 126.911391, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "안양시 동안구", sido: "경기도", lawdCd: "41173", lat: 37.400375, lng: 126.9555, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "부천시", sido: "경기도", lawdCd: "41190", lat: 37.504265, lng: 126.788713, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "광명시", sido: "경기도", lawdCd: "41210", lat: 37.445138, lng: 126.86469, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "평택시", sido: "경기도", lawdCd: "41220", lat: 37.012217, lng: 126.99112, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동두천시", sido: "경기도", lawdCd: "41250", lat: 37.91654, lng: 127.077917, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "안산시 상록구", sido: "경기도", lawdCd: "41271", lat: 37.315977, lng: 126.87078, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "안산시 단원구", sido: "경기도", lawdCd: "41273", lat: 37.278058, lng: 126.683741, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고양시 덕양구", sido: "경기도", lawdCd: "41281", lat: 37.655852, lng: 126.878676, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고양시 일산동구", sido: "경기도", lawdCd: "41285", lat: 37.679767, lng: 126.797353, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고양시 일산서구", sido: "경기도", lawdCd: "41287", lat: 37.68032, lng: 126.727853, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "과천시", sido: "경기도", lawdCd: "41290", lat: 37.433867, lng: 127.00278, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "구리시", sido: "경기도", lawdCd: "41310", lat: 37.598986, lng: 127.131549, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남양주시", sido: "경기도", lawdCd: "41360", lat: 37.662591, lng: 127.243661, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "오산시", sido: "경기도", lawdCd: "41370", lat: 37.163307, lng: 127.051329, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "시흥시", sido: "경기도", lawdCd: "41390", lat: 37.386711, lng: 126.784345, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "군포시", sido: "경기도", lawdCd: "41410", lat: 37.343429, lng: 126.921019, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "의왕시", sido: "경기도", lawdCd: "41430", lat: 37.362478, lng: 126.989709, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "하남시", sido: "경기도", lawdCd: "41450", lat: 37.522804, lng: 127.206047, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "용인시 처인구", sido: "경기도", lawdCd: "41461", lat: 37.203384, lng: 127.252886, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "용인시 기흥구", sido: "경기도", lawdCd: "41463", lat: 37.267443, lng: 127.121343, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "용인시 수지구", sido: "경기도", lawdCd: "41465", lat: 37.333455, lng: 127.071563, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "파주시", sido: "경기도", lawdCd: "41480", lat: 37.855573, lng: 126.809507, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "이천시", sido: "경기도", lawdCd: "41500", lat: 37.209814, lng: 127.480941, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "안성시", sido: "경기도", lawdCd: "41550", lat: 37.035029, lng: 127.302794, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "김포시", sido: "경기도", lawdCd: "41570", lat: 37.679681, lng: 126.626839, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "화성시", sido: "경기도", lawdCd: "41590", lat: 37.168739, lng: 126.854025, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "광주시", sido: "경기도", lawdCd: "41610", lat: 37.403108, lng: 127.301154, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "양주시", sido: "경기도", lawdCd: "41630", lat: 37.8087, lng: 127.001161, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "포천시", sido: "경기도", lawdCd: "41650", lat: 37.969895, lng: 127.250427, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "여주시", sido: "경기도", lawdCd: "41670", lat: 37.302499, lng: 127.615697, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "연천군", sido: "경기도", lawdCd: "41800", lat: 38.097095, lng: 127.023913, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "가평군", sido: "경기도", lawdCd: "41820", lat: 37.818611, lng: 127.450236, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "양평군", sido: "경기도", lawdCd: "41830", lat: 37.518038, lng: 127.579152, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "창원시 의창구", sido: "경상남도", lawdCd: "48121", lat: 35.311891, lng: 128.648934, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "창원시 성산구", sido: "경상남도", lawdCd: "48123", lat: 35.198765, lng: 128.671613, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "창원시 마산합포구", sido: "경상남도", lawdCd: "48125", lat: 35.135672, lng: 128.48591, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "창원시 마산회원구", sido: "경상남도", lawdCd: "48127", lat: 35.232198, lng: 128.5366, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "창원시 진해구", sido: "경상남도", lawdCd: "48129", lat: 35.128193, lng: 128.737117, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "진주시", sido: "경상남도", lawdCd: "48170", lat: 35.205149, lng: 128.129742, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "통영시", sido: "경상남도", lawdCd: "48220", lat: 34.82668, lng: 128.37427, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "사천시", sido: "경상남도", lawdCd: "48240", lat: 35.049583, lng: 128.037723, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "김해시", sido: "경상남도", lawdCd: "48250", lat: 35.272156, lng: 128.845219, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "밀양시", sido: "경상남도", lawdCd: "48270", lat: 35.498337, lng: 128.789754, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "거제시", sido: "경상남도", lawdCd: "48310", lat: 34.870445, lng: 128.623429, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "양산시", sido: "경상남도", lawdCd: "48330", lat: 35.401913, lng: 129.041016, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "의령군", sido: "경상남도", lawdCd: "48720", lat: 35.392473, lng: 128.277098, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "함안군", sido: "경상남도", lawdCd: "48730", lat: 35.290972, lng: 128.430874, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "창녕군", sido: "경상남도", lawdCd: "48740", lat: 35.508855, lng: 128.492841, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고성군", sido: "경상남도", lawdCd: "48820", lat: 35.016055, lng: 128.29045, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남해군", sido: "경상남도", lawdCd: "48840", lat: 34.818052, lng: 127.941399, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "하동군", sido: "경상남도", lawdCd: "48850", lat: 35.137365, lng: 127.7791, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "산청군", sido: "경상남도", lawdCd: "48860", lat: 35.368649, lng: 127.884362, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "함양군", sido: "경상남도", lawdCd: "48870", lat: 35.551773, lng: 127.722106, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "거창군", sido: "경상남도", lawdCd: "48880", lat: 35.732634, lng: 127.904128, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "합천군", sido: "경상남도", lawdCd: "48890", lat: 35.576736, lng: 128.141724, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "포항시 남구", sido: "경상북도", lawdCd: "47111", lat: 35.958394, lng: 129.437854, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "포항시 북구", sido: "경상북도", lawdCd: "47113", lat: 36.165016, lng: 129.234491, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "경주시", sido: "경상북도", lawdCd: "47130", lat: 35.826591, lng: 129.236451, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "김천시", sido: "경상북도", lawdCd: "47150", lat: 36.060524, lng: 128.077863, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "안동시", sido: "경상북도", lawdCd: "47170", lat: 36.580293, lng: 128.779996, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "구미시", sido: "경상북도", lawdCd: "47190", lat: 36.207343, lng: 128.355472, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영주시", sido: "경상북도", lawdCd: "47210", lat: 36.870518, lng: 128.597647, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영천시", sido: "경상북도", lawdCd: "47230", lat: 36.015719, lng: 128.942755, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "상주시", sido: "경상북도", lawdCd: "47250", lat: 36.429637, lng: 128.066929, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "문경시", sido: "경상북도", lawdCd: "47280", lat: 36.691037, lng: 128.149062, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "경산시", sido: "경상북도", lawdCd: "47290", lat: 35.833844, lng: 128.808896, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "의성군", sido: "경상북도", lawdCd: "47730", lat: 36.362015, lng: 128.614917, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청송군", sido: "경상북도", lawdCd: "47750", lat: 36.357075, lng: 129.057437, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영양군", sido: "경상북도", lawdCd: "47760", lat: 36.69652, lng: 129.14505, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영덕군", sido: "경상북도", lawdCd: "47770", lat: 36.482512, lng: 129.317582, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청도군", sido: "경상북도", lawdCd: "47820", lat: 35.672897, lng: 128.787254, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고령군", sido: "경상북도", lawdCd: "47830", lat: 35.737887, lng: 128.306142, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "성주군", sido: "경상북도", lawdCd: "47840", lat: 35.90704, lng: 128.234247, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "칠곡군", sido: "경상북도", lawdCd: "47850", lat: 36.015567, lng: 128.462657, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "예천군", sido: "경상북도", lawdCd: "47900", lat: 36.654081, lng: 128.422524, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "봉화군", sido: "경상북도", lawdCd: "47920", lat: 36.934208, lng: 128.912934, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "울진군", sido: "경상북도", lawdCd: "47930", lat: 36.904069, lng: 129.312418, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "울릉군", sido: "경상북도", lawdCd: "47940", lat: 37.501916, lng: 130.863114, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동구", sido: "광주광역시", lawdCd: "29110", lat: 35.117398, lng: 126.949432, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서구", sido: "광주광역시", lawdCd: "29140", lat: 35.135674, lng: 126.850724, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남구", sido: "광주광역시", lawdCd: "29155", lat: 35.094071, lng: 126.856783, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "북구", sido: "광주광역시", lawdCd: "29170", lat: 35.193248, lng: 126.925447, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "광산구", sido: "광주광역시", lawdCd: "29200", lat: 35.165019, lng: 126.75291, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "중구", sido: "대구광역시", lawdCd: "27110", lat: 35.866443, lng: 128.593483, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동구", sido: "대구광역시", lawdCd: "27140", lat: 35.934528, lng: 128.685494, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서구", sido: "대구광역시", lawdCd: "27170", lat: 35.874939, lng: 128.549714, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남구", sido: "대구광역시", lawdCd: "27200", lat: 35.835145, lng: 128.585397, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "북구", sido: "대구광역시", lawdCd: "27230", lat: 35.928536, lng: 128.577355, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "수성구", sido: "대구광역시", lawdCd: "27260", lat: 35.834007, lng: 128.661263, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "달서구", sido: "대구광역시", lawdCd: "27290", lat: 35.827569, lng: 128.529449, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "달성군", sido: "대구광역시", lawdCd: "27710", lat: 35.759021, lng: 128.498933, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "군위군", sido: "대구광역시", lawdCd: "27720", lat: 36.17014, lng: 128.648138, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동구", sido: "대전광역시", lawdCd: "30110", lat: 36.324013, lng: 127.475125, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "중구", sido: "대전광역시", lawdCd: "30140", lat: 36.280889, lng: 127.411048, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서구", sido: "대전광역시", lawdCd: "30170", lat: 36.280283, lng: 127.345125, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "유성구", sido: "대전광역시", lawdCd: "30200", lat: 36.376918, lng: 127.33335, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "대덕구", sido: "대전광역시", lawdCd: "30230", lat: 36.412266, lng: 127.440132, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "중구", sido: "부산광역시", lawdCd: "26110", lat: 35.105438, lng: 129.032283, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서구", sido: "부산광역시", lawdCd: "26140", lat: 35.102852, lng: 129.014941, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동구", sido: "부산광역시", lawdCd: "26170", lat: 35.128279, lng: 129.044863, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영도구", sido: "부산광역시", lawdCd: "26200", lat: 35.078832, lng: 129.064853, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "부산진구", sido: "부산광역시", lawdCd: "26230", lat: 35.165251, lng: 129.043061, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동래구", sido: "부산광역시", lawdCd: "26260", lat: 35.206205, lng: 129.07926, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남구", sido: "부산광역시", lawdCd: "26290", lat: 35.125355, lng: 129.094375, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "북구", sido: "부산광역시", lawdCd: "26320", lat: 35.229296, lng: 129.023478, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "해운대구", sido: "부산광역시", lawdCd: "26350", lat: 35.193734, lng: 129.153674, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "사하구", sido: "부산광역시", lawdCd: "26380", lat: 35.088489, lng: 128.973813, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "금정구", sido: "부산광역시", lawdCd: "26410", lat: 35.258909, lng: 129.091563, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "강서구", sido: "부산광역시", lawdCd: "26440", lat: 35.137179, lng: 128.891075, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "연제구", sido: "부산광역시", lawdCd: "26470", lat: 35.182384, lng: 129.082964, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "수영구", sido: "부산광역시", lawdCd: "26500", lat: 35.161207, lng: 129.11156, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "사상구", sido: "부산광역시", lawdCd: "26530", lat: 35.158031, lng: 128.986596, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "기장군", sido: "부산광역시", lawdCd: "26710", lat: 35.297968, lng: 129.201016, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "세종특별자치시", sido: "세종특별자치시", lawdCd: "36110", lat: 36.560733, lng: 127.258667, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "중구", sido: "울산광역시", lawdCd: "31110", lat: 35.571065, lng: 129.308232, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남구", sido: "울산광역시", lawdCd: "31140", lat: 35.514502, lng: 129.329316, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동구", sido: "울산광역시", lawdCd: "31170", lat: 35.525428, lng: 129.426241, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "북구", sido: "울산광역시", lawdCd: "31200", lat: 35.610226, lng: 129.380014, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "울주군", sido: "울산광역시", lawdCd: "31710", lat: 35.546046, lng: 129.187741, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "중구", sido: "인천광역시", lawdCd: "28110", lat: 37.470913, lng: 126.486013, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "동구", sido: "인천광역시", lawdCd: "28140", lat: 37.483385, lng: 126.638726, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "미추홀구", sido: "인천광역시", lawdCd: "28177", lat: 37.452571, lng: 126.664557, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "연수구", sido: "인천광역시", lawdCd: "28185", lat: 37.392162, lng: 126.649773, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남동구", sido: "인천광역시", lawdCd: "28200", lat: 37.431103, lng: 126.726407, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "부평구", sido: "인천광역시", lawdCd: "28237", lat: 37.496698, lng: 126.72124, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "계양구", sido: "인천광역시", lawdCd: "28245", lat: 37.557288, lng: 126.734734, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서구", sido: "인천광역시", lawdCd: "28260", lat: 37.559677, lng: 126.65185, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "강화군", sido: "인천광역시", lawdCd: "28710", lat: 37.712536, lng: 126.402318, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "옹진군", sido: "인천광역시", lawdCd: "28720", lat: 37.524224, lng: 125.666222, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "목포시", sido: "전라남도", lawdCd: "46110", lat: 34.802762, lng: 126.39101, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "여수시", sido: "전라남도", lawdCd: "46130", lat: 34.699173, lng: 127.652466, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "순천시", sido: "전라남도", lawdCd: "46150", lat: 34.994645, lng: 127.389367, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "나주시", sido: "전라남도", lawdCd: "46170", lat: 34.988421, lng: 126.72015, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "광양시", sido: "전라남도", lawdCd: "46230", lat: 35.018787, lng: 127.65601, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "담양군", sido: "전라남도", lawdCd: "46710", lat: 35.29136, lng: 126.995237, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "곡성군", sido: "전라남도", lawdCd: "46720", lat: 35.216648, lng: 127.263523, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "구례군", sido: "전라남도", lawdCd: "46730", lat: 35.236767, lng: 127.503093, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고흥군", sido: "전라남도", lawdCd: "46770", lat: 34.598434, lng: 127.314913, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "보성군", sido: "전라남도", lawdCd: "46780", lat: 34.81436, lng: 127.162363, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "화순군", sido: "전라남도", lawdCd: "46790", lat: 35.008262, lng: 127.033498, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "장흥군", sido: "전라남도", lawdCd: "46800", lat: 34.675441, lng: 126.921944, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "강진군", sido: "전라남도", lawdCd: "46810", lat: 34.620397, lng: 126.772163, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "해남군", sido: "전라남도", lawdCd: "46820", lat: 34.558468, lng: 126.511527, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영암군", sido: "전라남도", lawdCd: "46830", lat: 34.79493, lng: 126.621374, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "무안군", sido: "전라남도", lawdCd: "46840", lat: 34.953877, lng: 126.425056, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "함평군", sido: "전라남도", lawdCd: "46860", lat: 35.11271, lng: 126.535489, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영광군", sido: "전라남도", lawdCd: "46870", lat: 35.2786, lng: 126.451375, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "장성군", sido: "전라남도", lawdCd: "46880", lat: 35.329592, lng: 126.768673, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "완도군", sido: "전라남도", lawdCd: "46890", lat: 34.29484, lng: 126.777368, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "진도군", sido: "전라남도", lawdCd: "46900", lat: 34.438517, lng: 126.213669, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "신안군", sido: "전라남도", lawdCd: "46910", lat: 34.810812, lng: 126.044884, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "전주시 완산구", sido: "전북특별자치도", lawdCd: "45111", lat: 35.791265, lng: 127.120767, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "전주시 덕진구", sido: "전북특별자치도", lawdCd: "45113", lat: 35.858166, lng: 127.11208, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "군산시", sido: "전북특별자치도", lawdCd: "45130", lat: 35.950532, lng: 126.72548, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "익산시", sido: "전북특별자치도", lawdCd: "45140", lat: 36.023099, lng: 126.989499, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "정읍시", sido: "전북특별자치도", lawdCd: "45180", lat: 35.60269, lng: 126.905892, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "남원시", sido: "전북특별자치도", lawdCd: "45190", lat: 35.422534, lng: 127.442011, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "김제시", sido: "전북특별자치도", lawdCd: "45210", lat: 35.806698, lng: 126.894747, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "완주군", sido: "전북특별자치도", lawdCd: "45710", lat: 35.918743, lng: 127.215133, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "진안군", sido: "전북특별자치도", lawdCd: "45720", lat: 35.828881, lng: 127.430077, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "무주군", sido: "전북특별자치도", lawdCd: "45730", lat: 35.939386, lng: 127.712957, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "장수군", sido: "전북특별자치도", lawdCd: "45740", lat: 35.657537, lng: 127.544338, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "임실군", sido: "전북특별자치도", lawdCd: "45750", lat: 35.59826, lng: 127.23664, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "순창군", sido: "전북특별자치도", lawdCd: "45770", lat: 35.433612, lng: 127.089919, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "고창군", sido: "전북특별자치도", lawdCd: "45790", lat: 35.448866, lng: 126.616126, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "부안군", sido: "전북특별자치도", lawdCd: "45800", lat: 35.678536, lng: 126.643748, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "제주시", sido: "제주특별자치도", lawdCd: "50110", lat: 33.442698, lng: 126.52928, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서귀포시", sido: "제주특별자치도", lawdCd: "50130", lat: 33.324914, lng: 126.581832, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "천안시 동남구", sido: "충청남도", lawdCd: "44131", lat: 36.764487, lng: 127.220059, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "천안시 서북구", sido: "충청남도", lawdCd: "44133", lat: 36.894792, lng: 127.162696, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "공주시", sido: "충청남도", lawdCd: "44150", lat: 36.479853, lng: 127.075105, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "보령시", sido: "충청남도", lawdCd: "44180", lat: 36.340976, lng: 126.593145, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "아산시", sido: "충청남도", lawdCd: "44200", lat: 36.807411, lng: 126.980111, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서산시", sido: "충청남도", lawdCd: "44210", lat: 36.784395, lng: 126.463328, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "논산시", sido: "충청남도", lawdCd: "44230", lat: 36.190891, lng: 127.157684, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "계룡시", sido: "충청남도", lawdCd: "44250", lat: 36.291623, lng: 127.234445, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "당진시", sido: "충청남도", lawdCd: "44270", lat: 36.904214, lng: 126.652465, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "금산군", sido: "충청남도", lawdCd: "44710", lat: 36.119035, lng: 127.47829, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "부여군", sido: "충청남도", lawdCd: "44760", lat: 36.246389, lng: 126.856882, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "서천군", sido: "충청남도", lawdCd: "44770", lat: 36.107263, lng: 126.704138, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청양군", sido: "충청남도", lawdCd: "44790", lat: 36.430595, lng: 126.853015, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "홍성군", sido: "충청남도", lawdCd: "44800", lat: 36.569853, lng: 126.625292, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "예산군", sido: "충청남도", lawdCd: "44810", lat: 36.670642, lng: 126.784274, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "태안군", sido: "충청남도", lawdCd: "44825", lat: 36.709178, lng: 126.279774, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청주시 상당구", sido: "충청북도", lawdCd: "43111", lat: 36.592143, lng: 127.584957, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청주시 서원구", sido: "충청북도", lawdCd: "43112", lat: 36.547593, lng: 127.438553, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청주시 흥덕구", sido: "충청북도", lawdCd: "43113", lat: 36.6469, lng: 127.369232, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "청주시 청원구", sido: "충청북도", lawdCd: "43114", lat: 36.720571, lng: 127.491331, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "충주시", sido: "충청북도", lawdCd: "43130", lat: 37.015107, lng: 127.895694, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "제천시", sido: "충청북도", lawdCd: "43150", lat: 37.060827, lng: 128.140782, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "보은군", sido: "충청북도", lawdCd: "43720", lat: 36.489886, lng: 127.72924, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "옥천군", sido: "충청북도", lawdCd: "43730", lat: 36.320409, lng: 127.656686, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "영동군", sido: "충청북도", lawdCd: "43740", lat: 36.159686, lng: 127.814265, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "증평군", sido: "충청북도", lawdCd: "43745", lat: 36.786492, lng: 127.604621, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "진천군", sido: "충청북도", lawdCd: "43750", lat: 36.871009, lng: 127.440443, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "괴산군", sido: "충청북도", lawdCd: "43760", lat: 36.769672, lng: 127.829689, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "음성군", sido: "충청북도", lawdCd: "43770", lat: 36.976243, lng: 127.614188, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
  { name: "단양군", sido: "충청북도", lawdCd: "43800", lat: 36.994575, lng: 128.387892, pricePerPyeong: null, schoolIndex: null, safetyIndex: null, amenityIndex: null, hub: false, indexResearched: false },
];

/**
 * 전국 250개 시군구를 시/도별로 묶어서 반환 (지역 선택 드롭다운의 optgroup용).
 * 시/도 등장 순서는 원본 배열 순서를 그대로 따릅니다(서울이 항상 맨 위).
 */
export function groupDistrictsBySido(list = districts) {
  const order = [];
  const map = new Map();
  for (const d of list) {
    if (!map.has(d.sido)) {
      map.set(d.sido, []);
      order.push(d.sido);
    }
    map.get(d.sido).push(d);
  }
  return order.map((sido) => ({ sido, items: map.get(sido) }));
}

/**
 * lawdCd(법정동코드 앞 5자리)로 지역을 찾습니다. 이름은 "중구"처럼 여러 시/도에 중복될 수
 * 있어(부산 중구, 대구 중구, 인천 중구 등) lawdCd가 지역을 유일하게 식별하는 기준입니다.
 */
export function findDistrictByCode(lawdCd) {
  return districts.find((d) => d.lawdCd === lawdCd);
}

/**
 * 이름으로 지역을 찾습니다. 서울 25개 구는 이름이 유일해 그대로 쓸 수 있지만, 전국 단위에서는
 * 같은 이름이 여러 곳 있을 수 있어(예: "중구") 첫 번째로 일치하는 지역을 반환합니다. 새 코드는
 * 가능하면 findDistrictByCode(lawdCd)를 사용하세요. 하위 호환을 위해 유지합니다.
 */
export function findDistrict(name) {
  return districts.find((d) => d.name === name);
}

// 정식 시/도 이름("경기도", "서울특별시")을 화면에 짧게 표시할 때 쓰는 축약형("경기", "서울")
// 매핑입니다. 원래 lib/applyhome.js(청약홈 API의 SUBSCRPT_AREA_CODE_NM이 이 축약형으로 오는
// 것에 맞추려고)에만 있었는데, 추천 결과 목록에서 "구별로 나오는 매물 후보 타이틀"에도 같은
// 축약형이 필요해져(예: "경기도 평택시" -> "경기 평택시" — 화면이 좁아서 축약형이 더 잘
// 읽힘, README 26번 참고) 여기 공용 위치로 옮기고 applyhome.js는 이걸 재사용(재수출)하도록
// 바꿨습니다.
export const SIDO_SHORT_NAME = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

/**
 * 정식 시/도 이름을 축약형으로 바꿉니다. 매핑에 없는 값(알 수 없는 시/도 등)은 원래 값을
 * 그대로 돌려줍니다(화면이 깨지지 않도록 안전하게 폴백).
 */
export function sidoShort(sidoFullName) {
  return SIDO_SHORT_NAME[sidoFullName] || sidoFullName;
}
