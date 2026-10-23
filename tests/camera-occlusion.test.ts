import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildRegionWorld } from "../src/region/World";
import {
  isForegroundPalm,
  retainOcclusionHits,
} from "../src/region/cameraOcclusion";

test("foreground detection includes actual animated coastal BufferGeometry palms only", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = new Proxy({}, { get: () => () => {} });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    },
  });
  let world: ReturnType<typeof buildRegionWorld>;
  try {
    world = buildRegionWorld();
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
  try {
    const leaves: THREE.Mesh[] = [];
    world.group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        isForegroundPalm(object, world.colliders)
      )
        leaves.push(object);
    });
    assert.equal(
      leaves.length,
      49,
      "seven independently animated leaves on each of seven town palms",
    );
    assert(
      leaves.every((leaf) => !(leaf.geometry instanceof THREE.ShapeGeometry)),
      "regression fixture must use current geometry",
    );
    assert(
      leaves.some(
        (leaf) => leaf.position.x === -30.65 && leaf.position.z === 27,
      ),
      "foreground warehouse palm must be detected",
    );
    const original = leaves[0].position.clone();
    leaves[0].position.y = 3;
    assert(
      !isForegroundPalm(leaves[0], world.colliders),
      "trunks and ground props remain opaque",
    );
    leaves[0].position.copy(original).add(new THREE.Vector3(20, 0, 0));
    assert(
      !isForegroundPalm(leaves[0], world.colliders),
      "unrelated high scenery is not faded",
    );
    leaves[0].position.copy(original);
  } finally {
    world.dispose();
  }
});

test("brief occlusion hold prevents leaf gaps from flickering without leaving scenery faded", () => {
  const holds = new Map<string, number>();
  retainOcclusionHits(holds, new Set(["palm"]), 1);
  retainOcclusionHits(holds, new Set(), 1.15);
  assert(holds.has("palm"));
  retainOcclusionHits(holds, new Set(["palm"]), 1.18);
  retainOcclusionHits(holds, new Set(), 1.3);
  assert(holds.has("palm"));
  retainOcclusionHits(holds, new Set(), 1.4);
  assert.equal(holds.size, 0);
});
