/**
 * 방(룸) 개수 / 화장실 개수는 국토교통부 실거래가 공공데이터에 존재하지 않습니다
 * (전용면적만 제공됩니다). 그래서 국내 아파트에서 널리 쓰이는 "전용면적 ~ 평면 구성"
 * 관례를 바탕으로 한 추정치를 제공합니다. 실제 평면은 단지·연식마다 다를 수 있으므로
 * 화면에는 항상 "추정"이라고 표시합니다.
 *
 * roomsMax / bathMax는 필터링에 쓰는 값으로, "이 면적이면 최대 이 정도까지는 나올 수 있다"는
 * 보수적인 상한입니다. 사용자가 "3룸 이상"을 원하면 roomsMax가 3 이상인 매물만 후보로 남깁니다.
 */
export function estimateLayout(areaM2) {
  if (!areaM2 || areaM2 <= 0) {
    return { roomsMin: null, roomsMax: null, bathMin: null, bathMax: null, label: "정보 없음" };
  }
  if (areaM2 < 45) {
    return { roomsMin: 1, roomsMax: 2, bathMin: 1, bathMax: 1, label: "1~2룸 · 욕실 1개(추정)" };
  }
  if (areaM2 < 60) {
    return { roomsMin: 2, roomsMax: 3, bathMin: 1, bathMax: 1, label: "2~3룸 · 욕실 1개(추정)" };
  }
  if (areaM2 < 85) {
    return { roomsMin: 3, roomsMax: 3, bathMin: 2, bathMax: 2, label: "3룸 · 욕실 2개(추정)" };
  }
  if (areaM2 < 115) {
    return { roomsMin: 3, roomsMax: 4, bathMin: 2, bathMax: 2, label: "3~4룸 · 욕실 2개(추정)" };
  }
  return { roomsMin: 4, roomsMax: 5, bathMin: 2, bathMax: 3, label: "4룸 이상 · 욕실 2~3개(추정)" };
}

export function m2ToPyeong(areaM2) {
  return Math.round((areaM2 / 3.3058) * 10) / 10;
}

export function pyeongToM2(pyeong) {
  return pyeong * 3.3058;
}
