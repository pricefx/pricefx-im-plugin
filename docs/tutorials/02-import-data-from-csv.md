# Import Data from CSV

## When You Need This

You have CSV files — from SAP exports, flat file feeds, manual uploads — and need to load them into Pricefx. This covers Product (P), Product Extension (PX), Customer (C), Customer Extension (CX), Seller (SL), and Seller Extension (SX) imports.

For PA Data Source (DMDS) imports, see [Import PA Data Source](03-import-pa-data-source.md) — it uses a different pattern.

## Which Skill to Use

**Slash command:**

```
/pricefx-integration:generate-import-integration
```

**Or natural language — any of these work:**
- "I need to import products from CSV"
- "Create an import for customer extensions"
- "Load product extension data from a file"
- "Set up a CSV import for sellers"

## What Happens

The skill walks you through these questions:

1. **Which Pricefx object?** — P, PX, C, CX, SL, or SX
2. **Which table?** (PX/CX/SX only) — lists tables from your partition, or lets you create a new one
3. **Data source?** — CSV file, SFTP, database, or REST API
4. **CSV format?** — if you paste a sample or header, it auto-detects delimiter, quoting, and column names
5. **Field mappings?** — proposes mappings based on column names and partition metadata. Shows confidence levels (HIGH/MEDIUM/LOW). You approve or adjust.
6. **Import method?** — defaults to `loaddataFile` (streaming, fast). Offers `loaddata` only if you need per-row Groovy logic.
7. **Batch size?** — proposes based on column count (500K for <10 fields, 200K for 10-20, 50K for 20+)

Then it generates the files.

## What You Get

| File | What It Does |
|------|-------------|
| `routes/{name}.xml` | Route that polls for CSV files, parses them, and loads into Pricefx. Includes file archiving (`{{archive.file}}`), read lock (`{{read.lock}}`), and logging. |
| `mappers/{name}.mapper.xml` | Field mappings with converters. For PX/CX/SX, includes the required `<constant expression="TableName" out="name"/>`. |
| `docs/requirements/{name}.md` | Requirement doc describing the integration for handoff. |

You don't need to remember IM conventions — the skill handles them:
- Route ID matches file name
- Mapper ID matches file name
- `loaddataFile` with `streamingUnmarshal` for efficiency
- No `connection=pricefx` (implicit default)
- Correct `businessKeys` per object type (`sku` for P/PX, `customerId` for C/CX)

## How to Verify

**Option 1 — Dry run:**

> **You:** `/pricefx-integration:simulate-dry-run`
>
> Point it at the route and a sample CSV. It traces the entire pipeline without calling the Pricefx API.

**Option 2 — Generate test:**

> **You:** `/pricefx-integration:generate-integration-test`
>
> Generates a Spock test class with WireMock that validates the route end-to-end.

**Option 3 — Check compliance:**

> **You:** `/pricefx-integration:check-route-compliance`
>
> Lints the generated route against best-practice patterns. Flags anything the skill might have missed for your specific use case.

## Tips

- **Paste your CSV header** when the skill asks about fields. Auto-detection saves time and catches delimiter/quoting issues early.
- **Say "use all fields"** if you want the skill to map every attribute from your partition metadata. Useful for full data syncs.
- **For PX/CX imports**, you don't need to remember the `constant out="name"` trick — the skill adds it automatically when you pick an extension table.
- **Combine skills**: after generating the import, run `/generate-integration-test` to get a test, and `/generate-flow-diagram` to get a visual diagram.
- **Multiple CSV formats?** Run the skill once per format. Each generates its own route and mapper.
