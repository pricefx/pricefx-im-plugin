# Pattern Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 18 anonymized pattern files in `integration-manager/docs/patterns/` extracted from 10 partner integration projects.

**Architecture:** Each pattern file follows a standard template (When to Use, XML Template, Required Properties, Common Mistakes). All content is generic — no customer names, credentials, or business-specific logic.

**Tech Stack:** Markdown + XML templates. Target repo: `{IM_REPO}` on branch `feature/PFIMCORE-2941`.

**Working directory:** `{IM_REPO}`

---

### Task 1: Create pattern catalog directory and README

**Files:**
- Create: `docs/patterns/README.md`

- [ ] **Step 1: Create directory and index file**

```markdown
# IM Pattern Catalog

Anonymized integration patterns extracted from production Pricefx Integration Manager projects.
Each pattern contains: when to use it, a generic XML template, required properties, and common mistakes to avoid.

## Import Patterns
- [CSV/SFTP Import](import-csv-sftp.md) — Standard file-based import with streaming and archive
- [DMDS Split/Tokenize](import-dmds-split-tokenize.md) — PA Data Source import with batch processing and flush
- [PPV/LTV/MLTV2 Import](import-ppv-ltv-mltv2.md) — Pricing parameter lookup table import

## Export Patterns
- [Quartz Scheduled Export](export-quartz-scheduled.md) — Cron-triggered data export
- [Incremental Timestamp Export](export-incremental-timestamp.md) — Delta export using pfx-config tracking

## Event & Orchestration Patterns
- [Event-Driven Routes](event-driven-routes.md) — Routes triggered by Pricefx events
- [Chained Routes (direct:)](chained-routes-direct.md) — Multi-step orchestration via direct endpoints
- [Post-Load CFS/Flush](post-load-cfs-flush.md) — onCompletion chains for calculations and flush

## Error Handling & Operations
- [Error Handling](error-handling.md) — Redelivery, onException, archive/error folders
- [File Archive Pattern](file-archive-pattern.md) — File lifecycle: pickup, process, archive, error
- [Scheduling Start/Stop](scheduling-start-stop.md) — Time-windowed route activation

## Best Practices
- [Groovy Best Practices](groovy-best-practices.md) — Inline vs. bean, max complexity, reusable snippets
- [Naming Conventions](naming-conventions.md) — Route, mapper, filter, and property naming standards

## Advanced Patterns
- [Kafka Dual Pipeline](kafka-dual-pipeline.md) — Parallel file + Kafka pipelines
- [SOAP Outbound](soap-outbound.md) — Outbound SOAP with FreeMarker templates
- [REST Outbound](rest-outbound.md) — REST API calls with auth and retry
- [S3 Integration](s3-integration.md) — AWS S3 read/write and bridging
- [Multi-Tenant Partitions](multi-tenant-partitions.md) — Partition-aware routing
```

- [ ] **Step 2: Commit**

```bash
git add docs/patterns/README.md
git commit -m "Add pattern catalog directory and index"
```

---

### Task 2: Import CSV/SFTP pattern

**Files:**
- Create: `docs/patterns/import-csv-sftp.md`

- [ ] **Step 1: Create import-csv-sftp.md**

```markdown
# CSV/SFTP Import Pattern

## When to Use

Standard pattern for importing data from CSV files via SFTP (or local filesystem) into Pricefx.
Covers Products (P), Product Extensions (PX), Customers (C), Customer Extensions (CX),
Sellers (SL), Seller Extensions (SX). This is the most common integration pattern.

## XML Template

~~~xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{{ENTITY}}-from-{{SOURCE}}" autoStartup="{{pfx:autoStartup}}">

    <!-- FILE SOURCE: SFTP pickup with archive/error handling -->
    <from uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}&amp;directory={{pfx:sftp.directory}}&amp;antInclude={{pfx:file.pattern}}&amp;move=.archive/${date:now:yyyyMMdd}/&amp;moveFailed=.error/${date:now:yyyyMMdd}/"/>

    <log message="[${routeId}] Received file: ${headers.CamelFileName}"/>

    <!-- Decompress if needed (gz, zip) -->
    <to uri="pfx-io:streamCompressedFile"/>

    <!-- Load CSV and API settings from properties -->
    <setHeader name="pfxCsvSettings">
      <constant>{{pfx:csv.settings}}</constant>
    </setHeader>
    <setHeader name="pfxApiSettings">
      <constant>{{pfx:api.settings}}</constant>
    </setHeader>

    <!-- Parse API settings into individual headers -->
    <script>
      <groovy><![CDATA[
        def pfxApiSettingsMap = [:]
        headers.pfxApiSettings.split('&').each { setting ->
          def parts = setting.split('=')
          def key = parts[0]
          def value = parts.size() > 1 ? parts[1] : ""
          pfxApiSettingsMap.put(key, value)
          headers.put(key, value)
        }
        def parsed = pfxApiSettingsMap
          .findAll { k, v -> k != 'entityName' }
          .collect { k, v -> k + '=' + v }
          .join('&')
        headers.put('parsedPfxApiSettings', parsed)
      ]]></groovy>
    </script>

    <!-- Charset handling -->
    <toD uri="pfx-io:setupCharset?specifiedCharset={{pfx:charset:UTF-8}}"/>

    <!-- Batch processing: split file into chunks -->
    <doTry>
      <split aggregationStrategy="recordsCountAggregation" streaming="true">
        <tokenize group="{{pfx:batch.size:20000}}" token="\n"/>

        <!-- Unmarshal CSV -->
        <toD uri="pfx-csv:unmarshal?{{pfx:csv.settings}}&amp;skipHeaderRecord=true"/>

        <!-- Load to Pricefx -->
        <toD uri="pfx-api:loaddata?${headers.parsedPfxApiSettings}mapper={{pfx:mapper}}&amp;connection={{pfx:connection}}"/>

        <setBody><constant/></setBody>
      </split>

      <doCatch>
        <exception>java.nio.charset.MalformedInputException</exception>
        <log loggingLevel="ERROR" message="[${routeId}] Encoding error in file ${headers.CamelFileName}"/>
        <throwException exceptionType="net.pricefx.integration.api.NonRecoverableException"
                        message="File encoding error — check charset setting"/>
      </doCatch>
    </doTry>

    <log message="[${routeId}] Import complete. Records: ${header.PfxTotalInputRecordsCount}"/>
  </route>
</routes>
~~~

## Required Properties

| Property | Example | Description |
|---|---|---|
| `pfx:sftp.connection` | `my-sftp` | SFTP connection name |
| `pfx:sftp.directory` | `/inbound/products` | Remote directory |
| `pfx:file.pattern` | `*.csv` | File matching pattern |
| `pfx:csv.settings` | `delimiter=,&quoteChar="` | CSV parser config |
| `pfx:api.settings` | `objectType=P&entityName=Product` | Target object config |
| `pfx:mapper` | `productMapper` | Mapper ID reference |
| `pfx:connection` | `my-partition` | Pricefx connection name |
| `pfx:batch.size` | `20000` | Records per batch (default 20000) |
| `pfx:charset` | `UTF-8` | File encoding (default UTF-8) |

## Batch Size Guidelines

| Object Type | Recommended Batch Size |
|---|---|
| P, C, SL | 20,000 |
| PX, CX, SX | 20,000 |
| PPV (LTV/MLTV2) | 5,000-10,000 |
| DS/DMDS | 40,000-50,000 |

## Common Mistakes

1. **Missing streaming="true"** on split — causes OutOfMemoryError on large files
2. **No archive/error folders** — files disappear after processing with no audit trail
3. **Hardcoded batch size** — use properties so it can be tuned per environment
4. **Copy-pasting Groovy apiSettings parser** — this block is identical across routes; keep it consistent
5. **Missing charset handling** — non-UTF-8 files silently corrupt data
6. **No doCatch for encoding errors** — route hangs instead of failing cleanly
```

- [ ] **Step 2: Commit**

```bash
git add docs/patterns/import-csv-sftp.md
git commit -m "Add CSV/SFTP import pattern"
```

---

### Task 3: File archive pattern

**Files:**
- Create: `docs/patterns/file-archive-pattern.md`

- [ ] **Step 1: Create file-archive-pattern.md**

```markdown
# File Archive Pattern

## When to Use

Every file-based import or export route that picks up or writes files. Ensures files are never
lost — successfully processed files go to archive, failures go to error folder.

## Archive Structure

~~~
/data/
  /inbound/                    # pickup directory
  /inbound/.archive/           # successful files
    /2026/01/15/
      products_20260115.csv
  /inbound/.error/             # failed files
    /2026/01/15/
      products_20260115.csv
~~~

## XML Template — SFTP Source

~~~xml
<from uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}
  &amp;directory={{pfx:sftp.directory}}
  &amp;antInclude={{pfx:file.pattern}}
  &amp;move=.archive/${date:now:yyyyMMdd}/
  &amp;moveFailed=.error/${date:now:yyyyMMdd}/
  &amp;delay={{pfx:poll.delay:10000}}"/>
~~~

## XML Template — Local File Source

~~~xml
<from uri="file:{{pfx:file.directory}}
  ?antInclude={{pfx:file.pattern}}
  &amp;move=.archive/${date:now:yyyyMMdd}/${file:name}
  &amp;moveFailed=.error/${date:now:yyyyMMdd}/${file:name}
  &amp;readLock=changed
  &amp;readLockMinAge=3000"/>
~~~

## Done File Pattern

For coordinated file delivery (producer writes .done file when data file is ready):

~~~xml
<from uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}
  &amp;directory={{pfx:sftp.directory}}
  &amp;antInclude=*.done
  &amp;move=.archive/${date:now:yyyyMMdd}/"/>

<!-- Extract actual data filename from .done filename -->
<setHeader name="dataFileName">
  <groovy>headers.CamelFileName.replace('.done', '.csv')</groovy>
</setHeader>
~~~

## Common Mistakes

1. **No moveFailed** — failed files stay in pickup directory, get reprocessed in infinite loop
2. **Flat archive directory** — thousands of files in one folder; use date subdirectories
3. **Missing readLock** — file picked up before fully written (local filesystem)
4. **No delay on polling** — hammers SFTP server; use delay=10000 (10s) minimum
```

- [ ] **Step 2: Commit**

```bash
git add docs/patterns/file-archive-pattern.md
git commit -m "Add file archive pattern"
```

---

### Task 4: DMDS split/tokenize pattern

**Files:**
- Create: `docs/patterns/import-dmds-split-tokenize.md`

- [ ] **Step 1: Create import-dmds-split-tokenize.md**

```markdown
# DMDS Split/Tokenize/LoadData/Flush Pattern

## When to Use

Importing data into PA (Price Analyser) Data Sources (DS/DMDS). These datasets are typically
large (100K-10M+ records) and require streaming batch processing followed by a flush operation
to make data available for analytics.

## XML Template

~~~xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{{DATASOURCE}}-ds" autoStartup="{{pfx:autoStartup}}">
    <from uri="{{pfx:source.endpoint}}"/>

    <log message="[${routeId}] Processing ${headers.CamelFileName}"/>
    <to uri="pfx-io:streamCompressedFile"/>

    <!-- CSV and API settings -->
    <setHeader name="pfxCsvSettings">
      <constant>{{pfx:csv.settings}}</constant>
    </setHeader>
    <setHeader name="pfxApiSettings">
      <constant>{{pfx:api.settings}}</constant>
    </setHeader>

    <!-- Parse API settings -->
    <script>
      <groovy><![CDATA[
        def pfxApiSettingsMap = [:]
        headers.pfxApiSettings.split('&').each { setting ->
          def parts = setting.split('=')
          def key = parts[0]
          def value = parts.size() > 1 ? parts[1] : ""
          pfxApiSettingsMap.put(key, value)
          headers.put(key, value)
        }
        def parsed = pfxApiSettingsMap
          .findAll { k, v -> k != 'entityName' }
          .collect { k, v -> k + '=' + v }
          .join('&')
        headers.put('parsedPfxApiSettings', parsed)
      ]]></groovy>
    </script>

    <toD uri="pfx-io:setupCharset?specifiedCharset={{pfx:charset:UTF-8}}"/>

    <!-- SPLIT/TOKENIZE/LOADDATA -->
    <doTry>
      <split aggregationStrategy="recordsCountAggregation" streaming="true">
        <tokenize group="{{pfx:batch.size:50000}}" token="\n"/>

        <log loggingLevel="DEBUG"
             message="[${routeId}][batch ${header.CamelSplitIndex}] processing"/>

        <toD uri="pfx-csv:unmarshal?{{pfx:csv.settings}}&amp;skipHeaderRecord=true"/>

        <toD uri="pfx-api:loaddata?${headers.parsedPfxApiSettings}mapper={{pfx:mapper}}&amp;connection={{pfx:connection}}"/>

        <setBody><constant/></setBody>
      </split>

      <doCatch>
        <exception>java.nio.charset.MalformedInputException</exception>
        <log loggingLevel="ERROR" message="[${routeId}] Encoding error"/>
        <throwException exceptionType="net.pricefx.integration.api.NonRecoverableException"
                        message="File encoding error"/>
      </doCatch>
    </doTry>

    <!-- FLUSH: make loaded data available -->
    <log message="[${routeId}] Flushing ${headers.dsUniqueName}"/>
    <toD uri="pfx-api:flush?dataFeedName=DMF.${headers.dsUniqueName}&amp;dataSourceName=DMDS.${headers.dsUniqueName}&amp;connection={{pfx:connection}}"/>

    <log message="[${routeId}] Complete. Records: ${header.PfxTotalInputRecordsCount}"/>
  </route>
</routes>
~~~

## Required Properties

| Property | Example | Description |
|---|---|---|
| `pfx:api.settings` | `objectType=DMDS&entityName=Transactions&dsUniqueName=Transactions` | Must include dsUniqueName |
| `pfx:batch.size` | `50000` | Larger batches for DS (40K-50K typical) |
| `pfx:mapper` | `transactionDSMapper` | DS-specific mapper |

## Flush Mechanics

- `dataFeedName` = `DMF.<dsUniqueName>` (Data Mart Feed)
- `dataSourceName` = `DMDS.<dsUniqueName>` (Data Mart Data Source)
- Flush must happen AFTER all batches are loaded
- Flush makes data visible in PA; without it, data is loaded but invisible

## Batch Size Guidelines

| Dataset Type | Recommended | Rationale |
|---|---|---|
| Transaction history | 40,000-50,000 | Large volume, simple fields |
| Master data (customer/product) | 20,000-50,000 | Medium volume |
| Agreements/pricing | 20,000 | Complex fields, more memory per record |

## Common Mistakes

1. **Missing flush** — data loads but never appears in PA dashboards
2. **Flush before all batches complete** — partial data visible, then overwritten
3. **Wrong dsUniqueName** — flush targets wrong data source; data disappears
4. **Batch size too small for DS** — unnecessary API calls; use 40K-50K for DS
5. **No streaming on split** — OutOfMemoryError on multi-million row files
```

- [ ] **Step 2: Commit**

```bash
git add docs/patterns/import-dmds-split-tokenize.md
git commit -m "Add DMDS split/tokenize/flush pattern"
```

---

### Task 5: PPV/LTV/MLTV2 import pattern

**Files:**
- Create: `docs/patterns/import-ppv-ltv-mltv2.md`

- [ ] **Step 1: Create import-ppv-ltv-mltv2.md**

```markdown
# PPV/LTV/MLTV2/MLTV3 Import Pattern

## When to Use

Importing pricing parameters (Company Parameters) — lookup tables used in pricing logic.
- **LTV** (Lookup Table Value): Single-key lookup (key1 → attributes)
- **MLTV2**: Two-key lookup (key1 + key2 → attributes)
- **MLTV3**: Three-key lookup (key1 + key2 + key3 → attributes)

## XML Template

~~~xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{{PARAMETER_NAME}}-pp" autoStartup="{{pfx:autoStartup}}">
    <from uri="{{pfx:source.endpoint}}"/>

    <log message="[${routeId}] Processing ${headers.CamelFileName}"/>
    <to uri="pfx-io:streamCompressedFile"/>

    <setHeader name="pfxCsvSettings">
      <constant>{{pfx:csv.settings}}</constant>
    </setHeader>
    <setHeader name="pfxApiSettings">
      <constant>{{pfx:api.settings}}</constant>
    </setHeader>

    <!-- Parse settings — note LTV/MLTV routing for pricingParameterName -->
    <script>
      <groovy><![CDATA[
        def pfxApiSettingsMap = [:]
        headers.pfxApiSettings.split('&').each { setting ->
          def parts = setting.split('=')
          def key = parts[0]
          def value = parts.size() > 1 ? parts[1] : ""
          pfxApiSettingsMap.put(key, value)
          headers.put(key, value)
        }
        def parsed = ""
        pfxApiSettingsMap.each { k, v ->
          if (k == 'entityName') {
            if (pfxApiSettingsMap['objectType']?.contains('LTV')) {
              parsed += 'pricingParameterName=' + v + '&'
            }
          } else {
            parsed += k + '=' + v + '&'
          }
        }
        headers.put('parsedPfxApiSettings', parsed)
      ]]></groovy>
    </script>

    <toD uri="pfx-io:setupCharset?specifiedCharset={{pfx:charset:UTF-8}}"/>

    <doTry>
      <split aggregationStrategy="recordsCountAggregation" streaming="true">
        <tokenize group="{{pfx:batch.size:5000}}" token="\n"/>
        <toD uri="pfx-csv:unmarshal?{{pfx:csv.settings}}&amp;skipHeaderRecord=true"/>
        <toD uri="pfx-api:loaddata?${headers.parsedPfxApiSettings}mapper={{pfx:mapper}}&amp;connection={{pfx:connection}}"/>
        <setBody><constant/></setBody>
      </split>

      <doCatch>
        <exception>java.nio.charset.MalformedInputException</exception>
        <log loggingLevel="ERROR" message="[${routeId}] Encoding error"/>
        <throwException exceptionType="net.pricefx.integration.api.NonRecoverableException"
                        message="File encoding error"/>
      </doCatch>
    </doTry>

    <log message="[${routeId}] Complete. Records: ${header.PfxTotalInputRecordsCount}"/>
  </route>
</routes>
~~~

## Mapper Structure for PPV

~~~xml
<!-- LTV: single key -->
<loadMapper id="myParameterPPMapper" convertEmptyStringToNull="true">
  <body in="LookupKey" out="key1"/>
  <body in="Value" out="attribute1"/>
  <body converterExpression="stringToDecimal(us)" in="Amount" out="attribute2"/>
  <constant expression="MyParameterName" out="name"/>
</loadMapper>

<!-- MLTV2: two keys -->
<loadMapper id="myMatrixPPMapper" convertEmptyStringToNull="true">
  <body in="RowKey" out="key1"/>
  <body in="ColKey" out="key2"/>
  <body converterExpression="stringToDecimal(us)" in="Price" out="attribute1"/>
  <constant expression="MyMatrixName" out="name"/>
</loadMapper>

<!-- MLTV3: three keys -->
<loadMapper id="myTripleKeyPPMapper" convertEmptyStringToNull="true">
  <body in="Key1" out="key1"/>
  <body in="Key2" out="key2"/>
  <body in="Key3" out="key3"/>
  <body converterExpression="stringToDecimal(us)" in="Value" out="attribute1"/>
  <constant expression="MyTripleKeyParam" out="name"/>
</loadMapper>
~~~

## Required Properties

| Property | Example | Description |
|---|---|---|
| `pfx:api.settings` | `objectType=MLTV2&entityName=MyMatrix` | entityName = pricing parameter name |
| `pfx:batch.size` | `5000` | Smaller batches for PPV (5K-10K) |

## Truncate-Before-Load Pattern

For full-refresh scenarios, truncate old data before loading new:

~~~xml
<!-- Before the split/load block -->
<toD uri="pfx-api:delete?objectType=${headers.objectType}&amp;filter=truncateFilter&amp;connection={{pfx:connection}}"/>
~~~

With truncate filter:
~~~xml
<filter id="truncateFilter" resultFields="name">
  <and>
    <criterion fieldName="name" operator="equals" value="simple:headers.entityName"/>
  </and>
</filter>
~~~

## Common Mistakes

1. **Missing pricingParameterName** — LTV/MLTV types require this instead of entityName in the API call
2. **Batch size too large** — PPV records are heavier; use 5K-10K, not 20K+
3. **Wrong objectType** — LTV for single-key, MLTV2 for two-key, MLTV3 for three-key
4. **Missing `name` constant in mapper** — each record must specify which parameter it belongs to
5. **No truncate for full refresh** — old stale records remain alongside new data
```

- [ ] **Step 2: Commit**

```bash
git add docs/patterns/import-ppv-ltv-mltv2.md
git commit -m "Add PPV/LTV/MLTV2/MLTV3 import pattern"
```

---

### Task 6: Export patterns (Quartz + Incremental)

**Files:**
- Create: `docs/patterns/export-quartz-scheduled.md`
- Create: `docs/patterns/export-incremental-timestamp.md`

- [ ] **Step 1: Create export-quartz-scheduled.md**

```markdown
# Quartz Scheduled Export Pattern

## When to Use

Exporting data from Pricefx on a recurring schedule (hourly, daily, weekly).
Supports export to CSV files via SFTP, S3, or local filesystem.

## XML Template

~~~xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="export-{{ENTITY}}" autoStartup="{{pfx:autoStartup}}">
    <!-- Quartz scheduler with configurable cron and timezone -->
    <from uri="quartz://pfxExport-{{ENTITY}}?cron={{pfx:export.cron}}&amp;trigger.timeZone={{pfx:export.timezone}}&amp;stateful=true"/>

    <log message="[${routeId}] Export started"/>

    <!-- Fetch data from Pricefx -->
    <toD uri="pfx-api:fetch?objectType={{pfx:objectType}}&amp;sql={{pfx:export.query}}&amp;sortBy=lastUpdateDate,id&amp;batchedMode=true&amp;batchSize={{pfx:batch.size:5000}}&amp;connection={{pfx:connection}}"/>

    <!-- Transform and marshal to CSV -->
    <split>
      <simple>${body}</simple>
      <to uri="pfx-model:transform?mapper={{pfx:export.mapper}}"/>
      <to uri="pfx-csv:marshal?{{pfx:csv.settings}}"/>

      <!-- Write to destination -->
      <toD uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}&amp;directory={{pfx:sftp.directory}}&amp;fileName={{pfx:export.filename}}_${date:now:yyyyMMddHHmmss}.csv"/>
    </split>

    <log message="[${routeId}] Export complete"/>
  </route>
</routes>
~~~

## Required Properties

| Property | Example | Description |
|---|---|---|
| `pfx:export.cron` | `0+0+2+?+*+MON-FRI` | Quartz cron (+ instead of space in URI) |
| `pfx:export.timezone` | `Europe/Prague` | Timezone for cron schedule |
| `pfx:objectType` | `DS` or `PX` or `C` | What to export |
| `pfx:export.query` | `SELECT * WHERE active = true` | Fetch filter |
| `pfx:export.mapper` | `exportMapper` | Transform mapper |
| `pfx:export.filename` | `products_export` | Output filename prefix |

## Cron Expression Examples

| Schedule | Cron Expression |
|---|---|
| Every day at 2 AM | `0+0+2+?+*+*` |
| Weekdays at 6 PM | `0+0+18+?+*+MON-FRI` |
| Every hour | `0+0+*+?+*+*` |
| Every 15 minutes | `0+0/15+*+?+*+*` |

Note: Use `+` instead of space in Quartz URI cron expressions.

## Common Mistakes

1. **Missing timezone** — defaults to server timezone, causes schedule drift
2. **stateful=false** — overlapping executions if previous export still running
3. **No sortBy** — inconsistent ordering across exports, makes diff comparison impossible
4. **Missing batchedMode** — loads entire dataset into memory; use batchedMode=true
```

- [ ] **Step 2: Create export-incremental-timestamp.md**

```markdown
# Incremental Timestamp Export Pattern

## When to Use

Exporting only records that changed since the last export. Uses pfx-config to persist
the last export timestamp between runs. Combines with Quartz scheduling.

## XML Template

~~~xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="export-{{ENTITY}}-incremental" autoStartup="{{pfx:autoStartup}}">
    <from uri="quartz://pfxExport-{{ENTITY}}?cron={{pfx:export.cron}}&amp;trigger.timeZone={{pfx:export.timezone}}&amp;stateful=true"/>

    <!-- Capture current timestamp -->
    <setHeader name="interfaceStartTimestamp">
      <groovy>new Date().format("yyyy-MM-dd'T'HH:mm:ss", TimeZone.getTimeZone('UTC'))</groovy>
    </setHeader>

    <!-- Retrieve last export timestamp from Pricefx config -->
    <toD uri="pfx-config:get?name={{pfx:config.prefix}}.${routeId}.lastExport&amp;connection={{pfx:connection}}"/>

    <!-- Build incremental WHERE clause -->
    <choice>
      <when>
        <simple>${body} == null || ${body} == ''</simple>
        <!-- First run: export everything up to now -->
        <setHeader name="whereClause">
          <groovy>'WHERE lastUpdateDate &lt;= \'' + headers.interfaceStartTimestamp + '\''</groovy>
        </setHeader>
      </when>
      <otherwise>
        <!-- Subsequent runs: only changes since last export -->
        <setHeader name="whereClause">
          <groovy>'WHERE lastUpdateDate &gt; \'' + body + '\' AND lastUpdateDate &lt;= \'' + headers.interfaceStartTimestamp + '\''</groovy>
        </setHeader>
      </otherwise>
    </choice>

    <!-- Fetch changed records -->
    <toD uri="pfx-api:fetch?objectType={{pfx:objectType}}&amp;sql=SELECT * ${headers.whereClause}&amp;sortBy=lastUpdateDate,id&amp;batchedMode=true&amp;batchSize={{pfx:batch.size:5000}}&amp;connection={{pfx:connection}}"/>

    <!-- Transform, marshal, write -->
    <split>
      <simple>${body}</simple>
      <to uri="pfx-model:transform?mapper={{pfx:export.mapper}}"/>
      <to uri="pfx-csv:marshal?{{pfx:csv.settings}}"/>
      <toD uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}&amp;directory={{pfx:sftp.directory}}&amp;fileName={{pfx:export.filename}}_${date:now:yyyyMMddHHmmss}.csv"/>
    </split>

    <!-- Persist timestamp for next run -->
    <toD uri="pfx-config:set?name={{pfx:config.prefix}}.${routeId}.lastExport&amp;value=${headers.interfaceStartTimestamp}&amp;connection={{pfx:connection}}"/>

    <log message="[${routeId}] Incremental export complete"/>
  </route>
</routes>
~~~

## How Timestamp Tracking Works

1. Route starts → captures `interfaceStartTimestamp` (current UTC time)
2. Reads previous timestamp from `pfx-config:get`
3. Fetches records WHERE `lastUpdateDate > previous AND <= current`
4. After successful export → saves current timestamp via `pfx-config:set`
5. Next run reads this saved timestamp as the new "previous"

The config key format: `{{prefix}}.${routeId}.lastExport`

## Common Mistakes

1. **Saving timestamp before export completes** — if export fails, gap in data
2. **Not using UTC** — timezone mismatches between Pricefx and IM cause missed records
3. **Missing first-run handling** — null timestamp must default to "export everything"
4. **No sortBy on fetch** — without ordering, pagination can skip records
```

- [ ] **Step 3: Commit**

```bash
git add docs/patterns/export-quartz-scheduled.md docs/patterns/export-incremental-timestamp.md
git commit -m "Add Quartz scheduled and incremental timestamp export patterns"
```

---

### Task 7: Event-driven and chained routes patterns

**Files:**
- Create: `docs/patterns/event-driven-routes.md`
- Create: `docs/patterns/chained-routes-direct.md`

- [ ] **Step 1: Create event-driven-routes.md**

```markdown
# Event-Driven Routes Pattern

## When to Use

Routes that react to Pricefx platform events: data load completion, calculation completion,
price approval, custom events. Used for triggering downstream actions (exports, calculations,
notifications, external system updates).

## Event Types

| Event | Trigger | Common Use |
|---|---|---|
| `PADATALOAD_COMPLETED` | PA data source load finishes | Trigger flush, CFS calculation |
| `CALCULATION_COMPLETED_CFS` | CFS calculation finishes | Trigger export, notification |
| `ITEM_APPROVED_PL` | Price list item approved | Export to ERP |
| `ITEM_APPROVED_CT` | Contract item approved | Send to external system |
| `CUSTOM_*` | Custom application events | Any business logic |

## XML Template — Direct Consumer

~~~xml
<route id="event-{{EVENT_NAME}}">
  <from uri="direct:event{{EVENT_NAME}}"/>

  <log message="[${routeId}] Event received: type=${body[data][0][type]}, status=${body[data][0][status]}"/>

  <!-- Extract event metadata -->
  <setProperty name="eventData">
    <groovy>body.data[0]</groovy>
  </setProperty>

  <!-- Filter: only process matching events -->
  <filter>
    <groovy>exchange.properties.eventData?.status == 'READY'</groovy>

    <!-- Process the event -->
    <to uri="direct:handle-{{EVENT_NAME}}"/>
  </filter>
</route>
~~~

## XML Template — SEDA for Concurrent Processing

~~~xml
<!-- Use SEDA when events need parallel processing -->
<route id="event-{{EVENT_NAME}}-processor">
  <from uri="seda:event-{{EVENT_NAME}}?concurrentConsumers={{pfx:event.concurrency:5}}"/>

  <log message="[${routeId}] Processing event item"/>

  <setBody><simple>${body[data]}</simple></setBody>

  <split stopOnException="true">
    <simple>${body}</simple>
    <setHeader name="itemId"><simple>${body[uniqueName]}</simple></setHeader>
    <to uri="direct:process-{{EVENT_NAME}}-item"/>
  </split>
</route>
~~~

## Event Data Structure

Events arrive as JSON with this structure:
~~~json
{
  "data": [
    {
      "type": "DS_FLUSH",
      "status": "READY",
      "label": "Transactions",
      "sourceName": "DMF.Transactions",
      "targetName": "DMDS.Transactions",
      "uniqueName": "12345"
    }
  ]
}
~~~

Access in Groovy: `body.data[0].type`, `body.data[0].status`, etc.

## Common Mistakes

1. **Not filtering event status** — processing incomplete/failed events
2. **Blocking on direct:** — use seda: for long-running event handlers
3. **No stopOnException in split** — failed items silently skipped
4. **Logging full event body** — truncate with `.toString().take(1000)` for large payloads
```

- [ ] **Step 2: Create chained-routes-direct.md**

```markdown
# Chained Routes Pattern (direct: Endpoints)

## When to Use

Multi-step workflows where one route calls another. Used for separating concerns:
event parsing, data transformation, external system calls, error handling, completion
actions. Each sub-route is independently testable and reusable.

## XML Template

~~~xml
<!-- Main orchestrator route -->
<route id="import-{{ENTITY}}-orchestrator">
  <from uri="{{pfx:source.endpoint}}"/>

  <log message="[${routeId}] Starting orchestration"/>

  <!-- Step 1: Load products -->
  <to uri="direct:load-products"/>

  <!-- Step 2: Load product extensions (depends on step 1) -->
  <to uri="direct:load-product-extensions"/>

  <!-- Step 3: Trigger calculation -->
  <to uri="direct:trigger-calculation"/>

  <log message="[${routeId}] Orchestration complete"/>
</route>

<!-- Sub-route: independently testable -->
<route id="load-products">
  <from uri="direct:load-products"/>
  <!-- ... import logic ... -->
</route>

<route id="load-product-extensions">
  <from uri="direct:load-product-extensions"/>
  <!-- ... import logic ... -->
</route>

<route id="trigger-calculation">
  <from uri="direct:trigger-calculation"/>
  <toD uri="pfx-api:executeCalculation?calculationName={{pfx:cfs.name}}&amp;connection={{pfx:connection}}"/>
</route>
~~~

## Data Passing Between Chained Routes

~~~xml
<!-- Use exchange properties (survive across routes) -->
<setProperty name="sourceFileName">
  <simple>${headers.CamelFileName}</simple>
</setProperty>

<!-- Later route accesses it -->
<log message="Original file: ${exchangeProperty.sourceFileName}"/>
~~~

Use `setProperty` (exchange-scoped), NOT `setHeader` for data that must survive across chained routes.

## Parallel Execution with Multicast

~~~xml
<!-- Load P and PX in parallel -->
<multicast parallelProcessing="true">
  <to uri="direct:load-products"/>
  <to uri="direct:load-product-extensions"/>
</multicast>
~~~

## Common Mistakes

1. **Using headers for cross-route state** — headers may not survive; use exchange properties
2. **Monolithic routes** — one 200+ line route instead of composable sub-routes
3. **Missing error handling on sub-routes** — error in sub-route kills entire chain silently
4. **Circular direct: calls** — Route A calls B which calls A; infinite loop
```

- [ ] **Step 3: Commit**

```bash
git add docs/patterns/event-driven-routes.md docs/patterns/chained-routes-direct.md
git commit -m "Add event-driven and chained routes patterns"
```

---

### Task 8: Error handling and post-load patterns

**Files:**
- Create: `docs/patterns/error-handling.md`
- Create: `docs/patterns/post-load-cfs-flush.md`

- [ ] **Step 1: Create error-handling.md**

```markdown
# Error Handling Pattern

## When to Use

Every production route needs error handling. The level depends on the route type:
- Import routes: doCatch for encoding errors, archive/error folders for files
- Export routes: redelivery for transient failures, email notifications
- Event routes: logging, dead-letter for unprocessable events

## Pattern 1: Redelivery Policy (Transient Failures)

For network errors, API timeouts, temporary unavailability:

~~~xml
<!-- Define as a bean (in Spring context or route-level) -->
<redeliveryPolicyProfile id="defaultRedeliveryPolicy"
    maximumRedeliveries="{{pfx:error.maxRetries:5}}"
    redeliveryDelay="{{pfx:error.retryDelay:2000}}"
    useExponentialBackOff="true"
    backOffMultiplier="3.0"
    maximumRedeliveryDelay="120000"/>

<!-- Apply to route -->
<route id="my-route">
  <onException redeliveryPolicyRef="defaultRedeliveryPolicy">
    <exception>java.lang.Exception</exception>
    <handled><constant>false</constant></handled>
    <log loggingLevel="ERROR" message="[${routeId}] Retry ${headers.CamelRedeliveryCounter}: ${exception.message}"/>
  </onException>
  <!-- ... route logic ... -->
</route>
~~~

## Pattern 2: doTry/doCatch (Expected Errors)

For encoding errors, malformed data, validation failures:

~~~xml
<doTry>
  <split aggregationStrategy="recordsCountAggregation" streaming="true">
    <tokenize group="20000" token="\n"/>
    <toD uri="pfx-csv:unmarshal?{{pfx:csv.settings}}&amp;skipHeaderRecord=true"/>
    <toD uri="pfx-api:loaddata?${headers.parsedPfxApiSettings}mapper={{pfx:mapper}}"/>
    <setBody><constant/></setBody>
  </split>

  <doCatch>
    <exception>java.nio.charset.MalformedInputException</exception>
    <log loggingLevel="ERROR" message="[${routeId}] Encoding error in ${headers.CamelFileName}"/>
    <throwException exceptionType="net.pricefx.integration.api.NonRecoverableException"
                    message="File encoding error — check charset setting"/>
  </doCatch>

  <doCatch>
    <exception>java.lang.Exception</exception>
    <log loggingLevel="ERROR" message="[${routeId}] Unexpected error: ${exception.message}"/>
    <throwException exceptionType="net.pricefx.integration.api.NonRecoverableException"
                    message="Import failed: ${exception.message}"/>
  </doCatch>
</doTry>
~~~

## Pattern 3: Error File Archival

~~~xml
<!-- SFTP source with error folder -->
<from uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}
  &amp;move=.archive/${date:now:yyyyMMdd}/
  &amp;moveFailed=.error/${date:now:yyyyMMdd}/"/>

<!-- For manual error tracking with audit files -->
<onException>
  <exception>java.lang.Exception</exception>
  <handled><constant>true</constant></handled>
  <setHeader name="errorFile">
    <simple>.error/${date:now:yyyyMMdd}/${headers.CamelFileName}_ERROR.txt</simple>
  </setHeader>
  <setBody><simple>${exception.message}</simple></setBody>
  <toD uri="file:{{pfx:archive.dir}}?fileName=${headers.errorFile}"/>
</onException>
~~~

## Redelivery Policy Guidelines

| Scenario | Max Retries | Initial Delay | Backoff |
|---|---|---|---|
| Pricefx API call | 5 | 2s | x3 (2s, 6s, 18s, 54s, 120s) |
| SFTP connection | 3 | 5s | x2 |
| External REST API | 5 | 1s | x3 |
| SOAP call | 3 | 5s | x3 |

## Common Mistakes

1. **No error handling at all** — route silently fails, no one knows
2. **`<handled>true</handled>` everywhere** — swallows errors, hides problems
3. **No redelivery for transient errors** — fails on first timeout instead of retrying
4. **Logging entire stack trace at INFO** — use ERROR level for errors, DEBUG for stack traces
5. **No email notification for critical failures** — team doesn't know until customer reports it
```

- [ ] **Step 2: Create post-load-cfs-flush.md**

```markdown
# Post-Load Completion Pattern (CFS Trigger, DMDS Flush)

## When to Use

After data import completes, trigger follow-up actions:
- Flush DMDS to make PA data visible
- Execute CFS (Calculation Flow Script) calculations
- Trigger internal copy
- Send notifications

## XML Template — onCompletion

~~~xml
<route id="import-{{ENTITY}}">
  <from uri="{{pfx:source.endpoint}}"/>

  <!-- onCompletion fires after route finishes successfully -->
  <onCompletion onCompleteOnly="true">
    <log message="[${routeId}] Post-load: triggering CFS"/>
    <toD uri="pfx-api:executeCalculation?calculationName={{pfx:cfs.name}}&amp;connection={{pfx:connection}}"/>
  </onCompletion>

  <!-- ... import logic ... -->
</route>
~~~

## XML Template — Event-Driven Post-Load

~~~xml
<!-- Listen for PA data load completion -->
<route id="event-PADATALOAD_COMPLETED">
  <from uri="direct:eventPADATALOAD_COMPLETE"/>

  <setHeader name="eventType"><simple>${body[data][0][type]}</simple></setHeader>
  <setHeader name="eventStatus"><simple>${body[data][0][status]}</simple></setHeader>
  <setHeader name="eventLabel"><simple>${body[data][0][label]}</simple></setHeader>

  <!-- On DS_FLUSH READY: truncate old data feed -->
  <filter>
    <simple>${header.eventType} == 'DS_FLUSH' &amp;&amp; ${header.eventStatus} == 'READY'</simple>

    <filter>
      <groovy>body.data[0].sourceName?.startsWith('DMF.')</groovy>
      <setHeader name="dmfToTruncate"><groovy>body.data[0].sourceName</groovy></setHeader>
      <wireTap copy="true" uri="direct:truncate-dmf"/>
    </filter>
  </filter>

  <!-- On specific label: trigger CFS calculation -->
  <filter>
    <simple>${header.eventType} == 'DS_FLUSH' &amp;&amp; ${header.eventLabel} == '{{pfx:trigger.label}}'</simple>
    <toD uri="pfx-api:executeCalculation?calculationName={{pfx:cfs.name}}&amp;connection={{pfx:connection}}"/>
  </filter>
</route>

<route id="truncate-dmf">
  <from uri="direct:truncate-dmf"/>
  <toD uri="pfx-api:truncate?targetName=${header.dmfToTruncate}&amp;filter=truncateFlushedFilter&amp;connection={{pfx:connection}}"/>
  <log message="[${routeId}] Truncated ${header.dmfToTruncate}"/>
</route>
~~~

## Common Completion Actions

| Action | When | How |
|---|---|---|
| DMDS Flush | After DS load | `pfx-api:flush` |
| CFS Calculation | After P/C/PX load | `pfx-api:executeCalculation` |
| Internal Copy | After PPV load | `bean:dataLoadClient?method=executeInternalCopy` |
| DMF Truncate | After flush completes | `pfx-api:truncate` on PADATALOAD event |
| Email notification | After any completion | SMTP or notification route |

## Common Mistakes

1. **CFS triggered before all data loaded** — use onCompletion, not inline after split
2. **Flush called inline during split** — only partial data visible; flush AFTER split completes
3. **Blocking truncate in event handler** — use wireTap for non-blocking cleanup
4. **No event filtering** — processing ALL PADATALOAD events, not just the relevant ones
```

- [ ] **Step 3: Commit**

```bash
git add docs/patterns/error-handling.md docs/patterns/post-load-cfs-flush.md
git commit -m "Add error handling and post-load completion patterns"
```

---

### Task 9: Groovy best practices and naming conventions

**Files:**
- Create: `docs/patterns/groovy-best-practices.md`
- Create: `docs/patterns/naming-conventions.md`

- [ ] **Step 1: Create groovy-best-practices.md**

```markdown
# Groovy Best Practices

## When to Use Groovy

Groovy in IM routes should be minimal. Use it for:
- Parsing API settings headers (standard snippet)
- Simple conditional logic (1-3 lines)
- Date/timestamp formatting
- String manipulation

Do NOT use inline Groovy for:
- Business logic (>10 lines) — extract to a bean
- Data transformation — use mappers
- Complex iteration/aggregation — use Camel EIPs (split, aggregate)

## The Standard API Settings Parser

This block appears in nearly every import route. Keep it consistent:

~~~groovy
def pfxApiSettingsMap = [:]
headers.pfxApiSettings.split('&').each { setting ->
  def parts = setting.split('=')
  def key = parts[0]
  def value = parts.size() > 1 ? parts[1] : ""
  pfxApiSettingsMap.put(key, value)
  headers.put(key, value)
}
def parsed = pfxApiSettingsMap
  .findAll { k, v -> k != 'entityName' }
  .collect { k, v -> k + '=' + v }
  .join('&')
headers.put('parsedPfxApiSettings', parsed)
~~~

For LTV/MLTV routes, add the pricingParameterName mapping:

~~~groovy
pfxApiSettingsMap.each { k, v ->
  if (k == 'entityName' && pfxApiSettingsMap['objectType']?.contains('LTV')) {
    parsed += 'pricingParameterName=' + v + '&'
  }
}
~~~

## Good: Short Inline Groovy

~~~groovy
<!-- Timestamp formatting (1 line) -->
<groovy>new Date().format("yyyy-MM-dd'T'HH:mm:ss", TimeZone.getTimeZone('UTC'))</groovy>

<!-- Simple conditional (1 line) -->
<groovy>headers.objectType == 'DMDS' ? 'flush' : 'skip'</groovy>

<!-- String extraction (1 line) -->
<groovy>headers.CamelFileName.replace('.done', '.csv')</groovy>
~~~

## Bad: Bloated Inline Groovy

If your Groovy block exceeds 10-15 lines, extract it to a bean:

~~~java
// src/main/java/com/example/MyProcessor.java
@Component("myProcessor")
public class MyProcessor {
    public void process(Exchange exchange) {
        // complex logic here
    }
}
~~~

~~~xml
<!-- Route uses bean instead of inline Groovy -->
<to uri="bean:myProcessor"/>
~~~

## Rules of Thumb

| Lines | Action |
|---|---|
| 1-3 | Inline Groovy is fine |
| 4-10 | Consider extracting, but OK if logic is straightforward |
| 11-15 | Extract to bean or dedicated script |
| 15+ | Must extract — unmaintainable inline |

## Common Mistakes

1. **Copy-pasting the API settings parser** with slight variations across routes
2. **Complex date math inline** — use a utility bean
3. **Debugging inline Groovy** — no stack traces, no IDE support, no tests
4. **Accessing exchange internals** — use `headers.*` and `body.*`, not `exchange.in.getHeader()`
```

- [ ] **Step 2: Create naming-conventions.md**

```markdown
# Naming Conventions

## Route IDs

Use kebab-case with action prefix:

| Prefix | Use For | Example |
|---|---|---|
| `import-` | Inbound data loads | `import-products-from-sftp` |
| `export-` | Outbound data exports | `export-prices-to-sftp` |
| `event-` | Event-driven handlers | `event-PADATALOAD_COMPLETED` |
| `send-` | Notifications/emails | `send-export-failure-email` |

Keep event type names in UPPER_CASE as they come from Pricefx:
`event-ITEM_APPROVED_PL`, `event-CALCULATION_COMPLETED_CFS`

## Mapper IDs and Files

Pattern: `[entity][ObjectType]Mapper`

| Example | Description |
|---|---|
| `productPMapper` | Product (P) import mapper |
| `customerDetailsCXMapper` | Customer extension (CX) mapper |
| `transactionDSMapper` | Data source (DS) mapper |
| `exportPricesCsvMapper` | Export transform mapper |

File naming: `[mapperName].mapper.xml`

## Filter IDs and Files

Pattern: `[purpose][Entity]Filter`

| Example | Description |
|---|---|
| `truncateFlushedFilter` | Delete flushed records |
| `fetchPriceListFilter` | Fetch filter for PL export |
| `dateRangeFilter` | Time-window filter |

File naming: `[filterName].filter.xml`

## Property Keys

Pattern: `pfx:[routeId].[category].[name]`

| Category | Example | Description |
|---|---|---|
| Connection | `pfx:import-products.connection` | Pricefx connection name |
| SFTP | `pfx:import-products.sftp.connection` | SFTP connection |
| CSV | `pfx:import-products.csv.settings` | CSV parser config |
| API | `pfx:import-products.api.settings` | Object type/entity |
| Mapper | `pfx:import-products.mapper` | Mapper reference |
| Batch | `pfx:import-products.batch.size` | Batch size |
| Cron | `pfx:export-prices.cron` | Schedule expression |
| Error | `pfx:error.maxRetries` | Error handling config |

## Directory Organization

~~~
src/main/resources/repo/
  routes/
    import-products.xml
    import-customers.xml
    export-prices.xml
    event-routes.xml
  mappers/
    productPMapper.mapper.xml
    customerCMapper.mapper.xml
    exportPricesCsvMapper.mapper.xml
  filters/
    truncateFlushedFilter.filter.xml
    dateRangeFilter.filter.xml
~~~

## Common Mistakes

1. **Mixed naming styles** — camelCase routes + kebab-case mappers + PascalCase filters
2. **No action prefix on routes** — impossible to tell import from export at a glance
3. **Undescriptive names** — `route1`, `mapper2`, `filter3`
4. **Inconsistent objectType suffix** — sometimes `P`, sometimes `Product`, sometimes omitted
```

- [ ] **Step 3: Commit**

```bash
git add docs/patterns/groovy-best-practices.md docs/patterns/naming-conventions.md
git commit -m "Add Groovy best practices and naming conventions"
```

---

### Task 10: Scheduling start/stop pattern

**Files:**
- Create: `docs/patterns/scheduling-start-stop.md`

- [ ] **Step 1: Create scheduling-start-stop.md**

```markdown
# Scheduling Start/Stop Pattern

## When to Use

Long-running import routes (large DS loads taking hours) that should only run during
off-peak hours (e.g., 23:00-06:00 UTC). Uses Quartz to start and stop routes on schedule.

## XML Template

~~~xml
<!-- Start the data load route at 23:00 UTC -->
<route id="start-{{ROUTE_ID}}" autoStartup="true">
  <from uri="quartz://scheduler-start-{{ROUTE_ID}}?cron={{pfx:schedule.start.cron}}&amp;trigger.timeZone={{pfx:schedule.timezone}}&amp;stateful=true"/>
  <log message="[${routeId}] Starting {{ROUTE_ID}}"/>
  <toD uri="controlbus:route?routeId={{ROUTE_ID}}&amp;action=start"/>
</route>

<!-- Stop the data load route at 06:00 UTC -->
<route id="stop-{{ROUTE_ID}}" autoStartup="true">
  <from uri="quartz://scheduler-stop-{{ROUTE_ID}}?cron={{pfx:schedule.stop.cron}}&amp;trigger.timeZone={{pfx:schedule.timezone}}&amp;stateful=true"/>
  <log message="[${routeId}] Stopping {{ROUTE_ID}}"/>
  <toD uri="controlbus:route?routeId={{ROUTE_ID}}&amp;action=stop"/>
</route>

<!-- The actual data load route: autoStartup=false (controlled by scheduler) -->
<route id="{{ROUTE_ID}}" autoStartup="false">
  <from uri="{{pfx:source.endpoint}}"/>
  <!-- ... import logic ... -->
</route>
~~~

## Required Properties

| Property | Example | Description |
|---|---|---|
| `pfx:schedule.start.cron` | `0+0+23+?+*+*` | Start at 23:00 |
| `pfx:schedule.stop.cron` | `0+0+6+?+*+*` | Stop at 06:00 |
| `pfx:schedule.timezone` | `UTC` | Timezone for both |

## How It Works

1. Data load route has `autoStartup="false"` — does not run on IM startup
2. Start scheduler activates the route via Camel `controlbus` at scheduled time
3. Route processes files/data during the time window
4. Stop scheduler deactivates the route at end of window
5. Any in-progress file completes; no new files picked up after stop

## Common Mistakes

1. **autoStartup="true" on the data route** — runs immediately, ignoring schedule
2. **Missing stateful=true on Quartz** — scheduler fires multiple times if previous still running
3. **Stop kills in-progress work** — controlbus stop is graceful by default; in-flight exchanges complete
4. **No timezone** — start/stop at wrong times in different environments
```

- [ ] **Step 2: Commit**

```bash
git add docs/patterns/scheduling-start-stop.md
git commit -m "Add scheduling start/stop pattern"
```

---

### Task 11: Advanced patterns — Kafka, SOAP, REST, S3, Multi-tenant

These patterns require deeper extraction from partner projects during execution.
Each step includes the specific files to read for content.

**Files:**
- Create: `docs/patterns/kafka-dual-pipeline.md`
- Create: `docs/patterns/soap-outbound.md`
- Create: `docs/patterns/rest-outbound.md`
- Create: `docs/patterns/s3-integration.md`
- Create: `docs/patterns/multi-tenant-partitions.md`

- [ ] **Step 1: Extract Kafka pattern from partner project (Kafka source)**

Read these files for the actual XML templates:
- `{PARTNER_PROJECT_KAFKA}/src/main/resources/repo/routes/` — any `import-kafka-ds-*.xml` file
- `{PARTNER_PROJECT_KAFKA}/src/main/resources/application.properties` — Kafka connection config

Create `docs/patterns/kafka-dual-pipeline.md` with:
- When to Use: parallel file + Kafka pipelines for same data source
- XML Template: Kafka consumer route with aggregation, error handling, throttling
- Properties: Kafka broker config, topic, group ID, aggregation settings
- Common Mistakes: missing consumer group, no dead letter, no throttling on errors

- [ ] **Step 2: Extract SOAP pattern from partner project (SOAP source)**

Read these files:
- `{PARTNER_PROJECT_SOAP}/src/main/resources/repo/routes/` — SOAP event route file
- Any FreeMarker template files in the project

Create `docs/patterns/soap-outbound.md` with:
- When to Use: sending data to external SOAP/XML services
- XML Template: FreeMarker payload generation, SOAP call, response parsing
- Properties: SOAP endpoint, action, credentials
- Common Mistakes: missing SOAPAction header, no timeout, no retry

- [ ] **Step 3: Extract REST outbound pattern from partner projects (REST sources)**

Read these files:
- `{PARTNER_PROJECT_REST_A}/src/main/resources/repo/routes/` — routes with external REST API calls
- `{PARTNER_PROJECT_REST_B}/src/main/resources/repo/routes/outbound_commonRoutes.xml` — API gateway calls

Create `docs/patterns/rest-outbound.md` with:
- When to Use: calling external REST APIs (POST/PUT) from IM
- XML Template: HTTP call with auth headers, retry, response handling
- Properties: endpoint URL, auth type, credentials
- Common Mistakes: no timeout, no retry, swallowing error responses

- [ ] **Step 4: Extract S3 pattern from partner project (S3 source)**

Read these files:
- `{PARTNER_PROJECT_S3}/src/main/resources/repo/routes/` — the competition-S3 route

Create `docs/patterns/s3-integration.md` with:
- When to Use: reading from or writing to AWS S3
- XML Template: S3 consumer/producer, bucket/prefix config
- Properties: AWS credentials, bucket, region
- Common Mistakes: wrong region, missing credentials, no error handling

- [ ] **Step 5: Extract multi-tenant pattern from partner project (multi-tenant source)**

Read these files:
- `{PARTNER_PROJECT_MULTITENANT}/src/main/resources/repo/routes/` — event routes with partition routing
- Properties file for per-partition config

Create `docs/patterns/multi-tenant-partitions.md` with:
- When to Use: single IM instance serving multiple Pricefx partitions
- XML Template: partition-aware routing, shared handlers, per-tenant config
- Properties: partition list, per-partition connection names
- Common Mistakes: missing partition isolation, shared state between tenants

- [ ] **Step 6: Commit all advanced patterns**

```bash
git add docs/patterns/kafka-dual-pipeline.md docs/patterns/soap-outbound.md docs/patterns/rest-outbound.md docs/patterns/s3-integration.md docs/patterns/multi-tenant-partitions.md
git commit -m "Add advanced patterns: Kafka, SOAP, REST, S3, multi-tenant"
```

---

### Task 12: Final review and README update

- [ ] **Step 1: Verify all 18 pattern files exist**

```bash
ls -la docs/patterns/*.md | wc -l
# Expected: 19 (18 patterns + README.md)
```

- [ ] **Step 2: Review each file for customer data leaks**

Grep for any customer-specific content that should not be there:

```bash
grep -ri "customer-specific-terms" docs/patterns/
# Replace with actual partner/customer names to check for leaks
# Expected: no matches (references should be generic)
```

- [ ] **Step 3: Fix any customer references found**

Replace any customer-specific references with generic equivalents.

- [ ] **Step 4: Final commit**

```bash
git add docs/patterns/
git commit -m "Pattern catalog complete: 18 anonymized integration patterns"
```
