import type * as THREE from "three";
import type { LocationId, World } from "../contracts";
export type Point = { x: number; z: number };
export type Quality = "high" | "low";
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  id?: string;
  exposed?: boolean;
}
export interface Interaction {
  id: string;
  kind: "person" | "location" | "supply" | "vehicle";
  label: string;
  position: Point;
  location: LocationId;
  object?: THREE.Object3D;
}
export interface Place {
  id: LocationId;
  name: string;
  center: Point;
  door: Point;
  width: number;
  depth: number;
}
export const PLACES: Place[] = [
  {
    id: "warehouse",
    name: "RELIEF WAREHOUSE",
    center: { x: -22, z: 9 },
    door: { x: -22, z: 15 },
    width: 14,
    depth: 12,
  },
  {
    id: "market",
    name: "SALT MARKET",
    center: { x: 0, z: -14 },
    door: { x: 0, z: -8 },
    width: 13,
    depth: 12,
  },
  {
    id: "clinic",
    name: "MERCY CLINIC",
    center: { x: 22, z: -14 },
    door: { x: 22, z: -8 },
    width: 12,
    depth: 12,
  },
  {
    id: "heights",
    name: "CYPRESS HOUSE",
    center: { x: -23, z: -17 },
    door: { x: -23, z: -11 },
    width: 12,
    depth: 12,
  },
  {
    id: "radio",
    name: "BAY RADIO",
    center: { x: 24, z: 10 },
    door: { x: 24, z: 15 },
    width: 9,
    depth: 10,
  },
  {
    id: "harbor",
    name: "OLD HARBOR",
    center: { x: 5, z: 27 },
    door: { x: 5, z: 27 },
    width: 10,
    depth: 8,
  },
];
export const START: Point = { x: -20, z: 20 };
export const BOUNDS = { minX: -39, maxX: 39, minZ: -30, maxZ: 33 };
export function residentHome(world: World, id: string): Point {
  const c = world.characters.find((c) => c.id === id);
  const p = PLACES.find((p) => p.id === c?.location) || PLACES[0];
  const peers = world.characters.filter((n) => n.location === c?.location);
  const i = peers.findIndex((n) => n.id === id);
  return {
    x: p.door.x + ((i % 3) - 1) * 2.2,
    z:
      p.door.z - (c?.location === "harbor" ? 0 : 2.3) - Math.floor(i / 3) * 1.7,
  };
}
export interface EnvironmentHandle {
  group: THREE.Group;
  colliders: Collider[];
  interactions: Interaction[];
  update: (
    world: World,
    dt: number,
    elapsed: number,
    player: Point,
    quality: Quality,
  ) => void;
  dispose: () => void;
}
export interface ResidentHandle {
  group: THREE.Group;
  interactions: Interaction[];
  update: (
    world: World,
    dt: number,
    elapsed: number,
    player: Point,
    selected?: string,
  ) => void;
  position: (id: string) => Point | undefined;
  dispose: () => void;
}
export interface AvatarHandle {
  group: THREE.Group;
  animate: (
    elapsed: number,
    speed: number,
    carrying?: boolean,
    talking?: boolean,
  ) => void;
}
export function pointAtLocation(id: LocationId): Point {
  const p = PLACES.find((p) => p.id === id)!;
  return { x: p.door.x, z: p.door.z - (id === "harbor" ? 0 : 2) };
}
export function routeBetweenLocations(
  from: LocationId,
  to: LocationId,
): Point[] {
  if (from === to) return [pointAtLocation(to)];
  const a = PLACES.find((p) => p.id === from)!,
    b = PLACES.find((p) => p.id === to)!;
  const az = a.door.z > 3 ? 20 : 0,
    bz = b.door.z > 3 ? 20 : 0;
  return [
    pointAtLocation(from),
    a.door,
    { x: a.door.x, z: az },
    { x: -10, z: az },
    { x: -10, z: bz },
    { x: b.door.x, z: bz },
    b.door,
    pointAtLocation(to),
  ].filter(
    (p, i, all) =>
      !i || Math.hypot(p.x - all[i - 1].x, p.z - all[i - 1].z) > 0.01,
  );
}
