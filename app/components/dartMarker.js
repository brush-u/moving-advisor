// "매물이 지도에 다트처럼 꽂히는" 연출을 위한 마커 HTML/타이밍 상수.
// 사운드는 Web Audio API로 직접 합성하므로 외부 음원 파일이 필요 없습니다.

export const DART_STAGGER_MS = 130; // 매물이 순서대로 하나씩 "파팍" 꽂히는 간격
export const DART_FLIGHT_MS = 480; // 다트 한 개가 날아가 꽂히기까지 걸리는 시간

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

export function buildPlainMarkerHtml({ color, size, approximate }) {
  const border = approximate ? "2px dashed rgba(255,255,255,0.9)" : "2px solid white";
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:0 0 0 1px rgba(11,11,11,0.35);"></div>`;
}
