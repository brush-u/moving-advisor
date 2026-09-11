"use client";

import { useState } from "react";
import RankFlow from "./components/RankFlow";
import DistrictFlow from "./components/DistrictFlow";
import PublicHousingFlow from "./components/PublicHousingFlow";

export default function Home() {
  const [mode, setMode] = useState("rank");
  // 예전엔 {mode === "rank" && <RankFlow />}처럼 조건부 렌더링만 했는데, 이러면 다른 탭으로
  // 옮겼다가 돌아올 때마다 React가 컴포넌트를 통째로 unmount했다가 다시 mount해서 내부
  // useState(조회 결과, 조건 설정 등)가 모두 초기화됐습니다(사용자 신고로 발견). 한 번이라도
  // 방문한 탭은 계속 mount 상태로 남겨두고 CSS로 보이기/숨기기만 전환하는 방식으로 바꿔서
  // 데이터가 유지되게 했습니다. 아직 방문하지 않은 탭은 그대로 mount하지 않아서(처음 로드 때
  // 불필요한 조회가 실행되지 않음) 기존 동작을 그대로 유지합니다.
  const [visitedModes, setVisitedModes] = useState(() => new Set(["rank"]));

  function switchMode(next) {
    setMode(next);
    setVisitedModes((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }

  return (
    <div className="container">
      <h1>이사 갈 곳 찾기</h1>

      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === "rank" ? "active" : ""}`}
          onClick={() => switchMode("rank")}
        >
          ① 어디로 갈지 추천받기
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === "district" ? "active" : ""}`}
          onClick={() => switchMode("district")}
        >
          ② 지역은 정했어요, 집만 찾을래요
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === "publicHousing" ? "active" : ""}`}
          onClick={() => switchMode("publicHousing")}
        >
          ③ 공공주택 정보
        </button>
      </div>

      <div className="mode-panels">
        {visitedModes.has("rank") && (
          <div className={mode === "rank" ? "" : "mode-panel-hidden"} aria-hidden={mode !== "rank"}>
            <RankFlow />
          </div>
        )}
        {visitedModes.has("district") && (
          <div className={mode === "district" ? "" : "mode-panel-hidden"} aria-hidden={mode !== "district"}>
            <DistrictFlow />
          </div>
        )}
        {visitedModes.has("publicHousing") && (
          <div className={mode === "publicHousing" ? "" : "mode-panel-hidden"} aria-hidden={mode !== "publicHousing"}>
            <PublicHousingFlow />
          </div>
        )}
      </div>
    </div>
  );
}
