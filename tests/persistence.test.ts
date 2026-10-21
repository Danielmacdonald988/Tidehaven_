import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/engine";
import {
  validateWorld,
  serializeWorld,
  deserializeWorld,
  makeCheckpoint,
  branchFrom,
} from "../src/persistence";

test("save/load round trip preserves complete world and memories", () => {
  const world = createWorld(29);
  assert.ok(validateWorld(world));
  assert.deepEqual(deserializeWorld(serializeWorld(world)), world);
});
test("malformed save, negative resources and duplicate action ids are rejected", () => {
  const world = createWorld();
  world.money = -1;
  assert.equal(validateWorld(world), false);
  assert.throws(() =>
    deserializeWorld('{"format":"afterlight","version":1,"world":{}}'),
  );
  assert.throws(() => deserializeWorld("invalid"));
  const other = createWorld();
  other.appliedActions = ["same", "same"];
  assert.equal(validateWorld(other), false);
});
test("branch and checkpoint are independent deep snapshots", () => {
  const world = createWorld();
  const checkpoint = makeCheckpoint(world, "Before the promise");
  const original = JSON.stringify(checkpoint);
  const branch = branchFrom(checkpoint, "Another way");
  branch.initial.money = 0;
  branch.initial.characters[0].memories.push({
    eventId: "x",
    hour: 0,
    text: "A new future",
    tags: [],
  });
  assert.equal(JSON.stringify(checkpoint), original);
  assert.notEqual(world.money, 0);
});

test("session rejects corrupted replay snapshots and inconsistent current world", async () => {
  const { validateSession } = await import("../src/persistence");
  const world = createWorld();
  const checkpoint = makeCheckpoint(world, "Start");
  const timeline = branchFrom(checkpoint, "First response");
  const session = { world, checkpoints: [checkpoint], timeline, archives: [] };
  assert.ok(validateSession(session));
  const damaged = structuredClone(session);
  damaged.timeline.steps.push({
    action: { id: "x", kind: "wait" },
    state: {} as any,
  });
  assert.equal(validateSession(damaged), false);
  session.world.money = 1;
  assert.equal(validateSession(session), false);
});
