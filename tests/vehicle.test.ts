import test from "node:test";
import assert from "node:assert/strict";
import {
  createVehicle,
  tickVehicle,
  safeExit,
  vehicleFits,
  buildVehicle,
  recoverVehicle,
} from "../src/region/Vehicle";
import type { VehicleState } from "../src/region/contracts";
const neutral = { throttle: 0, steer: 0, brake: false };
test("pickup accelerates, brakes and reverses without invalid speed", () => {
  let v: VehicleState = {
    ...createVehicle(),
    occupied: true,
    position: { x: 0, z: 20.5 },
  };
  for (let i = 0; i < 120; i++)
    v = tickVehicle(v, { ...neutral, throttle: 1 }, 1 / 60, []);
  assert.ok(v.speed > 8 && v.speed <= 12);
  for (let i = 0; i < 60; i++)
    v = tickVehicle(v, { ...neutral, brake: true }, 1 / 60, []);
  assert.equal(v.speed, 0);
  for (let i = 0; i < 60; i++)
    v = tickVehicle(v, { ...neutral, throttle: -1 }, 1 / 60, []);
  assert.ok(v.speed < -3);
});
test("swept body stops at a thin wall even with a large frame delta", () => {
  const wall = { minX: 4, maxX: 4.04, minZ: 15, maxZ: 25 };
  let v: VehicleState = {
    ...createVehicle(),
    occupied: true,
    position: { x: 0, z: 20.5 },
    speed: 12,
  };
  for (let i = 0; i < 6; i++)
    v = tickVehicle(v, { ...neutral, throttle: 1 }, 0.3, [wall]);
  assert.ok(v.position.x <= 1.8);
  assert.ok(vehicleFits(v.position, v.yaw, [wall]));
  assert.equal(v.speed, 0);
});
test("safe exit chooses unobstructed passenger side and refuses enclosed space", () => {
  const v = createVehicle();
  const p = safeExit(v, [{ minX: -22, maxX: -16, minZ: 17, maxZ: 20 }]);
  assert.ok(p && p.z > 20.5);
  assert.equal(
    safeExit(v, [{ minX: -25, maxX: -13, minZ: 15, maxZ: 26 }]),
    null,
  );
});
test("mouse driving follows the coastal road through district turns and stops", () => {
  let v: VehicleState = {
    ...createVehicle(),
    occupied: true,
    target: { x: 94, z: 0 },
  };
  for (let i = 0; i < 3600 && v.target; i++)
    v = tickVehicle(v, neutral, 1 / 60, []);
  assert.ok(
    Math.hypot(v.position.x - 94, v.position.z) < 1.5,
    JSON.stringify(v),
  );
  assert.equal(v.target, null);
  assert.ok(Math.abs(v.speed) < 0.25);
});
test("mouse driving can reverse toward a nearby parking destination", () => {
  let v: VehicleState = {
    ...createVehicle(),
    occupied: true,
    target: { x: -25, z: 20.5 },
  };
  for (let i = 0; i < 1200 && v.target; i++)
    v = tickVehicle(v, neutral, 1 / 60, []);
  assert.ok(
    Math.hypot(v.position.x + 25, v.position.z - 20.5) < 1.5,
    JSON.stringify(v),
  );
});
test("parked vehicle has no autonomous movement and model transforms stay finite", () => {
  const v = createVehicle();
  const n = tickVehicle(
    { ...v, speed: 8, target: { x: 90, z: 0 } },
    neutral,
    0.1,
    [],
  );
  assert.deepEqual(n.position, v.position);
  assert.equal(n.speed, 0);
  const model = buildVehicle();
  model.update({ ...v, occupied: true, cargo: 4 }, 0.016);
  assert.ok(model.group.children.length > 10);
  assert.ok(Number.isFinite(model.group.rotation.x));
  model.dispose();
});
test("pickup reaches all districts against the actual rendered world colliders", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
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
  const { buildRegionWorld } = await import("../src/region/World");
  const world = buildRegionWorld();
  if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
  else Reflect.deleteProperty(globalThis, "document");
  try {
    for (const target of [
      { x: 70, z: 20.5 },
      { x: 98, z: -20 },
      { x: -70, z: 20.5 },
      { x: -97, z: -25 },
      { x: 74, z: 12 },
      { x: -22, z: 15 },
    ]) {
      let v: VehicleState = { ...createVehicle(), occupied: true, target };
      for (let i = 0; i < 10000 && v.target; i++)
        v = tickVehicle(v, neutral, 1 / 60, world.colliders);
      assert.ok(
        Math.hypot(v.position.x - target.x, v.position.z - target.z) < 7,
        `route ${JSON.stringify(target)} stopped ${JSON.stringify(v.position)}`,
      );
      assert.equal(v.impact, 0);
      assert.equal(v.target, null);
    }
  } finally {
    world.dispose();
  }
});

test("local recovery preserves freight and ownership without moving cargo home", () => {
  const v: VehicleState = {
    ...createVehicle(),
    position: { x: 75, z: 14 },
    cargo: 8,
    occupied: true,
    speed: 4,
  };
  const fixed = recoverVehicle(v, []);
  assert.ok(fixed);
  assert.equal(fixed.cargo, 8);
  assert.equal(fixed.owned, v.owned);
  assert.ok(
    Math.hypot(
      fixed.position.x - v.position.x,
      fixed.position.z - v.position.z,
    ) <= 10,
  );
  assert.ok(fixed.position.x > 60);
  assert.equal(fixed.speed, 0);
  assert.equal(recoverVehicle({ ...v, position: { x: 50, z: -30 } }, []), null);
});
test("invalid control values cannot poison persistent physics state", () => {
  const v = tickVehicle(
    { ...createVehicle(), occupied: true },
    { throttle: NaN, steer: Infinity, brake: false },
    0.1,
    [],
  );
  assert.ok(
    Number.isFinite(v.speed) &&
      Number.isFinite(v.yaw) &&
      Number.isFinite(v.position.x),
  );
});
