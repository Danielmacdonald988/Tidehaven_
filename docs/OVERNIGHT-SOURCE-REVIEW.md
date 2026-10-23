# Independent source review — first ten minutes

Reviewed exact commit `7fc0e083a8ad0982fed839666db6e8b7413481de` against baseline `3b7bf852fce4d17b19c27e160a7926cb72e0f373`, including PR3 encounter presentation, PR4 atmosphere and the new observatory discovery. Reviewer is independent of the implementation authors. Read AGENTS.md, director coordination/QA role, current HANDOFF and visual/region/wildlife contracts. No production files edited, browser used, build run, or provider called.

## Disposition

**No blocking source findings.** This is source-level review, not a gameplay/performance certification. Final release remains dependent on the coordinator's exact-commit test/build and actual Mac QA.

## Checks and evidence

- `ExpeditionDetails.ts`: visibility is derived only from existing ability/expedition flags. Collection removes the optic while retaining its cradle; home display appears only on authoritative completion. Return guidance reuses the physical route. No schema, state mutation, timers, lights or saved progression added.
- Shared cloned instrument geometry/materials have one owner. Temporary merge copies and source geometry are disposed; returned merged buffers, materials and instanced-mesh buffers are disposed by the module exactly once in ordinary world teardown. New meshes are not opted into static batching, so dynamic visibility is retained. Bounds are computed after every trail matrix is set.
- `World.ts`: driftwood presentation retains gate transform and existing colliders. New optic uses the existing ruin/home positions. Module update runs before render and teardown is connected. No terrain/layout/collision changes were found.
- `engine.ts`/`App.tsx`: guidance stages agree with visual stages. Companion-specific failure branches preserve the prior success prerequisites; repeated relic actions remain unsuccessful and give more accurate feedback. Existing one-time reward logic is unchanged. HUD guidance does not modify waypoints, input or saves.
- PR3 creature animation resets modified poses each frame before blending; instanced trail reveal preserves full precomputed bounds. Existing saves without a matching ability event show the revealed result immediately.
- PR4 atmosphere attaches after batching, restores callbacks on teardown, and allocates no per-frame geometry or lights. Reduced motion freezes its new shader clock only; pre-existing world animation is outside that claim.
- Read-only Node geometry audit constructed `buildRegionWorld()` using the same canvas stub pattern as existing tests, sampled every paired shell position against static colliders expanded by the player radius (0.38 m), and found zero intersections on all four regional trails. This does not prove moving-traffic clearance or human readability. An initial audit invocation used a nonexistent unused `canStand` import and failed before execution; removing that import allowed the audit to complete.

## Nonblocking polish observation

`src/region/App.tsx` around line 622 still says “Something waits in the sand” after the Brindlefin bond, while the target tracks marker is on roadway. The ability result text was corrected in this sprint. Consider consistent “shore” or “trail” wording in the celebration, but this does not prevent completing the loop.

## Remaining verification

Actual end-to-end home → bond → tracks → bridge/clue → companion passage → optic → home, returning saves at intermediate stages, interruption/repeat actions, camera/readability across weather/graphics tiers, startup recovery, and sustained Mac performance remain with the exclusive browser QA owner. No CI claim is made. Do not infer a tested ten-minute novice experience from these source checks.

## Terrain correction follow-up

Independently reviewed delta `7fc0e083a8ad0982fed839666db6e8b7413481de..1f9748c49df142e59428a0c0c9ba56d079e67a86`, with HEAD confirmed exactly at the latter SHA.

**No blocking source findings in this delta.** The changed post-bond text also resolves the earlier nonblocking sand/road wording mismatch.

- `TerrainRibbon.ts` uses the existing ground's 0.25 m grid and the same diagonal triangle partition. Grid alignment is correct for the authored observatory plane bounds. Sutherland–Hodgman clipping interpolates height within each ground triangle, so path faces cannot span the discontinuity as the former long ribbon did. Triangle winding remains upward.
- `terrainGridHeight` uses the same two barycentric interpolation cases. Only ascent shell elevations use it; other trails retain their existing height rule. No colliders, navigation surfaceHeight, saved state, reward conditions, or actor movement changed.
- The new buffer is added to World's existing geometry ownership list and disposed on world teardown. It replaces the prior ascent mesh, uses the existing sand material, adds no light/texture/render pass, and performs no per-frame clipping or allocation.
- Read-only geometry audit of the actual route returned **2,126 triangles**, **204,096 bytes** across position/normal/UV buffers, with every position finite. This is more static tessellation than the old ribbon but remains localized to one existing draw; no GPU performance result is inferred.
- The regression test reconstructs the independent `PlaneGeometry` oracle using the existing World bounds, segment count and terrain offset, then raycasts two barycentric interior points per path triangle. It explicitly exercises the former cliff seam and asserts the 0.06 m path-to-ground gap. This is a meaningful test beyond simply comparing the helper with itself.
- Independently executed `node --import tsx --test tests/terrain-ribbon.test.ts`: **1/1 PASS**. No build or browser was run, and no source files edited.

Rendered confirmation and exact-head full-suite/build remain the coordinator/QA release gate; this follow-up certifies source review only.

## Home display placement follow-up

Independently reviewed delta `1f9748c49df142e59428a0c0c9ba56d079e67a86..de8ef2d1cc193e9886765f4a3742db33d740fea0`; HEAD verified at the latter SHA.

**No blocking source findings.** The pedestal, cloned optic and cloned cradle all use the same `HOME_OPTIC_DISPLAY` constant at (-26,17.8), preserving their vertical alignment and existing completion-driven visibility. This is placement only: no resources, draw calls, progression, colliders or save fields added.

The departure trail runs from home (-22,15.2) eastward toward Brindlefin, so the new display lies west of that route. The first ability's trail starts at (-26,19), at least1.2m south of the display center; the existing ring/cradle extent does not overlap that centerline. The return-home trail hides upon completion, when the display appears. Traffic is confined to x44..62 and cannot intersect this placement. The parked owned vehicle starts at (-19,20.5), also separated. As with the prior display, no solid collider is authored for the decoration; this move does not introduce a new navigation blocker.

The shared constant prevents pedestal/optic drift. It moves the center outside the reported canopy edge, but actual default-camera readability and any remaining occlusion require the pending revised-home screenshot. No build/browser/test run performed for this placement-only follow-up.

## Persistence and runtime verification follow-up

Independent review of exact4fc77fe found no blocking findings; only test/docs changed and production source stayed identical tode8. The persistence regression now exercises actual save/load at every expedition stage. A minor assertion-label overclaim was corrected: byte equality establishes unchanged saved contents, not absence of an identical rewrite.

Independent review of the isolated motion harness confirmed its Proxy supplies the current simulated preference to the retained MediaQueryList, and WebGL observers preserve original arguments, receiver and return values. Valid interpretation is submitted shader-time freeze/resume while rendering continues. It does not establish native preference detection, CSS behavior or GPU readback. No production source was modified for this test.
