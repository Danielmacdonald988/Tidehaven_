# First Brindlefin encounter

Baseline: `3b7bf852fce4d17b19c27e160a7926cb72e0f373`. Isolated feature branch: `feat/first-brindlefin-encounter`. Active `/Users/danielmacdonald/afterlight` checkout and Cursor buffers were not edited.

The bounded player outcome is a physical trail from the regional home to Brindlefin, readable greeting responses, and a visible payoff when this first companion reveals the existing tracks toward Cairnback. Players remain free to leave the trail. No species, currencies, systems, providers, save fields, collider changes or external assets were added.

## Ownership and acceptance

The coordinator read AGENTS.md, the director guide and creative, environment, gameplay and QA role briefs. There is no project `.agents/skills` directory at this baseline. Three generic specialist agents ran concurrently with those role briefs; this is not a claim of native custom-role discovery. Existing contract ownership was explicitly reconciled for this task:

- Graphics/environment: `src/wildlife/World.ts`, `docs/environment-encounter-notes.md`; route clues and track reveal, preserving physical layout and public APIs.
- Creature/gameplay: `src/wildlife/Creatures.ts`, optionally `src/wildlife/engine.ts`, and `tests/first-encounter.test.ts`; readable reactions and regression checks. Engine changes were unnecessary.
- QA: read-only implementation review; `docs/first-encounter-qa.md`, `artifacts/first-encounter/qa-*`; exclusive test browser/server access.
- Coordinator: `src/region/App.tsx`, integration, scope and this release record.

Acceptance requires actual fresh-game travel from regional home, encounter/bond and first ability, repeated-action safety, returning save/reload preservation, startup/retry checks and matched-settings responsiveness. Screenshots are observations from scripted agent interaction, not an unfamiliar-player study. QA records exact results and limitations separately.

## Implementation

Cream shell impressions leave the warehouse and skirt the parked truck toward Brindlefin's tide sand. Once Brindlefin accompanies the player, warm shoreline clues lead to the existing sniffing site. Its ability exposes larger footprints outward over 1.8 seconds, then leaves the trail visible. Rendering reads existing companion, ability and event state; it does not write progression or replay rewards. Instance bounds cover the complete trail before its draw count changes, and instance resources are disposed explicitly.

Brindlefin folds its fins and lowers its head when wary, tilts curiously, and opens its fins with an offered paw when receptive. These poses blend into the existing rig without new geometry. The regional encounter uses brief matching cues, existing notices now show ability success and missed pulses, and the first bond points toward the shells.

Original procedural assets only. The prior 46 individual footprint meshes become three instanced meshes plus five shell ribs, with no extra lights or per-frame geometry/material creation. Actual performance must be assessed from the QA measurements, not mesh counts alone.

## Validation

The final suite passed **180/180** after supported local execution approval for tsx's IPC socket. The three new tests cover older saves without retained ability events, reveal culling/resource lifetime, and greeting poses returning to neutral. `npm run build` passed (existing large-chunk advisory); `git diff --check` passed. Logs are in `artifacts/first-encounter/tests.txt` and `build.txt`. Mac browser evidence and its limitations are recorded in [first-encounter-qa.md](first-encounter-qa.md).

No merge or deployment is authorized. Next highest-impact follow-up is a human first-time discovery/pacing session using this bounded encounter, before expanding content.
