# Bounded coastal atmosphere polish

Local branch `codex/coastal-atmosphere`, based on `3b7bf852fce4d17b19c27e160a7926cb72e0f373`. Worktree: `/Users/danielmacdonald/Documents/Codex/2026-10-22/task-3/tidehaven-atmosphere`. User subsequently authorized publishing this atmosphere-only branch as a draft PR; no merge or deployment authorized. Active Cursor checkout `/Users/danielmacdonald/afterlight` and its saves/unsaved buffers were not edited. Worktree creation/fetch only update shared Git metadata. Dependencies copied locally, no packages added.

## Outcome and ownership

Graphics/environment pass by coordinator; independent Engine/QA generic subagent owned only `docs/atmosphere-independent-review.md`. Read AGENTS.md, director instructions and VISUAL-CONTRACT. No `.agents/skills` directory exists at this baseline. Existing contract ownership was reconciled by parent: Scene integration assigned here, encounter source reserved.

- New `src/region/Atmosphere.ts`: directional broken water highlights, slower breeze-driven shading and view-space normal perturbation. Reuses existing water meshes/materials, weather colors, textures, roughness and metalness. No new lights, render targets, passes, geometry or simulation. Horizontal-surface mask keeps vertical shared-material windows unchanged. No external assets.
- `src/region/Scene.tsx`: attach/update/dispose module; slightly reduce fair direct sunlight and increase sky fill, gently lift dusk fill/background. Fog density, controls, colliders, world layout and creature logic unchanged.
- `tests/atmosphere.test.ts`: shared-material callback restoration, preserved assets and capped/frozen shader clock.
- New shader motion freezes when paused, tab hidden or OS reduced-motion preference is enabled. This is NOT global reduced-motion support: existing CPU water displacement, boats, vegetation and rain retain their pre-existing motion.

Visible change is strongest in water: soft scattered ovals become coherent broken diagonal highlights. Lighting is a subtle cooler/more even fill; cream/petrol art direction, shell markers and silhouettes remain readable. No broad architectural rewrite.

## Standalone verification

- `npm test`: **179/179 passed**. Initial sandbox attempt blocked local listener; approved rerun passed. `node --import tsx --test` diagnostic run passed 178 with the one listener-dependent test blocked; this was environment restriction, not an assertion regression.
- `npm run build`: **passed**, including final build after restoring temporary integration. Existing >500kB chunk warning remains.
- `git diff --check`: passed.
- Actual Chrome on macOS 15.2, Apple M4 ANGLE Metal, viewport/render 1710×809, High/Coastal, AO enabled, 100%. Fresh isolated origin `http://127.0.0.1:5194`; user/other-task origins untouched. No paid AI actions invoked; optional AI checkbox disabled during play (it resets on reload; companion reselection and resident chat were not invoked).
- Matched rain coast captures: same position, camera, weather, quality and render scale; pause freezes authoritative state. Existing animated poses/rain differ. Both standalone before/after compile and render without console warnings/errors.
- High→Low→High works. No new shader warnings. Short HUD samples below are approximately TWO SECONDS, not a sustained/thermal/heap benchmark. HMR transition samples briefly showed 53–55FPS; settled samples returned to 60. Existing moving poses/culling change draw counts, so those are observations, not exact controlled GPU deltas.

| Matched rain quay | FPS | p95 ms | draws | triangles | geometries | textures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before High | 60 | 18.5 | 882 | 1,225,245 | 289 | 39 |
| After High | 60 | 18.5 | 885 | 1,225,389 | 289 | 39 |
| Before Low | 60 | 18.6 | 285 | 474,135 | 289 | 39 |
| After Low | 60 | 18.6 | 277 | 473,551 | 289 | 39 |

Initial home baseline sample was 60FPS/p95 17.4ms, 936 draws; different position, not paired with the coast numbers.

## Temporary combined QA — separate from deliverable

Fetched exact encounter commit `aa3b207d76923be593db2417377b2011c813bea9` as authorized. Temporarily copied its three changed sources and `tests/first-encounter.test.ts` into this isolated worktree; did not touch that task's worktree or PR3. Final deliverable restores those files byte-for-byte to HEAD and removes its temporary test. No encounter code is included in this atmosphere diff.

- Combined `npm test`: **182/182 passed**; combined build passed.
- Actual play: new shell trail visible from road/quay, approach Brindlefin, offer open palm, release resonance, bond to journal 1/6, companion follows shells back toward warehouse, invoke hidden-tracks ability; success message and visible golden track chain. Tracks and companion persisted through reload.
- Fair and dusk matched before/after screenshots retain identical encounter code, camera, weather and graphics settings; only atmosphere/Scene switched for these comparisons. Shell route, creature and road boundaries remain readable. Rain and storm inspected too.
- Three full combined reloads reached playable scene without console warnings/errors. High/Low and 100%→75%→100% switched successfully. Combined short samples included 60FPS/p95 18.1ms at dusk quay and 60FPS/p9517.4ms Low at tracks. They are not sustained benchmarks or direct comparisons against standalone locations.
- Independent reviewer inspected rain, storm, fair/dusk pairs and ability evidence; no blocking source or visible integration defect found. See independent report for precise limits.

## Evidence and limitations

`artifacts/atmosphere/` contains a 12-second standalone canvas recording (`after-motion.webm`, 30FPS capture; not a performance measurement), matched JPGs, settings captures, combined trail/ability/reload evidence and full standalone/combined test/build logs. `before-coast-rain.jpg` / `after-coast-rain.jpg` are the primary standalone pair; `combined-before-fair.jpg` / `combined-after-fair.jpg` and dusk equivalents isolate lighting with encounter changes held constant.

Not run: browser emulation of reduced-motion (unit tests and live preference wiring inspected; OS settings unchanged), deliberate WebGL/startup failure injection and retry-button flow, sustained GPU/thermal/heap benchmark, exhaustive harbor/marsh window inspection, other legacy entry-mode playthroughs. No chrome://gpu access attempted. Existing animation means paused captures are not pixel-identical. No user permission blocker remains. Publication as an atmosphere-only draft PR was authorized separately; merging and deployment remain unauthorized.

Next highest-impact follow-up: a longer combined route/resource-plateau soak and human review of water motion, before any publication decision.
