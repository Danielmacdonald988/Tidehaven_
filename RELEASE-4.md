# AFTERLIGHT 4.0 — The Last Good Road

## What changed and why

The 3.0 browser opening asked for recruitment before showing a concrete problem. After medicine delivery its guidance became vague. Routine AI calls interrupted the first conversation, and reading silently spent deadlines. This release keeps the small coastal world and real shipments, replacing that weak progression with a connected scenario.

- Inspect the stranded van beside your starting position. Repair it with Inez for $800 and four hours, gaining transport/fuel and her help; or salvage ten medical kits in one hour and solve transport another way.
- Carry medicine to Mara. Promises are optional; kept or broken commitments still affect future cooperation. A missed promise can be repaired through actual additional aid without erasing history.
- Show Eli the clinic receipt for pooled supplies, trade fuel for his generator, or buy stock normally. Acquired stock must physically reach the warehouse.
- Prepare Cypress sleeping places, then organize a supply run. Two idle helpers finish faster; solo work costs more time. Busy carriers cannot simultaneously staff another job.
- Clear the freight lane or accept the slower, more fuel-intensive evacuation route. Harbor access closes at hour 54, announced from the outset.
- Shelter through landfall at Cypress after hour 54. The aftermath explains clinic, shelter, evacuation, cooperation and promises; inspect the changed world or branch from a checkpoint.

## Fair time and controls

Normal active campaign time: one simulated hour per 20 seconds, plus displayed action costs. Reading encounters, project panels, the field desk and evidence pauses deadlines. API requests also pause time. Conversations themselves cost 0 campaign hours. Exploration mode lets you walk without advancing time or deliveries. Work and explicit waits always take their shown hours and advance real shipments. Pause/Resume and Space stop movement/time; Escape closes panels. Camera sensitivity is adjustable. Target 20–30 minutes is a design target, not a claim of a timed human study.

## AI and authority

The existing server-side OpenAI integration remains intact. Character replies select an explicitly numbered action from the engine’s current offers; the engine validates it again on acceptance. The UI displays the actual proposed action. No heuristic rewrites a model’s choice. Routine opening chatter has been removed from campaign scheduling; assignments, meaningful known events and three relocation milestones trigger independent decisions. Three central residents have stronger stakes, obligations, boundaries and relationship context. Eli learns of clinic aid through the recorded receipt interaction, not remote overhearing.

## Presentation

Original authored coastal architecture is preserved. Added a stateful relief van with hood/cargo/tools, shelter frames/cots/provisions, market ledger, road debris with pedestrian bypass, and aftermath debris. Seeded procedural surface textures ground the road, terrain, wood and paint. Central residents have distinct work/idle gestures. Spatial surf attenuation and indoor muffling complement the existing optional weather audio. No downloaded art or paid assets.

## Known scope

This is one neighborhood, not a larger map. Repairs, shelter work and evacuation are validated time jumps rather than minigames or animated passenger trips. The van is not drivable. Work can complete an actual shipment between rendered frames; its inventory and recorded arrival are authoritative. The normal scenario can be accelerated by explicit waiting. Balance has automated alternate-strategy coverage; longer human playtests remain useful. Live models can still choose an unexpected offered action, and every proposed choice is shown before acceptance. Generation of new mechanics remains deferred.

## Measured performance
Chrome on Apple M4 / ANGLE, Cypress House at hour 24.7: High 60 FPS, p95 17.5ms, 638 draws and 119,580 triangles at 2565×1213 render pixels. Low 60 FPS, p95 17.3ms, 120 draws and 37,598 triangles at 1710×809. These are two-second rolling samples, not a sustained benchmark or a physical-phone measurement. Desktop and 390×844 emulated layouts were inspected; settings, shelter work and supply acceptance were actually exercised at mobile size.

## Release verification

- `npm test`: 111/111 pass; `npm run build`: TypeScript and production build pass. Vite reports a non-blocking 651 KB minified 3D chunk warning.
- Actual Chrome campaign: inspect/repair van, carry medicine, keep Mara's promise, recruit, live Eli cooperation, independently accepted pickup and authoritative deliveries, cots and stock, clear road, three evacuation trips, storm ending and playable aftermath. Player trips moved 36 residents; independent efforts brought the final total to 48. Final funds $8,200, clinic supplied, shelter stocked, one promise kept.
- Browser reload preserved state. Saved final checkpoint; rewound to First light and chose salvage instead: $10,000, ten carried kits, no recovered van fuel. Original completed response remained in comparison. Inspected salvage facts, constraints and resource effects in Evidence.
- Real upstream repair proposal verified through local API plus engine application; actual browser live cooperation and independent worker acceptance also verified. Credentials never exposed.
- Desktop and emulated mobile inspected; performance measurements above are short desktop samples. This was a tool-driven playthrough, not a timed 20–30-minute human usability study. Audio controls were inspected; no subjective listening quality claim.
