// "매물이 지도에 다트처럼 꽂히는" 연출을 위한 마커 HTML/타이밍 상수.
// 사운드는 Web Audio API로 직접 합성하므로 외부 음원 파일이 필요 없습니다.

// 예전엔 매물이 하나씩 순서대로 "파팍" 꽂히도록 DART_STAGGER_MS(간격)를 뒀는데, 사용자가
// "지도에 매물 마커가 찍히는 게 너무 느리다, 굳이 텀을 둘 필요 없다"고 요청해서 없앴습니다
// — 이제 같은 배치(같은 지역)의 매물은 전부 동시에 날아와 꽂힙니다. 남은 지연 요소는
// 지역과 지역 사이의 실제 지오코딩(Nominatim) 대기시간뿐인데, 그건 무료 API의 초당 1건
// 제한 때문에 꼭 필요한 시간이라 애니메이션과는 별개입니다(lib/geocode.js 참고).
export const DART_STAGGER_MS = 0;
export const DART_FLIGHT_MS = 260; // 다트 한 개가 날아가 꽂히기까지 걸리는 시간(체감 속도를 위해 480ms에서 단축)

export function buildDartMarkerHtml({ color, approximate, selected, animate, delayMs = 0 }) {
  const outerClass = animate ? "dart-outer dart-outer-animate" : "dart-outer";
  const ringStyle = animate
    ? `animation-delay:${delayMs + DART_FLIGHT_MS - 60}ms;`
    : "display:none;";
  const border = approximate ? "3,2" : "0";
  return `
    <span class="${outerClass}" style="animation-delay:${delayMs}ms;">
      <span class="dart-ring" style="${ringStyle} background:${color};"></span>
      <span class="dart-pin${selected ? " is-selected" : ""}${approximate ? " is-approx" : ""}">
        <svg width="26" height="34" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.6-12-12-12z"
                fill="${color}" stroke="white" stroke-width="1.5" stroke-dasharray="${border}"/>
          <circle cx="12" cy="12" r="4.5" fill="white"/>
        </svg>
      </span>
    </span>
  `;
}

export function buildPlainMarkerHtml({ color, size, approximate, glyph }) {
  const border = approximate ? "2px dashed rgba(255,255,255,0.9)" : "2px solid white";
  // glyph(이모지 한 글자)를 주면 원 안에 작게 겹쳐 그립니다 — 지도에 지하철역/대형마트/
  // 백화점/병원/약국처럼 여러 카테고리를 함께 표시할 때 색만으로는 구분이 어려워서입니다.
  const glyphHtml = glyph
    ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${Math.max(
        8,
        Math.round(size * 0.62)
      )}px;line-height:1;">${glyph}</span>`
    : "";
  return `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:0 0 0 1px rgba(11,11,11,0.35);">${glyphHtml}</div>`;
}
