# Export Data to CSV

## When You Need This

You need to extract data from Pricefx and write it to a CSV file — for downstream systems, reporting, data warehouses, or file-based integrations. This covers full exports and incremental delta syncs with scheduling.

## Which Skill to Use

**Slash command:**

```
/pricefx-integration:generate-export-integration
```

**Or natural language:**
- "Export products to CSV"
- "Create a nightly customer export"
- "Extract data from Pricefx to a file"
- "Set up a delta sync export"

## What Happens

The skill asks:

1. **Which Pricefx object?** — P, PX, CX, C, SL, SX, or DS/DMDS
2. **Which table?** (PX/CX/DS only) — from your partition
3. **Where to export?** — CSV file, SFTP, database, or REST API
4. **Full export or delta sync?**
   - **Full:** exports all records every time
   - **Delta:** only records changed since the last run (uses `pfx-config` to track timestamps)
5. **Which fields?** — shows available fields from partition metadata, you pick which ones to include in the CSV
6. **Schedule?** — Quartz cron expression (e.g., "daily at midnight", "every hour", "weekdays at 6 AM")
7. **Output filename?** — static name, or with date/timestamp suffix

## What You Get

| File | What It Does |
|------|-------------|
| `routes/{name}.xml` | Scheduled route: Quartz trigger → fetch data in batches → transform field names → marshal to CSV → write file. For delta sync: reads/writes timestamps via `pfx-config`. |
| `mappers/{name}.mapper.xml` | Reverse mapper: Pricefx field names (`sku`, `attribute1`) → business-friendly CSV column names (`partNumber`, `uom`). |
| `filters/{name}.filter.xml` | Fetch filter with `resultFields` and `sortBy`. For delta sync: includes two timestamp bounds (`greaterThan` last run, `lessOrEqual` current time). |
| `docs/requirements/{name}.md` | Requirement doc. |

The skill handles these patterns automatically:
- Quartz cron with correct `+` encoding for URI spaces
- Batched fetch (`batchedMode=true`) for large result sets
- Delta sync with `pfx-config:get`/`set` and `1970-01-01` fallback for first run
- Two-bound timestamp filtering (prevents missing records during export)
- `fileExist=Append` for multi-batch writes to one file

## How to Verify

For testing, you don't want to wait for the Quartz schedule. The skill generates the route with a cron trigger, but you can temporarily switch to an immediate trigger:

> **You:** "Can you add a timer trigger for testing?"
>
> **Plugin:** Adds `timer://runOnce?repeatCount=1` as an alternative trigger, commented out.

Or use `simulate-dry-run` to see what the export would produce without running it.

## Tips

- **Delta sync is almost always what you want.** Full exports are only needed for initial loads or systems that require complete snapshots. The skill asks — choose delta unless you have a reason not to.
- **Two timestamp bounds are critical.** The skill generates both `greaterThan` and `lessOrEqual` in the filter. This prevents missing records that change during the export window. Don't simplify this to a single bound.
- **Test with immediate trigger first.** Run once manually, check the output CSV, then enable the Quartz schedule for production.
- **Field ordering in the CSV** matches the order of fields in your mapper. Rearrange mapper entries to control column order in the output file.
