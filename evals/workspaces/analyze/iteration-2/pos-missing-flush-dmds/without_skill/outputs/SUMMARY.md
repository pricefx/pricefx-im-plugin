# Route Review: `refresh-prices.xml`

**File:** `evals/workspaces/analyze/iteration-2/pos-missing-flush-dmds/fixture/refresh-prices.xml`
**Pattern:** Inbound CSV file → Pricefx PA Data Source (DMDS) load
**Verdict:** Your hunch is correct — the route is **missing the flush step**, plus a couple of smaller best-practice gaps.

## 1. Missing `flush` (the main issue) — HIGH

A DMDS (PA Data Source) load is a **two-stage** operation:
1. `pfx-api:loaddata?objectType=DMDS` writes rows into the **data feed** (staging buffer).
2. `pfx-api:flush` promotes those staged feed rows into the actual **data source** so they become queryable downstream.

Without the flush the load "succeeds" but the data never lands in the Data Source — the classic silent-failure symptom. Per `docs/components.md`, `flush` requires `dataSourceName` and `dataFeedName`, and this matches the documented `generate-pa-import-integration` pattern. The flush must run **once after the split completes** (not inside it), ideally in `onCompletion onCompleteOnly="true"` so it fires only on success:

```xml
<onCompletion onCompleteOnly="true">
    <log message="Flushing feed to DMDS.Prices" loggingLevel="INFO"/>
    <to uri="pfx-api:flush?dataSourceName=DMDS.Prices&amp;dataFeedName=DMF.Prices"/>
</onCompletion>
```
(`DMDS.Prices` / `DMF.Prices` are placeholders inferred from `dsUniqueName` — confirm the real feed/source names against the partition.)

## 2. Charset not pinned inside the split — MEDIUM
The documented split-based DMDS pattern sets `CamelCharsetName=UTF-8` as a property inside the split before `pfx-csv:unmarshal`. Without it the parser uses the platform default charset, risking corruption of non-ASCII data (currency symbols, accented names).

## 3. No record-count aggregation / total logging — LOW
The split has no `aggregationStrategy`. The reference pattern uses `recordsCountAggregation` so you can log `${header.PfxTotalInputRecordsCount}`. The current "Refresh complete" log gives no volume confirmation.

## 4. No error handling — LOW
No `doTry/doCatch` or `errorHandler`, and the file consumer has no `{{error.file}}` (`moveFailed=...`). A malformed row aborts mid-file with no error-folder routing.

## What's already correct
- **File consumer:** uses `{{archive.file}}` + `{{read.lock}}`, no `noop=true` — matches the documented convention.
- **Split + tokenize + group=50000** is the legitimate, expected pattern for DMDS loads.
- **Naming:** route id `refresh-prices` matches the file; mapper referenced as `refresh-prices.mapper`.

## Priority order
1. Add the `flush` step (HIGH) — without it the import does nothing useful.
2. Pin `CamelCharsetName=UTF-8` inside the split (MEDIUM).
3. Add record-count aggregation + total logging (LOW).
4. Add error-folder routing / `doTry-doCatch` (LOW).
