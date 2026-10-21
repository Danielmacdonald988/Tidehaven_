import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaignWorld,
  getCampaignActions,
  CAMPAIGN_STATIONS,
} from "../src/campaign";
import {
  applyAction,
  evaluateOutcome,
  replayTimeline,
  getCharacterContext,
} from "../src/engine";
import { physicalLocation, physicalResidentPosition } from "../src/physical";
import { pointAtLocation } from "../src/three/shared";
import {
  serializeWorld,
  deserializeWorld,
  validateWorld,
  makeCheckpoint,
  branchFrom,
} from "../src/persistence";
import type { World, Action, Timeline } from "../src/contracts";
function at(w: World, station: keyof typeof CAMPAIGN_STATIONS) {
  const n = structuredClone(w);
  n.spatial!.player = { ...CAMPAIGN_STATIONS[station] };
  n.location = physicalLocation(n.spatial!.player);
  return n;
}
function act(w: World, target: string) {
  const r = applyAction(w, { id: `test-${target}`, kind: "project", target });
  assert.equal(r.ok, true, r.message);
  return r.state;
}
function repair() {
  let w = createCampaignWorld();
  w = act(w, "inspect_van");
  return act(w, "repair_van");
}
function recruit(w: World, id: string) {
  w.characters.find((c) => c.id === id)!.recruited = true;
  w.staff = w.characters.filter((c) => c.recruited).length;
}
test("opening gives mutually exclusive real cargo recovery; duplicate and invented projects cannot mint supplies", () => {
  let w = createCampaignWorld();
  assert.deepEqual(
    getCampaignActions(w).map((a) => a.target),
    ["inspect_van"],
  );
  assert.equal(
    applyAction(w, { id: "bad", kind: "project", target: "repair_van" }).ok,
    false,
  );
  w = act(w, "inspect_van");
  w = act(w, "repair_van");
  assert.equal(w.money, 9200);
  assert.equal(w.transport, 12);
  assert.equal(w.staff, 1);
  assert.equal(w.spatial!.carried.medical, 10);
  assert.equal(w.inventory.fuel, 12);
  for (const target of ["repair_van", "salvage_van", "invent_free_supplies"])
    assert.equal(
      applyAction(w, { id: "different-" + target, kind: "project", target }).ok,
      false,
    );
  assert.equal(
    w.characters.find((c) => c.id === "inez")!.memories.at(-1)!.eventId,
    w.events.at(-1)!.id,
  );
  assert.equal(validateWorld(w), true);
});
test("salvage keeps medicine but sacrifices free transport; malformed/full carry remains unchanged", () => {
  let w = act(createCampaignWorld(), "inspect_van");
  w.spatial!.carried.water = 1;
  const original = structuredClone(w);
  assert.equal(
    applyAction(w, { id: "full", kind: "project", target: "salvage_van" }).ok,
    false,
  );
  assert.deepEqual(w, original);
  w.spatial!.carried.water = 0;
  w = act(w, "salvage_van");
  assert.equal(w.money, 10000);
  assert.equal(w.hour, 1);
  assert.equal(w.transport, 0);
  assert.equal(w.spatial!.carried.medical, 10);
});
test("trade and cooperation debit actual finite market inventory and give distinct relationship outcomes", () => {
  const start = at(repair(), "market-ledger");
  assert.equal(
    applyAction(start, {
      id: "premature",
      kind: "project",
      target: "market_coop",
    }).ok,
    false,
  );
  const traded = act(start, "market_trade");
  assert.equal(traded.inventory.fuel, 8);
  assert.equal(traded.spatial!.staged.food, 20);
  assert.equal(
    traded.characters.find((c) => c.id === "eli")!.inventory.food,
    start.characters.find((c) => c.id === "eli")!.inventory.food - 20,
  );
  start.delivered.medical = 10;
  const shared = act(start, "market_coop");
  assert.equal(shared.inventory.fuel, 12);
  assert.equal(
    shared.characters.find((c) => c.id === "eli")!.trust,
    traded.characters.find((c) => c.id === "eli")!.trust + 10,
  );
  assert.equal(
    applyAction(shared, {
      id: "double",
      kind: "project",
      target: "market_trade",
    }).ok,
    false,
  );
});
test("shelter runs require real stock; solo and crew strategies consume identical supplies but different time", () => {
  let w = at(repair(), "shelter-work");
  w = act(w, "shelter_cots");
  assert.equal(
    applyAction(w, {
      id: "empty",
      kind: "project",
      target: "shelter_stock_solo",
    }).ok,
    false,
  );
  w.inventory.food = 20;
  w.inventory.water = 20;
  assert.equal(
    applyAction(w, {
      id: "not-enough-crew",
      kind: "project",
      target: "shelter_stock",
    }).ok,
    false,
  );
  const solo = act(w, "shelter_stock_solo");
  recruit(w, "sam");
  const crew = act(w, "shelter_stock");
  assert.equal(solo.hour - crew.hour, 4);
  assert.equal(solo.inventory.food, w.delivered.food);
  assert.equal(solo.delivered.water, 20);
  assert.equal(solo.campaign!.shelter, "stocked");
  assert.equal(
    applyAction(solo, {
      id: "again",
      kind: "project",
      target: "shelter_stock_solo",
    }).ok,
    false,
  );
});
test("uncleared road is an explicit slower, fuel-costlier alternative instead of a forced quest", () => {
  let w = repair();
  recruit(w, "sam");
  const cleared = act(at(w, "road-debris"), "clear_route");
  const go = (state: World) => {
    state = structuredClone(state);
    state.location = "harbor";
    state.spatial!.player = pointAtLocation("harbor");
    const result = applyAction(state, { id: "evac", kind: "evacuate" });
    assert.equal(result.ok, true, result.message);
    return result.state;
  };
  const detour = go(w),
    direct = go(cleared);
  assert.equal(detour.evacuated, direct.evacuated);
  assert.equal(detour.inventory.fuel, direct.inventory.fuel - 2);
  assert.equal(detour.hour - w.hour, 6);
  assert.equal(direct.hour - cleared.hour, 4);
  assert.ok(
    detour.events.some((e) => e.constraints.some((c) => c.includes("detour"))),
  );
});
test("paused exploration moves without consuming deadline, completing shipment or altering RNG", () => {
  let w = createCampaignWorld();
  w.hour = 23.9;
  const seed = w.rng;
  const r = applyAction(w, {
    id: "paused",
    kind: "walk",
    seconds: 1,
    position: { x: -12, z: 18 },
    clockPaused: true,
  });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.hour, 23.9);
  assert.equal(r.state.rng, seed);
  assert.equal(r.state.spatial!.elapsedSeconds, 0);
  assert.equal(r.state.spatial!.player.x, -12);
  const active = applyAction(r.state, {
    id: "active",
    kind: "advance",
    seconds: 2,
  });
  assert.equal(active.ok, true);
  assert.equal(active.state.hour, 24);
  assert.equal(
    applyAction(w, {
      id: "cheat",
      kind: "project",
      target: "inspect_van",
      clockPaused: true,
    }).ok,
    false,
  );
});
test("campaign save, exact replay and new branch preserve source; malformed campaign rejected", () => {
  const initial = createCampaignWorld();
  const timeline: Timeline = { id: "t", name: "repair", initial, steps: [] };
  let state = initial;
  for (const target of ["inspect_van", "repair_van"]) {
    const action: Action = { id: target, kind: "project", target };
    state = applyAction(state, action).state;
    timeline.steps.push({ action, state });
  }
  assert.deepEqual(replayTimeline(timeline), state);
  assert.deepEqual(deserializeWorld(serializeWorld(state)), state);
  const cp = makeCheckpoint(timeline.steps[0].state, "choice");
  const branch = branchFrom(cp, "salvage");
  const different = act(branch.initial, "salvage_van");
  assert.equal(different.campaign!.van, "salvaged");
  assert.equal(state.campaign!.van, "repaired");
  assert.equal(cp.state.campaign!.van, "stranded");
  const bad = structuredClone(state);
  (bad.campaign as any).van = "infinite";
  assert.equal(validateWorld(bad), false);
});
test("aftermath explains imperfect success and allows paused inspection but rejects economic mutation", () => {
  let w = at(repair(), "shelter-work");
  w.hour = 54;
  w.delivered.medical = 10;
  w = act(w, "finish_scenario");
  assert.equal(w.hour, 72);
  assert.equal(w.ended, true);
  assert.match(w.outcome!.summary, /Mercy Clinic stayed supplied/);
  assert.match(w.outcome!.summary, /neighbors opening their homes/);
  assert.equal(
    applyAction(w, { id: "late", kind: "project", target: "shelter_cots" }).ok,
    false,
  );
  const r = applyAction(w, {
    id: "look",
    kind: "walk",
    seconds: 1,
    clockPaused: true,
    position: { x: -22, z: -13 },
  });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.hour, 72);
  const complete = structuredClone(w);
  complete.campaign!.shelter = "stocked";
  complete.campaign!.cooperation = "shared";
  complete.evacuated = 36;
  assert.ok(evaluateOutcome(complete).score > w.outcome!.score);
});

test("working through time completes real cargo and excludes busy helpers from simultaneous work", () => {
  let w = repair();
  w.location = "warehouse";
  w.spatial!.player = pointAtLocation("warehouse");
  w.spatial!.staged.food = 10;
  let r = applyAction(w, {
    id: "dispatch-inez",
    kind: "dispatch",
    target: "inez",
    resource: "food",
    amount: 10,
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  const blocked = applyAction(at(w, "shelter-work"), {
    id: "busy",
    kind: "project",
    target: "shelter_cots",
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /helper/);
  const frozen = applyAction(w, {
    id: "explore",
    kind: "advance",
    seconds: 5,
    clockPaused: true,
  });
  assert.equal(frozen.ok, true);
  assert.equal(frozen.state.spatial!.shipments[0].progress, 0);
  r = applyAction(w, { id: "wait", kind: "wait" });
  assert.equal(r.ok, true);
  w = r.state;
  assert.equal(w.spatial!.shipments[0].status, "arrived");
  assert.equal(w.inventory.food, 10);
  assert.equal(w.spatial!.staged.food, 0);
  assert.ok(w.events.some((e) => e.kind === "shipment"));
  assert.ok(
    w.characters
      .find((c) => c.id === "inez")!
      .memories.some((m) => m.tags.includes("shipment")),
  );
});

test("conversation costs no campaign deadline and low trust changes repair terms without blocking salvage", () => {
  let w = act(createCampaignWorld(), "inspect_van");
  w.characters.find((c) => c.id === "inez")!.trust = 20;
  assert.equal(
    applyAction(w, { id: "untrusted", kind: "project", target: "repair_van" })
      .ok,
    false,
  );
  assert.ok(getCampaignActions(w).some((a) => a.target === "salvage_van"));
  w = repair();
  w.location = "warehouse";
  w.spatial!.player = pointAtLocation("warehouse");
  const before = w.hour;
  const r = applyAction(w, {
    id: "conversation",
    kind: "talk",
    target: "inez",
    text: "Thank you for repairing the van.",
  });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.hour, before);
});

test("Inez can discuss and propose work beside the stranded van, with real speaking-distance limits", () => {
  let w = createCampaignWorld();
  let r = applyAction(w, {
    id: "van-talk",
    kind: "talk",
    target: "inez",
    text: "What happened to the axle?",
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  w = act(w, "inspect_van");
  assert.ok(
    getCharacterContext(w, "inez").availableActions.some(
      (a) => a.kind === "project" && a.target === "repair_van",
    ),
  );
  const far = structuredClone(w);
  far.spatial!.player = { x: -11, z: 18 };
  assert.equal(
    applyAction(far, {
      id: "distant-talk",
      kind: "talk",
      target: "inez",
      text: "Across the street",
    }).ok,
    false,
  );
  w = act(w, "repair_van");
  assert.equal(w.campaign!.van, "repaired");
});

test("Eli learns clinic progress through an explicitly recorded receipt rather than remote hearing", () => {
  let w = at(repair(), "market-ledger");
  w.delivered.medical = 10;
  assert.equal(
    w.characters
      .find((c) => c.id === "eli")!
      .knowledge.some((k) => k.includes("clinic receipt")),
    false,
  );
  w = act(w, "market_coop");
  assert.ok(
    w.characters
      .find((c) => c.id === "eli")!
      .knowledge.some((k) => k.includes("clinic receipt: 10")),
  );
  assert.ok(
    w.events.some(
      (e) =>
        e.action?.target === "market_coop" &&
        e.facts.includes("Verified clinic receipt: delivered.medical = 10"),
    ),
  );
});

test("central residents retain medicine and trust boundaries when recruited directly", () => {
  for (const id of ["mara", "luis", "eli"]) {
    const w = createCampaignWorld();
    const c = w.characters.find((c) => c.id === id)!;
    w.location = c.location;
    w.spatial!.player = physicalResidentPosition(w, id);
    const r = applyAction(w, { id: `ask-${id}`, kind: "recruit", target: id });
    assert.equal(r.ok, true, r.message);
    assert.equal(r.state.characters.find((c) => c.id === id)!.recruited, false);
    assert.equal(r.state.staff, 0);
    assert.match(r.message, /10 medical/);
  }
  const w = createCampaignWorld();
  w.characters.find((c) => c.id === "inez")!.trust = 20;
  const r = applyAction(w, {
    id: "trust-boundary",
    kind: "recruit",
    target: "inez",
  });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.staff, 0);
  assert.match(r.message, /Trust/);
});

test("campaign warnings describe actual harbor closure while legacy rules stay separate", () => {
  const w = createCampaignWorld();
  w.hour = 39;
  const r = applyAction(w, { id: "warning", kind: "wait" });
  assert.equal(r.ok, true);
  const warning = r.state.events.find(
    (e) => e.title === "The last reliable road",
  )!;
  assert.match(warning.description, /closes at hour 54/);
  assert.doesNotMatch(warning.description, /doubles/);
});

test("hand-carried aid completes prepared shelter without a duplicate stock project", () => {
  let w = at(repair(), "shelter-work");
  w = act(w, "shelter_cots");
  w.location = "heights";
  w.spatial!.player = pointAtLocation("heights");
  for (const resource of ["food", "water", "water"] as const) {
    w.spatial!.carried[resource] = 10;
    const r = applyAction(w, {
      id: `hand-${resource}-${w.hour}`,
      kind: "deliver",
      resource,
      amount: 10,
    });
    assert.equal(r.ok, true, r.message);
    w = r.state;
  }
  assert.equal(w.campaign!.shelter, "stocked");
  assert.ok(w.events.some((e) => e.title === "Many hands fill the shelter"));
  assert.equal(w.inventory.food, 0);
  assert.equal(w.inventory.water, 0);
  assert.equal(
    getCampaignActions(at(w, "shelter-work")).some((a) =>
      a.target?.startsWith("shelter_stock"),
    ),
    false,
  );
});

test("organized shelter run charges only supplies still missing after earlier aid", () => {
  let w = at(repair(), "shelter-work");
  w = act(w, "shelter_cots");
  w.delivered.food = 14;
  w.delivered.water = 10;
  w.inventory.food = 6;
  w.inventory.water = 10;
  const offer = getCampaignActions(w).find(
    (a) => a.target === "shelter_stock_solo",
  )!;
  assert.match(offer.text!, /6 food \+ 10 water/);
  w = act(w, "shelter_stock_solo");
  assert.equal(w.inventory.food, 0);
  assert.equal(w.inventory.water, 0);
  assert.equal(w.delivered.food, 20);
  assert.equal(w.delivered.water, 20);
  assert.equal(w.campaign!.shelter, "stocked");
});

test("actual restitution restores Mara cooperation once while keeping broken promise in history", () => {
  let w = createCampaignWorld();
  w.location = "clinic";
  w.spatial!.player = physicalResidentPosition(w, "mara");
  w.commitments = [
    {
      id: "broken",
      characterId: "mara",
      resource: "medical",
      amount: 10,
      delivered: 0,
      dueHour: 24,
      status: "broken",
      eventId: w.events[0].id,
    },
  ];
  w.hour = 25;
  w.characters.find((c) => c.id === "mara")!.trust = 25;
  w.delivered.medical = 10;
  w.spatial!.carried.medical = 10;
  let r = applyAction(w, {
    id: "restitution",
    kind: "deliver",
    resource: "medical",
    amount: 10,
  });
  assert.equal(r.ok, true, r.message);
  w = r.state;
  assert.equal(w.characters.find((c) => c.id === "mara")!.trust, 40);
  assert.equal(w.commitments[0].status, "broken");
  assert.ok(
    w.characters
      .find((c) => c.id === "mara")!
      .memories.some((m) => m.tags.includes("restitution")),
  );
  r = applyAction(w, {
    id: "cooperate-again",
    kind: "recruit",
    target: "mara",
  });
  assert.equal(r.ok, true, r.message);
  assert.equal(
    r.state.characters.find((c) => c.id === "mara")!.recruited,
    true,
  );
  w.spatial!.carried.medical = 10;
  r = applyAction(w, {
    id: "extra-aid",
    kind: "deliver",
    resource: "medical",
    amount: 10,
  });
  assert.equal(r.state.characters.find((c) => c.id === "mara")!.trust, 40);
});
