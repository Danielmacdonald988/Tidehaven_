# Observatory cliff transition

Base: main 8157729 (merged PR #6). Scope: remove the remaining height discontinuity; no camera, pier or previous uphill ribbon rework. Coordinator owns contracts.ts, regression tests and this evidence document. Independent generic QA agent used the repository QA director brief with read-only ownership. No production deployment or user saves touched.

## Diagnosis

`contracts.ts::surfaceHeight` previously switched from zero to the full northward incline immediately west of x=-88. The shortcut (-81,-5) to ruin (-92,-23) centerline crosses there at z=-16.454545: an approximately 0.232727m instantaneous analytic height change. Farther north the same boundary reaches 2.2m.

World.ts samples this function on a quarter-metre PlaneGeometry grid. Thus rendered ground connects the high x=-88.25 samples to zero at x=-88 over one cell, a steep continuous facet rather than an open mesh gap. TerrainRibbon.ts clips the path to those same facets and maintains its existing offsets: path +0.035, earth -0.025 (6cm separation). The earlier clipping correction remains valid.

Scene.tsx positions the avatar, companions, camera target and other actors using analytic surfaceHeight, rather than the grid interpolation. Consequently the old analytic step can produce an elevation pop and actor/ground mismatch. Navigation and wildlife movement use 2D coordinates/colliders, not slope limits or vertical collision; the height jump is not evidence of a stuck-player condition. Pointer ground targeting separately performs four iterative height-plane intersections and requires manual checking.

## Correction and preservation

Multiply the existing incline by min(1,(-88-x)/1.5) within its existing branch. This creates a continuous 1.5m transition entirely inside the cliff footprint, reaching original height at x=-89.5, the stone platform's eastern edge. All terrain outside that strip, the platform, route endpoints, columns, colliders and progression remain unchanged. No save fields, migration, rewards, camera settings, geometry topology, textures, materials or draw submissions added. Existing saves retain x/z and naturally sample the corrected height when loaded in the strip.

The blend is bilinear while the mesh is triangular. Its remaining analytic/grid difference is bounded by 0.001667m; independent dense samples measured 0.001664m. Existing vertical decorative offsets are intentionally retained. No extra per-frame allocations; a clamp and multiply are added only inside the cliff branch. This is a structural cost assessment, not measured Mac performance.

## Executed validation (Linux cloud)

- `node --import tsx --test tests/observatory-transition.test.ts tests/terrain-ribbon.test.ts`: 4/4 pass; independently repeated by QA.
- `node --import tsx --test tests/*.test.ts`: 193/193 pass.
- `npm run build`: pass (existing large-bundle warning).
- `git diff --check`: pass.
- `npm test` could not start because the tsx CLI IPC socket was denied (EPERM); the equivalent Node tsx-import invocation above executed the complete test glob successfully.

New tests check continuity, unchanged heights outside the strip, analytic/grid agreement, and actual tickRegion walking in both directions with buildRegionWorld colliders and a 5cm/frame bound at 60Hz. Existing tests cover ribbon raycasts, expedition prerequisites/rewards, companions and persistence. These are automated simulation/geometry checks, not observed gameplay or visual certification.

## Required Mac gameplay follow-up

Use an isolated QA origin/save, retaining the user's save. With the passage legitimately unlocked and a companion following, click from the gate to the observatory and back, then click laterally across x=-88 at several northern positions. Inspect feet, shells, sand/earth, stone platform seam and companion at default and rotated cameras; capture ascent/descent clips. Check actual mouse target accuracy, no transient pop or foot burial, and successful arrival. Reload a completed expedition and confirm companion, lens, money and journal remain intact without duplicate reward.

Compare base/candidate on the same Mac, viewport and preset with one active WebGL view, matched weather and route; record FPS/p95 and draw/resource counts. Rendered appearance, pointer input, companion visual following and Mac performance remain untested here. These manual checks are the next highest-impact step before merge; no fresh claim of 60 FPS or visual perfection is made.
