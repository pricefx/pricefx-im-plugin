# pricefx-integration

Claude Code plugin for Pricefx Integration Manager. Provides skills, tools, documentation, and agents for building, reviewing, debugging, and maintaining IM integrations.

## Skills

Invoke via `/pricefx-integration:<skill-name>`:

### generate-import-integration

Generates a complete import integration (route, mapper, config) for any Pricefx object type (P, PX, CX, DS, C). Walks you through the process step by step:

- Fetches real field metadata from the partition via pfx CLI
- Auto-detects CSV format (delimiter, header, data types) from sample data
- Smart auto-mapping: matches CSV columns to Pricefx attributes using label matching, type compatibility, and fuzzy matching
- Generates `loaddataFile` routes by default (recommended over legacy split+tokenize+loaddata)
- Creates new PX/CX extension tables and sets attribute metadata when needed
- Supports CSV, zipped CSV, SFTP, database, and REST API sources

### generate-export-integration

Generates a complete export integration (route, mapper, filter) for any Pricefx object type. Features:

- Fetches real metadata and proposes export field list automatically based on configured attributes
- Supports full export and delta sync (only changed records since last run)
- Generates batched fetch pattern with proper pagination
- Configurable scheduling: one-time, timer-based, or cron (Quartz)
- Supports CSV file, SFTP, database, and REST API targets

### generate-from-requirement

Reads a business requirement document from `docs/requirements/` and generates the complete integration without asking any interactive questions. All information (direction, object type, fields, filters, schedule) is extracted from the requirement doc. Useful for batch-generating integrations from specs.

### generate-integration-test

Generates Spock framework integration tests for IM routes. Creates test classes with proper setup (seed properties, test data), route execution, and result assertions. Handles file-based routes, API routes, and temporary directory management.

### new-integration-wizard

Interactive step-by-step wizard for users who are new to IM or unsure what they need. Guides through:
1. Import or export?
2. Which object type?
3. Which table?
4. Data source/target?
5. Field mapping

Then delegates to the appropriate generation skill.

### list-pricefx-tables

Quick metadata lookup. Lists available PX, CX, or DS tables and their field definitions from the connected Pricefx partition. Useful for exploring what's available before building an integration.

Usage: `/pricefx-integration:list-pricefx-tables PX` or `/pricefx-integration:list-pricefx-tables CX TableName`

## Agents

Agents run autonomously in an isolated context. Invoke via `@pricefx-integration:agent-name` or let Claude delegate automatically.

### review-integration

Full code review of an Integration Manager project. Reads every route, mapper, filter, and config file and checks against IM best practices. Catches issues that can cause production failures or performance problems.

**What it checks:**
- Connection naming (single PriceFxConnection should be named `pricefx`, redundant `connection=pricefx` params)
- Default SFTP connection misuse (`pfx-sftp` with `default-sftp-connection` should use `file` component instead)
- Route/mapper/filter ID naming (must match filename)
- Cross-file consistency (filter `resultFields` in sync with mapper fields)
- Import method (flags legacy split+tokenize+loaddata, recommends `loaddataFile`)
- Orphan detection (mappers/filters not referenced by any route)
- PX/CX extension name presence in mappers and filters
- Key field correctness (`sku` for products, `customerId` for customers)
- Metadata cross-reference via pfx CLI (fields exist, types match converters)

**Output:** Structured report grouped by Critical Issues, Recommendations, and Best Practice Violations.

### migrate-integration

Scans an existing IM project and **automatically applies** fixes for legacy patterns. Presents a migration plan before making changes, so you can approve or select specific migrations.

**Migrations it performs:**
- `split+tokenize+loaddata` → `streamingUnmarshal+loaddataFile` (simpler, more performant CSV imports)
- `pfx-sftp` with `default-sftp-connection` → `file` component (SFTP storage is mounted locally in the pod)
- Remove redundant `connection=pricefx` parameters
- Remove `pfx:` prefix from route IDs
- Rename single PriceFxConnection to `pricefx` (with all route references updated)
- Fix `{{integration.data}}` / `{{data.directory}}` → `{{integration.sftp.root}}`
- Remove invalid `extensionName` parameter from `pfx-api` URIs

### debug-integration

Diagnoses Integration Manager errors and failures. Give it an error message or describe the problem, and it will:

1. Find and read the relevant route, mapper, and filter files
2. Cross-reference against common error patterns
3. Verify partition state via pfx CLI (connection, table existence, field schema, sample data)
4. Report the root cause with a specific fix

**Common issues it diagnoses:**
- "No bean could be found" — mapper/filter ID mismatch
- Empty exports — filter too restrictive, missing `name` criterion, broken delta sync
- Wrong data imported — mapper field mapping errors, missing converters, wrong key field
- Connection errors — bad credentials, wrong URL, timeout
- XML parse errors — unescaped `&`, encoding issues
- File not picked up — wrong directory, missing done file, already processed
- Partial imports — batch size, duplicate keys, type mismatches

### impact-analysis

Answers the question: **"What breaks if I change X?"** before you make the change. Give it a proposed change (rename a field, delete a table, modify a connection) and it scans every route, mapper, filter, and config file to find all references.

**Example queries:**
- "What happens if I rename attribute5 on PX MichaluvTest?"
- "Which routes use the CustomerHierarchy extension?"
- "What breaks if I delete the sftp.connection?"
- "I'm adding 10 new attributes to PX Prices — what needs to change?"

**Output:** List of every affected file and line, required changes in order, and a risk assessment (high/medium/low) for each change.

### document-integration

Reverse-engineers existing routes into structured requirement documents. The inverse of `generate-from-requirement` — useful for documenting legacy or undocumented projects.

**What it generates:**
- Individual requirement docs for each route (`docs/requirements/{route-name}.md`)
- Project summary with all integrations, connections, and key properties
- Field mapping tables with types and converters
- Filter conditions in human-readable format
- Schedule descriptions (translates cron/timer URIs to plain English)
- Enriches docs with actual field labels from partition metadata when available

### generate-test-data

Generates realistic CSV test data for import routes. Uses partition metadata to create data with correct field types, appropriate values based on field labels, and edge cases.

**How it works:**
1. Reads the import route and mapper to understand the expected CSV format
2. Fetches field metadata (types, labels) via pfx CLI
3. Generates contextually appropriate data (product names for "name" fields, prices for "cost" fields, dates for "date" fields, etc.)
4. Includes edge cases: empty optional fields, long strings, special characters
5. Writes to `src/test/resources/data/{route-name}/test-data.csv`

## Bundled Tools

The `pfx` CLI (`tools/bin/pfx.mjs`) is bundled with the plugin and provides direct access to Pricefx partition metadata:

| Command | Description |
|---------|-------------|
| `pfx product-extensions` | List all PX tables |
| `pfx product-extension <name>` | Get PX table field schema |
| `pfx product-extension-metadata <name>` | Get PX field labels and types |
| `pfx customer-extensions` | List all CX tables |
| `pfx customer-extension <name>` | Get CX table field schema |
| `pfx customer-extension-metadata <name>` | Get CX field labels and types |
| `pfx data-sources` | List all DS tables |
| `pfx data-source <name>` | Get DS table field schema |
| `pfx product-metadata` | Get Product (P) attribute metadata |
| `pfx fetch-sample <type> --name <name>` | Fetch sample rows from a table |
| `pfx create-product-extension <name>` | Create a new PX table |
| `pfx create-customer-extension <name>` | Create a new CX table |
| `pfx set-attribute <PX/CX> <ext> <field>` | Set field label and type |
| `pfx test-connection` | Test Pricefx connectivity |

Requires a `.env` file in the project root:
```
PFX_URL=https://your-cluster.pricefx.eu
PFX_PARTITION=your-partition
PFX_USERNAME=admin
PFX_PASSWORD=your-password
```

## Shared Documentation

Reference docs loaded into context for all skills via `CLAUDE.md`:

| Doc | Content |
|-----|---------|
| `routes.md` | XML route patterns, scheduler URIs, file/SFTP/REST targets |
| `components.md` | All `pfx-*` component parameters |
| `mappers.md` | Field mapping, converters, load vs integrate mappers |
| `filters.md` | Filter operators, logic, delta sync patterns |
| `connections.md` | Connection types (PriceFx, OAuth2, SFTP, S3), best practices |
| `configuration.md` | Properties, deployment, scheduling |
| `project.md` | IM project structure and conventions |

Also includes `CLAUDE.md.template` for bootstrapping `CLAUDE.md` in customer projects.

## Installation

1. Clone the repository:
   ```bash
   git clone https://gitlab.pricefx.eu/tools/pricefx-integration.git
   ```

2. Install tool dependencies:
   ```bash
   cd pricefx-integration/tools && npm install
   ```

3. Add the plugin to your Claude Code configuration.

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
│   ├── generate-export-integration/
│   ├── generate-from-requirement/
│   ├── generate-import-integration/
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
