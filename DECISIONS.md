# Design decisions

- The simulation is a pure TypeScript reducer. Player actions and model proposals use the same validated action boundary. UI text never grants resources.
- The first story is 72 simulated hours in Bellwether, a fictional coastal town. Time advances through deliberate actions, not wall-clock timers. Residents act at bounded simulation thresholds while the player works elsewhere.
- Twelve authored people provide a reliable narrative foundation. Optional live AI interprets conversation and selects from engine-provided proposals. Demo dialogue is explicitly labeled.
- Character context includes public observations, their own knowledge and a bounded set of memories. No omniscient transcript is supplied.
- Checkpoints clone state. Rewind creates a new branch; original branch records remain available. Exact replay uses recorded state/output rather than asking a model to recreate history.
- Browser-local saves are for a single-player scenario, not a secure multiplayer authority. The engine owns rule enforcement; state is inspectable locally.
- Keys remain server-side. No key was present during initial implementation, so live provider verification is conditional on configuration.
- No public deployment. No external image/font CDN. Town artwork is bespoke SVG.
- Experimental mechanic generation is lower priority than the core six moments and will only be attempted after complete gameplay verification.

## 3D neighborhood

- Three.js renders a bounded neighborhood around the existing reducer; the original 2D edition remains at `?classic` with its original save namespace.
- Spatial mode is opt-in. Purchases create market-staged stock, dispatched workers carry a maximum of 10 units along fixed door/street routes, and warehouse stock is credited only at arrival. The player must load a ten-unit pack at the warehouse before delivering to the clinic/shelter.
- The renderer owns smooth visual movement; validated walk actions commit positions and elapsed time. An inflated-collider A* pathfinder uses exact swept-segment checks, with a regression test across every featured interior pair. Keyboard and mouse-only navigation share collisions.
- World geometry and character meshes are original procedural assets, with attribution in ASSETS.md. Repeated architecture is instanced; articulated character details are merged by material and pivot. No runtime external asset requests.
- Units are metres; player speed 3.2 m/s, worker speed 2 m/s. Sixty seconds of active physical movement/transit advances one simulation hour. Deliberate decisions retain their displayed hour costs. Idle reading is free, while dispatched workers keep moving in the active visible tab.
- Geometry, lights, fog, water and audio respond to the storm clock; exposed harbor access closes at hour 54. Camera orbit, click navigation and WASD operate without pointer lock.
- Performance target 60 FPS high / 30 FPS low. High uses shadows and up to 1.5 device-pixel ratio; low disables shadows and uses 1 pixel ratio. Actual browser samples are documented separately from targets.
- 3D saves contain authoritative physical state, checkpoints, archived branches and the latest 60 meaningful event snapshots. Recorded moments are read-only snapshots, not cinematic motion replay. Legacy exact action replay remains tested and available in the preserved 2D edition.

## 3.0 character intelligence

- Keep the existing direct HTTPS OpenAI Responses integration rather than adding a second provider or agent framework. Official SDK, model and structured-output documentation were checked; references are in AI-AUDIT.md.
- A player's assignment is a pending request. A separate resident decision accepts/refuses it; accepting reserves staged goods and starts the existing physical shipment. Model text never credits the warehouse.
- Decisions use exact offered action indices, stable event/routine triggers, current-state validation and saved source provenance. Null choices resolve to an offered no-effect check-in or refusal, preventing repeated polling and starvation.
- Background requests are serialized, spaced at least fifteen seconds apart and fenced by world generation. Discarded replies still update usage accounting. Render frames never call a model.
- Twelve authored routines and relationship networks supply context. Important memories outrank conversational noise; strangers do not receive global inventory/budget facts. Nearby witnesses receive sourced memories; raw dialogue is not proof.
- 3.0 supersedes the earlier idle-time rule: active gameplay advances time even while stationary; intro, field desk, evidence, replay and hidden tabs pause. This lets residents continue without requiring player commands.
- Retain scripted storm milestones alongside optional model choices. Routine travel updates logical destination before visual arrival; interactions are suppressed in transit. Cargo remains authoritative throughout its route.
- Credential setup is a hidden local terminal prompt, with no secret in commands or chat. USD limits are conservative per-process estimates, not provider account billing caps. Provider verification requires a real successful request, not merely a configured key.
