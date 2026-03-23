# pricefx-integration

Claude Code plugin for Pricefx Integration Manager. Provides skills, tools, documentation, and code review agents for building and maintaining IM integrations.

## Features

### Skills

Invoke via `/pricefx-integration:<skill-name>`:

| Skill | Description |
|-------|-------------|
| `generate-import-integration` | Generate import routes, mappers, and config for any object type (P, PX, CX, DS, C) with smart auto-mapping from CSV |
| `generate-export-integration` | Generate export routes, mappers, filters with delta sync support and automatic field selection from metadata |
| `generate-from-requirement` | Read a requirement doc and generate the complete integration without interactive questions |
| `generate-integration-test` | Generate Spock integration tests for routes |
| `new-integration-wizard` | Interactive step-by-step wizard for defining new integrations |
| `list-pricefx-tables` | Quick metadata lookup for PX, CX, DS tables using the bundled pfx CLI |

### Agents

| Agent | Description |
|-------|-------------|
| `review-integration` | Full project review — validates routes, mappers, filters, checks connections, naming, performance, and cross-file consistency |
| `migrate-integration` | Automatically refactors legacy patterns to modern best practices (split+tokenize → loaddataFile, pfx-sftp → file, etc.) |
| `debug-integration` | Diagnoses route failures and errors — analyzes logs, cross-references routes/mappers/filters, and verifies partition metadata |
| `impact-analysis` | Analyzes the impact of field, table, or config changes across all routes, mappers, and filters |
| `document-integration` | Reverse-engineers existing routes into structured requirement docs |
| `generate-test-data` | Generates realistic CSV test data based on partition metadata and route mapper definitions |

### Bundled Tools

The `pfx` CLI (`tools/bin/pfx.mjs`) is bundled with the plugin and provides direct access to Pricefx partition metadata:

- List and inspect Product Extension (PX), Customer Extension (CX), and Data Source (DS) tables
- Fetch field metadata and attribute labels/types
- Create new extension tables and set attribute metadata
- Fetch sample data with flexible output formats
- Test connection to Pricefx partition

Requires a `.env` file in the project root with `PFX_URL`, `PFX_PARTITION`, `PFX_USERNAME`, `PFX_PASSWORD`.

### Shared Documentation

Reference docs loaded into context for all skills via `CLAUDE.md`:

- **routes.md** — XML route patterns, scheduler URIs, file/SFTP/REST targets
- **components.md** — All `pfx-*` component parameters
- **mappers.md** — Field mapping, converters, mapper types
- **filters.md** — Filter operators, logic, delta sync patterns
- **connections.md** — Connection types, best practices (SFTP, PriceFx naming)
- **configuration.md** — Properties, deployment, scheduling
- **project.md** — IM project structure and conventions

Also includes `CLAUDE.md.template` for bootstrapping customer project CLAUDE.md files.

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
│   └── plugin.json          # Plugin manifest
├── CLAUDE.md                # Shared doc imports for all skills
├── agents/
│   └── review-integration.md
├── skills/
│   ├── generate-export-integration/
│   ├── generate-from-requirement/
│   ├── generate-import-integration/
│   ├── generate-integration-test/
│   ├── list-pricefx-tables/
│   ├── new-integration-wizard/
│   └── list-pricefx-tables/
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
    ├── bin/pfx.mjs          # CLI entry point
    ├── lib/                  # Client, config, formatters
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
