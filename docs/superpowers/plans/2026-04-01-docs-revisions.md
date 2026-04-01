# Docs Revisions Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update 7 existing docs and create 3 new docs in the IM repo, filling gaps identified from partner project analysis. References pattern catalog created in Plan A.

**Architecture:** Append new sections to existing files (don't rewrite what's already there). New files follow existing doc style. Cross-reference `docs/patterns/` where appropriate.

**Tech Stack:** Markdown documentation. Target repo: `/Users/mnagas/Documents/pricefx/integration-manager` on branch `feature/PFIMCORE-2941`.

**Working directory:** `/Users/mnagas/Documents/pricefx/integration-manager`

---

### Task 1: Update routes.md — streaming, batch sizing, onCompletion, multicast

**Files:**
- Modify: `docs/routes.md` (394 lines)

- [ ] **Step 1: Read current file and append new sections at the end (before any existing "Common Pitfalls" section if present)**

Append these sections to `docs/routes.md`:

~~~markdown
## Streaming Patterns

### streamCompressedFile

Handle gzip/zip compressed files transparently:

```xml
<to uri="pfx-io:streamCompressedFile"/>
```

Place this immediately after `<from>` and before CSV unmarshal. Supports `.gz`, `.zip`, and plain files (auto-detected).

### Streaming Unmarshal

For large files, always enable streaming on the split:

```xml
<split aggregationStrategy="recordsCountAggregation" streaming="true">
  <tokenize group="20000" token="\n"/>
  <toD uri="pfx-csv:unmarshal?{{pfx:csv.settings}}&amp;skipHeaderRecord=true"/>
  <toD uri="pfx-api:loaddata?..."/>
  <setBody><constant/></setBody>
</split>
```

Without `streaming="true"`, the entire file is loaded into memory before splitting.

### Batch Size Tuning

The `group` attribute on `<tokenize>` controls how many lines are sent per batch:

| Object Type | Recommended Batch Size | Rationale |
|---|---|---|
| P, C, SL (master data) | 20,000 | Balanced throughput/memory |
| PX, CX, SX (extensions) | 20,000 | Same as master |
| DS/DMDS (data sources) | 40,000-50,000 | Simple records, high volume |
| PPV (LTV/MLTV2/MLTV3) | 5,000-10,000 | Heavier records |

Tune based on environment: reduce for memory-constrained instances, increase for high-throughput.

## onCompletion Chaining

Execute actions after a route completes successfully:

```xml
<route id="import-products">
  <from uri="..."/>

  <onCompletion onCompleteOnly="true">
    <!-- Trigger CFS calculation after successful import -->
    <toD uri="pfx-api:executeCalculation?calculationName={{pfx:cfs.name}}&amp;connection={{pfx:connection}}"/>
  </onCompletion>

  <!-- ... import logic ... -->
</route>
```

- `onCompleteOnly="true"` — only fires on success (not on failure)
- Use for: CFS triggers, DMDS flush, notifications, cleanup
- See [Post-Load CFS/Flush Pattern](patterns/post-load-cfs-flush.md) for detailed examples

## Multicast (Parallel Processing)

Load multiple object types from a single file simultaneously:

```xml
<multicast parallelProcessing="true">
  <to uri="direct:load-products"/>
  <to uri="direct:load-product-extensions"/>
</multicast>
```

Use when a single CSV file feeds both P and PX (or C and CX). Each branch gets a copy of the exchange.
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/routes.md
git commit -m "docs: add streaming, batch sizing, onCompletion, multicast to routes.md"
```

---

### Task 2: Update mappers.md — converter practices, groovy expressions

**Files:**
- Modify: `docs/mappers.md` (171 lines)

- [ ] **Step 1: Append new sections to docs/mappers.md**

~~~markdown
## Converter Best Practices

### When to Use converterExpression vs. Groovy

| Scenario | Use | Example |
|---|---|---|
| Standard type conversion | `converterExpression` | `stringToDecimal(us)` |
| Locale-specific parsing | `converterExpression` with locale | `stringToDate(yyyy-MM-dd)` |
| Conditional logic | `groovy` expression | `body.field == '99999999' ? '99991231' : body.field` |
| Header/property access | `groovy` expression | `headers.countryCode` |
| Chained transformations | `groovy` expression | `body.field?.trim()?.toUpperCase()` |

Prefer `converterExpression` when a built-in converter exists. Only use Groovy for logic that converters can't handle.

### Decimal Handling by Locale

```xml
<!-- US format: 1,234.56 -->
<body converterExpression="stringToDecimal(us)" in="Price" out="attribute1"/>

<!-- German format: 1.234,56 -->
<body converterExpression="stringToDecimal(de)" in="Preis" out="attribute1"/>
```

Always specify the locale explicitly. The default locale depends on the JVM and may differ between environments.

### Date Handling

```xml
<!-- ISO format -->
<body converterExpression="stringToDate(yyyy-MM-dd)" in="StartDate" out="attribute2"/>

<!-- US format -->
<body converterExpression="stringToDate(MM/dd/yyyy)" in="StartDate" out="attribute2"/>

<!-- Conditional date with Groovy -->
<groovy expression="body.EndDate == '99999999' ? '9999-12-31' : body.EndDate"
        converterExpression="stringToDate(yyyy-MM-dd)" out="attribute3"/>
```

### skipInvalidRecords Behavior

```xml
<loadMapper id="myMapper" skipInvalidRecords="true" convertEmptyStringToNull="true">
```

When `skipInvalidRecords="true"`:
- Records that fail converter parsing are silently skipped (not loaded)
- A warning is logged per skipped record
- Useful for dirty data where a few bad records shouldn't block the whole import
- **Risk**: silently losing data — monitor `PfxTotalInputRecordsCount` vs. expected count

When `convertEmptyStringToNull="true"`:
- Empty strings `""` become `null` in the Pricefx object
- Without this, empty strings may overwrite existing values with blanks
- Recommended default: `true` for most import scenarios
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/mappers.md
git commit -m "docs: add converter best practices, date/decimal handling to mappers.md"
```

---

### Task 3: Update filters.md — truncate, date-range, composite, fetchLatest

**Files:**
- Modify: `docs/filters.md` (290 lines)

- [ ] **Step 1: Append new sections to docs/filters.md**

~~~markdown
## Truncate Filter Pattern

Delete old records before a full-refresh load. Commonly used with PPV parameters and DMDS data sources.

```xml
<filter id="truncateByNameFilter" resultFields="name">
  <and>
    <criterion fieldName="name" operator="equals" value="simple:headers.entityName"/>
  </and>
</filter>
```

Usage in route:
```xml
<toD uri="pfx-api:delete?objectType=${headers.objectType}&amp;filter=truncateByNameFilter&amp;connection={{pfx:connection}}"/>
```

### Truncate Flushed Records

After a DMDS flush, clean up the data feed:

```xml
<filter id="truncateFlushedFilter" resultFields="name">
  <and>
    <criterion fieldName="formulaResult" operator="equals" value="OK"/>
  </and>
</filter>
```

## Date-Range Filters

### Fixed Time Window

```xml
<filter id="dateRangeFilter">
  <and>
    <criterion fieldName="lastUpdateDate" operator="greaterOrEqual" value="simple:headers.startTimestamp"/>
    <criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:headers.endTimestamp"/>
  </and>
</filter>
```

### Relative: Last N Days

Set the header dynamically in the route, then reference it:
```xml
<setHeader name="cutoffDate">
  <groovy>
    import java.time.LocalDate
    LocalDate.now().minusDays(60).toString()
  </groovy>
</setHeader>
```

```xml
<filter id="deleteOlderThan60Days">
  <and>
    <criterion fieldName="lastUpdateDate" operator="lessThan" value="simple:headers.cutoffDate"/>
  </and>
</filter>
```

## Composite Filter Nesting

### AND + OR Combination

```xml
<filter id="activeApprovedFilter">
  <and>
    <criterion fieldName="attribute4" operator="equals" value="Approved"/>
    <or>
      <criterion fieldName="attribute1" operator="equals" value="TypeA"/>
      <criterion fieldName="attribute1" operator="equals" value="TypeB"/>
    </or>
  </and>
</filter>
```

### NOT (Exclusion)

```xml
<filter id="excludeDeletedFilter">
  <and>
    <not>
      <criterion fieldName="attribute5" operator="equals" value="DELETED"/>
    </not>
    <criterion fieldName="lastUpdateDate" operator="greaterOrEqual" value="simple:headers.startTimestamp"/>
  </and>
</filter>
```

## FetchLatest Pattern

Fetch only the most recently updated record per key:

```xml
<filter id="fetchLatestByKeyFilter" resultFields="key1,attribute1,attribute2,lastUpdateDate">
  <and>
    <criterion fieldName="lastUpdateDate" operator="greaterOrEqual" value="simple:headers.lastExportTimestamp"/>
    <criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:headers.currentTimestamp"/>
  </and>
</filter>
```

Combine with `sortBy=lastUpdateDate` on the fetch to get records in chronological order. See [Incremental Timestamp Export Pattern](patterns/export-incremental-timestamp.md).
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/filters.md
git commit -m "docs: add truncate, date-range, composite, fetchLatest filters"
```

---

### Task 4: Update connections.md — S3, Kafka, SOAP

**Files:**
- Modify: `docs/connections.md` (156 lines)

- [ ] **Step 1: Append new connection types to docs/connections.md**

~~~markdown
## AWS S3 Connection

S3 connections are configured via application.properties (not the connections JSON format):

```properties
# AWS S3 credentials
s3.accessKey=AKIA...
s3.secretKey={ENC}...encryptedValue...
s3.region=eu-west-1
s3.bucket.name=my-integration-bucket

# Composite S3 consumer settings
pfx:s3.inbound.common=region={{s3.region}}&accessKey={{s3.accessKey}}&deleteAfterRead=false&moveAfterRead=true&destinationBucket={{s3.bucket.name}}&destinationBucketPrefix=archive/&maxMessagesPerPoll=1
```

Usage in route:
```xml
<from uri="aws2-s3://{{s3.bucket.name}}?prefix=inbound/&amp;{{pfx:s3.inbound.common}}&amp;secretKey=RAW({{s3.secretKey}})"/>
```

Note: `secretKey` must be wrapped in `RAW(...)` to prevent Camel URI parsing issues with special characters.

See [S3 Integration Pattern](patterns/s3-integration.md) for complete examples.

## Kafka Connection

Kafka connections use application.properties with composite parameter blocks:

```properties
# Kafka broker
pfx:confluent.kafka.brokers=broker1:9092,broker2:9092

# Security (SASL_SSL)
pfx:general-kafka-security-parameters=securityProtocol=SASL_SSL&saslMechanism=PLAIN&saslJaasConfig=RAW(org.apache.kafka.common.security.plain.PlainLoginModule required username="{{kafka.user}}" password="{{kafka.password}}";)

# Consumer defaults
pfx:general-kafka-consumer-parameters=autoOffsetReset=earliest&autoCommitEnable=false&allowManualCommit=true&maxPollRecords=500&maxPollIntervalMs=300000
```

See [Kafka Dual Pipeline Pattern](patterns/kafka-dual-pipeline.md) for route examples.

## SOAP/Web Service Connection

SOAP endpoints are configured as simple properties:

```properties
# SOAP endpoint
soap.myService.wsUrl=https://erp.example.com/services/MyService
soap.myService.soapAction=urn:processDocument

# Optional: basic auth via environment variables
soap.myService.username={{env:SOAP_USER}}
soap.myService.password={{env:SOAP_PASSWORD}}

# Timeouts (milliseconds)
soap.myService.socketTimeout=60000
soap.myService.connectTimeout=30000
```

See [SOAP Outbound Pattern](patterns/soap-outbound.md) for route examples including FreeMarker payload generation.

## Azure FileShare Connection

Azure FileShare is accessed via REST API with shared-access credentials:

```properties
# Azure FileShare
azure.fileShare.endpoint=https://myaccount.file.core.windows.net/myshare
azure.fileShare.sasToken={ENC}...encryptedSasToken...
```

Usage typically involves HTTP calls to the Azure REST API within a REST outbound route pattern. See [REST Outbound Pattern](patterns/rest-outbound.md).
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/connections.md
git commit -m "docs: add S3, Kafka, SOAP, Azure FileShare connection types"
```

---

### Task 5: Update properties.md — batch tuning, cron, timezone, multi-env

**Files:**
- Modify: `docs/properties.md` (596 lines)

- [ ] **Step 1: Append new sections to docs/properties.md**

~~~markdown
## Batch Size Tuning

The split/tokenize batch size significantly impacts throughput and memory usage.

### Recommended Defaults

| Context | Property | Recommended | Notes |
|---|---|---|---|
| CSV import split | `tokenize group=` | 20,000 | Lines per batch |
| DS/DMDS import split | `tokenize group=` | 40,000-50,000 | Higher for simple records |
| PPV import split | `tokenize group=` | 5,000-10,000 | Lower for heavy records |
| API fetch batch | `batchSize=` on pfx-api:fetch | 5,000 | Records per API page |
| API loaddata batch | Controlled by split | N/A | Each split chunk = one API call |

### Tuning Guidelines

- **OutOfMemoryError**: Reduce batch size or enable `streaming="true"` on split
- **Slow throughput**: Increase batch size (fewer API calls = less overhead)
- **API timeout**: Reduce batch size (smaller payloads = faster processing per call)

## Scheduling and Cron

### Quartz Cron in URI

In Camel URIs, replace spaces with `+`:

```
Standard:  0 0 2 ? * MON-FRI
In URI:    0+0+2+?+*+MON-FRI
```

### Common Schedules

| Schedule | Cron Expression |
|---|---|
| Daily at 2 AM | `0+0+2+?+*+*` |
| Weekdays at 6 PM | `0+0+18+?+*+MON-FRI` |
| Every hour | `0+0+*+?+*+*` |
| Every 15 min | `0+0/15+*+?+*+*` |
| First day of month at midnight | `0+0+0+1+*+?` |

### Timezone

Always set timezone explicitly:
```
trigger.timeZone=Europe/Prague
```

Without it, the schedule uses the JVM's default timezone, which may differ between environments.

## Multi-Environment Configuration

### Profile-Based Properties

```
application.properties          # shared defaults
application-dev.properties      # dev overrides
application-qa.properties       # QA overrides
application-prod.properties     # production overrides
```

Activate via: `spring.profiles.active=prod`

### Override Precedence (highest to lowest)

1. Environment variables (`SPRING_*` or custom)
2. System properties (`-D`)
3. Profile-specific properties file
4. Default `application.properties`

### Sensitive Values

Never store plain-text credentials. Use IM encryption:

```properties
# Encrypted with IM keystore
pfx:my-connection.password={ENC}...encryptedValue...

# Or environment variable reference
pfx:my-connection.password={{env:PFX_PASSWORD}}
```
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/properties.md
git commit -m "docs: add batch tuning, cron reference, timezone, multi-env config"
```

---

### Task 6: Update project-structure.md — naming conventions, directory best practices

**Files:**
- Modify: `docs/project-structure.md` (43 lines)

- [ ] **Step 1: Append naming and organization guidance to docs/project-structure.md**

~~~markdown
## Naming Conventions

Consistent naming across all artifacts improves readability and maintainability.

### Route IDs

Use kebab-case with action prefix:

| Prefix | Use For | Example |
|---|---|---|
| `import-` | Inbound data loads | `import-products-from-sftp` |
| `export-` | Outbound data exports | `export-prices-to-sftp` |
| `event-` | Event-driven handlers | `event-PADATALOAD_COMPLETED` |

Keep Pricefx event names in UPPER_CASE: `event-ITEM_APPROVED_PL`

### Mapper Files

Pattern: `[entity][ObjectType]Mapper.mapper.xml`

Examples: `productPMapper.mapper.xml`, `customerDetailsCXMapper.mapper.xml`

### Filter Files

Pattern: `[purpose][Entity]Filter.filter.xml`

Examples: `truncateFlushedFilter.filter.xml`, `dateRangeFilter.filter.xml`

### Property Keys

Pattern: `pfx:[routeId].[category].[name]`

Examples: `pfx:import-products.sftp.connection`, `pfx:export-prices.cron`

See [Naming Conventions](patterns/naming-conventions.md) for the complete reference.

## Directory Organization Best Practices

```
src/main/resources/repo/
  routes/               # One XML file per logical route group
    import-products.xml
    import-customers.xml
    export-prices.xml
    event-routes.xml
  mappers/              # One mapper per object type
    productPMapper.mapper.xml
    customerCMapper.mapper.xml
  filters/              # One filter per use case
    truncateFlushedFilter.filter.xml
    dateRangeFilter.filter.xml
  connections/          # One JSON per external system
    pricefx.json
    sftp.json
  config/               # Properties and Spring config
    application.properties
```

Keep route files focused: one file per entity or closely related group. If a file exceeds 200 lines, consider splitting into sub-routes using `direct:` endpoints.
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/project-structure.md
git commit -m "docs: add naming conventions and directory organization"
```

---

### Task 7: Create troubleshooting.md

**Files:**
- Create: `docs/troubleshooting.md`

- [ ] **Step 1: Create docs/troubleshooting.md**

~~~markdown
# Troubleshooting Guide

Common errors and solutions for Pricefx Integration Manager routes.

## Import Errors

### OutOfMemoryError during CSV import

**Cause:** File too large, missing streaming, or batch size too high.

**Fix:**
1. Enable streaming: `streaming="true"` on `<split>`
2. Reduce batch size: `<tokenize group="10000">`
3. Add `<setBody><constant/></setBody>` after loaddata (releases memory per batch)

### MalformedInputException / Encoding error

**Cause:** File encoding doesn't match configured charset.

**Fix:**
1. Check actual file encoding: `file -I filename.csv`
2. Set charset in route: `<toD uri="pfx-io:setupCharset?specifiedCharset=ISO-8859-1"/>`
3. Add doCatch to fail cleanly (see [Error Handling Pattern](patterns/error-handling.md))

### Records loaded but not visible in Pricefx

**Cause (DMDS):** Missing flush after load.

**Fix:** Add flush after split completes:
```xml
<toD uri="pfx-api:flush?dataFeedName=DMF.${headers.dsUniqueName}&amp;dataSourceName=DMDS.${headers.dsUniqueName}"/>
```

**Cause (PPV):** Wrong pricingParameterName or missing `name` constant in mapper.

### Data loaded with wrong values / all nulls

**Cause:** Mapper field names don't match CSV headers (case-sensitive).

**Fix:** Check CSV headers match `in=` attribute in mapper. Enable `skipInvalidRecords="true"` temporarily to identify which records fail.

## Export Errors

### Export runs but produces empty file

**Cause:** Timestamp tracking returns future date, or WHERE clause filters out all records.

**Fix:**
1. Check pfx-config value: `pfx-config:get?name=...`
2. Reset timestamp: `pfx-config:set?name=...&value=2020-01-01T00:00:00`
3. Test query manually in Pricefx admin

### Quartz schedule doesn't fire

**Cause:** Wrong cron syntax (spaces instead of `+` in URI) or missing timezone.

**Fix:** In URI, use `+` as separator: `cron=0+0+2+?+*+*` and always set `trigger.timeZone`.

## Connection Errors

### Trust store password error

**Cause:** Wrong `default.truststore.password` or read-only cacerts in container.

**Fix:** See PFIM-9522 — copy trust store to writable location, set `javax.net.ssl.trustStore` system property.

### SFTP connection refused / timeout

**Cause:** Firewall, wrong port, or SSH key mismatch.

**Fix:**
1. Test connectivity: `sftp user@host` from the IM container
2. Check connection JSON for correct host/port/credentials
3. Verify SSH key type is supported (RSA, ECDSA)

### Certificate deployment fails (Permission denied)

**Cause:** Container runs as non-root, can't write to $JAVA_HOME/lib/security/cacerts.

**Fix:** Copy cacerts to writable location in Dockerfile, set `-Djavax.net.ssl.trustStore`.

## Event Route Errors

### Event route never triggers

**Cause:** Event type not mapped in properties.

**Fix:** Add mapping:
```properties
integration.events.event-to-route-mapping.MY_EVENT=direct:eventMY_EVENT
```

### Event processed multiple times

**Cause:** Missing idempotency check or route restarted during processing.

**Fix:** Use event ID as idempotent key, or check for duplicate processing in handler.

## Performance Issues

### Import taking too long

1. Increase batch size (if memory allows)
2. Enable streaming if not already
3. Check if unnecessary CFS calculations triggered per-batch (should be onCompletion only)
4. Use start/stop scheduling for large overnight loads (see [Scheduling Pattern](patterns/scheduling-start-stop.md))

### API rate limiting / 429 errors

1. Reduce batch concurrency (don't use `parallelProcessing` on split)
2. Add redelivery with exponential backoff
3. Reduce batch size to decrease per-call payload
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/troubleshooting.md
git commit -m "docs: add troubleshooting guide with common errors and fixes"
```

---

### Task 8: Create anti-patterns.md

**Files:**
- Create: `docs/anti-patterns.md`

- [ ] **Step 1: Create docs/anti-patterns.md**

~~~markdown
# Anti-Patterns

Common mistakes observed in production Pricefx Integration Manager projects. Avoid these.

## 1. Copy-Paste Groovy Scripts

**Problem:** The API settings parser Groovy block is copied across every route with slight variations.

**Why it matters:** When a bug is found, it must be fixed in every copy. Different versions of the same script cause subtle differences in behavior.

**Fix:** Keep the standard parser consistent across all routes. If you need custom logic, add it after the standard parser, don't modify the parser itself.

## 2. Inline Groovy Over 15 Lines

**Problem:** Complex business logic embedded in `<groovy>` blocks inside route XML.

**Why it matters:** No IDE support, no unit tests, no stack traces, hard to debug.

**Fix:** Extract to a Java/Groovy bean:
```java
@Component("myProcessor")
public class MyProcessor {
    public void process(Exchange exchange) { ... }
}
```
```xml
<to uri="bean:myProcessor"/>
```

See [Groovy Best Practices](patterns/groovy-best-practices.md).

## 3. Hardcoded Values in Routes

**Problem:** Connection names, file paths, batch sizes, cron expressions hardcoded in XML.

**Why it matters:** Can't change per environment. Requires route redeployment for config changes.

**Fix:** Use properties:
```xml
<!-- Bad -->
<tokenize group="20000" token="\n"/>

<!-- Good -->
<tokenize group="{{pfx:batch.size}}" token="\n"/>
```

## 4. Missing Error Handling

**Problem:** No doCatch, no onException, no error folders. Route fails silently.

**Why it matters:** No one knows the integration failed until a customer reports missing data.

**Fix:** Every production route needs at minimum:
- `moveFailed` on file source (error folder)
- `doCatch` for encoding errors
- Logging at ERROR level on failure

See [Error Handling Pattern](patterns/error-handling.md).

## 5. Missing Streaming on Large Files

**Problem:** `streaming="true"` omitted on `<split>` for large CSV files.

**Why it matters:** Entire file loaded into memory → OutOfMemoryError on files >100MB.

**Fix:** Always add `streaming="true"` on split for CSV imports.

## 6. Flush Before All Batches Complete

**Problem:** DMDS flush triggered inside the split loop, not after it.

**Why it matters:** Partial data visible in PA while rest is still loading. Calculations run on incomplete data.

**Fix:** Place flush AFTER the `</split>` closing tag, or use onCompletion.

## 7. Oversized Route Files (>200 Lines)

**Problem:** Single XML file with multiple routes, complex logic, and inline scripts.

**Why it matters:** Hard to read, hard to modify, high risk of breaking unrelated routes.

**Fix:** Split into sub-routes using `direct:` endpoints. One logical operation per route. See [Chained Routes Pattern](patterns/chained-routes-direct.md).

## 8. No Archive/Audit Trail

**Problem:** Processed files deleted or left in pickup directory.

**Why it matters:** No way to reprocess failed files. No audit trail for debugging.

**Fix:** Always configure archive and error folders. See [File Archive Pattern](patterns/file-archive-pattern.md).

## 9. CFS Triggered Per Batch Instead of Per File

**Problem:** CFS calculation triggered inside the split loop (runs once per batch).

**Why it matters:** N batches = N calculation triggers. Wastes compute, may cause race conditions.

**Fix:** Use `onCompletion` to trigger CFS once after all batches complete.

## 10. Inconsistent Naming

**Problem:** Mixed naming styles: `camelCase` routes, `kebab-case` mappers, `PascalCase` filters.

**Why it matters:** Hard to find related artifacts. New team members can't predict names.

**Fix:** Follow [Naming Conventions](patterns/naming-conventions.md) consistently.
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/anti-patterns.md
git commit -m "docs: add anti-patterns guide — 10 common mistakes to avoid"
```

---

### Task 9: Create advanced-patterns.md

**Files:**
- Create: `docs/advanced-patterns.md`

- [ ] **Step 1: Create docs/advanced-patterns.md**

~~~markdown
# Advanced Integration Patterns

This guide covers complex integration scenarios that go beyond standard CSV import/export. Each pattern is documented in detail in the [Pattern Catalog](patterns/README.md).

## Multi-Step Orchestration

When an integration involves multiple sequential steps (load products, then extensions, then trigger calculation), use [chained routes via direct: endpoints](patterns/chained-routes-direct.md).

```xml
<route id="orchestrate-product-load">
  <from uri="pfx-sftp:parameters?..."/>
  <to uri="direct:load-products"/>
  <to uri="direct:load-product-extensions"/>
  <to uri="direct:trigger-cfs"/>
</route>
```

Key principles:
- Each sub-route is independently testable
- Pass data via exchange properties (not headers) across routes
- Use multicast for steps that can run in parallel

## Event-Driven Integration

React to Pricefx platform events (data load complete, calculation complete, approvals). See [Event-Driven Routes](patterns/event-driven-routes.md).

Common event chains:
1. File import completes → onCompletion triggers CFS
2. CFS completes → `CALCULATION_COMPLETED_CFS` event → trigger export
3. Export completes → notification email

## External System Integration

### REST APIs

For calling external REST endpoints (ERP, middleware), see [REST Outbound](patterns/rest-outbound.md). Key concerns:
- Authentication (OAuth 2.0, API key, Basic)
- Retry with exponential backoff
- Body preservation across auth calls
- Error classification (auth vs. network vs. business)

### SOAP Services

For legacy SOAP/XML services, see [SOAP Outbound](patterns/soap-outbound.md). Key concerns:
- FreeMarker templates for payload generation
- Shared call route (reusable across business routes)
- Application-level fault detection (HTTP 200 can still be a SOAP fault)

### AWS S3

For S3 file operations, see [S3 Integration](patterns/s3-integration.md). Key concerns:
- `RAW(...)` wrapper for secret key in consumer URI
- S3-to-SFTP bridge pattern for legacy downstream systems

### Kafka

For real-time CDC pipelines, see [Kafka Dual Pipeline](patterns/kafka-dual-pipeline.md). Key concerns:
- Manual commit (not auto-commit) for at-least-once delivery
- OPCO grouping and aggregation before Pricefx load
- Sequence-key deduplication

## Multi-Tenant Integration

Single IM instance serving multiple Pricefx partitions. See [Multi-Tenant Partitions](patterns/multi-tenant-partitions.md).

Pattern: per-partition entry routes (set partition context) → shared handler routes (business logic) → partition-specific Pricefx connection.

## Scheduling and Time Windows

For long-running imports that should only run during off-peak hours, see [Scheduling Start/Stop](patterns/scheduling-start-stop.md).

Pattern: Quartz scheduler starts/stops data routes via Camel `controlbus`. The data route has `autoStartup="false"`.

## Error Handling Strategy

Every production route needs an error strategy. See [Error Handling](patterns/error-handling.md).

| Route Type | Minimum Error Handling |
|---|---|
| File import | Archive/error folders + doCatch for encoding |
| Scheduled export | Redelivery policy + email notification |
| Event handler | Logging + dead-letter for unprocessable events |
| External API call | Redelivery + error classification + journaling |
~~~

- [ ] **Step 2: Commit**

```bash
git add docs/advanced-patterns.md
git commit -m "docs: add advanced patterns guide cross-referencing pattern catalog"
```

---

### Task 10: Final review — verify all changes, no customer data

- [ ] **Step 1: Verify all files exist**

```bash
# 7 modified + 3 new = check git diff
git diff --stat HEAD~9
```

- [ ] **Step 2: Grep for customer-specific content**

```bash
grep -ri "watsco\|ford\|ahlsell\|syscous\|dotfoods\|cargill\|beacon\|fiskars\|covetrus\|ruukki" docs/*.md
# Expected: no matches
```

- [ ] **Step 3: Verify cross-references to patterns/ are valid**

```bash
grep -oh 'patterns/[a-z-]*.md' docs/*.md | sort -u
# Each referenced file should exist in docs/patterns/
```
