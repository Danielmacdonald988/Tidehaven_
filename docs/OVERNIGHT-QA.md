# First-ten-minute sprint — release candidate, not merged

## Outcome and source

The first Brindlefin encounter now has a physical departure trail and expressive greeting/bond reactions (PR3). Directional water highlights and balanced coastal lighting come from PR4. PR5 connects the earned tracks to the existing wetland clue, companion-assisted passage and observatory. A distinct brass/glass optic replaces the spinning ring; collecting it leaves a cradle and returning home awards the existing one-time reward. No new save fields, species, currencies, lights or paid services were added.

Final implementation: `de8ef2d1cc193e9886765f4a3742db33d740fea0`. Earlier integrated play began at `7fc0e083a8ad0982fed839666db6e8b7413481de`; terrain correction was tested at `1f9748c49df142e59428a0c0c9ba56d079e67a86`. Baseline main: `3b7bf852fce4d17b19c27e160a7926cb72e0f373`.

## Actual Mac evidence

Independent QA used visible Chrome, isolated static origins and ordinary controls; no teleport or injected progression. API paths were denied by the test servers. Existing user origin3001 and saves were untouched.

- At7fc: walked home → wary/retry response → receptive greeting → Brindlefin bond → first tracks → bridge → clue → opened/traversed passage. Reload preserved earned progress.
- At1f: verified the repaired uphill sand path, climbed to the optic, collected it, reloaded, returned through the open gate and physically carried it home. Repeated lens/gate actions correctly reported completed state. Home placement granted $250 once; reload retained $10,250, journal1/6 and companion.
- The first home display was obscured by the canopy. The last implementation moves all display pieces outside the canopy beside the doorway. **This final placement has not yet been visually verified.** `home-payoff.jpg` proves transaction/placement state, not readable instrument visibility.
- Performance tier and movement worked; sound toggle/volume controls responded. Audio was not independently auditioned.
- Independent image review confirmed the triangular path clipping hole disappeared. The existing sharp terrain crease remains; no traversal blocker was observed, but discrete captures cannot exclude a brief avatar height pop.

## Automated and source evidence

- Coordinator exact de8 implementation:187/187 tests, TypeScript/Vite build and whitespace checks passed. Existing large-chunk advisory remains. Logs are in `artifacts/overnight/`.
- Independent QA: exact PR3 archive180/180; integrated7fc186/186 and build passed.
- Fresh independent source reviews of7fc,1f andde8 found no blocking findings; see `OVERNIGHT-SOURCE-REVIEW.md`.
- Terrain regression raycasts against the existing ground triangulation. Revised ascent adds2126 static triangles/~204KB while replacing one existing draw. Optical details share four geometries/four materials; no new lights/textures/shadow casters.
- GitHub statuses, PR-triggered workflows and check-runs were absent on the earlier queried heads. **No CI success is claimed.**

## Performance limits

Chrome viewport1710×809; visible renderer panel reports Apple M4/ANGLE Metal. Coastal100%/depth shading samples: baseline settled60FPS/p9517.6ms; integrated home60/17.6; rainy town60/18.6; gate60/18.7; revised bridge60/17.3. Performance tier100% sample60/18.6. See `performance.txt` for recorded timestamps and counts.

These are short rolling UI readings across interrupted play, not a continuous ten-minute benchmark, thermal/heap soak or measured novice pacing study. Options pauses simulation. No sustained60FPS guarantee is supported.

## Blocker and resume gate

Mac access interrupted before completion. QA's reset/inventory reported the Mac locked and automatic unlock failed; binding the test tab returned **Debugger unattached**. No unlock/security bypass or repeated denied-page access was attempted. Earlier optional clip download hung; its outcome is uncertain and it was not retried. The subsequent native Chrome-control batch also had uncertain partial completion; inspect current UI before further actions.

Remaining required checks before merging: final exterior display/default-camera readability; current earned-save startup failure/retry; baseline-save upgrade; reduced-motion runtime behavior of the new water clock; representative sustained Mac observations; exact-final smoke and independent review/test confirmation. Earlier PR3 startup evidence is historical, not a fresh final-build pass. Reduced motion freezes the new water shader clock only, not all existing world animation.

Local handoff:4191/session52248 serves `tidehaven-sprint/dist` with the earned completed save;4190/session20645 serves `baseline/dist`. Both use task-workspace `qa-static.mjs`, deny API paths, and preserve saves. QA tabs2139238688/2139238687 remain open; no close was attempted. Inspect availability before using either server. Do not repeat the uncertain clip download.

PRs3,4,5 remain draft and unmerged. Original Cursor checkout was last verified clean on main3b7bf85 and was not synced. Once Mac access returns, complete the remaining gates, guard exact remote heads, merge normally without bypass/force push/deletion, then recheck the user checkout before a safe fast-forward and build.
