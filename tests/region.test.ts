import test from "node:test";
import assert from "node:assert/strict";
import {
  createRegion,
  regionCommand,
  tickRegion,
  validateRegion,
  regionColliders,
  trafficPositions,
} from "../src/region/engine";
import { REGION_SITES as P, REGION_BOUNDS } from "../src/region/contracts";
import { findPath, isWalkable } from "../src/three/navigation";
import { createWildlife } from "../src/wildlife/engine";
import {
  saveRegion,
  loadRegion,
  REGION_SAVE_KEY,
} from "../src/region/persistence";
import { buildRegionWorld } from "../src/region/World";
function at(s: ReturnType<typeof createRegion>, p: { x: number; z: number }) {
  s.wildlife.player = { ...p };
  return s;
}
test("region migrates collections without altering legacy state", () => {
  const wildlife = createWildlife();
  wildlife.creatures[0].bonded = true;
  wildlife.creatures[0].discovered = true;
  wildlife.companion = "brindlefin";
  const s = createRegion(wildlife);
  assert.equal(s.wildlife.companion, "brindlefin");
  assert.equal(wildlife.player.x, -12);
  assert.ok(validateRegion(s));
  assert.equal(s.residents.length, 12);
});
test("delivery requires physical loading, parking and handoff; promise and reward occur once", () => {
  let s = createRegion();
  assert.equal(
    regionCommand(s, { type: "acceptDelivery", promise: true }).ok,
    false,
  );
  s = at(s, P.dispatch);
  s = regionCommand(s, { type: "acceptDelivery", promise: true }).state;
  s = at(s, P.cargo);
  assert.equal(regionCommand(s, { type: "interact", id: "cargo" }).ok, false);
  s.vehicle.position = { ...P.cargo };
  s = regionCommand(s, { type: "interact", id: "cargo" }).state;
  assert.equal(s.vehicle.cargo, 8);
  s = at(s, P.home);
  assert.equal(regionCommand(s, { type: "interact", id: "home" }).ok, false);
  s.vehicle.position = { ...P.parking };
  const before = s.campaign.money;
  s = regionCommand(s, { type: "interact", id: "home" }).state;
  assert.equal(s.campaign.money, before + s.delivery.reward);
  assert.equal(s.campaign.inventory.food, 8);
  assert.equal(s.campaign.commitments.at(-1)?.status, "kept");
  assert.equal(s.vehicle.cargo, 0);
  assert.equal(regionCommand(s, { type: "interact", id: "home" }).ok, false);
  assert.ok(validateRegion(s));
});
test("abandoning releases cargo and records broken promise without rewards", () => {
  let s = at(createRegion(), P.dispatch);
  s = regionCommand(s, { type: "acceptDelivery", promise: true }).state;
  const money = s.campaign.money;
  s = regionCommand(s, { type: "abandonDelivery" }).state;
  assert.equal(s.campaign.money, money);
  assert.equal(s.campaign.commitments.at(-1)?.status, "broken");
  assert.equal(regionCommand(s, { type: "acceptDelivery" }).ok, true);
  assert.ok(validateRegion(s));
});
test("companion expedition removes physical blocker and relic rewards only at home", () => {
  let s = at(createRegion(), P.clue);
  s = regionCommand(s, { type: "interact", id: "clue" }).state;
  s = at(s, P.shortcut);
  assert.equal(
    regionCommand(s, { type: "interact", id: "shortcut" }).ok,
    false,
  );
  s.wildlife.creatures[0].bonded = true;
  s.wildlife.creatures[0].discovered = true;
  s.wildlife.companion = "brindlefin";
  s.wildlife.companionPosition = { ...P.shortcut };
  assert.equal(
    regionColliders(s).filter((c) => c.id === "region-shortcut").length,
    1,
  );
  s = regionCommand(s, { type: "interact", id: "shortcut" }).state;
  assert.equal(
    regionColliders(s).filter((c) => c.id === "region-shortcut").length,
    0,
  );
  s = at(s, P.ruin);
  s = regionCommand(s, { type: "interact", id: "ruin" }).state;
  const before = s.campaign.money;
  s = at(s, P.home);
  s = regionCommand(s, { type: "interact", id: "home" }).state;
  assert.equal(s.campaign.money, before + 250);
  assert.equal(regionCommand(s, { type: "interact", id: "home" }).ok, false);
});
test("escort moves the victim to safety before rewarding", () => {
  let s = at(createRegion(), P.rescue);
  s = regionCommand(s, { type: "interact", id: "rescue" }).state;
  const money = s.campaign.money;
  s = at(s, P.safe);
  for (let i = 0; i < 150; i++) s = tickRegion(s, 0.1);
  assert.equal(s.assistance.status, "complete");
  assert.ok(
    Math.hypot(
      s.assistance.position.x - P.safe.x,
      s.assistance.position.z - P.safe.z,
    ) < 4,
  );
  assert.equal(s.campaign.money, money + 180);
  const hour = s.campaign.hour;
  for (let i = 0; i < 100; i++) s = tickRegion(s, 0.1);
  assert.equal(s.campaign.money, money + 180);
  assert.equal(s.campaign.hour, hour);
});
test("actual regional terrain connects all district sites and extended bounds preserve town default", () => {
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
  const world = buildRegionWorld();
  if (previous) Object.defineProperty(globalThis, "document", previous);
  else Reflect.deleteProperty(globalThis, "document");
  const s = createRegion(),
    colliders = [...world.colliders, ...regionColliders(s)];
  assert.equal(isWalkable(P.dispatch, [], 0.38), false);
  assert.equal(isWalkable(P.dispatch, [], 0.38, REGION_BOUNDS), true);
  for (const key of [
    "dispatch",
    "cargo",
    "outpost",
    "clue",
    "rescue",
    "safe",
  ] as const) {
    const path = findPath(P.home, P[key], colliders, REGION_BOUNDS);
    assert.ok(path.length, `reachable ${key}`);
  }
  world.dispose();
});
test("save reload preserves collection, memories, upgrades, vehicle and completed activity", () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
  });
  let s = at(createRegion(), P.upgrade);
  s = regionCommand(s, { type: "interact", id: "upgrade-shelter" }).state;
  s.vehicle.position = { ...P.dispatch };
  assert.ok(saveRegion(s));
  assert.deepEqual(loadRegion(), s);
  const raw = store.get(REGION_SAVE_KEY)!;
  store.set(REGION_SAVE_KEY, "invalid");
  assert.ok(validateRegion(loadRegion()));
  assert.equal(store.get(REGION_SAVE_KEY + "-corrupt-backup"), "invalid");
  store.set(REGION_SAVE_KEY, raw);
  const corrupt = JSON.parse(raw);
  corrupt.vehicle.speed = Infinity;
  assert.equal(validateRegion(corrupt), false);
});
test("walking companion crosses a district boundary physically and save accepts new bounds", () => {
  let s = createRegion();
  s.wildlife.player = { x: -39, z: 20.5 };
  s.wildlife.creatures[0].bonded = true;
  s.wildlife.creatures[0].discovered = true;
  s.wildlife.companion = "brindlefin";
  s.wildlife.companionPosition = { x: -38, z: 20.5 };
  const cmd = regionCommand(s, {
    type: "wildlife",
    command: { type: "move", point: { x: -50, z: 20.5 } },
  });
  assert.ok(cmd.ok);
  s = cmd.state;
  for (let i = 0; i < 90; i++) {
    const old = { ...s.wildlife.companionPosition };
    s = tickRegion(s, 0.1);
    assert.ok(
      Math.hypot(
        s.wildlife.companionPosition.x - old.x,
        s.wildlife.companionPosition.z - old.z,
      ) <= 0.361,
    );
  }
  assert.equal(s.district, "wetlands");
  assert.ok(s.wildlife.companionPosition.x < -45);
  assert.ok(validateRegion(s));
});
test("twelve resident routines are bounded and do not duplicate over repeated simulation", () => {
  let s = createRegion();
  for (let i = 0; i < 3600; i++) s = tickRegion(s, 0.1);
  assert.equal(s.residents.length, 12);
  assert.equal(new Set(s.residents.map((r) => r.id)).size, 12);
  assert.ok(s.residents.some((r) => r.routine > 0));
  assert.equal(s.campaign.events.length, 1);
  assert.ok(validateRegion(s));
});
test("one persistent world: physical driving to harbor, load, drive home, hand off", () => {
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
  const world = buildRegionWorld();
  if (previous) Object.defineProperty(globalThis, "document", previous);
  else Reflect.deleteProperty(globalThis, "document");
  const base = world.colliders;
  let s = createRegion();
  function command(c: Parameters<typeof regionCommand>[1]) {
    const result = regionCommand(s, c, base);
    assert.ok(result.ok, result.reason);
    s = result.state;
  }
  function walk(p: { x: number; z: number }) {
    command({ type: "wildlife", command: { type: "move", point: p } });
    for (let i = 0; i < 1600 && s.wildlife.path.length; i++)
      s = tickRegion(s, 0.1, base);
    assert.ok(
      Math.hypot(s.wildlife.player.x - p.x, s.wildlife.player.z - p.z) < 1.5,
      `walk reached ${JSON.stringify(p)}`,
    );
  }
  function drive(p: { x: number; z: number }) {
    command({ type: "driveTarget", point: p });
    for (let i = 0; i < 2500 && s.vehicle.target; i++)
      s = tickRegion(s, 0.1, base);
    assert.ok(
      Math.hypot(s.vehicle.position.x - p.x, s.vehicle.position.z - p.z) < 4,
      `drive reached ${JSON.stringify(p)}, actual ${JSON.stringify(s.vehicle.position)}`,
    );
    for (let i = 0; i < 60; i++)
      s = tickRegion(s, 0.1, base, { throttle: 0, steer: 0, brake: true });
  }
  walk({ x: -19, z: 18 });
  command({ type: "enter" });
  drive({ x: 72, z: 18 });
  command({ type: "exit" });
  walk(P.dispatch);
  command({ type: "acceptDelivery", promise: true });
  walk(P.cargo);
  command({ type: "interact", id: "cargo" });
  walk({ x: s.vehicle.position.x - 2, z: s.vehicle.position.z });
  command({ type: "enter" });
  drive(P.parking);
  command({ type: "exit" });
  walk(P.home);
  command({ type: "interact", id: "home" });
  assert.equal(s.delivery.status, "complete");
  assert.ok(validateRegion(s));
  world.dispose();
});
test("traffic yields locally, resumes when clear and stays bounded across saves", () => {
  let s = createRegion();
  const p = trafficPositions(s)[0].position;
  s.wildlife.player = { ...p };
  const before = s.trafficTime![0];
  for (let i = 0; i < 30; i++) s = tickRegion(s, 0.1);
  assert.equal(s.trafficTime![0], before);
  assert.deepEqual(trafficPositions(s)[0].position, p);
  s.wildlife.player = { ...P.home };
  for (let i = 0; i < 100; i++) s = tickRegion(s, 0.1);
  assert.ok(s.trafficTime![0] > before);
  assert.ok(
    trafficPositions(s).every((t) => t.position.x >= 44 && t.position.x <= 62),
  );
  assert.ok(validateRegion(s));
});
test("events only update witnesses or a recorded radio recipient", () => {
  let s = at(createRegion(), P.ruin);
  s.expedition.shortcut = true;
  const before = s.campaign.characters.find((c) => c.id === "sam")!.memories
    .length;
  s = regionCommand(s, { type: "interact", id: "ruin" }).state;
  assert.equal(
    s.campaign.characters.find((c) => c.id === "sam")!.memories.length,
    before,
  );
  s = at(s, P.home);
  s = regionCommand(s, { type: "interact", id: "home" }).state;
  assert.equal(
    s.campaign.characters.find((c) => c.id === "sam")!.memories.length,
    before + 1,
  );
  assert.ok(s.events.at(-1)!.facts.some((f) => f.includes("radio")));
});
test("single cross-system timeline: bond, companion expedition, resident promise, freight and return home", () => {
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
  const world = buildRegionWorld();
  if (previous) Object.defineProperty(globalThis, "document", previous);
  else Reflect.deleteProperty(globalThis, "document");
  const base = world.colliders;
  let s = createRegion();
  const step = (seconds: number) => {
    for (let i = 0; i < Math.ceil(seconds * 10); i++)
      s = tickRegion(s, 0.1, base);
  };
  const command = (c: Parameters<typeof regionCommand>[1]) => {
    const r = regionCommand(s, c, base);
    assert.ok(r.ok, `${JSON.stringify(c)}: ${r.reason}`);
    s = r.state;
  };
  const walk = (p: { x: number; z: number }) => {
    command({ type: "wildlife", command: { type: "move", point: p } });
    for (let i = 0; i < 2200 && s.wildlife.path.length; i++)
      s = tickRegion(s, 0.1, base);
    assert.ok(
      Math.hypot(s.wildlife.player.x - p.x, s.wildlife.player.z - p.z) < 1.6,
      `walk ${JSON.stringify(p)}; actual ${JSON.stringify(s.wildlife.player)}`,
    );
    step(2);
  };
  const drive = (p: { x: number; z: number }) => {
    command({ type: "driveTarget", point: p });
    for (let i = 0; i < 3000 && s.vehicle.target; i++)
      s = tickRegion(s, 0.1, base);
    assert.ok(
      Math.hypot(s.vehicle.position.x - p.x, s.vehicle.position.z - p.z) < 4,
      `drive ${JSON.stringify(p)}; actual ${JSON.stringify(s.vehicle.position)}`,
    );
    for (let i = 0; i < 60; i++)
      s = tickRegion(s, 0.1, base, { throttle: 0, steer: 0, brake: true });
  };
  walk({ x: -8, z: 29 });
  command({ type: "wildlife", command: { type: "select", id: "brindlefin" } });
  command({ type: "wildlife", command: { type: "attention" } });
  command({ type: "wildlife", command: { type: "pulse", id: "brindlefin" } });
  step(3);
  assert.equal(s.wildlife.companion, "brindlefin");
  assert.equal(s.wildlife.events.filter((e) => e.kind === "bond").length, 1);
  walk({ x: -19, z: 18 });
  command({ type: "enter" });
  drive({ x: -74, z: 20.5 });
  command({ type: "exit" });
  walk(P.clue);
  command({ type: "interact", id: "clue" });
  walk({ x: -81, z: -2 });
  step(3);
  command({ type: "interact", id: "shortcut" });
  walk(P.ruin);
  command({ type: "interact", id: "ruin" });
  assert.equal(s.expedition.relic, true);
  assert.equal(s.wildlife.companion, "brindlefin");
  assert.ok(s.discovered.includes("wetlands"));
  walk({ x: s.vehicle.position.x - 2, z: s.vehicle.position.z });
  command({ type: "enter" });
  drive({ x: 72, z: 18 });
  command({ type: "exit" });
  walk(P.dispatch);
  command({
    type: "talk",
    id: "inez",
    mode: "demo",
    text: "I can bring those eight crates to our warehouse.",
  });
  command({ type: "acceptDelivery", promise: true });
  walk(P.cargo);
  command({ type: "interact", id: "cargo" });
  walk({ x: s.vehicle.position.x - 2, z: s.vehicle.position.z });
  command({ type: "enter" });
  drive(P.parking);
  command({ type: "exit" });
  walk(P.home);
  command({ type: "interact", id: "home" });
  command({ type: "interact", id: "home" });
  assert.equal(s.delivery.status, "complete");
  assert.equal(s.expedition.complete, true);
  assert.equal(s.vehicle.cargo, 0);
  assert.equal(s.campaign.inventory.food, 8);
  assert.equal(s.campaign.commitments.at(-1)?.status, "kept");
  assert.equal(s.wildlife.creatures.filter((c) => c.bonded).length, 1);
  assert.ok(validateRegion(s));
  const snapshot = JSON.parse(JSON.stringify(s));
  assert.ok(validateRegion(snapshot));
  assert.equal(
    regionCommand(snapshot, { type: "interact", id: "home" }, base).ok,
    false,
  );
  assert.equal(JSON.stringify(snapshot), JSON.stringify(s));
  world.dispose();
});
test("regional conversation retention stays bounded without losing promise evidence or imported memories", () => {
  let s = at(createRegion(), P.dispatch);
  const imported = s.campaign.characters.find((c) => c.id === "inez")!.memories
    .length;
  s = regionCommand(s, { type: "acceptDelivery", promise: true }).state;
  const source = s.campaign.commitments.at(-1)!.eventId;
  s = regionCommand(s, { type: "abandonDelivery" }).state;
  for (let i = 0; i < 420; i++)
    s = regionCommand(s, {
      type: "talk",
      id: "inez",
      mode: "demo",
      text: `Local conversation ${i}`,
    }).state;
  assert.ok(s.campaign.events.length <= 182);
  assert.equal(s.events.length, 180);
  assert.ok(s.campaign.events.some((e) => e.id === source));
  assert.equal(s.campaign.commitments.at(-1)!.status, "broken");
  assert.ok(
    s.campaign.characters.find((c) => c.id === "inez")!.memories.length <=
      imported + 33,
  );
  assert.ok(s.campaign.events.some((e) => e.id === "e1"));
  assert.ok(validateRegion(s));
  const count = s.campaign.events.length;
  for (let i = 0; i < 100; i++)
    s = regionCommand(s, {
      type: "talk",
      id: "inez",
      mode: "demo",
      text: `More local conversation ${i}`,
    }).state;
  assert.equal(s.campaign.events.length, count);
  assert.ok(validateRegion(s));
});
test("regional save rejects completion rollback, forged source ids and duplicate audit ids", () => {
  let s = at(createRegion(), P.dispatch);
  s = regionCommand(s, { type: "acceptDelivery", promise: true }).state;
  s = at(s, P.cargo);
  s.vehicle.position = { ...P.cargo };
  s = regionCommand(s, { type: "interact", id: "cargo" }).state;
  s = at(s, P.home);
  s.vehicle.position = { ...P.parking };
  s = regionCommand(s, { type: "interact", id: "home" }).state;
  assert.ok(validateRegion(s));
  const rollback = structuredClone(s);
  rollback.delivery.status = "available";
  assert.equal(validateRegion(rollback), false);
  const forged = structuredClone(s);
  forged.campaign.commitments[0].eventId = "region-99999";
  assert.equal(validateRegion(forged), false);
  const duplicate = structuredClone(s);
  duplicate.events.push({ ...duplicate.events[0] });
  assert.equal(validateRegion(duplicate), false);
  const rewind = structuredClone(s);
  rewind.nextEvent = 1;
  assert.equal(validateRegion(rewind), false);
});
test("parked truck blocks foot traffic while center-click approaches and boarding still work", () => {
  for (const yaw of [0, Math.PI / 4, Math.PI / 2, 2.3]) {
    let s = createRegion();
    s.vehicle.position = { x: 0, z: 20 };
    s.vehicle.yaw = yaw;
    s.wildlife.player = { x: -6, z: 20 };
    let r = regionCommand(s, {
      type: "wildlife",
      command: { type: "move", point: { x: 6, z: 20 } },
    });
    assert.ok(r.ok);
    s = r.state;
    for (let i = 0; i < 500 && s.wildlife.path.length; i++) {
      s = tickRegion(s, 0.1);
      const p = s.wildlife.player,
        dx = p.x - s.vehicle.position.x,
        dz = p.z - s.vehicle.position.z;
      const across = dx * Math.cos(yaw) - dz * Math.sin(yaw),
        along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      assert.ok(
        Math.abs(across) >= 0.94 || Math.abs(along) >= 2.2,
        "walk never enters truck body",
      );
    }
    assert.ok(s.wildlife.player.x > 5.8);
    r = regionCommand(s, {
      type: "wildlife",
      command: { type: "move", point: s.vehicle.position },
    });
    assert.ok(r.ok);
    s = r.state;
    for (let i = 0; i < 500 && s.wildlife.path.length; i++)
      s = tickRegion(s, 0.1);
    assert.ok(Math.hypot(s.wildlife.player.x, s.wildlife.player.z - 20) <= 3.5);
    r = regionCommand(s, { type: "enter" });
    assert.ok(r.ok, r.reason);
    s = r.state;
    r = regionCommand(s, { type: "exit" });
    assert.ok(r.ok, r.reason);
    s = r.state;
    assert.ok(
      regionCommand(s, { type: "enter" }).ok,
      "safe exit remains in boarding range",
    );
  }
});
test("old save placing explorer inside truck can still board and safely exit", () => {
  let s = createRegion();
  s.wildlife.player = { ...s.vehicle.position };
  assert.ok(validateRegion(s));
  let r = regionCommand(s, { type: "enter" });
  assert.ok(r.ok);
  s = r.state;
  r = regionCommand(s, { type: "exit" });
  assert.ok(r.ok);
  assert.ok(
    Math.hypot(
      r.state.wildlife.player.x - s.vehicle.position.x,
      r.state.wildlife.player.z - s.vehicle.position.z,
    ) > 1.3,
  );
});
test("escorted neighbor stops at a comfortable distance and resumes when the player moves away", () => {
  let s = at(createRegion(), P.rescue);
  const start = regionCommand(s, { type: "interact", id: "rescue" });
  assert.ok(start.ok);
  s = start.state;
  const move = regionCommand(s, {
    type: "wildlife",
    command: { type: "move", point: { x: 91, z: 30 } },
  });
  assert.ok(move.ok);
  s = move.state;
  for (let i = 0; i < 100; i++) s = tickRegion(s, 0.1);
  assert.equal(s.assistance.status, "escorting");
  const gap = Math.hypot(
    s.assistance.position.x - s.wildlife.player.x,
    s.assistance.position.z - s.wildlife.player.z,
  );
  assert.ok(gap >= 1.79 && gap <= 2.01, `comfortable separation, got ${gap}`);
  assert.deepEqual(s.assistance.path, [], "discard stale path into the player");
  const stopped = { ...s.assistance.position };
  for (let i = 0; i < 100; i++) s = tickRegion(s, 0.1);
  assert.deepEqual(
    s.assistance.position,
    stopped,
    "waiting beside the player must not creep into them",
  );
  assert.deepEqual(
    s.residents.find((r) => r.id === "jo")!.position,
    stopped,
    "visible resident agrees with escort state",
  );
  const onward = regionCommand(s, {
    type: "wildlife",
    command: { type: "move", point: { x: 96, z: 30 } },
  });
  assert.ok(onward.ok);
  s = onward.state;
  for (let i = 0; i < 100; i++) s = tickRegion(s, 0.1);
  assert.ok(
    Math.hypot(
      s.assistance.position.x - stopped.x,
      s.assistance.position.z - stopped.z,
    ) > 2,
    "escort follows again after separation grows",
  );
  assert.ok(
    Math.hypot(
      s.assistance.position.x - s.wildlife.player.x,
      s.assistance.position.z - s.wildlife.player.z,
    ) >= 1.79,
  );
});
