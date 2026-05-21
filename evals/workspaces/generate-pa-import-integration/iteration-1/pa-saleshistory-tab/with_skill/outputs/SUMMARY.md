# With-skill summary — pa-saleshistory-tab

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-sales-history.xml` — DMDS `split+tokenize+loaddata+flush` pattern. `file://{{integration.sftp.root}}/transactions?delay=10000&{{archive.file}}&{{read.lock}}` source, `delimiter=%09` (tab), `tokenize group=10000`, `streaming="true"`, `recordsCountAggregation`, `objectType=DMDS`, `dsUniqueName=DMDS.SalesHistoryDS`, `<onCompletion onCompleteOnly="true">` → `pfx-api:flush?dataFeedName=DMF.SalesHistoryDS&dataSourceName=DMDS.SalesHistoryDS`.
- `mappers/import-sales-history.mapper.xml` — `loadMapper` with 25 plausible sales-transaction fields → `sku` + `attribute1..attribute25`. No `<constant out="name"/>` (correct for DMDS).
- `config/application.properties` — `archive.file`, `read.lock`, `error.file`.

**Decisions:**
- DMDS not DS (per skill rules).
- `tokenize group=10000` chosen for 20+ fields wide.
- `streaming="true"` required for 10M rows.
- Camel 4 form (`aggregationStrategy=`).
- No `connection=pricefx`.
- No `<constant out="name"/>` (DMDS uses `dsUniqueName`).
- File source (local IM mount, not pfx-sftp).
- `readLock=changed` (no .done marker).
