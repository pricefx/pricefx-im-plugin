# Baseline (no skill) summary — pa-saleshistory-tab

(Recovered from response — harness blocked .md write.)

**Notable:** Baseline used `pfx-api:loaddataFile` for DMDS — the docs explicitly warn against this. Correct pattern (used by with-skill) is `split+tokenize+loaddata+flush`.

**Files:**
- `routes/import-sales-history.xml` — Daily cron-scheduled file pickup, `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile?objectType=DMDS&dsUniqueName=DMDS.SalesHistoryDS&direct2ds=true&batchSize=200000`. `onCompletion` → `pfx-api:flush?dataSourceName=DMDS.SalesHistoryDS&dataFeedName=DMF.SalesHistoryDF` + `internalCopy?label=DataSource`.
- `mappers/import-sales-history.mapper.xml` — `loadMapper` mapping TSV columns to PA DS fields.
- `config/application.properties` — cron, archive.file, read.lock (readLock=changed), error.file.

**Decisions:**
- Tab delimiter encoded as `delimiter=%09`.
- `direct2ds=true`.
- Cron-scheduled polling daily at 02:00 UTC.
- Camel 4 form.
- File source (locally mounted IM SFTP).
