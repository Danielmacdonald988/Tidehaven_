import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  createWorld,
  getAvailableActions,
  getCharacterContext,
  replayTimeline,
} from "../src/engine";
import { validateConversationRequest } from "../src/intelligence";
import type { Action, Timeline } from "../src/contracts";
function uiSession() {
  let world = createWorld(42),
    counter = 0;
  const timeline: Timeline = {
    id: "ui-route",
    name: "UI route",
    initial: structuredClone(world),
    steps: [],
  };
  const choose = (
    kind: Action["kind"],
    match: Partial<Action> = {},
    characterId?: string,
  ) => {
    const offer = getAvailableActions(world, characterId).find(
      (a) =>
        a.kind === kind &&
        Object.entries(match).every(
          ([key, value]) => a[key as keyof Action] === value,
        ),
    );
    assert.ok(
      offer,
      `No UI offer: ${kind} ${JSON.stringify(match)} at ${world.location}`,
    );
    const action = { ...offer, id: `ui-${counter++}` };
    const result = applyAction(world, action);
    assert.equal(result.ok, true, `Hour ${world.hour}: ${result.message}`);
    world = result.state;
    timeline.steps.push({ action, state: structuredClone(world) });
    // Every evolved context remains suitable for both demo and live modes.
    for (const character of world.characters)
      assert.ok(
        validateConversationRequest({
          characterId: character.id,
          message: "What do you need?",
          context: getCharacterContext(world, character.id),
        }),
        `Invalid ${character.id} context at hour ${world.hour}`,
      );
  };
  return {
    get world() {
      return world;
    },
    timeline,
    choose,
  };
}
function shop(s: ReturnType<typeof uiSession>) {
  s.choose("buy", { resource: "medical" }, "eli");
  for (let i = 0; i < 2; i++) {
    s.choose("buy", { resource: "food" }, "eli");
    s.choose("buy", { resource: "water" }, "eli");
    s.choose("buy", { resource: "fuel" }, "eli");
  }
}
for (const start of ["clinic-first", "market-first"] as const)
  test(`UI-only ${start} strategy keeps the promise and earns a strong ending`, () => {
    const s = uiSession();
    if (start === "clinic-first") {
      s.choose("travel", { location: "clinic" });
      s.choose("promise", {}, "mara");
      s.choose("talk", {}, "mara");
      s.choose("travel", { location: "market" });
      shop(s);
      s.choose("travel", { location: "clinic" });
    } else {
      s.choose("travel", { location: "market" });
      shop(s);
      s.choose("travel", { location: "clinic" });
      s.choose("promise", {}, "mara");
      s.choose("talk", {}, "mara");
    }
    s.choose("deliver", { resource: "medical" }, "mara");
    assert.equal(s.world.commitments[0].status, "kept");
    s.choose("recruit", {}, "mara");
    s.choose("recruit", {}, "luis");
    s.choose("travel", { location: "heights" });
    s.choose("recruit", {}, "rosa");
    for (let i = 0; i < 2; i++) {
      s.choose("deliver", { resource: "food" });
      s.choose("deliver", { resource: "water" });
    }
    s.choose("travel", { location: "harbor" });
    s.choose("transport", {}, "jo");
    s.choose("recruit", {}, "jo");
    for (let i = 0; i < 3; i++) s.choose("evacuate", {}, "jo");
    s.choose("travel", { location: "warehouse" });
    s.choose("prepare");
    assert.ok(
      s.world.hour <= 64,
      "Strategy must leave a little time to explore",
    );
    assert.ok(s.world.money >= 0);
    while (!s.world.ended) s.choose("wait");
    assert.ok(s.world.outcome!.score >= 95, JSON.stringify(s.world.outcome));
    assert.equal(s.world.outcome!.supplied, 60);
    assert.ok(s.world.evacuated >= 36);
    assert.deepEqual(replayTimeline(s.timeline), s.world);
  });

test("initial UI offers teach missing prerequisites without spending money or time", () => {
  const s = uiSession();
  const prepare = getAvailableActions(s.world).find(
    (a) => a.kind === "prepare",
  )!;
  const result = applyAction(s.world, { ...prepare, id: "early-prepare" });
  assert.equal(result.ok, false);
  assert.match(result.message, /two helpers/);
  assert.equal(result.state, s.world);
});
