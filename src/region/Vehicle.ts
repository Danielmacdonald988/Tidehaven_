import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  REGION_BOUNDS,
  REGION_SITES,
  ROAD_ROUTE,
  surfaceHeight,
  type VehicleState,
  type DriveInput,
  type Collider,
  type Point,
} from "./contracts";
const WIDTH = 0.94,
  LENGTH = 2.2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export function createVehicle(): VehicleState {
  return {
    position: { ...REGION_SITES.parking },
    yaw: Math.PI / 2,
    speed: 0,
    steer: 0,
    occupied: false,
    owned: true,
    distance: 0,
    impact: 0,
    cargo: 0,
    target: null,
    lastSafe: { ...REGION_SITES.parking },
  };
}
/** Exact rectangle/AABB separating-axis collision; includes the whole body, not only its centre. */
export function vehicleFits(
  p: Point,
  yaw: number,
  colliders: Collider[],
): boolean {
  const sx = Math.sin(yaw),
    cz = Math.cos(yaw),
    ex = Math.abs(cz) * WIDTH + Math.abs(sx) * LENGTH,
    ez = Math.abs(sx) * WIDTH + Math.abs(cz) * LENGTH;
  if (
    p.x - ex < REGION_BOUNDS.minX ||
    p.x + ex > REGION_BOUNDS.maxX ||
    p.z - ez < REGION_BOUNDS.minZ ||
    p.z + ez > REGION_BOUNDS.maxZ
  )
    return false;
  return !colliders.some((c) => {
    const hx = (c.maxX - c.minX) / 2,
      hz = (c.maxZ - c.minZ) / 2,
      dx = (c.maxX + c.minX) / 2 - p.x,
      dz = (c.maxZ + c.minZ) / 2 - p.z;
    return (
      Math.abs(dx) < hx + ex &&
      Math.abs(dz) < hz + ez &&
      Math.abs(dx * cz - dz * sx) <
        WIDTH + hx * Math.abs(cz) + hz * Math.abs(sx) &&
      Math.abs(dx * sx + dz * cz) <
        LENGTH + hx * Math.abs(sx) + hz * Math.abs(cz)
    );
  });
}
const lengths = ROAD_ROUTE.slice(1).map((p, i) =>
  Math.hypot(p.x - ROAD_ROUTE[i].x, p.z - ROAD_ROUTE[i].z),
);
function roadPoint(s: number): Point {
  for (let i = 0; i < lengths.length; i++) {
    if (s <= lengths[i]) {
      const t = clamp(s / lengths[i], 0, 1);
      return {
        x: ROAD_ROUTE[i].x + (ROAD_ROUTE[i + 1].x - ROAD_ROUTE[i].x) * t,
        z: ROAD_ROUTE[i].z + (ROAD_ROUTE[i + 1].z - ROAD_ROUTE[i].z) * t,
      };
    }
    s -= lengths[i];
  }
  return ROAD_ROUTE.at(-1)!;
}
function roadProjection(p: Point) {
  let at = 0,
    best = { s: 0, d: Infinity };
  for (let i = 0; i < lengths.length; i++) {
    const a = ROAD_ROUTE[i],
      b = ROAD_ROUTE[i + 1],
      t = clamp(
        ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) /
          lengths[i] ** 2,
        0,
        1,
      ),
      d = Math.hypot(p.x - a.x - t * (b.x - a.x), p.z - a.z - t * (b.z - a.z));
    if (d < best.d) best = { s: at + t * lengths[i], d };
    at += lengths[i];
  }
  return best;
}
export function tickVehicle(
  previous: VehicleState,
  input: DriveInput,
  delta: number,
  colliders: Collider[],
): VehicleState {
  const v = {
    ...previous,
    position: { ...previous.position },
    lastSafe: { ...previous.lastSafe },
  };
  const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.1);
  v.impact = Math.max(0, v.impact - dt * 2);
  if (!v.occupied) {
    v.speed = 0;
    v.target = null;
    return v;
  }
  let throttle = clamp(
      Number.isFinite(input.throttle) ? input.throttle : 0,
      -1,
      1,
    ),
    steer = clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1),
    brake = input.brake;
  if (throttle || steer || brake) v.target = null;
  if (v.target) {
    const a = roadProjection(v.position),
      b = roadProjection(v.target),
      immediateStop =
        Math.hypot(v.target.x - v.position.x, v.target.z - v.position.z) < 0.25;
    const parking =
      b.d > 1 && b.d < 9 && !immediateStop ? roadPoint(b.s) : v.target;
    const dist = Math.hypot(parking.x - v.position.x, parking.z - v.position.z);
    let aim = parking;
    if (Math.abs(b.s - a.s) > 5 && dist > 7)
      aim = roadPoint(
        a.s +
          Math.sign(b.s - a.s) *
            (a.d > 4 ? 1 : Math.max(4, Math.abs(v.speed) * 0.8)),
      );
    const difference = angle(
      Math.atan2(aim.x - v.position.x, aim.z - v.position.z) - v.yaw,
    );
    // Reverse gently if a mouse destination is behind the pickup; no instantaneous rotation.
    const reverse = Math.abs(difference) > 2.05;
    const turn = reverse ? angle(difference - Math.PI) : difference;
    steer = clamp(turn * 1.7 * (reverse ? -1 : 1), -1, 1);
    const desired =
      Math.min(
        reverse ? 3.2 : 9,
        Math.max(1.4, dist * 1.3),
        Math.abs(turn) > 0.65 ? 3.2 : 9,
      ) * (reverse ? -1 : 1);
    throttle = clamp((desired - v.speed) * 0.9, -1, 1);
    if (dist < 1.25) {
      brake = true;
      throttle = 0;
      if (Math.abs(v.speed) < 0.25) {
        v.target = null;
        v.speed = 0;
      }
    }
  }
  v.steer += (steer - v.steer) * (1 - Math.exp(-dt * 10));
  const substeps = Math.max(1, Math.ceil(dt / 0.012));
  for (let i = 0; i < substeps; i++) {
    const h = dt / substeps;
    let force = throttle * (throttle * v.speed < 0 ? 12 : 5.8) - v.speed * 0.16;
    if (brake) force = -Math.sign(v.speed) * 18;
    if (!throttle && !brake) force -= Math.sign(v.speed) * 1.6;
    const old = v.speed;
    v.speed = clamp(v.speed + force * h, -4.5, 12);
    if ((brake || !throttle) && old * v.speed < 0) v.speed = 0;
    const yaw =
      v.yaw +
      (((v.steer * 0.52 * v.speed) / 2.7) * h) /
        (1 + Math.abs(v.speed) * 0.035);
    const p = {
      x: v.position.x + Math.sin(yaw) * v.speed * h,
      z: v.position.z + Math.cos(yaw) * v.speed * h,
    };
    if (vehicleFits(p, yaw, colliders)) {
      v.distance += Math.hypot(p.x - v.position.x, p.z - v.position.z);
      v.position = p;
      v.yaw = angle(yaw);
      v.lastSafe = { ...p };
    } else {
      v.impact = Math.max(v.impact, Math.min(1, Math.abs(v.speed) / 8));
      v.speed = 0;
      v.target = null;
      break;
    }
  }
  return v;
}
/** Local roadside recovery never transports goods across districts or grants rewards. */
export function recoverVehicle(
  v: VehicleState,
  colliders: Collider[],
): VehicleState | null {
  const projection = roadProjection(v.position);
  for (const offset of [0, -2, 2, -4, 4, -6, 6]) {
    const p = roadPoint(projection.s + offset);
    if (Math.hypot(p.x - v.position.x, p.z - v.position.z) > 10) continue;
    const a = roadPoint(projection.s + offset - 0.3),
      b = roadPoint(projection.s + offset + 0.3);
    let yaw = Math.atan2(b.x - a.x, b.z - a.z);
    if (Math.abs(angle(yaw - v.yaw)) > Math.PI / 2) yaw = angle(yaw + Math.PI);
    if (vehicleFits(p, yaw, colliders))
      return {
        ...v,
        position: { ...p },
        yaw,
        speed: 0,
        steer: 0,
        target: null,
        impact: 0,
        lastSafe: { ...p },
      };
  }
  return null;
}
export function safeExit(v: VehicleState, colliders: Collider[]): Point | null {
  const s = Math.sin(v.yaw),
    c = Math.cos(v.yaw);
  for (const [side, forward] of [
    [1.6, 0.45],
    [-1.6, 0.45],
    [1.6, -0.8],
    [-1.6, -0.8],
    [0, -3],
    [0, 3],
  ]) {
    const p = {
      x: v.position.x + c * side + s * forward,
      z: v.position.z - s * side + c * forward,
    };
    if (
      p.x < REGION_BOUNDS.minX + 0.4 ||
      p.x > REGION_BOUNDS.maxX - 0.4 ||
      p.z < REGION_BOUNDS.minZ + 0.4 ||
      p.z > REGION_BOUNDS.maxZ - 0.4
    )
      continue;
    if (
      !colliders.some(
        (o) =>
          p.x > o.minX - 0.4 &&
          p.x < o.maxX + 0.4 &&
          p.z > o.minZ - 0.4 &&
          p.z < o.maxZ + 0.4,
      )
    )
      return p;
  }
  return null;
}
export function buildVehicle() {
  const group = new THREE.Group();
  group.userData.regionTarget = "vehicle";
  group.rotation.order = "YXZ";
  const paint = new THREE.MeshStandardMaterial({
      color: "#497e80",
      roughness: 0.38,
      metalness: 0.24,
    }),
    trim = new THREE.MeshStandardMaterial({
      color: "#d8d1af",
      roughness: 0.48,
      metalness: 0.3,
    }),
    rubber = new THREE.MeshStandardMaterial({
      color: "#172326",
      roughness: 0.9,
    }),
    glass = new THREE.MeshStandardMaterial({
      color: "#799eac",
      roughness: 0.16,
      metalness: 0.4,
      transparent: true,
      opacity: 0.48,
    }),
    seat = new THREE.MeshStandardMaterial({ color: "#483e35", roughness: 1 }),
    lamp = new THREE.MeshStandardMaterial({
      color: "#fff1bd",
      emissive: "#ffd68b",
      emissiveIntensity: 0.8,
    }),
    tail = new THREE.MeshStandardMaterial({
      color: "#d76946",
      emissive: "#df3720",
      emissiveIntensity: 0.2,
    });
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
    parent: THREE.Object3D = group,
  ) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  box(1.82, 0.48, 4.25, 0, 0.76, 0, paint);
  box(1.62, 0.16, 3.8, 0, 0.43, 0, rubber);
  // Broad curved bonnet, framed cabin and an open, usable cargo bed.
  box(1.78, 0.32, 1.1, 0, 1.06, 1.48, paint);
  box(1.83, 0.13, 1.8, 0, 2.03, 0.12, trim);
  for (const x of [-0.82, 0.82])
    for (const z of [-0.68, 0.88]) {
      const p = box(0.11, 0.95, 0.12, x, 1.54, z, paint);
      p.rotation.x = z > 0.5 ? -0.16 : 0;
    }
  const wind = box(1.5, 0.72, 0.035, 0, 1.56, 0.94, glass);
  wind.rotation.x = -0.16;
  box(1.5, 0.64, 0.04, 0, 1.59, -0.7, glass);
  for (const x of [-0.85, 0.85]) {
    if (x > 0) {
      box(0.06, 0.57, 1.45, x, 1.1, 0.1, paint);
      box(0.035, 0.57, 1.35, x, 1.67, 0.1, glass);
    }
    box(0.15, 0.17, 0.32, x * 1.18, 1.57, 0.62, trim);
    box(0.05, 0.06, 0.21, x * 1.025, 1.31, -0.27, trim);
    box(0.12, 0.13, 1.5, x * 1.14, 0.55, 0.05, trim);
  }
  for (const x of [-0.43, 0.43]) {
    box(0.58, 0.18, 0.64, x, 1.02, 0.1, seat);
    const back = box(0.58, 0.7, 0.17, x, 1.34, -0.15, seat);
    back.rotation.x = -0.1;
    box(0.3, 0.24, 0.16, x, 1.78, -0.16, seat);
  }
  box(1.62, 0.1, 1.34, 0, 0.96, -1.35, seat);
  for (const x of [-0.85, 0.85]) box(0.14, 0.5, 1.5, x, 1.15, -1.34, paint);
  box(1.8, 0.48, 0.13, 0, 1.15, -2.04, paint);
  box(1.96, 0.19, 0.18, 0, 0.62, 2.15, trim);
  box(1.96, 0.19, 0.18, 0, 0.6, -2.15, trim);
  box(0.82, 0.26, 0.04, 0, 0.94, 2.13, rubber);
  for (const x of [-0.66, 0.66]) {
    box(0.35, 0.24, 0.06, x, 1.02, 2.14, lamp);
    box(0.2, 0.32, 0.06, x, 1.01, -2.13, tail);
  }
  for (let i = 0; i < 5; i++)
    box(0.04, 0.23, 0.045, (i - 2) * 0.14, 0.94, 2.16, trim);
  const wheelPivots: THREE.Group[] = [],
    wheels: THREE.Group[] = [];
  for (const x of [-0.93, 0.93])
    for (const z of [-1.36, 1.36]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.47, z);
      group.add(pivot);
      wheelPivots.push(pivot);
      const wheel = new THREE.Group();
      pivot.add(wheel);
      wheels.push(wheel);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.24, 18),
        rubber,
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheel.add(tire);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.255, 12),
        trim,
      );
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      for (let j = 0; j < 6; j++) {
        const spoke = box(0.265, 0.05, 0.36, 0, 0, 0, trim, wheel);
        spoke.rotation.x = (j * Math.PI) / 3;
      }
    }
  const cargo = new THREE.Group();
  group.add(cargo);
  for (let i = 0; i < 8; i++) {
    const x = i % 2 ? 0.4 : -0.4,
      z = i % 4 < 2 ? -1 : -1.7,
      y = 1.25 + Math.floor(i / 4) * 0.48;
    box(0.65, 0.48, 0.55, x, y, z, trim, cargo);
    box(0.68, 0.05, 0.58, x, y, z, paint, cargo);
    box(0.07, 0.49, 0.57, x, y, z, paint, cargo);
  }
  let wasOccupied = false,
    doorTime = 0;
  const door = new THREE.Group();
  door.position.set(-0.93, 1.05, 0.8);
  group.add(door);
  box(0.065, 0.55, 1.4, 0, 0.1, -0.7, paint, door);
  box(0.035, 0.53, 1.35, 0, 0.66, -0.7, glass, door);
  function batch(parent: THREE.Group) {
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...parent.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
        continue;
      child.updateMatrix();
      const geo = child.geometry.clone().applyMatrix4(child.matrix),
        list = batches.get(child.material) || [];
      list.push(geo);
      batches.set(child.material, list);
      child.geometry.dispose();
      parent.remove(child);
    }
    for (const [material, geos] of batches) {
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (merged) {
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = mesh.receiveShadow = true;
        parent.add(mesh);
      }
    }
  }
  batch(group);
  batch(cargo);
  batch(door);
  wheels.forEach(batch);
  return {
    group,
    update(v: VehicleState, dt: number) {
      group.position.set(v.position.x, surfaceHeight(v.position), v.position.z);
      group.rotation.y = v.yaw;
      const forward = {
          x: v.position.x + Math.sin(v.yaw),
          z: v.position.z + Math.cos(v.yaw),
        },
        backward = {
          x: v.position.x - Math.sin(v.yaw),
          z: v.position.z - Math.cos(v.yaw),
        };
      group.rotation.x = -Math.atan2(
        surfaceHeight(forward) - surfaceHeight(backward),
        2,
      );
      cargo.visible = v.cargo > 0;
      wheels.forEach((w) => (w.rotation.x = v.distance / 0.46));
      wheelPivots.forEach(
        (w, i) => (w.rotation.y = i % 2 === 1 ? v.steer * 0.48 : 0),
      );
      tail.emissiveIntensity =
        v.occupied && Math.abs(v.speed) < 0.5 ? 0.8 : 0.2;
      if (v.occupied !== wasOccupied) {
        doorTime = 1;
        wasOccupied = v.occupied;
      }
      doorTime = Math.max(0, doorTime - dt);
      door.rotation.y = -Math.sin(doorTime * Math.PI) * 0.8;
    },
    dispose() {
      const gs = new Set<THREE.BufferGeometry>(),
        ms = new Set<THREE.Material>();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          gs.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            ms.add(m),
          );
        }
      });
      gs.forEach((g) => g.dispose());
      ms.forEach((m) => m.dispose());
    },
  };
}
