# Visual overhaul asset provenance

All additions in this milestone are original procedural artwork authored directly in this repository. No purchased assets, third-party model downloads, or license-dependent texture packs were used.

- `src/region/VisualDetails.ts`: individually folded pinnate palm leaflets; layered lanceolate tropical foliage; deterministic 256px asphalt, plaster, timber and metal bump/roughness studies; analytic coastal capillary-wave shading.
- `src/three/Environment.ts`: cream/petrol coastal palette, deep facade trim, plinths and rainpipes; warehouse canvas loading canopy, amber wall lamps, loading apron and iron drainage; town palms and planted margins.
- `src/region/World.ts`: matching material studies and deep joinery at freight and wetlands buildings; open tropical crowns, split branches and buttress roots; matching harbor palms and water.

New textures are generated once, 256 x 256 pixels, tiled with bounded anisotropy. Static details join existing material batches/instances. Foliage geometry is actual folded leaf surfaces rather than opaque spherical tree crowns. Water uses a bounded analytic shader, no screen-space reflection pass or extra scene render. Town palm motion retains the existing coherent weather-driven animation. All existing collision boundaries, gaps, gameplay objects, and world update/disposal contracts are preserved.

Limitations: botanical meshes are stylized, not photogrammetry. Surface wear is procedural rather than individually painted hero textures. Water has analytic glints and simulated normal ripples, without true reflected buildings or shoreline refraction.

Second inspection pass: added workshop binders, rolled charts, open document bins, recessed window backplates/blinds, and sidewalk expansion joints. These are permanent dressing and do not represent collectible inventory. Botanical geometries explicitly carry matching position/normal/UV attributes so static merges preserve palms; legacy roof batches normalize indexed geometry before merging. Verified mixed botanical/box merges directly with Three.js.

Harbor inspection pass: thinned and supported freight canopy, visible fascia signage, seam detail on independently fading/cutaway regional roofs, fixed authored coastal roadside gardens, and eight instanced shallow puddles whose opacity follows actual rain/storm state. No new blockers or collisions were introduced.

Rendering uses Three.js bundled RoomEnvironment, PMREM, SSAOPass and OutputPass under the existing Three.js MIT license (https://github.com/mrdoob/three.js/blob/dev/LICENSE). No external environment image was downloaded. Rounded pickup and relief-truck details, planted avatar gait, creature expressions, contact textures and synthesized thunder are original project code.
