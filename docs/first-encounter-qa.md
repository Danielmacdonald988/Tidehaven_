# First Brindlefin encounter — independent QA

Tested 2026-10-23 on the user's Mac, real visible Chrome via CUA. Baseline: `3b7bf852fce4d17b19c27e160a7926cb72e0f373`. Integrated changes reviewed independently in `src/wildlife/World.ts`, `src/wildlife/Creatures.ts`, and `src/region/App.tsx`. No game code modified by QA. Existing active checkout, port3001 and user saves untouched. Isolated test origins used ports4181–4185; baseline built from `git archive HEAD` in `/tmp/tidehaven-qa-baseline-20261023`.

## Observed gameplay

- **Fresh default region PASS:** the true starting position is warehouse home(-22,15). Baseline had no continuous visible clue from its doorway. Integrated pale shell impressions visibly lead from the door along the curb, across the road, and to Brindlefin. Followed entirely with ordinary ground clicks, then clicked the creature. No teleport or state injection.
- **Greeting and bond PASS:** open palm changed the pose and UI to “Fins open. A little paw reaches toward you.” Clicking resonance produced the friend celebration, field journal1/6, and companion. The shell route west appeared after bonding. Default assistance enabled.
- **First ability PASS:** walked west along the new companion trail, then north to the existing shell marker. “Brindlefin, find the hidden tracks” appeared nearby. Clicking it displayed the existing success message and progressively revealed the route toward Cairnback; the guide trail disappeared. This retained existing world geography: the reveal is on the road/asphalt despite the legacy message saying wet sand; no new biome was created.
- **Persistence/repeated actions PASS:** reload retained position,1/6 journal, Brindlefin companion, and fully revealed tracks. The spent ability button remained absent. Clicking the bonded creature did not repeat bonding or increase the journal count. A held D key visibly moved the player and companion followed.
- **Pre-change save smoke PASS:** switched QA baseline port4181 from the archived baseline build to integrated dist without clearing its storage. The prior0/6 home save opened with the new trail and working Options. This is a limited fresh-progress returning-save case; the richer earned companion case is covered below.
- **Real progress through resource retry PASS:** replaced only QA's port4182 static server with a one-time lazy-JS503 server, then revisited the same origin with the earned save. Recovery panel appeared. Try again restored1/6, companion, rainy weather and revealed tracks. Screenshot `qa-retry-progress.jpg`.
- **Alarm/retry PASS in standalone wildlife:** walked too close before greeting; live AX and screenshot showed “A little space. It will return.” and disabled open-palm button. Creature lowered its pose. Moving away restored enabled greeting; open palm then worked. The subsequently saved `qa-alarm-settled.jpg` is the settled state, not proof of the brief active alarm.
- **Manual timing/retry PASS in standalone wildlife:** disabled Gentle timing assistance; clicked “Listen · then release” outside the receptive window and journal stayed0/6. Then clicked “Release resonance” during the bright window; journal became1/6 and companion appeared. Standalone retains its existing copy; new pose animation is shared. No repeat reward or lockout observed.

## Startup regression

All five entry routes rendered and accepted real UI input: default physical loop/options/map; wildlife encounter/options; rescue Enter the storm then Rescue settings; campaign Step into Bellwether dismissed welcome; classic People first traveled to Mercy Clinic. This is entry/input coverage, not a replay of complete legacy campaigns.

Separate lazy-JS and lazy-CSS503 injections each produced recovery panels, then Try again returned to the default game with working map/options input. Both local font files were logged503 on the font case; classic remained readable and People first worked. Request evidence: `artifacts/first-encounter/qa-requests.jsonl`. No external provider called by the fault harness (API paths return403); optional companion AI was switched off in the core test. Historical “Live AI verified” campaign text is not evidence of a new live request.

Renderer initialization failure/context-loss injection was not rerun in this pass. No browser GPU-details page was opened. Save contents were not extracted or mutated through browser evaluation.

## Matched short performance observations

Same initial home, Chrome viewport/render pixels1710×809, Coastal preset,100% render resolution, depth shading enabled, fair weather. Values read from the game's visible Options panel:

| Build      | FPS | p95 frame ms | Draws | Triangles | Geometries | Textures |
| ---------- | --: | -----------: | ----: | --------: | ---------: | -------: |
| Baseline   |  60 |         18.1 |   920 | 1,376,028 |        357 |       37 |
| Integrated |  60 |         16.9 |   916 | 1,378,126 |        324 |       37 |

A later return-to-baseline-origin sample in the integrated build displayed49FPS/p95 25.9ms (960 draws,1,400,496 triangles,342 geometries); elapsed-world state and surrounding machine load were not controlled for that later sample. Thus sustained60FPS is explicitly not established. Both felt responsive to the tested clicks/keyboard actions. These short samples are not sustained benchmarks and do not establish a statistically meaningful performance improvement. The game reports ANGLE Metal Apple M4; renderer identity was not independently verified. No GPU-details access or workaround was used. Screenshots `qa-baseline-settings.jpg` and `qa-after-settings.jpg` record the panels.

## Automated evidence and limits

QA independently ran `npm run build`: TypeScript and Vite PASS, existing>500kB chunk warning. `git diff --check` PASS. Coordinator separately ran the final complete suite:180/180 PASS (logs `artifacts/first-encounter/tests.txt`, `artifacts/first-encounter/build.txt`), including returning-save reveal/nonmutation, culling bounds/resource disposal, and pose-reset tests. World source predates QA's integrated build; later changes were tests/docs only.

No unfamiliar-player study, sustained performance/thermal test, mobile test, or complete all-species replay was performed. No claim of subjective novice discoverability beyond the concrete observed path. No blocking defect found within this bounded encounter. The legacy wet-sand wording versus road site remains an acknowledged minor mismatch.

## Reproduction and local server ownership

Build with `npm run build`. Serve normal integrated `dist` using `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4182 --strictPort`. The authored `artifacts/first-encounter/qa-preview.mjs` serves independent JS/CSS/font fault cases on4183/4184/4185; `qa-progress-preview.mjs` serves a one-time JS fault on4182 to test an already-earned local save (stop normal4182 first). Run from repository root. Fault state resets on server restart; API requests are denied and files are served only from dist. Local listeners needed supported sandbox escalation and were approved. No denial remains. All QA-owned server sessions were stopped on completion, and the QA browser tab was closed.
