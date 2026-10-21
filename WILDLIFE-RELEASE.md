# AFTERLIGHT — The Living Coast

The next milestone makes observing and befriending original creatures the primary loop. The existing coastal neighborhood becomes an unhurried habitat with footprints, calls, water, canopy movement and changing weather. All six species exist in the scene; collection happens through a physical approach, a species-appropriate greeting and a gentle resonance pulse.

## Launch and controls

Run `npm run dev`, then open **http://127.0.0.1:5173**. Production: `npm run build`, then `npm start`, at **http://127.0.0.1:3001**. Reuse a running server rather than starting a duplicate on the same port.

- Click the ground to walk; click a creature to approach it.
- Offer the contextual greeting, then release resonance when it responds. Timing assistance starts enabled and can be changed in Options.
- Drag to turn the camera, scroll to zoom. WASD is optional; mouse-only play is supported.
- Open the field journal to choose one bonded companion. Nearby contextual actions let companions change the world.
- Space pauses; J opens the journal. Sound starts muted; Options provides volume, camera sensitivity and Low graphics.
- Rest at the weather bench to change conditions. Exploration has no rescue countdown.

Look and listen before rushing closer. Different habitats and weather invite different creatures. The rare encounter is foreshadowed through the environment; its exact location is intentionally omitted here.

## Implemented scope

Six original species have individual silhouettes, animated rigs, habitats, behaviors, calls and modest seeded cosmetic variations. Brindlefin, Cairnback, Pluvlet, Sailpip, Glasswhorl and Tempestray are authored specifically for this project. They are stylized procedural models, not imported skeletal assets or recolored stock creatures. See [WILDLIFE-ASSETS.md](WILDLIFE-ASSETS.md).

A companion physically follows using navigation. Three abilities reveal a footprint trail, move a blocking driftwood gate and light/open a dark passage. A connected exploration chain leads between habitats. The rare reveal follows deterministic weather/action prerequisites, rather than random rarity. Failed greetings or pulses give another opportunity without consumed inventory or a long punishment.

The visual journal uses one shared renderer for six animated portraits, with unknown silhouettes and compact hints. Collection, companion choice, discoveries and world changes persist in an isolated validated browser save. Rescue and campaign saves remain intact at `?rescue` and `?campaign`; `?classic` preserves the original mode.

Optional AI selects from bounded nonverbal companion reactions. It adds a brief animation, not creature conversation, inventory, movement authority or fabricated discoveries. It uses the existing server-side adapter and secret configuration. The client allows at most six requests per page session, at least one minute apart, in addition to the existing server request/concurrency/token/spending limits. All core play works without AI or when requests fail.

## Verification checkpoint

- **139 automated tests pass; production build passes.** Coverage includes the pre-existing simulation and rescue suite.
- Independent integration tests walk the full six-species chain with actual world colliders, without teleporting the player or companion. They exercise all three abilities, deterministic rare reveal, following, collision bounds and repeatable saved-state continuation.
- Persistence checks cover isolated storage, corrupt saves, unavailable storage and duplicate-bond rejection.
- **Actual Chrome browser play:** all six species befriended through normal UI; mouse-only encounters; keyboard and click movement; following companions; shell pickup/return; hidden-track ability; driftwood removal; rain-garden access; light ability and grotto access; deterministic storm reveal and rare bonding.
- **Actual live API evidence:** selecting Cairnback as companion returned “Live AI reaction verified.” This verifies the optional model-backed reaction request; deterministic movement and befriending do not call AI.
- **Measured desktop sample:** Chrome, 1710×809 viewport, High graphics: **60 FPS**, **17.4 ms p95 frame time**, **541 draw calls**, **98,366 triangles**. This is a short observed sample, not a sustained benchmark or a mobile hardware measurement.

## Remaining verification and limitations

Browser reload retained all six friendships and the selected companion. New expedition and Restore previous expedition were both exercised, preserving the completed expedition while leaving a fresh start. Mobile journal and physical encounter inspected at 390×844; all six journal entries fit and companion selection works. Camera framing keeps the approached creature visible. No runtime errors were reported in the inspected console. Screenshots are in `artifacts/wildlife/`; no gameplay video was captured.

Final storm sample on Apple M4, macOS15.2, Chrome1710×809: High30 FPS/p95 33.6ms/512draws/93,842triangles; Low30 FPS/p95 34.2ms/154draws/41,020triangles. Earlier fair-weather sample reached60FPS. These short browser samples vary with foreground/browser scheduling and are not sustained benchmarks. Performance budget: target30FPS minimum on the test desktop, under800draws/200k rendered triangles High and250draws/80k Low. Mobile hardware performance is unverified.

The coastal world and creatures are deliberately stylized and procedurally authored. No external creature assets, animation packs or audio samples were acquired. The collection is local to this browser; it has no account synchronization or multiplayer economy. Optional AI reactions are cosmetic and bounded, and server budget counters retain their existing per-process scope. The rare encounter is an authored discovery, not a procedural endless ecosystem. The preserved rescue and campaign remain separate experiences rather than sharing their disaster countdown with exploration.
