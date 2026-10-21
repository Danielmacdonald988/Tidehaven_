# AFTERLIGHT — 3D neighborhood handoff

## Current implementation

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

- Demo is explicitly deterministic. Existing optional server-side OpenAI conversations remain available with `.env.local` configuration described in README. No actual upstream request was verified without credentials. Resident autonomy is rule-based even with live conversation enabled.
- Physical goods are staged at the market, reserved on dispatch, carried in ten-unit trips, and credited only on arrival. Player delivery requires loading a ten-unit pack at the warehouse.
- Recorded 3D moments are authoritative snapshots, not cinematic motion replay. Classic exact replay remains preserved and tested.
- Vehicles are scene props plus existing validated transport capacity; drivable vehicle physics and animated vehicle cargo routes are not implemented.
- Single-player local saves are structurally validated, not tamper-proof. No public deployment or paid assets.
- Performance samples are short rolling measurements on Apple M4 Chrome, not a sustained low-end-device benchmark.
- Mechanic generation remains deferred. Next scope should be broader human playtesting before expanding the neighborhood.

## Verification record

Original 2D release: 38 tests; real desktop successful and neglected strategies, changed-decision rewind, event inspection and 390×844 browser inspection.

3D release verification is appended below after the final production playthrough and test run.

### Final 3D verification

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
