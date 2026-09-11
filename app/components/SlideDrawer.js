"use client";

import { useEffect, useRef, useState } from "react";

// 이 거리(px) 이상 오른쪽으로 끌면 "닫으려는 의도"로 보고 닫습니다. 못 미치면 원래
// 자리로 스냅백합니다.
const CLOSE_DRAG_THRESHOLD_PX = 90;

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
 *
 * 손가락(또는 마우스)으로 헤더를 오른쪽으로 끌면 닫히는 제스처도 지원합니다(사용자
 * 요청). 본문(drawer-body)이 아니라 헤더(drawer-header)에만 드래그를 붙인 이유는,
 * 본문 안에는 세로 스크롤 목록이나 범위 슬라이더처럼 이미 자체적으로 드래그/스크롤을
 * 쓰는 요소가 많아서, 거기에 또 가로 드래그를 얹으면 서로 충돌하기 때문입니다. 헤더는
 * 항상 비어 있는 손잡이 역할이라 안전합니다.
 */
export default function SlideDrawer({ open, onClose, title, children }) {
  const dragStateRef = useRef(null); // 드래그 중 { startX, pointerId } — 렌더와 무관하게 유지
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

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

  // 패널이 열리거나 닫힐 때(예: 바깥에서 onClose가 호출된 경우) 진행 중이던 드래그
  // 흔적이 남지 않도록 초기화합니다.
  useEffect(() => {
    dragStateRef.current = null;
    setDragging(false);
    setDragX(0);
  }, [open]);

  function handleHeaderPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragStateRef.current = { startX: e.clientX, pointerId: e.pointerId };
    setDragging(true);
    setDragX(0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleHeaderPointerMove(e) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // 닫히는 방향(오른쪽)으로만 끌리게 하고, 반대 방향은 0으로 고정합니다.
    const dx = Math.max(0, e.clientX - drag.startX);
    setDragX(dx);
  }

  function endDrag(e) {
    const drag = dragStateRef.current;
    if (!drag || (e && drag.pointerId !== e.pointerId)) return;
    const finalDx = dragX;
    dragStateRef.current = null;
    setDragging(false);
    setDragX(0);
    if (finalDx > CLOSE_DRAG_THRESHOLD_PX) onClose();
  }

  const dragStyle = dragging ? { transform: `translateX(${dragX}px)`, transition: "none" } : undefined;

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
        style={dragStyle}
      >
        <div
          className="drawer-header"
          onPointerDown={handleHeaderPointerDown}
          onPointerMove={handleHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="drawer-drag-handle" aria-hidden="true" />
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
