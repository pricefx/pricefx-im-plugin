# Baseline (no skill) summary — neg-dmds-sales-history

(Recovered from response — harness blocked .md write.)

**Notable:** Baseline DID generate a DMDS import — it did not defer to a different skill. It also used `pfx-api:loaddataFile` for DMDS, which the project docs explicitly warn against (DMDS requires the split+tokenize+loaddata+flush pattern).

**Files:**
- `routes/import-sales-history.xml` — Camel 4 route. `pfx-csv:streamingUnmarshal?useReusableParser=true` → `pfx-api:loaddataFile?objectType=DMDS&targetName=SalesHistory&mapper=import-sales-history.mapper&batchSize=100000`. Quartz `0+0+2+*+*+?` nightly at 02:00, `stateful=true`. Dated filename pickup via `pollEnrich`. `<onCompletion>` → `pfx-api:flush?dataSourceName=DMDS.SalesHistory&dataFeedName=DMF.SalesHistory`.
- `mappers/import-sales-history.mapper.xml` — `<mappers>` root, `loadMapper id="import-sales-history.mapper"` with assumed CSV header (transactionId, transactionDate, sku, customerId, quantity, netPrice, netAmount, currency, salesOrg, salesRep), `stringToDate` / `stringToDecimal(us,0,4)` converters.
- `config/application.properties` — `archive.file`, `read.lock=readLock=changed`, `error.file`.

**Caveats:**
1. CSV headers assumed — verify against `pfx data-source-metadata SalesHistory`.
2. `DMF.SalesHistory` data feed name assumed.
3. `/sftp/transactions` treated as locally mounted (file:// consumer). External SFTP would need `pfx-sftp://`.
4. 2 AM run loads today's `YYYYMMDD.csv`; previous business day would need `${date:now-1d:yyyyMMdd}`.

**Eval observation:** The baseline used `loaddataFile` for DMDS — this is the anti-pattern the with-skill response avoided by deferring to `generate-pa-import-integration`.
