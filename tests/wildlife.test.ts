import test from "node:test";
import assert from "node:assert/strict";
import {
  createWildlife,
  wildlifeCommand,
  tickWildlife,
  wildlifeColliders,
  validateWildlife,
  receptive,
} from "../src/wildlife/engine";
import {
  SITES,
  REST_SITES,
  type WildlifeState,
  type WildlifeCommand,
  type SpeciesId,
} from "../src/wildlife/contracts";
import { isWalkable } from "../src/three/navigation";
function command(s: WildlifeState, c: WildlifeCommand) {
  const r = wildlifeCommand(s, c);
  assert.equal(r.ok, true, r.reason);
  return r.state;
}
function tick(s: WildlifeState, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) s = tickWildlife(s, 0.1);
  return s;
}
function bond(s: WildlifeState, id: SpeciesId) {
  const c = s.creatures.find((c) => c.id === id)!;
  s = { ...s, player: { x: c.position.x, z: c.position.z + 3 } };
  s = command(s, { type: "select", id });
  s = command(s, { type: "attention" });
  return command(s, { type: "pulse", id });
}
test("first encounter is visible, physical, bounded and persistent", () => {
  let s = tick(createWildlife(), 1);
  assert(s.creatures[0].discovered);
  assert(!wildlifeCommand(s, { type: "pulse", id: "brindlefin" }).ok);
  s = bond(s, "brindlefin");
  assert.equal(s.companion, "brindlefin");
  assert.equal(s.creatures[0].mood, "bonding");
  const n = s.events.length;
  assert(!wildlifeCommand(s, { type: "pulse", id: "brindlefin" }).ok);
  assert.equal(s.events.length, n);
  const restored = JSON.parse(JSON.stringify(s));
  assert(validateWildlife(restored));
  assert.deepEqual(restored, s);
});
test("movement is collision-safe, dt bounded and immutable", () => {
  let s = createWildlife();
  const before = JSON.stringify(s);
  s = command(s, { type: "move", point: { x: -2, z: 25 } });
  assert.equal(JSON.parse(before).path.length, 0);
  const next = tickWildlife(s, 10);
  assert(
    Math.hypot(next.player.x - s.player.x, next.player.z - s.player.z) <= 0.261,
  );
  const wall = { minX: -10, maxX: -9, minZ: 23, maxZ: 27 };
  for (let i = 0; i < 100; i++) {
    s = tickWildlife(s, 0.1, [wall]);
    assert(isWalkable(s.player, [wall]));
  }
  assert(!wildlifeCommand(s, { type: "move", point: { x: NaN, z: 0 } }).ok);
});
test("alarm is brief, assisted timing forgiving and remote actions forbidden", () => {
  let s = createWildlife();
  s.player = { ...s.creatures[0].position };
  s = tick(s, 0.1);
  assert.equal(s.creatures[0].mood, "alert");
  s.player = { x: -8, z: 29 };
  s = tick(s, 2.2);
  s = command(s, { type: "select", id: "brindlefin" });
  s = command(s, { type: "attention" });
  assert(receptive(s, s.creatures[0]));
  s.player = { x: 30, z: 30 };
  assert(!wildlifeCommand(s, { type: "pulse", id: "brindlefin" }).ok);
  assert(!wildlifeCommand(s, { type: "shell" }).ok);
});
test("three abilities change access and the authored rare chain is reachable", () => {
  let s = bond(createWildlife(), "brindlefin");
  s.player = { ...SITES.tracks };
  s.companionPosition = { ...s.player };
  s = command(s, { type: "ability", target: "tracks" });
  assert(s.abilities.tracks);
  s.player = { ...SITES.shell };
  s = command(s, { type: "shell" });
  s = bond(s, "cairnback");
  s = command(s, { type: "companion", id: "cairnback" });
  s.player = { x: -34, z: 0 };
  s.companionPosition = { x: -34, z: 1 };
  assert(wildlifeColliders(s).some((c) => c.id === "wildlife-garden-gate"));
  s = command(s, { type: "ability", target: "gate" });
  assert(!wildlifeColliders(s).some((c) => c.id === "wildlife-garden-gate"));
  s.player = { ...SITES.bench };
  s = command(s, { type: "weather" });
  assert(s.creatures.find((c) => c.id === "pluvlet")!.available);
  s = bond(s, "pluvlet");
  s = command(s, { type: "companion", id: "pluvlet" });
  s.player = { ...SITES.light };
  s.companionPosition = { ...s.player };
  s = command(s, { type: "ability", target: "light" });
  assert.equal(wildlifeColliders(s).length, 0);
  s.player = { ...SITES.bench };
  s = command(s, { type: "weather" });
  s = bond(s, "glasswhorl");
  s.player = { ...SITES.bench };
  s = command(s, { type: "weather" });
  s.player = { ...SITES.bell };
  s = command(s, { type: "bell" });
  assert(s.rareRevealed);
  s = bond(s, "tempestray");
  assert(s.creatures.find((c) => c.id === "tempestray")!.bonded);
  s.creatures.find((c) => c.id === "sailpip")!.phase = 1;
  s = bond(s, "sailpip");
  assert.equal(s.creatures.filter((c) => c.bonded).length, 6);
  assert(validateWildlife(s));
});
test("abilities require the right bonded companion nearby and cannot duplicate", () => {
  let s = bond(createWildlife(), "brindlefin");
  s.player = { ...SITES.tracks };
  assert(!wildlifeCommand(s, { type: "ability", target: "tracks" }).ok);
  s.companionPosition = { ...s.player };
  assert(!wildlifeCommand(s, { type: "ability", target: "gate" }).ok);
  s = command(s, { type: "ability", target: "tracks" });
  assert(!wildlifeCommand(s, { type: "ability", target: "tracks" }).ok);
});
test("companion navigates around obstacles without teleporting", () => {
  let s = bond(createWildlife(), "brindlefin");
  s = tick(s, 3);
  const wall = { minX: -6, maxX: -5, minZ: 22, maxZ: 29 };
  s = wildlifeCommand(s, { type: "move", point: { x: 0, z: 25 } }, [
    wall,
  ]).state;
  for (let i = 0; i < 240; i++) {
    const old = { ...s.companionPosition };
    s = tickWildlife(s, 0.1, [wall]);
    assert(isWalkable(s.companionPosition, [wall]));
    assert(
      Math.hypot(
        old.x - s.companionPosition.x,
        old.z - s.companionPosition.z,
      ) <= 0.361,
    );
  }
  assert(
    Math.hypot(
      s.player.x - s.companionPosition.x,
      s.player.z - s.companionPosition.z,
    ) < 2,
  );
});
test("save validation rejects malformed and impossible structures", () => {
  const s = createWildlife();
  assert(validateWildlife(s));
  for (const patch of [
    { player: { x: Infinity, z: 1 } },
    { creatures: [] },
    { companion: "tempestray" },
    { weather: "lava" },
    { abilities: {} },
    { events: [{ id: 1, at: 0, kind: "x", detail: {} }] },
    { path: [{ x: 1000, z: 0 }] },
  ])
    assert(!validateWildlife({ ...s, ...patch }));
});
test("identical commands and ticks replay exactly without model calls", () => {
  const run = () => {
    let s = createWildlife();
    s = command(s, { type: "move", point: { x: -8, z: 29 } });
    s = tick(s, 2);
    s = command(s, { type: "select", id: "brindlefin" });
    s = command(s, { type: "attention" });
    s = command(s, { type: "pulse", id: "brindlefin" });
    return tick(s, 3);
  };
  assert.deepEqual(run(), run());
});

test("authored world colliders allow the complete walking exploration chain", async () => {
  // Geometry and navigation integration only: texture drawing is irrelevant here.
  const originalDocument = globalThis.document;
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
    let s = createWildlife();
    const act = (c: WildlifeCommand) => {
      const r = wildlifeCommand(s, c, world.colliders);
      assert(r.ok, r.reason);
      s = r.state;
    };
    const step = (seconds: number) => {
      for (let i = 0; i < seconds * 10; i++)
        s = tickWildlife(s, 0.1, world.colliders);
    };
    const go = (point: { x: number; z: number }) => {
      act({ type: "move", point });
      for (let i = 0; i < 1500 && s.path.length; i++) {
        s = tickWildlife(s, 0.1, world.colliders);
        assert(
          isWalkable(s.player, [...world.colliders, ...wildlifeColliders(s)]),
        );
      }
      assert(
        Math.hypot(s.player.x - point.x, s.player.z - point.z) < 1.5,
        `Cannot reach ${JSON.stringify(point)}; at ${JSON.stringify(s.player)}`,
      );
      step(3);
    };
    const greet = (id: SpeciesId) => {
      act({ type: "select", id });
      act({ type: "attention" });
      act({ type: "pulse", id });
      step(3);
    };
    go({ x: -8, z: 28 });
    greet("brindlefin");
    go(SITES.shell);
    act({ type: "shell" });
    go(SITES.tracks);
    act({ type: "ability", target: "tracks" });
    go({ x: -33, z: 21 });
    greet("cairnback");
    act({ type: "companion", id: "cairnback" });
    go({ x: -34, z: 0 });
    act({ type: "ability", target: "gate" });
    go(SITES.bench);
    while (String(s.weather) !== "rain") act({ type: "weather" });
    go({ x: -34, z: -4 });
    greet("pluvlet");
    act({ type: "companion", id: "pluvlet" });
    go(SITES.light);
    act({ type: "ability", target: "light" });
    go(SITES.bench);
    while (String(s.weather) !== "dusk") act({ type: "weather" });
    go({ x: 12, z: -22 });
    greet("glasswhorl");
    go(SITES.bench);
    while (String(s.weather) !== "storm") act({ type: "weather" });
    go(SITES.bell);
    act({ type: "bell" });
    go({ x: 14, z: 27 });
    greet("tempestray");
    assert(s.creatures.find((c) => c.id === "tempestray")!.bonded);
    go({ x: 0, z: -3 });
    act({ type: "select", id: "sailpip" });
    for (
      let i = 0;
      i < 80 && s.creatures.find((c) => c.id === "sailpip")!.phase % 8 > 3;
      i++
    )
      step(0.1);
    greet("sailpip");
    assert.equal(s.creatures.filter((c) => c.bonded).length, 6);
  } finally {
    world.dispose();
    globalThis.document = originalDocument;
  }
});

test("Sailpip offers a stationary greeting window between physical glides", () => {
  let s = createWildlife();
  const sail = s.creatures.find((c) => c.id === "sailpip")!;
  sail.phase = 1;
  const position = { ...sail.position };
  s = tick(s, 0.5);
  assert.deepEqual(
    s.creatures.find((c) => c.id === "sailpip")!.position,
    position,
  );
  assert.equal(s.creatures.find((c) => c.id === "sailpip")!.mood, "idle");
  s.player = { x: 0, z: -3 };
  s = command(s, { type: "select", id: "sailpip" });
  s.creatures.find((c) => c.id === "sailpip")!.phase = 4;
  assert(!wildlifeCommand(s, { type: "attention" }).ok);
  s = tick(s, 0.5);
  assert.notDeepEqual(
    s.creatures.find((c) => c.id === "sailpip")!.position,
    position,
  );
  s.creatures.find((c) => c.id === "sailpip")!.phase = 1;
  s = command(s, { type: "attention" });
  assert(s.creatures.find((c) => c.id === "sailpip")!.attention);
});
test("local benches allow weather changes and remote requests remain rejected", () => {
  for (const site of REST_SITES) {
    const s = createWildlife();
    s.player = { ...site };
    const next = command(s, { type: "weather" });
    assert.equal(next.weather, "rain");
    assert.equal(next.weatherTime, 0);
  }
  const s = createWildlife();
  s.player = { x: 35, z: 10 };
  assert(!wildlifeCommand(s, { type: "weather" }).ok);
});
