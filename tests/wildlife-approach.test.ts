import test from "node:test";
import assert from "node:assert/strict";
import { findCreatureApproach } from "../src/wildlife/approach";
import { clearSegment, findPath, isWalkable } from "../src/three/navigation";
import { createWildlife, wildlifeColliders } from "../src/wildlife/engine";

test("creature approach finds visible ground beyond actual shop walls and garden entrance", async () => {
  const original = globalThis.document;
  const context = new Proxy(
    {},
    { get: () => () => undefined, set: () => true },
  );
  globalThis.document = {
    createElement: () => ({
      width: 256,
      height: 256,
      getContext: () => context,
    }),
  } as unknown as Document;
  const { buildWildlifeWorld } = await import("../src/wildlife/World");
  const world = buildWildlifeWorld();
  try {
    for (const [player, target, state] of [
      [{ x: 0, z: -12 }, { x: -2, z: -6 }, createWildlife()],
      [
        { x: -34, z: 0 },
        { x: -34, z: -7 },
        {
          ...createWildlife(),
          abilities: { tracks: true, gate: true, light: false },
        },
      ],
    ] as const) {
      const colliders = [...world.colliders, ...wildlifeColliders(state)];
      const approach = findCreatureApproach(player, target, colliders);
      assert(approach, "A real accessible encounter position exists");
      assert(isWalkable(approach, colliders));
      assert(clearSegment(approach, target, colliders));
      assert(findPath(player, approach, colliders).length > 0);
      assert(Math.hypot(approach.x - target.x, approach.z - target.z) > 1.3);
    }
    const closed = [...world.colliders, ...wildlifeColliders(createWildlife())];
    assert.equal(
      findCreatureApproach({ x: -34, z: 0 }, { x: -34, z: -7 }, closed),
      null,
    );
  } finally {
    world.dispose();
    globalThis.document = original;
  }
});
test("approach rejects invalid coordinates and an enclosed unreachable creature", () => {
  assert.equal(
    findCreatureApproach({ x: NaN, z: 0 }, { x: 0, z: 0 }, []),
    null,
  );
  assert.equal(
    findCreatureApproach({ x: 0, z: 0 }, { x: 10, z: 10 }, [
      { minX: 5, maxX: 15, minZ: 5, maxZ: 15 },
    ]),
    null,
  );
});
