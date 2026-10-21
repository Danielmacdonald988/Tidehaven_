# AFTERLIGHT asset provenance

All town geometry in `src/three/Environment.ts` is original procedural artwork authored for AFTERLIGHT: coastal weatherboard architecture, pitched removable roofs, interior furnishings, shelving, resource crates, relief truck, small boats, palms, planting beds, sidewalks, street furniture, aerial, wires and shoreline.

Signs are original text rendered to canvas at runtime using system fonts. Material colors, wave motion and layout are original. No downloaded models, photos, commercial asset packs, third-party textures or audio files are used by this environment. No attribution to an external asset creator is required. Three.js is a separately licensed software dependency; see its package license.

World resources control warehouse supply visibility. Decorative merchant stock belongs to the town's merchants, not the player's warehouse. Relief transport is physically visible before hiring; ownership remains governed by the authoritative simulation.

Characters in `src/three/Residents.ts` are original articulated mesh artwork: shaped clothing and limbs, facial features, hair, hats, accessories and skeletal pivot animation. No third-party character model or motion-capture clip is used. `src/three/audio.ts` synthesizes local noise-based surf/wind and footsteps; there are no downloaded recordings. These generated assets are part of this project, with no external attribution conditions.

Software dependency: Three.js is MIT licensed ([project license](https://github.com/mrdoob/three.js/blob/dev/LICENSE)). React, Vite and other software licenses remain in their installed packages. No third-party artwork license is implied by those software licenses.

## 4.0 neighborhood pass

The stranded relief van, open engine hood, medical cargo, folding shelter frames and deployed cots, neighborhood reserve ledger, freight-lane barricade, repair patches and aftermath shoreline debris are original procedural artwork. No new downloaded assets or license obligations were introduced. Campaign object visibility follows `World.campaign`; medical cargo is removed only after the van's committed resolution, shelter furnishings after preparation, and the freight obstruction after clearance. The roadside freight blockage leaves a pedestrian bypass; it does not visually claim that the whole street is impassable.

Existing roof fittings and new assemblies are merged by material within their independently animated or state-controlled groups to contain draw calls. Character-specific idle gestures are cosmetic posture, not claims of completed tasks. Surf now attenuates with distance from the shore, is gently panned, and muffles indoors when the scene supplies the optional listener context. No microphone, recording, network audio or third-party audio service is used.

4.0 material studies: asphalt, earth, sand, timber grain and salted paint use original 256px procedural textures generated once with fixed seeds. No network textures or third-party art. Van panel seams, tools, lights and grille are original geometry.
