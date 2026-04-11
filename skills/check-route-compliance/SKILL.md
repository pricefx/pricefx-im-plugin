---
name: check-route-compliance
description: Compare a route against best practice patterns from the pattern catalog. Shows gaps and recommendations. Like a linter for IM routes. Use when the user says "check my route", "check route compliance", "compare to best practice", "lint", "compliance check".
---

# Check Pattern Compliance

You are linting a Pricefx Integration Manager route against the official pattern catalog. Follow the steps below precisely.

## Step 1: Identify the Route to Check

If the user specified a route file, read it directly. Otherwise ask: **Which route file should I check?** (look in `src/main/resources/repo/routes/`).

Read the route XML in full. Also read any associated mapper (`src/main/resources/repo/mappers/`) and filter (`src/main/resources/repo/filters/`) referenced in the route.

## Step 2: Detect Route Type

Classify the route by inspecting the `from` URI and route ID:

| Type | Detection |
|---|---|
| **CSV/SFTP Import** | `pfx-sftp:` or `file://` in `from`, route ID starts with `import-`, object type P/PX/C/CX/SL/SX |
| **DMDS/DS Import** | `pfx-api:loaddata` with `objectType=DMDS` or `objectType=DS`, or route ID contains `-ds` |
| **PPV Import** | `objectType=LTV` or `objectType=MLTV2` or `objectType=MLTV3` in `pfx:api.settings` or `pfxApiSettings` |
| **Scheduled Export** | `quartz:` in `from`, route ID starts with `export-`, no `pfx-config:get` for timestamp |
| **Incremental Export** | `quartz:` in `from`, uses `pfx-config:get` and `pfx-config:set` for timestamp tracking |
| **Event-Driven** | `from uri="direct:event` or `pfx-event:` in `from`, route ID starts with `event-` |
| **Chained/Utility** | `from uri="direct:` (not event), `timer:`, or `seda:` |

State the detected type clearly before continuing.

## Step 3: Load the Matching Pattern

Select the reference pattern based on detected type:

| Route Type | Pattern File |
|---|---|
| CSV/SFTP Import (P, PX, C, CX, SL, SX) | `docs/patterns/import-csv-sftp.md` |
| DMDS/DS Import | `docs/patterns/import-dmds-split-tokenize.md` |
| PPV Import (LTV, MLTV2, MLTV3) | `docs/patterns/import-ppv-ltv-mltv2.md` |
| Scheduled Export | `docs/patterns/export-quartz-scheduled.md` |
| Incremental Export | `docs/patterns/export-incremental-timestamp.md` |
| Event-Driven | `docs/patterns/event-driven-routes.md` |

Also always read `docs/patterns/error-handling.md` and `docs/patterns/naming-conventions.md` as supplementary references.

Read the selected pattern file(s) from the working project root (look for a `docs/` directory, or check `/Users/mnagas/Documents/pricefx/integration-manager/docs/patterns/` as the catalog location).

## Step 4: Compare Route Against Pattern Element by Element

Check each criterion below. For each one, record the result as PASS, FAIL, or WARN.

### Import Routes (CSV/SFTP, DMDS, PPV)

| Check | How to Detect | Pass Condition |
|---|---|---|
| Streaming on split | `<split` has `streaming="true"` | Present |
| Archive folder | `{{archive.file}}` or `move=.archive/` on the `from` URI | Present |
| Error folder | `{{error.file}}` or `moveFailed=.error/` on the `from` URI | Present (optional but recommended) |
| Read lock | `{{read.lock}}` or `{{done.file}}` or `readLock=` or `doneFileName=` on the `from` URI | One of the two present |
| Route ID naming | Route ID is descriptive kebab-case (e.g. `import-products`, `import-cx-prices`) | Follows convention |
| Mapper ID matches file | Mapper `id` matches file name without `.xml` | Match |
| Filter ID matches file | Filter `id` matches file name without `.xml` | Match |
| Flush (DMDS only) | `pfx-api:flush` step after split block | Present and OUTSIDE split |
| pricingParameterName (PPV only) | `pricingParameterName` set on `pfx-api:loaddata` or `pfx-api:loaddataFile` URI | Present |

### Export Routes (Scheduled, Incremental)

| Check | How to Detect | Pass Condition |
|---|---|---|
| stateful quartz | `stateful=true` on quartz URI | Present |
| timezone | `trigger.timeZone=` or `{{...}}` on quartz URI | Present |
| batchedMode | `batchedMode=true` on fetch URI | Present |
| sortBy | `sortBy=` on fetch URI | Present |
| Timestamp tracking (incremental) | `pfx-config:get` before fetch, `pfx-config:set` after export | Both present |
| First-run null handling (incremental) | `<choice>` block that handles null/empty previous timestamp | Present |
| Timestamp in UTC (incremental) | Groovy timestamp uses `TimeZone.getTimeZone('UTC')` | Present |
| Route ID naming | Route ID is descriptive kebab-case (e.g. `export-products`, `export-cx-prices`) | Follows convention |

### Event-Driven Routes

| Check | How to Detect | Pass Condition |
|---|---|---|
| Status filter | `<filter>` block checking event status (READY, etc.) | Present |
| Event metadata extraction | `<setProperty name="eventData">` or equivalent | Present |
| Blocking concern | Long handler uses `seda:` not `direct:` for concurrency | If handler is long-running, uses seda: |
| Route ID naming | Route ID follows `event-EVENTNAME` pattern with UPPER_CASE event type | Follows convention |
| Log truncation | Large payloads logged with `.take(1000)` or similar guard | Present if body is logged |

## Step 5: Output the Compliance Report

Format the report as follows. Use status symbols:
- `OK` — criterion met
- `MISSING` — criterion absent, must fix
- `WARN` — criterion present but suboptimal (e.g., wrong value)
- `N/A` — not applicable to this route type

```
Route: [route-id]
Type:  [detected type]
Pattern Reference: [pattern file name]

COMPLIANCE REPORT
=================

Criterion                    | Status  | Detail
-----------------------------|---------|-----------------------------------------------
Streaming on split           | OK      | streaming="true" found on split
Archive folder               | OK      | {{archive.file}} present
Error folder                 | OK      | {{error.file}} present
Read lock                    | OK      | {{read.lock}} present
Route ID naming              | OK      | Follows kebab-case convention
Mapper ID matches file       | OK      | import-products.mapper matches file name
Flush (DMDS)                 | N/A     | Not a DMDS route

SUMMARY: X passed, Y missing, Z warnings
```

## Step 6: Suggest Specific Fixes

For every MISSING or WARN item, provide the exact XML snippet to add or change. Show WHERE in the route it should go (before/after which element). Keep snippets minimal — only the relevant fragment, not the whole route.

Example fix format:

```
FIX: Error folder — add {{error.file}} to the <from> URI:

  <from uri="file://{{integration.sftp.root}}/my-path?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}&amp;{{error.file}}"/>
```

After presenting fixes, ask: **Would you like me to apply these fixes to the route file?**
If yes, apply them one at a time, reading the file fresh before each edit.

## Rules

- Never modify the route unless the user explicitly confirms.
- No customer data in the report — use placeholder values in snippets.
- Do not invent checks not listed in this skill — stick to the pattern catalog.
- If the route type cannot be determined, ask the user before proceeding.
