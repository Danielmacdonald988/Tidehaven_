# Tidehaven Codex directors

These project roles support the existing Tidehaven vision and AFTERLIGHT implementation. They are reusable instructions, not six continuously running workers. The main agent coordinates each task and uses only the roles it needs.

## Role catalog and boundaries

The linked TOML `developer_instructions` are the canonical role briefs on every surface. Cloud agents can read them as text even when native custom-agent discovery is unavailable.

| Role / native name | Owns | Boundary and evidence |
| --- | --- | --- |
| [Creative Director](../.codex/agents/creative_director.toml) / `creative_director` | Vision, player experience, priorities, feature-bloat prevention | Bounded brief and acceptance criteria; read-only by default, no unsolicited implementation |
| [Graphics & Environment Director](../.codex/agents/graphics_environment_director.toml) / `graphics_environment_director` | Lighting, terrain, water, weather presentation, animation, materials, camera | Matched rendered views/clips; preserve colliders and simulation; agree render costs with Engine |
| [Creature & Gameplay Director](../.codex/agents/creature_gameplay_director.toml) / `creature_gameplay_director` | Discovery, player-facing creature behavior, encounters, progression, gameplay loops | Play the affected loop and reload saves; ambient ecology belongs to Simulation |
| [AI & World Simulation Director](../.codex/agents/ai_world_simulation_director.toml) / `ai_world_simulation_director` | NPC intelligence, world events, ambient ecology, persistent simulation | Reproduce state transitions; distinguish actual live AI from fallback; gameplay rewards require Gameplay agreement |
| [Engine & Performance Director](../.codex/agents/engine_performance_director.toml) / `engine_performance_director` | Rendering efficiency, loading, streaming, architecture, Mac compatibility | Matched profiling with hardware and settings; no speculative rewrite or cloud-only Mac certification |
| [QA & Player Experience Director](../.codex/agents/qa_player_experience_director.toml) / `qa_player_experience_director` | Playtesting, regressions, gameplay feel, independent verification | Reproduction steps and observed outcomes; read-only game code by default, return defects to their owner |

No domain grants permanent ownership of a source file. The coordinator assigns exact files per task and reconciles existing contracts (including VISUAL-CONTRACT.md). Only one writer may edit a shared file at a time. Serialize dependent changes and reserve exclusive browser/server access. QA can inspect in parallel but must test the integrated result before certifying it.

Assignment template:

```text
Role:
Goal and player-visible acceptance criteria:
Non-goals:
Writable files (one writer each):
Read-only references and applicable contracts:
Dependencies and shared interface constraints:
Validation / playable evidence required:
Stop condition and handoff:
```

## Cursor using Codex

Use the OpenAI Codex IDE extension in Cursor, or the Codex CLI from this project's root. These are Codex roles, not a configuration for Cursor's separate native agent.

After merging the setup PR, fetch/pull the merged branch into the existing Cursor checkout without discarding local work. To inspect before merging, fetch and check out `codex/director-roles` in a clean worktree. Start a fresh Codex conversation after updating files; reload the extension if an existing session retains stale instructions. No Mac/OS restart is required. No local Mac operation was performed during setup.

Current official local Codex documentation supports automatic discovery of `.codex/agents/*.toml`. Each file here contains only `name`, `description`, and `developer_instructions`. There is no project `config.toml`, legacy role registration, model selection, feature enablement, or permission override in this setup. Existing model/reasoning defaults and parent permissions/provider/MCP settings apply. If the installed extension is older or does not expose these names, use the fallback below; this setup does not update clients or change their settings.

Example prompt:

```text
Read AGENTS.md and docs/CODEX-DIRECTORS.md. Coordinate a read-only review of
creature discovery in the current region. Delegate a bounded loop review to
creature_gameplay_director and independent verification planning to
qa_player_experience_director if those native agents are available. Give each
an explicit scope, gather their findings, and propose the smallest improvement.
Do not implement new features in this review.
```

For implementation, replace the review goal with a specific authorized change and assign non-overlapping writable files before delegation. Ask for named subagents explicitly. The files themselves do not launch workers, enforce filesystem isolation or guarantee concurrency. Current CLI users can inspect activity with `/subagents`; IDE activity depends on the installed extension.

## Codex through ChatGPT / cloud

Select `Danielmacdonald988/Tidehaven_` and a branch containing this setup (or the default branch after merge) in the Codex cloud environment. Start a new task so the checkout includes these files. An ordinary ChatGPT conversation without repository/environment access does not install or run these project roles.

The official custom-agent mechanism is documented for **local Codex clients**. Do not assume cloud automatically registers these TOML names. Root AGENTS.md provides shared routing, and the TOML files provide portable role briefs. Use this prompt:

```text
Read AGENTS.md and docs/CODEX-DIRECTORS.md in Tidehaven_. Coordinate [bounded task].
Read the relevant director TOML developer_instructions. If this environment
supports delegation, give those briefs and bounded file ownership to its
available subagents; otherwise perform labeled role passes sequentially.
State which execution mode actually ran. Preserve the game vision and verify
the affected playable outcome; report untested checks honestly.
```

Cloud generic subagents are not proof of native TOML discovery. Do not pretend sequential role passes are parallel workers. Never change approval/security settings to make delegation work.

## Evidence and configuration validation

Setup checked on 2026-10-22 in the saved Linux cloud environment:

- The checkout is not empty: existing game source, tests and artifacts were present. The setup branch starts from remote `main` at `df24a136d36fe7efe671ff25bfc306cffafe67eb`.
- The pre-existing master instructions were named `Agents.MD`. They were renamed to the automatically discovered `AGENTS.md` (avoiding two case-conflicting files on Mac), with their original contents preserved verbatim as the prefix. Coordination guidance was appended.
- No existing project Codex configuration or project `.agents/skills` was present. Existing user configuration was not edited.
- Installed CLI: `codex-cli 0.163.0`. Python `tomllib` parses all six files; validation checks exactly the three required nonempty fields, unique names and filename/name agreement. `git diff --check` checks whitespace.
- Installed `codex debug prompt-input` successfully renders the root AGENTS.md instructions with an isolated temporary Codex home. The app-server `config/read` request also succeeds in that isolated home; it does **not** enumerate standalone roles, so this is not evidence that six native agents loaded.
- The normal app-server startup cannot write its SQLite state under the managed read-only `/run/codex-environment/codex-home`. Temporary validation avoids changing that directory or user settings. `codex doctor --summary` reports configuration loaded but provider reachability failed in this environment.
- Native role spawning and Cursor extension loading were **not** exercised. Cloud native custom-role registration is **not** claimed. No model execution, gameplay test/build, browser playtest or new Mac performance test was run for these instruction-only changes. Existing release evidence remains historical and unchanged.

Recheck syntax from the repository root with Python 3.11+:

```sh
python - <<'PY'
from pathlib import Path
import tomllib
paths = sorted(Path('.codex/agents').glob('*.toml'))
assert len(paths) == 6
names = set()
for path in paths:
    role = tomllib.loads(path.read_text())
    assert set(role) == {'name', 'description', 'developer_instructions'}, path
    assert all(isinstance(v, str) and v.strip() for v in role.values()), path
    assert role['name'] == path.stem and role['name'] not in names, path
    names.add(role['name'])
print('PASS: six director definitions')
PY
git diff --check
```

For future game changes, use the repository's existing `npm test` and `npm run build`, then actual affected-mode play and evidence appropriate to the claim. Do not treat these setup checks as gameplay validation. Preserve saves and never read or print `.env.local`.

Official reference: [Subagents and custom-agent format](https://learn.chatgpt.com/docs/agent-configuration/subagents) (checked 2026-10-22). The current guide documents standalone project TOML files and local-client scope; native availability still depends on the actual client and runtime.
