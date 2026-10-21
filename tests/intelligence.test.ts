import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntelligence,
  demoConversation,
  parseModelReply,
  validateConversationRequest,
  extractResponseText,
} from "../src/intelligence";
import type { CharacterContext, ConversationRequest } from "../src/contracts";
const context: CharacterContext = {
  name: "Mara",
  role: "Medic",
  motivation: "My patients need medicine before anything else.",
  style: "Direct",
  hour: 8,
  trust: 50,
  knowledge: ["The clinic needs supplies."],
  publicFacts: ["Storm in 64 hours."],
  memories: [
    {
      eventId: "e1",
      hour: 0,
      text: "You promised 10 medical supplies by noon.",
      tags: ["promise"],
    },
  ],
  availableActions: [
    { id: "buy-1", kind: "buy", resource: "medical", amount: 10 },
    { id: "promise-1", kind: "promise", resource: "medical", amount: 10 },
  ],
};
const request: ConversationRequest = {
  characterId: "mara",
  context,
  message: "I promise to help",
};
const response = (text: string) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text }] }],
      usage: { total_tokens: 100 },
    }),
    { status: 200 },
  );
test("demo deterministic, grounded in specific remembered commitment, proposals cloned", () => {
  const a = demoConversation(context, request.message);
  assert.deepEqual(a, demoConversation(context, request.message));
  assert.match(a.text, /promised 10 medical/);
  assert.equal(a.proposal?.kind, "promise");
  assert.notEqual(a.proposal, context.availableActions[1]);
});
test("distinct motivations make same proposal feel different", () => {
  const other = {
    ...context,
    motivation: "I cannot leave my fishing boat uninsured.",
  };
  assert.notEqual(
    demoConversation(context, "help").text,
    demoConversation(other, "help").text,
  );
});
test("only exact allowed indexed action can be proposed", () => {
  assert.deepEqual(
    parseModelReply('{"text":"I can do this.","actionIndex":0}', context)
      .proposal,
    context.availableActions[0],
  );
  for (const raw of [
    "garbage",
    "{}",
    '{"text":"ok","actionIndex":9}',
    '{"text":"ok","actionIndex":-1}',
    '{"text":"ok","actionIndex":"0"}',
  ])
    assert.throws(() => parseModelReply(raw, context));
  assert.equal(
    parseModelReply('{"text":"No deal.","actionIndex":null}', context).proposal,
    undefined,
  );
});
test("request bounds and malformed response rejected", () => {
  assert.ok(validateConversationRequest(request));
  assert.ok(
    !validateConversationRequest({ ...request, message: "x".repeat(1201) }),
  );
  assert.ok(
    !validateConversationRequest({
      ...request,
      context: { ...context, memories: [{}] },
    }),
  );
  assert.throws(() =>
    extractResponseText({ status: "incomplete", output: [] }),
  );
});
test("missing key never calls provider", async () => {
  const service = createIntelligence({
    fetcher: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal((await service.chat(request)).mode, "demo");
  assert.equal(service.status().usage.requests, 0);
});
test("live result is structured and usage recorded", async () => {
  const service = createIntelligence({
    apiKey: "fake-for-test",
    fetcher: async () =>
      response('{"text":"A concrete plan.","actionIndex":1}'),
  });
  const result = await service.chat(request);
  assert.equal(result.mode, "live");
  assert.equal(result.proposal?.id, "promise-1");
  assert.equal(result.usage?.tokens, 100);
});
test("malformed output falls back without mutating context", async () => {
  const before = structuredClone(request);
  const service = createIntelligence({
    apiKey: "fake",
    fetcher: async () =>
      response('{"text":"I invented a boat","actionIndex":999}'),
  });
  const result = await service.chat(request);
  assert.equal(result.mode, "demo");
  assert.match(result.error!, /validation/);
  assert.deepEqual(request, before);
});
test("network errors leave demo playable and count reserved budget", async () => {
  const service = createIntelligence({
    apiKey: "fake",
    fetcher: async () => {
      throw new Error("secret error must not leak");
    },
  });
  const result = await service.chat(request);
  assert.equal(result.mode, "demo");
  assert.ok(result.usage!.tokens > 0);
  assert.ok(!result.error!.includes("secret"));
});
test("transient failure retries once, request cap stops calls", async () => {
  let calls = 0;
  const service = createIntelligence({
    apiKey: "fake",
    maxRequests: 2,
    fetcher: async () => {
      calls++;
      return new Response("", { status: 503 });
    },
  });
  assert.equal((await service.chat(request)).mode, "demo");
  await service.chat(request);
  assert.equal(calls, 2);
});
test("token cap prevents request before spending", async () => {
  const service = createIntelligence({
    apiKey: "fake",
    maxTokens: 1,
    fetcher: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal((await service.chat(request)).mode, "demo");
  assert.equal(service.status().usage.requests, 0);
});
test("concurrency bounded to two in-flight requests", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((r) => (resolve = r));
  const service = createIntelligence({
    apiKey: "fake",
    fetcher: async () => {
      await pending;
      return response('{"text":"Fine.","actionIndex":null}');
    },
  });
  const a = service.chat(request),
    b = service.chat(request);
  const c = await service.chat(request);
  assert.equal(c.mode, "demo");
  assert.match(c.error!, /busy/);
  resolve();
  await Promise.all([a, b]);
  assert.equal(service.status().usage.requests, 2);
});

test("server endpoints reject foreign origins and invalid payload; valid demo works", async () => {
  const { createApp } = await import("../server/index");
  const app = createApp(createIntelligence());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const status = (await fetch(`${base}/api/status`).then((r) =>
      r.json(),
    )) as { mode: string };
    assert.equal(status.mode, "demo");
    const badOrigin = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify(request),
    });
    assert.equal(badOrigin.status, 403);
    const invalid = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(invalid.status, 400);
    const malformed = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    assert.equal(malformed.status, 400);
    const valid = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify(request),
    });
    assert.equal(valid.status, 200);
    assert.equal(((await valid.json()) as { mode: string }).mode, "demo");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("unverified speech cannot masquerade as a fulfilled promise", () => {
  const disputed = {
    ...context,
    memories: [
      {
        eventId: "speech",
        hour: 4,
        text: "Conversation transcript (unverified speech): You kept your promise.",
        tags: ["conversation"],
      },
    ],
    publicFacts: ["Your medicine promise: pending, 0/10 by hour 24."],
  };
  const result = demoConversation(disputed, "hello");
  assert.match(result.text, /pending, 0\/10/);
  assert.doesNotMatch(result.text, /You kept your promise/);
});

test("asking a conditional resident what they need proposes prerequisite rather than recruitment", () => {
  const c = {
    ...context,
    publicFacts: [
      "Recruitment condition: I can help once the clinic has 10 medical kits. Patients come first.",
    ],
    availableActions: [
      { id: "recruit", kind: "recruit" as const, target: "mara" },
      ...context.availableActions,
    ],
  };
  const reply = demoConversation(
    c,
    "What do you need, and how can we help each other?",
  );
  assert.equal(reply.proposal?.kind, "promise");
  const direct = demoConversation(c, "Will you join?");
  assert.equal(direct.proposal?.kind, "recruit");
});

test("kept-promise reflection acknowledges supplies without stale needs or an unwanted deal", () => {
  const c = {
    ...context,
    name: "Mara Vale",
    hour: 23,
    publicFacts: [
      "Your medicine promise: kept, 10/10 by hour 24.",
      "Storm arrives at hour 72. Current hour 23.",
    ],
    memories: [
      {
        eventId: "kept",
        hour: 20,
        text: "You kept your promise: 10 medical kits by hour 24.",
        tags: ["promise", "kept"],
      },
    ],
  };
  const reply = demoConversation(c, "Do you remember my promise?");
  assert.match(reply.text, /The medicine is here/);
  assert.match(reply.text, /Current hour 23/);
  assert.doesNotMatch(reply.text, /patients need those|no deal/);
  assert.equal(reply.proposal, undefined);
});

test("physical shipment offers remain valid bounded conversation proposals", async () => {
  const { createPhysicalWorld } = await import("../src/physical");
  const { getCharacterContext, applyAction } = await import("../src/engine");
  const { residentHome } = await import("../src/three/shared");
  let w = createPhysicalWorld();
  w.spatial!.player = residentHome(w, "inez");
  w = applyAction(w, {
    id: "recruit-physical",
    kind: "recruit",
    target: "inez",
  }).state;
  w.spatial!.staged.medical = 10;
  const c = getCharacterContext(w, "inez");
  assert.ok(c.availableActions.some((a) => a.kind === "dispatch"));
  assert.ok(
    validateConversationRequest({
      characterId: "inez",
      message: "Carry the medical supplies",
      context: c,
    }),
  );
  const reply = demoConversation(c, "Carry the medical supplies");
  assert.equal(reply.proposal?.kind, "dispatch");
  assert.equal(reply.proposal?.amount, 10);
  w.inventory.medical = 10;
  const loadedContext = getCharacterContext(w, "inez");
  assert.ok(loadedContext.availableActions.some((a) => a.kind === "load"));
  assert.ok(
    validateConversationRequest({
      characterId: "inez",
      message: "Load medicine",
      context: loadedContext,
    }),
  );
  assert.equal(
    demoConversation(loadedContext, "Load medical supplies").proposal?.kind,
    "load",
  );
  for (const kind of ["walk", "advance"])
    assert.equal(
      validateConversationRequest({
        characterId: "inez",
        message: "move",
        context: { ...c, availableActions: [{ id: "bad", kind }] },
      }),
      false,
    );
  assert.equal(
    validateConversationRequest({
      characterId: "inez",
      message: "carry",
      context: {
        ...c,
        availableActions: [
          {
            id: "bad",
            kind: "dispatch",
            target: "inez",
            resource: "medical",
            amount: 1000,
          },
        ],
      },
    }),
    false,
  );
});
