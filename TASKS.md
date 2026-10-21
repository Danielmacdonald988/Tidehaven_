# Current milestone — Connected coastal region

Checkpoint before expansion: `checkpoint-living-coast-67c9934`. Shared interfaces and ownership: [REGION-CONTRACT.md](REGION-CONTRACT.md).

- Lead: region App/Scene/map/resident AI, integration, actual browser verification and final quality.
- World agent: connected harbor/wetlands architecture, roads, interiors, physical activity consequences and asset provenance.
- Vehicle agent: one detailed Coast Runner, deterministic handling, safe exits/recovery, mouse driving, engine/tire/impact audio and vehicle tests.
- Simulation agent: persistent region state, three optional activities, memories/commitments, 12 routines, yielding traffic, bounded navigation extension, migration and integration tests; independent integration review.

Implemented: preserved town and six-species loop, three connected districts, owned vehicle, 12 physical residents, lightweight yielding traffic, physical cargo delivery, companion-assisted wetland passage and relic, dockside escort, two paid base upgrades, map, contextual resident conversations and deliberate legacy mission launch.

- [x] Recoverable original-build checkpoint and explicit ownership.
- [x] Backward-compatible navigation extension and save migration without overwriting legacy keys.
- [x] Delivery, expedition and assistance effects validated and rewarded once.
- [x] Persistent promise kept/broken outcomes and sourced memories.
- [x] Continuous automated actual-terrain driving/delivery/home-handoff integration.
- [x] Population/traffic boundedness, companion boundary crossing, save validation and migration checks.
- [x] Combined browser playthrough, live memory recall, reload, mobile layout, performance samples and screenshots.
- [x] Production build, regression suite and recoverable release checkpoint after browser repairs.

**Current verification: 166 tests and production build pass.** See [REGION-RELEASE.md](REGION-RELEASE.md) for actual browser evidence and known scope limits. No agent work remains running. Earlier completed-release records follow.

---

# Current milestone — The Living Coast

Shared interfaces and ownership were established in [WILDLIFE-CONTRACT.md](WILDLIFE-CONTRACT.md) before parallel implementation.

- Lead: default routing, world staging, Scene/App, controls, integration and actual browser playtesting.
- Creature art agent: six original articulated models, animations and asset provenance.
- Wildlife engine agent: deterministic habitats, encounters, companion navigation, ability validation and engine tests.
- Journal/audio/verification agent: compact model journal, procedural sound, isolated persistence, independent full-chain tests, read-only integration review and current docs.

Completed implementation: six physical species; encounter greetings and resonance; one active following companion; tracks, obstruction and light abilities; weather-driven appearances and authored rare reveal; independent collection autosave; optional bounded AI animation reactions; preservation of rescue/campaign.

Release verification: **139 tests pass; production build passes.** Actual Chrome play completed all six species, all three abilities, rare reveal, companion following, collection reload and archive/restore. Real bounded companion AI request verified. Desktop and mobile layouts inspected; measured performance and remaining limits are recorded in the release notes.

- [x] First physical encounter → companion → ability → save/load.
- [x] All six species and deterministic rare encounter.
- [x] Isolated saves, duplicate rejection, archive recovery and complete collision-safe chain.
- [x] Actual browser six-species playthrough and real AI response.
- [x] Mobile journal and encounter inspection; High/Low measurements; screenshots.
- [x] Integration fixes, final regression/build and release handoff.

See [WILDLIFE-RELEASE.md](WILDLIFE-RELEASE.md) for measured performance and precise verification boundaries. Earlier milestone records follow.

---

# AFTERLIGHT release status

## Ownership

- Lead/integration: contracts, setup, persistence, browser playthroughs, integration, docs.
- Simulation agent: engine/scenario and simulation tests.
- Experience agent: React interface, SVG map, CSS, navigation, replay/branch UI.
- Intelligence/verification agent: server/demo/live adapter, adversarial and UI-offer gameplay tests.

Shared interfaces established before parallel edits. Agents had disjoint file ownership; integration fixes were routed to owners. All work is integrated; no agent continues after delivery.

## Milestones

- [x] 1 — Complete deterministic scenario: 12 residents, locations, 72h clock, resource economy, beginning and outcome.
- [x] 2 — Optional live conversation/structured proposals, demo fallback, persistent promises. Provider-mocked and local HTTP verified; actual upstream call awaits credentials.
- [x] 3 — Autonomous activity, inspectable evidence, autosave/export/import, checkpoints, rewind, preserved branches, exact snapshot replay.
- [x] 4 — Chrome success/failure playthroughs, changed-decision rewind, desktop and 390×844 mobile inspection, mobile conversation deal, reload verification. Build and 38 tests pass.
- [ ] 5 — Experimental mechanic generation deferred; not included or advertised as implemented.

## Verification findings resolved

- Broken promises now change recruitment requirements.
- Personal bread donation debits resident inventory and moves the resident.
- Conversation offers include real local supply/transport actions.
- Transcript text is stored but never promoted into authoritative knowledge.
- Long memories remain valid bounded API input.
- Malformed/null proposals fail safely; late deliveries respect completion time.
- SVG map buttons exposed to accessibility, click targets separated from people.
- Departing residents leave the interaction panel; stale async replies cannot mutate a changed branch.
- Mobile touch navigation, visible resources, dialog focus, state-aware promise dialogue, deep save validation.

# 3D neighborhood milestone

Shared 3D contracts in src/three/shared.ts, simulation contracts remain src/contracts.ts.

- Lead: src/three/Scene.tsx, navigation.ts, App3D.tsx, three.css, integration/browser testing, docs.
- Environment agent: src/three/Environment.ts, ASSETS.md. Detailed walkable coastal neighborhood, colliders and interactive physical props.
- Character agent: src/three/Residents.ts, src/three/audio.ts. Detailed articulated residents, purposeful movement, layered audio.
- Simulation agent: contracts.ts (spatial additions only), engine.ts, persistence.ts, src/physical.ts, tests/physical.test.ts. Queued purchases, capacity-limited deliveries, physical-time advance and old-test preservation.
  All files had a single writer. Integration fixes were routed to owners.

- [x] Walkable coastal neighborhood, open interiors, twelve animated residents, atmosphere/audio and lower graphics mode.
- [x] Validated physical supply loop, ten-unit capacities and remembered promises.
- [x] Preserved classic edition, saves, partial shipments, branching and read-only snapshots.
- [x] Browser success run, broken-promise rewind, mobile layout and measured performance.
- [x] Collision corner regression, cutaway occlusion fixes, stale AI reply and replay mutation guards.

# 3.0 character intelligence

Shared additions and file ownership established in V3-CONTRACT.md before parallel implementation.

- Intelligence agent: Responses conversation/decision adapter, budgets, provenance, safe smoke and provider tests.
- World agent: assignments, validated choices, routines, relationships, witnessed knowledge, sourced memories and replay tests.
- Experience agent: async scheduler, nearby initiatives, contextual encounter details and request UX.
- Lead: shared contracts, secure local setup, end-to-end tests, actual browser playthrough, integration and docs.

- [x] Audit scripted versus model-backed behavior.
- [x] Pending task → resident choice → real shipment → remembered completion.
- [x] Bounded routine/known-event decisions with distinct priorities and relationships.
- [x] Explicit demo/live/fallback and configured-versus-verified status.
- [x] Configurable request/token/concurrency/USD limits and safe credential setup.
- [x] Mocked provider integration, invariant tests, typecheck and production build.
- [x] 84 passing tests and actual Chrome demo assignment, independent delivery, remembered completion, fulfilled promise and mobile evidence inspection.
- [x] Actual upstream request/effect verification subsequently completed in 4.0 with the user-configured credential.

# 4.0 — The Last Good Road

Ownership established in V4-CONTRACT.md before implementation: gameplay engine/campaign; world presentation/audio; character intelligence followed by independent strategy tests; lead UI/integration and actual browser play.

- [x] Inspect and play 3.0 before choosing improvements.
- [x] Connected opening, alternative supply/transport choices, shelter work and route consequences.
- [x] Three central character stakes, reliable information sharing and recoverable trust.
- [x] Pause, exploration mode, no deadline consumption during dialogue or AI wait, explicit work costs.
- [x] Stateful van/cots/stock/obstruction/aftermath, material and audio pass.
- [x] Live repair proposal and live market cooperation verified against engine effects.
- [x] Independent automated alternate-strategy and failure/recovery playtests.
- [x] Final complete browser campaign, mobile polish, 111 passing tests, production build and release checkpoint.

# Storm rescue presentation milestone

- [x] Audit actual campaign and establish RESCUE-CONTRACT.md ownership.
- [x] Authoritative physical rescue, alternate entrance, assistance, collapse, escort and checkpoints.
- [x] World weather/power/collision/aftermath, original storm rigs and spatial synthesized audio.
- [x] Focused camera, acceleration, context actions, preserved campaign/AI and separate save.
- [x] Live AI assistance verified in browser; complete assisted rescue and aftermath.
- [x] 121 tests pass, production build, desktop/mobile controls and short performance samples.
- [ ] Timed human pacing study against 5–8-minute target; optimal route is shorter.
