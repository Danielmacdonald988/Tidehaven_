# First encounter environment pass

Scope: `src/wildlife/World.ts` only. Existing world layout, colliders, save format, species and world handle remain unchanged. Original procedural geometry; no external assets or lights.

- Cream shell impressions now connect the **regional** warehouse spawn (-22,15) with Brindlefin's warm tide sand (-8,26), passing north of the default parked vehicle via z17.5 and the open x-11 junction. The wildlife-only start remains beside the final segment.
- With Brindlefin selected and tracks still undiscovered, a second warm shell trail follows the waterfront west to the existing sniffing site (-26,19). A small shell fan marks that site. This is presentation derived from existing companion/ability state, not a new quest or persisted flag.
- The existing hidden footprints toward Cairnback are larger and warm sand rather than grey. The ability event draws pairs outward over 1.8 seconds and briefly warms their emissive color, then settles. Saves with older events show all tracks; no replay requirement or state mutation.

Cost: former 46 separate footprint meshes replaced by three instanced meshes sharing one low-poly sphere geometry, plus five shell ribs sharing the existing box geometry. Only the relevant companion/ability trail is visible. No per-frame geometry/material allocations. Actual GPU/frame-time impact remains for the integrated browser pass.

Checks completed: `node_modules/.bin/tsc --noEmit`, `git diff --check`. Browser readability, route traversal, animation and matched performance are not certified by this code-only pass; coordinator/QA owns browser verification. No screenshots collected here.
