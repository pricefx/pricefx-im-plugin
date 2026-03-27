# Pricefx Integration Manager — Claude Code Plugin

Build, review, debug, and maintain Pricefx Integration Manager projects with AI-powered skills, agents, and tools.

---

## Table of Contents

1. [Installation](#installation)
2. [Setup](#setup)
3. [Quick Start](#quick-start)
4. [Skills Reference](#skills-reference)
5. [Agents Reference](#agents-reference)
6. [pfx CLI Tool](#pfx-cli-tool)
7. [Usage Examples](#usage-examples)
8. [Tips & Best Practices](#tips--best-practices)
9. [Shared Documentation](#shared-documentation)
10. [Plugin Structure](#plugin-structure)
11. [Development](#development)

---

## Installation

### 1. Clone the plugin repository

```bash
git clone https://gitlab.pricefx.eu/tools/pricefx-integration.git
```

### 2. Install pfx CLI dependencies

```bash
cd pricefx-integration/tools && npm install
```

### 3. Add the plugin to Claude Code

There are three ways to load the plugin, depending on your use case:

**Option A — Local development (recommended for trying it out):**

Launch Claude Code with the `--plugin-dir` flag pointing to the cloned plugin:

```bash
claude --plugin-dir /path/to/pricefx-integration
```

You can load multiple plugins at once:

```bash
claude --plugin-dir /path/to/pricefx-integration --plugin-dir /path/to/another-plugin
```

**Option B — Manage via the plugin manager UI:**

Run `/plugin` inside Claude Code to open the plugin manager. From there you can browse marketplaces, install, enable/disable, and uninstall plugins.

### Useful plugin commands

| Command | Purpose |
|---------|---------|
| `/plugin` | Open plugin manager UI |
| `/plugin install <name>@<marketplace>` | Install a plugin |
| `/plugin uninstall <name>@<marketplace>` | Remove a plugin |
| `/plugin enable <name>@<marketplace>` | Re-enable a disabled plugin |
| `/plugin disable <name>@<marketplace>` | Disable without uninstalling |
| `/reload-plugins` | Apply changes without restarting Claude Code |

### 4. Verify installation

Once loaded, you should see the plugin's skills available when you type `/` in Claude Code. Try `/pricefx-integration:list-pricefx-tables` to confirm it works.

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
│   ├── camel-context.xml             # Route wiring
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
/pricefx-integration:new-integration-wizard
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
/pricefx-integration:generate-import-integration
```

The skill will ask you targeted questions and fetch real metadata from your partition to auto-map fields.

---

## Skills Reference

Skills are interactive — they ask questions and generate files. Invoke them with `/pricefx-integration:<skill-name>`.

### generate-import-integration

Generates import routes for **P** (Product), **PX** (Product Extension), **C** (Customer), or **CX** (Customer Extension).

```
/pricefx-integration:generate-import-integration
```

What it produces:
- Route XML file with `loaddataFile` pattern (streaming, recommended)
- Mapper with auto-detected field mappings
- Properties entries for scheduling, file paths
- Registration in `camel-context.xml`

Supports: CSV files, zipped CSV, SFTP sources, database, REST API.

### generate-pa-import-integration

Generates imports for **PA Data Sources** (DMDS) using the specialized `split+tokenize+loaddata+flush` pattern.

```
/pricefx-integration:generate-pa-import-integration
```

This is different from standard imports — DMDS requires batched processing with a mandatory flush step. Do NOT use `generate-import-integration` for Data Sources.

### generate-ppv-import-integration

Generates imports for **Pricing Parameters** (Company Parameters):
- **LTV** — single-key lookup tables (e.g., exchange rates, unit conversions)
- **MLTV2** — multi-key matrix tables (e.g., discount matrices, pricing rules)

```
/pricefx-integration:generate-ppv-import-integration
```

### generate-export-integration

Generates export routes for any Pricefx object type (P, PX, CX, C, DS/DMDS).

```
/pricefx-integration:generate-export-integration
```

Supports:
- Full export or delta sync (only changed records)
- Batched fetch with pagination
- CSV file, SFTP, database, or REST API targets
- Configurable scheduling (one-time, timer, cron)

### generate-from-requirement

Reads a business requirement document and generates the complete integration without asking questions.

```
/pricefx-integration:generate-from-requirement
```

Place your requirement doc in `docs/requirements/` first. The skill extracts direction, object type, fields, filters, and schedule from the document.

### generate-integration-test

Generates Spock framework tests for your IM routes.

```
/pricefx-integration:generate-integration-test
```

Produces:
- Groovy Spock test class with WireMock + Spring CamelContext
- Sample CSV test data
- Expected JSON request payloads

### new-integration-wizard

Interactive step-by-step wizard for building integrations from scratch. Best for users who are new to IM.

```
/pricefx-integration:new-integration-wizard
```

### list-pricefx-tables

Quick metadata lookup — no files generated, just displays information.

```
/pricefx-integration:list-pricefx-tables
/pricefx-integration:list-pricefx-tables PX
/pricefx-integration:list-pricefx-tables CX MyTable
```

---

## Agents Reference

Agents run autonomously and are invoked automatically when Claude detects a matching task, or you can ask for them explicitly. They can also be triggered by describing the task naturally.

### review-integration

**What it does:** Full code review of your IM project — reads every route, mapper, filter, and config file. Checks for connection naming issues, XML syntax errors, hardcoded values, mismatched resource IDs, and best-practice violations. Produces a structured report with findings grouped by severity so you know what to fix first.

**How to use:**

```
Review my integration project
```

```
Can you do a code review of all my routes?
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

### document-integration

**What it does:** Reverse-engineers existing routes into structured requirement documents. Great for onboarding new team members or creating documentation for legacy projects.

**How to use:**

```
Generate documentation for all routes in this project
```

```
Document the import-products route
```

### migrate-integration

**What it does:** Modernizes legacy IM projects. Detects outdated patterns and proposes a migration plan. Once you approve, it applies the changes.

Detects:
- `split+tokenize+loaddata` → `loaddataFile` (except DMDS)
- `pfx-sftp` with `default-sftp-connection` → `file://` component
- Redundant `connection=pricefx` parameters
- Route ID `pfx:` prefixes

**How to use:**

```
Migrate this project to modern IM patterns
```

### generate-test-data

**What it does:** Creates realistic CSV test data by reading route mappers and partition metadata.

**How to use:**

```
Generate test data for the import-products route
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
/pricefx-integration:list-pricefx-tables PX
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

```
/pricefx-integration:generate-from-requirement
```

It reads the doc and generates everything without asking questions.

### Example 7: Review before deployment

**You say:**
```
Review my integration project before I deploy it
```

**What happens:**
1. The `review-integration` agent scans all files
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

---

## Tips & Best Practices

### Use skills for generation, agents for analysis

- **Skills** (`/pricefx-integration:...`) create new files — routes, mappers, filters, tests
- **Agents** analyze existing files — review, debug, document, measure impact

### Let the plugin fetch metadata

Don't manually look up field names. The skills connect to your partition and auto-map fields. Just describe what you need in plain language.

### One skill per object type pattern

| What you're importing | Skill to use |
|---|---|
| Products (P), Product Extensions (PX), Customers (C), Customer Extensions (CX) | `generate-import-integration` |
| Data Sources / PA Data Sources (DS/DMDS) | `generate-pa-import-integration` |
| Pricing Parameters / Company Parameters (LTV/MLTV2) | `generate-ppv-import-integration` |
| Any object type for export | `generate-export-integration` |

### Review before deploying

Always run `Review my integration project` before deploying to catch issues early. The review agent checks for common mistakes that cause deployment failures.

### Keep .env out of version control

Add `.env` to your `.gitignore`. The `.env` file contains credentials and should never be committed.

### Use requirement docs for repeatable generation

For projects with many integrations, write requirement docs first, then batch-generate with `generate-from-requirement`. This ensures consistency and creates documentation as a byproduct.

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

Also includes `docs/CLAUDE.md.template` for bootstrapping `CLAUDE.md` in customer projects.

---

## Plugin Structure

```
pricefx-integration/
├── .claude-plugin/
│   └── plugin.json
├── CLAUDE.md
├── agents/
│   ├── review-integration.md
│   ├── migrate-integration.md
│   ├── debug-integration.md
│   ├── impact-analysis.md
│   ├── document-integration.md
│   └── generate-test-data.md
├── skills/
│   ├── generate-import-integration/
│   ├── generate-pa-import-integration/
│   ├── generate-ppv-import-integration/
│   ├── generate-export-integration/
│   ├── generate-from-requirement/
│   ├── generate-integration-test/
│   ├── list-pricefx-tables/
│   └── new-integration-wizard/
├── docs/
│   ├── components.md
│   ├── configuration.md
│   ├── connections.md
│   ├── filters.md
│   ├── mappers.md
│   ├── project.md
│   ├── routes.md
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

- **GitLab**: https://gitlab.pricefx.eu/tools/pricefx-integration

## License

Internal - Pricefx
