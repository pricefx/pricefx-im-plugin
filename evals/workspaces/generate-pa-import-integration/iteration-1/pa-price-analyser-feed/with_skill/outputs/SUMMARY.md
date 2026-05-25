# With-skill summary — pa-price-analyser-feed

(Recovered from response — harness blocked .md write.)

**Files:**
- `import-transaction-feed.xml` — DMDS `split+tokenize+pfx-csv:unmarshal+pfx-api:loaddata+onCompletion→pfx-api:flush` pattern. `file://{{integration.sftp.root}}/transactions?delay=10000&{{archive.file}}&{{read.lock}}` source. `tokenize group="50000"`, `streaming="true"`, `aggregationStrategy="recordsCountAggregation"`. `pfx-api:loaddata?objectType=DMDS&dsUniqueName=DMDS.TransactionFeed`. `pfx-api:flush?dataFeedName=DMF.TransactionFeed&dataSourceName=DMDS.TransactionFeed` in `<onCompletion onCompleteOnly="true">`.
- `import-transaction-feed.mapper.xml` — `loadMapper` placeholder for transaction-feed shape (sku, invoiceDate, customerId, quantity, netPrice, currency with stringToDateTime/stringToDecimal). No `<constant out="name"/>` (DMDS).
- `application.properties.fragment` — `archive.file=`, `read.lock=`, `error.file=` (commented out).

**Decisions:**
- Route id matches file name; no `pfx:` prefix.
- `dsUniqueName=DMDS.TransactionFeed` on `pfx-api:loaddata`.
- Mandatory flush in `<onCompletion onCompleteOnly="true">`.
- `tokenize group="50000"`, `streaming="true"` for ~5M rows.
- `pfx-csv:unmarshal?skipHeaderRecord=true&delimiter=,`.
- Camel 4 form.
