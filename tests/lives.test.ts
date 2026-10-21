import test from "node:test";
import assert from "node:assert/strict";
import {
  activateLives,
  getDecisionRequests,
  residentChoices,
} from "../src/lives";
import { createPhysicalWorld, physicalResidentPosition } from "../src/physical";
import {
  applyAction,
  getCharacterContext,
  replayTimeline,
} from "../src/engine";
import {
  serializeWorld,
  deserializeWorld,
  validateWorld,
} from "../src/persistence";
import { pointAtLocation } from "../src/three/shared";
import type { Action, World, Timeline } from "../src/contracts";
function world() {
  let w = activateLives(createPhysicalWorld());
  w.location = "market";
  w.spatial!.player = pointAtLocation("market");
  w = applyAction(w, {
    id: "buy",
    kind: "buy",
    resource: "medical",
    amount: 10,
  }).state;
  w.location = "warehouse";
  w.spatial!.player = physicalResidentPosition(w, "inez");
  return w;
}
function pick(w: World, id: string, choice: string) {
  const a = residentChoices(w, id).find((a) => a.decision!.choice === choice);
  assert.ok(a, `Missing ${choice}`);
  return { ...a, id: `decision-${id}-${w.appliedActions.length}` };
}
test("Inez requested pickup is a pending decision, then real shipment, then remembered completion", () => {
  let w = world();
  const t: Timeline = {
    id: "life",
    name: "Inez",
    initial: structuredClone(w),
    steps: [],
  };
  let counter = 0;
  function act(action: Action) {
    const a = { ...action, id: `action${counter++}` };
    const r = applyAction(w, a);
    assert.equal(r.ok, true, r.message);
    w = r.state;
    t.steps.push({ action: a, state: structuredClone(w) });
  }
  act({
    id: "ask",
    kind: "assign",
    target: "inez",
    resource: "medical",
    amount: 10,
  });
  assert.equal(w.lives!.inez.assignment!.status, "pending");
  assert.equal(w.spatial!.staged.medical, 10);
  assert.equal(w.staff, 0);
  const request = getDecisionRequests(w)[0];
  assert.equal(request.characterId, "inez");
  assert.equal(request.purpose, "decision");
  assert.equal(
    request.context.decisionTrigger,
    request.context.availableActions[0].decision!.triggerId,
  );
  act(pick(w, "inez", "collect"));
  assert.equal(w.lives!.inez.assignment!.status, "accepted");
  assert.equal(w.staff, 1);
  assert.equal(w.inventory.medical, 0);
  assert.equal(w.spatial!.staged.medical, 0);
  while (w.inventory.medical < 10)
    act({ id: "advance", kind: "advance", seconds: 5 });
  assert.equal(w.lives!.inez.assignment!.status, "complete");
  assert.match(w.lives!.inez.initiative!.text, /you asked/);
  assert.ok(
    w.characters
      .find((c) => c.id === "inez")!
      .memories.some((m) => m.tags.includes("shipment")),
  );
  assert.deepEqual(replayTimeline(t), w);
  assert.deepEqual(deserializeWorld(serializeWorld(w)), w);
});
test("guarded resident declines; model cannot invent collect or reuse decision", () => {
  let w = world();
  w.location = "clinic";
  w.spatial!.player = physicalResidentPosition(w, "mara");
  w = applyAction(w, {
    id: "ask",
    kind: "assign",
    target: "mara",
    resource: "medical",
    amount: 10,
  }).state;
  assert.ok(w.lives!.mara.assignment);
  assert.deepEqual(
    residentChoices(w, "mara").map((a) => a.decision!.choice),
    ["decline"],
  );
  const decline = pick(w, "mara", "decline");
  const fabricated = {
    ...decline,
    resource: "medical",
    amount: 10,
    decision: { ...decline.decision!, choice: "collect" },
  } as Action;
  assert.equal(applyAction(w, fabricated).ok, false);
  const result = applyAction(w, decline);
  assert.equal(result.ok, true);
  w = result.state;
  assert.equal(w.staff, 0);
  assert.equal(w.spatial!.staged.medical, 10);
  assert.equal(w.lives!.mara.assignment!.status, "declined");
  assert.equal(applyAction(w, { ...decline, id: "retry" }).ok, false);
});
test("remote requests cannot reach residents, decision candidates are revalidated when stock is gone", () => {
  let w = world();
  assert.equal(
    applyAction(w, {
      id: "remote",
      kind: "assign",
      target: "mara",
      resource: "medical",
      amount: 10,
    }).ok,
    false,
  );
  w = applyAction(w, {
    id: "ask",
    kind: "assign",
    target: "inez",
    resource: "medical",
    amount: 10,
  }).state;
  const choice = pick(w, "inez", "collect");
  const before = structuredClone(w);
  w.spatial!.staged.medical = 0;
  assert.equal(applyAction(w, choice).ok, false);
  assert.equal(w.staff, 0);
  assert.equal(w.lives!.inez.assignment!.status, "pending");
  assert.equal(before.spatial!.staged.medical, 10);
});
test("strangers cannot see global reserves or budgets; local witnesses retain causal source memory", () => {
  const w = world();
  const sam = getCharacterContext(w, "sam");
  assert.ok(!JSON.stringify(sam).includes("Budget $"));
  assert.ok(!JSON.stringify(sam).includes("Relief reserve:"));
  assert.ok(!sam.memories.some((m) => m.tags.includes("buy")));
  const eli = getCharacterContext(w, "eli");
  assert.ok(
    eli.memories.some(
      (m) => m.tags.includes("witnessed") && m.tags.includes("buy"),
    ),
  );
  for (const secret of w.characters.find((c) => c.id === "mara")!.privateFacts)
    assert.ok(!JSON.stringify(sam).includes(secret));
});
test("twelve bounded routines persist, with few moves and no duplicate or economic action", () => {
  let w = activateLives(createPhysicalWorld());
  assert.equal(Object.keys(w.lives!).length, 12);
  assert.equal(new Set(Object.values(w.lives!).map((l) => l.routine)).size, 12);
  assert.equal(getDecisionRequests(w).length, 3);
  const choice = pick(w, "sam", "routine");
  const result = applyAction(w, choice);
  assert.equal(result.ok, true);
  w = result.state;
  assert.equal(w.characters.find((c) => c.id === "sam")!.location, "radio");
  assert.equal(w.money, 10000);
  assert.equal(residentChoices(w, "sam").length, 0);
  assert.equal(
    applyAction(w, { ...choice, id: "duplicate-trigger" }).ok,
    false,
  );
  assert.equal(validateWorld(w), true);
  const bad = structuredClone(w);
  bad.lives!.sam.handledTriggers.push(bad.lives!.sam.handledTriggers[0]);
  assert.equal(validateWorld(bad), false);
});
test("important promise memories survive a long conversation tail", () => {
  const w = world();
  const mara = w.characters.find((c) => c.id === "mara")!;
  mara.memories.push({
    eventId: "promise",
    hour: 1,
    text: "You kept your medicine promise.",
    tags: ["promise", "kept"],
  });
  for (let i = 0; i < 15; i++)
    mara.memories.push({
      eventId: `speech${i}`,
      hour: 2,
      text: "Ordinary small talk.",
      tags: ["conversation"],
    });
  assert.ok(
    getCharacterContext(w, "mara").memories.some(
      (m) => m.eventId === "promise",
    ),
  );
});
test("routine decision can choose staying put or real travel at a bounded cycle", () => {
  const base = activateLives(createPhysicalWorld());
  base.hour = 32;
  const choices = residentChoices(base, "ada");
  assert.deepEqual(
    choices.map((a) => a.decision!.choice),
    ["routine", "check_in"],
  );
  const stay = applyAction(base, { ...choices[1], id: "stay" });
  assert.equal(stay.ok, true);
  assert.equal(
    stay.state.characters.find((c) => c.id === "ada")!.location,
    "warehouse",
  );
  assert.equal(residentChoices(stay.state, "ada").length, 0);
  const go = applyAction(base, { ...choices[0], id: "go" });
  assert.equal(go.ok, true);
  assert.equal(
    go.state.characters.find((c) => c.id === "ada")!.location,
    "heights",
  );
  assert.equal(
    base.characters.find((c) => c.id === "ada")!.location,
    "warehouse",
  );
});
test("every routine offers a bounded check-in so abstention cannot starve other residents", () => {
  let w = activateLives(createPhysicalWorld());
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const request = getDecisionRequests(w)[0];
    assert.ok(request);
    assert.ok(!seen.has(request.characterId));
    seen.add(request.characterId);
    const check = request.context.availableActions.find(
      (a) => a.decision?.choice === "check_in",
    );
    assert.ok(check);
    const result = applyAction(w, { ...check, id: `abstain-${i}` });
    assert.equal(result.ok, true, result.message);
    w = result.state;
  }
  assert.equal(seen.size, 12);
  assert.equal(getDecisionRequests(w).length, 0);
  assert.equal(w.money, 10000);
  assert.equal(w.staff, 0);
});
test("all twelve residents have distinct non-self ties; migration preserves evolved living relationships", () => {
  const old = createPhysicalWorld();
  for (const c of old.characters) c.relationships = { mara: 30, jo: 20 };
  const migrated = activateLives(old);
  assert.equal(
    new Set(migrated.characters.map((c) => JSON.stringify(c.relationships)))
      .size,
    12,
  );
  for (const c of migrated.characters) {
    assert.ok(!Object.hasOwn(c.relationships, c.id));
    assert.ok(
      Object.keys(c.relationships).every((id) =>
        migrated.characters.some((other) => other.id === id),
      ),
    );
  }
  const inez = migrated.characters.find((c) => c.id === "inez")!;
  assert.equal(inez.relationships.ada, 70);
  inez.relationships.ada = 12;
  inez.relationships.inez = 99;
  const reloaded = activateLives(migrated);
  assert.equal(
    reloaded.characters.find((c) => c.id === "inez")!.relationships.ada,
    12,
  );
  assert.ok(
    !Object.hasOwn(
      reloaded.characters.find((c) => c.id === "inez")!.relationships,
      "inez",
    ),
  );
  assert.equal(inez.relationships.inez, 99, "migration must clone its input");
});
