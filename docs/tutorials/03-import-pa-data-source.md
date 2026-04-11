# Import PA Data Source

## When You Need This

You need to load data into a Pricefx **Data Source (DMDS)** for Price Analyser dashboards — typically large transaction datasets (hundreds of thousands to millions of rows). This uses a different pattern than regular imports because DMDS requires splitting, batch loading, and flushing.

## Which Skill to Use

**Slash command:**

```
/pricefx-im-plugin:generate-pa-import-integration
```

**Or natural language:**
- "Load data into PA Data Source"
- "Import DMDS SalesTransactions"
- "Set up Price Analyser data feed"
- "Create a Data Source import"

## What Happens

The skill asks:

1. **Which Data Source?** — lists available DMDS tables from your partition. Or lets you create a new one.
2. **Data source?** — CSV file, SFTP, database, or REST API
3. **CSV format?** — auto-detects from sample or header
4. **Field mappings?** — proposes mappings to `key1`–`key6` and `attribute1`–`attribute30`. DMDS tables use generic field names, so the skill maps your CSV columns to the right slots.
5. **Batch size?** — default 50,000 rows per tokenize chunk. The skill suggests based on column count.
6. **Truncate before load?** — full replace or append

Then it generates the route with the complete **split → tokenize → unmarshal → loaddata → flush** pattern. You don't need to remember this sequence — the skill assembles it correctly.

## What You Get

| File | What It Does |
|------|-------------|
| `routes/{name}.xml` | Route with split/tokenize pattern: reads file, splits into 50K-row chunks, loads each chunk, then flushes from Data Feed (DMF) to Data Source (DMDS). |
| `mappers/{name}.mapper.xml` | Maps CSV columns to `key1`–`key6` and `attribute1`–`attribute30` with converters. |
| `docs/requirements/{name}.md` | Requirement doc. |

The skill handles the complexity that makes DMDS different from regular imports:
- `split streaming="true"` with `tokenize` for memory-safe processing
- `pfx-csv:unmarshal` (not `streamingUnmarshal`) inside the split — correct for chunked data
- `pfx-api:loaddata` (not `loaddataFile`) inside the split — correct for parsed data
- `pfx-api:flush` after the split — moves data from staging to the visible Data Source
- `recordsCountAggregation` for total record tracking

## How to Verify

Same as regular imports — use `simulate-dry-run`, `generate-integration-test`, or `analyze`.

After a real run, verify data with:

```
pfx fetch-sample DMDS --name SalesTransactions --limit 5
```

## Tips

- **Batch sizing matters for DMDS.** 50,000 is the default. For wide tables (20+ columns), the skill suggests 10,000–25,000. Trust its suggestion unless you have a reason to change.
- **Always check that flush is present.** Without the flush step, data stays in the staging area (Data Feed) and won't appear in PA dashboards. The skill always includes it, but if you edit the route manually later, don't remove it.
- **Truncate-before-load** is useful for full refreshes where you want to replace all data. The skill asks about this — say yes for nightly full loads, no for incremental appends.
- **Large files (1M+ rows)** work fine — the split/tokenize pattern processes in memory-safe chunks. The skill generates the right pattern regardless of file size.

## See Also

- [Import Data from CSV](02-import-data-from-csv.md) — for P, PX, C, CX, SL, SX imports (simpler pattern)
- [Export Data to CSV](04-export-data-to-csv.md) — for extracting data from Pricefx
- [All guides](00-what-this-plugin-does.md#where-to-start)
