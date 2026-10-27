import type { World } from "../contracts";
import type { WildlifeState } from "../wildlife/contracts";
import type { Point, Collider, Quality } from "../three/shared";
export type District = "town" | "harbor" | "wetlands";
export const REGION_BOUNDS = { minX: -108, maxX: 108, minZ: -36, maxZ: 33 };
export const REGION_SITES = {
  home: { x: -22, z: 15 },
  parking: { x: -19, z: 20.5 },
  market: { x: 0, z: -5 },
  dispatch: { x: 70, z: 15 },
  cargo: { x: 74, z: 12 },
  outpost: { x: -67, z: 16 },
  clue: { x: -75, z: 10 },
  shortcut: { x: -81, z: -5 },
  ruin: { x: -92, z: -23 },
  rescue: { x: 91, z: 24 },
  safe: { x: 84, z: 17 },
  upgrade: { x: -26, z: 10 },
  mission: { x: -18, z: 11 },
} satisfies Record<string, Point>;
export const ROAD_ROUTE: Point[] = [
  { x: -97, z: -25 },
  { x: -94, z: -5 },
  { x: -88, z: 13 },
  { x: -74, z: 20.5 },
  { x: -40, z: 20.5 },
  { x: 0, z: 20.5 },
  { x: 40, z: 20.5 },
  { x: 64, z: 20.5 },
  { x: 82, z: 12 },
  { x: 94, z: 0 },
  { x: 98, z: -20 },
];
export interface VehicleState {
  position: Point;
  yaw: number;
  speed: number;
  steer: number;
  occupied: boolean;
  owned: boolean;
  distance: number;
  impact: number;
  cargo: number;
  target: Point | null;
  lastSafe: Point;
}
export interface DriveInput {
  throttle: number;
  steer: number;
  brake: boolean;
}
export interface ResidentState {
  id: string;
  position: Point;
  path: Point[];
  home: Point;
  destination: Point;
  pause: number;
  routine: number;
}
export interface RegionEvent {
  id: string;
  at: number;
  kind: string;
  actor: string;
  detail: string;
  facts: string[];
}
export interface RegionState {
  trafficTime?: [number, number];
  version: 1;
  wildlife: WildlifeState;
  campaign: World;
  vehicle: VehicleState;
  residents: ResidentState[];
  elapsed: number;
  district: District;
  discovered: string[];
  waypoint: Point | null;
  delivery: {
    status: "available" | "accepted" | "loaded" | "complete" | "abandoned";
    goods: number;
    reward: number;
    promised: boolean;
  };
  assistance: {
    status: "waiting" | "escorting" | "complete";
    position: Point;
    path: Point[];
  };
  expedition: {
    clue: boolean;
    shortcut: boolean;
    relic: boolean;
    complete: boolean;
  };
  upgrades: { shelter: boolean; workbench: boolean };
  events: RegionEvent[];
  nextEvent: number;
}
export type RegionCommand =
  | { type: "enter" }
  | { type: "exit" }
  | { type: "recover" }
  | { type: "driveTarget"; point: Point }
  | { type: "waypoint"; point: Point | null }
  | { type: "interact"; id: string }
  | { type: "acceptDelivery"; promise?: boolean }
  | { type: "abandonDelivery" }
  | { type: "talk"; id: string; text: string; mode: string }
  | {
      type: "wildlife";
      command: import("../wildlife/contracts").WildlifeCommand;
    };
export interface RegionInteraction {
  id: string;
  label: string;
  position: Point;
  radius: number;
  kind: "resident" | "vehicle" | "site" | "mission";
}
export function districtAt(p: Point): District {
  return p.x < -40 ? "wetlands" : p.x > 40 ? "harbor" : "town";
}
export function surfaceHeight(p: Point): number {
  return p.x < -44 && p.x > -61 && Math.abs(p.z - 20.5) < 5
    ? Math.sin(((p.x + 61) / 17) * Math.PI) * 0.9
    : p.x < -88 && p.z < -15
      ? // Blend inside the existing cliff footprint. The stone platform starts
        // at x=-89.5 and retains its original height; east of -88 stays flat.
        // Ground vertices, path ribbons and moving actors share this surface.
        Math.min(2.2, (-p.z - 15) * 0.16) * Math.min(1, (-88 - p.x) / 1.5)
      : 0;
}
export type { Point, Collider, Quality };
