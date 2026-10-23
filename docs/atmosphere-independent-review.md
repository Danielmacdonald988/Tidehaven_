# Independent atmosphere Engine / QA review

Baseline: `3b7bf852fce4d17b19c27e160a7926cb72e0f373`. Initial review is source inspection only; no browser, benchmark, or gameplay certification is implied.

Role: independent Engine & Performance / QA & Player Experience director, supplied to a generic subagent. Read AGENTS.md, director coordination and both canonical role briefs, and VISUAL-CONTRACT.md. Owns only this report; source is read-only.

## Initial findings and guardrails

- Existing `VisualDetails.coastalWater` adds analytic ripple color/normal treatment, without reflection passes. The base ocean and regional water already call it. Existing world code also animates reeds, palms and boats. New motion should be subtle and bounded rather than duplicating these systems.
- Region `M.water` also supplies window panels (`World.ts`, around line 434). Broad material replacement could change architecture accidentally. Keep new shoreline treatment separate or explicitly check all shader callers.
- One existing shadow directional light and no additional postprocessing/render targets is the agreed render budget. Prefer at most one instanced draw for any new small environmental accents. No new per-frame geometry, material, texture or listener allocation.
- Existing region scene has no JavaScript reduced-motion support; CSS media rules are not sufficient for WebGL motion. New decorative motion should respect `prefers-reduced-motion`, paused state and hidden-document state, with listener cleanup. Do not freeze authoritative creature/gameplay state as an incidental consequence.
- Existing scene calls world/presentation updates while paused; do not claim pre-existing environmental motion is paused merely because new effects are.
- Lighting must retain the cream/petrol/copper coastal direction, bright readable route silhouettes and existing weather distinctions. Avoid stronger fog, bloom or dark shadows obscuring clues.
- Any new shader must be checked in a rendered browser. A successful TypeScript build does not compile GLSL.
- Regional water coordinates: harbor ocean x[40,112], z[30,58], top y≈-0.29; base ocean x[-80,80], z[32,132], y≈-0.38 with high-quality waves; marsh channel x[-59.5,-45.5], z[-9.5,17.5] and z[25,32], top y≈0.02. Shore cues must not cross navigable ground or floats above troughs conspicuously.

## Required verification matrix

1. Record actual browser/GPU label, viewport, resolution, quality and AO. Capture baseline and change at the same position, camera and weather; wait for lighting transitions to settle.
2. Inspect fair and dusk coastal water, plus rain/storm readability. Inspect route out of home toward Brindlefin without modifying reserved encounter files. New encounter integration needs its own combined verification later.
3. Switch high → low → high and resolution settings. Verify no shader failure or stale meshes, and no unexpected settings persistence change.
4. Check new ambient motion while active, paused and reduced-motion enabled; inspect lifecycle cleanup and repeat reload at least three times. Preserve valuable saves and use an isolated origin.
5. Run full `npm test`, `npm run build`, `git diff --check`. Add targeted tests only for meaningful deterministic bounds, resource lifecycle or settings behavior.
6. HUD samples cover approximately two seconds. Record exact samples and label them short visible samples; they cannot establish sustained FPS, thermal behavior or heap plateau. Compare draw calls/geometry/textures at matched views when exposed. Do not access denied chrome://gpu page.

Integrated implementation and actual validation review: pending coordinator handoff.

## Integrated module source review

Reviewed `src/region/Atmosphere.ts` after implementation handoff. No blocking defect found in this module by source inspection.

- It replaces the previous analytic water shader, rather than stacking two ripple treatments. Material color changes driven by existing weather code remain effective; material color/roughness/metalness are not overwritten.
- The unique shader cache key and `needsUpdate` ensure recompilation. Disposal restores the exact saved callbacks and cache keys; the shared uniform is allocated only once.
- The upward-facing surface mask excludes vertical window faces sharing the water material. Thin horizontal window edges can still receive the treatment, a minor visual caveat to inspect.
- Normal perturbation is transformed from world into view space before applying to the Three.js fragment normal. Existing geometry is axis-aligned, baked or translated; the simple model normal transform is sufficient for those callers.
- Adds no meshes, textures, lights, reflection passes or per-frame geometry allocations. Fragment math is slightly different; zero additional draw calls is not a GPU timing guarantee.
- Paused/reduced-motion flags freeze this shader's decorative clock only. Existing CPU ocean displacement, boats and palms remain outside the module. Do not describe this as global reduced-motion support.

At this review snapshot `Scene.tsx` integration was not yet saved; its listener lifecycle and call arguments remain pending. Browser remains exclusively assigned to coordinator. Actual GLSL compilation, visible quality and performance require coordinator evidence.

### Scene integration follow-up

Reviewed the saved Scene diff and `tests/atmosphere.test.ts`. No blocking source defect found. Atmosphere attaches after static batching, is disposed before world teardown, and receives paused-or-hidden plus live `MediaQueryList.matches`. No media-query listener is created, so no additional listener cleanup is required. Fair direct sunlight decreases from 3.4 to 2.9 while sky fill increases from 1.35 to 1.5; dusk fill increases from 0.85 to 1.0. These are coherent readability-oriented changes, subject to actual matched captures. Rain/storm palette is unchanged.

Targeted tests cover material sharing/restoration and capped/frozen animation clock. Mock shader assertions do not prove real GPU shader compilation. Actual test/build execution and all browser observations are owned by coordinator and should be recorded separately; this independent review makes no claim to have run them.

Source review disposition: **no blocking findings**. Remaining evidence gaps: real rendered before/after comparison, reduced-motion browser behavior, reload/settings checks and matched performance observations. New encounter task's combined scene remains unverified here.

## Independent matched-image inspection

Independently opened `artifacts/atmosphere/before-coast-rain.jpg` and `after-coast-rain.jpg` with the image viewer. Both images are 1710×809 and visibly match camera, player position, rain weather and paused UI. Coordinator reports High quality, AO on and 100% render scale; those settings are not directly visible in this pair. Creature poses, rain streaks and splash positions differ, consistent with pre-existing animation continuing while paused.

Observed in the pair:

- Baseline water has soft scattered oval highlights and broad pale bands. After water has more coherent elongated, diagonal ripple highlights and a more even teal base. This reads as a directional coastal surface, a visible but contained change.
- Quay edge, posts, rope barrier and walkable paving remain distinct against water. No visible geometry or world-layout change is apparent.
- The pale discovery markers along the dark path toward the orange creature remain plainly visible. The creature silhouette and the yellow shell-like marker at the path entrance remain distinguishable. This supports local trail readability in this view, not verification of the complete home-to-Brindlefin route or the other task's combined changes.
- Rain/weather lighting above the water is essentially unchanged, consistent with source. These rain frames do not demonstrate the altered fair/dusk lighting; that needs the corresponding weather evidence.
- No obvious visual defect or occlusion regression is visible. Ripple highlights are more linear than before; temporal smoothness cannot be assessed from stills.

Coordinator reports real-browser shader compilation with no warning/error logs. This report distinguishes that supplied evidence from my independent source and still-image inspection. No independent browser session, motion clip, reduced-motion run or sustained benchmark was performed by this reviewer.

## Temporary encounter integration image review

Coordinator reports a temporary integration of encounter commit `aa3b207`, with 182 tests/build passing and an actual open-palm/resonance Brindlefin bond. This is coordinator-provided execution evidence, not tests/play performed by the independent reviewer. Final atmosphere-only source is to have reserved files restored byte-for-byte; these images therefore establish compatibility only for that exact temporary combination.

Independently inspected `combined-trail-rain.jpg` and `combined-storm.jpg`: the shell trail is high-contrast on asphalt and distinguishable on pale sidewalk/grass. Brindlefin remains visible near the harbor sign. Storm image visibly shows journal 1/6 and “With you Brindlefin,” consistent with the reported bond. No obvious atmospheric visibility conflict is present in these views.

Independently inspected `combined-before-fair.jpg` and `combined-after-fair.jpg`: matching paused camera/player/weather and companion state, with pre-existing NPC/frond animation phase varying. The largest visible difference is the water highlight treatment. Fair lighting changes are subtle, with slightly cooler/more even cream paving and foliage while retaining the warm coastal palette. Shell route, sign, companion and quay boundaries remain distinguishable. No blocking visual regression is apparent; this is a restrained lighting adjustment rather than evidence of a dramatic lighting transformation.

Dusk follow-up: independently inspected `combined-before-dusk.jpg` and `combined-after-dusk.jpg`. Framing, paused state and companion state match. The extra sky fill gives a restrained lift to paving/foliage without flattening the dark roadway or removing warm material tones. Trail shells, companion and quay boundaries remain clear. Water again shows elongated highlights. No blocking visual issue found in the pair; this does not measure motion quality or performance.

Also inspected `combined-tracks-dusk.jpg`: companion and nearby player remain distinguishable against the road shadow, shell cues are visible near the warehouse approach, and the message “Hidden tracks surface in the wet sand.” is visible. This corroborates the coordinator's reported ability action and follow-back test, while the actual interaction sequence was performed by the coordinator. Conditional combined-scene review result: no visual integration conflict found for temporary encounter commit `aa3b207` in the supplied rain/storm/fair/dusk views.
