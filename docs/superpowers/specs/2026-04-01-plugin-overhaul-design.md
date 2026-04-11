# Pricefx Integration Plugin — Complete Overhaul Design

**Date:** 2026-04-01
**Goal:** Transform the plugin into a production-grade tool that partner consultants (beginners to advanced) can use to generate high-quality integrations autonomously.
**Constraint:** No customer data, passwords, or implementation-specific details may appear in any output.

## Context

Analysis of 10 real partner integration projects revealed (anonymized):
- **Project A** (290 routes) — multi-tenant, S3, Kafka, event-driven
- **Project B** (146 routes) — SFTP, REST, custom Groovy, event-driven
- **Project C** (61 routes) — Kafka dual-pipeline (file + Kafka per DS)
- **Project D** (51 routes) — SOAP/ERP, FreeMarker, scheduling
- **Project E** (43 routes) — Quartz exports, incremental sync, streaming
- **Project F** (39 routes) — Event-driven, middleware integration, audit journaling
- **Project G** (24 routes) — Post-import CFS triggers, file zipping
- **Project H** (20 routes) — SAP + Azure FileShare, seda queues, IM 7.0.1
- **Project I** (9 routes) — AWS S3 bridge, multicast exports
- **Project J** (3 routes) — Simple PX import, truncate-before-load

Key findings:
- Common patterns (CSV/SFTP, split/tokenize, streaming) used everywhere but current plugin docs/skills only partially cover them
- Advanced patterns (Kafka, SOAP, S3, multi-tenant, scheduling) not covered at all
- Anti-patterns widespread: copy-paste Groovy, inline scripts, missing error handling, inconsistent naming
- Skills generate simplified code that doesn't match production reality

## Target Users

Partner consultants building Pricefx integrations. Mixed technical level — some experienced with Camel/IM, many are not. Plugin must guide beginners while not slowing down experts.

## Content Location Strategy

Split between two repos:

**IM repo (`integration-manager/docs/`)** — product knowledge, available to everyone:
- Pattern catalog (`docs/patterns/`)
- Docs revisions and new docs (`docs/`)
- Troubleshooting, anti-patterns, best practices

**Plugin repo (`pricefx-im-plugin/`)** — plugin-specific, for Claude Code users:
- Skills (generation logic, wizard flows)
- Quality gates (embedded in skills + review agent)
- Plugin docs reference IM docs, no duplication

## Architecture

Five workstreams, each building on the previous:

```
Pattern Catalog (IM repo: docs/patterns/)
       |
       v
Docs Revise (IM repo: docs/*.md)  <--- references patterns
       |
       v
Skills Revise (plugin: skills/*)  <--- references IM docs + patterns
       |
       v
New Skills (plugin: skills/*)     <--- references IM docs + patterns
       |
       v
Quality Gates (plugin)            <--- embedded in skills + review agent
```

---

## 1. Pattern Catalog (IM repo: `docs/patterns/`)

Structured catalog of anonymized, generalized patterns extracted from partner projects. Each pattern file contains:
- **When to use** (use case description)
- **XML template** (generic, no customer data)
- **Required properties**
- **Common mistakes** (anti-patterns seen in practice)

### Pattern files:

| File | Description | Derived from |
|---|---|---|
| `import-csv-sftp.md` | Standard CSV import from SFTP with streaming, archive/error folders | All projects |
| `import-dmds-split-tokenize.md` | PA Data Source import with split, tokenize, loaddata, flush | Syscous, Dotfoods, Ahlsell |
| `import-ppv-ltv-mltv2.md` | Pricing parameter import for LTV/MLTV2/MLTV3 | Beacon, Dotfoods, Ahlsell |
| `export-quartz-scheduled.md` | Cron-triggered export with Quartz scheduler | Dotfoods, Beacon, Covetrus, Ford |
| `export-incremental-timestamp.md` | Delta export using pfx-config timestamp tracking | Dotfoods, Covetrus, Fiskars |
| `event-driven-routes.md` | Routes triggered by Pricefx events (data load, calc complete, custom) | Cargill, Fiskars, Ahlsell, Watsco |
| `kafka-dual-pipeline.md` | Parallel file + Kafka pipelines for same data source | Syscous |
| `soap-outbound.md` | Outbound SOAP calls with FreeMarker templates | Ahlsell |
| `rest-outbound.md` | Outbound REST API calls with auth, retry, response mapping | Cargill, Fiskars |
| `s3-integration.md` | AWS S3 read/write and S3-to-SFTP bridging | Covetrus, Watsco |
| `multi-tenant-partitions.md` | Partition-aware routing with shared handlers | Watsco |
| `chained-routes-direct.md` | Multi-step orchestration using direct: endpoints | Ford, Fiskars, Cargill |
| `error-handling.md` | Redelivery policies, onException, archive/error folders, email notifications | All projects |
| `scheduling-start-stop.md` | Start/stop routes for long-running jobs with time windows | Ahlsell |
| `post-load-cfs-flush.md` | onCompletion chains: CFS triggers, DMDS flush, status updates | Beacon, Ahlsell, Dotfoods |
| `groovy-best-practices.md` | When to use inline vs. bean, max complexity, reusable snippets | Anti-patterns from all |
| `file-archive-pattern.md` | File lifecycle: pickup, process, archive by date, error folder | Ford, Ruukki, Dotfoods |
| `naming-conventions.md` | Route IDs, mapper IDs, filter IDs, property keys — consistent naming | Best-of from all |

**Total: 18 pattern files**

---

## 2. Docs Revisions (IM repo: `docs/`)

### Updates to existing files:

| File | What to add |
|---|---|
| `routes.md` | Streaming patterns, split/tokenize batch sizes (5K-200K by object type), onCompletion chaining, multicast for parallel loads |
| `mappers.md` | Converter best practices (decimal, date), groovy expressions in mappers, skipInvalidRecords, convertEmptyStringToNull |
| `filters.md` | Truncate filters, date-range filters, composite AND/OR logic, fetchLatest pattern |
| `components.md` | pfx-config for timestamp tracking, pfx-event consumer patterns, seda queues, pfx-io:streamCompressedFile |
| `connections.md` | S3 connection config, Kafka connection config, SOAP endpoint config, Azure FileShare |
| `configuration.md` | Multi-environment properties, scheduling cron patterns, batch size tuning guidelines, timezone handling |
| `project.md` | Naming conventions reference, directory organization best practices, .properties file structure |

### New files:

| File | Content |
|---|---|
| `advanced-patterns.md` | Orchestration, chaining, multi-step workflows — cross-references pattern catalog |
| `troubleshooting.md` | Common errors and solutions: wrong batch sizes, missing flush, permission errors, trust store issues, encoding problems |
| `anti-patterns.md` | What NOT to do: inline Groovy copy-paste, hardcoded values, missing error handling, oversized routes, missing streaming |

**Total: 7 updates + 3 new files**

---

## 3. Skills Revisions (Plugin repo)

### Updates to existing skills:

| Skill | Changes |
|---|---|
| `generate-import-integration` | Default to streaming unmarshal, batch size guidance by object type (P/C: 20K, DS: 50K, PPV: 5K), archive/error folder pattern always included, onCompletion CFS/flush chain, reusable Groovy templates instead of copy-paste |
| `generate-export-integration` | Incremental timestamp tracking via pfx-config get/set, Quartz cron best practices with timezone, file archive with timestamp naming, multicast for parallel outputs |
| `generate-pa-import-integration` | Validate split/tokenize sizing, add scheduling start/stop pattern for long DS loads, proper flush sequencing |
| `generate-ppv-import-integration` | Add MLTV3 support, truncate-before-load pattern, batch size validation |
| `generate-event-driven-route` | Add seda queue pattern for concurrent processing, chained event-to-direct route pattern, multi-event listener support |
| `generate-integration-test` | Expand test scenarios: error handling, empty file, malformed CSV, large batch, missing properties |
| `generate-from-requirement` | Recognize advanced patterns in requirements, select correct pattern from catalog, generate matching route complexity |
| `new-integration-wizard` | Add questions for: scheduling needs, event-driven triggers, multi-tenant requirements, external system type (SOAP/REST/S3/Kafka), error handling preferences |

**Total: 8 skill updates**

---

## 4. New Skills (Plugin repo)

| Skill | What it generates | Priority |
|---|---|---|
| `generate-kafka-integration` | Kafka consumer routes with aggregation, dual-pipeline (file + Kafka), topic configuration, error handling with throttling | Medium |
| `generate-soap-integration` | Outbound SOAP routes with FreeMarker payload templates, response parsing, WSDL-driven field mapping | Medium |
| `generate-rest-outbound-integration` | REST API outbound calls (POST/PUT/PATCH), authentication (Basic/OAuth/API key), retry policies, response mapping back to Pricefx | High |
| `generate-s3-integration` | AWS S3 read/write routes, S3-to-SFTP bridge, bucket/prefix configuration | Low |
| `generate-scheduling-route` | Quartz scheduler setup with start/stop time windows, timezone handling, cron expression helper | High |
| `generate-multi-tenant-route` | Partition-aware routing with shared handler routes, per-tenant property configuration, partition discovery | Low |

**Total: 6 new skills**

---

## 5. Quality Gates (Plugin repo)

### In generation skills (embedded validation):

- Warn when inline Groovy exceeds 15 lines — suggest bean extraction
- Validate batch size vs. object type (P/C: 20K, DS: 50K, PPV: 5K)
- Ensure every import route has error folder + archive folder configuration
- Ensure DMDS routes include flush at the end
- Validate naming conventions (consistent prefixes, no mixed styles)
- Check that streaming is enabled for large datasets
- Verify properties are externalized (no hardcoded URIs, credentials, paths)

### In review agent (`review-integration`):

- Detect copy-paste Groovy blocks across routes
- Flag missing error handling (no doCatch/onException)
- Flag hardcoded values that should be in properties
- Flag missing streaming on large dataset routes
- Flag inconsistent naming across routes/mappers/filters
- Flag oversized route files (>200 lines) — suggest decomposition
- Flag missing filters where they're expected (truncate for full-load, date-range for incremental)

---

## Deliverables Summary

### IM repo (`integration-manager/docs/`)

| Workstream | Count | New/Updated |
|---|---|---|
| Pattern catalog | 18 files | New |
| Docs updates | 7 files | Updated |
| Docs new | 3 files | New |

### Plugin repo (`pricefx-im-plugin/`)

| Workstream | Count | New/Updated |
|---|---|---|
| Skills updates | 8 skills | Updated |
| Skills new | 6 skills | New |
| Quality gates | Embedded in skills + review agent | Updated |

**Total: 42 deliverables across 2 repos**

## Security Constraint

All pattern files, docs, skills, and generated code MUST:
- Contain NO customer names, partition names, or project identifiers
- Contain NO passwords, API keys, connection strings, or credentials
- Contain NO customer-specific business logic, field names, or data structures
- Use only generic placeholder names (e.g., `myProduct`, `myCustomer`, `acme-partition`)
- Reference patterns by type, not by customer origin
