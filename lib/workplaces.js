/**
 * 통근시간 추정을 위한 기준점(주요 업무지구) 목록.
 * 실제 지오코딩 API(Kakao/Naver 등) 키가 없어도 바로 동작하도록
 * 자주 쓰이는 업무 밀집지역 좌표를 미리 등록해 두었습니다.
 * "직접 좌표 입력"을 고르면 사용자가 위도/경도를 직접 넣어 임의 지점 기준으로 계산할 수 있습니다.
 */
export const workplaces = [
  { id: "gangnam", name: "강남역 일대", lat: 37.4979, lng: 127.0276 },
  { id: "yeoksam", name: "테헤란로(역삼·삼성)", lat: 37.5006, lng: 127.0364 },
  { id: "gwanghwamun", name: "광화문·시청", lat: 37.5710, lng: 126.9769 },
  { id: "yeouido", name: "여의도", lat: 37.5219, lng: 126.9245 },
  { id: "pangyo", name: "판교테크노밸리", lat: 37.4020, lng: 127.1086 },
  { id: "guro", name: "구로·가산디지털단지", lat: 37.4850, lng: 126.9012 },
  { id: "sangam", name: "상암 DMC", lat: 37.5794, lng: 126.8896 },
  { id: "jamsil", name: "잠실", lat: 37.5133, lng: 127.1000 },
  { id: "magok", name: "마곡지구", lat: 37.5605, lng: 126.8258 },
  { id: "custom", name: "직접 좌표 입력", lat: null, lng: null },
];

export function findWorkplace(id) {
  return workplaces.find((w) => w.id === id);
}
