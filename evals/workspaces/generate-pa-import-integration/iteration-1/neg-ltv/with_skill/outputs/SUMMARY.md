# With-skill summary — neg-ltv

(Recovered from response — harness blocked .md write.)

**Verdict:** NEGATIVE — `generate-pa-import-integration` is NOT the right skill. No artefacts generated.

**Why:**
- `generate-pa-import-integration` is scoped to PA Data Source (DMDS) imports — `split+tokenize+loaddata+flush` with `objectType=DMDS`.
- The request is for LTV — a single-key Pricing Parameter (PPV) table.
- LTV uses `pfx-api:loaddata?objectType=LTV&pricingParameterName={name}` — no `dsUniqueName`, no `flush`.
- Skill description explicitly redirects: "For LTV/MLTV2 use `generate-ppv-import-integration`."

**Correct skill:** `generate-ppv-import-integration`.
