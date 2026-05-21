# Evals — Pre-commit checklist for plugin changes

Before you commit a change that touches a `skills/*/SKILL.md`, `docs/*.md` referenced by a skill, or `tools/` behaviour, **re-run the output-quality eval** for the affected skill(s) and compare against the last committed iteration. This is the regression net for the plugin.

## TL;DR — what to run

Open a fresh Claude Code session in the plugin root, then:

```
/skill-creator:skill-creator eval pricefx-im-plugin:<skill-name>
```

Replace `<skill-name>` with one of:

| Skill | Last committed iteration | Pass rate (with-skill / baseline) |
|---|---|---|
| `generate-import-integration` | `iteration-1` (squash-merged via !26, develop SHA `cd66927`) | 100% / 92% |
| `generate-pa-import-integration` | `iteration-1` (squash-merged via !27, develop SHA `4e0df1a`) | 97% / 66% |
| `generate-ppv-import-integration` | — (PFIMCORE-3026) | — |
| `generate-rest-outbound-integration` | — (PFIMCORE-3027) | — |
| `analyze` | — (PFIMCORE-3028) | — |

If your change touches a skill not in this table, see [Adding a new eval](#adding-a-new-eval) below.

## When to run

| Change type | Run eval before commit? |
|---|---|
| Edit `skills/<name>/SKILL.md` | **Yes** — for that skill, at minimum |
| Edit `docs/*.md` referenced by a skill (e.g. `docs/routes.md`, `docs/components.md`) | **Yes** — for every skill that loads that doc via `@docs/...` in CLAUDE.md |
| Edit shared CLAUDE.md | **Yes** — for at least one representative skill (start with `generate-import-integration`) |
| Edit `tools/` (the `pfx` CLI) | Only if the skill's instructions changed in lockstep; usually no |
| Edit `evals/skills/<name>.md` (the eval case definition) | **No** — that's a test change; re-running on the same skill version validates the new test |
| New skill added | **Yes** — must ship with an `evals/skills/<name>.md` and a passing iteration-1 |
| Typo, comment, or whitespace in a skill | **No** — common sense applies |
| Anything under `evals/workspaces/` | **No** — these are eval outputs, not skill sources |

## What "passing" means

The eval workflow spawns N positive + negative + edge cases against the skill twice — once with the skill loaded (`with_skill`) and once without (`without_skill` baseline). For each run, ~5–10 grep assertions check whether the generated route/mapper/properties bundle includes the right Camel components, object types, and patterns (and *doesn't* include the wrong ones).

The bar to clear before committing:

- **with-skill pass rate ≥ previous iteration's with-skill pass rate.** A drop is a regression.
- **No new failures on cases that previously passed.** Look at the per-eval breakdown in the viewer, not just the aggregate.
- **No new false-positive assertions.** If a case fails but the output is actually fine, it's the assertion that's wrong, not the skill — relax the assertion and re-grade (see the `businessKeys=sku` example in MR !26).

Baseline pass rate is informational, not a target. It exists to quantify how much value the skill adds over Claude-with-docs-only. If `delta ≤ 0`, the skill isn't pulling its weight and the eval probably needs more discriminating cases.

## How to interpret the viewer

After the workflow completes, a browser window opens at `http://127.0.0.1:3117` with two tabs:

- **Outputs** — click through each test case, see the actual files the subagent produced, side-by-side with the baseline. The "Previous Output" collapse shows the prior iteration's result so you can spot drift visually.
- **Benchmark** — aggregate stats and per-eval pass/fail table.

You don't have to leave feedback for every case. Type a comment only on cases where:
- The assertion is wrong (false positive — flag with rationale, Claude will relax it and re-grade).
- The output looks subtly off in a way the assertions don't catch (the skill produced syntactically correct XML but with a wrong constant value, a missed encoding, etc.).

When you click **Submit All Reviews**, `feedback.json` lands in the iteration directory.

## How long does it take

| Skill | Cases | Wall clock | Tokens |
|---|---|---|---|
| `generate-import-integration` | 10 | ~2 min | ~1.1 M |
| `generate-pa-import-integration` | 7 | ~2 min | ~730 k |

The subagents run in parallel, so wall clock is roughly the slowest case's time, not the sum.

## Workflow at a glance

The `/skill-creator:skill-creator eval` command (run by Claude in your session) does this for you, but for reference:

1. Read the existing eval cases from `evals/skills/<skill>.md`.
2. Create `evals/workspaces/<skill>/iteration-N/` with one dir per case + `with_skill/` and `without_skill/` subdirs.
3. Spawn N × 2 subagents in parallel; each writes a route/mapper/properties bundle to its subdir.
4. Grade each output against grep assertions defined in `eval_metadata.json`.
5. Aggregate into `benchmark.json` + `benchmark.md`.
6. Launch the eval viewer for human review.
7. If you accept the iteration, commit `evals/workspaces/<skill>/iteration-N/` along with the underlying skill change.

## Adding a new eval

If you add a new skill or want coverage for an existing one without an eval:

1. Create `evals/skills/<skill-name>.md` documenting positive / negative / edge cases. Use one of the existing files as a template (e.g. `evals/skills/generate-import-integration.md`).
2. Add the skill to `evals/benchmarks/config.md` if it's one of the critical-path skills.
3. Run the iteration-1 workflow via `/skill-creator:skill-creator eval pricefx-im-plugin:<skill-name>`.
4. Commit `evals/skills/<skill-name>.md` + `evals/workspaces/<skill-name>/iteration-1/` together.

## When the eval fails

If with-skill pass rate dropped:

1. Open the viewer. Find the case(s) that newly failed.
2. Look at the assertion `evidence` field. It tells you what specifically is missing.
3. Look at the actual output files in `evals/workspaces/<skill>/iteration-N/<case>/with_skill/outputs/` — these are the files Claude generated using your edited skill.
4. Either fix the skill (most common) or relax the assertion (if you've genuinely decided the previously-required behaviour is no longer needed — document why in the commit).
5. Re-run the eval. Iterate until pass rate ≥ previous iteration.

## What this does NOT cover

- **Trigger evals** — i.e. whether Claude picks the right skill for a given user prompt. The current harness (`scripts/run_eval.py` in the upstream skill-creator) doesn't measure real plugin routing; see `evals/benchmarks/config.md` "Known Harness Limitation". For now, when you change a skill's `description:` field, smoke-test manually via the prompts in `evals/triggers.md`.
- **Trigger eval automation** — tracked separately; multi-day project.
- **End-to-end runs against a real Pricefx partition** — the eval subagents are instructed to synthesize plausible mappings when the `pfx` CLI is unavailable. Deploy verification is a separate concern.

## Files in this directory

```
evals/
├── README.md                — this file
├── triggers.md              — manual test plan for trigger routing (per-skill prompts)
├── benchmarks/
│   └── config.md            — which skills are in scope + known harness limitations
├── skills/
│   └── <skill-name>.md      — eval case definitions (positive/negative/edge) per skill
└── workspaces/
    └── <skill-name>/
        └── iteration-N/     — output of one eval run (artifacts + grading + benchmark)
```
