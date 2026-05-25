# generate-ppv-import-integration — iteration-1 benchmark

_Generated 2026-05-22T11:28:56.746129+00:00_

## Aggregate

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 1.000 ± 0.000 | 0.0 ± 0.0 | 0 ± 0 |
| without_skill | 1.000 ± 0.000 | 0.0 ± 0.0 | 0 ± 0 |
| **delta** | +0.0000 | +0.0 | +0 |

## Per-eval pass rate

| Eval | Category | with_skill | without_skill |
|---|---|---|---|
| edge-lookup-vague | edge | 2/2 | 2/2 |
| ltv-company-params | positive | 6/6 | 6/6 |
| ltv-exchange-rates-daily | positive | 7/7 | 7/7 |
| ltv-lookup-cost-centers | positive | 5/5 | 5/5 |
| ltv-shipping-cost-sftp | positive | 7/7 | 7/7 |
| mltv2-discount-matrix | positive | 7/7 | 7/7 |
| neg-dmds-saleshistory | negative | 2/2 | 2/2 |
| neg-product-master | negative | 2/2 | 2/2 |

## Analyst notes

- Output-quality benchmark for the Pricing Parameter (LTV / MLTV2) generator. The PPV pattern is structurally close to a standard PX/CX import but differs on three points the skill must get right: objectType=LTV or MLTV2, pricingParameterName= on the URI, and a key/value or key1..keyN/attribute* mapper shape with NO <constant out="name"/>.
- Positive cases test that the skill produces the canonical LTV/MLTV2 pattern for the right shape (single-key vs multi-key).
- Negative cases (P master, DMDS feed) test that the skill recognizes it's the wrong fit and defers to generate-import-integration / generate-pa-import-integration.
- Edge case (vague 'small lookup table') tests whether the skill asks to disambiguate Pricing Parameter (LTV/MLTV2) vs extension table (PX/CX) vs Data Source (DMDS) rather than silently picking PPV.
- Trigger evals NOT measured here — see evals/benchmarks/config.md. This benchmark is output-quality only.
- Caveat: pfx CLI was unavailable (no .env), so any partition-metadata-dependent steps use synthetic defaults. The PPV pattern itself is independent of partition metadata.
- Delta is 0 in iter-1 — both with-skill and without-skill scored 100%. This is a real finding, not noise: the PPV pattern is well-documented in docs/components.md / docs/mappers.md (objectType=LTV/MLTV2, pricingParameterName= URI param, key/value vs key1..keyN/attribute* mapper shapes), so Claude with only the shared docs produced equivalent route+mapper+properties bundles. The skill's value-add is largely in interactive Q&A (Step 2 type detection, Step 5b auto-detection of CSV format, Step 3 pfx CLI lookup, the streamingUnmarshal observability trade-off prompt) — none of which is exercised by a single-shot grep-based assertion suite.
- Iter-2 recommendation: add more discriminating cases that target the skill's interactive-flow value-add — e.g. a prompt with attached CSV sample to test auto-detection, a vague-mode prompt that should produce a clarifying question rather than silently inferring MATRIX vs MATRIX2, a prompt asking for upsert (integrate + integrateMapper) vs replace, or a prompt where the user gives a non-trivial table type (RANGE) that only the skill spells out.
