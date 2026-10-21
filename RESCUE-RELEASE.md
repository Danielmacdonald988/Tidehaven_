# AFTERLIGHT — When the lights go out

## Audit and direction

Played the current campaign before building. The coherent coastal landmarks and validated AI worked, but wide overhead framing, flat daylight, lightly articulated residents, static scenery and text-only work outcomes undercut the emergency. This release keeps the campaign intact at `?campaign` and makes the focused rescue the default entry point. No management panels or new dialogue framework were added.

## Play

Use the existing local server at http://127.0.0.1:3001 or `npm run dev` at port 5173. Production: `npm run build`, then `npm start` (one server on 3001).

Enter the storm, follow the emergency lamp to Bay Radio. Ask Inez to lift the fallen beam and accept the offered physical assist, or use the east service entrance. Reach Jo, optionally collect the case, then escort her through the surviving east exit to the illuminated warehouse. She must walk into shelter; reaching it alone does not complete the rescue.

Click ground to walk; click the contextual action to approach and interact. Drag to turn the same camera, wheel to adjust its distance. WASD is optional. Space pauses; Options provides low graphics, camera sensitivity, restrained impact toggle, volume and safe checkpoint recovery. Audio starts from the Enter button gesture and can be muted. Conversations and API waits pause simulation; rendering continues. New rescue autosaves separately and never overwrites the campaign save.

## Observable changes

- Rain, wet streets, wind-driven vegetation and dark coastal lighting.
- Transformer flash/sparks, spatial electrical crack and actual loss of powered lights.
- Real blocked front passage, alternate side doorway and collision-matched route.
- Model-backed Inez instruction leads to actual movement, lever/lift animation and a beam that rests beside the building when moved.
- Hinged awning failure permanently blocks the front route. An open east exit and recoverable checkpoint prevent reflex/death traps.
- Jo limps through that route and follows to shelter. The single case remains inside, is visibly carried, or is delivered, according to state.
- Shelter arrival seats Jo, calms the soundtrack, stops rain and lowers street floodwater. Aftermath remains walkable.

## Scope and honesty

Characters use improved original articulated rigs, rainwear and layered authored poses; they are not imported motion-captured or high-fidelity skinned humans. Audio is synthesized, not recorded voice acting; a positional radio cue remains available. Two optional locally synthesized emergency calls use an installed English OS voice, when available; these are authored cues, not generated AI speech. Water is staged visual flooding, not fluid physics. This is an authored rescue state machine integrated with the existing bounded AI endpoint; it does not tick or alter the separate management campaign. AI selects an offered assistance action, never geometry or inventory.

The requested 5–8-minute duration is a pacing target, not a measured human result. An optimal scripted route finishes in roughly 2–3 minutes. Exploration, the AI encounter and recovery add time; no artificial waiting was added to force the target. Further human pacing and visual/art refinement remain worthwhile. No subjective audio listening assessment or physical-phone performance claim is made.

## Verification

- `npm test`: 121/121 pass. Includes rendered-world collision checks for both approaches, physical actor arrival, duplicate protection, save validation, side-door navigation, frame-rate-independent acceleration and isolated recovery. Existing campaign/AI tests remain passing.
- `npm run build`: TypeScript and production build pass. The shared Three.js/navigation chunk still exceeds Vite’s 500 KB advisory threshold.
- Actual Chrome: live Inez request returned a valid assistance offer; accepting it caused travel and work, then opened the passage. Played the rescue through case pickup, physical escort, collapse, shelter arrival and quiet aftermath. Reload retained state and live instruction provenance.
- Alternate east-door entry, interior case pickup, escort, safe-checkpoint recovery and the final shelter outcome were also completed in the browser. Both complete strategies pass automated integration through actual rendered colliders.
- Desktop and 390×844 emulated mobile options inspected; low graphics selected and working. Chrome/macOS reports WebKit WebGL. At 1710×809, short two-second samples: High storm 514 draws/70,886 triangles, 60 FPS / p95 17.3 ms; High aftermath 543 draws/76,304 triangles, 60 FPS / p95 17.5 ms; Low aftermath 182 draws/37,416 triangles, 60 FPS / p95 17.3 ms. These are rolling samples, not sustained or physical-phone benchmarks.
- Sound activation/mute and event scheduling checked in code and browser controls. Optional local voice selection tested with mocks; actual voice availability/listening quality not claimed.
