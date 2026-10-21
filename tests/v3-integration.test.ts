import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, getCharacterContext } from "../src/engine";
import { createPhysicalWorld } from "../src/physical";
import { activateLives, getDecisionRequests } from "../src/lives";
import { residentHome } from "../src/three/shared";
import {
  createIntelligence,
  validateConversationRequest,
} from "../src/intelligence";
import { validateWorld } from "../src/persistence";
import type { Action, ConversationRequest } from "../src/contracts";

// This is an explicitly mocked provider integration, never evidence of a real API call.
function provider(select: (request: ConversationRequest) => number) {
  return createIntelligence({
    apiKey: "test-only-placeholder",
    fetcher: async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      const request = JSON.parse(payload.input);
      const actionIndex = select(request);
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    text: "I can make this trip, then return to the warehouse.",
                    actionIndex,
                  }),
                },
              ],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 },
        }),
      );
    },
  });
}

test("mocked model conversation -> assignment -> independent decision -> physical cargo -> persistent history", async () => {
  let w = activateLives(createPhysicalWorld());
  // Fixture owns purchased goods; conservation is measured across staging/in transit/arrival.
  w.spatial!.player = residentHome(w, "inez");
  w.spatial!.staged.medical = 10;
  const conversation: ConversationRequest = {
    characterId: "inez",
    message:
      "Could you pick up the ten medical kits I bought while I go to the clinic?",
    context: getCharacterContext(w, "inez"),
  };
  assert.ok(validateConversationRequest(conversation));
  const chat = provider((req) =>
    req.context.availableActions.findIndex((a: Action) => a.kind === "assign"),
  );
  const reply = await chat.chat(conversation);
  assert.equal(reply.mode, "live", "mocked provider uses real adapter parser");
  assert.equal(reply.proposal?.kind, "assign");
  const assigned = applyAction(w, { ...reply.proposal!, id: "v3-assignment" });
  assert.ok(assigned.ok, assigned.message);
  w = assigned.state;
  assert.equal(w.lives!.inez.assignment?.status, "pending");
  assert.equal(w.inventory.medical, 0);
  const request = getDecisionRequests(w).find((r) => r.characterId === "inez");
  assert.ok(request);
  assert.equal(request.purpose, "decision");
  assert.ok(validateConversationRequest(request));
  const chooser = provider((req) =>
    req.context.availableActions.findIndex(
      (a: Action) => a.decision?.choice === "collect",
    ),
  );
  const decision = await chooser.chat(request);
  assert.equal(decision.mode, "live");
  assert.equal(decision.proposal?.kind, "resident_act");
  // The player is elsewhere; the decision must not teleport them or use their location as authority.
  w.location = "clinic";
  w.spatial!.player = { x: 22, z: -10 };
  const before = structuredClone(w.spatial!.player);
  const acted = applyAction(w, {
    ...decision.proposal!,
    id: "v3-resident-choice",
  });
  assert.ok(acted.ok, acted.message);
  w = acted.state;
  assert.deepEqual(w.spatial!.player, before);
  assert.equal(w.spatial!.staged.medical, 0);
  assert.equal(w.inventory.medical, 0);
  assert.equal(w.spatial!.shipments.length, 1);
  const duplicate = applyAction(w, {
    ...decision.proposal!,
    id: "v3-duplicate-choice",
  });
  assert.equal(
    duplicate.ok,
    false,
    "same trigger cannot launch a second shipment",
  );
  for (let n = 0; n < 80 && w.inventory.medical === 0; n++) {
    const step = applyAction(w, {
      id: `v3-tick-${n}`,
      kind: "advance",
      seconds: 5,
    });
    assert.ok(step.ok, step.message);
    w = step.state;
  }
  assert.equal(w.inventory.medical, 10);
  assert.equal(w.lives!.inez.assignment?.status, "complete");
  assert.ok(
    w.characters
      .find((c) => c.id === "inez")!
      .memories.some((m) => /deliver|collect/i.test(m.text)),
  );
  assert.ok(validateWorld(w));
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
  assert.equal(
    assigned.state.spatial!.shipments.length,
    0,
    "later branch must not mutate assignment snapshot",
  );
});

test("promise recollection prefers the commitment outcome over lower-priority witness bookkeeping", async () => {
  const { demoConversation } = await import("../src/intelligence");
  const w = activateLives(createPhysicalWorld());
  const c = getCharacterContext(w, "mara");
  c.publicFacts = ["Your medicine promise: kept, 10/10 by hour 24."];
  c.memories = [
    {
      eventId: "e100",
      hour: 12,
      text: "You kept your promise: 10 medical kits by hour 24.",
      tags: ["promise", "kept"],
    },
    {
      eventId: "e99",
      hour: 11,
      text: "Witnessed Delivered 10 medical: reserve -10.",
      tags: ["witnessed", "deliver"],
    },
  ];
  const reply = demoConversation(c, "Do you remember our promise?");
  assert.match(reply.text, /You kept your promise: 10 medical kits by hour 24/);
  assert.doesNotMatch(reply.text, /reserve -10/);
});
