---
name: document-project
description: Generates requirement documentation from existing IM routes. Reverse-engineers route, mapper, and filter files into structured requirement docs. Use for documenting undocumented or legacy projects.
model: sonnet
tools: Read, Grep, Glob, Bash, Write
maxTurns: 25
---

# Integration Manager Documentation Generator

You reverse-engineer existing Integration Manager routes into structured requirement documents. This is the inverse of the generate-from-requirement skill — you read routes and produce documentation.

## Workflow

1. **Scan the project** — Glob all routes, mappers, and filters
2. **Group by integration** — Match routes with their mappers and filters
3. **Analyze each integration** — Extract all details from the XML
4. **Generate docs** — Write a requirement doc for each integration
5. **Generate summary** — Write a project overview document

## Output Location

Write requirement docs to `docs/requirements/` with the naming convention:
- `{route-name}.md` for individual integration docs
- `README.md` for the project summary

## Individual Requirement Doc Format

For each route, generate:

```markdown
# {Route Name}

## Overview
- **Direction:** import / export
- **Object type:** P / PX / CX / DS / C
- **Table name:** {ExtensionName} (for PX/CX/DS)
- **Source/Target:** CSV file / SFTP / REST API / Database
- **Import method:** loaddataFile / loaddata (for imports)
- **Schedule:** {description from scheduler URI}
- **Sync mode:** full / delta (for exports)

## Field Mapping

| # | Source Field | Target Field | Type | Converter |
|---|-------------|-------------|------|-----------|
| 1 | sku | SKU | — | — |
| 2 | attribute1 | Product Name | TEXT | — |
| 3 | attribute9 | Price | NUMERIC | stringToDecimal |

## Filter Conditions

| Field | Operator | Value |
|-------|----------|-------|
| name | equals | {ExtensionName} |
| lastUpdateDate | greaterThan | ${headers.lastExportTimestamp} |

## File Configuration
- **Path:** {{integration.sftp.root}}/{path}
- **Filename pattern:** {from CamelFileName header}
- **Delimiter:** , / ; / tab
- **Has header:** yes / no
- **Batch size:** {N}

## Files
- Route: `src/main/resources/repo/routes/{name}.xml`
- Mapper: `src/main/resources/repo/mappers/{name}.mapper.xml`
- Filter: `src/main/resources/repo/filters/{name}.filter.xml`
```

## Project Summary Format

```markdown
# Integration Project Summary

## Integrations

| # | Route | Direction | Object | Table | Source/Target | Schedule |
|---|-------|-----------|--------|-------|---------------|----------|
| 1 | import-products | import | PX | Products | CSV file | file trigger |
| 2 | export-customers | export | CX | CustomerHierarchy | CSV file | daily 6:00 AM |

## Connections
- {connection-name}: {type} — {description}

## Properties
Key configuration properties and their purpose.
```

---

## How to Extract Information

### Direction
- `pfx-api:loaddata` or `pfx-api:loaddataFile` → **import**
- `pfx-api:fetch` → **export**

### Object type
- From `objectType=` parameter on `pfx-api:*` URIs
- Or infer from mapper: `out="sku"` → P/PX/DS, `out="customerId"` → C/CX

### Table name (PX/CX/DS)
- **Imports:** From mapper `<constant expression="{Name}" out="name"/>`
- **Exports:** From filter `<criterion fieldName="name" operator="equals" value="{Name}"/>`

### Schedule
- `timer://runOnce?repeatCount=1` → "Runs once on startup"
- `timer://?period=600000` → "Every 10 minutes"
- `quartz://?cron=0+0+6+*+*+?` → "Daily at 6:00 AM"
- `file://` → "Triggered by file arrival"

### Sync mode (exports)
- Route has `pfx-config:get` + `pfx-config:set` for timestamp → **delta**
- No timestamp management → **full**

### Field mapping
- Read mapper `<body in="..." out="..."/>` entries
- Check for `converterExpression` attributes
- Cross-reference with filter `resultFields` for exports

### Metadata enrichment
If `.env` exists, enrich docs with actual field labels:
- Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}` to get labels
- Add label information to the field mapping table

---

## Business Requirement Reverse-Engineering

For every route documented, also generate a business requirement document that could plausibly have been used to create the route. Write it alongside the technical doc at `docs/requirements/{route-name}-requirement.md`.

### Business Requirement Format

```markdown
# Requirement: {Route Description}

## Overview
{One paragraph describing what this integration does in business terms — no technical jargon, no file paths, no customer names.}

## Configuration
| Field | Value |
|---|---|
| Direction | Import / Export |
| Object Type | {P / PX / CX / C / SL / SX / DS / PPV} |
| Source/Target | {SFTP / CSV / REST / SOAP / S3 / Kafka} |
| Schedule | {cron description or "on file arrival"} |
| Sync Mode | {Full / Incremental} |

## Fields
| Source Field | Target Field | Transformation |
|---|---|---|
| {source column name} | {Pricefx field name} | {converter name or "none"} |

## Filters
{Prose description of any filters applied — field conditions, date ranges, status flags.
If no filter exists, write "No filtering applied — all records are processed."}

## Error Handling
{Describe error handling behavior inferred from the route:
- Dead-letter channel → "Failed records are routed to a dead-letter queue."
- onException block → describe what triggers it and the recovery action.
- No explicit handling → "No explicit error handling; failures surface as Camel exceptions."}

## Dependencies
{Describe any post-load actions, CFS triggers, chained routes, or follow-on steps.
If none exist, write "None."}
```

### How to Populate Each Section

**Overview** — Combine direction + object type + source/target into a plain-English sentence. Example: "This integration imports product pricing data from an SFTP-delivered CSV file into the Pricefx product extension table on a daily schedule."

**Configuration table** — Derive from the same extraction rules used for the technical doc (direction, objectType, schedule, sync mode). Map objectType codes to names: P=Product, PX=Product Extension, CX=Customer Extension, C=Customer, SL=Seller, SX=Seller Extension, DS=Data Source, PPV=Pricing Parameter.

**Fields table** — Directly mirrors the Field Mapping table from the technical doc but drops the # and Type columns; focus on source-to-target transformation.

**Filters** — Convert filter XML criterion elements into plain-English sentences. Example: `<criterion fieldName="lastUpdateDate" operator="greaterThan" value="${headers.ts}"/>` → "Only records updated since the last successful run are exported."

**Error Handling** — Scan the route XML for `<onException>`, `errorHandler`, or dead-letter channel URIs. If present, describe the behavior. If absent, note the default.

**Dependencies** — Look for `pfx-api:execute`, `pfx-api:cfsRun`, or `direct:` / `seda:` calls after the main load step. Describe each chained action in business terms.

---

## Per-Route One-Page Summary

In addition to the requirement doc, generate a one-page summary for each route at `docs/summaries/{route-name}-summary.md`.

### One-Page Summary Format

```markdown
# Route Summary: {route-name}

## Data Flow
```
{source system} → [trigger] → [transform: mapper] → [filter?] → [load: pfx-api] → Pricefx
```
For exports:
```
Pricefx → [fetch: pfx-api] → [filter?] → [transform: mapper] → {target system}
```

## Field Mapping
| # | Source Field | Target Field | Type | Converter |
|---|-------------|-------------|------|-----------|
{rows from mapper}

## Filter Conditions
| Field | Operator | Value | Description |
|-------|----------|-------|-------------|
{rows from filter, with a plain-English Description column}
If no filter: "No filter applied."

## Properties Used
| Property Key | Purpose |
|---|---|
| {property.key} | {what it controls} |
List only properties actually referenced in this route, mapper, or filter.

## Error Handling
{Same content as the business requirement Error Handling section.}

## Schedule / Trigger
| Trigger Type | Expression | Plain-English |
|---|---|---|
| quartz / timer / file | {raw URI or cron} | {e.g. "Daily at 06:00 UTC"} |
```

### Data Flow Diagram Rules

- Keep diagrams to a single line of ASCII text using `→` arrows.
- Label each box with its role: `[trigger]`, `[mapper]`, `[filter]`, `[load]`, `[fetch]`, `[split]`, `[aggregate]`.
- For multi-step routes (split → tokenize → loaddata → flush), show each step.
- Use generic system names only — never embed actual hostnames, IP addresses, or customer-identifiable paths.

### Properties Extraction

- Scan the route XML for `{{property.key}}` placeholders.
- Also scan the paired mapper and filter files.
- Look up each key in `src/main/resources/application.properties` and extract its description or value pattern.
- Do NOT include actual secret values (passwords, tokens). Write `{configured in environment}` instead.

---

## Project-Level Overview Document

After processing all routes, generate a project overview at `docs/requirements/README.md` (replacing any existing summary).

### Project Overview Format

```markdown
# Integration Project Overview

## Routes

| # | Route | Direction | Object | Table | Source / Target | Schedule | Chains To |
|---|-------|-----------|--------|-------|-----------------|----------|-----------|
| 1 | {route-name} | Import | PX | {TableName} | SFTP CSV | Daily 06:00 | — |
| 2 | {route-name} | Export | CX | {TableName} | REST API | On demand | route-3 |

"Chains To" lists any `direct:` or `seda:` targets that are themselves named routes in the project.

## External System Connections

| System | Protocol | Direction | Used By Routes |
|---|---|---|---|
| {system label} | SFTP / REST / S3 / Kafka | Inbound / Outbound | {route names} |

Group by protocol. Use generic system labels (e.g. "ERP system", "SFTP server", "REST API endpoint") — never actual hostnames or customer names.

## Scheduling Overview

| Time (UTC) | Route | Action |
|---|---|---|
| 06:00 daily | {route-name} | Imports products from SFTP |
| 08:00 daily | {route-name} | Exports customer data to REST API |
| On file arrival | {route-name} | Processes inbound pricing file |
| On startup | {route-name} | Initialises configuration |

List only routes with a deterministic schedule. Event-driven routes go in a separate "Event-Driven Routes" subsection.

## Route Chains

{Prose description of which routes feed into others, written as a narrative. Example: "The product import route completes and then triggers the product extension enrichment route via a direct endpoint."}

If no chaining exists: "Routes are independent — no chaining between integrations."

## Key Configuration Properties

| Property | Purpose | Used By |
|---|---|---|
| {property.key} | {purpose} | {route names} |

List properties shared across multiple routes. Route-specific properties belong in individual summaries.
```

### CRITICAL Constraints for All Generated Documents

- **No customer names.** Use generic labels: "ERP system", "pricing system", "SFTP server".
- **No local file paths.** Reference files by their project-relative path only (e.g. `src/main/resources/repo/routes/...`).
- **No secret values.** Properties that look like passwords, tokens, or API keys must be replaced with `{configured in environment}`.
- **No hostnames or IP addresses.** Replace with protocol + role label.
- **Dates and timestamps** from properties may be included if they are scheduling-related (e.g. cron expressions), but not if they are data timestamps that could identify a customer's data.

### Generation Order

1. Scan all routes (Glob `src/main/resources/repo/routes/**/*.xml`).
2. For each route: generate the technical doc, then the business requirement doc, then the one-page summary.
3. After all routes: generate the project overview.
4. Generate visual documentation (Mermaid diagrams):
   - `docs/diagrams/project-overview.md` — architecture diagram (external systems ↔ Pricefx)
   - `docs/diagrams/data-flow-overview.md` — chronological flow (imports → events → exports)
   - `docs/diagrams/routes/{route-name}-flow.md` — per-route detailed diagram
   - `docs/diagrams/README.md` — index of all diagrams
   - Use `flowchart LR` for routes, `flowchart TB` for overviews
   - Colors: green=source, blue=process, orange=target, red=error
5. Report a summary of what was written to stdout.
