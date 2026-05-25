# Baseline (no skill) summary — neg-ltv

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-ltv-currency.xml` — Polls local folder, streams CSV, loads into LTV pricing parameter `currency`.
- `mappers/import-ltv-currency.mapper.xml` — `loadMapper` mapping CSV `code → name` and `value → value` with `stringToDecimal`.
- `config/application.properties` — `archive.file`, `read.lock`, `error.file`.

**Decisions:**
- Object type LTV (single-key pricing parameter), keyed by `name`.
- `pricingParameterName=currency`.
- `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile`, `batchSize=500000`.
- No `<constant out="name"/>` (LTV doesn't need it).
- File consumer (not pfx-sftp).
- Camel 4 form.

Baseline correctly produced a working LTV route — same valid pattern that with-skill (running a different skill) deferred from. Both are valid answers; the with-skill deferral is preferred for plugin-organization reasons.
