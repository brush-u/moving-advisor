import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "이사 갈 곳 찾기 | 부동산 이주 추천",
  description: "예산·통근·학군·치안/생활편의를 종합해 이사 갈 서울 자치구를 추천합니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
