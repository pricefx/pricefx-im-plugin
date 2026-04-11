# Pricefx Integration Manager — Claude Code Plugin

Build, review, debug, and maintain Pricefx Integration Manager projects with AI-powered skills, agents, and tools.

---

## Table of Contents

1. [Installation](#installation)
2. [Setup](#setup)
3. [Quick Start](#quick-start)
4. [Skills Reference](#skills-reference)
5. [Pattern Catalog](#pattern-catalog)
6. [Agents Reference](#agents-reference)
7. [pfx CLI Tool](#pfx-cli-tool)
8. [Usage Examples](#usage-examples)
9. [Tips & Best Practices](#tips--best-practices)
10. [Shared Documentation](#shared-documentation)
11. [Plugin Structure](#plugin-structure)
12. [Development](#development)

---

## Installation

### Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with plugin support
- [Node.js](https://nodejs.org/) (for the pfx CLI tool)
- Access to a Pricefx partition with API credentials

### Option A — Install from marketplace (recommended)

```bash
# Add the Pricefx marketplace (one-time)
/plugin marketplace add pricefx/pricefx-plugins

# Install the plugin
/plugin install pricefx-im-plugin@pricefx-plugins
```

Or use the interactive UI: type `/plugin` in Claude Code, go to **Discover**, select **pricefx-im-plugin**, and install.

After installing, run the pfx CLI dependency setup:

```bash
cd ~/.claude/plugins/pricefx-im-plugin/tools && npm install
```

### Option B — Install from source

```bash
git clone https://github.com/pricefx/pricefx-im-plugin.git
cd pricefx-im-plugin/tools && npm install
claude --plugin-dir /path/to/pricefx-im-plugin
```

### Verify installation

Once loaded, you should see the plugin's skills available when you type `/` in Claude Code. Try `/pricefx-im-plugin:list-pricefx-tables` to confirm it works.

---

## Setup

### Connect to your Pricefx partition

Create a `.env` file in **your IM project root** (not the plugin directory):

```env
PFX_URL=https://your-cluster.pricefx.eu
PFX_PARTITION=your-partition
PFX_USERNAME=admin
PFX_PASSWORD=your-password
```

Test the connection:

```
> pfx test-connection
```

### Project structure

The plugin expects a standard IM project layout:

```
your-im-project/
├── .env                              # Pricefx credentials
├── CLAUDE.md                         # Project instructions (optional)
├── src/main/resources/
│   ├── application.properties        # Route configuration
│   └── repo/
│       ├── routes/                   # Camel route XML files
│       ├── mappers/                  # Field mapping XML files
│       ├── filters/                  # Filter XML files
│       ├── connections/              # Connection JSON files (pricefx, sftp, etc.)
│       ├── beans/                    # Custom Java/Groovy beans
│       ├── classes/                  # Custom classes
│       ├── config/                   # Additional configuration
│       └── resources/                # Static resources
└── docs/
    └── requirements/                 # Business requirement docs
```

---

## Quick Start

### Create your first import integration

The fastest way to get started is the interactive wizard:

```
/pricefx-im-plugin:run-integration-wizard
```

It will walk you through:
1. Import or export?
2. Which object type? (Product, Product Extension, Customer, etc.)
3. Which table?
4. Where does the data come from?
5. Field mapping

Then it generates all the files for you.

### Or go directly to a specific skill

If you already know what you need:

```
/pricefx-im-plugin:generate-import-integration
```

The skill will ask you targeted questions and fetch real metadata from your partition to auto-map fields.

---

## Skills Reference

Skills are interactive — they ask questions and generate files. Invoke them with `/pricefx-im-plugin:<skill-name>`. The plugin ships with **23 skills** covering the full integration development lifecycle.

---

### Generation (12 skills)

#### generate-import-integration

Generates import routes for **P** (Product), **PX** (Product Extension), **C** (Customer), **CX** (Customer Extension), **SL** (Seller), or **SX** (Seller Extension).

```
/pricefx-im-plugin:generate-import-integration
```

What it produces:
- Route XML file with `loaddataFile` pattern (streaming, recommended)
- Mapper with auto-detected field mappings
- Properties entries for scheduling, file paths
- Registration in `camel-context.xml`

Supports: CSV files, zipped CSV, SFTP sources, database (pfx-sql), REST API (pfx-rest).

#### generate-pa-import-integration

Generates imports for **PA Data Sources** (DMDS) using the specialized `split+tokenize+loaddata+flush` pattern.

```
/pricefx-im-plugin:generate-pa-import-integration
```

This is different from standard imports — DMDS requires batched processing with a mandatory flush step. Do NOT use `generate-import-integration` for Data Sources.

#### generate-ppv-import-integration

Generates imports for **Pricing Parameters** (Company Parameters):
- **LTV** — single-key lookup tables (e.g., exchange rates, unit conversions)
- **MLTV2** — multi-key matrix tables (e.g., discount matrices, pricing rules)

```
/pricefx-im-plugin:generate-ppv-import-integration
```

#### generate-export-integration

Generates export routes for any Pricefx object type (P, PX, CX, C, DS/DMDS).

```
/pricefx-im-plugin:generate-export-integration
```

Supports:
- Full export or delta sync (only changed records)
- Batched fetch with pagination
- CSV file, SFTP, database, or REST API targets
- Configurable scheduling (one-time, timer, cron)

#### generate-event-driven-route

Generates event-driven routes that react to Pricefx events.

```
/pricefx-im-plugin:generate-event-driven-route
```

Supports:
- Properties-based event mapping (recommended — simplest approach)
- Direct `pfx-event:fetch` polling (custom intervals, multiple event types)
- Custom event publishing (`pfx-event:sendCustom` for chaining routes)

Common events: `PADATALOAD_COMPLETED`, `CALCULATION_COMPLETED_CFS`, `REFRESH_COMPLETED`, custom events.

#### generate-rest-outbound-integration

Generates routes that call an external REST API from IM — for example, pushing Pricefx data to a downstream system or triggering a remote workflow.

```
/pricefx-im-plugin:generate-rest-outbound-integration
```

Supports: OAuth2 bearer tokens, API key headers, HTTP basic auth, retry/dead-letter patterns, and payload transformation via mapper.

#### generate-inbound-rest-endpoint

Generates inbound REST API endpoints that external systems can call into IM. Covers GET (health check, data lookup) and POST (formula execution, data submission) endpoints.

```
/pricefx-im-plugin:generate-inbound-rest-endpoint
```

Includes: Camel REST DSL setup, mandatory field validation, Pricefx formula execution, structured error responses (400/500), Swagger/OpenAPI doc generation, and REST module configuration (`integration.rest.*` properties).

#### generate-kafka-integration

Generates routes that publish to or consume from a Kafka topic, including schema-registry configuration, consumer group settings, and dead-letter topic handling.

```
/pricefx-im-plugin:generate-kafka-integration
```

Supports: Avro and JSON serialization, exactly-once semantics, manual offset commit, and header propagation.

#### generate-soap-integration

Generates routes that call a SOAP/WSDL web service or expose a Pricefx integration as a SOAP endpoint, with CXF component configuration and JAXB binding.

```
/pricefx-im-plugin:generate-soap-integration
```

#### generate-s3-integration

Generates routes that read from or write to an AWS S3 bucket — including bucket polling, multi-part upload for large files, and S3-event-triggered processing.

```
/pricefx-im-plugin:generate-s3-integration
```

Produces: S3 connection JSON, route XML with streaming download/upload, and properties entries for bucket name and region.

#### generate-multi-tenant-route

Generates a parameterized route that fans out to multiple Pricefx partitions from a single IM instance, with per-tenant connection overrides and isolated error handling.

```
/pricefx-im-plugin:generate-multi-tenant-route
```

Covers: dynamic partition routing, tenant registry pattern, and per-tenant property namespacing.

#### generate-scheduling-route

Generates a cron- or timer-driven scheduling wrapper around an existing route, including staggered startup, time-zone support, and configurable properties entries.

```
/pricefx-im-plugin:generate-scheduling-route
```

Useful when you want to separate the scheduling concern from the core route logic, or when multiple routes share the same schedule.

#### generate-connection

Interactive generator for connection JSON files — covers all supported connection types (Pricefx, SFTP, OAuth2, S3, database) with field-by-field guidance and validation.

```
/pricefx-im-plugin:generate-connection
```

Produces a correctly structured connection JSON file ready for placement in `connections/`.

---

### Analysis & Quality (3 skills)

#### check-route-compliance

Lints all routes in the project against the pattern catalog. Flags deviations from established patterns — such as missing flush steps, non-standard naming conventions, or improper error handling — and explains the correct approach.

```
/pricefx-im-plugin:check-route-compliance
```

Useful as a pre-commit or pre-review quality gate.

#### estimate-performance

Estimates processing time for a route based on record volume, batch size, API latency, and scheduling parameters. Highlights likely bottlenecks and suggests tuning options.

```
/pricefx-im-plugin:estimate-performance
```

Example: "How long will this import take for 1 million records?"

#### compare-environments

Diffs routes, mappers, filters, and properties between two branches or environment configurations. Highlights what changed, what was added, and what was removed — formatted for easy review.

```
/pricefx-im-plugin:compare-environments
```

Example: "Compare develop vs my feature branch."

---

### Documentation & Visualization (2 skills)

#### explain-route

Produces a plain-language explanation of any route — what it does, where data comes from, how it's transformed, where it goes, and when it runs. Suitable for sharing with non-technical stakeholders.

```
/pricefx-im-plugin:explain-route
```

#### generate-flow-diagram

Generates a Mermaid data flow diagram for a route or the full project, saved as a `.md` file. Shows data sources, transformations, Pricefx endpoints, and error channels.

```
/pricefx-im-plugin:generate-flow-diagram
```

Output is a markdown file with an embedded Mermaid diagram, suitable for docs or Confluence.

---

### Testing (2 skills)

#### generate-integration-test

Generates Spock framework tests for your IM routes.

```
/pricefx-im-plugin:generate-integration-test
```

Produces:
- Groovy Spock test class with WireMock + Spring CamelContext
- Sample CSV test data
- Expected JSON request payloads

#### simulate-dry-run

Traces data through a route without making any real API calls. Takes a sample input (CSV row or JSON payload), applies the mapper and filter logic, and shows the exact output that would be sent to Pricefx — including which records would be filtered out and why.

```
/pricefx-im-plugin:simulate-dry-run
```

Example: "What would happen if I run this CSV through the import-products route?"

---

### Workflow (2 skills)

#### run-integration-wizard

Interactive step-by-step wizard for building integrations from scratch. Best for users who are new to IM. Supports event-driven integrations, SL/SX object types, and all scheduling options.

```
/pricefx-im-plugin:run-integration-wizard
```

#### git-workflow

Smart branch, commit, and merge request automation tailored to IM projects. Creates branches with consistent naming, generates descriptive commit messages based on generated files, and prepares MR descriptions with a summary of what was built.

```
/pricefx-im-plugin:git-workflow
```

---

### Utility (1 skill)

#### list-pricefx-tables

Quick metadata lookup — no files generated, just displays information.

```
/pricefx-im-plugin:list-pricefx-tables
/pricefx-im-plugin:list-pricefx-tables PX
/pricefx-im-plugin:list-pricefx-tables CX MyTable
```

---

## Pattern Catalog

The plugin ships an anonymized **pattern catalog** in `docs/patterns/` — 18 reference integration patterns extracted from real-world IM deployments (all customer names and partition details removed).

Skills reference the catalog automatically to apply proven implementation approaches. You can also browse it directly to understand how a particular scenario is typically built.

### What the catalog covers

| Category | Patterns |
|---|---|
| Import | Product master (CSV/SFTP), Customer master, Pricing Parameters (LTV/MLTV2), PA Data Source batch load |
| Export | Delta sync with timestamp watermark, full extract to SFTP, export-to-REST push |
| Event-driven | Post-calculation trigger, data-load completion chain, custom event fan-out |
| Outbound | REST push with OAuth2, SOAP call with JAXB, Kafka publish with Avro |
| Platform | Multi-tenant fan-out, scheduled wrapper with staggered startup, S3 polling inbound |
| Testing | WireMock contract test, Spock data-table driven test, integration smoke test |

### Using patterns in conversations

You can reference patterns by name when asking for generation or review:

```
Generate an export using the delta-sync-with-watermark pattern
Review my route and check it against the PA batch load pattern
```

Skills will apply the matching pattern as their baseline and adapt it to your project's metadata.

---

## Agents Reference

Agents run autonomously and are invoked automatically when Claude detects a matching task, or you can ask for them explicitly. They can also be triggered by describing the task naturally. The plugin ships with **11 agents**.

### review-project

**What it does:** Full code review of your IM project — reads every route, mapper, filter, and config file. Checks for connection naming issues, XML syntax errors, hardcoded values, mismatched resource IDs, and best-practice violations. Enhanced with anti-pattern detection: cross-references all findings against the pattern catalog to flag known problematic constructs (e.g., missing flush in DMDS routes, unbounded polling without a dead-letter channel, synchronous REST calls without timeout configuration). Produces a structured report with findings grouped by severity.

**How to use:**

```
Review my integration project
```

```
Can you do a code review of all my routes?
```

```
Review my project and check for anti-patterns
```

### debug-integration

**What it does:** Diagnoses errors and failures. Traces through route/mapper/filter files, verifies metadata exists in the partition, and returns a clear diagnosis with the exact fix.

**How to use:**

```
My import-products route is failing with this error: [paste error]
```

```
The data isn't loading correctly into PX table Prices, can you debug?
```

### impact-analysis

**What it does:** Answers "What breaks if I change X?" Scans all files for references to a field, table, connection, or property.

**How to use:**

```
What would be affected if I rename attribute5 to attribute10 in the Prices PX table?
```

```
I want to remove the sftp.connection — what routes depend on it?
```

### document-project

**What it does:** Reverse-engineers existing routes into structured requirement documents. Great for onboarding new team members or creating documentation for legacy projects.

**How to use:**

```
Generate documentation for all routes in this project
```

```
Document the import-products route
```

### migrate-project

**What it does:** Modernizes legacy IM projects. Detects outdated patterns, proposes a migration plan, and applies changes once you approve. Incorporates legacy migration analysis to produce a full modernization roadmap with effort estimates before applying any changes.

Detects:
- `split+tokenize+loaddata` → `loaddataFile` (except DMDS)
- `pfx-sftp` with `default-sftp-connection` → `file://` component
- Redundant `connection=pricefx` parameters
- Route ID `pfx:` prefixes
- Outdated component versions and deprecated URIs

**How to use:**

```
Migrate this project to modern IM patterns
```

```
Assess what needs to be migrated, then apply the changes
```

### generate-test-data

**What it does:** Creates realistic CSV test data by reading route mappers and partition metadata.

**How to use:**

```
Generate test data for the import-products route
```

### onboard-project

**What it does:** Complete onboarding workflow for an inherited or unfamiliar IM project. Reads all routes and configuration, produces a structured project summary (what each route does, what tables it touches, what schedule it runs on), flags any immediate risks, and sets up a `CLAUDE.md` with project-specific context to accelerate future AI-assisted work.

**How to use:**

```
Onboard me to this project
```

```
I just inherited this IM project, help me understand it
```

### build-integration

**What it does:** End-to-end integration builder — takes a business requirement (described in natural language or from a doc) and drives the full workflow: requirement clarification, metadata fetch, skill selection, generation, test generation, and a final review pass. Produces a complete, review-ready integration in one session.

**How to use:**

```
Build me an integration from scratch to import products from SFTP
```

```
I need a full end-to-end solution for exporting changed customers daily
```

### analyze-project

**What it does:** Analyzes an existing IM project (your own or a partner's) and produces a structured assessment: route inventory, identified patterns, anti-patterns, migration opportunities, and a prioritized recommendation list. Does not modify any files. Output is a markdown report that can be saved to `docs/` or shared directly.

**How to use:**

```
Analyze this project and give me a full assessment
```

```
Review a partner project at /path/to/project
```

### health-check

**What it does:** Generates a project health dashboard with a quality score. Evaluates route coverage, test coverage, documentation completeness, pattern compliance, naming conventions, and configuration hygiene. Produces a structured scorecard with actionable recommendations.

**How to use:**

```
Run a health check on my project
```

```
What's the quality score for this integration project?
```

### upgrade-project

**What it does:** Complete upgrade workflow — detects the current IM version, identifies all breaking changes and deprecations for the target version, applies safe automatic fixes, and presents a summary of any remaining manual steps. Combines upgrade compatibility analysis with automated remediation.

**How to use:**

```
Upgrade this project to IM 7.3
```

```
Apply all safe upgrades and tell me what still needs manual work
```

---

## pfx CLI Tool

The bundled `pfx` CLI (`tools/bin/pfx.mjs`) connects directly to your Pricefx partition to fetch metadata. It reads credentials from the `.env` file.

### Commands

| Command | Description |
|---------|-------------|
| `pfx test-connection` | Verify credentials are valid |
| `pfx product-extensions` | List all PX tables |
| `pfx product-extension <name>` | Get field names for a PX table |
| `pfx product-extension-metadata <name>` | Get field labels, types, and formats |
| `pfx product-metadata` | Get Product (P) attribute metadata |
| `pfx customer-extensions` | List all CX tables |
| `pfx customer-extension <name>` | Get CX field names |
| `pfx customer-extension-metadata <name>` | Get CX field labels, types, and formats |
| `pfx data-sources` | List all DS tables |
| `pfx data-source <name>` | Get DS field names |
| `pfx data-source-metadata <name>` | Get DS field labels, types, and formats |
| `pfx pricing-parameters` | List all Pricing Parameter tables |
| `pfx pricing-parameter <name>` | Get PPV fields and sample data |
| `pfx create-product-extension <name>` | Create a new PX table |
| `pfx create-customer-extension <name>` | Create a new CX table |
| `pfx create-pricing-parameter <name>` | Create a new Pricing Parameter table |
| `pfx set-attribute <PX/CX> <ext> <field>` | Set attribute label/type on a field |
| `pfx set-attributes <PX/CX> <ext> <attrs...>` | Batch set multiple attributes |
| `pfx fetch-sample <type> --name <name> --limit N` | Fetch sample rows from any table |

### Usage from terminal

You can run pfx commands directly in Claude Code's terminal:

```bash
! pfx product-extensions
! pfx product-extension-metadata Prices
```

Or ask Claude naturally:

```
List all PX tables in my partition
What fields does the Prices extension have?
```

---

## Usage Examples

### Example 1: Import products from CSV

**You say:**
```
I need to import product master data from a CSV file. The CSV has columns:
PartNumber, Description, UOM, PricingType, Status, ListPrice
```

**What happens:**
1. Claude invokes `generate-import-integration`
2. Fetches Product metadata from your partition via `pfx product-metadata`
3. Auto-maps CSV columns to Pricefx fields (PartNumber→sku, Description→label, etc.)
4. Generates route XML, mapper, and properties
5. Registers the route in `camel-context.xml`

### Example 2: Import pricing parameters (exchange rates)

**You say:**
```
I need to load exchange rates into a Company Parameter table called "ExchangeRates".
The CSV has: CurrencyCode, Rate
```

**What happens:**
1. Claude invokes `generate-ppv-import-integration`
2. Fetches the ExchangeRates parameter metadata
3. Determines it's an LTV (single-key lookup) table
4. Generates route with `loaddata?objectType=LTV&pricingParameterName=ExchangeRates`

### Example 3: Export customer data for delta sync

**You say:**
```
I need to export customers that changed since the last run to a CSV file on SFTP
```

**What happens:**
1. Claude invokes `generate-export-integration`
2. Asks which fields to export
3. Generates a delta sync pattern with `pfx-config:get` for last sync timestamp
4. Creates a filter with `lastUpdateDate > lastExportTimestamp`
5. Generates batched fetch + CSV marshal + SFTP upload

### Example 4: Import data into a PA Data Source

**You say:**
```
I need to load sales transaction data into the SalesHistory data source from CSV
```

**What happens:**
1. Claude invokes `generate-pa-import-integration`
2. Fetches DS metadata for SalesHistory
3. Generates the DMDS-specific pattern: split → tokenize → loaddata → flush
4. Includes batch size configuration and proper aggregation strategy

### Example 5: Explore what tables exist

**You say:**
```
/pricefx-im-plugin:list-pricefx-tables PX
```

**What happens:**
1. Runs `pfx product-extensions` to list all PX tables
2. Displays table names in a formatted list
3. You can then ask for details: "Show me the fields in Prices"

### Example 6: Build from a requirement document

**Step 1 — Create the requirement doc** in `docs/requirements/import-products.md`:

```markdown
# Import Products

## Direction
Import (into Pricefx)

## Object Type
P (Product Master)

## Source
CSV file from SFTP at /inbound/products/

## Fields
| CSV Column | Pricefx Field | Type |
|---|---|---|
| PartNumber | sku | String |
| Description | label | String |
| UOM | attribute1 | String |
| ListPrice | attribute5 | Decimal |

## Schedule
Daily at 6 AM EST
```

**Step 2 — Generate:**

Ask Claude to build the integration from your requirement document, or describe the requirement conversationally and let the `build-integration` agent handle the rest.

It reads the doc and generates everything without asking questions.

### Example 7: Review before deployment

**You say:**
```
Review my integration project before I deploy it
```

**What happens:**
1. The `review-project` agent scans all files
2. Produces a report with findings grouped by severity:
   - Critical: mismatched resource IDs, missing business keys
   - Warning: hardcoded values that should be in properties
   - Info: style improvements, missing logging

### Example 8: Debug a failing route

**You say:**
```
My import-customers route fails with: "No such attribute: attribute15 on type CX"
```

**What happens:**
1. The `debug-integration` agent reads the route and mapper
2. Runs `pfx customer-extension-metadata <table>` to check actual fields
3. Reports: "attribute15 doesn't exist on the CX table. The mapper maps 'Region' to attribute15 but the table only has attributes 1-10. Fix: create attribute15 or remap to an existing attribute."

### Example 9: Check impact before renaming a field

**You say:**
```
I want to rename attribute5 to attribute12 in the Prices PX table. What would break?
```

**What happens:**
1. The `impact-analysis` agent searches all routes, mappers, filters, and properties
2. Reports every file that references `attribute5` in context of the Prices table
3. Lists exact line numbers and suggests what to update

### Example 10: Generate test data

**You say:**
```
Generate test CSV data for my import-products route
```

**What happens:**
1. The `generate-test-data` agent reads the route's mapper
2. Fetches field metadata from the partition
3. Generates a CSV file with realistic data, correct types, and edge cases
4. Places it in the test resources directory

### Example 11: Run a project health check

**You say:**
```
Run a health check on my project
```

**What happens:**
1. The `health-check` agent scans routes, tests, docs, and configuration
2. Produces a scorecard covering coverage, compliance, naming, and hygiene
3. Returns a quality score with a prioritized list of improvements

### Example 12: Visualize data flow

**You say:**
```
Visualize the data flow for import-products
```

**What happens:**
1. Claude invokes `generate-flow-diagram`
2. Reads the route, mapper, and filter files
3. Generates a Mermaid diagram showing: SFTP source → CSV parse → field mapping → filter → Pricefx loaddata
4. Saves it as a `.md` file in `docs/`

### Example 13: Simulate a dry run

**You say:**
```
What would happen if I run this CSV through the import-products route?
```

**What happens:**
1. Claude invokes `simulate-dry-run`
2. Applies the mapper to your sample CSV rows
3. Evaluates the filter against each mapped record
4. Reports: which records pass, which are filtered out, and what the exact Pricefx API payload would look like — without making any real calls

### Example 14: Compare environments

**You say:**
```
Compare develop vs my feature branch to see what changed
```

**What happens:**
1. Claude invokes `compare-environments`
2. Diffs routes, mappers, filters, and properties between the two branches
3. Produces a structured summary: added routes, modified mappers, changed properties
4. Flags anything that looks like a regression risk

### Example 15: Estimate import performance

**You say:**
```
How long will this import take for 1 million records?
```

**What happens:**
1. Claude invokes `estimate-performance`
2. Reads batch size, threading config, and API call patterns from the route
3. Applies latency estimates for each stage
4. Returns a time estimate with a breakdown by stage and suggestions for tuning if the estimate exceeds your SLA

---

## Tips & Best Practices

### Use skills for generation, agents for analysis

- **Skills** (`/pricefx-im-plugin:...`) create new files — routes, mappers, filters, tests, diagrams
- **Agents** analyze existing files — review, debug, document, measure impact, run health checks

### Let the plugin fetch metadata

Don't manually look up field names. The skills connect to your partition and auto-map fields. Just describe what you need in plain language.

### Onboard before you build

When inheriting an existing project, run the `onboard-project` agent first. It produces a structured summary and sets up `CLAUDE.md` so all subsequent AI sessions have project-specific context.

### Choose the right skill for generation

| Scenario | Skill to use |
|---|---|
| Products (P), Product Extensions (PX), Customers (C), Customer Extensions (CX) import | `generate-import-integration` |
| Data Sources / PA Data Sources (DS/DMDS) import | `generate-pa-import-integration` |
| Pricing Parameters / Company Parameters (LTV/MLTV2) import | `generate-ppv-import-integration` |
| Any object type for export | `generate-export-integration` |
| Calling an external REST API | `generate-rest-outbound-integration` |
| Exposing a REST endpoint from IM | `generate-inbound-rest-endpoint` |
| Kafka publish or consume | `generate-kafka-integration` |
| SOAP/WSDL web service | `generate-soap-integration` |
| AWS S3 read or write | `generate-s3-integration` |
| Cron/timer scheduling wrapper | `generate-scheduling-route` |
| Single IM instance, multiple partitions | `generate-multi-tenant-route` |
| Connection JSON file | `generate-connection` |

### Choose the right agent for analysis

| Scenario | Agent to use |
|---|---|
| Full code review before deployment | `review-project` |
| Diagnosing a route failure | `debug-integration` |
| Impact of a field or connection rename | `impact-analysis` |
| Documenting routes for stakeholders | `document-project` |
| Migrating outdated patterns | `migrate-project` |
| Creating test data | `generate-test-data` |
| Understanding an inherited project | `onboard-project` |
| End-to-end integration from a requirement | `build-integration` |
| Assessing an existing or partner project | `analyze-project` |
| Project quality score | `health-check` |
| Full version upgrade with auto-fix | `upgrade-project` |

### Dry-run before deploying unfamiliar routes

Use `simulate-dry-run` to validate mapper and filter logic against real data before you push changes to a live partition. It costs nothing and catches mapping errors early.

### Use `check-route-compliance` as a quality gate

Run `check-route-compliance` before every merge request to catch deviations from established patterns. Combine it with the `health-check` agent to get full coverage and quality insights.

### Review before deploying

Always run `Review my integration project` before deploying to catch issues early. The `review-project` agent checks for common mistakes that cause deployment failures.

### Keep .env out of version control

Add `.env` to your `.gitignore`. The `.env` file contains credentials and should never be committed.

### Use requirement docs for repeatable generation

For projects with many integrations, write requirement docs in `docs/requirements/` first, then use the `build-integration` agent to generate from them. This ensures consistency and creates documentation as a byproduct.

### Use `git-workflow` for consistent branching

The `git-workflow` skill enforces consistent branch naming and generates meaningful commit messages based on what was generated. Use it to keep your Git history readable without extra effort.

---

## Shared Documentation

Reference docs loaded into context for all skills via `CLAUDE.md`:

| Doc | Content |
|-----|---------|
| `docs/routes.md` | XML route patterns, scheduler URIs, file/SFTP/REST targets |
| `docs/components.md` | All `pfx-*` component parameters |
| `docs/mappers.md` | Field mapping, converters, load vs integrate mappers |
| `docs/filters.md` | Filter operators, logic, delta sync patterns |
| `docs/connections.md` | Connection types (PriceFx, OAuth2, SFTP, S3), best practices |
| `docs/configuration.md` | Properties, deployment, scheduling |
| `docs/project.md` | IM project structure and conventions |

Also includes `docs/CLAUDE.md.template` for bootstrapping `CLAUDE.md` in IM projects.

---

## Plugin Structure

```
pricefx-im-plugin/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── CLAUDE.md
├── agents/
│   ├── analyze-project.md
│   ├── build-integration.md
│   ├── debug-integration.md
│   ├── document-project.md
│   ├── generate-test-data.md
│   ├── health-check.md
│   ├── impact-analysis.md
│   ├── migrate-project.md
│   ├── onboard-project.md
│   ├── review-project.md
│   └── upgrade-project.md
├── skills/
│   ├── check-route-compliance/
│   ├── compare-environments/
│   ├── estimate-performance/
│   ├── explain-route/
│   ├── generate-connection/
│   ├── generate-event-driven-route/
│   ├── generate-export-integration/
│   ├── generate-flow-diagram/
│   ├── generate-import-integration/
│   ├── generate-integration-test/
│   ├── generate-kafka-integration/
│   ├── generate-multi-tenant-route/
│   ├── generate-pa-import-integration/
│   ├── generate-ppv-import-integration/
│   ├── generate-inbound-rest-endpoint/
│   ├── generate-rest-outbound-integration/
│   ├── generate-s3-integration/
│   ├── generate-scheduling-route/
│   ├── generate-soap-integration/
│   ├── git-workflow/
│   ├── list-pricefx-tables/
│   ├── run-integration-wizard/
│   └── simulate-dry-run/
├── docs/
│   ├── components.md
│   ├── configuration.md
│   ├── connections.md
│   ├── filters.md
│   ├── mappers.md
│   ├── project.md
│   ├── routes.md
│   ├── patterns/                         # 18 anonymized reference integration patterns
│   └── CLAUDE.md.template
└── tools/
    ├── bin/pfx.mjs
    ├── lib/
    └── package.json
```

---

## Development

### Branches

- `main` — Stable releases
- `develop` — Active development

### Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Submit a merge request to `develop`

## Repository

- **GitHub**: https://github.com/pricefx/pricefx-im-plugin (public, distribution)
- **GitLab**: https://gitlab.pricefx.eu/tools/pricefx-integration (internal, development)

## License

Apache License 2.0 — see [LICENSE](LICENSE)
