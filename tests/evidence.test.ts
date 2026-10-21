import test from "node:test";
import assert from "node:assert/strict";
import { resolveEvidence } from "../src/evidence";
import { createWorld } from "../src/engine";
test("causal source links cannot confuse e1 with e10 or discover IDs inside prose", () => {
  const initial = createWorld().events[0];
  const events = [
    initial,
    { ...initial, id: "e10", title: "Actual delivery" },
    { ...initial, id: "e100", title: "Later talk" },
  ];
  assert.equal(
    resolveEvidence("Event e10: I delivered the medicine.", events)?.title,
    "Actual delivery",
  );
  assert.equal(resolveEvidence("e100", events)?.title, "Later talk");
  assert.equal(
    resolveEvidence("A statement mentioning e1 without a source.", events),
    undefined,
  );
  assert.equal(resolveEvidence("Event e999: missing", events), undefined);
});
