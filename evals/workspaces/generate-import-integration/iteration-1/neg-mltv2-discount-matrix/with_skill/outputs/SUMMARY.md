# Decision: deferral (wrong skill) — neg-mltv2-discount-matrix

(Recovered from response — harness blocked .md write.)

**Decision:** `generate-import-integration` is NOT the right skill. No artefacts generated.

**Why:**
- SKILL.md frontmatter: "For Pricing Parameters (LTV/MLTV2) use `generate-ppv-import-integration`."
- Supported object types: P, PX, C, CX, SL, SX — MLTV2 is not in scope.

**Correct skill:** `generate-ppv-import-integration` (handles LTV single-key + MLTV2 multi-key matrix Pricing Parameter imports).

For an MLTV2 DiscountMatrix import, the right skill would emit:
- `objectType=MLTV2` with `pricingParameterName=DiscountMatrix`
- Multi-key field mapping (`key1`, `key2`, `key3`, ... for customer × product × quantity tier)
- PPV batch sizes (5,000–10,000)
