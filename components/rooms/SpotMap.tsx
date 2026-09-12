"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo";
import type { RankedSpot } from "@/lib/recommendations";

const COLORS = {
  origin: "#2563eb",
  primary: "#00356b",
  coffee: "#b45309",
  room: "#0f766e",
};

export function SpotMap({
  origin,
  originLabel,
  spots,
  primaryName,
}: {
  origin: LatLng | null;
  originLabel: string;
  spots: RankedSpot[];
  primaryName: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(container, {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
          // Tile fade + animated fitBounds can leave tiles stuck at opacity 0
          // when React re-runs the effect mid-animation; keep it simple.
          fadeAnimation: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;

      // Clear everything except the tile layer.
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
      });

      const bounds: [number, number][] = [];

      for (const spot of spots) {
        if (typeof spot.lat !== "number" || typeof spot.lng !== "number") continue;
        const isPrimary = spot.name === primaryName;
        const color = isPrimary
          ? COLORS.primary
          : spot.kind === "coffee"
            ? COLORS.coffee
            : COLORS.room;
        const marker = L.circleMarker([spot.lat, spot.lng], {
          radius: isPrimary ? 10 : 7,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        }).addTo(map);
        const dir = spot.directionsUrl
          ? `<br/><a href="${spot.directionsUrl}" target="_blank" rel="noopener noreferrer">Walking directions</a>`
          : "";
        marker.bindPopup(
          `<strong>${escapeHtml(spot.name)}</strong><br/>${spot.walkingMinutes} min walk` +
            (isPrimary ? " · <em>recommended</em>" : "") +
            dir,
        );
        bounds.push([spot.lat, spot.lng]);

        if (isPrimary && origin) {
          L.polyline(
            [
              [origin.lat, origin.lng],
              [spot.lat, spot.lng],
            ],
            { color: COLORS.primary, weight: 3, dashArray: "6 6", opacity: 0.8 },
          ).addTo(map);
        }
      }

      if (origin) {
        L.circleMarker([origin.lat, origin.lng], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: COLORS.origin,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`<strong>Start:</strong> ${escapeHtml(originLabel)}`);
        bounds.push([origin.lat, origin.lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17, animate: false });
      } else {
        map.setView([41.3111, -72.9267], 15, { animate: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, originLabel, spots, primaryName]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative z-0 isolate space-y-2">
      <div
        ref={containerRef}
        className="relative z-0 h-72 w-full overflow-hidden rounded-xl border sm:h-96 [&_.leaflet-container]:z-0 [&_.leaflet-pane]:!z-[1] [&_.leaflet-top]:!z-[2] [&_.leaflet-bottom]:!z-[2] [&_.leaflet-control]:!z-[2]"
        aria-label="Map of study spots"
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Legend color={COLORS.origin} label="Start" />
        <Legend color={COLORS.primary} label="Recommended" />
        <Legend color={COLORS.coffee} label="Coffee shop" />
        <Legend color={COLORS.room} label="Bookable room" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-full border border-white shadow"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
