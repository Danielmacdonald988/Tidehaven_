# Storm rescue art provenance

All new rescue geometry and effects are original procedural work created in this repository: transformer hardware and suspended cable, hinged corrugated awning, fractured timber barricade, radio east doorway, stormwater ripples and foam, rain streaks, electrical sparks, emergency lamps, cot and medical case. No external models, textures or audio samples are downloaded or licensed for this sequence. Existing neighborhood materials retain the provenance in ASSETS.md.

The original instanced radio east wall is removed and rebuilt with a three-metre opening; its collision geometry is split identically. The front beam and collapsing awning are driven by rescue state, with dynamic collision owned by the rescue engine. Power failure extinguishes architectural lamps and triggers spatial flash/sparks; the shelter retains emergency power. Delivered supplies appear only after authoritative shelter arrival. Weather is deterministic and cosmetic; no hidden damage is applied.

Performance: new rain uses one line-segment draw call with 900 high / 300 low streaks, sparks one points draw call, original neighborhood batching preserved. No per-frame geometry allocations or external 3D asset fetches.

UI typography loads DM Sans and Libre Caslon Display through Google Fonts, with system fallbacks. Both use SIL Open Font License 1.1: [DM Sans license](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt), [Libre Caslon Display license](https://raw.githubusercontent.com/google/fonts/main/ofl/librecaslondisplay/OFL.txt). These optional remote font requests are separate from the locally authored 3D assets.

Characters use original articulated storm rigs and poses. Sound uses original WebAudio synthesis plus optional installed local English OS voices for two authored emergency calls; no downloaded voice files or model-generated speech.
