# Lint Report: refresh-prices.xml

**File:** `fixture/refresh-prices.xml`
**Route ID:** `refresh-prices`

## Findings

### 1. [HIGH] Missing `pfx-api:flush` after DMDS load
Loading into a Data Source (`objectType=DMDS`) stages data into a data feed; it must be flushed to the underlying data source to become visible. The route loads `DMDS.Prices` but never calls `pfx-api:flush`. Downstream queries / data marts will not see the new data.

Fix:
```xml
<onCompletion onCompleteOnly="true">
    <to uri="pfx-api:flush?dataSourceName=DMDS.Prices&amp;dataFeedName=DMF.Prices"/>
</onCompletion>
```

### 2. [MEDIUM] Inefficient load method
`pfx-api:loaddata` parses each row in memory. For bulk file imports without per-row Groovy logic, `pfx-api:loaddataFile` with `pfx-csv:streamingUnmarshal` is the recommended pattern.

Fix:
```xml
<to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
<to uri="pfx-api:loaddataFile?objectType=DMDS&amp;dsUniqueName=DMDS.Prices&amp;mapper=refresh-prices.mapper&amp;batchSize=100000"/>
```
With `loaddataFile`, the manual `<split>/<tokenize>` is no longer needed.

### 3. [LOW] Missing `CamelCharsetName` in split
When byte-level chunking CSV via `<split><tokenize>`, set `CamelCharsetName=UTF-8` so multi-byte chars aren't corrupted at chunk boundaries.

### 4. [LOW] No record-count visibility
Use `aggregationStrategy="recordsCountAggregation"` on the split and log `${header.PfxTotalInputRecordsCount}`.

### 5. [INFO] Resource ID matches filename. Good.

### 6. [INFO] File consumer URI uses `{{archive.file}}` and `{{read.lock}}`. Good.

## Summary
The flush step is indeed missing — a DMDS load without `pfx-api:flush` leaves data in staging and never promotes it. Also consider switching to `loaddataFile` + `streamingUnmarshal` for performance.
