# AFTERLIGHT — The Connected Coast

## Release status

Playable local expansion, verified on 2026-10-21. The bounded scope and remaining limitations are listed below. The original release is recoverable at tag `checkpoint-living-coast-67c9934`.

## Launch

From the project directory:

```sh
npm install
npm run build
npm start
```

Open the local address printed by the server. The current development session uses **http://127.0.0.1:3001/**. Free roam is the default. Keep the existing ignored server environment file for live AI; no key belongs in the browser or this document.

## What changed

The original coastal neighborhood now connects to an eastern harbor and western mangrove district. The warehouse is a home base, with parking, visible delivered goods, creature shelter and workbench upgrades, and deliberate access to earlier missions. There is no global disaster countdown in free roam.

The owned Coast Runner pickup supports physical entry and safe exit, steering, acceleration, braking, reverse, collision, mouse destination driving, persistent parking, and nearby roadside recovery. Delivery cargo appears in its bed and at the warehouse only after validated actions.

Three optional activities connect exploration to the existing systems:

- **Delivery:** negotiate at harbor dispatch, collect eight actual crates beside the parked pickup, transport them, and unload at home. Terms depend on trust; promises and payment are recorded.
- **Wetland expedition:** follow a physical clue, use an existing companion ability to open a passage, and recover an artifact for the warehouse.
- **Local assistance:** meet a stranded harbor worker and physically escort them to safety.

The field journal, original six creature species, resonance encounters, companion abilities, weather, and existing live AI remain available. Nearby residents have bounded routines and concise, grounded conversations. The map displays roads and discovered landmarks without exposing creature locations.

## Controls

- **Click ground:** walk, or drive toward a destination while seated in the pickup.
- **Click a nearby target / contextual action:** interact, enter, leave, greet, or handle goods.
- **WASD / arrow keys:** alternative movement and driving. **B:** brake.
- **Mouse driving buttons:** accelerate, reverse, steer, and brake without a keyboard.
- **Drag:** turn the camera. **Wheel:** adjust distance.
- **Map:** select a waypoint, then choose Walk or Drive. Nearby off-road driving destinations use roadside parking; finish the approach on foot.
- **Field journal:** inspect collected creatures and select a companion.
- **Space:** pause. Options include sound, volume, camera sensitivity, graphics quality, and encounter timing assistance.

When stuck, use vehicle recovery from the existing controls. Recovery searches only nearby clear road positions; it does not transport a delivery home or award progress.

## Verification

### Automated

The integration suite currently reports **166 passing tests**. Vehicle checks include acceleration, braking, reverse, thin-wall collision, safe exits, mouse road navigation, physical routes against the rendered world's colliders, cargo-preserving local recovery, and invalid-input handling. Existing creature and simulation checks remain in the suite.

### Actual browser observations

Actual Chrome play crossed all three districts, entered/exited/re-entered the pickup, loaded eight crates, reloaded with cargo, drove home and unloaded for $300 with visible warehouse crates and an empty truck. The same save bonded Brindlefin, retained collection and companion after reload, drove to the wetlands, inspected tracks, opened the physical shortcut with its ability, and recovered the observatory lens. The return drive and physical home handoff awarded $250; both paid home upgrades were also exercised and retained after reload. The brass lens and delivered goods remain visible at home. A separate optional dock escort physically brought Jo to the safe quay for $180. Keyboard acceleration and braking, mouse destination driving, and the 390 × 844 map/driving layout were exercised.

Two real model requests succeeded: Inez offered the delivery; after completion, further travel and reload, she accurately remembered all eight crates and the kept promise. No model output directly changes inventory. Legacy mission selection was inspected; the full old rescue was not replayed this turn. Existing regression tests remain passing. Cancellation/reward duplication and long-run bounded state were tested automatically, not as separate full browser playthroughs.

Independent Chrome inspection on the available Mac at **1710 × 809**, **High** graphics, reported **30 FPS**, **34.6 ms p95 frame time**, **477 draw calls**, and **124,602 triangles**. This is one observed browser sample, not a guarantee across locations or hardware. The final home scene at High reported 30 FPS, 34.2 ms p95, 891 draws and 218,362 triangles; Low reported 30 FPS, 33.8 ms p95, 255 draws and 81,058 triangles. A wetland sample at Low reported 30 FPS, 33.8 ms p95, 59 draws and 45,664 triangles. These short samples were on Apple M4/macOS 15.2 in Chrome; High did not meet the aspirational 60 FPS budget. Low met the 30 FPS floor in the observed sample. No physical mobile-device performance claim, long-duration heap profile, or gameplay video is included. Screenshots are in `artifacts/region/`.

## Known limitations

- The region is a compact, fixed world with bounded populations and visibility culling. It does **not** implement chunk streaming.
- The three activities are finite authored jobs, not an unlimited procedural job generator.
- Earlier story and rescue modes remain deliberately accessible but retain independent saves. They are not seamless missions running inside the same free-roam simulation.
- The six original creature species remain in their original town habitats. The new wetlands expedition provides an ability-gated route and artifact; it does not add new species.
- Mouse driving can reverse along a route when the destination is behind the pickup. Keyboard steering provides manual turning. The vehicle uses authored kinematics rather than full suspension, rollover, or damage physics.
- Vehicle audio is original procedural synthesis rather than recorded engine audio.
- The loading bench improves terms only for a delivery accepted after it is built; it does not retroactively increase a completed job.
- AI enriches bounded resident interactions; deterministic simulation controls resources, movement, activity completion, and rewards. Outages must not prevent exploration or creature play.

## Follow-up quality work

Longer human driving sessions, richer district-specific creature habitats, more optional activity variations, and further High graphics optimization would improve this bounded release. Repeated travel uses fixed scene entities and bounded histories; automated population checks pass, but this is not a substitute for a long-duration browser heap profile.
