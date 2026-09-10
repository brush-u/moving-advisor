"use client";

import { useState } from "react";

/**
 * 네이버부동산류 필터 UI처럼 최소/최대 손잡이 두 개로 범위를 고르는 슬라이더.
 * 실제로는 <input type="range"> 두 개를 같은 트랙 위에 겹쳐 그리는 흔한 방식입니다 — 각
 * input은 손잡이(thumb)에만 클릭/드래그가 되도록 CSS에서 pointer-events를 손잡이에만
 * 허용하고 트랙 자체는 투명하게 비활성화해서, 두 손잡이를 서로 방해 없이 각각 움직일 수
 * 있습니다(트랙을 직접 클릭해서 점프하는 동작은 지원하지 않고, 반드시 손잡이를 잡고
 * 움직여야 합니다 — 참고한 디자인과 동일한 인터랙션입니다).
 *
 * floor/ceil 손잡이 위치는 "범위 지정 없음"(전체)을 의미하는 값으로 취급되도록 호출부에서
 * 해석합니다(이 컴포넌트 자체는 그냥 두 개의 숫자를 주고받을 뿐입니다).
 */
export default function RangeSlider({ floor, ceil, step = 1, minValue, maxValue, onChange, ticks = [], ariaLabel }) {
  const [active, setActive] = useState(null); // 'min' | 'max' | null — 마지막으로 잡은 손잡이를 위로 올림

  function pct(v) {
    if (ceil === floor) return 0;
    return ((v - floor) / (ceil - floor)) * 100;
  }

  function handleMinChange(e) {
    const next = Math.min(Number(e.target.value), maxValue);
    onChange(next, maxValue);
  }

  function handleMaxChange(e) {
    const next = Math.max(Number(e.target.value), minValue);
    onChange(minValue, next);
  }

  return (
    <div className="range-slider" role="group" aria-label={ariaLabel}>
      <div className="range-slider-track-wrap">
        <div className="range-slider-track">
          <div
            className="range-slider-fill"
            style={{ left: `${pct(minValue)}%`, right: `${100 - pct(maxValue)}%` }}
          />
        </div>
        <input
          type="range"
          className="range-slider-input"
          style={{ zIndex: active === "min" ? 5 : 3 }}
          min={floor}
          max={ceil}
          step={step}
          value={minValue}
          onPointerDown={() => setActive("min")}
          onChange={handleMinChange}
          aria-label={`${ariaLabel} 최소`}
        />
        <input
          type="range"
          className="range-slider-input"
          style={{ zIndex: active === "max" ? 5 : 4 }}
          min={floor}
          max={ceil}
          step={step}
          value={maxValue}
          onPointerDown={() => setActive("max")}
          onChange={handleMaxChange}
          aria-label={`${ariaLabel} 최대`}
        />
      </div>
      {ticks.length > 0 && (
        <div className="range-slider-ticks">
          {ticks.map((t) => (
            <span key={t.value}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
