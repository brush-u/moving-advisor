"use client";

import { useState } from "react";

// dataviz 스킬 규격: 2px 선(round cap), 8px 이상 끝점 마커(2px 서페이스 링), 헤어라인
// 실선 그리드, 계열 2개 이상이면 항상 범례, 값 색은 마크에만(텍스트는 항상 text 토큰),
// 듀얼축 금지 — 그래서 이 컴포넌트는 "건수" 차트와 "평균 거래금액" 차트를 각각 따로
// 렌더링하는 용도의 단일축 라인차트 하나만 그립니다(호출부에서 두 번 씀).
const CHART_W = 640;
const CHART_H = 220;
const PAD = { top: 16, right: 16, bottom: 26, left: 46 };

function niceMax(max) {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const residual = max / magnitude;
  let niceResidual;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
}

function formatMonthLabel(ym) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
}

function formatTick(v) {
  if (!Number.isFinite(v)) return "0";
  const rounded = Math.round(v * 100) / 100;
  return rounded.toLocaleString();
}

/**
 * months: ["202603", ...] (과거→현재, 모든 series가 같은 개수/순서를 공유)
 * series: [{ key, label, color, points: [number|null, ...] }]  // points.length === months.length
 * valueFormatter: (value) => string — 툴팁/값 표시용 포맷터(단위는 unit prop으로 따로 붙임)
 */
export default function MarketTrendChart({ title, unit, months, series, valueFormatter }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const n = months.length;
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.points.filter((v) => v != null));
  const maxVal = niceMax(Math.max(1, ...(allValues.length ? allValues : [1])));

  const xFor = (i) => PAD.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yFor = (v) => PAD.top + innerH - (Math.max(0, v || 0) / maxVal) * innerH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t);

  function buildPath(points) {
    let d = "";
    let started = false;
    points.forEach((v, i) => {
      if (v == null) {
        started = false;
        return;
      }
      d += `${started ? "L" : "M"}${xFor(i)},${yFor(v)} `;
      started = true;
    });
    return d.trim();
  }

  function lastVisibleIdx(points) {
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i] != null) return i;
    }
    return -1;
  }

  function handleMove(e) {
    const svgEl = e.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * CHART_W;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xFor(i) - relX);
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    setHoverIdx(idx);
  }

  const fmt = valueFormatter || ((v) => (v == null ? "-" : String(v)));

  return (
    <div className="trend-chart">
      <div className="trend-chart-title">{title}</div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="trend-chart-svg"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} className="trend-gridline" />
              <text x={PAD.left - 8} y={y + 3} className="trend-axis-label" textAnchor="end">
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        {months.map(
          (ym, i) =>
            (i === 0 || i === n - 1 || i === hoverIdx) && (
              <text key={ym} x={xFor(i)} y={CHART_H - 8} className="trend-axis-label" textAnchor="middle">
                {formatMonthLabel(ym)}
              </text>
            )
        )}

        {hoverIdx != null && (
          <line x1={xFor(hoverIdx)} x2={xFor(hoverIdx)} y1={PAD.top} y2={CHART_H - PAD.bottom} className="trend-crosshair" />
        )}

        {series.map((s) => {
          const lastIdx = lastVisibleIdx(s.points);
          return (
            <g key={s.key}>
              <path d={buildPath(s.points)} fill="none" style={{ stroke: s.color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {lastIdx >= 0 && (
                <circle cx={xFor(lastIdx)} cy={yFor(s.points[lastIdx])} r="5" style={{ fill: s.color, stroke: "var(--surface-1)" }} strokeWidth="2" />
              )}
              {hoverIdx != null && s.points[hoverIdx] != null && (
                <circle cx={xFor(hoverIdx)} cy={yFor(s.points[hoverIdx])} r="4" style={{ fill: s.color, stroke: "var(--surface-1)" }} strokeWidth="2" />
              )}
            </g>
          );
        })}
      </svg>

      {hoverIdx != null && (
        <div className="trend-tooltip">
          <div className="trend-tooltip-month">
            {months[hoverIdx].slice(0, 4)}년 {Number(months[hoverIdx].slice(4, 6))}월
          </div>
          {series.map((s) => (
            <div className="trend-tooltip-row" key={s.key}>
              <span className="trend-legend-dot" style={{ background: s.color }} />
              <span className="trend-tooltip-label">{s.label}</span>
              <span className="trend-tooltip-value">
                {fmt(s.points[hoverIdx])}
                {s.points[hoverIdx] != null ? unit : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="trend-legend">
        {series.map((s) => (
          <span className="trend-legend-item" key={s.key}>
            <span className="trend-legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
