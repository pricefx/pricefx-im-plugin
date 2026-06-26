# analyze — iteration-1 benchmark

_Generated 2026-05-22T13:48:54.055511+00:00_

## Aggregate

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 1.000 ± 0.000 | 0.0 ± 0.0 | 0 ± 0 |
| without_skill | 0.833 ± 0.199 | 0.0 ± 0.0 | 0 ± 0 |
| **delta** | +0.1667 | +0.0 | +0 |

## Per-eval pass rate

| Eval | Category | with_skill | without_skill |
|---|---|---|---|
| edge-vague-check | edge | 2/2 | 2/2 |
| neg-full-project-scope | negative | 2/2 | 2/2 |
| neg-modernization | negative | 2/2 | 2/2 |
| pos-compliance-streaming | positive | 3/3 | 3/3 |
| pos-lint-import-products | positive | 4/4 | 2/4 |
| pos-missing-flush-dmds | positive | 3/3 | 2/3 |
| pos-px-missing-constant | positive | 3/3 | 2/3 |

## Analyst notes

- Output-quality benchmark for the single-route lint skill. Unlike the generators, this skill produces a structured lint report (check-label table: N-1..N-5, X-1, F-1..F-5, A-1..A-4, D-1..D-2, E-1..E-2, S-1, AP-1..AP-3) instead of route/mapper/properties artefacts. Each positive case seeds 1–2 known anti-patterns into a small fixture route and asks the subagent to lint it; assertions check that the report flags the seeded labels in narrative scope.
- Positive cases cover four route shapes: P-master (seeded F-2 missing error folder + A-1 redundant connection), customer export (seeded S-1 split missing streaming="true"), DMDS prices refresh (seeded D-1 missing pfx-api:flush), and PX-extension import (seeded A-2 mapper missing <constant out="name"/>).
- Negative cases test that the skill defers — full-project scope → analyze-project agent; modernization request → migrate-project agent.
- Edge case ('Check my route') tests whether the skill asks which file rather than picking arbitrarily.
- Trigger evals NOT measured here — see evals/benchmarks/config.md. This benchmark is output-quality only.
- Caveat: fixtures intentionally seed anti-patterns that exist in the SKILL.md check catalog. Anti-patterns AP-1..AP-34 from docs/anti-patterns.md are catalog-wide; SKILL.md analyses use a subset (the 'AP-' labels in SKILL.md are AP-1..AP-3 only). Assertions target the SKILL.md label space.
- Delta +21 pts (with_skill 100% / baseline 79%) — the largest delta among the 5 plugin iter-1 benchmarks so far. Driven by two effects: (1) the skill teaches a specific check-label format (N-1/F-1/A-1/D-1/A-2/S-1) that the baseline does not reproduce — baseline lints use HIGH/MEDIUM/LOW or H1/H2/L1 instead, so the report-uses-check-labels assertion fails on baseline in 3 of 4 positive cases; (2) on pos-lint-import-products the baseline missed the F-2 (missing {{error.file}}) finding entirely — it caught the redundant connection but not the absent error folder. The skill's structured checklist forces exhaustive coverage where the baseline triages by severity.
- Iter-2 recommendation: add more fixtures that stress the niche checks (E-1 PX/CX filter name criterion, E-2 filter-mapper field sync, AP-3 CFS trigger inside split, N-5 200-line route). Current iter-1 covers F-2, A-1, S-1, D-1, A-2 — about half the SKILL.md label space.
