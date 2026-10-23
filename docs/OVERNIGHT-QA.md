# First-ten-minute sprint — verification record

## Player outcome and exact source

PR3 adds the physical Brindlefin departure trail, expressive greeting/bond reactions and first track reveal. PR4 adds directional water highlights and balanced coastal lighting. PR5 connects the earned tracks to the existing wetland clue, companion passage and observatory, with a recognizable brass/glass lens, empty collection cradle and exterior home display. Actual play exposed and fixed an uphill sand clipping hole and the original display's canopy occlusion. No new save fields, species, currencies, lights or paid services were added.

Baseline main: `3b7bf852fce4d17b19c27e160a7926cb72e0f373`. PR3: `aa3b207d76923be593db2417377b2011c813bea9`. PR4: `f79249b5503179efa18fb9f0df12938ddc22289d`. Final production implementation: `de8ef2d1cc193e9886765f4a3742db33d740fea0`, source tree `caf18147b5a982df735ff62b4197f2f1a92e8e6f`. Later commits through10cacf1 and this evidence update change only tests/documentation/captures. Runtime labels4fc refer to this same production source.

## Actual Mac gameplay and recovery

Independent QA used visible Chrome and ordinary controls on isolated static origins. No teleport, save injection or paid API calls. Test servers deny API paths; the user's3001 origin and saves were untouched during QA.

- Walked home → wary/retry → receptive greeting → Brindlefin bond → first tracks → bridge → clue → opened/traversed companion passage.
- Physically climbed the repaired path, recovered the lens, reloaded, returned through the open gate and placed the lens at home. Repeated gate/lens/home actions did not duplicate progress or reward. Reload retained $10,250, journal1/6 and Brindlefin.
- Final exterior home display is visibly clear at default camera (`final-exterior-optic.jpg`). Earlier `home-payoff.jpg` proves reward state only: that earlier display was obscured and was corrected.
- Earned-save lazy JS and CSS failures showed readable recovery UI. Exact isolated assets were restored before clicking Try again; both retries retained progress and working movement. No production source or user files were removed. All temporary faults were restored.
- Same-origin baseline initial/home save upgrade retained $10,000 and0/6, rendered the new shells and accepted movement. This was not a rich progressed legacy save; richer earned progress is covered separately by the recovery/reload checks.
- Camera drag, held keys, clicks, graphics tiers, mute and volume controls worked. Audio was not independently auditioned. The first ten minutes are an authored route, not a measured unfamiliar-player pacing claim.

## Sustained Mac observations

Chrome1710×809; the game's visible panel reports Apple M4/ANGLE Metal. No denied GPU page was revisited. No concurrent coordinator builds/tests ran during this session.

Coastal100%, depth shading on:02:10:33.730–02:23:04.580UTC,12m31 wall time. Estimated1–1.5min of brief Options sample pauses leaves over10min of foreground simulation with intermittent movement/inspection. Route: home → bridge → Fern Reach → opened passage → observatory → home, repeated observatory circuit, then waterfront/dock. Weather cycled naturally. No crash, context loss, stuck input or traversal blocker observed. Seven short rolling panel samples were60FPS, p9518.1–18.7ms.

The matched observatory visits had identical233draws,1,133,689triangles,462geometries and45textures. First-visit allocations rose as previously unseen areas rendered; this is not presented as a leak. Performance100% repeat ran02:23:04.580–02:26:55.569UTC,3m51 wall with brief sample pauses. Three samples were60FPS, p9518.1–18.5ms, with578geometries/48textures stable across town → wetlands → town. Coastal was restored afterward.

These are sustained play observations with short rolling readings, **not** an aggregate route percentile, continuous-input benchmark, thermal/heap soak or FPS guarantee. See `artifacts/overnight/performance.txt`. Baseline comparison was only a short settled60FPS/p9517.6ms sample; no matched-duration baseline benchmark is claimed.

## Simulated runtime reduced-motion preference

Native Chrome selection timed out, and available browser capabilities exposed no media emulation. An isolated4192 QA harness therefore supplied only the `prefers-reduced-motion: reduce` response before loading the unchanged production bundle. A labelled UI toggle controlled the simulated response; no OS/browser settings or saved progress were modified. QA-only pass-through WebGL observers displayed the value submitted to `uniform1f` for `coastalBreezeTime`, its upload count and ongoing draw calls. Independent review confirmed argument/return forwarding and the test's scope.

OFF: water time9.484500/uploads392 advanced to19.471300/802. ON:26.368100/1078 stayed exact while preference reads1083→6621 and draw calls990258→6042419 advanced. OFF again:33.228300/uploads1349. Screenshots `motion-telemetry-on-a.jpg`, `motion-telemetry-on-b.jpg` and `motion-telemetry-resumed.jpg` support freeze/resume while the scene remains active.

This verifies **submitted shader-time freeze/resume under a simulated runtime preference**. It is not GPU readback, native preference detection/change events or CSS media-query testing. Existing water streak geometry, rain, boats and creature animation may continue; the feature freezes only the newly added ripple clock. Screenshot-only comparison was inconclusive because of rain and existing streak motion, so it is not used as proof. Harness source is preserved as `artifacts/overnight/motion-harness.html`; it is test-only and never part of the production entrypoint.

## Automated and independent review

Exact10cacf1:187/187 tests, TypeScript/Vite build and whitespace checks passed. The strengthened expedition test uses real saveRegion/loadRegion at each stage, verifies full state equality and unchanged stored contents, and checks one-time reward after reload. Save implementation/schema/startup boundary are unchanged from baseline. Final evidence-commit and merged-tree checks are recorded by the coordinator before release.

Independent source reviews of7fc0e08,1f9748c,de8ef2d and test/docs follow-up4fc77fe found no blocking findings. See `OVERNIGHT-SOURCE-REVIEW.md`. Terrain regression raycasts against the actual ground triangulation. The ascent replaces one existing draw with2,126 static triangles/~204KB; optics share four geometries/materials without new textures, lights or shadow casters. No CI success is claimed: queried GitHub checks were absent.

## Access history, remaining limits and integration

Earlier Mac lock and stale native-control calls interrupted QA. The latest native getApp call returned no result before interruption at369.9s; no security/settings change or denial bypass occurred. A later bound-tab read timed out171.2s. Supported REPL reset succeeded0.22s without closing tabs or clearing saves; direct rebind succeeded5.67s, enabling the completed browser-only run above. One QA report append timed out, but coordinator inspection confirmed it had succeeded. These technical interruptions are not measured playtime or denied authorization.

Nonblocking observations: foreground palms can briefly obscure the player near home; an existing sharp terrain crease remains; harbor dock surface overlap patches appeared at a rotated camera without blocking traversal. No new-regression attribution is made without matched baseline evidence. New clip download outcome remained uncertain after an earlier timeout; no new video is claimed or blindly retried.

Merge order: PR3 → PR4 → PR5, with normal merge commits preserving ancestry, exact-head guards and no protection bypass, squash/rebase, force push or branch deletion. PR5 already contains exact PR3/PR4 ancestors; inspect the remaining diff after upstream merges rather than applying their patches again. Recheck the user checkout and use only a safe fast-forward when clean. No release action is implied solely by this report; the coordinator records actual merge and sync results separately.

Local candidate: http://127.0.0.1:4191/ (earned save). Original baseline4190 and test-only motion harness4192 are separate origins. Preserve tabs and saves; inspect availability before reuse.
