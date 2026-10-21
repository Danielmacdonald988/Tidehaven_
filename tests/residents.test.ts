import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildAvatar, buildResidents } from "../src/three/Residents";
import { createWorld } from "../src/engine";
import { residentHome } from "../src/three/shared";
import { emptyInventory } from "../src/scenario";

test("residents have distinct articulated human silhouettes with bounded draw cost", () => {
  const world = createWorld();
  let total = 0;
  for (const c of world.characters) {
    const avatar = buildAvatar(c.id, c.color);
    let meshes = 0;
    avatar.group.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes++;
    });
    total += meshes;
    assert.ok(meshes <= 45, `${c.name}: ${meshes} draw calls`);
    assert.ok(avatar.group.getObjectByName("left-hip"));
    assert.ok(avatar.group.getObjectByName("elbow"));
    assert.ok(avatar.group.getObjectByName("head"));
    const bounds = new THREE.Box3().setFromObject(avatar.group);
    assert.ok(bounds.min.y > -0.03 && bounds.min.y < 0.04);
    assert.ok(bounds.max.y > 1.5 && bounds.max.y < 2.1);
    avatar.animate(0, 0);
    avatar.animate(0.1, 2, true);
    assert.equal(avatar.group.getObjectByName("carried-supply")!.visible, true);
    assert.notEqual(avatar.group.getObjectByName("left-hip")!.rotation.x, 0);
  }
  assert.ok(total < 500, `${total} resident draw calls`);
});

test("twelve interactable residents remain at their real homes without fictional roaming", () => {
  const world = createWorld();
  const residents = buildResidents(world);
  assert.equal(residents.interactions.length, 12);
  for (let i = 0; i < 100; i++)
    residents.update(world, 0.05, i * 0.05, { x: 0, z: 0 });
  for (const c of world.characters) {
    assert.deepEqual(residents.position(c.id), residentHome(world, c.id));
    assert.equal(
      residents.interactions.find((i) => i.id === `person:${c.id}`)!.object!
        .userData.interactionId,
      `person:${c.id}`,
    );
  }
  residents.dispose();
  assert.equal(residents.group.children.length, 0);
});

test("visible delivery follows authoritative shipment positions and carries only actual cargo", () => {
  const world = createWorld();
  const residents = buildResidents(world);
  world.spatial = {
    player: { x: 0, z: 0 },
    staged: emptyInventory(),
    carried: emptyInventory(),
    elapsedSeconds: 0,
    shipments: [
      {
        id: "shipment",
        resource: "food",
        amount: 10,
        workerId: "ada",
        status: "collecting",
        position: { x: -10, z: 0 },
        progress: 0.2,
        route: [
          { x: -22, z: 13 },
          { x: 0, z: -12 },
        ],
        waypoint: 1,
        collectionIndex: 1,
      },
    ],
  };
  residents.update(world, 0.1, 1, { x: 0, z: 0 });
  assert.deepEqual(residents.position("ada"), { x: -10, z: 0 });
  assert.equal(
    residents.group
      .getObjectByName("resident-ada")!
      .getObjectByName("carried-supply")!.visible,
    false,
  );
  world.spatial.shipments[0].status = "carrying";
  world.spatial.shipments[0].position = { x: -10, z: 10 };
  residents.update(world, 0.1, 2, { x: 0, z: 0 });
  assert.deepEqual(residents.position("ada"), { x: -10, z: 10 });
  assert.equal(
    residents.group
      .getObjectByName("resident-ada")!
      .getObjectByName("carried-supply")!.visible,
    true,
  );
  world.spatial.shipments[0].status = "arrived";
  residents.update(world, 0.1, 3, { x: 0, z: 0 });
  assert.equal(
    residents.group
      .getObjectByName("resident-ada")!
      .getObjectByName("carried-supply")!.visible,
    false,
  );
  residents.dispose();
});

test("lathed limbs face outward so clothing does not vanish with back-face culling", () => {
  const avatar = buildAvatar("mara", "#c87867");
  let checked = 0;
  avatar.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.geometry.type !== "LatheGeometry")
      return;
    const p = o.geometry.getAttribute("position"),
      n = o.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      assert.ok(p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i) >= -0.0001);
      checked++;
    }
  });
  assert.ok(checked > 100);
});
