import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaignWorld,
  CAMPAIGN_STATIONS,
  getCampaignActions,
} from "../src/campaign";
import {
  applyAction,
  getCharacterContext,
  getAvailableActions,
} from "../src/engine";
import { physicalLocation, physicalResidentPosition } from "../src/physical";
import { pointAtLocation } from "../src/three/shared";
import { deserializeWorld, serializeWorld } from "../src/persistence";
import type { Action, LocationId, World } from "../src/contracts";
// Engine playthroughs isolate economic choices: fixtures position the player at reachable
// interaction sites. Real pathfinding/camera/timing are separately browser-tested by lead.
function run() {
  let w = createCampaignWorld(),
    sequence = 0;
  const act = (a: Omit<Action, "id">) => {
    const r = applyAction(w, { ...a, id: `play-${sequence++}` });
    assert.equal(r.ok, true, r.message);
    w = r.state;
    return w;
  };
  const place = (location: LocationId) => {
    w.location = location;
    w.spatial!.player = pointAtLocation(location);
  };
  const person = (id: string) => {
    w.location = w.characters.find((c) => c.id === id)!.location;
    w.spatial!.player = physicalResidentPosition(w, id);
  };
  const project = (target: string, station: keyof typeof CAMPAIGN_STATIONS) => {
    w.spatial!.player = { ...CAMPAIGN_STATIONS[station] };
    w.location = physicalLocation(w.spatial!.player);
    act({ kind: "project", target });
  };
  const finishDeliveries = () => {
    let count = 0;
    while (w.spatial!.shipments.some((s) => s.status !== "arrived")) {
      assert.ok(count++ < 80, "shipments must arrive in bounded time");
      act({ kind: "advance", seconds: 5 });
    }
  };
  return {
    get world() {
      return w;
    },
    act,
    place,
    person,
    project,
    finishDeliveries,
  };
}
test("cooperative repair strategy earns shelter and evacuation through real inventory and recruited workers", () => {
  const p = run();
  p.project("inspect_van", "relief-van");
  p.project("repair_van", "relief-van");
  p.person("mara");
  p.act({ kind: "promise", target: "mara" });
  p.act({ kind: "deliver", resource: "medical", amount: 10 });
  assert.equal(p.world.commitments[0].status, "kept");
  p.act({ kind: "recruit", target: "mara" });
  assert.equal(p.world.staff, 2);
  p.project("market_coop", "market-ledger");
  assert.equal(
    p.world.inventory.food,
    0,
    "Eli has staged stock, not teleported it to warehouse",
  );
  p.place("market");
  for (const resource of ["food", "water"] as const) {
    for (const target of ["inez", "mara"])
      p.act({ kind: "dispatch", target, resource, amount: 10 });
    p.finishDeliveries();
  }
  assert.equal(p.world.inventory.food, 20);
  assert.equal(p.world.inventory.water, 20);
  p.project("shelter_cots", "shelter-work");
  const expectedFoodReserve =
    p.world.inventory.food - Math.max(0, 20 - p.world.delivered.food);
  p.project("shelter_stock", "shelter-work");
  p.project("clear_route", "road-debris");
  p.place("harbor");
  for (let i = 0; i < 3; i++) p.act({ kind: "evacuate" });
  assert.ok(
    p.world.hour < 54,
    "prepared strategy must finish before exposed route closes",
  );
  const checkpoint = deserializeWorld(serializeWorld(p.world));
  assert.equal(checkpoint.campaign!.shelter, "stocked");
  while (p.world.hour < 54) p.act({ kind: "wait" });
  p.project("finish_scenario", "shelter-work");
  assert.ok(p.world.outcome!.score >= 90);
  assert.match(p.world.outcome!.summary, /Twenty prepared/);
  assert.ok(p.world.money >= 0);
  assert.equal(
    p.world.inventory.food,
    expectedFoodReserve,
    "Prior donated food reduces the required reserve withdrawal",
  );
});
test("salvage is a viable distinct strategy and neglect has understandable consequences", () => {
  const p = run();
  p.project("inspect_van", "relief-van");
  p.project("salvage_van", "relief-van");
  p.person("mara");
  p.act({ kind: "deliver", resource: "medical", amount: 10 });
  p.act({ kind: "recruit", target: "mara" });
  p.person("inez");
  p.act({ kind: "recruit", target: "inez" });
  p.place("harbor");
  p.act({ kind: "transport" });
  p.place("market");
  p.act({ kind: "buy", resource: "fuel", amount: 10 });
  p.act({ kind: "dispatch", target: "inez", resource: "fuel", amount: 10 });
  p.finishDeliveries();
  p.place("harbor");
  p.act({ kind: "evacuate" });
  assert.equal(p.world.inventory.fuel, 4, "detour burns six real fuel");
  assert.equal(p.world.campaign!.van, "salvaged");
  assert.equal(p.world.campaign!.route, "blocked");
  while (p.world.hour < 54) p.act({ kind: "wait" });
  p.project("finish_scenario", "shelter-work");
  assert.match(p.world.outcome!.summary, /Mercy Clinic stayed supplied/);
  assert.match(p.world.outcome!.summary, /neighbors opening their homes/);
  assert.ok(p.world.outcome!.score < 80);
});
test("a missed promise remains remembered but extra medicine repairs practical cooperation", () => {
  const p = run();
  p.project("inspect_van", "relief-van");
  p.project("salvage_van", "relief-van");
  p.person("mara");
  p.act({ kind: "promise", target: "mara" });
  while (p.world.hour < 24) p.act({ kind: "wait" });
  assert.equal(p.world.commitments[0].status, "broken");
  p.act({ kind: "deliver", resource: "medical", amount: 10 });
  p.act({ kind: "recruit", target: "mara" });
  assert.equal(
    p.world.characters.find((c) => c.id === "mara")!.recruited,
    false,
  );
  p.person("inez");
  p.act({ kind: "recruit", target: "inez" });
  p.place("market");
  p.act({ kind: "buy", resource: "medical", amount: 10 });
  p.act({ kind: "dispatch", target: "inez", resource: "medical", amount: 10 });
  p.finishDeliveries();
  p.place("warehouse");
  p.act({ kind: "load", resource: "medical", amount: 10 });
  p.person("mara");
  p.act({ kind: "deliver", resource: "medical", amount: 10 });
  p.act({ kind: "recruit", target: "mara" });
  assert.equal(
    p.world.characters.find((c) => c.id === "mara")!.recruited,
    true,
  );
  assert.equal(
    p.world.commitments[0].status,
    "broken",
    "restitution must not rewrite history",
  );
  assert.ok(
    getCharacterContext(p.world, "mara").memories.some((m) =>
      m.tags.includes("broken"),
    ),
  );
});
test("exploration and conversations preserve deadlines, work still costs time and offers stay local", () => {
  const p = run();
  p.project("inspect_van", "relief-van");
  const before = p.world.hour;
  p.person("inez");
  for (let i = 0; i < 5; i++)
    p.act({
      kind: "talk",
      target: "inez",
      text: "How should we approach this?",
    });
  assert.equal(p.world.hour, before);
  assert.equal(getCharacterContext(p.world, "sam").availableActions.length, 0);
  p.place("radio");
  assert.equal(getCampaignActions(p.world).length, 0);
  assert.ok(
    !getAvailableActions(p.world, "sam").some((a) => a.kind === "project"),
  );
  p.project("repair_van", "relief-van");
  assert.equal(p.world.hour, before + 4);
});
