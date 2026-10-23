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

test("earned expedition guidance survives interrupted progress without changing saves or waypoints", () => {
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
    s = JSON.parse(JSON.stringify(result.state));
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
