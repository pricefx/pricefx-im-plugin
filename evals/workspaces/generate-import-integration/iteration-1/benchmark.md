# generate-import-integration — iteration-1 benchmark

_Generated 2026-05-21T15:23:30.594595+00:00_

## Aggregate

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 1.000 ± 0.000 | 109.0 ± 70.3 | 63243 ± 2543 |
| without_skill | 0.917 ± 0.171 | 110.6 ± 65.7 | 47941 ± 1599 |
| **delta** | +0.0833 | -1.6 | +15302 |

## Per-eval pass rate

| Eval | Category | with_skill | without_skill |
|---|---|---|---|
| c-customer-sftp-6am | positive | 5/5 | 5/5 |
| edge-generic-csv-daily | edge | 2/2 | 2/2 |
| edge-no-type-specified | edge | 2/2 | 2/2 |
| neg-dmds-sales-history | negative | 3/3 | 2/3 |
| neg-ltv-exchange-rates | negative | 3/3 | 3/3 |
| neg-mltv2-discount-matrix | negative | 2/2 | 1/2 |
| p-master-sftp-daily | positive | 6/6 | 6/6 |
| px-prices-hourly | positive | 5/5 | 5/5 |
| px-rename-loaddatafile | positive | 6/6 | 6/6 |
| sl-seller-rest-4h | positive | 6/6 | 6/6 |

## Analyst notes

- With-skill is strictly equal-or-better than the baseline on every eval. All wins are concentrated on negative cases (correct PA/PPV redirects).
- neg-dmds-sales-history: with-skill 100% (deferred to generate-pa-import-integration), baseline 67% — baseline generated a DMDS import using pfx-api:loaddataFile, which the docs explicitly warn against (DMDS needs split+tokenize+loaddata+flush).
- neg-mltv2-discount-matrix: with-skill 100% (deferred to generate-ppv-import-integration), baseline 50% — baseline built an MLTV2 route without flagging that a specialized skill exists.
- neg-ltv-exchange-rates: tied at 100% — with-skill deferred; baseline built a functioning LTV route. Both technically correct; the redirect is preferable per the plugin's organization.
- Positive cases (P, PX, C, SL, PX-rename): tied at 100% — both configurations produce a workable route+mapper+properties bundle.
- Edge cases (no type / generic CSV daily): tied at 100% — both correctly asked for clarification (the skill's Step 2 enforces this explicitly, the baseline reached the same conclusion from the project docs).
- Cost trade: skill adds ~15k tokens per invocation (reading SKILL.md) and saves ~2s. The token cost buys protection against the negative-case misroutes — worth it on any real run.
- Trigger evals NOT measured here — see evals/benchmarks/config.md for the known scripts/run_eval.py harness limitation. This benchmark is output-quality only.
- All 20 runs completed without leaking writes into src/main/resources/repo/ (verified via git status).
- Caveat: pfx CLI was unavailable during the runs (no .env), so all field-to-attribute mappings are synthetic. Real-world output quality on Smart Auto-Mapping is not exercised by this benchmark.
