# Benchmark Configuration

## Scope

This benchmark covers **trigger accuracy** for the top 5 skills with the most confusion zones in the plugin. Output-correctness benchmarks (Vrstva 2 / Vrstva 3 in the eval taxonomy at `evals/triggers.md`) are out of scope.

## Skills to Benchmark

1. `generate-import-integration` (P/PX/C/CX/SL/SX imports) — Critical. Confusion partners: `generate-pa-import-integration`, `generate-ppv-import-integration`.
2. `generate-pa-import-integration` (DMDS / PA Data Source) — Critical. Pattern is fundamentally different from standard imports (split + flush vs `loaddataFile`).
3. `generate-ppv-import-integration` (LTV / MLTV2 Pricing Parameters) — Critical. Easy to confuse with standard imports when prompt mentions "lookup table".
4. `generate-rest-outbound-integration` (IM → external HTTP) — High. Inverse direction of `generate-inbound-rest-endpoint`.
5. `analyze` (single-route lint) — High. Easy to confuse with `analyze-project` agent (full-project scope).

## Benchmark Parameters

- **Runs per query**: 3 (default of `scripts/run_eval.py`)
- **Trigger threshold**: default (50% of runs must trigger for ✅, 50% must NOT trigger for ❌)
- **Compare against**: baseline = no skill installed (Claude handles task directly without consulting a skill)

## Metrics Tracked (when harness works)

- **Trigger precision**: of cases where the skill triggered, what fraction were `should_trigger: true` (avoids false positives)
- **Trigger recall**: of `should_trigger: true` cases, what fraction actually triggered (avoids false negatives)
- **Pass rate**: combined PASS rate across all positive + negative cases

## Success Criteria (aspirational)

- Trigger precision: > 90%
- Trigger recall: > 85%
- All negative cases: ❌ correctly not triggered

## Known Harness Limitation (as of 2026-05-21)

`scripts/run_eval.py` from the `skill-creator` plugin synthesises a slash-command file in `.claude/commands/<uuid>.md` carrying the skill's description, then runs `claude -p "<query>"` and watches whether Claude invokes that synthetic command. **It does NOT measure whether Claude invokes the real plugin skill.**

An end-to-end run earlier today (5 skills × ~6 queries × 3 runs = 80+ invocations) returned 0% trigger rate **across all runs** — both POSITIVE and NEGATIVE cases produced identical 0 triggers. This is not a description-quality finding; it indicates the harness as configured is not measuring real plugin routing.

For real-plugin trigger evals, a custom runner that installs the plugin via `/plugin install` into an isolated Claude Code session and observes actual skill invocation would be required. That is a multi-day project, not the scope of this benchmark.

## What this benchmark IS useful for

- Manual smoke-checks: human runs each prompt in a fresh Claude Code session, observes which skill triggers, records PASS / FAIL.
- Code review: when a `description:` field changes, the per-skill files in `evals/skills/` document the expected triggering behavior before/after.
- Static lint baseline: a future static lint can read the eval files and verify the skill's description contains keywords from each positive case.

## Run instructions (manual)

For each skill `X` in the list:

1. Open a **fresh** Claude Code session (`/clear` or new window).
2. Read `evals/skills/X.md`.
3. For each Positive Case prompt, paste it verbatim and observe:
   - Which skill / agent did Claude invoke?
   - Did the generated artefact match the "Expected behavior" checklist?
4. For each Negative Case prompt, verify Claude does NOT invoke skill `X` (it should pick the alternative listed).
5. Record PASS / FAIL.

Expected time: ~3 min per case × ~7 cases per skill × 5 skills = ~100 min for full coverage. Practical: spot-check 1-2 cases per skill (15-20 min total) after each `description:` change.

## When to re-run

- After any change to a `description:` field on one of the 5 benchmarked skills
- Before tagging a release
- When a real user reports "skill X didn't trigger when I asked for Y"
