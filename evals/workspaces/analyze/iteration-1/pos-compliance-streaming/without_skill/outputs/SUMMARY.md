# Compliance Lint Report — export-customers-daily.xml

**File:** fixture/export-customers-daily.xml
**Scope:** Streaming on splits, error handling, general best practices.

---

## Findings

### 1. Missing `streaming="true"` on `<split>` — HIGH
**Location:** Line 7
**Issue:** The `<split>` over the batched-fetch result does not declare `streaming="true"`. Without streaming, Camel buffers all split items in memory before iterating, defeating the purpose of `batchedMode=true&batchSize=50000` on the outer `pfx-api:fetch`. For a daily customer export that can grow unbounded, this risks OOM.
**Fix:**
```xml
<split streaming="true">
    <simple>${body}</simple>
    ...
</split>
```

### 2. No error handling — HIGH
**Location:** Entire route
**Issue:** There is no `doTry`/`doCatch`, no `<onException>`, and no route-level `errorHandler`. Any failure inside the split (REST error from `fetchIterator`, mapper error, file-write failure, SFTP-mounted path full) will propagate uncaught — the partial CSV stays on disk under `fileExist=Append` (line 12), corrupting the next day's run if the file name collides, and the scheduler simply logs a stack trace.
**Fix:** Add at minimum:
```xml
<onException>
    <exception>java.lang.Exception</exception>
    <handled><constant>false</constant></handled>
    <log message="Customer export failed: ${exception.message}" loggingLevel="ERROR"/>
</onException>
```
Consider also `onCompletion onFailureOnly="true"` to clean up the partially written file, or write to a `.tmp` name and rename on success.

### 3. `fileExist=Append` with a date-stamped name — MEDIUM
**Location:** Line 12
**Issue:** The file name already contains `${date:now:yyyyMMdd}`, so `Append` only triggers if the route runs more than once in a day OR if a prior failed run left a partial file. Combined with finding 2, a failed run on day N leaves a half-written CSV that the retry/next run appends to — producing a duplicate/corrupt export. Prefer `fileExist=Override`, or write to `.tmp` and rename.

### 4. Missing `CamelCharsetName` — LOW
**Location:** Inside `<split>` before `pfx-csv:marshal`
**Issue:** CSV marshalling without an explicit charset can produce platform-dependent encoding (mojibake for non-ASCII customer names). Set `CamelCharsetName=UTF-8` via `<setProperty>` before marshal.

### 5. No header row written / no column ordering guarantee — LOW
**Location:** Line 11
**Issue:** `pfx-csv:marshal` without `header=...` derives columns from the first record's map iteration order. For a downstream consumer this is fragile. Pass an explicit `header=field1,field2,...` matching the mapper's `out` fields.

### 6. No delta-sync mechanism — INFO
**Location:** Route as a whole
**Issue:** The route is named "daily" but fetches every customer matching the filter, every day. If the filter does not already constrain by `lastUpdateDate`, the export is a full reload. Consider the `pfx-config:get/set` delta-sync pattern with `lastExportTimestamp` / `currentExportTimestamp` bounds.

### 7. Quartz cron syntax — OK
Line 4 uses `0+0+6+*+*+?` (daily 06:00 UTC) with `stateful=true` — correct.

### 8. Route/file ID match — OK
File `export-customers-daily.xml` → `id="export-customers-daily"` — compliant with the resource-ID naming rule.

### 9. Filter / mapper references — OK (assumed)
References `export-customers-daily.filter` and `export-customers-daily.mapper` — match the file-naming convention; sibling files not verified (out of scope).

---

## Summary

| Severity | Count |
|---|---|
| HIGH | 2 |
| MEDIUM | 1 |
| LOW | 2 |
| INFO | 1 |
| OK | 3 |

**Top two must-fix:** add `streaming="true"` to the split, and add explicit error handling (`<onException>` + cleanup of partially written file).
