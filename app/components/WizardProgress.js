"use client";

/**
 * 여러 단계로 나뉜 입력 폼(①모드: 위치→조건→중요도, ②모드: 지역→예산/조건) 맨 위에 붙는
 * 진행 표시줄입니다. 원래는 조건 입력을 한 화면에 다 몰아넣거나(①모드) 한 번에 쭉 이어서
 * 보여줬는데(②모드), 특히 휴대폰에서 스크롤이 너무 길어진다는 피드백을 받아 단계별
 * 슬라이드로 나누면서(README 29번) "지금 몇 단계째인지"를 보여주기 위해 만들었습니다.
 *
 * step: 1부터 시작하는 현재 단계 번호. labels: 각 단계 이름 배열(예: ["위치","조건","중요도"]).
 * 좁은 화면(휴대폰)에서는 글자 라벨을 숨기고 번호 동그라미+선만 남겨 한 줄에 다 들어오게
 * 합니다(globals.css의 @media 처리).
 */
export default function WizardProgress({ step, labels }) {
  return (
    <div className="wizard-progress" role="list" aria-label="입력 단계">
      {labels.map((label, idx) => {
        const n = idx + 1;
        const state = n === step ? "current" : n < step ? "done" : "upcoming";
        return (
          <div className="wizard-progress-item" role="listitem" key={label}>
            <span className={`wizard-progress-dot ${state}`} aria-current={n === step ? "step" : undefined}>
              {n < step ? "✓" : n}
            </span>
            <span className={`wizard-progress-label ${state}`}>{label}</span>
            {idx < labels.length - 1 && <span className={`wizard-progress-line ${n < step ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}
