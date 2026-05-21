---
name: estimate-performance
description: Use when the user wants a runtime or resource estimate for a Pricefx Integration Manager route — says "how long will this take", "estimate performance", "performance", "sizing", "capacity", "how many records per hour", or needs to size a planned import/export by volume + batch size + route complexity.
---

# Estimate Performance

Estimate processing time and memory usage for a Pricefx Integration Manager route based on route configuration and data volume.

## Step 1: Identify the Route

If `$ARGUMENTS` contains a route name or path, read it directly. Otherwise ask: **Which route do you want to estimate?**

```bash
ls src/main/resources/repo/routes/
```

## Step 2: Read and Parse the Route

Read the route XML. Extract:

| Parameter | Where to find it |
|---|---|
| Route type | `from` URI — file/SFTP = import, quartz/timer = export or scheduled |
| Object type | `objectType=` parameter on `pfx-api:loaddata` or `pfx-api:loaddataFile` |
| Batch size | `group=` on `<tokenize>`, `batchSize=` parameter, or default |
| Streaming | `streaming="true"` on `<split>` |
| Flush step | `pfx-api:flush` after split |
| CFS step | `pfx-api:cfs` or `pfx-api:runCalc` |
| External calls | `pfx-sftp:`, `pfx-rest:`, `pfx-sql:`, SOAP URIs |
| Mapper complexity | Number of `<groovy>` expressions in the mapper |

Also read the referenced mapper file to count mapped fields and Groovy expressions.

## Step 3: Ask for Data Volume

If not provided in `$ARGUMENTS`, ask:

> **To calculate the estimate I need:**
> 1. How many records does the file contain? (e.g., 500,000)
> 2. How large is the file? (e.g., 120 MB)
> 3. How many data columns/fields does the source have? (e.g., 25 columns)

If a sample file is available, detect these values automatically:
- Count lines for record estimate
- Check file size in bytes
- Count CSV header columns

## Step 4: Calculate Estimates

### Import Route

Use these formulas:

```
batches            = ceil(records / batch_size)
loaddata_calls     = batches
flush_calls        = 1 if flush step present, else 0
cfs_calls          = 1 if CFS/runCalc step present, else 0
total_api_calls    = loaddata_calls + flush_calls + cfs_calls

time_per_batch     = base_time + (field_count × field_overhead)
  where base_time  = 2s (< 10 fields), 3s (10–20 fields), 5s (20+ fields)
  and field_overhead = 0.1s per field above 10

total_time         = batches × time_per_batch
peak_memory        = batch_size × avg_record_size
  where avg_record_size ≈ field_count × 50 bytes (string) or 8 bytes (numeric)
```

### Export Route

```
fetch_pages        = ceil(records / fetch_batch_size)
  default fetch_batch_size = 10,000

time_per_page      = 1s (< 20 fields), 2s (20–40 fields), 3s (40+ fields)
total_time         = fetch_pages × time_per_page
  (file write time is negligible vs API fetch time)

peak_memory        = fetch_batch_size × avg_record_size
```

### Adjustment factors

| Condition | Effect on time |
|---|---|
| Streaming disabled | +20% (buffering overhead) |
| Groovy expressions in mapper (>5) | +10% per 5 expressions |
| External SFTP download | Add download_time = file_size_MB × 2s |
| External REST/SOAP calls per row | Multiply total by (1 + calls_per_row × 0.5) |
| Network latency (cross-region) | +30% |

## Step 5: Output the Estimate

```
## Performance Estimate: {route-id}

| Metric | Value |
|---|---|
| Records | {records} |
| Batch size | {batch_size} |
| Batches | {batches} |
| API calls | {loaddata_calls} (load){flush_str}{cfs_str} |
| Est. time per batch | ~{time_per_batch}s |
| **Est. total time** | **~{total_time}** |
| Est. memory peak | ~{peak_memory} MB |
| Streaming | {enabled/disabled} |

### Optimization Tips
{tips based on detected configuration}
```

Example:
```
## Performance Estimate: import-products-from-sftp

| Metric | Value |
|---|---|
| Records | 500,000 |
| Batch size | 20,000 |
| Batches | 25 |
| API calls | 25 (load) + 1 (CFS) |
| Est. time per batch | ~3s |
| **Est. total time** | **~1.5 minutes** |
| Est. memory peak | ~150 MB |
| Streaming | enabled |

### Optimization Tips
- Current batch size (20K) is appropriate for P type with ~15 fields
- Streaming is enabled — good, reduces memory spikes
- Consider: parallel processing could reduce time to ~45s if supported
```

## Step 6: Flag Risks

Check for these risk patterns and report any that apply:

| Risk | Detection | Severity |
|---|---|---|
| OOM risk | Streaming disabled AND file > 50 MB | HIGH |
| Too many API calls | batch_size < 1,000 for P/PX/C/CX | MEDIUM |
| API timeout risk | batch_size > 100,000 with 20+ fields | MEDIUM |
| Slow external calls | REST/SOAP calls inside split loop | HIGH |
| Missing flush | DMDS route without `pfx-api:flush` | HIGH |
| CFS on large dataset | CFS triggered mid-import not post-import | MEDIUM |

Format risks clearly:

```
### Risks Detected

HIGH: Streaming is disabled and file is 120 MB — risk of OutOfMemoryError.
  Fix: Add streaming="true" to the <split> element.

MEDIUM: Batch size of 500 generates 1,000 API calls for 500K records.
  Fix: Increase batchSize to 20,000 (25 API calls instead of 1,000).
```

If no risks are detected, state: **No performance risks detected for this configuration.**
