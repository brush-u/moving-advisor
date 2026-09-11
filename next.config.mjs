// Cloudflare Workers 배포(README 31번) 관련 개발 편의 기능입니다. `next dev`로 평소처럼
// 로컬 개발할 때도 Cloudflare 바인딩(지금은 안 쓰지만 나중에 KV/R2 등을 추가하면)에
// 접근할 수 있게 해주며, 그 외에는 빌드 결과물에 아무 영향이 없습니다. wrangler/이
// 패키지가 아직 설치되지 않은 환경(예: 이 저장소를 처음 받아서 `npm install` 전인
// 상태)에서도 next.config.mjs 자체는 깨지지 않도록 try/catch로 감쌌습니다.
//
// 배포처를 Vercel로도 함께 쓰게 되면서(README 32번) 방어 코드를 하나 더 추가했습니다:
// 이 함수는 원래 `next dev`(로컬 개발 서버)에서만 의미가 있는데, `next build`(즉 Vercel의
// 빌드 과정 포함)에서도 next.config.mjs 자체는 그대로 로드되므로, `NODE_ENV === "development"`일
// 때만(=`next dev`로 실행 중일 때만) 호출하도록 제한했습니다. 안 그러면 프로덕션 빌드 중에
// 불필요하게 wrangler를 통해 로컬 Cloudflare 환경을 흉내 내려고 시도하다가(이 함수는 내부적으로
// 비동기라 위 try/catch로도 못 잡는 처리되지 않은 Promise 거부가 날 수 있습니다) 빌드 시간을
// 낭비하거나 예상치 못한 경고/오류가 날 수 있습니다. `.catch()`까지 붙여 혹시라도 (개발 모드에서)
// 실패하더라도 조용히 무시하고 평소처럼 `next dev`가 계속 동작하게 했습니다.
if (process.env.NODE_ENV === "development") {
  try {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev().catch(() => {
      // 무시 — 로컬 개발 서버는 이 기능 없이도 평소처럼 계속 동작합니다.
    });
  } catch {
    // 무시 — 로컬 개발 서버는 이 기능 없이도 평소처럼 계속 동작합니다.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
