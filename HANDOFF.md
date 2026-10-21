# Current: storm rescue presentation milestone

Default entry is RescueApp; campaign retained at ?campaign, classic at ?classic. See RESCUE-RELEASE.md and RESCUE-CONTRACT.md. Build/server commands unchanged. Existing production server serves port3001. Never read/print .env.local; live AI verified through actual rescue instruction.

121 tests pass; complete physical assisted and alternate-route browser rescues, save reload and desktop/mobile checks completed. Target5–8min remains human-pacing validation work; optimal route2–3min. Rigged characters and sound are authored procedural assets, not imported mocap/voiceacting. No new secrets, purchases or deployment.

Next useful work is human feel/pacing assessment, then higher-fidelity character assets and more detailed action staging within this sequence—not additional management systems.

---

# AFTERLIGHT 4.0 — current handoff

The Last Good Road is implemented around the existing neighborhood and verified server-side AI. The former 3.0 credential blocker below is historical: a user-supplied ignored .env.local now configures OpenAI, and actual repair/cooperation requests have succeeded. Never read or print its contents.

Launch remains `npm run dev` (5173) or build/start (3001), one API server at a time. During this session the existing tsx watcher serves API and production dist at 3001. Secrets remain server-side. New chapter preserves old saves through archived responses.

Current changes and scope: see RELEASE-4.md. Shared interfaces and single-writer ownership: V4-CONTRACT.md. Main UI owns pause/explore, queued navigation after closing overlays, compact project requirements, costs, checkpoints and aftermath. campaign.ts/engine.ts own every resource effect, clock and deadline. Model actions use explicit zero-based indices and strict offered-action validation.

Release verified: 111/111 tests, production build, complete Chrome campaign, real model effects, mobile layout, checkpoint rewind with alternate salvage and preserved outcome. See RELEASE-4.md for exact evidence and measured performance. Old records below are historical.

Next useful work: longer human pacing sessions, stronger character art/animation and vehicle/passenger staging, then 3D bundle splitting. No agent work remains running. No deployment was performed.

---

# AFTERLIGHT 3.0 — character intelligence handoff

## Current implementation

3.0 adds pending in-person assignments, independent resident decisions, sourced completion memories, twelve routines and relationship profiles, nearby initiatives, and explicit live/demo/fallback provenance. Models choose only engine-generated actions. Missing credentials leave the whole game in deterministic demo; no real provider response was verified during this session.

The default experience is a Three.js coastal neighborhood around the existing React/TypeScript simulation. The original 2D scenario remains at `?classic`, with its original saves preserved. Twelve articulated residents, accessible interiors, mouse-only pathfinding, optional WASD, camera controls, storm effects, synthesized audio, graphics settings, and physical relief deliveries are integrated.

## Launch

```sh
npm install
npm run dev       # UI http://127.0.0.1:5173; API http://127.0.0.1:3001
npm test
npm run build
npm start         # production http://127.0.0.1:3001; stop dev first
```

During development the already-running API also serves the latest production build at port 3001. Do not start a duplicate server on that port.

## Architecture and ownership

- `src/three/shared.ts`: physical coordinates, routes and rendering contracts.
- `src/physical.ts`, `engine.ts`: authoritative spatial actions, capacities, staging, collection, arrival and carried inventory.
- `src/three/Environment.ts`: original instanced architecture, props, cutaway interiors, weather.
- `src/three/Residents.ts`: original articulated people and goal-driven movement.
- `src/three/Scene.tsx`, `navigation.ts`: render loop, camera, collision and pathfinding.
- `src/App3D.tsx`: compact encounters, saves, checkpoints, evidence and UI integration.
- `ASSETS.md`: original asset provenance and software licenses.

## Important boundaries

- Demo is explicitly deterministic. Existing optional server-side OpenAI conversations remain available with `.env.local` configuration described in README. No actual upstream request was verified without credentials. Storm milestones remain authored; 3.0 adds optional model-backed bounded task/routine choices.
- Physical goods are staged at the market, reserved on dispatch, carried in ten-unit trips, and credited only on arrival. Player delivery requires loading a ten-unit pack at the warehouse.
- Recorded 3D moments are authoritative snapshots, not cinematic motion replay. Classic exact replay remains preserved and tested.
- Vehicles are scene props plus existing validated transport capacity; drivable vehicle physics and animated vehicle cargo routes are not implemented.
- Single-player local saves are structurally validated, not tamper-proof. No public deployment or paid assets.
- Performance samples are short rolling measurements on Apple M4 Chrome, not a sustained low-end-device benchmark.
- Mechanic generation remains deferred. Next scope should be broader human playtesting before expanding the neighborhood.

## Verification record

Original 2D release: 38 tests; real desktop successful and neglected strategies, changed-decision rewind, event inspection and 390×844 browser inspection.

3D release verification is appended below after the final production playthrough and test run.

### Previous 2.0 verification

- **54/54 automated tests pass**; TypeScript and production build pass. Vite reports the expected large Three.js bundle warning (~631 KB minified /169 KB gzip for the 3D chunk).
- Real Chrome production playthrough completed Inez recruitment → Mara promise → Eli conversation proposal → $800 purchase → staged stock → worker pickup/carry → warehouse arrival → pack loading → physical clinic delivery → Mara remembers kept promise, trust75.
- Reload during an active shipment preserved its progress; warehouse stock stayed zero until arrival. Screenshots inspected at warehouse, market, clinic and waterfront; visible carried crate observed at warehouse threshold.
- Rewound hour4.4 checkpoint, missed the deadline, confirmed Mara's specific broken-promise dialogue/trust25. Original kept response preserved. Continued neglected branch to hour72 outcome (12 people safe).
- Recorded purchase snapshot showed its own resources/position; clicking ground did not move during replay. Evidence inspector showed original promise event,0/10 delivery,deadline and trust-25.
- 390×844 browser viewport inspected: checkpoints, snapshot, resident encounter and broken-promise dialogue. This was desktop emulation, not a physical phone. Viewport restored.
- Camera rotation/zoom and optional held-W movement exercised. Doorway and interior routes checked in browser and against real colliders in tests; exact endpoint snapping fixes corner skipping.
- Late storm rain/lighting/gate inspected; player caught outside could retreat inland, then harbor reentry refused. Physical tests cover egress/reentry rules.
- Production warehouse sample on Chrome/AppleM4/ANGLE: High60FPS,p9517.5ms,2565×1213pixels,828draws/126070triangles; Low60FPS,p9517.5ms,1710×809,431draws/69546triangles. Short rolling samples; later boat detail adds a small draw cost. No sustained low-end benchmark.
- Audio mute/unmute controls exercised; no claim of independently listening to the output. No real upstream AI request.
- Browser left at First light for user play, with successful and neglected test checkpoints/branches preserved. No agents continue after delivery.

## 3.0 launch and secure activation

The local production build remains at http://127.0.0.1:3001; dev command and ports above are unchanged. Run `npm run setup:ai` in the user's own terminal for hidden project-key entry, then restart the server. Run `npm run smoke:ai` to verify a real Responses call against the assignment/shipment engine fixture. The smoke is bounded to one call and a $0.05 conservative local reservation; without a key it reports SKIPPED before network access. Never ask for a key in chat.

3.0 files: `lives.ts` owns choice construction, routines and assignment lifecycle; the existing engine validates and records effects. `intelligence.ts` owns bounded Responses transport and strict indexed parsing. `App3D.tsx` schedules background decisions at least fifteen seconds apart, with one client request in flight, independently of rendering. `evidence.ts` resolves exact event IDs (never substring matching). `AI-AUDIT.md` records original scripted behavior, integration boundary and official documentation sources.

## 3.0 verification

- **84/84 tests pass**, TypeScript clean, production build passes. Three.js bundle warning remains (~638 KB minified 3D chunk).
- Actual Chrome demo playthrough: buy 10 medical kits for $800 → free-text request to Inez → accept proposed assignment → walk to Mara → Inez independently accepts, staff 0→1, reserves staged stock and carries 10 kits → warehouse inventory 0→10 → nearby Inez initiative and later dialogue recall the specific completed pickup.
- Continued browser play: loaded the delivered kits, carried them to the clinic, fulfilled Mara’s promise (trust 75), and inspected the exact kept-promise event e36 and its causal evidence. Inspected encounters and evidence at 390×844; desktop viewport restored. Saved the successful 3.0 checkpoint at hour 17.1.
- Mocked provider tests cover the same complete economic/physical path using strict Responses decoding; this is explicitly not a real provider call.
- Fixed exact evidence resolution (e1 must not match e10/e100), null-choice scheduler starvation, stale-world response fencing and usage accounting, plus visible request contention/draft preservation.
- Reviewed secret handling: production bundles have no key, key environment variable, provider endpoint, dotenv or source maps. Setup refuses noninteractive input and symlinks and writes mode 0600. No secret was entered or created.
- `npm run smoke:ai` actually returned SKIPPED because no project/inherited key exists; upstream response quality, latency and behavior remain unverified.

## Remaining limitations and next actions

1. Essential external action: user configures their credential with `npm run setup:ai`; restart and run smoke, then play a live Inez assignment before calling AI connected.
2. Model decisions are bounded task acceptance/refusal, known-event check-ins and routine alternatives. Storm milestones, prices and trust rules remain authored. This is not arbitrary agent code generation.
3. Routine destination changes logically before its visual walk completes; UI suppresses in-transit encounters. Supply shipments retain authoritative intermediate position/capacity and arrival effects.
4. Active gameplay now advances time while idle. Field desk, evidence, intro, replay and hidden tabs pause. No offline simulation.
5. USD caps use configured text token prices and reset with the server process; not an account-wide billing cap. Unknown models require explicit rates.
6. Current campaign memory/history is adequate for the bounded 72-hour scenario; larger campaigns need storage pruning and deeper evaluation. No new public deployment.
