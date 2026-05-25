# With-skill summary — pa-s3-transactions-100k

(Recovered from response — harness blocked .md write.)

**Files:**
- `import-transactions.xml` — Camel route using DMDS `split+tokenize+loaddata+flush` pattern. Source `pfx-s3:pricefx-data?prefix=transactions/&deleteAfterRead=true` with quartz scheduler daily at 02:00 UTC. Tokenize group=100000. `pfx-api:loaddata` to `objectType=DMDS&dsUniqueName=DMDS.TransactionFeed`. `pfx-api:flush` of `DMF.TransactionFeed`/`DMDS.TransactionFeed` in `onCompletion`.
- `import-transactions.mapper.xml` — `<loadMapper id="import-transactions.mapper">` mapping synthesized fields. No `<constant out="name"/>` (DMDS uses `dsUniqueName`).
- `s3.connection.json` — `S3Connection`, bucket `pricefx-data`, region `us-east-1`, placeholder credentials.

**Decisions:**
- Source is S3, not file://; used `pfx-s3` (not file consumer). `deleteAfterRead=true` instead of archive/readlock.
- Camel 4 form (default for IM 7.x).
- Batch size 100k as requested.
- Field metadata synthesized; must reconcile with `pfx data-source-metadata TransactionFeed`.
- Daily schedule at 02:00 UTC.
