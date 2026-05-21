# Baseline (no skill) summary — pa-s3-transactions-100k

(Recovered from response — harness blocked .md write.)

**Notable:** Baseline used `pfx-api:loaddataFile` for DMDS — the docs explicitly warn against this. The correct DMDS pattern (used by the with-skill run) is `split+tokenize+loaddata+flush`.

**Files:**
- `routes/import-transactions.xml` — Daily Quartz poll of `aws2-s3://pricefx-data?prefix=transactions/` → `pfx-io:detectCharset` / `setupCharset` → `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile?objectType=DMDS&targetName=DMDS.TransactionFeed&mapper=import-transactions.mapper&batchSize=100000`. `deleteAfterRead=true`. `onCompletion` → `pfx-api:flush?targetName=DMDS.TransactionFeed`.
- `mappers/import-transactions.mapper.xml` — `loadMapper` with placeholder fields, with `converterExpression` for date/decimal.
- `connections/s3.connection.json` — `S3Connection`, region us-east-1, bucket pricefx-data, placeholder keys.
- `config/application.properties` — `pfx:import-transactions.*` props.

**Caveats called out by baseline:**
- pfx CLI not configured — mapper field names are placeholders.
- For Camel 3 / IM ≤ 6.x, swap `aws2-s3:` → `aws-s3:`.
