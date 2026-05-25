# Baseline (no skill) summary — neg-ltv-exchange-rates

(Recovered from response — harness blocked .md write.)

Generated baseline LTV ExchangeRates import. Note: baseline (no skill) did NOT defer — it generated a working LTV route directly.

**Files:**
- `routes/import-exchange-rates.xml` — `file://{{integration.sftp.root}}/import/exchange-rates` consumer (local pod storage, not `pfx-sftp`) with `{{archive.file}}` + `{{read.lock}}`. `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile?objectType=LTV&mapper=import-exchange-rates.mapper&pricingParameterName=ExchangeRates&batchSize=500000`. No `connection=pricefx`.
- `mappers/import-exchange-rates.mapper.xml` — `<mappers>` + `<loadMapper id="import-exchange-rates.mapper">` mapping `code → name`, `rate → value` with `converterExpression="stringToDecimal"`.
- `config/application.properties` — `archive.file`, `read.lock`, `error.file`.

**Assumptions:**
- LTV (single-key) table.
- CSV columns named `code` and `rate` with a header row.
- Camel 4 (also valid as Camel 3 — no `*Ref` attributes).
- Polled every 10s; no Quartz schedule requested.

**Caveats:**
1. `ExchangeRates` Pricing Parameter table must already exist on the partition.
2. If multi-key matrix needed, switch to `MLTV2`.
3. Header `code`/`rate` are case-sensitive.
