# 3.0 integration contract

Root owns contracts.ts, docs, cross-module verification. World agent owns engine.ts, physical.ts, persistence.ts, scenario.ts, new lives.ts and world tests. AI agent owns intelligence.ts, server/**, .env.example and AI tests. Experience agent owns App3D.tsx, three/Scene.tsx, three/Residents.ts, three.css. No overlapping writers.

Contracts additions already committed to working tree:

- IntelligenceMode live|demo|fallback; AIUsage optional spending fields.
- ConversationRequest.purpose conversation|decision (optional for legacy). Same /api/chat endpoint.
- CharacterContext optional priorities,relationships,routine,decisionTrigger.
- Action assign: target resident, resource, amount <=10; player requests pickup in person. Validated engine records assignment. No free goods; resident chooses what to do later.
- Action resident_act: actor resident ID, target same resident, resource/amount when collect; decision {triggerId,choice collect|decline|routine|check_in,source,summary}. Only engine-generated available choices, parsed model returns indexed choice. Engine rechecks against current state; no arbitrary economic effects.
- World.lives optional Record<string,ResidentLife> as defined in contracts.ts. Old saves migrate without breaking classic.

World module API: activateLives(world):World pure clone/migration; getDecisionRequests(world):ConversationRequest[] bounded due/event-driven decisions, contexts grounded in own knowledge; routineDescription(world,id):string optional convenience. Export these from lives.ts. getCharacterContext remains engine export; improve relevant retrieval and knowledge boundaries there.

UI: activateLives on initial load/new branch/import; bounded scheduler one request at a time, at least15seconds between background decisions, decision contexts regenerate at dispatch. Disable in replay/intro/ended; generation fence on rewind/import; resident responses go through applyAction. Decision text recorded even null choice via bounded check_in candidate if appropriate. Rendering never waits for requests. Display live configured vs real verified status fromserver; lastreply mode explicitfallback. Initiatives only shown within speaking distance, not global chatter. Explicit in-person assignment optional button plus natural conversation proposal.

AI: existing OpenAI Responses REST integration retained; no credential present. Verify official docs; add configurable concurrency and conservative USD request reservation, label fallback distinct, track successful live requests (not just configured key). Decision purpose prompt chooses offered resident actions; demo chooses bounded deterministic option and labelleddemo. Never invent action params. Add request-purpose validation and new action shapes.

Scope: first convincing Inez pickup assignment, plus allcast contextualpriorities/routines/eventreaction. No claiming live verified without actual provider response. Caller state is local single-player authority; no multiplayer security claims.
