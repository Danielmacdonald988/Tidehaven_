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
