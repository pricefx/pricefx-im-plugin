# Your First Integration

This walkthrough takes you from zero to a working Product import in about 5 minutes using the integration wizard.

## Prerequisites

- Claude Code installed and running
- Plugin loaded (`claude --plugin-dir /path/to/pricefx-im-plugin`)
- `.env` file configured in your IM project root with Pricefx credentials
- Connection verified: run `pfx test-connection` and confirm it passes

## The Session

Start the wizard:

> **You:** `/pricefx-im-plugin:run-integration-wizard`

> **Plugin:** What kind of integration do you need?
> - Import (load data INTO Pricefx)
> - Export (extract data FROM Pricefx)
> - Event-driven (react to Pricefx events)

> **You:** Import

The plugin now knows you want to bring data into Pricefx.

> **Plugin:** Which Pricefx object type?
>
> | Code | Object |
> |------|--------|
> | P | Product Master |
> | PX | Product Extension |
> | C | Customer Master |
> | CX | Customer Extension |
> | SL | Seller |
> | SX | Seller Extension |
> | DS/DMDS | Data Source (PA) |
> | LTV | Lookup Table (single-key) |
> | MLTV2 | Matrix Table (multi-key) |

> **You:** P

> **Plugin:** Fetching Product metadata from your partition...
>
> Found 15 attributes configured. Where does the source data come from?
> - CSV file (local or SFTP)
> - Database
> - REST API

> **You:** CSV file

> **Plugin:** Do you have a sample CSV file I can analyze? If so, paste the file path or the first few lines. Otherwise, I'll ask you about fields manually.

> **You:** Here's the header: `partNumber,description,uom,productFamily,status,listPrice`

The plugin auto-detects your CSV columns and proposes field mappings based on column names and your partition metadata.

> **Plugin:** I'll map these fields:
>
> | CSV Column | Pricefx Field | Confidence |
> |-----------|---------------|------------|
> | partNumber | sku | HIGH |
> | description | label | HIGH |
> | uom | attribute1 | MEDIUM |
> | productFamily | attribute2 | MEDIUM |
> | status | attribute3 | MEDIUM |
> | listPrice | attribute4 (stringToDecimal) | HIGH |
>
> Look good? Want to adjust any mappings?

> **You:** Looks good

> **Plugin:** Any filter conditions on the source data? (e.g., "status = Active") Or say "no filter".

> **You:** No filter

> **Plugin:** Post-import actions?
> - None
> - Trigger CFS (internal copy)
> - Send notification

> **You:** None

> **Plugin:** I'll name this integration `import-products`. OK?

> **You:** Yes

> **Plugin:** Here's a summary:
>
> - **Direction:** Import (CSV → Pricefx)
> - **Object:** Product Master (P)
> - **Source:** CSV file
> - **Fields:** 6 mapped (partNumber→sku, description→label, ...)
> - **Method:** loaddataFile (streaming)
> - **Filter:** None
> - **Name:** import-products
>
> Proceed? (yes / adjust)

> **You:** Yes

> **Plugin:** Generated 3 files:
>
> ✓ `src/main/resources/repo/routes/import-products.xml`
> ✓ `src/main/resources/repo/mappers/import-products.mapper.xml`
> ✓ `docs/requirements/import-products.md`

Done. The plugin created a complete, production-ready import integration.

## What You Got

- **Route file** (`routes/import-products.xml`) — picks up CSV files from the inbound directory, parses them with streaming unmarshal, and loads into Pricefx via `loaddataFile`. Includes file archiving and read-lock.
- **Mapper file** (`mappers/import-products.mapper.xml`) — maps your CSV columns to Pricefx fields with the right converters (e.g., `stringToDecimal` for prices).
- **Requirement doc** (`docs/requirements/import-products.md`) — documents what the integration does, for handoff or future reference.

## Verify It Works

Run a dry run to trace what would happen with sample data:

> **You:** `/pricefx-im-plugin:simulate-dry-run`
>
> **Plugin:** Which route? → `import-products`
>
> Paste sample CSV or path to test file.

> **You:** `partNumber,description,uom,productFamily,status,listPrice`
> `PUMP-001,Centrifugal Pump 2HP,EA,Pumps,Active,1250.00`

> **Plugin:** Simulation result:
> - CSV parsed: 1 row
> - Field mapping: partNumber→sku=PUMP-001, description→label=Centrifugal Pump 2HP, ...
> - listPrice "1250.00" → BigDecimal 1250.00 (stringToDecimal)
> - Would send to Pricefx: POST /loaddata objectType=P, 1 record
> - ✅ No issues found

## What's Next

- Want to import into a PX or CX table? → [Import Data from CSV](02-import-data-from-csv.md)
- Need to load PA Data Source (DMDS)? → [Import PA Data Source](03-import-pa-data-source.md)
- Want to export data out of Pricefx? → [Export Data to CSV](04-export-data-to-csv.md)
- Inherited an existing project? → [Onboard an Existing Project](05-onboard-existing-project.md)
