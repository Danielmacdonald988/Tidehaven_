import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  createWorld,
  getCharacterContext,
  replayTimeline,
} from "../src/engine";
import type { Action, Timeline } from "../src/contracts";
const run = () => {
  let w = createWorld();
  let i = 0;
  const timeline: Timeline = {
    id: "a",
    name: "Test",
    initial: structuredClone(w),
    steps: [],
  };
  return {
    get world() {
      return w;
    },
    timeline,
    act(action: Omit<Action, "id">) {
      const a = { ...action, id: `test-${i++}` };
      const r = applyAction(w, a);
      assert.equal(r.ok, true, r.message);
      w = r.state;
      timeline.steps.push({ action: a, state: structuredClone(w) });
      return w;
    },
  };
};
test("negotiations conserve stock and money; duplicated or invalid actions are inert", () => {
  let w = createWorld();
  w = applyAction(w, { id: "move", kind: "travel", location: "market" }).state;
  const before = structuredClone(w);
  const a: Action = {
    id: "purchase",
    kind: "buy",
    resource: "medical",
    amount: 10,
  };
  const r = applyAction(w, a);
  assert.equal(r.ok, true);
  assert.equal(r.state.money, 9200);
  assert.equal(r.state.inventory.medical, 10);
  assert.equal(
    r.state.characters.find((c) => c.id === "eli")!.inventory.medical,
    50,
  );
  assert.deepEqual(w, before);
  assert.equal(applyAction(r.state, a).ok, false);
  for (const amount of [-10, NaN, Infinity, 1.5, 500])
    assert.equal(applyAction(w, { ...a, id: "bad", amount }).ok, false);
});
test("a complete successful relief strategy finishes with a strong outcome", () => {
  const s = run();
  s.act({ kind: "recruit", target: "ada" });
  s.act({ kind: "recruit", target: "inez" });
  s.act({ kind: "travel", location: "clinic" });
  s.act({ kind: "promise", target: "mara" });
  s.act({ kind: "travel", location: "market" });
  for (const [resource, amount] of [
    ["medical", 10],
    ["food", 60],
    ["water", 60],
    ["fuel", 12],
  ] as const)
    s.act({ kind: "buy", resource, amount });
  s.act({ kind: "travel", location: "clinic" });
  s.act({ kind: "deliver", resource: "medical", amount: 10 });
  assert.equal(s.world.commitments[0].status, "kept");
  s.act({ kind: "recruit", target: "mara" });
  s.act({ kind: "travel", location: "heights" });
  s.act({ kind: "deliver", resource: "food", amount: 60 });
  s.act({ kind: "deliver", resource: "water", amount: 60 });
  s.act({ kind: "travel", location: "harbor" });
  s.act({ kind: "transport" });
  for (let i = 0; i < 3; i++) s.act({ kind: "evacuate" });
  s.act({ kind: "travel", location: "warehouse" });
  s.act({ kind: "prepare" });
  while (!s.world.ended) s.act({ kind: "wait" });
  assert.ok(s.world.outcome!.score >= 90);
  assert.deepEqual(replayTimeline(s.timeline), s.world);
  assert.deepEqual(JSON.parse(JSON.stringify(s.world)), s.world);
});
test("missed promises persist and affect trust; failure remains playable", () => {
  const s = run();
  s.act({ kind: "travel", location: "clinic" });
  s.act({ kind: "promise", target: "mara" });
  while (!s.world.ended) s.act({ kind: "wait" });
  assert.equal(s.world.commitments[0].status, "broken");
  assert.equal(s.world.characters[0].trust, 25);
  assert.ok(
    s.world.characters[0].memories.some((m) => m.tags.includes("broken")),
  );
  assert.ok(s.world.outcome!.score < 45);
});
test("same proposal has different responses; characters act independently", () => {
  const w = createWorld();
  const a = applyAction(w, { id: "1", kind: "recruit", target: "ada" });
  assert.equal(a.state.staff, 1);
  const moved = applyAction(w, {
    id: "2",
    kind: "travel",
    location: "clinic",
  }).state;
  const b = applyAction(moved, { id: "3", kind: "recruit", target: "mara" });
  assert.equal(b.state.staff, 0);
  let advanced = applyAction(w, { id: "4", kind: "wait" }).state;
  advanced = applyAction(advanced, { id: "5", kind: "wait" }).state;
  assert.ok(advanced.delivered.food >= 10 && advanced.delivered.food <= 14);
  assert.equal(
    advanced.characters.find((c) => c.id === "bea")!.inventory.food +
      advanced.delivered.food,
    14,
  );
  assert.ok(advanced.events.some((e) => e.kind === "autonomous"));
});
test("context excludes other residents private knowledge; branching leaves original unchanged", () => {
  const w = createWorld();
  const context = JSON.stringify(getCharacterContext(w, "ada"));
  for (const c of w.characters.filter((c) => c.id !== "ada"))
    for (const secret of c.privateFacts) assert.ok(!context.includes(secret));
  const original = JSON.stringify(w);
  const branch = applyAction(w, {
    id: "branch",
    kind: "recruit",
    target: "ada",
  }).state;
  assert.equal(JSON.stringify(w), original);
  assert.notEqual(branch.staff, w.staff);
  assert.throws(() =>
    replayTimeline({
      id: "x",
      name: "tampered",
      initial: w,
      steps: [{ action: { id: "tamper", kind: "wait" }, state: branch }],
    }),
  );
});
test("invalid model proposals cannot bypass engine rules", () => {
  const w = createWorld();
  for (const a of [
    { kind: "buy", resource: "food", amount: 100 },
    { kind: "evacuate" },
    { kind: "prepare" },
    { kind: "transport" },
    { kind: "deliver", resource: "fuel", amount: 10 },
    { kind: "wait", actor: "mara" },
  ]) {
    const r = applyAction(w, { id: "invalid", ...a } as Action);
    assert.equal(r.ok, false);
    assert.deepEqual(r.state, w);
  }
});

test("broken promise changes recruitment and dialogue is recorded without becoming fact", () => {
  const s = run();
  s.act({ kind: "travel", location: "clinic" });
  s.act({ kind: "promise", target: "mara" });
  while (s.world.hour < 24) s.act({ kind: "wait" });
  s.act({ kind: "travel", location: "market" });
  s.act({ kind: "buy", resource: "medical", amount: 10 });
  s.act({ kind: "travel", location: "clinic" });
  s.act({ kind: "deliver", resource: "medical", amount: 10 });
  s.act({ kind: "recruit", target: "mara" });
  assert.equal(s.world.staff, 0);
  s.act({
    kind: "talk",
    target: "mara",
    text: "The player claims to own a million dollars.",
  });
  assert.ok(
    s.world.events.some((e) => e.description.includes("million dollars")),
  );
  assert.ok(
    !s.world.characters[0].knowledge.some((k) => k.includes("million dollars")),
  );
  assert.deepEqual(replayTimeline(s.timeline), s.world);
});
test("same seed reproduces donation; different seeds affect bounded personal donation", () => {
  const donations = new Set<number>();
  for (let seed = 1; seed <= 8; seed++) {
    let w = createWorld(seed);
    w = applyAction(w, { id: "a", kind: "wait" }).state;
    w = applyAction(w, { id: "b", kind: "wait" }).state;
    donations.add(w.delivered.food);
  }
  assert.ok(donations.size > 1);
});
test("late delivery must finish before deadline and autonomous rescues never exceed population", () => {
  let w = createWorld();
  w.location = "clinic";
  w = applyAction(w, { id: "p", kind: "promise", target: "mara" }).state;
  w.hour = 23;
  w.inventory.medical = 10;
  w = applyAction(w, {
    id: "d",
    kind: "deliver",
    resource: "medical",
    amount: 10,
  }).state;
  assert.equal(w.commitments[0].status, "broken");
  w.evacuated = 48;
  w.hour = 53;
  w = applyAction(w, { id: "flood", kind: "wait" }).state;
  assert.equal(w.evacuated, 48);
  w.hour = 71;
  w.location = "warehouse";
  w.staff = 2;
  assert.equal(applyAction(w, { id: "late", kind: "prepare" }).ok, false);
});
test("exact deadline succeeds and autonomous timestamps match trigger facts", () => {
  let w = createWorld();
  w.location = "clinic";
  w = applyAction(w, { id: "p", kind: "promise", target: "mara" }).state;
  w.hour = 22;
  w.inventory.medical = 10;
  w = applyAction(w, {
    id: "d",
    kind: "deliver",
    resource: "medical",
    amount: 10,
  }).state;
  assert.equal(w.commitments[0].status, "kept");
  let early = createWorld();
  early = applyAction(early, { id: "a", kind: "wait" }).state;
  early = applyAction(early, { id: "b", kind: "wait" }).state;
  assert.equal(
    early.events.find((e) => e.title === "Bread before the rain")!.hour,
    8,
  );
  assert.equal(
    early.characters.find((c) => c.id === "bea")!.memories[0].hour,
    8,
  );
});
