// Cloudflare Workers 배포(README 31번) 관련 개발 편의 기능입니다. `next dev`로 평소처럼
// 로컬 개발할 때도 Cloudflare 바인딩(지금은 안 쓰지만 나중에 KV/R2 등을 추가하면)에
// 접근할 수 있게 해주며, 그 외에는 빌드 결과물에 아무 영향이 없습니다. wrangler/이
// 패키지가 아직 설치되지 않은 환경(예: 이 저장소를 처음 받아서 `npm install` 전인
// 상태)에서도 next.config.mjs 자체는 깨지지 않도록 try/catch로 감쌌습니다.
try {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
} catch {
  // 무시 — 로컬 개발 서버는 이 기능 없이도 평소처럼 계속 동작합니다.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
