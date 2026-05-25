# Baseline (no skill) summary — neg-mltv2-discount-matrix

(Recovered from response — harness blocked .md write.)

**Notable:** Baseline DID generate an MLTV2 import — it did not defer to a different skill.

**Files:**
- `import-discount-matrix.xml` — Camel 4 route. `file://{{integration.sftp.root}}/import/discount-matrix` with `delay=10000`, `{{archive.file}}`, `{{read.lock}}`. `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile?objectType=MLTV2&mapper=import-discount-matrix.mapper&pricingParameterName=DiscountMatrix&batchSize=100000`.
- `import-discount-matrix.mapper.xml` — `<loadMapper id="import-discount-matrix.mapper">` mapping `customerId → key1`, `sku → key2`, `quantityTier → key3`, `discountPct → attribute1` (stringToDecimal(us,0,4)), `validFrom → attribute2`, `validTo → attribute3`, `currency → attribute4`. Provisioned-IM `<mappers>` root.
- `application.properties.snippet` — `archive.file`, `read.lock`, `error.file`.
- `sample-discount-matrix.csv` — 8-row sample.

**Design choices:**
- MLTV2 + `pricingParameterName=DiscountMatrix`.
- Three keys: customerId, sku, quantityTier.
- `discountPct` as decimal (assumed fraction).
- `loaddataFile` + streaming.
- Camel 4 form.

**Assumptions:**
- `DiscountMatrix` PPV table must already exist with key1/key2/key3 + attribute1..4.
- CSV headers assumed.
- Discount as decimal fraction.
- Full replace each run.
