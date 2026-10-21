import test from "node:test";
import assert from "node:assert/strict";
import { findPath, clearSegment, isWalkable } from "../src/three/navigation";
test("navigation routes around solid walls without corner clipping", () => {
  const walls = [{ minX: -2, maxX: 2, minZ: -4, maxZ: 4 }];
  const start = { x: -8, z: 0 },
    goal = { x: 8, z: 0 };
  const path = findPath(start, goal, walls);
  assert.ok(path.length > 1);
  let prev = start;
  for (const p of path) {
    assert.ok(isWalkable(p, walls));
    assert.ok(clearSegment(prev, p, walls));
    prev = p;
  }
  assert.deepEqual(path.at(-1), goal);
});
test("click navigation resolves an obstructed target and respects shoreline bounds", () => {
  const wall = [{ minX: 0, maxX: 2, minZ: 0, maxZ: 2 }];
  const path = findPath({ x: -3, z: 1 }, { x: 1, z: 1 }, wall);
  assert.ok(path.length);
  assert.ok(isWalkable(path.at(-1)!, wall));
  assert.equal(isWalkable({ x: 0, z: 40 }, []), false);
});
