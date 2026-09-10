"use client";

import { useEffect } from "react";

/**
 * 오른쪽 화면 밖에서 슬라이드로 나타났다가, 닫으면 다시 오른쪽으로 사라지는 조건 설정
 * 패널입니다. 원래는 "다음/이전" 버튼으로 넘기는 단계별 슬라이드(마법사, README 29번)
 * 였는데, 사용자가 다른 서비스의 필터 패널 예시(지도는 항상 보이고, "조건" 버튼을
 * 누르면 조건 입력이 오른쪽에서 슬라이드로 나타나는 방식)를 보여주며 그 방식으로
 * 바꿔달라고 요청해 다시 만들었습니다(README 30번).
 *
 * 지도처럼 항상 보여야 하는 핵심 내용은 각 화면(RankFlow/DistrictFlow)의 메인
 * 영역에 그대로 두고, 세부 조건 입력만 이 패널 안에 넣는 용도입니다.
 *
 * children은 패널이 닫혀 있을 때도(open=false) 계속 DOM에 렌더링합니다 — 어차피
 * 안의 입력값들은 이 컴포넌트가 아니라 부모(RankFlow/DistrictFlow)의 state에
 * 있으므로 마운트 여부와 무관하게 값은 유지되고, 이렇게 해야 닫힐 때도(오른쪽으로
 * 사라지는) 트랜지션이 재생됩니다(마운트/언마운트 방식은 닫는 애니메이션이 안 보입니다).
 */
export default function SlideDrawer({ open, onClose, title, children }) {
  // 패널이 열려 있는 동안은 뒤 배경이 스크롤되지 않게 막습니다(모바일에서 패널 위로
  // 손가락을 움직였을 때 뒤 페이지까지 같이 스크롤되는 걸 방지).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Esc 키로도 닫을 수 있게(데스크톱 사용성).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`drawer-backdrop${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`drawer-panel${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={title}
      >
        <div className="drawer-header">
          <h2>{title}</h2>
          <button type="button" className="drawer-close-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
