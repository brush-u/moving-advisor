"use client";

import { useState } from "react";
import RankFlow from "./components/RankFlow";
import DistrictFlow from "./components/DistrictFlow";
import PublicHousingFlow from "./components/PublicHousingFlow";

export default function Home() {
  const [mode, setMode] = useState("rank");

  return (
    <div className="container">
      <h1>이사 갈 곳 찾기</h1>

      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === "rank" ? "active" : ""}`}
          onClick={() => setMode("rank")}
        >
          ① 어디로 갈지 추천받기
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === "district" ? "active" : ""}`}
          onClick={() => setMode("district")}
        >
          ② 지역은 정했어요, 집만 찾을래요
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === "publicHousing" ? "active" : ""}`}
          onClick={() => setMode("publicHousing")}
        >
          ③ 공공주택 정보
        </button>
      </div>

      {mode === "rank" && <RankFlow />}
      {mode === "district" && <DistrictFlow />}
      {mode === "publicHousing" && <PublicHousingFlow />}
    </div>
  );
}
