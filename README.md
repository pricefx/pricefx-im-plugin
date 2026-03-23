# Pricefx Integration Manager - Claude Code Plugin

Build, review, debug, and maintain Pricefx Integration Manager projects with AI-powered skills, agents, and tools.

## Agents

Agents run autonomously in an isolated context. Invoke via `@pricefx-integration:agent-name` or let Claude delegate automatically.

### review-integration

Performs a comprehensive quality review of your entire IM project. Think of it as a senior engineer reviewing your work before it goes to production — it reads every file in the project and identifies issues that could cause failures, performance problems, or maintenance headaches. Produces a structured report with findings grouped by severity so you know what to fix first.

### migrate-integration

Modernizes legacy IM projects automatically. If you have older integrations built with outdated patterns, this agent scans the project, identifies what can be improved, and presents a migration plan. Once you approve, it applies the changes for you. Useful when onboarding an old customer project or after an IM platform upgrade.

### debug-integration

Your first stop when something goes wrong. Paste an error message or describe the problem, and it will trace through the route, mapper, filter, and configuration files to find the root cause. It can also connect to the Pricefx partition to verify that tables and fields actually exist. Returns a clear diagnosis with the exact fix needed.

### impact-analysis

Answers the question **"What breaks if I change X?"** before you make the change. Whether you're renaming a field, removing a table, or changing a connection, this agent scans every file in the project to find all references that would be affected. Essential for safe refactoring on projects with many integrations, so you don't accidentally break a route you didn't know existed.

### document-integration

Generates documentation from existing integrations — the reverse of building from a spec. Point it at a project with undocumented routes and it produces structured requirement documents describing what each integration does, which fields it maps, what filters it applies, and when it runs. Great for onboarding new team members or creating documentation for legacy projects that were never properly documented.

### generate-test-data

Creates realistic CSV test data for your import routes. Instead of manually crafting test files, this agent reads the route's mapper and fetches field metadata from the partition to generate data with correct types, meaningful values, and edge cases. Saves time when setting up integration tests or validating a new route.

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
