# Partner Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 8 markdown files in `docs/tutorials/` that teach Pricefx partners how to use the IM Claude Code plugin to build integrations — overview, quickstart, and 6 how-to guides.

**Architecture:** Pure documentation. Each file shows plugin conversations (what partner types → what plugin does), not raw XML authoring. Chat-log format for interactive sessions. Consistent 6-section structure for how-to guides.

**Tech Stack:** Markdown

---

## File Structure

All files created in `docs/tutorials/`:

| File | Purpose | ~Lines |
|------|---------|--------|
| `00-what-this-plugin-does.md` | Overview: capabilities, before/after, reference tables | 200 |
| `01-your-first-integration.md` | Quickstart: wizard walkthrough as chat log | 150 |
| `02-import-data-from-csv.md` | How-to: generate-import-integration skill | 150 |
| `03-import-pa-data-source.md` | How-to: generate-pa-import-integration skill | 120 |
| `04-export-data-to-csv.md` | How-to: generate-export-integration skill | 120 |
| `05-onboard-existing-project.md` | How-to: onboard-project agent | 130 |
| `06-review-and-debug.md` | How-to: review-project + debug-integration agents | 130 |
| `07-working-with-metadata.md` | How-to: list-pricefx-tables + pfx CLI | 100 |

---

### Task 1: Create feature branch and tutorials directory

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feature/partner-docs
mkdir -p docs/tutorials
```

- [ ] **Step 2: Commit empty directory placeholder**

```bash
touch docs/tutorials/.gitkeep
git add docs/tutorials/.gitkeep
git commit -m "docs: initialize tutorials directory for partner documentation"
```

---

### Task 2: Overview — What This Plugin Does

**Files:**
- Create: `docs/tutorials/00-what-this-plugin-does.md`

- [ ] **Step 1: Create `docs/tutorials/00-what-this-plugin-does.md`**

```markdown
# What This Plugin Does

A Claude Code plugin that generates Pricefx Integration Manager integrations for you — instead of writing XML by hand.

You describe what you need. The plugin asks targeted questions, fetches metadata from your Pricefx partition, and generates complete, production-ready route files, mappers, filters, and tests.

## Before and After

| Task | Without the Plugin | With the Plugin |
|------|-------------------|-----------------|
| New import integration | 2–4 hours: study docs, write route XML, mapper XML, configure properties, test manually | 5 minutes: answer wizard questions, plugin generates all files |
| New export with delta sync | 1–2 hours: write route with Quartz cron, pfx-config timestamps, filter with two bounds, batched fetch | 5 minutes: say "export products with delta sync", plugin handles the complexity |
| Take over someone's project | 1–2 days: read every XML file, figure out what each route does | 2 minutes: run `onboard-project` → get a complete report with route inventory, quality score, and diagrams |
| Debug a failing route | Hours: add log statements, search XML for typos, trial and error | Minutes: paste the error message, agent traces the root cause and suggests the exact fix |
| Check quality before deploy | Manual review, easy to miss issues | Run `review-project` → scored report with critical issues, warnings, and best-practice violations |
| Understand what a route does | Read XML, trace mapper/filter references, mentally simulate the flow | Run `explain-route` → plain English explanation of the business logic |
| Generate test data | Write CSV by hand, guess field formats and valid values | Run `generate-test-data` → realistic CSV based on your mapper and partition metadata |
| Visualize data flow | Draw diagrams manually in Visio or Mermaid | Run `generate-flow-diagram` → Mermaid diagrams auto-generated from route XML |

## What's Inside

The plugin has four components:

### Skills (Slash Commands)

Skills are interactive generators. You invoke them, answer questions, and they create files in your project. There are 23 skills covering generation, analysis, testing, and workflow.

**Generation skills — create integration files:**

| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `run-integration-wizard` | Step-by-step guided wizard for any integration type | `/run-integration-wizard` or "new integration" |
| `generate-import-integration` | Import route for P, PX, C, CX, SL, SX from CSV/SFTP/DB/REST | `/generate-import-integration` or "import products from CSV" |
| `generate-pa-import-integration` | PA Data Source (DMDS) import with split/tokenize/flush | `/generate-pa-import-integration` or "load PA data source" |
| `generate-ppv-import-integration` | Pricing Parameters (LTV / MLTV2) import | `/generate-ppv-import-integration` or "import exchange rates" |
| `generate-export-integration` | Export route with scheduling and optional delta sync | `/generate-export-integration` or "export customers to CSV" |
| `generate-event-driven-route` | Route triggered by Pricefx events | `/generate-event-driven-route` or "trigger after calculation" |
| `generate-rest-outbound-integration` | Call external REST APIs (POST/PUT/PATCH) | `/generate-rest-outbound-integration` or "push data to REST API" |
| `generate-inbound-rest-endpoint` | Expose REST endpoint from IM | `/generate-inbound-rest-endpoint` or "create webhook receiver" |
| `generate-kafka-integration` | Kafka consumer for CDC events | `/generate-kafka-integration` or "consume Kafka topic" |
| `generate-soap-integration` | SOAP/XML web service calls | `/generate-soap-integration` or "call SOAP service" |
| `generate-s3-integration` | AWS S3 read/write | `/generate-s3-integration` or "read from S3 bucket" |
| `generate-multi-tenant-route` | Multi-partition routing | `/generate-multi-tenant-route` or "multi-tenant setup" |
| `generate-scheduling-route` | Add Quartz scheduling to existing route | `/generate-scheduling-route` or "schedule this route" |
| `generate-connection` | Connection JSON (Pricefx, SFTP, OAuth2, Basic, JWT) | `/generate-connection` or "create SFTP connection" |

**Analysis and quality skills:**

| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `check-route-compliance` | Lint route against best-practice patterns | `/check-route-compliance` or "check my route" |
| `estimate-performance` | Estimate processing time for a route | `/estimate-performance` or "how long will this take?" |
| `compare-environments` | Diff routes/mappers/filters between branches | `/compare-environments` or "what changed since develop?" |

**Documentation and testing skills:**

| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `explain-route` | Plain English explanation of a route | `/explain-route` or "what does this route do?" |
| `generate-flow-diagram` | Mermaid data flow diagrams | `/generate-flow-diagram` or "visualize this route" |
| `generate-integration-test` | Spock test with WireMock | `/generate-integration-test` or "write tests for this route" |
| `simulate-dry-run` | Trace data through a route without API calls | `/simulate-dry-run` or "dry run with this CSV" |
| `list-pricefx-tables` | Browse partition metadata | `/list-pricefx-tables` or "what PX tables exist?" |

**Workflow skills:**

| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `git-workflow` | Smart branching, commits, and MR preparation | `/git-workflow` or "commit my work" |

### Agents

Agents are autonomous analyzers. They scan your project, read files, and produce reports or make changes. There are 11 agents.

| Agent | What It Does | Trigger |
|-------|-------------|---------|
| `onboard-project` | Complete project assessment for new team members | "onboard this project" or "I inherited this project" |
| `review-project` | Code review with anti-pattern detection | "review my project" or "full code review" |
| `debug-integration` | Diagnose route failures and errors | "my route is failing" or paste an error message |
| `health-check` | Scored quality dashboard (0–100) | "run health check" or "project score" |
| `analyze-project` | Route inventory, patterns, recommendations | "analyze this project" |
| `build-integration` | End-to-end: requirement → route → test → docs | "build an integration from this doc" |
| `document-project` | Reverse-engineer routes into requirement docs | "document my routes" |
| `generate-test-data` | Realistic CSV test data from mapper + metadata | "generate test data for import-products" |
| `impact-analysis` | What breaks if you change a field or table | "what breaks if I rename attribute5?" |
| `migrate-project` | Modernize legacy patterns | "modernize this project" |
| `upgrade-project` | Upgrade IM version with compatibility checks | "upgrade to latest IM" |

### pfx CLI

Direct command-line access to your Pricefx partition metadata. The plugin uses it automatically, but you can also run commands directly:

```
pfx test-connection                    — verify credentials
pfx product-extensions                 — list all PX tables
pfx product-extension-metadata Prices  — get field names, types, labels
pfx data-sources                       — list PA Data Sources
pfx pricing-parameters                 — list pricing parameter tables
pfx fetch-sample PX --name Prices --limit 5  — see real data
```

### Pattern Catalog

18 proven integration patterns extracted from production projects. Skills use these as templates when generating routes. Agents use them as benchmarks when reviewing your code.

## How It Works

Every interaction follows the same three steps:

1. **You say what you need** — slash command (`/generate-import-integration`) or natural language ("I need to import products from a daily SAP CSV export")
2. **The plugin asks questions and fetches metadata** — it queries your Pricefx partition for real table names, field names, and types. No placeholder values — everything is based on your actual setup.
3. **The plugin generates complete files** — route XML, mapper XML, filter XML, properties, test data. Ready to deploy.

## Where to Start

- **First time?** → [Your First Integration](01-your-first-integration.md) — 5-minute wizard walkthrough
- **Need to import data?** → [Import Data from CSV](02-import-data-from-csv.md) or [Import PA Data Source](03-import-pa-data-source.md)
- **Need to export data?** → [Export Data to CSV](04-export-data-to-csv.md)
- **Inherited a project?** → [Onboard an Existing Project](05-onboard-existing-project.md)
- **Something broken?** → [Review and Debug](06-review-and-debug.md)
- **Exploring your partition?** → [Working with Metadata](07-working-with-metadata.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/00-what-this-plugin-does.md
git commit -m "docs: add plugin overview for partners"
```

---

### Task 3: Quickstart — Your First Integration

**Files:**
- Create: `docs/tutorials/01-your-first-integration.md`

- [ ] **Step 1: Create `docs/tutorials/01-your-first-integration.md`**

```markdown
# Your First Integration

This walkthrough takes you from zero to a working Product import in about 5 minutes using the integration wizard.

## Prerequisites

- Claude Code installed and running
- Plugin loaded (`claude --plugin-dir /path/to/pricefx-integration`)
- `.env` file configured in your IM project root with Pricefx credentials
- Connection verified: run `pfx test-connection` and confirm it passes

## The Session

Start the wizard:

> **You:** `/pricefx-integration:run-integration-wizard`

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

> **You:** `/pricefx-integration:simulate-dry-run`
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/01-your-first-integration.md
git commit -m "docs: add quickstart - your first integration wizard walkthrough"
```

---

### Task 4: How-to — Import Data from CSV

**Files:**
- Create: `docs/tutorials/02-import-data-from-csv.md`

- [ ] **Step 1: Create `docs/tutorials/02-import-data-from-csv.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/02-import-data-from-csv.md
git commit -m "docs: add how-to - import data from CSV"
```

---

### Task 5: How-to — Import PA Data Source

**Files:**
- Create: `docs/tutorials/03-import-pa-data-source.md`

- [ ] **Step 1: Create `docs/tutorials/03-import-pa-data-source.md`**

```markdown
# Import PA Data Source

## When You Need This

You need to load data into a Pricefx **Data Source (DMDS)** for Price Analyser dashboards — typically large transaction datasets (hundreds of thousands to millions of rows). This uses a different pattern than regular imports because DMDS requires splitting, batch loading, and flushing.

## Which Skill to Use

**Slash command:**

```
/pricefx-integration:generate-pa-import-integration
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

Same as regular imports — use `simulate-dry-run`, `generate-integration-test`, or `check-route-compliance`.

After a real run, verify data with:

```
pfx fetch-sample DMDS --name SalesTransactions --limit 5
```

## Tips

- **Batch sizing matters for DMDS.** 50,000 is the default. For wide tables (20+ columns), the skill suggests 10,000–25,000. Trust its suggestion unless you have a reason to change.
- **Always check that flush is present.** Without the flush step, data stays in the staging area (Data Feed) and won't appear in PA dashboards. The skill always includes it, but if you edit the route manually later, don't remove it.
- **Truncate-before-load** is useful for full refreshes where you want to replace all data. The skill asks about this — say yes for nightly full loads, no for incremental appends.
- **Large files (1M+ rows)** work fine — the split/tokenize pattern processes in memory-safe chunks. The skill generates the right pattern regardless of file size.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/03-import-pa-data-source.md
git commit -m "docs: add how-to - import PA data source (DMDS)"
```

---

### Task 6: How-to — Export Data to CSV

**Files:**
- Create: `docs/tutorials/04-export-data-to-csv.md`

- [ ] **Step 1: Create `docs/tutorials/04-export-data-to-csv.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/04-export-data-to-csv.md
git commit -m "docs: add how-to - export data to CSV"
```

---

### Task 7: How-to — Onboard an Existing Project

**Files:**
- Create: `docs/tutorials/05-onboard-existing-project.md`

- [ ] **Step 1: Create `docs/tutorials/05-onboard-existing-project.md`**

```markdown
# Onboard an Existing Project

## When You Need This

You inherited an IM project from another partner or team. You need to understand what it does, how healthy it is, and where the risks are — without spending days reading XML files.

## Which Agent to Use

This isn't a slash command — it's an agent you trigger with natural language:

- "Onboard me to this project"
- "I inherited this IM project, help me understand it"
- "New project orientation"
- "Analyze and document this project"

## What Happens

The `onboard-project` agent runs 6 phases automatically — you don't need to answer questions. Just point it at the project and let it work.

**Phase 1 — Project Overview:**
Scans all route, mapper, filter, and connection files. Builds a route inventory table showing each route's direction (import/export), object type, source/target, and schedule.

**Phase 2 — Compliance Check:**
Checks every route against best practices:
- Route ID matches file name?
- Proper XML escaping (`&amp;` not `&`)?
- File archiving configured (`{{archive.file}}`)?
- Read lock or done file present?
- Key fields correct for object type?
- DMDS routes have flush in the right place?
- Error handling present?

Each finding is tagged as **Critical** (will cause errors) or **Warning** (works but risky).

**Phase 3 — Test Coverage:**
Lists which routes have corresponding test files and which don't. Flags orphaned test files (tests for routes that no longer exist).

**Phase 4 — Documentation:**
Auto-generates requirement docs for any route that doesn't have one. Each doc describes: direction, object type, field mappings, schedule, filter conditions.

**Phase 5 — Visual Documentation:**
Generates Mermaid flow diagrams:
- Project-level architecture overview
- Data flow summary (chronological order)
- Detailed per-route flow diagrams

**Phase 6 — Consolidated Report:**
Outputs everything as one structured report:

```
# Project Onboarding Report

## Executive Summary
12 routes, 3 critical issues, quality score: YELLOW

## Route Inventory
| Route ID | Direction | Object | Table | Schedule |
| ... | ... | ... | ... | ... |

## Quality Issues
### Critical
- import-products: mapper ID mismatch (file: import-products.mapper, ID: productMapper)
- ...

### Warnings
- export-customers: no error handling
- ...

## Test Coverage
8 of 12 routes have tests (67%)

## Recommended Actions
1. Fix mapper ID mismatch in import-products (Critical — will fail at runtime)
2. Add error handling to export routes
3. Generate tests for 4 untested routes
```

## How to Interpret the Report

- **Quality score GREEN** (0-1 critical issues): Project is healthy. Minor improvements optional.
- **Quality score YELLOW** (2-4 critical issues): Project works but has risks. Fix critical issues before next deployment.
- **Quality score RED** (5+ critical issues): Project has significant problems. Prioritize fixes.

Critical issues will cause runtime failures. Warnings are about maintainability and best practices — they won't break things today but make the project harder to maintain.

## After Onboarding

Now that you understand the project, useful next steps:

- **Fix critical issues:** The report tells you exactly what's wrong and where. Ask the plugin: "Fix the mapper ID mismatch in import-products" — it can apply the fix directly.
- **Run health check periodically:** `/pricefx-integration:health-check` gives you a scored dashboard. Run it before deployments or after major changes.
- **Generate missing tests:** For each untested route, run `/generate-integration-test` — the plugin creates a Spock test based on the existing route.
- **Visualize for stakeholders:** The generated Mermaid diagrams are great for stakeholder presentations. Share them in MR descriptions or project documentation.

## Tips

- **Run onboarding before touching anything.** Get the full picture first, then make changes. The report might reveal dependencies you wouldn't notice from reading individual files.
- **The generated requirement docs are drafts.** They reverse-engineer the route's behavior, but may miss business context that isn't in the code. Review and enrich them.
- **Combine with `explain-route`** for routes that are hard to understand from the inventory alone. Ask "explain the import-prices route" for a plain-English walkthrough.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/05-onboard-existing-project.md
git commit -m "docs: add how-to - onboard existing project"
```

---

### Task 8: How-to — Review and Debug

**Files:**
- Create: `docs/tutorials/06-review-and-debug.md`

- [ ] **Step 1: Create `docs/tutorials/06-review-and-debug.md`**

```markdown
# Review and Debug

## When You Need This

Two scenarios:

1. **Before deploying** — you want to catch issues before they hit production. Run a project review.
2. **Something is broken** — a route is failing, data isn't loading correctly, or you see an error. Run the debugger.

## Review: Check Quality Before Deploying

**Trigger:**
- "Review my project"
- "Run a full code review"
- "Check for issues before I deploy"

The `review-project` agent reads all routes, mappers, filters, and config files, then checks 10+ rule categories:

- Connection configuration (redundant `connection=pricefx`?)
- Route structure (proper archiving, read lock, error handling?)
- Filter logic (missing bounds, empty criteria?)
- Mapper correctness (ID matches file name, converters appropriate?)
- Cross-file consistency (mapper referenced in route actually exists?)
- Performance (batch sizes appropriate for data volume?)
- Anti-patterns (hardcoded values, `noop=true`, missing flush for DMDS?)

**What you get:**

```
## Critical Issues (fix before deploying)
1. import-prices: mapper ID "priceMapper" doesn't match file name "import-prices.mapper"
   → Rename ID to "import-prices.mapper" in mappers/import-prices.mapper.xml:2

## Warnings (should fix)
2. export-customers: no error handling — route will fail silently on API errors
3. import-transactions: batchSize=500000 with 25 columns may cause memory pressure

## Best Practices
4. import-products: consider adding onCompletion for post-load CFS trigger

## Quality Score: YELLOW (2 critical, 1 warning)
```

Every finding includes the file name, line number, and specific fix.

## Debug: Fix a Broken Route

**Trigger — describe the problem:**
- "My import-products route is failing with: No bean could be found in the registry"
- "Data imports but all prices are null"
- "The export route runs but produces an empty file"
- "Files aren't being picked up from the import directory"

The `debug-integration` agent:

1. **Reads the error** — parses the error message or your description
2. **Reads the route** — loads the route XML, mapper, filter, and properties
3. **Cross-references** — checks for common patterns that cause this specific error
4. **Verifies partition state** — uses pfx CLI to check if tables/fields exist, connection works
5. **Diagnoses** — identifies the root cause and proposes a specific fix

**Example session:**

> **You:** My import-prices route is failing with: "No bean could be found in the registry of type: net.pricefx.integration.component.mapper.MapperProducer for name: priceMapper"
>
> **Plugin:** Found the issue. The route references `mapper=priceMapper` but the mapper file is `import-prices.mapper.xml` with `id="import-prices.mapper"`.
>
> **Root cause:** Mapper ID mismatch. The route says `priceMapper`, but the actual mapper ID is `import-prices.mapper`.
>
> **Fix:** In `routes/import-prices.xml`, change:
> ```xml
> <!-- Before -->
> <to uri="pfx-api:loaddataFile?objectType=PX&amp;mapper=priceMapper"/>
> <!-- After -->
> <to uri="pfx-api:loaddataFile?objectType=PX&amp;mapper=import-prices.mapper"/>
> ```
>
> **Prevention:** Mapper IDs must match the file name (without `.xml`). The `generate-import-integration` skill enforces this automatically.

> **You:** Fix it

> **Plugin:** Done. Updated `routes/import-prices.xml` line 5.

## When to Use Which

| Situation | What to Run |
|-----------|------------|
| Before deploying | `review-project` — catches issues proactively |
| After major changes | `review-project` — verify nothing broke |
| Route is failing | `debug-integration` — paste the error message |
| Data looks wrong | `debug-integration` — describe what's wrong vs expected |
| Regular maintenance | `health-check` — scored dashboard with trends |
| Before MR/merge | `review-project` + `check-route-compliance` on changed routes |

## Tips

- **Paste the full error message.** The more context the debug agent has, the faster it finds the root cause. Stack traces are helpful.
- **Run review before every MR.** Make it a habit. The agent catches things human reviewers miss — especially cross-file consistency issues.
- **Critical ≠ warning.** Critical issues will cause runtime failures. Warnings are about maintainability. Fix critical first, warnings when you have time.
- **The debug agent can fix issues directly.** After it diagnoses a problem, say "fix it" and it applies the change. Review the diff before committing.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/06-review-and-debug.md
git commit -m "docs: add how-to - review and debug"
```

---

### Task 9: How-to — Working with Metadata

**Files:**
- Create: `docs/tutorials/07-working-with-metadata.md`

- [ ] **Step 1: Create `docs/tutorials/07-working-with-metadata.md`**

```markdown
# Working with Metadata

## When You Need This

You want to know what tables and fields exist in your Pricefx partition — before generating an integration, while debugging, or just to explore. Metadata is also what powers the plugin's auto-mapping and validation features.

## Browsing Tables and Fields

**Slash command:**

```
/pricefx-integration:list-pricefx-tables
```

**Or natural language:**
- "What PX tables exist in my partition?"
- "Show me the fields in the Prices extension"
- "List all Data Sources"
- "What attributes does Product Master have?"

**Example session:**

> **You:** What PX tables exist?
>
> **Plugin:** Found 5 Product Extension tables:
>
> | Table | Attributes Used |
> |-------|----------------|
> | Prices | 8 of 30 |
> | Specifications | 12 of 30 |
> | Logistics | 5 of 30 |
> | CompetitorPrices | 6 of 30 |
> | Compliance | 3 of 30 |

> **You:** Show me the fields in Prices
>
> **Plugin:** Prices (Product Extension):
>
> | Field | Label | Type |
> |-------|-------|------|
> | sku | SKU | STRING |
> | attribute1 | List Price | NUMERIC |
> | attribute2 | Cost Price | NUMERIC |
> | attribute3 | Discount Tier | STRING |
> | attribute4 | Currency | STRING |
> | attribute5 | Effective Date | DATE |
> | attribute6 | Price Group | STRING |
> | attribute7 | Min Order Qty | INTEGER |
> | attribute8 | Notes | STRING |

This is the same information the generation skills use when proposing field mappings.

## Direct pfx CLI Commands

You can also run CLI commands directly for quick lookups. Prefix with `!` to run shell commands from Claude Code:

```
! pfx product-extensions                    — list all PX tables
! pfx product-extension Prices              — field names only
! pfx product-extension-metadata Prices     — field names + labels + types
! pfx customer-extensions                   — list all CX tables
! pfx data-sources                          — list all PA Data Sources
! pfx data-source-metadata SalesHistory     — fields for a Data Source
! pfx pricing-parameters                    — list all pricing parameter tables
! pfx pricing-parameter ExchangeRates       — fields + sample data
! pfx fetch-sample PX --name Prices --limit 3  — see actual data
! pfx test-connection                       — verify credentials work
```

## How Metadata Powers the Plugin

When you run any generation skill, it fetches metadata from your partition behind the scenes:

1. **Table discovery** — "Which PX tables exist?" → shows real options, not a generic list
2. **Field mapping** — matches CSV column names against field labels and types for smart auto-mapping
3. **Converter suggestions** — knows `attribute1` is NUMERIC → suggests `stringToDecimal`
4. **Validation** — if you reference a table or field that doesn't exist, the skill warns you before generating

This is why the `.env` file matters — without valid credentials, skills fall back to generic templates instead of partition-aware generation.

## Creating Tables from the Plugin

If the table you need doesn't exist yet:

> **You:** "I need a PX table called Warranties"
>
> **Plugin:** Table `Warranties` doesn't exist. Want me to create it?
>
> **You:** Yes, with 5 string attributes and 3 numeric
>
> **Plugin:** Created Product Extension `Warranties` with 8 attributes.

Or via CLI:

```
! pfx create-product-extension Warranties
! pfx set-attributes PX Warranties attribute1:STRING::Warranty_Type attribute2:NUMERIC::Duration_Months
```

## Tips

- **Check metadata before generating.** If your partition metadata is outdated (labels not set, types wrong), the auto-mapping will be less accurate. Run `list-pricefx-tables` first to verify.
- **Use `fetch-sample` to see real data.** Useful when you're not sure what values a field contains or what format dates are in.
- **Labels matter for auto-mapping.** If your PX attribute1 has label "List Price", the plugin maps a CSV column called "listPrice" with HIGH confidence. Unlabeled attributes get MEDIUM or LOW confidence. Ask your Pricefx admin to set labels.
- **Metadata is cached per session.** If you create a table during the session, run `list-pricefx-tables` again to refresh.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/07-working-with-metadata.md
git commit -m "docs: add how-to - working with metadata"
```

---

### Task 10: Final verification

- [ ] **Step 1: Verify all 8 files exist**

```bash
ls -la docs/tutorials/
```

Expected: 8 markdown files (00 through 07) + .gitkeep.

- [ ] **Step 2: Verify file sizes**

```bash
wc -l docs/tutorials/*.md
```

Expected: 00 ~200, 01 ~150, 02-07 ~100-150 each. Total ~1,100.

- [ ] **Step 3: Verify internal links**

Check that all links between documents point to correct file names:
- 00 links to 01-07
- 01 links to 02, 03, 04, 05
- 02 links to 03
- 03 — no forward link needed
- 04 — no forward link needed
- 05 references `/generate-integration-test`, `/health-check`, `explain-route`
- 06 references `health-check`, `check-route-compliance`
- 07 — standalone

- [ ] **Step 4: Verify no raw XML authoring instructions**

```bash
grep -l "Create the file\|Create the route\|Save this as\|Add these lines to" docs/tutorials/*.md
```

Expected: no matches. Tutorials should show plugin generating files, not partner writing XML.

- [ ] **Step 5: Final commit**

```bash
git add docs/tutorials/
git commit -m "docs: complete partner documentation - 8 guides for plugin usage"
```
