import test from "node:test";
import assert from "node:assert/strict";
import {
  createRegion,
  expeditionGuidance,
  regionCommand,
  regionInteractions,
  regionColliders,
  validateRegion,
} from "../src/region/engine";
import { REGION_SITES as P } from "../src/region/contracts";
import {
  loadRegion,
  saveRegion,
  REGION_SAVE_KEY,
} from "../src/region/persistence";

test("earned expedition guidance survives persisted progress without changing saves or waypoints", (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  t.after(() => {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  let s = createRegion();
  assert.equal(expeditionGuidance(s), null);
  s.wildlife.abilities.tracks = true;
  s.wildlife.creatures[0].bonded = true;
  s.wildlife.creatures[0].discovered = true;
  s.wildlife.companion = "brindlefin";
  s.waypoint = { x: 70, z: 15 };
  const start = structuredClone(s);
  assert.match(expeditionGuidance(s)!, /west/);
  assert.deepEqual(s, start);
  const interact = (id: "clue" | "shortcut" | "ruin" | "home") => {
    s.wildlife.player = { ...P[id] };
    const result = regionCommand(s, { type: "interact", id });
    assert.equal(result.ok, true, result.reason);
    assert.equal(saveRegion(result.state), true);
    const saved = store.get(REGION_SAVE_KEY);
    s = loadRegion();
    assert.deepEqual(s, result.state);
    assert.equal(
      store.get(REGION_SAVE_KEY),
      saved,
      "valid saved contents remain unchanged on load",
    );
    assert.equal(store.has(`${REGION_SAVE_KEY}-corrupt-backup`), false);
    assert.equal(validateRegion(s), true);
    assert.deepEqual(s.waypoint, start.waypoint);
  };
  interact("clue");
  assert.match(expeditionGuidance(s)!, /passage/);
  s.wildlife.companionPosition = { ...P.shortcut };
  interact("shortcut");
  assert.match(expeditionGuidance(s)!, /observatory/);
  assert.equal(
    regionColliders(s).some((c) => c.id === "region-shortcut"),
    false,
  );
  assert.equal(
    regionCommand(s, { type: "interact", id: "shortcut" }).ok,
    false,
  );
  interact("ruin");
  assert.match(expeditionGuidance(s)!, /warehouse/);
  const repeated = regionCommand(s, { type: "interact", id: "ruin" });
  assert.equal(repeated.ok, false);
  assert.match(repeated.reason!, /have the brass lens/);
  const money = s.campaign.money;
  interact("home");
  assert.equal(s.campaign.money, money + 250);
  assert.equal(expeditionGuidance(s), null);
  const again = regionCommand(s, { type: "interact", id: "home" });
  assert.equal(again.ok, false);
  assert.equal(again.state.campaign.money, s.campaign.money);
});

test("passage feedback identifies the missing prerequisite and active companion without consuming progress", () => {
  let s = createRegion();
  s.wildlife.player = { ...P.shortcut };
  const attempt = (pattern: RegExp) => {
    const before = structuredClone(s);
    const result = regionCommand(s, { type: "interact", id: "shortcut" });
    assert.equal(result.ok, false);
    assert.match(result.reason!, pattern);
    assert.deepEqual(s, before);
    assert.equal(result.state.expedition.shortcut, false);
  };
  attempt(/unusual tracks/);
  s.expedition.clue = true;
  attempt(/Choose Brindlefin or Cairnback/);
  s.wildlife.companion = "brindlefin";
  s.wildlife.companionPosition = { ...P.home };
  attempt(/catch up/);
  assert.match(
    regionInteractions(s).find((i) => i.id === "shortcut")!.label,
    /^Brindlefin/,
  );
  s.wildlife.companion = "cairnback";
  assert.match(
    regionInteractions(s).find((i) => i.id === "shortcut")!.label,
    /^Cairnback/,
  );
});
