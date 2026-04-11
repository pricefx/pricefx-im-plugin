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
| Check quality before deploy | Manual review, easy to miss issues | Run `analyze-project` → scored report with critical issues, warnings, and best-practice violations |
| Understand what a route does | Read XML, trace mapper/filter references, mentally simulate the flow | Run `document` → plain English explanation + Mermaid data flow diagram |
| Generate test data | Write CSV by hand, guess field formats and valid values | Run `generate-test-data` → realistic CSV based on your mapper and partition metadata |

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
| `analyze` | Analyze route quality, detect anti-patterns | `/analyze` or "check my route" |
| `estimate-performance` | Estimate processing time for a route | `/estimate-performance` or "how long will this take?" |
| `compare-environments` | Diff routes/mappers/filters between branches | `/compare-environments` or "what changed since develop?" |

**Documentation and testing skills:**

| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `document` | Plain English explanation + Mermaid data flow diagram | `/document` or "what does this route do?" or "visualize this route" |
| `generate-integration-test` | Spock test with WireMock | `/generate-integration-test` or "write tests for this route" |
| `simulate-dry-run` | Trace data through a route without API calls | `/simulate-dry-run` or "dry run with this CSV" |
| `list-pricefx-tables` | Browse partition metadata | `/list-pricefx-tables` or "what PX tables exist?" |

**Workflow skills:**

| Skill | What It Does | Trigger |
|-------|-------------|---------|
| `git-workflow` | Smart branching, commits, and MR preparation | `/git-workflow` or "commit my work" |

### Agents

Agents are autonomous analyzers. They scan your project, read files, and produce reports or make changes. There are 9 agents.

| Agent | What It Does | Trigger |
|-------|-------------|---------|
| `onboard-project` | Complete project assessment for new team members | "onboard this project" or "I inherited this project" |
| `analyze-project` | Health dashboard, code review, quality score, anti-pattern detection | "analyze this project" or "review my project" or "health check" |
| `debug-integration` | Diagnose route failures and errors | "my route is failing" or paste an error message |
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
