import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhysicalWorld, activateSpatial } from "../src/physical";
import { applyAction, createWorld, replayTimeline } from "../src/engine";
import {
  validateWorld,
  serializeWorld,
  deserializeWorld,
} from "../src/persistence";
import {
  pointAtLocation,
  residentHome,
  routeBetweenLocations,
} from "../src/three/shared";
import type { World, Action, Timeline } from "../src/contracts";
function setup() {
  let w = createPhysicalWorld();
  w.spatial!.player = residentHome(w, "ada");
  w = applyAction(w, { id: "r", kind: "recruit", target: "ada" }).state;
  w.spatial!.player = pointAtLocation("market");
  w.location = "market";
  return w;
}
test("physical purchases stage stock, dispatch reserves one bounded load, arrival credits once", () => {
  let w = setup();
  w = applyAction(w, {
    id: "buy",
    kind: "buy",
    resource: "medical",
    amount: 10,
  }).state;
  assert.equal(w.money, 9200);
  assert.equal(w.inventory.medical, 0);
  assert.equal(w.spatial!.staged.medical, 10);
  w = applyAction(w, {
    id: "dispatch",
    kind: "dispatch",
    target: "ada",
    resource: "medical",
    amount: 10,
  }).state;
  assert.equal(w.spatial!.staged.medical, 0);
  assert.equal(w.inventory.medical, 0);
  assert.equal(
    applyAction(w, {
      id: "dup",
      kind: "dispatch",
      target: "ada",
      resource: "medical",
      amount: 1,
    }).ok,
    false,
  );
  for (let i = 0; i < 30; i++)
    w = applyAction(w, { id: `time${i}`, kind: "advance", seconds: 5 }).state;
  assert.equal(w.inventory.medical, 10);
  assert.equal(w.spatial!.shipments[0].status, "arrived");
  assert.ok(w.events.some((e) => e.kind === "shipment"));
  assert.equal(validateWorld(w), true);
  assert.deepEqual(deserializeWorld(serializeWorld(w)), w);
});
test("movement cannot teleport, cross walls, hear remotely, or enter flooded harbor", () => {
  let w = createPhysicalWorld();
  assert.equal(
    applyAction(w, { id: "tele", kind: "travel", location: "clinic" }).ok,
    false,
  );
  assert.equal(
    applyAction(w, { id: "remote", kind: "talk", target: "mara" }).ok,
    false,
  );
  assert.equal(
    applyAction(w, {
      id: "speed",
      kind: "walk",
      seconds: 1,
      position: { x: 22, z: -10 },
    }).ok,
    false,
  );
  w.spatial!.player = { x: -28, z: 9 };
  assert.equal(
    applyAction(w, {
      id: "wall",
      kind: "walk",
      seconds: 1,
      position: { x: -30, z: 9 },
    }).ok,
    false,
  );
  w.spatial!.player = { x: 5, z: 22 };
  w.hour = 54;
  assert.equal(
    applyAction(w, {
      id: "flood",
      kind: "walk",
      seconds: 1,
      position: { x: 5, z: 24 },
    }).ok,
    false,
  );
  assert.equal(
    applyAction(w, { id: "bad", kind: "advance", seconds: Infinity }).ok,
    false,
  );
});
test("partial shipments save and replay exactly; old saves migrate without losing state", () => {
  let w = setup();
  w = applyAction(w, {
    id: "buy",
    kind: "buy",
    resource: "food",
    amount: 10,
  }).state;
  const t: Timeline = {
    id: "physical",
    name: "test",
    initial: structuredClone(w),
    steps: [],
  };
  for (const a of [
    {
      id: "dispatch",
      kind: "dispatch",
      target: "ada",
      resource: "food",
      amount: 10,
    },
    { id: "step", kind: "advance", seconds: 5 },
  ] as Action[]) {
    const r = applyAction(w, a);
    assert.equal(r.ok, true, r.message);
    w = r.state;
    t.steps.push({ action: a, state: structuredClone(w) });
  }
  assert.ok(w.spatial!.shipments[0].progress > 0);
  assert.equal(w.inventory.food, 0);
  assert.deepEqual(replayTimeline(t), w);
  assert.deepEqual(deserializeWorld(serializeWorld(w)), w);
  const legacy = createWorld();
  const migrated = activateSpatial(legacy);
  assert.equal(migrated.money, legacy.money);
  assert.equal(legacy.spatial, undefined);
  assert.equal(validateWorld(migrated), true);
  const corrupt = structuredClone(w);
  corrupt.spatial!.shipments[0].amount = -1;
  assert.equal(validateWorld(corrupt), false);
});
test("delivery requires an actual carried load and backpack capacity is authoritative", () => {
  let w = createPhysicalWorld();
  w.inventory.medical = 20;
  w.inventory.food = 10;
  w.location = "clinic";
  w.spatial!.player = pointAtLocation("clinic");
  assert.equal(
    applyAction(w, {
      id: "remote",
      kind: "deliver",
      resource: "medical",
      amount: 10,
    }).ok,
    false,
  );
  w.location = "warehouse";
  w.spatial!.player = pointAtLocation("warehouse");
  let r = applyAction(w, {
    id: "load",
    kind: "load",
    resource: "medical",
    amount: 10,
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  assert.equal(w.inventory.medical, 10);
  assert.equal(w.spatial!.carried.medical, 10);
  assert.equal(
    applyAction(w, { id: "over", kind: "load", resource: "food", amount: 1 })
      .ok,
    false,
  );
  w.location = "clinic";
  w.spatial!.player = residentHome(w, "mara");
  w = applyAction(w, { id: "promise", kind: "promise", target: "mara" }).state;
  w.spatial!.player = pointAtLocation("clinic");
  r = applyAction(w, {
    id: "deliver",
    kind: "deliver",
    resource: "medical",
    amount: 10,
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  assert.equal(w.spatial!.carried.medical, 0);
  assert.equal(w.delivered.medical, 10);
  assert.equal(w.commitments[0].status, "kept");
  assert.deepEqual(deserializeWorld(serializeWorld(w)), w);
});
test("earlier spatial save migration adds empty backpack without changing inventory", () => {
  const w = createPhysicalWorld();
  delete (w.spatial as any).carried;
  assert.equal(validateWorld(w), true);
  const migrated = activateSpatial(w);
  assert.deepEqual(migrated.spatial!.carried, {
    food: 0,
    water: 0,
    medical: 0,
    fuel: 0,
  });
  assert.deepEqual(migrated.inventory, w.inventory);
});
test("complete physical medicine loop walks between buildings and keeps the promise", () => {
  let w = createPhysicalWorld();
  let id = 0;
  function act(a: Omit<Action, "id">) {
    const r = applyAction(w, { ...a, id: `loop-${id++}` });
    assert.equal(r.ok, true, r.message);
    w = r.state;
  }
  function walk(points: { x: number; z: number }[]) {
    for (const end of points) {
      let guard = 0;
      while (
        Math.hypot(w.spatial!.player.x - end.x, w.spatial!.player.z - end.z) >
        0.001
      ) {
        assert.ok(guard++ < 200);
        const p = w.spatial!.player,
          d = Math.hypot(end.x - p.x, end.z - p.z),
          f = Math.min(1, 3 / d);
        act({
          kind: "walk",
          seconds: 1,
          position: { x: p.x + (end.x - p.x) * f, z: p.z + (end.z - p.z) * f },
        });
      }
    }
  }
  walk([pointAtLocation("warehouse")]);
  act({ kind: "recruit", target: "ada" });
  walk(routeBetweenLocations("warehouse", "market"));
  act({ kind: "buy", resource: "medical", amount: 10 });
  act({ kind: "dispatch", target: "ada", resource: "medical", amount: 10 });
  walk(routeBetweenLocations("market", "warehouse"));
  while (w.inventory.medical < 10) act({ kind: "advance", seconds: 5 });
  act({ kind: "load", resource: "medical", amount: 10 });
  walk(routeBetweenLocations("warehouse", "clinic"));
  act({ kind: "promise", target: "mara" });
  act({ kind: "deliver", resource: "medical", amount: 10 });
  assert.equal(w.commitments[0].status, "kept");
  assert.equal(w.spatial!.carried.medical, 0);
  assert.equal(w.inventory.medical, 0);
  assert.equal(w.delivered.medical, 10);
});
test("flooded harbor permits shoreward escape but prevents inward movement and reentry", () => {
  let w = createPhysicalWorld();
  w.hour = 54;
  w.location = "harbor";
  w.spatial!.player = { x: 5, z: 27 };
  assert.equal(
    applyAction(w, {
      id: "inward",
      kind: "walk",
      seconds: 1,
      position: { x: 5, z: 28 },
    }).ok,
    false,
  );
  assert.equal(
    applyAction(w, {
      id: "sideways",
      kind: "walk",
      seconds: 1,
      position: { x: 6, z: 27 },
    }).ok,
    false,
  );
  let r = applyAction(w, {
    id: "escape",
    kind: "walk",
    seconds: 1,
    position: { x: 5, z: 24 },
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  r = applyAction(w, {
    id: "shore",
    kind: "walk",
    seconds: 1,
    position: { x: 5, z: 22 },
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  assert.equal(
    applyAction(w, {
      id: "return",
      kind: "walk",
      seconds: 1,
      position: { x: 5, z: 24 },
    }).ok,
    false,
  );
});
