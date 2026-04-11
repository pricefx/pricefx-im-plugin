# Partner Documentation Design: Plugin Usage Guides

**Date:** 2026-04-03
**Status:** Approved
**Supersedes:** 2026-04-03-tutorial-series-design.md (that spec focused on manual XML writing; this one focuses on plugin usage)

## Goal

Create documentation that teaches Pricefx partners how to use the IM Claude Code plugin to build, review, debug, and maintain integrations. Partners know IM but have never used an AI plugin — they've always written XML manually. The docs must show them why the plugin is worth adopting and how to use it effectively.

## Audience

Pricefx partners and implementors who:
- Know Pricefx and Integration Manager well
- Have always written routes, mappers, and filters manually
- Have never used Claude Code or any AI plugin
- Need to see value before investing time

## Format

- **8 documents** in `docs/tutorials/`
- **Language:** English, informal tone
- **Focus:** Conversations with the plugin, not XML reference
- **Key principle:** Show what the partner types and what the plugin responds/generates

## Document Structure

| # | File | Type | What Partner Learns |
|---|------|------|---------------------|
| 0 | `00-what-this-plugin-does.md` | Overview | Full picture — what the plugin can do, why it matters, before/after comparisons |
| 1 | `01-your-first-integration.md` | Quickstart | Wizard walkthrough — zero to working integration in 5 minutes |
| 2 | `02-import-data-from-csv.md` | How-to | Generate CSV imports (P/PX/CX/SL) via `generate-import-integration` |
| 3 | `03-import-pa-data-source.md` | How-to | Generate DMDS imports via `generate-pa-import-integration` |
| 4 | `04-export-data-to-csv.md` | How-to | Generate exports via `generate-export-integration` |
| 5 | `05-onboard-existing-project.md` | How-to | Take over an inherited project via `onboard-project` agent |
| 6 | `06-review-and-debug.md` | How-to | Review and debug routes via `review-project` and `debug-integration` agents |
| 7 | `07-working-with-metadata.md` | How-to | Explore partition metadata via `list-pricefx-tables` and pfx CLI |

## Document Specs

### 00 — What This Plugin Does (~200 lines)

**Structure:**

1. **One-liner** — "A plugin that generates IM integrations for you instead of writing XML by hand."

2. **Before/After table** — each row is a common task:

| Task | Without Plugin | With Plugin |
|------|---------------|-------------|
| New import integration | 2-4h: study docs, write route XML, mapper, properties, test | 5 min: answer wizard questions, plugin generates everything |
| Take over someone's project | 1-2 days: read every file, understand what it does | 2 min: `onboard-project` → complete report + diagrams |
| Debug a failing route | Hours: log, search XML, trial and error | Minutes: describe the error, agent finds root cause and proposes fix |
| Check quality before deploy | Manual review, easy to miss issues | `review-project` → scored report with critical/warning/info |
| Understand a route | Read XML, trace references manually | `document` → plain English explanation + data flow diagram |
| Generate test data | Write CSV by hand, guess field formats | `generate-test-data` → realistic CSV from mapper + partition metadata |

3. **What the plugin contains** — capability map:
   - **Skills (slash commands)** — 23 generators that create files (routes, mappers, filters, connections, tests, diagrams)
   - **Agents** — 11 autonomous analyzers that review, debug, document, and improve projects
   - **pfx CLI** — direct access to partition metadata (tables, fields, types, sample data)
   - **Pattern catalog** — 18 proven patterns extracted from production projects

4. **How it works** — 3-step workflow:
   1. You tell it what you need (slash command or natural language)
   2. Plugin asks targeted questions and fetches metadata from your partition
   3. Plugin generates complete files — done

5. **Skills & Agents quick reference** — two tables listing all 23 skills and 11 agents with one-line descriptions and trigger phrases

6. **Where to go next** — links to quickstart and how-to guides

### 01 — Your First Integration (~150 lines)

**Format:** Literal transcript of a wizard session with commentary.

**Structure:**

1. **What we'll do** — "Run the integration wizard to generate a complete Product import from CSV."
2. **Prerequisites** — Claude Code installed, plugin loaded, .env configured, `pfx test-connection` passes
3. **The session** — formatted as a chat log:
   ```
   You: /pricefx-im-plugin:run-integration-wizard

   Plugin: What kind of integration do you need?
   - Import (load data INTO Pricefx)
   - Export (extract data FROM Pricefx)
   - Event-driven (react to Pricefx events)

   You: Import

   Plugin: Which Pricefx object?
   [Shows: P, PX, CX, C, SL, SX, DS/DMDS, LTV/MLTV2]

   You: P (Product Master)
   ...
   ```
   Each exchange has a brief commentary explaining what's happening and why.

4. **What you got** — list of generated files with brief descriptions
5. **Verify it works** — dry-run or pfx CLI check
6. **What's next** — links to specific how-to guides for deeper scenarios

### 02 — Import Data from CSV (~150 lines)

**Structure (same for all how-to guides):**

1. **When you need this** — "You have CSV files (from SAP, flat file exports, manual uploads) and need to load them into Pricefx Product, Product Extension, Customer, or Customer Extension tables."
2. **Which skill to use** — `/pricefx-im-plugin:generate-import-integration` or natural language: "I need to import products from CSV"
3. **What happens** — what questions the skill asks (object type, table, fields, source, scheduling) and how it fetches metadata from partition
4. **What you get** — list of generated files: route XML, mapper, properties entries; brief explanation of each
5. **How to verify** — `simulate-dry-run` with sample CSV, check pfx CLI for loaded data
6. **Tips** — practical advice:
   - "Say 'use all fields' to auto-map everything from your partition metadata"
   - "For PX/CX, the skill automatically adds the `constant out='name'` — you don't need to remember"
   - "Combine with `generate-integration-test` to get a Spock test for your new route"

### 03 — Import PA Data Source (~120 lines)

Same 6-section structure. Specific to DMDS:
- Explains why DMDS is different (split/tokenize/flush pattern)
- Shows that the skill handles the complexity — partner just answers questions
- Tips: batch sizing, flush behavior, truncate-before-load option

### 04 — Export Data to CSV (~120 lines)

Same 6-section structure. Covers:
- Full export vs delta sync (skill asks which one)
- Scheduling (skill asks for cron expression)
- Filter generation
- Tips: testing with `timer://runOnce` instead of waiting for cron

### 05 — Onboard Existing Project (~130 lines)

Focuses on the `onboard-project` agent:
- When: "You inherited a project from another partner or team"
- What it produces: route inventory, compliance report, quality score, diagrams, generated docs
- How to interpret the report (RED/YELLOW/GREEN scoring)
- Tips: run `health-check` periodically, not just at onboarding

### 06 — Review and Debug (~130 lines)

Covers two agents:
- `review-project` — when to run, what the report contains, how to act on findings
- `debug-integration` — how to describe an error, what the agent investigates, example session
- Tips: "Paste the full error message", "Run review before every MR"

### 07 — Working with Metadata (~100 lines)

Covers:
- `/pricefx-im-plugin:list-pricefx-tables` — browse tables and fields interactively
- pfx CLI commands for direct access (`pfx product-extensions`, `pfx data-source-metadata`)
- How metadata feeds into skills (auto-mapping, field validation)
- Tips: "Always check metadata before generating — stale partition = wrong mappings"

## Conventions

- All documents show plugin interaction, not raw XML
- XML appears only in "What you get" sections as output context, never as something the partner writes
- Chat-log format uses `You:` and `Plugin:` prefixes
- Each how-to references which slash command OR natural language phrase triggers the skill
- Internal links connect documents: overview → quickstart → how-to guides

## Target Sizes

| Document | Lines |
|----------|-------|
| 00-what-this-plugin-does.md | ~200 |
| 01-your-first-integration.md | ~150 |
| 02-import-data-from-csv.md | ~150 |
| 03-import-pa-data-source.md | ~120 |
| 04-export-data-to-csv.md | ~120 |
| 05-onboard-existing-project.md | ~130 |
| 06-review-and-debug.md | ~130 |
| 07-working-with-metadata.md | ~100 |
| **Total** | **~1,100** |

## Future Waves (not in scope now)

- How-to: REST API integrations (Salesforce inbound/outbound)
- How-to: Event-driven routes
- How-to: SFTP integrations
- How-to: Multi-tenant routing
- How-to: Kafka CDC
- How-to: Performance tuning
- Video walkthroughs
- Interactive playground
