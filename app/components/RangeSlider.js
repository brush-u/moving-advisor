"use client";

import { useRef, useState } from "react";

/**
 * 네이버부동산류 필터 UI처럼 최소/최대 손잡이 두 개로 범위를 고르는 슬라이더.
 * 실제로는 <input type="range"> 두 개를 같은 트랙 위에 겹쳐 그리는 흔한 방식입니다 — 각
 * input은 손잡이(thumb)에만 클릭/드래그가 되도록 CSS에서 pointer-events를 손잡이에만
 * 허용하고 트랙 자체는 투명하게 비활성화해서, 두 손잡이를 서로 방해 없이 각각 움직일 수
 * 있습니다.
 *
 * 트랙을 직접 클릭하면 점프도 되도록 handleTrackClick을 추가했습니다(사용자 요청 — 드래그는
 * 그대로 유지). input 자체(손잡이)를 클릭한 경우는 네이티브 드래그/클릭 동작에 그대로
 * 맡기고(onClick에서 target이 INPUT이면 무시), 트랙의 빈 부분을 클릭했을 때만 클릭 위치에
 * 가장 가까운 손잡이를 그 위치로 이동시킵니다.
 *
 * floor/ceil 손잡이 위치는 "범위 지정 없음"(전체)을 의미하는 값으로 취급되도록 호출부에서
 * 해석합니다(이 컴포넌트 자체는 그냥 두 개의 숫자를 주고받을 뿐입니다).
 */
export default function RangeSlider({ floor, ceil, step = 1, minValue, maxValue, onChange, ticks = [], ariaLabel }) {
  const [active, setActive] = useState(null); // 'min' | 'max' | null — 마지막으로 잡은 손잡이를 위로 올림
  const trackWrapRef = useRef(null);

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

  function handleTrackClick(e) {
    // 손잡이(input) 자체를 클릭/드래그한 경우엔 네이티브 range input 동작에 그대로 맡깁니다 —
    // 여기서 또 값을 계산해서 덮어쓰면 드래그 중 손잡이가 튀는 문제가 생길 수 있습니다.
    if (e.target.tagName === "INPUT") return;
    if (!trackWrapRef.current || ceil === floor) return;

    const rect = trackWrapRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const rawValue = floor + ratio * (ceil - floor);
    const snapped = Math.round(rawValue / step) * step;
    const clamped = Math.min(ceil, Math.max(floor, snapped));

    // 클릭한 위치에서 더 가까운 손잡이를 그 위치로 옮깁니다.
    const distToMin = Math.abs(clamped - minValue);
    const distToMax = Math.abs(clamped - maxValue);
    if (distToMin <= distToMax) {
      setActive("min");
      onChange(Math.min(clamped, maxValue), maxValue);
    } else {
      setActive("max");
      onChange(minValue, Math.max(clamped, minValue));
    }
  }

  return (
    <div className="range-slider" role="group" aria-label={ariaLabel}>
      <div className="range-slider-track-wrap" ref={trackWrapRef} onClick={handleTrackClick}>
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
