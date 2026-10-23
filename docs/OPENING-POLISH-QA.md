# Opening camera and scenery polish

Baseline: merged main `20bc416c50cb892e2296ca73fea14680a4ae4c89`.
Candidate source: `5f7b8cb741c700e819aff843d9d612a447749fc3`.
Draft PR: https://github.com/Danielmacdonald988/Tidehaven_/pull/6

## Player-visible changes

- Opening camera frames the doorstep, shell route, Brindlefin and waterfront together. Manual drag/zoom remain available.
- Actual animated palm BufferGeometry now participates in obstruction fading. Terrain-correct rays protect player and nearby companion silhouettes, and a short hold avoids flickering between leaf gaps.
- Warehouse canopy fabric is grouped into two independently fading batches. Geometry, walking surfaces and colliders are retained.
- Quay slabs fit around the wooden deck instead of occupying the same surface, eliminating cream triangles across the wood.
- A local cue in the existing footer explains the shell route and retains Brindlefin's return-to-prints guidance before the tracks ability. No new progression, reward or save fields.

## Automated and independent source checks

Candidate passed all 190 tests (`node --import tsx --test tests/*.test.ts`), production build (`npm run build`) and whitespace checks. New regression coverage exercises real world palm recognition, fade hold expiry and local/progress-dependent guidance without mutation.

Independent source reviewer approved exact `5f7b8cb741c700e819aff843d9d612a447749fc3`: no blocking correctness/resource findings; canopy batching and cloned-material cleanup are consistent, footer is scoped and click-through, guidance is read-only, quay heights unchanged. Runtime gates remain separate. No GitHub CI pass is claimed.

## Observed Mac evidence so far

Chrome on Apple M4/ANGLE Metal, 1710 × 809 render pixels. Separate API-disabled origins: immutable baseline 4193 and candidate 4194. User origin 3001 and its save were untouched.

Matched ordinary click routes reproduced a fully hidden player behind the Old Harbor palm on baseline and a readable full silhouette through faded fronds on candidate. Dock default and rotated views changed from cream overlap patches to continuous timber. Walking onto the deck corner succeeded. New default framing and canopy fading expose the player, shell route and waterfront together.

## Controlled performance investigation

Earlier multi-preview runs slowed to 31–33 FPS in Performance mode; even immutable baseline later fell to 11–12 FPS. These are retained in the raw evidence, not treated as a regression comparison. Reversibly navigating six inactive agent-created QA previews to local idle pages immediately restored the unchanged baseline to 60 FPS. Tabs and origin saves were retained; the user's game and unrelated tabs were untouched.

A three-way check then used one QA WebGL context at a time, fresh fair-weather home state, Performance preset at 100%, 1710 × 809, selected browser tab and visible document. Options were open: rendering continued, simulation was paused.

| Build/view | Three rolling FPS samples | Rolling p95 frame times | Approximate draws / triangles |
| --- | --- | --- | --- |
| Immutable baseline 20bc416, old camera | 60 / 60 / 60 | 18.5 / 18.2 / 18.5 ms | 281–282 / 453k |
| Candidate diagnostic, old camera | 60 / 60 / 60 | 18.6 / 18.7 / 18.8 ms | 282–283 / 453k |
| Actual candidate, new camera | 60 / 60 / 60 | 18.6 / 18.7 / 18.1 ms | 398–399 / 488k |

The diagnostic changes only the candidate's default yaw/distance back to baseline values and is not release code. The wider production camera exposes more scene geometry, but no frame-rate reduction was observed in this controlled comparison. This establishes neither performance on other hardware nor an aggregate or thermal-soak benchmark. OS-level focus was not independently asserted; browser-selected tab and document visibility were checked.

## Sustained active routes

One QA view rendered in the selected, visible Chrome tab. Coastal ran 03:46:37–03:51:29 UTC (4m52 wall, approximately 35–45 seconds in Options/journal): dock → palms → home → bridge/wetlands → return and repeat. Arrival samples were 39–43 FPS, rolling p95 approximately 32.6–35.6 ms. Allocations rose while visiting new terrain, then repeated dock/home both held 567 geometries and 47 textures. These Coastal observations are not a matched baseline result.

Performance ran 03:51:42–03:54:53 UTC (3m11 wall, approximately 15–25 seconds in menus): home → bridge/shore → home → dock → home. Arrival samples were 60 FPS, rolling p95 18.3–18.6 ms. Dock and final home held 571 geometries and 47 textures. No crash, stuck input, unreadable player silhouette or companion-follow failure was observed on these routes. Resource stability over these samples is not a long-term leak proof.

Matched Coastal fair/home/depth-shading-on check: baseline 45/43/43 FPS (rolling p95 33.9/37.4/34.9 ms), actual new camera 41/40/39 FPS, candidate old-camera diagnostic 43/40/45 FPS. A baseline recheck returned 42/45 FPS (38.6/33.4 ms). The wider view submits approximately 1,144 draws/1.44M triangles versus baseline 986/1.407M. These noisy samples do not establish zero Coastal cost; an exact distance-16 diagnostic was also tested. It reduced draws to about 1,065/1.424M triangles but returned 41/40/42 FPS (p95 37.1/35.1/35.1 ms), without a persuasive improvement over distance 17 and with less water visible. The integration decision retains distance 17 for clearer coastal composition. A possible small Coastal framing cost is accepted explicitly; **performance preserved** and **60 FPS in all presets** are not claimed. Performance mode maintained 60 FPS in both controlled comparisons and the active route. No further speculative tuning was added.

The completed first-sprint save reloaded on the candidate with $10,250, journal 1/6, Brindlefin and the exterior optic display retained. Ordinary movement and following passed. No reward duplication or save clearing occurred. The completed-save map route reached the open observatory gate and ordinary clicks traversed the sand opening with readable player/companion; discrete captures do not certify absence of a momentary height pop at the existing terrain crease.

 Desktop bond/ability/reload, truck acceleration/braking/exit, interrupted greeting, and 390 × 844 mobile layout/input passed; exact final fresh opening is captured. The legacy wildlife view opened and accepted movement.

## Boundaries and limitations

No paid providers, credentials, deployments, security changes, user-process restarts or save clearing. One stopped task-owned static QA server was restored after confirming no listener; user servers were untouched. A read-only process-list command was denied by the sandbox and was not retried; ordinary browser/game-panel verification continued. Terrain physics was not altered: the existing observatory cliff-edge height discontinuity remains. No novice pacing study or audio audition is claimed.
