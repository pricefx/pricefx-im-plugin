---
name: run-integration-wizard
description: Use when the user wants a guided, question-driven setup for a new Pricefx integration — says "new integration", "run wizard", "create an integration", "set up import/export", "step me through it", or is unsure about configuration details and prefers one-question-at-a-time prompts. The wizard saves a requirement doc, then generates the route/mapper/filter files.
---

# New Integration Wizard

You are an interactive wizard that guides the user step-by-step through defining a new integration. At the end, you save the requirement as a doc and generate all integration files.

## Flow

Ask each question one at a time. Wait for the user's answer before proceeding to the next step. Show available options clearly.

### Step 1: Direction

Ask: **What kind of integration?**
- Import — load data into Pricefx
- Export — extract data from Pricefx
- Event-driven — react to a Pricefx event (e.g., trigger export after data load completes)

### Step 2: Object Type

Ask: **Which Pricefx object?**

| Code | Object |
|---|---|
| P | Product Master |
| PX | Product Extension |
| CX | Customer Extension |
| C | Customer Master |
| SL | Seller Master |
| SX | Seller Extension |
| DS/DMDS | PA Data Source |
| LTV | Pricing Parameter — Single-key Lookup Table |
| MLTV2 | Pricing Parameter — Multi-key Matrix Table |

### Step 3: Table Name (PX/CX/DS only)

If PX, CX, SX, or DS: list available tables using `pfx` CLI and ask the user to pick one or create new.

### Step 4: Fetch and Show Metadata

Run `pfx` CLI to fetch field metadata. Display the fields to the user.

### Step 5: Fields

Ask: **Which fields? (all, or list specific ones)**

If the user says "all", include all fields with labels. Otherwise let them pick from the displayed list.

### Step 6: Target/Source

Ask: **Where does the data go to / come from?**
- CSV file
- SFTP
- Database
- REST API

### Step 7: Filter (optional)

Ask: **Any filter conditions? (or "none")**

Show examples:
- `Competition = AUTO or CHEM`
- `Product Status != Inactive`
- `Product Costs > 100`
- `no filter`

### Step 8: Schedule (exports only)

Ask: **When should it run?**
- Once (on startup)
- Every N minutes
- Every day at HH:MM
- Custom cron

### Step 9: Sync Mode (exports only)

Ask: **Full or delta export?**
- Full — all records every time
- Delta — only changed records since last run

### Step 9b: Event Type (event-driven only)

If direction is event-driven, ask: **What event should trigger the route?**

| Event | When It Fires |
|---|---|
| `PADATALOAD_COMPLETED` | After PA Data Source load finishes |
| `CALCULATION_COMPLETED_CFS` | After CFS calculation completes |
| `REFRESH_COMPLETED` | After datamart refresh completes |
| Custom event name | Custom event from another route |

Then ask: **What should happen when the event fires?** (export data, refresh datamart, call API, etc.)

### Step 9c: Scheduling (import routes)

For import routes, ask:
> "Does this import need time-windowed scheduling? (e.g., only run between 23:00-06:00)"

If yes, note `scheduling: start-stop` and include start/stop cron times.

### Step 9d: Post-Import Actions

Ask:
> "Should anything happen after the import completes? Options:
> a) Trigger a CFS calculation
> b) Flush DMDS data source
> c) Send a notification
> d) No post-import action"

Note the selection for route generation.

### Step 9e: Error Handling Preference

Ask:
> "How should errors be handled?
> a) Standard (archive/error folders + logging) — recommended
> b) Email notification on failure
> c) Retry with exponential backoff (for API sources)"

Default to (a) if user is unsure.

### Step 10: Integration Name

Propose a name based on the answers (e.g., `export-products-daily-to-csv`) and let the user confirm or change.

### Step 11: Confirm

Show a summary of all choices:

```
Summary:
- Direction: export
- Object: P (Product)
- Fields: all (7 fields)
- Target: CSV file
- Filter: Competition = AUTO or CHEM, Product Life Cycle != Expired
- Schedule: every day at 6:00 AM
- Sync mode: full
- Name: export-products-daily-to-csv

Proceed? (yes / adjust)
```

### Step 12: Save Requirement Doc

Save the requirement to `docs/requirements/{name}.md` using this format:

```markdown
# {Title}

{Description derived from the configuration.}

## Configuration

- **Direction:** {import|export}
- **Object type:** {P|PX|CX|C|DS}
- **Table name:** {name if PX/CX/DS}
- **Target/Source:** {CSV file|SFTP|Database|REST API}
- **Scheduling:** {scheduling or 'none'}
- **Post-Import Action:** {postAction or 'none'}
- **Error Handling:** {errorHandling or 'standard'}

## Fields

{Either "All fields." or a table:}

| CSV Column | Pricefx Field | Notes |
|---|---|---|
| {label} | {fieldName} | {key field, type info, etc.} |

## Filter

{Conditions in plain English, or "No filter."}

## Schedule

- **Frequency:** {schedule description}
- **Cron:** {cron expression if applicable}

## Sync Mode

- **Mode:** {full|delta}

## Additional Notes

Generated by integration wizard on {date}.
```

### Step 13: Generate Integration

After saving the requirement doc, generate all integration files following the rules from generate-import-integration (for P/PX/CX/C/SL/SX), generate-pa-import-integration (for DMDS/PA Data Source), generate-ppv-import-integration (for LTV/MLTV2 pricing parameters), generate-export-integration, or generate-event-driven-route skills:

**For exports:**
- Route XML
- Mapper XML
- Filter XML

**For imports:**
- Route XML
- Mapper XML

**Also:**
- Generate synthetic test data using `scripts/generate-test-data.py`

### Step 14: Final Summary

```
Done! Generated from wizard:

Requirement doc:
- docs/requirements/{name}.md

Integration files:
- src/main/resources/repo/routes/{name}.xml
- src/main/resources/repo/mappers/{name}.mapper.xml
- src/main/resources/repo/filters/{name}.filter.xml  (exports only)

Test data:
- src/test/resources/data/{folder}/test-data.csv
```

## Important Rules

- Ask ONE question at a time — do not dump all questions at once
- Show available options for each question
- Fetch real metadata from partition — never use placeholder fields
- Follow ALL rules from generate-import-integration (P/PX/CX/C/SL/SX), generate-pa-import-integration (DMDS), generate-ppv-import-integration (LTV/MLTV2), generate-export-integration, and generate-event-driven-route skills
- Use `{{integration.sftp.root}}` for file paths
- Keep filter and mapper in sync
- For PX/CX: include `name` criterion in filter or `<constant out="name">` in mapper
- For CX/C: use `customerId` as key field
- For SL/SX: use `sellerId` as key field
- For SX: include `<constant expression="{TableName}" out="name"/>` in mapper (same as PX/CX)
