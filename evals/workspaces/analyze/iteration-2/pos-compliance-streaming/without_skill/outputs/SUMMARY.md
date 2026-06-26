# Compliance Check — `export-customers-daily.xml`

**File:** `evals/workspaces/analyze/iteration-2/pos-compliance-streaming/fixture/export-customers-daily.xml`
**Route ID:** `export-customers-daily`
**Type:** Scheduled outbound export (Pricefx Customer → CSV on local SFTP storage)
**Scope of check:** Streaming on splits + error handling, plus general best-practice review.

---

## Verdict

The route is structurally sound and follows the canonical batched-fetch export shape, but it has **two notable gaps** in exactly the areas requested — **the split does not stream**, and **the route has no error handling at all**. Both should be fixed before this is considered production-compliant.

---

## Findings

### 1. Split is NOT streaming — HIGH

```xml
<split>
    <simple>${body}</simple>
    ...
</split>
```

The `<split>` element has no `streaming="true"` attribute. The reference export pattern (docs/routes.md "Pattern 2" / "Pattern 3" and docs/components.md batched-fetch guidance) calls for streaming splits on large datasets to avoid loading the entire collection into memory at once.

This is an export of object type `C` (Customer) fetched with `batchedMode=true&batchSize=50000`. The outer `fetch` returns a list of batch references, and the split iterates them calling `fetchIterator`. Without `streaming="true"`, Camel materializes the full split-collection eagerly. For a daily customer export at 50k-per-batch this risks elevated heap usage and slower start-up of the first batch.

**Recommendation:** add `streaming="true"` to the split:

```xml
<split streaming="true">
    <simple>${body}</simple>
    ...
</split>
```

Note: the split-collection here is the list of *batch references* (small), so the memory risk is lower than a row-level split, but streaming is still the documented best practice and costs nothing to add. (No aggregation result is consumed after the split, so `recordsCountAggregation` is not required here.)

### 2. No error handling — HIGH

The route has **no `doTry`/`doCatch`, no `onException`, and no `onCompletion`**. The requested "proper error handling" is entirely absent.

Consequences:
- If `fetch`, `fetchIterator`, `transform`, `marshal`, or the file write throws, the route fails with no contextual logging beyond Camel's default error handler, and no controlled failure path.
- Because the destination uses `fileExist=Append` (see Finding 3), a mid-split failure can leave a **partially written CSV** in the outbound folder with no cleanup or error-marker — downstream consumers may pick up a truncated file.

**Recommendation:** wrap the split body in `doTry`/`doCatch` (or add a route-level `onException`) that logs `${exception.message}` at ERROR level and, ideally, routes the partial output to an error path. Per docs/routes.md "Error Handling":

```xml
<doTry>
    <split streaming="true">
        ...
    </split>
    <doCatch>
        <exception>java.lang.Exception</exception>
        <log message="Customer export failed: ${exception.message}" loggingLevel="ERROR"/>
    </doCatch>
</doTry>
```

### 3. File destination uses `fileExist=Append` without a fresh-file guarantee — MEDIUM

```xml
<to uri="file://{{integration.sftp.root}}/outbound/customers?fileName=customers-${date:now:yyyyMMdd}.csv&amp;fileExist=Append"/>
```

`fileExist=Append` is the correct choice for writing multiple batches into one CSV inside a split. However:
- The file name is date-stamped (`customers-yyyyMMdd.csv`), so a **re-run on the same day appends to the existing file**, duplicating rows. There is no truncate/delete-before-write step.
- `pfx-csv:marshal` runs once per batch inside the split, so each batch emits its own header row (unless the marshaller is configured otherwise), producing **repeated header rows** mid-file on append.

**Recommendation:** either delete/clear the target file before the split, or marshal once after aggregating, or disable the header on the in-split marshal and write a single header separately. At minimum, document the same-day re-run behavior.

### 4. Uses `file://` instead of `pfx-sftp` for local storage — OK / GOOD

Writing to `file://{{integration.sftp.root}}/...` rather than `pfx-sftp` with `default-sftp-connection` is correct per docs/connections.md ("Default SFTP connection — use `file` component instead"). Good.

### 5. Scheduling — OK / GOOD

```xml
<from uri="quartz://export-customers-daily?cron=0+0+6+*+*+?&amp;trigger.timeZone=UTC&amp;stateful=true"/>
```

- `stateful=true` correctly prevents overlapping executions of a long-running export.
- Cron `0 0 6 * * ?` = daily at 06:00, with an explicit `trigger.timeZone=UTC`. Spaces correctly encoded as `+`. Matches docs/components.md "Scheduled Exports with Quartz Cron". Good.

### 6. Naming / ID conventions — OK / GOOD

- Root element is `<routes>`, route `id` matches the file name (`export-customers-daily`), no `pfx:` prefix. Compliant with docs/project.md "Route File Conventions".
- Referenced `mapper=export-customers-daily.mapper` and `filter=export-customers-daily.filter` follow the `{route-name}.mapper` / `{route-name}.filter` naming rule. (Note: those two files are not present in the fixture directory; they must exist under `mappers/` and `filters/` for the route to deploy. Flagged for completeness, outside the requested scope.)

### 7. XML escaping — OK / GOOD

All `&` in multi-parameter URIs are correctly escaped as `&amp;`.

---

## Summary Table

| # | Area | Severity | Status |
|---|------|----------|--------|
| 1 | Streaming on split | HIGH | **FAIL** — `streaming="true"` missing |
| 2 | Error handling | HIGH | **FAIL** — no doTry/doCatch/onException/onCompletion |
| 3 | `fileExist=Append` same-day re-run + repeated headers | MEDIUM | Warn |
| 4 | File component vs pfx-sftp | — | Pass |
| 5 | Quartz scheduling (`stateful`, timezone) | — | Pass |
| 6 | Naming / ID conventions | — | Pass |
| 7 | XML escaping | — | Pass |

## Top Actions

1. Add `streaming="true"` to the `<split>`.
2. Add error handling around the split (`doTry`/`doCatch` or route-level `onException`) logging `${exception.message}` at ERROR.
3. Resolve the `fileExist=Append` same-day duplication / repeated-header risk (clear file first, or marshal once, or suppress in-split headers).
