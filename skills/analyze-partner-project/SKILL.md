---
name: analyze-partner-project
description: Analyze a Pricefx Integration Manager project — scan routes, mappers, filters, detect patterns and anti-patterns, produce a structured summary with improvement recommendations. Use when the user says "analyze", "review project", "scan integration", or points at a pim-* directory.
---

# Analyze Partner Project

You are analyzing a Pricefx Integration Manager partner project. Scan the project structure, categorize all artifacts, detect patterns and anti-patterns, and produce a structured report displayed to the user.

If the user points at a specific directory, use that as the target project directory. Otherwise ask: **Which project directory should I analyze?** (look for `pim-*` directories or a `src/main/resources/repo/` structure).

## Step 1: Locate Project Root

Identify the project root: it contains `src/main/resources/repo/` with subdirectories such as `routes/`, `mappers/`, `filters/`, `connections/`, `config/`.

Read `src/main/resources/repo/config/application.properties` (if present) for the partition URL and environment name to include in the report header.

## Step 2: Scan and Count Artifacts

Run the following counts (use Glob/Bash):

| Artifact | Path pattern |
|---|---|
| Routes | `src/main/resources/repo/routes/**/*.xml` |
| Mappers | `src/main/resources/repo/mappers/**/*.xml` |
| Filters | `src/main/resources/repo/filters/**/*.xml` |
| Connections | `src/main/resources/repo/connections/**/*.xml` |
| Config files | `src/main/resources/repo/config/**/*.properties` |
| Groovy beans | `src/main/groovy/**/*.groovy` or `src/main/java/**/*.java` |

## Step 3: Categorize Routes by Type

Read each route file. Classify by the `from` URI and route ID pattern:

| Type | Detection rule |
|---|---|
| **Import** | `pfx-api:loaddataFile` or `pfx-api:loaddata` in route, or route ID contains `import` |
| **Export** | `pfx-api:fetch` or `pfx-api:fetchStream` or route ID contains `export` |
| **Event-driven** | `from uri="pfx-event:` or route ID contains `event` or `on-` |
| **Utility/chained** | `from uri="direct:` or `from uri="timer:` without import/export pattern |
| **Scheduled** | `quartz:` or `cron:` in `from` URI |

Build a list: for each route, record its ID, file name, type, and object type (see Step 4).

## Step 4: Identify Object Types

For each import/export route, detect the Pricefx object type from the `objectType=` parameter or the mapper `<constant expression="..." out="name"/>`:

- `P` — Product Master
- `PX` — Product Extension
- `C` — Customer Master
- `CX` — Customer Extension
- `SL` — Seller Master
- `SX` — Seller Extension
- `DS` / `DMDS` — PA Data Source
- `PPV` / `LTV` / `MLTV2` — Pricing Parameters

## Step 5: Identify Data Sources

For each route, inspect the `from` URI to classify the inbound data source:

| Data Source | Detection |
|---|---|
| CSV / SFTP-mounted file | `file://` in `from` URI |
| SFTP (external) | `pfx-sftp://` in `from` URI |
| REST API | `pfx-rest:` as `<to>` step |
| JDBC / Database | `pfx-sql:` as `<to>` step |
| Kafka | `pfx-kafka:` or `kafka:` in `from` URI |
| S3 | `aws2-s3:` or `pfx-s3:` in `from` URI |
| SOAP | `pfx-cxf:` or `cxf:` |
| Timer / internal | `timer:` or `quartz:` only |

## Step 6: Detect Patterns Used

Scan route XML files for these patterns and note which routes use them:

| Pattern | Detection |
|---|---|
| Streaming split | `<split streaming="true">` or `pfx-csv:streamingUnmarshal` |
| Tokenize split | `<tokenize token="\n"` |
| Quartz scheduling | `quartz:` in `from` URI |
| Event-driven | `pfx-event:` in `from` URI |
| Chained routes | `direct:` endpoints used as `<to>` steps |
| onCompletion | `<onCompletion>` element present |
| loaddataFile | `pfx-api:loaddataFile` |
| DMDS flush | `pfx-api:flush` |
| Error folder | `moveFailed=` on file URI or `{{error.file}}` |
| Archive folder | `move=.archive` or `{{archive.file}}` |

## Step 7: Anti-Pattern Detection

Check each route file against all 10 anti-patterns. For each one found, record the route file and a brief description.

**AP-1: Copy-paste Groovy** — Find `<groovy>` or `<script language="groovy">` blocks. If 3+ routes contain near-identical Groovy blocks (e.g., API settings parsers), flag as copy-paste. Compare first 100 chars of each block.

**AP-2: Inline Groovy over 15 lines** — Count lines inside each `<groovy>` or `<script language="groovy">` element. Flag any block exceeding 15 lines.

**AP-3: Hardcoded values** — Look for hardcoded IP addresses, hostnames, passwords, or numeric batch sizes/cron expressions NOT wrapped in `{{...}}` placeholders. Flag routes where literals appear in `uri=`, `<tokenize group=`, `<quartz>` expressions.

**AP-4: Missing error handling** — For file-based routes (`from uri="file://`), check that `moveFailed=` or `{{error.file}}` is present AND that `<doCatch>` or `<onException>` exists somewhere in the route or in a shared error handler file. Flag routes with neither.

**AP-5: Missing streaming on large files** — For routes using `<split>` with CSV data (not `loaddataFile`), check `streaming="true"` is set. Flag splits without it.

**AP-6: Flush before all batches complete** — For DMDS routes using `pfx-api:flush`, check if it appears inside a `<split>...</split>` block. Flag if so.

**AP-7: Oversized route files** — Count lines in each route XML. Flag files with more than 200 lines.

**AP-8: No archive/audit trail** — For file-based routes, check that `move=` (archive) is configured on the file URI or `{{archive.file}}` is referenced. Flag routes without it.

**AP-9: CFS triggered per batch** — Look for `pfx-api:execute` or `pfx-api:cfsRun` inside a `<split>` block. Flag if found.

**AP-10: Inconsistent naming** — Check all route IDs and file names. Flag if naming style is mixed (some kebab-case, some camelCase, some PascalCase across the same project).

## Step 8: Produce Report

Output the report directly to the user (NOT saved to a file). Use this structure:

**Header:** Project name, partition URL (from `application.properties`), analysis date.

**Summary table:** Routes / Mappers / Filters / Connections / Groovy beans — one row each with count.

**Routes by Type table:** columns — Type | Count | Route IDs. Rows: Import, Export, Event-driven, Scheduled, Utility/chained.

**Object Types table:** columns — Object Type | Routes. One row per type found (P, PX, C, CX, SL, SX, DS/DMDS, PPV).

**Data Sources table:** columns — Source | Routes. One row per source type found.

**Patterns Detected table:** columns — Pattern | Used? | Where. Use YES / NO / PARTIAL. Rows: Streaming split, loaddataFile, Tokenize split, Quartz scheduling, Event-driven, Chained routes (direct:), onCompletion, DMDS flush, Error folder, Archive folder.

**Anti-Pattern Report table:** columns — # | Anti-Pattern | Status | Affected Files. Status: FOUND / CLEAN. One row per AP-1 through AP-10. For FOUND, list affected file names and a brief note (e.g., "32-line Groovy block").

**Recommendations:** 3–7 bullet points, prioritized by risk. Each must name the specific file, state the risk (data loss / memory / maintainability), and give the concrete fix. Order: data-loss risks first (AP-4, AP-5, AP-6, AP-8, AP-9), then performance, then maintainability.

**Overall Health Score:** One of:
- **GOOD** — 0–2 anti-patterns, all critical patterns present
- **FAIR** — 3–5 anti-patterns, or missing streaming/error handling
- **NEEDS ATTENTION** — 6+ anti-patterns, or any data-loss risk found

After the report, ask: **Would you like me to fix any of these issues?** If yes, start with the highest-priority item.
