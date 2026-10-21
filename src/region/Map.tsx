import { useEffect, useRef, useState } from "react";
import {
  REGION_SITES,
  ROAD_ROUTE,
  REGION_BOUNDS,
  type RegionState,
  type Point,
} from "./contracts";
import "./map.css";
interface Props {
  state: RegionState;
  onClose: () => void;
  onWaypoint: (point: Point) => void;
  onTravel: (point: Point) => void;
}
const labels: Partial<Record<keyof typeof REGION_SITES, string>> = {
  home: "Home",
  market: "Salt Market",
  dispatch: "Harbor dispatch",
  outpost: "Wetland station",
  ruin: "Observatory",
  rescue: "East jetty",
};
const px = (x: number) => (x + 108) * 4,
  pz = (z: number) => (z + 36) * 4;
export default function RegionMap({
  state,
  onClose,
  onWaypoint,
  onTravel,
}: Props) {
  const panel = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [selection, setSelection] = useState<Point | null>(state.waypoint);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button,[tabindex="0"]',
          ) || [],
        );
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        if (nodes.length && (e.shiftKey ? i <= 0 : i === nodes.length - 1)) {
          e.preventDefault();
          nodes[e.shiftKey ? nodes.length - 1 : 0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      previous?.focus();
    };
  }, []);
  function select(point: Point) {
    setSelection(point);
    onWaypoint(point);
  }
  const entries = Object.entries(labels).filter(
    ([id]) => id === "home" || state.discovered.includes(id),
  ) as [keyof typeof REGION_SITES, string][];
  const road = ROAD_ROUTE.map((p) => `${px(p.x)},${pz(p.z)}`).join(" "),
    p = state.wildlife.player,
    car = state.vehicle.position;
  const distance = selection
    ? Math.round(Math.hypot(selection.x - p.x, selection.z - p.z))
    : 0;
  return (
    <div
      className="region-map-shade"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="region-map-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="region-map-title"
        ref={panel}
      >
        <header>
          <div>
            <span className="region-map-eyebrow">AFTERLIGHT / FIELD MAP</span>
            <h2 id="region-map-title">The connected coast</h2>
          </div>
          <button
            className="region-map-close"
            onClick={onClose}
            aria-label="Close map"
          >
            ×
          </button>
        </header>
        <p className="region-map-note">
          Choose a place to set your course. There is no hurry.
        </p>
        <div className="region-map-chart">
          <svg
            ref={svg}
            viewBox="0 0 864 276"
            role="img"
            aria-label="Map of the wetlands, coastal town and harbor. Select a destination by clicking the map."
            onClick={(e) => {
              const matrix = svg.current?.getScreenCTM();
              if (!matrix) return;
              const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                matrix.inverse(),
              );
              select({
                x: Math.max(
                  REGION_BOUNDS.minX + 3,
                  Math.min(REGION_BOUNDS.maxX - 3, point.x / 4 - 108),
                ),
                z: Math.max(
                  REGION_BOUNDS.minZ + 3,
                  Math.min(REGION_BOUNDS.maxZ - 3, point.y / 4 - 36),
                ),
              });
            }}
          >
            <defs>
              <pattern
                id="region-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M40 0H0V40"
                  fill="none"
                  stroke="#d9dcc3"
                  strokeWidth=".4"
                  opacity=".18"
                />
              </pattern>
              <pattern
                id="region-marsh"
                width="22"
                height="19"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M4 14l2-5 2 5m7-4 1-4 2 4"
                  stroke="#afbd95"
                  strokeWidth=".7"
                  fill="none"
                  opacity=".3"
                />
              </pattern>
            </defs>
            <rect width="864" height="276" fill="#506f69" />
            <path d="M0 0H276V276H0Z" fill="#3c5a4a" />
            <path d="M276 0H592V276H276Z" fill="#737b68" />
            <path d="M592 0H864V276H592Z" fill="#857b66" />
            <rect width="276" height="276" fill="url(#region-marsh)" />
            <path
              d="M0 258 Q100 241 185 263T354 255T530 260T710 253T864 262V276H0Z"
              fill="#8eb4af"
            />
            <path
              d="M213 0Q244 65 214 128T225 276"
              stroke="#84a49a"
              strokeWidth="38"
              fill="none"
              opacity=".7"
            />
            <rect width="864" height="276" fill="url(#region-grid)" />
            {[-40, 40].map((x) => (
              <path
                key={x}
                d={`M${px(x)} 12V260`}
                stroke="#dad8b7"
                strokeWidth=".7"
                opacity=".3"
                strokeDasharray="3 6"
              />
            ))}
            <polyline
              points={road}
              fill="none"
              stroke="#344a43"
              strokeWidth="19"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={road}
              fill="none"
              stroke="#d2c6a4"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={road}
              fill="none"
              stroke="#867f66"
              strokeWidth=".8"
              strokeDasharray="4 6"
            />
            <path
              d={`M${px(-10)} ${pz(20.5)}V${pz(0)}H${px(28)}M${px(-10)} ${pz(0)}H${px(-30)}M${px(0)} ${pz(0)}V${pz(-8)}`}
              stroke="#c0b89b"
              strokeWidth="7"
              fill="none"
            />
            <g fill="#d8d2ad" opacity=".7">
              {[
                [-22, 9, 14, 12],
                [0, -14, 13, 12],
                [22, -14, 12, 12],
                [-23, -17, 12, 12],
                [24, 10, 9, 10],
                [70, 3, 20, 16],
                [-67, 9, 12, 10],
              ].map(([x, z, w, d], i) => (
                <rect
                  key={i}
                  x={px(x - w / 2)}
                  y={pz(z - d / 2)}
                  width={w * 4}
                  height={d * 4}
                  rx="2"
                />
              ))}
            </g>
            {["wetlands", "town", "harbor"].map((district, i) => (
              <g key={district}>
                <text
                  x={[136, 432, 728][i]}
                  y="28"
                  className="region-map-district"
                >
                  {["MANGROVE WETLANDS", "SALT COAST", "EAST HARBOR"][i]}
                </text>
                {!state.discovered.includes(district) &&
                  district !== "town" && (
                    <text
                      x={[136, 432, 728][i]}
                      y="43"
                      className="region-map-unvisited"
                    >
                      UNEXPLORED
                    </text>
                  )}
              </g>
            ))}
            {entries.map(([id, label]) => {
              const site = REGION_SITES[id];
              return (
                <g
                  key={id}
                  className="region-map-landmark"
                  role="button"
                  tabIndex={0}
                  aria-label={`Set waypoint: ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(site);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(site);
                    }
                  }}
                >
                  <circle
                    cx={px(site.x)}
                    cy={pz(site.z)}
                    r="13"
                    fill="transparent"
                  />
                  <circle
                    cx={px(site.x)}
                    cy={pz(site.z)}
                    r="4"
                    fill="#f2dfac"
                    stroke="#334d45"
                    strokeWidth="2"
                  />
                  <text x={px(site.x)} y={pz(site.z) - 10} textAnchor="middle">
                    {label}
                  </text>
                </g>
              );
            })}
            <g
              transform={`translate(${px(car.x)} ${pz(car.z)}) rotate(${(-state.vehicle.yaw * 180) / Math.PI})`}
            >
              <rect
                x="-3"
                y="-6"
                width="6"
                height="12"
                rx="1.5"
                fill="#c9e6df"
                stroke="#27453e"
                strokeWidth="1.5"
              />
              <path d="M-2 -2H2" stroke="#537b78" strokeWidth="2" />
            </g>
            {!state.vehicle.occupied && (
              <g transform={`translate(${px(p.x)} ${pz(p.z)})`}>
                <circle r="8" fill="#e2f4e4" opacity=".22" />
                <circle
                  r="4"
                  fill="#f6f4d9"
                  stroke="#345b4d"
                  strokeWidth="1.5"
                />
              </g>
            )}
            {selection && (
              <g
                transform={`translate(${px(selection.x)} ${pz(selection.z)})`}
                pointerEvents="none"
              >
                <circle r="10" fill="none" stroke="#fff0b1" strokeWidth="1.5" />
                <path
                  d="M0-15V-6M0 6V15M-15 0H-6M6 0H15"
                  stroke="#fff0b1"
                  strokeWidth="1.2"
                />
              </g>
            )}
            <g transform="translate(840 55)" fill="#e5dfbd">
              <path d="M0-12L4 0 0-3-4 0Z" />
              <text y="12" textAnchor="middle" fontSize="9">
                N
              </text>
            </g>
          </svg>
        </div>
        <div className="region-map-bottom">
          <div>
            <span className="region-map-key">
              <i /> You & your pickup
            </span>
            <p>
              {selection
                ? `${distance} m from you · route follows the physical world`
                : "Landmarks appear as you discover them."}
            </p>
          </div>
          <button
            className="region-map-travel"
            disabled={!selection}
            onClick={() => {
              if (selection) {
                onTravel(selection);
                onClose();
              }
            }}
          >
            {selection
              ? state.vehicle.occupied
                ? "Drive toward waypoint"
                : "Walk toward waypoint"
              : "Choose a destination"}
            <span aria-hidden="true"> ↗</span>
          </button>
        </div>
        <div className="region-map-places" aria-label="Discovered destinations">
          {entries.map(([id, label]) => (
            <button key={id} onClick={() => select(REGION_SITES[id])}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
export { RegionMap };
