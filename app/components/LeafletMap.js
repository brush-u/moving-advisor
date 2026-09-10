"use client";

import { useEffect, useRef } from "react";
import { buildDartMarkerHtml, buildPlainMarkerHtml, DART_STAGGER_MS, DART_FLIGHT_MS } from "./dartMarker";
import { scheduleThwack, vibrateThwack } from "./dartAudio";

let leafletPromise;
function loadLeaflet() {
  if (!leafletPromise) leafletPromise = import("leaflet");
  return leafletPromise;
}

const DART_ICON_SIZE = [26, 34];
const DART_ICON_ANCHOR = [13, 34];

function buildMyLocationHtml() {
  return `
    <span class="my-location-dot">
      <span class="my-location-pulse"></span>
      <span class="my-location-core"></span>
    </span>
  `;
}

/**
 * API 키가 필요 없는 OpenStreetMap 타일 기반 지도. 마커는 이미지 대신 인라인 원/SVG(div icon)으로
 * 그려서 번들러의 leaflet 기본 마커 이미지 경로 문제를 피했습니다.
 *
 * markers: [{ id, lat, lng, color, label, popupHtml, approximate, landing, settled, size }]
 *   - approximate가 true면 "정확한 위치 아님(지오코딩 실패)"으로 취급해 점선 테두리로 표시
 *   - landing이 true면 매물 후보 마커로 취급해 "다트가 꽂히는" 애니메이션 대상이 됩니다
 *     (지역 중심점처럼 landing이 없는 마커는 항상 정적인 원으로만 표시됩니다).
 *   - settled가 true면(landing 마커 중, 결과가 여러 배치로 나뉘어 도착할 때 이전 배치에서
 *     이미 꽂힌 것) 다트 모양은 유지하되 이번 dropKey 갱신에서는 낙하 애니메이션/사운드를
 *     재생하지 않습니다.
 *   - size를 주면(예: 지하철역처럼 작게 표시하고 싶을 때) 기본 크기 대신 그 값을 씁니다.
 *
 * dropKey: 값이 바뀔 때만(예: "매물 찾기"로 새 검색이 끝났을 때, 또는 "추천받기" 버튼을 눌러
 *   검색을 시작하는 순간) landing 마커들이 순서대로 화살처럼 날아와 "파팍" 소리+진동과 함께
 *   꽂히는 연출을 재생합니다. 후보 선택/해제처럼 dropKey가 그대로인 리렌더에서는
 *   애니메이션·사운드·진동 없이 최종 위치에 정적으로만 다시 그려집니다.
 *
 * interactive + onMapClick: true면 지도를 클릭해 임의 지점을 고를 수 있는 "위치 선택" 모드가 됩니다.
 * circle: {lat, lng, radiusKm}가 있으면 반경 검색 범위를 원으로 표시합니다.
 * userLocation: {lat, lng}가 있으면 "내 위치"를 파란 점(맥동 애니메이션)으로 표시합니다.
 * focus + focusKey: focusKey가 바뀔 때만 focus 지점으로 부드럽게(flyTo) 지도를 이동시킵니다
 *   (예: "이사 갈 곳 추천받기"를 누른 순간 지도가 검색 중심점으로 포커싱되는 연출).
 *   focusKey를 쓰는 호출부는 center 변경만으로는 지도를 움직이지 않습니다 — 최초 1회만 사용됩니다.
 * sidoBoundaries: {data, selectedName, onSelect}가 있으면 전국 시/도 경계선(GeoJSON)을
 *   오버레이로 그리고, 선택된 시/도(selectedName)를 색으로 채워 강조합니다. 시/도 영역을
 *   클릭하면 onSelect(name, {lat, lng})를 호출합니다(클릭 지점의 정확한 좌표도 함께 넘겨서,
 *   그 지점을 통근시간 계산 기준점으로도 바로 쓸 수 있게 합니다) — "시/도로 찾기" 모드에서
 *   드롭다운 대신 지도를 직접 클릭해 지역을 고를 수 있게 하기 위한 것입니다.
 */
export default function LeafletMap({
  center,
  zoom = 12,
  markers = [],
  onMarkerClick,
  selectedId,
  height = 420,
  dropKey,
  interactive = false,
  onMapClick,
  circle,
  userLocation,
  focus,
  focusKey,
  sidoBoundaries,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const lastDropKeyRef = useRef(undefined);
  const lastFocusKeyRef = useRef(undefined);
  const timeoutsRef = useRef([]);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const sidoOnSelectRef = useRef(sidoBoundaries?.onSelect);
  sidoOnSelectRef.current = sidoBoundaries?.onSelect;

  // 지도 최초 생성 (한 번만)
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        scrollWheelZoom: true, // 마우스 휠로도 확대/축소 가능하게
        touchZoom: true, // 모바일 두 손가락 핀치 확대/축소 (기본값이지만 명시)
        tap: true,
      }).setView([center.lat, center.lng], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
      boundaryLayerRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      overlayLayerRef.current = L.layerGroup().addTo(map);
      // 기본 확대/축소 컨트롤을 오른쪽 위로 옮겨서, "내 위치 사용" 버튼(지도 위 오버레이)과
      // 세로로 나란히 놓이게 합니다(위치는 globals.css의 .map-locate-btn/.leaflet-control-zoom 참고).
      if (map.zoomControl) map.zoomControl.setPosition("topright");
      if (interactive) {
        map.on("click", (e) => {
          if (onMapClickRef.current) onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }
      // 부모가 처음 숨겨져 있다가 나타나는 레이아웃일 수 있어 사이즈 재계산
      setTimeout(() => map.invalidateSize(), 150);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 중심 좌표 변경 시 이동 (focusKey를 쓰는 호출부는 대신 flyTo 이펙트가 담당하므로 건너뜁니다)
  useEffect(() => {
    if (focusKey !== undefined) return;
    if (mapRef.current) mapRef.current.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom, focusKey]);

  // focusKey가 바뀔 때만 부드럽게 focus 지점으로 "포커싱" (예: 검색 시작 애니메이션)
  useEffect(() => {
    if (focusKey === undefined || !focus || !mapRef.current) return;
    const isFresh = lastFocusKeyRef.current !== undefined && focusKey !== lastFocusKeyRef.current;
    lastFocusKeyRef.current = focusKey;
    if (isFresh) {
      mapRef.current.flyTo([focus.lat, focus.lng], focus.zoom ?? mapRef.current.getZoom(), { duration: 0.9 });
    } else {
      mapRef.current.setView([focus.lat, focus.lng], focus.zoom ?? zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // 반경 원 + 내 위치 점 오버레이
  useEffect(() => {
    loadLeaflet().then((L) => {
      if (!mapRef.current || !overlayLayerRef.current) return;
      overlayLayerRef.current.clearLayers();

      if (circle && circle.lat != null && circle.lng != null && circle.radiusKm > 0) {
        L.circle([circle.lat, circle.lng], {
          radius: circle.radiusKm * 1000,
          color: "#2a78d6",
          weight: 1.5,
          fillColor: "#2a78d6",
          fillOpacity: 0.08,
        }).addTo(overlayLayerRef.current);
      }

      if (userLocation && userLocation.lat != null && userLocation.lng != null) {
        const icon = L.divIcon({ className: "", html: buildMyLocationHtml(), iconSize: [18, 18], iconAnchor: [9, 9] });
        L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: -100, interactive: false }).addTo(
          overlayLayerRef.current
        );
      }
    });
  }, [circle?.lat, circle?.lng, circle?.radiusKm, userLocation?.lat, userLocation?.lng]);

  // 시/도 경계 오버레이 (전국 전도에서 "시/도로 찾기" 모드일 때만 전달됨)
  useEffect(() => {
    loadLeaflet().then((L) => {
      if (!mapRef.current || !boundaryLayerRef.current) return;
      boundaryLayerRef.current.clearLayers();
      if (!sidoBoundaries || !sidoBoundaries.data) return;

      const { data, selectedName } = sidoBoundaries;
      const styleFor = (name) =>
        name === selectedName
          ? { color: "#1a56b0", weight: 2, fillColor: "#2a78d6", fillOpacity: 0.45 }
          : { color: "#8a97ab", weight: 1, fillColor: "#c7d2e0", fillOpacity: 0.25 };

      L.geoJSON(data, {
        style: (feature) => styleFor(feature.properties?.name),
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name;
          if (name) layer.bindTooltip(name, { sticky: true, direction: "top" });
          layer.on({
            mouseover: () => {
              if (name !== selectedName) layer.setStyle({ fillOpacity: 0.4 });
            },
            mouseout: () => {
              if (name !== selectedName) layer.setStyle(styleFor(name));
            },
            click: (e) => {
              // 리플렛 벡터 레이어는 기본적으로 클릭 이벤트가 지도 자체의 click까지 그대로
              // 전파됩니다(bubblingMouseEvents 기본값 true) — 막지 않으면 이 폴리곤 클릭이
              // interactive 모드의 onMapClick(범용 "지점 선택")까지 같이 실행되면서, 방금
              // sidoOnSelect가 정해 둔 origin 라벨을 곧바로 다시 덮어써 버립니다.
              L.DomEvent.stopPropagation(e);
              if (sidoOnSelectRef.current) sidoOnSelectRef.current(name, { lat: e.latlng.lat, lng: e.latlng.lng });
            },
          });
        },
      }).addTo(boundaryLayerRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidoBoundaries?.data, sidoBoundaries?.selectedName]);

  // 마커 갱신 (+ 새 검색 결과일 때만 "다트" 낙하 애니메이션/사운드/진동 재생)
  useEffect(() => {
    loadLeaflet().then((L) => {
      if (!mapRef.current || !layerRef.current) return;
      layerRef.current.clearLayers();

      const isFreshDrop = dropKey != null && dropKey !== lastDropKeyRef.current;
      let landingIndex = 0;

      markers.forEach((m) => {
        const isSelected = m.id === selectedId;
        let html;
        let iconSize;
        let iconAnchor;

        if (m.landing) {
          // settled가 true면(예: 매물 후보가 구별로 나눠서 도착할 때, 먼저 도착해 이미 한 번
          // 꽂혔던 지역) 다트 모양은 그대로 유지하되 이번 dropKey 갱신에서는 낙하 애니메이션을
          // 다시 재생하지 않습니다 — 안 그러면 새 지역이 도착할 때마다 이미 꽂혀 있던 핀들까지
          // 매번 다시 "파팍" 떨어지는 것처럼 보입니다.
          const shouldAnimateThis = isFreshDrop && !m.settled;
          const delayMs = shouldAnimateThis ? landingIndex * DART_STAGGER_MS : 0;
          html = buildDartMarkerHtml({
            color: m.color,
            approximate: m.approximate,
            selected: isSelected,
            animate: shouldAnimateThis,
            delayMs,
          });
          iconSize = DART_ICON_SIZE;
          iconAnchor = DART_ICON_ANCHOR;

          if (shouldAnimateThis) {
            const impactDelayMs = delayMs + DART_FLIGHT_MS - 60;
            timeoutsRef.current.push(setTimeout(() => vibrateThwack(), Math.max(0, impactDelayMs)));
            scheduleThwack(impactDelayMs / 1000);
            landingIndex += 1;
          }
        } else {
          const size = m.size || (isSelected ? 20 : 13);
          html = buildPlainMarkerHtml({ color: m.color, size, approximate: m.approximate });
          iconSize = [size, size];
          iconAnchor = [size / 2, size / 2];
        }

        const icon = L.divIcon({ className: "", html, iconSize, iconAnchor });
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });
        if (m.popupHtml) marker.bindPopup(m.popupHtml);
        if (onMarkerClick) marker.on("click", () => onMarkerClick(m.id));
        marker.addTo(layerRef.current);
      });

      if (dropKey != null) lastDropKeyRef.current = dropKey;
    });

    return () => {
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, selectedId, dropKey]);

  return (
    <div
      ref={containerRef}
      className={`leaflet-map-el${interactive ? " leaflet-map-interactive" : ""}`}
      style={{ "--map-h": `${height}px` }}
    />
  );
}
