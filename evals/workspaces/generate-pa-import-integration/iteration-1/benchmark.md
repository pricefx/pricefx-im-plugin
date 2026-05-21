# generate-import-integration — iteration-1 benchmark

_Generated 2026-05-21T15:36:15.498757+00:00_

## Aggregate

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 0.971 ± 0.070 | 75.9 ± 26.3 | 55574 ± 1975 |
| without_skill | 0.737 ± 0.247 | 89.0 ± 16.1 | 48458 ± 1159 |
| **delta** | +0.2340 | -13.2 | +7116 |

## Per-eval pass rate

| Eval | Category | with_skill | without_skill |
|---|---|---|---|
| edge-vague-source | edge | 2/2 | 2/2 |
| neg-ltv | negative | 3/3 | 3/3 |
| neg-p-master | negative | 3/3 | 3/3 |
| pa-invoices-daily-3am | positive | 4/5 | 2/5 |
| pa-price-analyser-feed | positive | 6/6 | 4/6 |
| pa-s3-transactions-100k | positive | 6/6 | 4/6 |
| pa-saleshistory-tab | positive | 7/7 | 3/7 |

## Analyst notes

- Output-quality benchmark for the PA Data Source (DMDS) generator. The DMDS pattern is genuinely different from standard imports — split + tokenize + loaddata + flush — so the test asks whether Claude reliably picks the right pattern with vs without the skill.
- Positive cases test that the skill produces the canonical DMDS pattern (no loaddataFile, flush present, split with streaming).
- Negative cases (P master, LTV) test that the skill recognizes it's the wrong fit and defers to generate-import-integration / generate-ppv-import-integration.
- Edge case (vague 'load data into Pricefx') tests whether the skill asks for object type rather than silently picking DMDS.
- Trigger evals NOT measured here — see evals/benchmarks/config.md. This benchmark is output-quality only.
- Caveat: pfx CLI was unavailable (no .env), so any partition-metadata-dependent steps use synthetic defaults. The DMDS pattern itself is independent of partition metadata.
