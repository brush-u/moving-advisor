// Cloudflare Workers용 빌드 설정입니다(README 31번). 이 프로젝트는 ISR/정적 재생성
// 없이 전부 실시간 API 호출(ƒ 라우트)만 쓰므로, 기본값 그대로 써도 충분합니다 —
// R2 캐시 등 추가 설정 없이 defineCloudflareConfig()만 호출합니다.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
