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
