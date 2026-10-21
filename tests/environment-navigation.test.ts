import test from "node:test";
import assert from "node:assert/strict";
import { buildEnvironment } from "../src/three/Environment";
import { PLACES, pointAtLocation, START } from "../src/three/shared";
import { findPath, clearSegment, isWalkable } from "../src/three/navigation";
const context = new Proxy({}, { get: () => () => {} });
(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => context }),
};
test("every featured interior can be reached from every other interior without clipping", () => {
  const e = buildEnvironment();
  const colliders = e.colliders.filter((c) => !c.exposed);
  const points = [
    START,
    ...PLACES.map((p) => pointAtLocation(p.id)),
    { x: -23.6, z: 13.8 },
    { x: -14.7, z: 15.6 },
  ];
  for (const start of points)
    for (const goal of points) {
      if (!isWalkable(start, colliders) || !isWalkable(goal, colliders))
        continue;
      const route = findPath(start, goal, colliders);
      assert.ok(
        route.length,
        `No route ${JSON.stringify(start)} to${JSON.stringify(goal)}`,
      );
      let prev = start;
      for (const point of route) {
        assert.ok(
          clearSegment(prev, point, colliders),
          `Clipping ${JSON.stringify(prev)} to${JSON.stringify(point)} en route from${JSON.stringify(start)} to${JSON.stringify(goal)}`,
        );
        prev = point;
      }
    }
  e.dispose();
});
test("clinic to market route remains collision free during frame-sized steps", () => {
  const environment = buildEnvironment();
  const colliders = environment.colliders.filter((c) => !c.exposed);
  for (const start of [
    { x: 19.8, z: -9 },
    { x: 20.8, z: -7.5 },
  ])
    for (const dt of Array.from({ length: 80 }, (_, i) => (i + 1) / 1000)) {
      let position = { ...start };
      const path = findPath(position, pointAtLocation("market"), colliders);
      assert.ok(path.length, `No route from ${JSON.stringify(start)}`);
      let frames = 0;
      while (path.length) {
        assert.ok(frames++ < 20000);
        let movement = dt * 3.2;
        while (movement > 0 && path.length) {
          const dest = path[0],
            d = Math.hypot(dest.x - position.x, dest.z - position.z);
          if (d < 0.000001) {
            position = { ...dest };
            path.shift();
            continue;
          }
          const n = Math.min(movement, d),
            next =
              n === d
                ? { ...dest }
                : {
                    x: position.x + ((dest.x - position.x) * n) / d,
                    z: position.z + ((dest.z - position.z) * n) / d,
                  };
          assert.ok(
            clearSegment(position, next, colliders),
            `Blocked frame from ${JSON.stringify(position)} to ${JSON.stringify(next)}, dt=${dt}`,
          );
          position = next;
          movement -= n;
          if (n === d) path.shift();
        }
      }
      assert.deepEqual(position, pointAtLocation("market"));
    }
  environment.dispose();
});
