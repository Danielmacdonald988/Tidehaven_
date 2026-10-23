import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildWildlifeWorld } from "../src/wildlife/World";
import { buildCreature } from "../src/wildlife/Creatures";
import { createWildlife, validateWildlife } from "../src/wildlife/engine";
import type { CreatureMood } from "../src/wildlife/contracts";

function world() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = new Proxy({}, { get: () => () => {} });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    },
  });
  try {
    return buildWildlifeWorld();
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
}

function trails(root: THREE.Object3D) {
  return [
    "shore-shell-discovery-trail",
    "companion-shore-shell-trail",
    "brindlefin-revealed-tracks",
  ].map((name) => {
    const mesh = root.getObjectByName(name);
    assert(mesh instanceof THREE.InstancedMesh, name);
    return mesh;
  });
}

test("first ability reveal survives old saves without replaying or changing saved progress", () => {
  const environment = world();
  try {
    const [, clue, tracks] = trails(environment.group);
    const state = createWildlife();
    environment.update(state, 0.016, 0, "high");
    assert.equal(tracks.visible, false);
    assert.equal(clue.visible, false);
    // A legacy save can retain the ability after its event has aged out.
    state.creatures[0].bonded = true;
    state.creatures[0].trust = 1;
    state.companion = "brindlefin";
    environment.update(state, 0.016, 0, "high");
    assert.equal(clue.visible, true);
    state.abilities.tracks = true;
    state.elapsed = 500;
    assert(validateWildlife(state));
    const saved = JSON.stringify(state);
    for (const quality of ["low", "high"] as const) {
      environment.update(state, 0.016, 500, quality);
      assert.equal(tracks.visible, true);
      assert.equal(tracks.count, tracks.instanceMatrix.count);
      assert.equal(clue.visible, false);
      assert.equal(JSON.stringify(state), saved);
    }
  } finally {
    environment.dispose();
  }
});

test("revealing tracks keeps full culling bounds and reuses disposable instance resources", () => {
  const environment = world();
  const meshes = trails(environment.group);
  const tracks = meshes[2];
  const bounds = tracks.boundingBox!.clone();
  const sphere = tracks.boundingSphere!.clone();
  const resources = meshes.map((mesh) => [
    mesh.geometry,
    mesh.material,
    mesh.instanceMatrix,
  ]);
  const disposalCounts = new Map<THREE.EventDispatcher, number>();
  const watched = new Set<THREE.EventDispatcher>();
  for (const mesh of meshes) {
    watched.add(mesh);
    watched.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material])
      watched.add(material);
  }
  for (const resource of watched) {
    disposalCounts.set(resource, 0);
    resource.addEventListener(
      "dispose" as never,
      (() => {
        disposalCounts.set(resource, disposalCounts.get(resource)! + 1);
      }) as never,
    );
  }
  try {
    const state = createWildlife();
    state.abilities.tracks = true;
    state.events = [
      {
        id: 1,
        at: 10,
        kind: "ability",
        species: "brindlefin",
        detail: "Tracks found.",
      },
    ];
    let previousCount = 0;
    for (let frame = 0; frame <= 180; frame++) {
      state.elapsed = 10 + frame / 60;
      const saved = JSON.stringify(state);
      environment.update(
        state,
        1 / 60,
        state.elapsed,
        frame % 2 ? "high" : "low",
      );
      assert.equal(JSON.stringify(state), saved);
      assert(
        tracks.count >= previousCount &&
          tracks.count <= tracks.instanceMatrix.count,
      );
      if (frame === 0) assert(tracks.count < tracks.instanceMatrix.count);
      previousCount = tracks.count;
      assert(tracks.boundingBox!.equals(bounds));
      assert(tracks.boundingSphere!.equals(sphere));
      meshes.forEach((mesh, i) => {
        assert.equal(mesh.geometry, resources[i][0]);
        assert.equal(mesh.material, resources[i][1]);
        assert.equal(mesh.instanceMatrix, resources[i][2]);
        assert(mesh.count <= 100, "small authored trails must remain bounded");
      });
    }
    assert.equal(tracks.count, tracks.instanceMatrix.count);
    // Every instance must be inside the precomputed volume, including the far
    // endpoint hidden during the first reveal frame (a common culling failure).
    const matrix = new THREE.Matrix4();
    const vertex = new THREE.Vector3();
    const positions = tracks.geometry.getAttribute("position");
    for (let instance = 0; instance < tracks.count; instance++) {
      tracks.getMatrixAt(instance, matrix);
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix);
        assert(bounds.clone().expandByScalar(1e-6).containsPoint(vertex));
        assert(vertex.distanceTo(sphere.center) <= sphere.radius + 1e-6);
      }
    }
  } finally {
    environment.dispose();
  }
  for (const count of disposalCounts.values()) assert.equal(count, 1);
});

test("Brindlefin settles out of every greeting without retaining a lifted paw or folded fins", () => {
  const animated = buildCreature("brindlefin");
  const neutral = buildCreature("brindlefin");
  try {
    const moods: CreatureMood[] = ["receptive", "alert", "bonding", "curious"];
    let frame = 0;
    for (const mood of moods) {
      for (let i = 0; i < 60; i++, frame++)
        animated.animate(mood, frame / 60, 0, 0);
      for (let i = 0; i < 240; i++, frame++)
        animated.animate("idle", frame / 60, 0, 0);
      neutral.animate("idle", (frame - 1) / 60, 0, 0);
      const expected: THREE.Object3D[] = [];
      neutral.group.traverse((part) => expected.push(part));
      let index = 0;
      animated.group.traverse((part) => {
        const reference = expected[index++];
        assert(part.position.distanceTo(reference.position) < 1e-7);
        assert(part.quaternion.angleTo(reference.quaternion) < 1e-7);
        assert(part.scale.distanceTo(reference.scale) < 1e-7);
      });
    }
  } finally {
    animated.dispose();
    neutral.dispose();
  }
});
