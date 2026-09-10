// 다트가 지도에 꽂힐 때 나는 "파팍" 소리를 파일 없이 Web Audio API로 즉석 합성합니다.
// 브라우저 자동재생 정책 때문에, 실제 사용자 클릭(예: "매물 찾기" 버튼) 안에서
// unlockDartAudio()를 먼저 호출해 AudioContext를 만들어 둬야 이후 예약 재생이 허용됩니다.

let ctx = null;

export function unlockDartAudio() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch (err) {
    return null;
  }
  return ctx;
}

/**
 * delaySeconds 뒤에 "파팍" 소리(노이즈 임팩트 + 피치가 떨어지는 톡 소리)를 예약 재생합니다.
 * setTimeout이 아니라 AudioContext의 자체 시계를 기준으로 예약해 여러 개를 연속 재생해도
 * 타이밍이 밀리지 않습니다.
 */
export function scheduleThwack(delaySeconds = 0) {
  if (!ctx) return;
  try {
    const start = ctx.currentTime + Math.max(0, delaySeconds);

    // 임팩트 노이즈(짧은 백색소음, 빠르게 감쇠)
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.32, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(start);
    noise.stop(start + 0.09);

    // 피치가 훅 떨어지는 "톡" 타격감
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340, start);
    osc.frequency.exponentialRampToValueAtTime(65, start + 0.09);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.45, start);
    oscGain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.13);
  } catch (err) {
    // 오디오 재생 실패는 조용히 무시 (지도/애니메이션 기능에는 영향 없음)
  }
}

export function vibrateThwack() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(18);
  }
}
