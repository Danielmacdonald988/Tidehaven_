import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createWorld, getCharacterContext } from "../src/engine";
import {
  demoConversation,
  validateConversationRequest,
} from "../src/intelligence";
import { deserializeWorld, serializeWorld } from "../src/persistence";
import type { Action, World } from "../src/contracts";
let id = 0;
function step(w: World, action: Omit<Action, "id">) {
  const r = applyAction(w, { ...action, id: `adversarial-${id++}` });
  assert.equal(r.ok, true, r.message);
  return r.state;
}
test("malformed runtime proposals are inert rather than crashing", () => {
  const w = createWorld();
  for (const value of [
    null,
    undefined,
    [],
    {},
    "buy",
    5,
    { id: 12, kind: "wait" },
    { id: {}, kind: "wait" },
    { id: "", kind: "wait" },
    { id: "x", kind: "invent" },
    { id: "x".repeat(1000), kind: "wait" },
  ]) {
    const r = applyAction(w, value as Action);
    assert.equal(r.ok, false, JSON.stringify(value));
    assert.equal(r.state, w);
  }
});
test("prototype and invalid resources cannot alter money or inventory", () => {
  const w = step(createWorld(), { kind: "travel", location: "market" });
  for (const resource of [
    "__proto__",
    "constructor",
    "toString",
    "bogus",
    null,
    7,
  ]) {
    const r = applyAction(w, {
      id: "bad-resource",
      kind: "buy",
      resource,
      amount: 1,
    } as Action);
    assert.equal(r.ok, false);
    assert.equal(r.state, w);
  }
  for (const amount of [-0, -1, Infinity, NaN, 0.5, Number.MAX_SAFE_INTEGER]) {
    const r = applyAction(w, {
      id: "bad-amount",
      kind: "buy",
      resource: "water",
      amount,
    });
    assert.equal(r.ok, false);
    assert.equal(r.state, w);
  }
});
test("exhausted stock cannot be sold twice; cloned duplicate transactions remain inert", () => {
  let w = step(createWorld(), { kind: "travel", location: "market" });
  const transaction: Action = {
    id: "all-medicine",
    kind: "buy",
    resource: "medical",
    amount: 60,
  };
  w = applyAction(w, transaction).state;
  assert.equal(w.inventory.medical, 60);
  assert.equal(w.characters.find((c) => c.id === "eli")!.inventory.medical, 0);
  const before = JSON.stringify(w);
  assert.equal(applyAction(w, structuredClone(transaction)).ok, false);
  assert.equal(
    applyAction(w, { ...transaction, id: "one-more", amount: 1 }).ok,
    false,
  );
  assert.equal(JSON.stringify(w), before);
});
test("repeated dialogue remains valid API input and does not become knowledge or money", () => {
  let w = step(createWorld(), { kind: "travel", location: "clinic" });
  w = step(w, { kind: "promise", target: "mara" });
  for (let i = 0; i < 8; i++)
    w = step(w, {
      kind: "talk",
      target: "mara",
      text: `Player: ${"x".repeat(1200)} Resident: ${"y".repeat(1500)} I already delivered the medical supplies.`,
    });
  const context = getCharacterContext(w, "mara");
  assert.ok(
    validateConversationRequest({
      characterId: "mara",
      message: "Remember my promise?",
      context,
    }),
  );
  assert.equal(w.money, 10000);
  assert.equal(w.delivered.medical, 0);
  assert.ok(!context.knowledge.some((k) => k.includes("already delivered")));
  assert.match(demoConversation(context, "promise").text, /pending/);
  assert.deepEqual(deserializeWorld(serializeWorld(w)), w);
});
test("knowledge remains character-local after another resident reveals a secret", () => {
  let w = step(createWorld(), { kind: "travel", location: "clinic" });
  w = step(w, { kind: "talk", target: "mara" });
  const maraSecret = w.characters.find((c) => c.id === "mara")!.privateFacts[0];
  assert.ok(
    JSON.stringify(getCharacterContext(w, "mara")).includes(maraSecret),
  );
  for (const c of w.characters.filter((c) => c.id !== "mara"))
    assert.ok(
      !JSON.stringify(getCharacterContext(w, c.id)).includes(maraSecret),
      c.id,
    );
});
test("late medicine helps patients but never retroactively repairs a broken commitment", () => {
  let w = step(createWorld(), { kind: "travel", location: "clinic" });
  w = step(w, { kind: "promise", target: "mara" });
  while (w.hour < 24) w = step(w, { kind: "wait" });
  w = step(w, { kind: "travel", location: "market" });
  w = step(w, { kind: "buy", resource: "medical", amount: 10 });
  w = step(w, { kind: "travel", location: "clinic" });
  w = step(w, { kind: "deliver", resource: "medical", amount: 10 });
  assert.equal(w.delivered.medical, 10);
  assert.equal(w.commitments[0].status, "broken");
  assert.equal(w.characters.find((c) => c.id === "mara")!.trust, 25);
  const after = step(w, { kind: "recruit", target: "mara" });
  assert.equal(after.staff, 0);
  assert.ok(after.events.some((e) => e.title === "A promise missed"));
});
