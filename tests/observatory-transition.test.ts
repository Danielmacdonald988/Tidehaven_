import test from "node:test";
import assert from "node:assert/strict";
import { surfaceHeight, REGION_SITES as S } from "../src/region/contracts";
import { terrainGridHeight } from "../src/region/TerrainRibbon";
import { buildRegionWorld } from "../src/region/World";
import { createRegion, regionCommand, tickRegion } from "../src/region/engine";

const oldHeight = (x: number, z: number) =>
  x < -44 && x > -61 && Math.abs(z - 20.5) < 5
    ? Math.sin(((x + 61) / 17) * Math.PI) * 0.9
    : x < -88 && z < -15
      ? Math.min(2.2, (-z - 15) * 0.16)
      : 0;

test("cliff transition removes the height jump and preserves all terrain outside its strip", () => {
  for (let x = -108; x <= 108; x += 0.125)
    for (let z = -35; z <= 40; z += 0.125) {
      const y = surfaceHeight({ x, z });
      if (x <= -89.5 || x >= -88 || z >= -15) assert.equal(y, oldHeight(x, z));
    }
  for (const z of [-15.001, -16.455, -23, -28.75, -35])
    for (const x of [-89.5, -88])
      assert(
        Math.abs(
          surfaceHeight({ x: x - 1e-6, z }) - surfaceHeight({ x: x + 1e-6, z }),
        ) < 0.00001,
      );
  // Original route crossed a ~23cm instantaneous step at x=-88.
  const z = S.shortcut.z + ((S.ruin.z - S.shortcut.z) * 7) / 11;
  assert(oldHeight(-88 - 1e-6, z) > 0.23);
  assert(surfaceHeight({ x: -88 - 1e-6, z }) < 1e-6);
});

test("actor surface stays within 2mm of ground facets across the transition", () => {
  let maxError = 0;
  for (let ix = 0; ix <= 120; ix++)
    for (let iz = 0; iz <= 1600; iz++) {
      const p = { x: -89.5 + ix / 80, z: -35 + iz / 80 };
      maxError = Math.max(
        maxError,
        Math.abs(surfaceHeight(p) - terrainGridHeight(p)),
      );
    }
  assert(maxError < 0.002, `grid interpolation error ${maxError}`);
});

test("actual region movement traverses the observatory route in both directions", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => new Proxy({}, { get: () => () => {} }),
      }),
    },
  });
  let world: ReturnType<typeof buildRegionWorld>;
  try {
    world = buildRegionWorld();
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
  t.after(() => world.dispose());
  let s = createRegion();
  s.expedition.shortcut = true;
  s.wildlife.player = { ...S.shortcut };
  for (const goal of [S.ruin, S.shortcut]) {
    const result = regionCommand(
      s,
      { type: "wildlife", command: { type: "move", point: goal } },
      world.colliders,
    );
    assert(result.ok, result.reason);
    s = result.state;
    for (let i = 0; i < 2400 && s.wildlife.path.length; i++) {
      const before = surfaceHeight(s.wildlife.player);
      s = tickRegion(s, 1 / 60, world.colliders);
      assert(
        Math.abs(surfaceHeight(s.wildlife.player) - before) < 0.05,
        "no abrupt frame height pop on route",
      );
    }
    assert(
      Math.hypot(s.wildlife.player.x - goal.x, s.wildlife.player.z - goal.z) <
        1.5,
    );
  }
});
