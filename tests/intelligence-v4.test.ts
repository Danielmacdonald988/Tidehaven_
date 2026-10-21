import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntelligence,
  demoConversation,
  parseModelReply,
  validateConversationRequest,
} from "../src/intelligence";
import {
  activateLives,
  getDecisionRequests,
  residentChoices,
} from "../src/lives";
import { createPhysicalWorld } from "../src/physical";
import { getCharacterContext } from "../src/engine";
import type { Action, World } from "../src/contracts";
function campaign(): World {
  const w = activateLives(createPhysicalWorld());
  w.campaign = {
    version: 1,
    inspected: false,
    van: "stranded",
    cooperation: "none",
    shelter: "bare",
    route: "blocked",
  };
  return w;
}
test("campaign spends no autonomous requests on twelve opening routine recitals", () => {
  const w = campaign();
  assert.deepEqual(getDecisionRequests(w), []);
  w.hour = 24;
  const requests = getDecisionRequests(w);
  assert.deepEqual(
    requests.map((r) => r.characterId),
    ["kit"],
  );
  assert.ok(
    requests[0].context.availableActions.some(
      (a) => a.decision?.choice === "routine",
    ),
  );
});
test("campaign decisions respond to meaningful local memories rather than chatter and old acknowledgements", () => {
  const w = campaign();
  w.hour = 10;
  const c = w.characters.find((c) => c.id === "inez")!;
  c.memories.push({
    eventId: "e1",
    hour: 9,
    text: "The coordinator spoke.",
    tags: ["conversation"],
  });
  assert.equal(residentChoices(w, "inez").length, 0);
  c.memories.push({
    eventId: "e2",
    hour: 9,
    text: "Helped repair the relief vehicle.",
    tags: ["project"],
  });
  assert.ok(residentChoices(w, "inez").length);
  w.lives!.inez.lastDecisionHour = 10;
  w.hour = 20;
  assert.equal(residentChoices(w, "inez").length, 0);
});
test("natural repair, salvage, barter and shelter proposals select only exact offered actions", () => {
  const w = campaign(),
    context = getCharacterContext(w, "inez");
  const cases = [
    ["Can you fix the van?", "repair_van"],
    ["Can we salvage the van?", "salvage_van"],
    ["Trade fuel for food", "market_trade"],
    ["Let us cooperate", "market_coop"],
    ["Prepare the shelter", "shelter_cots"],
    ["Stock the shelter", "shelter_stock_solo"],
    ["Clear the road", "clear_route"],
  ];
  for (const [message, target] of cases) {
    const action: Action = {
      id: target,
      kind: "project",
      target,
      text: target,
    };
    context.availableActions = [action];
    assert.deepEqual(demoConversation(context, message).proposal, action);
    const request = { characterId: "inez", message, context };
    assert.equal(validateConversationRequest(request), true);
    assert.deepEqual(
      parseModelReply(
        JSON.stringify({
          text: "We can do this if you agree.",
          actionIndex: 0,
        }),
        context,
      ).proposal,
      action,
    );
    context.availableActions = [];
    assert.equal(demoConversation(context, message).proposal, undefined);
  }
});
test("unsupported creative requests and fabricated project targets cannot create mechanics", () => {
  const context = getCharacterContext(campaign(), "inez");
  context.availableActions = [
    { id: "recruit", kind: "recruit", target: "inez" },
  ];
  assert.equal(
    demoConversation(context, "Build me a helicopter").proposal,
    undefined,
  );
  context.availableActions = [
    { id: "fake", kind: "project", target: "spawn_free_goods" },
  ];
  assert.equal(
    validateConversationRequest({
      characterId: "inez",
      message: "do this",
      context,
    }),
    false,
  );
});
test("three central voices retain distinct stakes and other people cannot read their secrets", () => {
  const w = campaign();
  const inez = getCharacterContext(w, "inez"),
    eli = getCharacterContext(w, "eli"),
    mara = getCharacterContext(w, "mara");
  assert.match(inez.motivation, /two jobs/);
  assert.match(eli.motivation, /reciprocity/);
  assert.match(mara.motivation, /patients/);
  for (const id of ["inez", "eli", "mara"]) {
    const own = w.characters.find((c) => c.id === id)!;
    for (const secret of own.privateFacts)
      assert.ok(
        !JSON.stringify(getCharacterContext(w, "sam")).includes(secret),
      );
  }
  assert.equal(new Set([inez.style, eli.style, mara.style]).size, 3);
});

test("model payload explicitly indexes offered actions and decodes repair index without changing engine context", async () => {
  const context = getCharacterContext(campaign(), "inez");
  context.availableActions = [
    { id: "talk", kind: "talk", target: "inez" },
    { id: "recruit", kind: "recruit", target: "inez" },
    { id: "inspect", kind: "project", target: "inspect_van" },
    {
      id: "repair",
      kind: "project",
      target: "repair_van",
      text: "Repair with Inez · $800 · 4h",
    },
  ];
  const original = structuredClone(context);
  const service = createIntelligence({
    apiKey: "test-only-not-a-real-key",
    fetcher: async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      const input = JSON.parse(payload.input);
      assert.match(payload.instructions, /ZERO-BASED/);
      assert.equal(input.context.availableActions[3].target, "repair_van");
      assert.equal(input.context.availableActions[3].actionIndex, 3);
      assert.equal(input.context.availableActions[1].actionIndex, 1);
      assert.deepEqual(payload.text.format.schema.properties.actionIndex.enum, [
        0,
        1,
        2,
        3,
        null,
      ]);
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
                    text: "We can repair the van for $800 in four hours.",
                    actionIndex: 3,
                  }),
                },
              ],
            },
          ],
          usage: { input_tokens: 40, output_tokens: 20 },
        }),
        { status: 200 },
      );
    },
  });
  const reply = await service.chat({
    characterId: "inez",
    message: "Can we repair the van together?",
    context,
  });
  assert.equal(reply.mode, "live");
  assert.deepEqual(reply.proposal, original.availableActions[3]);
  assert.deepEqual(context, original);
});
