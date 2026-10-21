import test from "node:test";
import assert from "node:assert/strict";
import {
  command,
  createRescue,
  tick,
  rescueColliders,
  validateRescueState,
  type RescueState,
} from "../src/rescue/engine";
import { isWalkable, clearSegment } from "../src/three/navigation";
import type { Collider, Point } from "../src/three/shared";
// Radio shell with the same front and east openings as the rescue environment.
const walls: Collider[] = [
  { minX: 19.5, maxX: 19.9, minZ: 5, maxZ: 15 },
  { minX: 19.5, maxX: 28.5, minZ: 5, maxZ: 5.4 },
  { minX: 28.1, maxX: 28.5, minZ: 5, maxZ: 8.8 },
  { minX: 28.1, maxX: 28.5, minZ: 12.2, maxZ: 15 },
  { minX: 19.5, maxX: 22.4, minZ: 14.6, maxZ: 15 },
  { minX: 25.6, maxX: 28.5, minZ: 14.6, maxZ: 15 },
];
function step(s: RescueState, seconds: number) {
  for (let n = 0; n < seconds * 20; n++) s = tick(s, 0.05, walls);
  return s;
}
function act(s: RescueState, c: Parameters<typeof command>[1]) {
  const r = command(s, c, walls);
  assert.equal(r.ok, true, r.reason);
  return r.state;
}
function walk(s: RescueState, p: Point) {
  s = act(s, { type: "move", point: p });
  for (let n = 0; n < 600 && s.path.length; n++) {
    const prior = s;
    s = tick(s, 0.05, walls);
    assert.ok(
      clearSegment(prior.player, s.player, [
        ...walls,
        ...rescueColliders(prior),
      ]),
    );
  }
  assert.ok(Math.hypot(s.player.x - p.x, s.player.z - p.z) < 0.6);
  return s;
}
function start() {
  return step(act(createRescue(), { type: "start" }), 11);
}
test("power failure is recorded once; invalid deltas and duplicate starts cannot advance rescue", () => {
  let s = start();
  assert.equal(s.power, false);
  assert.equal(s.events.filter((e) => e.kind === "blackout").length, 1);
  assert.equal(command(s, { type: "start" }).ok, false);
  assert.equal(tick(s, NaN), s);
  assert.equal(tick(s, -10), s);
  assert.ok(tick(s, 100).elapsed - s.elapsed <= 0.25);
  assert.equal(s.rescued, false);
});
test("live assist requires proximity, actual travel and work before opening passage", () => {
  let s = start();
  assert.equal(command(s, { type: "assist", mode: "live" }, walls).ok, false);
  s = walk(s, { x: 24, z: 19 });
  s = act(s, { type: "assist", mode: "live" });
  assert.equal(s.passage, "blocked");
  s = step(s, 2);
  assert.equal(s.passage, "blocked");
  s = step(s, 20);
  assert.equal(s.passage, "cleared");
  assert.ok(s.helping >= 9);
  assert.equal(rescueColliders(s).length, 0);
  assert.ok(s.events.find((e) => e.kind === "assist")?.detail.includes("live"));
  assert.equal(command(s, { type: "assist" }, walls).ok, false);
});
test("alternate access, physical escort, collapse, supplies and arrival complete independently of beam", () => {
  let s = start();
  s = walk(s, { x: 30, z: 10 });
  s = act(s, { type: "interact", target: "side-door" });
  s = walk(s, { x: 25, z: 10 });
  s = act(s, { type: "interact", target: "supplies" });
  assert.equal(
    command(s, { type: "interact", target: "supplies" }, walls).ok,
    false,
  );
  s = act(s, { type: "interact", target: "victim" });
  assert.equal(s.route, "inside");
  assert.equal(s.passage, "blocked");
  s = walk(s, { x: 31, z: 20 });
  s = step(s, 15);
  assert.equal(s.collapse, 1);
  assert.ok(rescueColliders(s).length);
  s = walk(s, { x: -22, z: 9 });
  assert.equal(s.rescued, false);
  s = step(s, 35);
  assert.equal(s.rescued, true);
  assert.equal(s.supplies, "shelter");
  assert.equal(s.phase, "aftermath");
  assert.ok(Math.hypot(s.victim.x + 22, s.victim.z - 9) <= 2.5);
  assert.ok(isWalkable(s.victim, walls));
});
test("checkpoint recovery is isolated and returns physical progress without corrupting original", () => {
  let s = start();
  s = walk(s, { x: 30, z: 10 });
  s = walk(s, { x: 25, z: 10 });
  s = act(s, { type: "interact", target: "victim" });
  const at = s.checkpoint!.player.x;
  const original = JSON.stringify(s);
  let restored = act(s, { type: "recover" });
  restored.player.x = 0;
  assert.equal(s.checkpoint!.player.x, at);
  assert.equal(JSON.stringify(s), original);
  assert.equal(restored.escortStage, 1);
  assert.equal(restored.rescued, false);
});
test("long-distance rescue and blocked wall interactions cannot invent consequences", () => {
  let s = start();
  assert.equal(
    command(s, { type: "interact", target: "victim" }, walls).ok,
    false,
  );
  s = { ...s, player: { x: 29.2, z: 13 } };
  assert.equal(
    command(s, { type: "interact", target: "supplies" }, walls).ok,
    false,
  );
  assert.equal(
    command(s, { type: "move", point: { x: Infinity, z: 0 } }, walls).ok,
    false,
  );
  assert.equal(s.supplies, "inside");
});

test("both approaches complete through actual rendered environment colliders", async () => {
  const context = new Proxy({}, { get: () => () => {} });
  (globalThis as any).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  };
  const { buildRescueWorld } = await import("../src/rescue/World");
  const env = buildRescueWorld();
  const base = env.colliders;
  for (const approach of ["help", "side"]) {
    let s = command(createRescue(), { type: "start" }, base).state;
    function advance(seconds: number) {
      for (let n = 0; n < seconds * 20; n++) {
        const prev = s;
        s = tick(s, 0.05, base);
        for (const k of ["player", "companion", "victim"] as const)
          assert.ok(
            clearSegment(prev[k], s[k], [...base, ...rescueColliders(prev)]),
            `${approach} ${k} clipped at ${JSON.stringify(prev[k])}`,
          );
      }
    }
    function send(c: Parameters<typeof command>[1]) {
      const r = command(s, c, base);
      assert.ok(r.ok, r.reason);
      s = r.state;
    }
    function go(p: Point) {
      send({ type: "move", point: p });
      for (let n = 0; n < 1000 && s.path.length; n++) advance(0.05);
      assert.ok(
        distanceTo(s.player, p) < 0.5,
        `Unreachable ${JSON.stringify(p)}`,
      );
    }
    advance(11);
    if (approach === "help") {
      go({ x: 24, z: 19 });
      send({ type: "assist", mode: "demo" });
      advance(25);
      assert.equal(s.passage, "cleared");
      go({ x: 24, z: 10 });
    } else {
      go({ x: 30, z: 10 });
      send({ type: "interact", target: "side-door" });
      go({ x: 25, z: 10 });
    }
    send({ type: "interact", target: "supplies" });
    send({ type: "interact", target: "victim" });
    go({ x: 31, z: 20 });
    advance(16);
    assert.equal(s.collapse, 1);
    go({ x: -22, z: 9 });
    advance(40);
    assert.equal(
      s.rescued,
      true,
      `${approach}: Jo stranded at ${JSON.stringify(s.victim)}`,
    );
    assert.equal(s.supplies, "shelter");
  }
  env.dispose();
});
function distanceTo(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test("player accelerates in 180ms independently of frame rate and stops without sliding", () => {
  const moving = act(start(), { type: "move", point: { x: 0, z: 19 } });
  const first = tick(moving, 0.03, walls);
  assert.ok(first.playerSpeed! > 0 && first.playerSpeed! < 3.35);
  assert.ok(distanceTo(first.player, moving.player) < 0.03 * 3.35);
  let fine = moving;
  for (let i = 0; i < 18; i++) fine = tick(fine, 0.01, walls);
  const coarse = tick(moving, 0.18, walls);
  assert.ok(Math.abs(fine.player.x - coarse.player.x) < 1e-8);
  assert.ok(Math.abs(fine.playerSpeed! - 3.35) < 1e-8);
  const arrived = step(moving, 10);
  assert.equal(arrived.path.length, 0);
  assert.equal(arrived.playerSpeed, 0);
  assert.deepEqual(tick(arrived, 0.25, walls).player, arrived.player);
});
test("save validation accepts real checkpoints and rejects corrupt render/navigation data", () => {
  let s = start();
  s = walk(s, { x: 24, z: 19 });
  s = act(s, { type: "assist", mode: "live" });
  s = step(s, 1);
  assert.equal(validateRescueState(JSON.parse(JSON.stringify(s))), true);
  const corrupt: unknown[] = [
    null,
    [],
    {},
    { ...s, player: { x: NaN, z: 0 } },
    { ...s, path: null },
    { ...s, path: [{ x: 3, z: Infinity }] },
    { ...s, companion: { x: 500, z: 0 } },
    { ...s, elapsed: -1 },
    { ...s, phase: "invented" },
    { ...s, escortStage: 1.5 },
    { ...s, playerSpeed: 9 },
    { ...s, collapse: 2 },
    { ...s, rescued: true },
    { ...s, events: [{ id: 1, kind: [], detail: "bad", at: 0 }] },
    { ...s, checkpoint: { ...s, checkpoint: s } },
  ];
  for (const value of corrupt) assert.equal(validateRescueState(value), false);
  const old = { ...s };
  delete old.playerSpeed;
  assert.equal(validateRescueState(old), true);
  const restored = act(s, { type: "recover" });
  assert.equal(restored.phase, "approach");
  assert.equal(restored.assistMode, undefined);
  assert.equal(restored.helping, 0);
  assert.equal(restored.passage, "blocked");
  assert.equal(validateRescueState(restored), true);
});
test("duplicate help and rescue commands cannot restart work or duplicate the emergency case", () => {
  let s = start();
  s = walk(s, { x: 24, z: 19 });
  s = act(s, { type: "assist", mode: "demo" });
  s = step(s, 1);
  const same = command(s, { type: "assist", mode: "live" }, walls);
  assert.equal(same.ok, false);
  assert.equal(same.state, s);
  s = step(s, 20);
  s = walk(s, { x: 25, z: 10 });
  s = act(s, { type: "interact", target: "supplies" });
  s = act(s, { type: "interact", target: "victim" });
  for (const target of ["supplies", "victim"]) {
    const r = command(s, { type: "interact", target }, walls);
    assert.equal(r.ok, false);
    assert.equal(r.state, s);
  }
  assert.equal(s.events.filter((e) => e.kind === "supplies-carried").length, 1);
  assert.equal(s.events.filter((e) => e.kind === "escort-started").length, 1);
  assert.equal(validateRescueState(s), true);
});

test("using the east entrance walks into the room rather than only recording a choice", () => {
  let s = walk(start(), { x: 30, z: 10 });
  s = act(s, { type: "interact", target: "side-door" });
  assert.ok(s.path.length > 0);
  s = step(s, 4);
  assert.ok(s.player.x < 28);
  assert.equal(s.passage, "blocked");
});
