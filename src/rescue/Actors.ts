import * as THREE from "three";
import { buildAvatar } from "../three/Residents";
import type { RescueState } from "./engine";
import type { Point } from "../three/shared";

const material = (color: string, roughness = 0.58) =>
  new THREE.MeshStandardMaterial({ color, roughness });
function mesh(
  parent: THREE.Object3D,
  g: THREE.BufferGeometry,
  m: THREE.Material,
  p: [number, number, number],
  scale?: [number, number, number],
) {
  const o = new THREE.Mesh(g, m);
  o.position.set(...p);
  if (scale) o.scale.set(...scale);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
/** Original authored articulated storm clothing; no downloaded asset or cosmetic actor motion. */
function stormActor(id: string, color: string) {
  const avatar = buildAvatar(id, color),
    group = avatar.group;
  const body = group.getObjectByName("body")!;
  const head = group.getObjectByName("head")!;
  const shoulders = ["left-shoulder", "right-shoulder"].map((n) =>
    group.getObjectByName(n)!,
  );
  const hips = ["left-hip", "right-hip"].map((n) => group.getObjectByName(n)!);
  const elbows = shoulders.map((s) => s.getObjectByName("elbow")!);
  const knees = hips.map((s) => s.getObjectByName("knee")!);
  const rain = material(color, 0.42),
    rubber = material("#202c31", 0.64),
    reflective = material("#d7dcb3", 0.3);
  const hood = mesh(
    head,
    new THREE.SphereGeometry(0.186, 16, 12, Math.PI * 0.14, Math.PI * 1.72),
    rain,
    [0, 0.025, -0.035],
    [1, 1.18, 0.95],
  );
  // Open front exposes the face. Coat hem and full sleeves create a coherent waterproof silhouette.
  hood.rotation.y = Math.PI / 2;
  mesh(
    body,
    new THREE.CylinderGeometry(0.19, 0.245, 0.29, 16, 1, true),
    rain,
    [0, 0.87, 0],
    [1, 1, 0.73],
  );
  for (let i = 0; i < 2; i++) {
    mesh(
      elbows[i],
      new THREE.CylinderGeometry(0.061, 0.043, 0.225, 10),
      rain,
      [0, -0.108, 0],
    );
    mesh(
      elbows[i],
      new THREE.CylinderGeometry(0.047, 0.047, 0.034, 10),
      reflective,
      [0, -0.208, 0],
    );
    mesh(
      knees[i],
      new THREE.CylinderGeometry(0.071, 0.063, 0.19, 10),
      rubber,
      [0, -0.265, 0],
    );
    mesh(
      knees[i],
      new THREE.SphereGeometry(0.092, 12, 8),
      rubber,
      [0, -0.365, 0.043],
      [0.82, 0.67, 1.5],
    );
    mesh(body, new THREE.BoxGeometry(0.03, 0.36, 0.015), reflective, [
      (i ? 1 : -1) * 0.14,
      1.13,
      0.15,
    ]);
  }
  mesh(
    body,
    new THREE.BoxGeometry(0.42, 0.035, 0.025),
    reflective,
    [0, 1.035, 0.153],
  );
  const hoodCord = material("#b7c3bd");
  for (const side of [-1, 1])
    mesh(body, new THREE.CylinderGeometry(0.009, 0.009, 0.16, 5), hoodCord, [
      side * 0.08,
      1.37,
      0.155,
    ]);
  return {
    avatar,
    group,
    body,
    head,
    shoulders,
    hips,
    elbows,
    knees,
    last: undefined as Point | undefined,
    speed: 0,
  };
}

export function buildRescueActors() {
  const group = new THREE.Group();
  group.name = "storm-rescue-cast";
  const player = stormActor("player", "#c9913f"),
    companion = stormActor("inez", "#c25f3f"),
    victim = stormActor("jo", "#497f83");
  const cast = [player, companion, victim];
  cast.forEach((a) => group.add(a.group));
  player.group.name = "rescue-player";
  companion.group.name = "rescue-inez";
  victim.group.name = "rescue-jo";
  const lever = new THREE.Group();
  lever.name = "inez-rescue-lever";
  lever.position.set(0.12, 0.82, 0.4);
  companion.body.add(lever);
  const leverMetal = material("#728786", 0.3);
  const shaft = mesh(
    lever,
    new THREE.CylinderGeometry(0.022, 0.022, 1.8, 8),
    leverMetal,
    [0, 0, 0.9],
  );
  shaft.rotation.x = Math.PI / 2;
  mesh(lever, new THREE.BoxGeometry(0.08, 0.025, 0.2), leverMetal, [0, 0, 1.8]);
  lever.visible = false;
  companion.group.traverse((o) => (o.userData.rescueTarget = "companion"));
  victim.group.traverse((o) => (o.userData.rescueTarget = "victim"));
  const bench = new THREE.Group();
  group.add(bench);
  bench.visible = false;
  mesh(
    bench,
    new THREE.BoxGeometry(1, 0.11, 0.6),
    material("#7b634e"),
    [0, 0.48, 0],
  );
  for (const x of [-0.38, 0.38])
    mesh(bench, new THREE.BoxGeometry(0.07, 0.45, 0.42), material("#344348"), [
      x,
      0.22,
      0,
    ]);
  let lastSimulationTime: number | undefined;
  return {
    group,
    update(state: RescueState, dt: number, elapsed: number) {
      const rewound =
        lastSimulationTime !== undefined && state.elapsed < lastSimulationTime;
      lastSimulationTime = state.elapsed;
      lever.visible = state.phase === "helping" && state.helping > 0;
      const positions = [state.player, state.companion, state.victim];
      cast.forEach((a, index) => {
        const p = positions[index],
          dx = a.last ? p.x - a.last.x : 0,
          dz = a.last ? p.z - a.last.z : 0;
        const teleported = rewound || Math.hypot(dx, dz) > 2;
        if (teleported) a.speed = 0;
        const speed =
          dt > 0 && !teleported ? Math.min(4, Math.hypot(dx, dz) / dt) : 0;
        a.speed = THREE.MathUtils.damp(a.speed, speed, 12, dt);
        a.group.position.set(p.x, 0, p.z);
        a.last = { ...p };
        const moving = a.speed > 0.08,
          carrying = index === 0 && state.supplies === "carried";
        // Pose layers never leak through recovery, seating, or an interrupted task.
        [
          a.body,
          a.head,
          ...a.shoulders,
          ...a.hips,
          ...a.elbows,
          ...a.knees,
        ].forEach((node) => node.rotation.set(0, 0, 0));
        a.avatar.animate(elapsed, a.speed, carrying);
        const face = moving
          ? Math.atan2(dx, dz)
          : index === 0
            ? a.group.rotation.y
            : Math.atan2(state.player.x - p.x, state.player.z - p.z);
        const delta = Math.atan2(
          Math.sin(face - a.group.rotation.y),
          Math.cos(face - a.group.rotation.y),
        );
        a.group.rotation.y += delta * (1 - Math.exp(-8 * dt));
        a.body.rotation.x = state.phase === "aftermath" ? 0 : 0.075;
        a.body.rotation.z = Math.sin(elapsed * 2.2 + index) * 0.012;
        // Shelter quiet: victim sits only after authoritative physical arrival.
        if (index === 2 && state.rescued) {
          a.group.rotation.y = 0;
          a.body.position.y = -0.43;
          a.hips.forEach((h) => (h.rotation.x = -1.35));
          a.knees.forEach((k) => (k.rotation.x = 1.4));
          a.shoulders.forEach((s) => (s.rotation.x = -0.35));
          a.elbows.forEach((e) => (e.rotation.x = -0.7));
          a.head.rotation.x = 0.16;
          bench.visible = true;
          bench.position.set(p.x, 0, p.z);
          bench.rotation.y = a.group.rotation.y;
        } else if (
          (index === 1 ||
            (index === 0 && Math.hypot(p.x - 24, p.z - 18.3) <= 4)) &&
          state.phase === "helping" &&
          state.helping > 0 &&
          !moving
        ) {
          // Weight shifts, bent knees, and both hands on the beam, with visible effort.
          a.body.position.y = -0.19 + Math.sin(elapsed * 3) * 0.018;
          a.body.rotation.x = 0.42;
          a.hips.forEach((h) => (h.rotation.x = -0.3));
          a.knees.forEach((k) => (k.rotation.x = 0.5));
          a.shoulders.forEach((s) => (s.rotation.x = -1.0));
          a.elbows.forEach((e) => (e.rotation.x = -0.5));
          a.head.rotation.x = -0.2;
          a.group.rotation.y = Math.atan2(24 - p.x, 16 - p.z);
        } else if (index === 2 && !state.rescued) {
          if (moving) {
            a.body.rotation.z += Math.sin(elapsed * 4) * 0.07;
            a.hips[0].rotation.x *= 0.48;
            a.knees[0].rotation.x *= 0.4;
          }
          a.shoulders[0].rotation.x = -0.6;
          a.elbows[0].rotation.x = -1.4;
          a.head.rotation.x = 0.12;
        } else if (!moving && state.phase !== "aftermath" && !carrying) {
          // Bracing protects the face against wind; alternate arm keeps balance.
          a.shoulders[0].rotation.x = -0.9;
          a.elbows[0].rotation.x = -1.35;
          a.shoulders[1].rotation.z = 0.15;
          a.head.rotation.x = 0.12;
        }
      });
      if (!state.rescued) bench.visible = false;
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.clear();
    },
  };
}
