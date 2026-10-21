# Living Coast — original creature art

All six creature designs, names, models, animation rigs and palettes were created specifically for AFTERLIGHT in `src/wildlife/Creatures.ts`. No external creature model, texture, animation, audio sample or intellectual property was imported. The implementation uses the project's existing MIT-licensed Three.js library and its geometry merging utility. Source geometry is generated locally; it has no network or API dependency.

| Species    | Visual identity                                                                    | Motion identity                                                                 |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Brindlefin | Burnished sand coat, three teal flank stripes, ribbed fan ears and broad fan tail  | Low four-foot scurry, inquisitive head tilt, restless ears, tail wag            |
| Cairnback  | Layered rounded stone scutes, pale muzzle, small curved tusks, broad dark feet     | Heavy alternating footfalls, cautious head sweeps, compact braced alert pose    |
| Pluvlet    | Long splayed toes, external luminous gills, little lantern tail, large raised eyes | Springy squat gait, breathing glow and twitching gills                          |
| Sailpip    | Long ribbed sail membranes, pointed ears, pale rudder tail                         | Continuous controlled wing motion, compact airborne body and alert ear movement |
| Glasswhorl | Translucent spiral shell, clear side fins and long luminous feelers                | Gentle hovering, swaying feelers and a slow breathing glow                      |
| Tempestray | Wide scalloped storm-blue wings, luminous veins, split streaming ribbon tail       | Slow powerful wing undulation, flowing tail and raised sensory horns            |

Small seeded color variations change coat hue/lightness without changing species identity. Every rig has idle, travel, alert, curiosity, receptivity, bonding and companion motion. Positive resonance brightens luminous accents and plays a joyful body bounce. Models face local +Z; world-space movement remains owned by the deterministic simulation.

Geometry is authored as a hierarchy of sculpted ellipsoids, tapered curved tubes, custom extruded profiles and faceted shell plates. Static pieces are merged by material within each articulated joint to limit draw calls. Eyes retain independent blinking. This is an original stylized procedural bestiary, not externally acquired skeletal animation or a photorealistic asset pack.

UI typography reuses DM Sans and Libre Caslon Display via Google Fonts, both SIL Open Font License1.1, with system fallbacks. License links and original environment provenance are recorded in [RESCUE-ASSETS.md](RESCUE-ASSETS.md) and [ASSETS.md](ASSETS.md). Wildlife audio is original deterministic WebAudio synthesis; no external recordings.
