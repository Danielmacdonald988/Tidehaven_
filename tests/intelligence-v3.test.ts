import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntelligence,
  demoDecision,
  demoConversation,
  asFallback,
  parseModelReply,
  validateConversationRequest,
} from "../src/intelligence";
import type {
  Action,
  CharacterContext,
  ConversationRequest,
} from "../src/contracts";
const collect: Action = {
  id: "decision-pickup",
  kind: "resident_act",
  actor: "inez",
  target: "inez",
  resource: "medical",
  amount: 10,
  decision: {
    triggerId: "assignment-e3",
    choice: "collect",
    source: "demo",
    summary:
      "Ten medical kits are staged at the market. I will collect them for the warehouse.",
  },
};
const decline: Action = {
  id: "decision-decline",
  kind: "resident_act",
  actor: "inez",
  target: "inez",
  decision: {
    triggerId: "assignment-e3",
    choice: "decline",
    source: "demo",
    summary:
      "I cannot take this pickup while my current priority remains unresolved.",
  },
};
const checkIn: Action = {
  id: "decision-checkin",
  kind: "resident_act",
  actor: "inez",
  target: "inez",
  decision: {
    triggerId: "assignment-e3",
    choice: "check_in",
    source: "demo",
    summary: "I will check the situation before committing.",
  },
};
const context: CharacterContext = {
  name: "Inez Cruz",
  role: "Mechanic",
  motivation: "Keep practical infrastructure running.",
  style: "Dry humor and concrete plans.",
  hour: 4,
  trust: 50,
  knowledge: ["The market has staged ten medical kits for relief."],
  memories: [
    {
      eventId: "e3",
      hour: 3,
      text: "The player asked me to collect ten medical kits.",
      tags: ["assignment"],
    },
  ],
  publicFacts: ["Ten medical kits are staged for pickup."],
  priorities: ["Help bring medical kits to the warehouse."],
  relationships: ["Trust in the relief coordinator: 50."],
  routine: "Inspect the warehouse roof.",
  decisionTrigger: "assignment-e3",
  availableActions: [collect, decline, checkIn],
};
const request: ConversationRequest = {
  characterId: "inez",
  message: "Choose what to do about this pickup assignment.",
  purpose: "decision",
  context,
};
function provider(
  index: number | null = 0,
  usage: unknown = { input_tokens: 100, output_tokens: 25, total_tokens: 125 },
) {
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
                text: "I can collect those staged kits and bring them to the warehouse.",
                actionIndex: index,
              }),
            },
          ],
        },
      ],
      usage,
    }),
    { status: 200 },
  );
}

test("decision purpose validates identities, trigger, action choice, knowledge bounds and quantities", () => {
  assert.equal(validateConversationRequest(request), true);
  for (const modified of [
    { ...request, purpose: "invent" },
    { ...request, purpose: "conversation" },
    { ...request, context: { ...context, decisionTrigger: "other-trigger" } },
    { ...request, context: { ...context, priorities: ["x".repeat(1001)] } },
    {
      ...request,
      context: {
        ...context,
        availableActions: [{ ...collect, actor: "mara" }],
      },
    },
    {
      ...request,
      context: {
        ...context,
        availableActions: [{ ...collect, target: "mara" }],
      },
    },
    {
      ...request,
      context: { ...context, availableActions: [{ ...collect, amount: 100 }] },
    },
    {
      ...request,
      context: {
        ...context,
        availableActions: [{ ...collect, resource: "__proto__" }],
      },
    },
    {
      ...request,
      context: {
        ...context,
        availableActions: [{ ...decline, resource: "food", amount: 10 }],
      },
    },
    {
      ...request,
      context: {
        ...context,
        availableActions: [
          { id: "no", kind: "buy", resource: "food", amount: 10 },
        ],
      },
    },
  ])
    assert.equal(
      validateConversationRequest(modified),
      false,
      JSON.stringify(modified),
    );
});
test("deterministic decisions honor trust and only clone offered actions", () => {
  const before = structuredClone(context);
  const a = demoDecision(context);
  assert.equal(a.mode, "demo");
  assert.equal(a.proposal?.decision?.choice, "collect");
  assert.deepEqual(a, demoDecision(context));
  assert.equal(
    demoDecision({ ...context, trust: 20 }).proposal?.decision?.choice,
    "decline",
  );
  assert.deepEqual(context, before);
  assert.notEqual(a.proposal, collect);
  assert.ok(a.evidence?.some((e) => e.includes("e3")));
});
test("live decision copies economic parameters and stamps provenance, never model parameters", () => {
  const reply = parseModelReply(
    JSON.stringify({
      text: "I can help with that pickup.",
      actionIndex: 0,
      amount: 100000,
      proposal: { resource: "fuel", amount: 10000 },
    }),
    context,
    "decision",
  );
  assert.equal(reply.proposal?.amount, 10);
  assert.equal(reply.proposal?.resource, "medical");
  assert.equal(reply.proposal?.decision?.source, "live");
  assert.equal(reply.proposal?.decision?.triggerId, "assignment-e3");
  assert.equal(collect.decision?.source, "demo");
  const abstain = parseModelReply(
    '{"text":"I should check first.","actionIndex":null}',
    context,
    "decision",
  );
  assert.equal(abstain.proposal?.decision?.choice, "check_in");
  assert.throws(() =>
    parseModelReply(
      '{"text":"Wrong purpose.","actionIndex":0}',
      context,
      "conversation",
    ),
  );
});
test("offline fallback stamps both label and recorded action source", () => {
  const reply = asFallback(demoDecision(context), "Network unavailable");
  assert.equal(reply.mode, "fallback");
  assert.equal(reply.proposal?.decision?.source, "fallback");
  assert.equal(reply.error, "Network unavailable");
  assert.equal(collect.decision?.source, "demo");
});
test("natural pickup asks produce assignment proposals rather than completed delivery", () => {
  const c = {
    ...context,
    availableActions: [
      {
        id: "assign-1",
        kind: "assign" as const,
        target: "inez",
        resource: "water" as const,
        amount: 10,
      },
    ],
  };
  for (const message of [
    "Can you pick up water?",
    "Please fetch water",
    "Could you collect water?",
  ])
    assert.equal(demoConversation(c, message).proposal?.kind, "assign");
});
test("configured is distinct from verified until a validated provider success", async () => {
  const service = createIntelligence({
    apiKey: "fake",
    fetcher: async () => provider(),
  });
  assert.equal(service.status().configured, true);
  assert.equal(service.status().liveVerified, false);
  assert.equal(service.status().successfulLiveRequests, 0);
  const reply = await service.chat(request);
  assert.equal(reply.mode, "live");
  assert.equal(service.status().liveVerified, true);
  assert.equal(service.status().successfulLiveRequests, 1);
  assert.equal(service.status().lastMode, "live");
  assert.equal(reply.usage?.tokens, 125);
  assert.equal(reply.usage?.spentUsd, 0.00008);
  assert.equal(reply.usage?.reservedUsd, 0);
});
test("malformed provider decision falls back without claiming successful verification", async () => {
  const before = structuredClone(request),
    service = createIntelligence({
      apiKey: "fake",
      fetcher: async () => provider(1000),
    });
  const reply = await service.chat(request);
  assert.equal(reply.mode, "fallback");
  assert.equal(reply.proposal?.decision?.source, "fallback");
  assert.equal(service.status().liveVerified, false);
  assert.equal(service.status().successfulLiveRequests, 0);
  assert.deepEqual(request, before);
});
test("USD cap stops a request before provider spend", async () => {
  let calls = 0;
  const service = createIntelligence({
    apiKey: "fake",
    maxUsd: 0.000001,
    fetcher: async () => {
      calls++;
      return provider();
    },
  });
  const reply = await service.chat(request);
  assert.equal(reply.mode, "fallback");
  assert.match(reply.error!, /budget/);
  assert.equal(calls, 0);
  assert.equal(service.status().usage.spentUsd, 0);
});
test("concurrent reservations prevent overspending before first response arrives", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((r) => (release = r));
  const probe = createIntelligence({
    apiKey: "fake",
    maxUsd: 1,
    fetcher: async () => {
      await barrier;
      return provider();
    },
  });
  const pendingProbe = probe.chat(request);
  const reservation = probe.status().usage.reservedUsd;
  assert.ok(reservation > 0);
  const service = createIntelligence({
    apiKey: "fake",
    maxConcurrency: 2,
    maxUsd: reservation * 1.5,
    fetcher: async () => {
      await barrier;
      return provider();
    },
  });
  const first = service.chat(request);
  const second = await service.chat(request);
  assert.equal(second.mode, "fallback");
  assert.match(second.error!, /budget/);
  assert.equal(service.status().usage.requests, 1);
  release();
  await Promise.all([first, pendingProbe]);
  assert.equal(service.status().usage.reservedUsd, 0);
  assert.equal(service.status().active, 0);
});
test("configured concurrency cap is enforced with a playable fallback", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((r) => (release = r));
  const service = createIntelligence({
    apiKey: "fake",
    maxConcurrency: 1,
    fetcher: async () => {
      await barrier;
      return provider();
    },
  });
  const first = service.chat(request);
  const second = await service.chat(request);
  assert.equal(second.mode, "fallback");
  assert.match(second.error!, /busy/);
  assert.equal(service.status().maxConcurrency, 1);
  release();
  await first;
});
test("one transient retry is charged conservatively and reservations always release", async () => {
  let calls = 0;
  const service = createIntelligence({
    apiKey: "fake",
    fetcher: async () =>
      ++calls === 1 ? new Response("", { status: 503 }) : provider(),
  });
  const reply = await service.chat(request);
  assert.equal(reply.mode, "live");
  assert.equal(calls, 2);
  assert.equal(service.status().successfulLiveRequests, 1);
  assert.ok(service.status().usage.spentUsd > 0.00008);
  assert.equal(service.status().usage.reservedUsd, 0);
  assert.equal(service.status().reservedTokens, 0);
});
test("custom models require explicit pricing before provider access", async () => {
  let calls = 0;
  const service = createIntelligence({
    apiKey: "fake",
    model: "custom-model",
    fetcher: async () => {
      calls++;
      return provider();
    },
  });
  assert.equal((await service.chat(request)).mode, "fallback");
  assert.equal(calls, 0);
  assert.equal(service.status().pricingConfigured, false);
  const configured = createIntelligence({
    apiKey: "fake",
    model: "custom-model",
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 8,
    fetcher: async () => provider(),
  });
  assert.equal((await configured.chat(request)).mode, "live");
  assert.equal(configured.status().usage.spentUsd, 0.0004);
});
test("timeout aborts provider, releases capacity, and preserves deterministic decision", async () => {
  const service = createIntelligence({
    apiKey: "fake",
    timeoutMs: 5,
    fetcher: async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const hold = setTimeout(() => reject(Error("unresponsive")), 1000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(hold);
          reject(Error("private provider timeout"));
        });
      }),
  });
  const reply = await service.chat(request);
  assert.equal(reply.mode, "fallback");
  assert.equal(reply.proposal?.decision?.choice, "collect");
  assert.equal(service.status().active, 0);
  assert.equal(service.status().usage.reservedUsd, 0);
  assert.ok(!reply.error?.includes("private provider"));
  assert.ok(service.status().usage.spentUsd > 0);
});
test("request payload carries purpose and bounded output schema without key in game data", async () => {
  let payload: Record<string, unknown> = {};
  const key = "fake-sensitive-key";
  const service = createIntelligence({
    apiKey: key,
    fetcher: async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      assert.ok(!String(init?.body).includes(key));
      return provider();
    },
  });
  await service.chat(request);
  assert.equal(payload.max_output_tokens, 400);
  assert.equal(payload.store, false);
  assert.match(String(payload.instructions), /autonomous planning cycle/);
  assert.equal(JSON.parse(String(payload.input)).purpose, "decision");
});

test("mocked live resident decision produces a validated physical shipment and remembered arrival", async () => {
  const { activateLives, getDecisionRequests } = await import("../src/lives");
  const { createPhysicalWorld, physicalResidentPosition } =
    await import("../src/physical");
  const { applyAction } = await import("../src/engine");
  const { pointAtLocation } = await import("../src/three/shared");
  let world = activateLives(createPhysicalWorld());
  world.location = "market";
  world.spatial!.player = pointAtLocation("market");
  world = applyAction(world, {
    id: "buy-for-ai",
    kind: "buy",
    resource: "medical",
    amount: 10,
  }).state;
  world.location = "warehouse";
  world.spatial!.player = physicalResidentPosition(world, "inez");
  world = applyAction(world, {
    id: "assign-for-ai",
    kind: "assign",
    target: "inez",
    resource: "medical",
    amount: 10,
  }).state;
  const req = getDecisionRequests(world).find((r) => r.characterId === "inez")!;
  assert.ok(validateConversationRequest(req));
  const collectIndex = req.context.availableActions.findIndex(
    (a) => a.decision?.choice === "collect",
  );
  assert.ok(collectIndex >= 0);
  const service = createIntelligence({
    apiKey: "fake-for-mock",
    fetcher: async () => provider(collectIndex),
  });
  const reply = await service.chat(req);
  assert.equal(reply.mode, "live");
  assert.equal(world.inventory.medical, 0);
  const proposal = { ...reply.proposal!, id: "validated-ai-pickup" };
  const accepted = applyAction(world, proposal);
  assert.equal(accepted.ok, true, accepted.message);
  world = accepted.state;
  assert.equal(world.inventory.medical, 0);
  assert.equal(world.spatial!.staged.medical, 0);
  assert.equal(world.spatial!.shipments.length, 1);
  assert.equal(world.lives!.inez.initiative?.source, "live");
  assert.equal(
    applyAction(world, { ...proposal, id: "duplicate-ai-trigger" }).ok,
    false,
  );
  for (let i = 0; i < 120 && world.inventory.medical < 10; i++) {
    const result = applyAction(world, {
      id: `ai-arrival-${i}`,
      kind: "advance",
      seconds: 5,
    });
    assert.equal(result.ok, true, result.message);
    world = result.state;
  }
  assert.equal(world.inventory.medical, 10);
  assert.equal(world.lives!.inez.assignment?.status, "complete");
  assert.ok(
    world.characters
      .find((c) => c.id === "inez")!
      .memories.some((m) => m.tags.includes("complete")),
  );
  for (const pending of getDecisionRequests(world))
    assert.ok(validateConversationRequest(pending));
});

test("null assignment decision consumes a safe offered decline rather than retrying forever", () => {
  const assignment = { ...context, availableActions: [collect, decline] };
  const reply = parseModelReply(
    '{"text":"I cannot commit to this right now.","actionIndex":null}',
    assignment,
    "decision",
  );
  assert.equal(reply.proposal?.decision?.choice, "decline");
  assert.equal(reply.proposal?.decision?.source, "live");
  assert.equal(reply.proposal?.resource, undefined);
  assert.equal(reply.proposal?.amount, undefined);
  const conversation = {
    ...context,
    availableActions: [
      {
        id: "ask",
        kind: "assign" as const,
        target: "inez",
        resource: "medical" as const,
        amount: 10,
      },
    ],
  };
  assert.equal(
    parseModelReply(
      '{"text":"Let us talk.","actionIndex":null}',
      conversation,
      "conversation",
    ).proposal,
    undefined,
  );
});

test("demo initiative speaks in character without repeating planning instructions", () => {
  const routine = {
    ...checkIn,
    decision: {
      ...checkIn.decision!,
      choice: "routine" as const,
      summary:
        "Inspect warehouse tools; take one practical supply run at a time.",
    },
  };
  const inez = demoDecision({ ...context, availableActions: [routine] });
  assert.match(inez.text, /I'll check the warehouse tools/);
  assert.doesNotMatch(inez.text, /Inspect warehouse/);
  const mara = demoDecision({
    ...context,
    name: "Mara Vale",
    availableActions: [routine],
  });
  assert.match(mara.text, /my patients/);
  assert.notEqual(mara.text, inez.text);
  const pickup = demoDecision(context);
  assert.match(pickup.text, /I'll pick up 10 medical kits/);
  assert.equal(pickup.proposal?.amount, 10);
  assert.equal(pickup.proposal?.decision?.summary, pickup.text);
});
test("demo check-in recalls latest nonconversation memory while evidence preserves relevance order and exact IDs", () => {
  const memories = [
    {
      eventId: "e19",
      hour: 2,
      text: "Ten medical kits arrived at the warehouse.",
      tags: ["complete"],
    },
    {
      eventId: "e12",
      hour: 4,
      text: "The player kept the clinic promise.",
      tags: ["promise"],
    },
    {
      eventId: "e1",
      hour: 1,
      text: "We met at the warehouse.",
      tags: ["meeting"],
    },
    {
      eventId: "e30",
      hour: 5,
      text: "I own a million boats.",
      tags: ["conversation"],
    },
  ];
  const reply = demoDecision({
    ...context,
    memories,
    availableActions: [checkIn],
  });
  assert.match(
    reply.text,
    /I remember this: “The player kept the clinic promise/,
  );
  assert.doesNotMatch(reply.text, /million boats|Acknowledge/);
  assert.deepEqual(
    reply.evidence
      ?.filter((e) => e.startsWith("Event"))
      .map((e) => e.match(/^Event (e\d+):/)![1]),
    ["e19", "e12", "e1"],
  );
  assert.match(
    demoDecision({ ...context, memories: [], availableActions: [checkIn] })
      .text,
    /I'll check the warehouse tools/,
  );
});
