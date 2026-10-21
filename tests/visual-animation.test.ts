import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildAvatar } from "../src/three/Residents";
import { buildCreature } from "../src/wildlife/Creatures";
import { SPECIES, type CreatureMood } from "../src/wildlife/contracts";
import { buildVehicle, createVehicle } from "../src/region/Vehicle";

function resources(root: THREE.Object3D) {
  const objects: string[] = [],
    geometries = new Set<string>(),
    materials = new Set<string>();
  root.traverse((o) => {
    objects.push(o.uuid);
    if (o instanceof THREE.Mesh) {
      geometries.add(o.geometry.uuid);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m.uuid);
    }
    assert.ok(
      [
        ...o.position.toArray(),
        ...o.quaternion.toArray(),
        ...o.scale.toArray(),
      ].every(Number.isFinite),
      `${o.name} transform must remain finite`,
    );
  });
  return {
    objects,
    geometries: [...geometries].sort(),
    materials: [...materials].sort(),
  };
}
test("all creature animation states retain bounded scene resources and authoritative position", () => {
  const moods: CreatureMood[] = [
    "idle",
    "curious",
    "receptive",
    "bonding",
    "companion",
    "alert",
  ];
  for (const species of SPECIES) {
    const rig = buildCreature(species.id, 2);
    rig.group.position.set(17, 2, -6);
    const before = resources(rig.group);
    for (let frame = 0; frame < 900; frame++)
      rig.animate(
        moods[Math.floor(frame / 150)],
        frame / 60,
        frame % 120 < 60 ? 0 : 2.8,
        0.3,
      );
    assert.deepEqual(
      resources(rig.group),
      before,
      species.id + " must not allocate scene resources while animating",
    );
    assert.deepEqual(rig.group.position.toArray(), [17, 2, -6]);
    rig.dispose();
  }
});
test("avatar walk, idle, carrying and talking reuse geometry without moving simulation root", () => {
  const rig = buildAvatar("player", "#cba974");
  rig.group.position.set(-4, 0, 10);
  const before = resources(rig.group);
  for (let frame = 0; frame < 900; frame++)
    rig.animate(
      frame / 60,
      frame % 120 < 60 ? 0 : 2.8,
      frame % 90 < 45,
      frame % 200 < 100,
    );
  assert.deepEqual(resources(rig.group), before);
  assert.deepEqual(rig.group.position.toArray(), [-4, 0, 10]);
});
test("pickup driving, entry and cargo visibility do not grow GPU resources", () => {
  const rig = buildVehicle();
  const state = createVehicle();
  const before = resources(rig.group);
  for (let frame = 0; frame < 1200; frame++)
    rig.update(
      {
        ...state,
        occupied: frame % 240 < 120,
        cargo: frame % 600 < 300 ? 8 : 0,
        speed: Math.sin(frame / 70) * 9,
        steer: Math.sin(frame / 90),
        position: { x: frame / 60 - 10, z: 20.5 },
      },
      1 / 60,
    );
  assert.deepEqual(resources(rig.group), before);
  rig.dispose();
});
