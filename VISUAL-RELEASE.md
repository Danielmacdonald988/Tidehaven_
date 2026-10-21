# AFTERLIGHT — coastal visual overhaul

Status: implemented and locally verified visual release; 60 FPS target remains unmet in observed browser samples. Baseline checkpoint: `checkpoint-before-visual-e85a4a2`.

## Hardware and baseline
Read-only diagnostics on this actual Mac: Apple M4, 16 GiB unified memory, macOS15.2 (24C2101). Low Power Mode configuration was0 for both battery and AC. No device serials collected. Actual Chrome renderer: ANGLE Metal Apple M4; WebGL2,4×MSAA, max texture16384, anisotropy16. Remains Three.js/WebGL; no engine migration.

Reference viewport1440×900 CSS pixels. Baseline High used1.5pixel-ratio cap (up to2160×1350 rendered); storm warehouse frontage measured30FPS,p9534ms,894draws,218696triangles. This is a short observed foreground sample; a flat30FPS cadence alone does not establish a GPU bottleneck.

Five observed weaknesses: flat fill light and weak contact depth; muddy surface identities; large blank facades/interior shelves; spherical foliage and paddle palms; sharp vehicle construction and sliding/stiff human gait. Evidence: artifacts/visual/before-street.png and before-waterfront.png. Same warehouse player position, default yaw0.1,distance13; second view horizontaldrag500px (yaw-1.4),1440×900,storm. Creature idle phases and rain are naturally animated.

## Budget
Target16.7ms/60FPS where feasible at1440×900 render pixels; reduced-mode goal33.3ms/30FPS. Both are targets, not claimed results. Default cap is now1renderpixel perCSSpixel. Options remember Coastal/Performance, depth shading and75/100/125% render resolution. Coastal uses one2048directional shadow with50m coverage; Performance uses inexpensive contact shadows and fewer rain drops. Optional half-resolution12sample ambient occlusion is Coastal only. No motion blur, chromatic aberration or bloom.

## Implementation
Original botanical leaf surfaces, deeper facade construction, trim/gutters, canopy and lamps, readable workroom dressing, distinct material roughness/grain, analytic water shading. Rounded pickup, treaded wheels and restrained body response; planted human feet and distance-driven creature gait. Warm bounded interior lights, prefiltered environment illumination, contact shadows, individual roof-aware rain/splashes, coordinated distant lightning/thunder. No simulation resource changes or save migration needed.

Bounded distant resident rendering,15Hz occlusion queries, opt-in static batching, capped Retina resolution. Every gameplay system and server-side AI adapter remains authoritative; decorative books and bins are not inventory.

## Verification
177/177 tests pass, TypeScript and production build pass, git diff whitespace check passes. Eleven new checks cover geometry/resource reuse across hundreds of animation frames, static batching and frame statistics, and sheltered rain footprints. Existing simulation, persistence and action-validation tests remain intact. Vite retains its large Three.js chunk warning.

Actual Chrome play covered town → harbor → town → wetlands driving, parking, exiting, reloading and walking with the saved Brindlefin companion. Independent inspection walked harbor → town. Graphics switching and saved settings were checked. The 390×844 options layout was inspected and its recording-control overlap repaired. No fresh live-provider request or complete legacy rescue replay was required/performed in this visual pass; those systems were preserved, not re-certified end to end.

| Scene / setting | FPS | p95 frame | Draws | Triangles |
|---|---:|---:|---:|---:|
| Baseline storm frontage / High | 30 | 34 ms | 894 | 218,696 |
| Integrated storm harbor / Coastal + depth | 30 | 33.9 ms | 749 | 368,570 |
| Integrated storm harbor / Performance | 30 | 34 ms | 180 | 84,989 |
| Final sunny wetlands / Coastal + depth | 30 | 34.1 ms | 713 | 1,377,412 |
| Final sunny wetlands / Performance | 30 | 34 ms | 211 | 459,891 |

Short foreground HUD samples, 1440×900 viewport, final render scale100%; baseline cap150%. These are observed frame intervals, not GPU timings or long-run percentiles. Coastal totals include depth passes. Final foliage increased geometry detail. The observed approximately30FPS cadence persisted in Performance; its cause has not been isolated. Do not infer60FPS or console parity. Recommend100%, Coastal for presentation or Performance/75% for reduced GPU work.

GPU resource counts rise on first district visibility as geometry uploads occur. Automated animation loops keep resource identity stable, but a controlled long-duration browser heap test and repeated full-region plateau test remain outstanding. No claim of leak-free long-session behavior.

## Evidence and remaining work
`artifacts/visual/before-street.png` / `after-street.png` and `before-waterfront.png` / `after-waterfront.png` match camera/player/weather conditions. Render resolution differs as documented. After comparisons precede the final small foliage/puddle/static-truck refinement; `after-wetlands.png` shows final geometry. `coastal-drive.webm` is an actual approximately12-second canvas-only driving recording without audio. All screenshots are direct browser captures.

The image is richer and more coherent but still stylized procedural art: some terrain/road parcels remain flat, human faces and creature rigs remain simplified, nearby foliage can fill a camera composition, and water lacks true reflected buildings/refraction. No photogrammetry, cinematic human asset replacement, motion capture, baked GI, or full console-quality claim. Next priorities: profile the30FPS cadence, introduce authored road/terrain transitions, and replace the most visible human head/hair assets while retaining these rigs and interfaces.
