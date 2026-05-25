# Baseline (no skill) summary — pa-price-analyser-feed

(Recovered from response — harness blocked .md write.)

**Notable:** Baseline used `pfx-api:loaddataFile` for DMDS — anti-pattern per the docs.

**Files:**
- `import-transaction-feed.xml` — Camel route. `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile?objectType=DMDS&dsUniqueName=DMDS.TransactionFeed&batchSize=100000`. Quartz cron 02:00 daily. `onCompletion` → `pfx-api:flush?dataSourceName=DMDS.TransactionFeed`.
- `import-transaction-feed.mapper.xml` — `loadMapper` with inferred CSV schema.
- `application.properties` — reusable file properties.

**Decisions:**
- `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile` chosen for ~5M rows. (Documented anti-pattern for DMDS — split+tokenize+loaddata+flush is required.)
- `batchSize=100000`.
- Daily cron 02:00 UTC.
- File consumer (local IM mount).
- `onCompletion` → flush.
- Camel 4 form.
