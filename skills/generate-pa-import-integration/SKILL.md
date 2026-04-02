---
name: generate-pa-import-integration
description: Generate a Pricefx PA (Price Analyser) Data Source import integration using the DMDS split+tokenize+loaddata+flush pattern. Use this skill whenever the user wants to import data into a PA Data Source, Data Source (DS), DMDS, or mentions Price Analyser data loading. This pattern is different from standard imports — it requires split+tokenize batching and a mandatory flush step. Fetches real metadata from the partition via pfx CLI.
---

# Generate PA Data Source Import Integration

You are generating an import integration for a **PA Data Source (DMDS)** in a Pricefx Integration Manager project. PA (Price Analyser) imports use a specific pattern: `split+tokenize+loaddata+flush`. Follow the steps below precisely. NEVER use placeholder/generic fields — always use real field names from the partition.

**This skill is for DMDS (PA Data Source) imports only.** For P, PX, CX, or C imports, use `/generate-import-integration` instead.

## DMDS Import Pattern Overview

PA Data Source imports are different from P/PX/CX/C imports:
- **Always** use `split+tokenize+loaddata` (NEVER `loaddataFile`)
- **Always** require a `pfx-api:flush` step after loading
- Use `objectType=DMDS` (not `DS`)
- Require `dsUniqueName=DMDS.{DataSourceName}` parameter
- Batching is done via `tokenize group=N` (not `batchSize` on the component)
- Mapper does NOT need `<constant expression="..." out="name"/>` — the data source is identified by `dsUniqueName` on the URI

## Step 1: Check Credentials

Check `src/main/resources/repo/config/application.properties` and `src/main/resources/repo/config/application-local.properties` for `integration.pfx.*` properties.
If not found, ASK the user for: URL, partition, username, password.

## Step 2: List Available PA Data Sources

Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` to show available data sources.

Ask the user to select a data source. If the user already specified the data source name (e.g., in $ARGUMENTS), skip asking.

## Step 3: Fetch Data Source Metadata

1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {selected-name}` to get field names
2. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source-metadata {selected-name}` to get attribute labels and types (needed for Smart Auto-Mapping)

Present the fields to the user in a clear table.

## Step 3b: Smart Auto-Mapping (when CSV sample data AND DS metadata are available)

When you have BOTH a CSV sample/header AND target DS metadata (with labels from `data-source-metadata`), automatically propose field mappings using the algorithm below. **Do NOT ask the user to manually map fields** — propose the mapping and let them confirm or adjust.

### Auto-Mapping Algorithm

For each CSV column, find the best matching Pricefx field using these rules in priority order:

**Priority 1 — Exact key field match (confidence: HIGH)**
- CSV column name contains `id`, `sku`, `key`, `code`, `product_id`, `item_number` → map to `sku`
- CSV column name contains `name`, `description`, `label`, `title` (and is not a category/hierarchy) → map to `label`

**Priority 2 — Fuzzy match against attribute labels (confidence: HIGH or MEDIUM)**
Compare each CSV column name against DS attribute labels using these matching techniques:
1. **Exact match** (case-insensitive): `"Product Name"` = `"Product Name"` → HIGH confidence
2. **Normalized match** (remove spaces, underscores, hyphens, lowercase): `"product_name"` = `"ProductName"` → HIGH confidence
3. **Contains match**: CSV `"Hierarchy Level 1"` contains label `"Hierarchy 1"` → MEDIUM confidence
4. **Word overlap**: CSV `"Product Cost USD"` shares words with label `"Product Costs"` → MEDIUM confidence (≥50% word overlap)
5. **Abbreviation match**: CSV `"Prod Name"` ↔ label `"Product Name"` → MEDIUM confidence

**Priority 3 — Type-based matching (confidence: LOW)**
If no label match found, match by data type compatibility:
- CSV column with decimal values → attribute with type `REAL`/`NUMERIC`
- CSV column with dates → attribute with type `DATE`/`DATETIME`
- Only use if there's a single compatible unmatched attribute of that type

**Priority 4 — Sequential fallback (confidence: LOW)**
Remaining unmatched CSV columns → assign to next available `attributeN` in order.

### Confidence Display

Present the proposed mapping as a table with confidence indicators:

```
Smart Auto-Mapping Result:
| # | CSV Column          | → | Pricefx Field | Label          | Confidence | Match Reason              |
|---|---------------------|---|---------------|----------------|------------|---------------------------|
| 1 | Product ID          | → | sku           | —              | ✅ HIGH    | Key field (contains "ID") |
| 2 | Product Name        | → | attribute1    | Product Name   | ✅ HIGH    | Exact label match         |
| 3 | Hierarchy Level 1   | → | attribute2    | Product Hier 1 | 🟡 MEDIUM | Word overlap (73%)        |
| 4 | Cost                | → | attribute9    | Product Costs  | 🟡 MEDIUM | Word overlap + type match |
| 5 | Internal Code       | → | attribute11   | —              | 🔴 LOW    | Sequential fallback       |
```

Ask: **Does this mapping look correct? You can adjust any row.**

### Converter Expression Auto-Detection

When proposing the mapping, also detect and suggest converter expressions based on:
1. **Target field type** from metadata (e.g., `NUMERIC` → `stringToDecimal`)
2. **CSV sample data** patterns (e.g., date formats → `stringToDate`)

| Target Type | Suggested Converter |
|---|---|
| `NUMERIC`, `MONEY`, `PERCENT` | `converterExpression="stringToDecimal"` |
| `INTEGER` | `converterExpression="stringToInteger"` |
| `DATE` | `converterExpression="stringToDate"` (detect format from sample) |
| `DATETIME` | `converterExpression="stringToDateTime"` |
| `TEXT`, `STRING` | none needed |

### When Auto-Mapping is NOT possible

- **No CSV sample data available** → fall back to manual mapping (Step 7)
- **No attribute labels set** (all labels empty in metadata) → fall back to sequential mapping + ask user

## Step 4: Determine Data Source

Ask the user: **What is the data source?**
- CSV file (local file system)
- Zipped/compressed CSV (local file system)
- SFTP
- Database (JDBC)
- REST API
- Other

### If file system (CSV or Zipped CSV):
**Always derive the folder name from context** — do NOT ask the user for the path. Use the target data source name converted to kebab-case:
- DS table `SalesData` → `/sales-data`
- DS table `PriceListDS` → `/price-list-ds`

Propose the derived path and let the user override if needed.

The full `from` URI will be: `file://{{integration.sftp.root}}/{derived-path}`

## Step 4b: Auto-detect CSV Format from Sample Data

If the user attaches a CSV file or pastes sample data, analyze it automatically BEFORE asking remaining questions. Detect:

1. **Delimiter** — `,`, `;`, `\t`, `|` etc. (look at separators between values)
2. **Quote character** — `"` if fields contain the delimiter (e.g., `"value, with comma"`)
3. **Has header row** — if the first row looks like column names (non-numeric, descriptive) vs actual data
4. **Column names** — extract from header row
5. **Number of columns** — count for batch size recommendation
6. **Data types per column** — analyze data rows:
   - String (default)
   - Number/Decimal (e.g., `4.57`, `0.247`) → suggest `converterExpression="stringToDecimal"`
   - Integer (e.g., `12`, `500`) → suggest `converterExpression="stringToInteger"`
   - Date (e.g., `5/12/2021`, `2021-05-12`) → detect format, suggest `converterExpression="stringToDate"` or `converterExpression="stringToDateTime"`
   - Boolean (e.g., `true`/`false`, `Y`/`N`)

Present the detected format to the user for confirmation:

```
Detected CSV format:
- Delimiter: ,
- Quote character: "
- Has header: yes
- Columns: 14
- Recommended batch size: 200000

Proposed field mapping:
| # | CSV Column | Pricefx Field | Type |
|---|-----------|---------------|------|
| 1 | Product ID | sku | String |
| 2 | Product Name | attribute1 | String |
| 3 | Price | attribute2 | Decimal |
| ... | ... | ... | ... |
```

If auto-detected, skip Steps 5 (Batch Size), 6 (CSV Header) — they are already resolved.

## Step 5: Batch Size

Ask the user: **What batch size do you want for the tokenize split?**

Provide this guidance:
- **Few fields (< 10 attributes):** `50000` is fine
- **Medium fields (10–20 attributes):** `20000–50000`
- **Many fields (20+ attributes):** `5000–20000`
- More attributes per row = more memory per batch, so use smaller batch sizes

Default: `50000` for DMDS imports.

### Tokenize Batch Size Guidelines

| Scenario | Recommended group= | Notes |
|---|---|---|
| Few fields (<10) | 50,000 | Simple DS records |
| Many fields (10-30) | 20,000 | More memory per record |
| Many fields (30+) | 10,000 | Heavy records |

## Step 6: CSV Header

Skip this step if already auto-detected in Step 4b.

If the data source is CSV, ask: **Does the CSV file have a header row?**
- Yes (default) → `skipHeaderRecord=true`
- No → `skipHeaderRecord=false` — in this case, the `header` parameter must be provided on the unmarshal step with the column names

## Step 7: Field Mapping

Skip this step if already auto-detected and confirmed in Step 4b.

If not yet determined, the user can provide field mapping in one of these ways:

1. **Attach a sample CSV file** — read the file, extract the header row, and auto-generate the mapper from the column names. Propose mapping to the user (sku, attribute1, attribute2, ...) and let them adjust.
2. **Paste CSV header or sample data** — extract column names from the first row and propose mapping.
3. **Manually specify mappings** — ask: **Which source fields map to which Pricefx fields?** Show available target fields from Step 3.

Ask the user: **Can you attach a sample CSV file, paste the header, or list the field mappings?**

A mapper is almost always needed (99% of cases). Only skip the mapper if the CSV columns already match Pricefx field names exactly (1:1).

**Always generate a mapper file** unless the user explicitly says the file is 1:1 with Pricefx field names.

### Auto-mapping from CSV header

When extracting columns from a CSV file or header:
1. Read the first line (header row) and split by delimiter
2. The first column that looks like an ID/key → map to `sku`
3. Remaining columns → map to `attribute1`, `attribute2`, ... in order
4. Present the proposed mapping as a table and ask the user to confirm or adjust

## Step 8: Determine Business Keys

Ask the user: **What are the business keys for this data source?**

Business keys determine record uniqueness. Common patterns:
- Single key: `sku` (most common for PA data sources)
- Composite key: `sku,attribute1` (e.g., product + region)

Default: `sku`

## Step 9: Generate Files

Generate the route and mapper files using the conventions below.

### Route Naming
- File: `src/main/resources/repo/routes/{descriptive-name}.xml`
- Route ID: `{descriptive-name}` (must match file name without `.xml`, NO `pfx:` prefix)
- Use `$ARGUMENTS` or ask the user for a descriptive name

### Route XML — DMDS import (split+tokenize+loaddata+flush)

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{source-uri-with-placeholders}"/>

        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>

        <!-- Decompress (only for zipped files) -->
        <!-- <to uri="pfx-io:streamCompressedFile"/> -->

        <split aggregationStrategy="recordsCountAggregation" streaming="true">
            <tokenize group="{BATCH_SIZE}" token="\n"/>

            <to uri="pfx-csv:unmarshal?skipHeaderRecord=true&amp;delimiter={DELIMITER}"/>

            <log loggingLevel="INFO" message="Running batch number# ${exchangeProperty.CamelSplitIndex}"/>

            <to uri="pfx-api:loaddata?objectType=DMDS&amp;dsUniqueName=DMDS.{DataSourceName}&amp;mapper={route-name}.mapper"/>
        </split>

        <log message="Load completed, total records: ${header.PfxTotalInputRecordsCount}" loggingLevel="INFO"/>

        <onCompletion onCompleteOnly="true">
            <toD uri="pfx-api:flush?dataFeedName=DMF.{DataSourceName}&amp;dataSourceName=DMDS.{DataSourceName}"/>
            <log message="Flush completed for {DataSourceName}." loggingLevel="INFO"/>
        </onCompletion>
    </route>
</routes>
```

**Key elements explained:**
- `split+tokenize` — splits the file into batches of N lines for memory-efficient processing
- `recordsCountAggregation` — tracks total records across all batches (available as `${header.PfxTotalInputRecordsCount}`)
- `stopOnException="true"` — stops processing if a batch fails
- `streaming="true"` — processes the file line-by-line without loading it all into memory
- `objectType=DMDS` — PA Data Source object type (NOT `DS`)
- `dsUniqueName=DMDS.{name}` — identifies which data source to load into
- `pfx-api:flush` — pushes data from the data feed (DMF) to the data source (DMDS). This is **mandatory**.
- `onCompletion onCompleteOnly="true"` — ensures flush only runs after successful load

**Source URI patterns by data source type:**

| Source | URI Pattern |
|--------|-------------|
| CSV file | `file://{{integration.sftp.root}}/{user-path}?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}` |
| Zipped CSV | Same as CSV file, then add `<to uri="pfx-io:streamCompressedFile"/>` after `<from>` and before `<split>` |
| SFTP | `pfx-sftp://{{pfx:{route-name}.sftp.path}}?connection={{pfx:{route-name}.sftp.connection}}&amp;delete=true` |
| Database | Use `pfx-sql:select` as a `<to>` step |
| REST API | Use `pfx-rest:get` as a `<to>` step with connection |

**File component options:**
- **Archive (default):** Always include `&amp;{{archive.file}}` on the file URI. This uses the `archive.file` property from `application.properties` to move processed files to a timestamped archive folder. The default property value is:
  ```properties
  archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D
  ```
  This moves processed files to e.g. `.archive/2026/03/sales-data__20260323_143000.csv`
- **File safety (read.lock vs done.file — mutually exclusive, always use one):**
  Ask the user: **Does the external system produce a `.done` marker file, or should we use read lock?**
  - If **no .done file** (default): use `&amp;{{read.lock}}` — waits until file size stabilizes before processing. Property:
    ```properties
    read.lock=readLock=changed
    ```
  - If **yes .done file**: replace `{{read.lock}}` with `{{done.file}}` — waits for a `.done` marker before processing. Property:
    ```properties
    done.file=doneFileName=%24%7Bfile:name%7D.done
    ```
  These are mutually exclusive — never use both on the same route.
- NEVER use `noop=true` — files should be processed and archived/moved/deleted
- NEVER use `include` parameter by default
- **Move failed (optional):** Offer the user the option to add `&amp;{{error.file}}` to the file URI. This moves files that fail processing to a timestamped error folder. The property is defined in `application.properties`:
  ```properties
  error.file=moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D
  ```
  Moves failed files to e.g. `.error/sales-data__20260323-143000.csv`
- Other useful options: `delete=true` (delete instead of archive)

### Mapper XML

File: `src/main/resources/repo/mappers/{route-name}.mapper.xml`

Always generate a mapper unless user explicitly says file is 1:1.

Standalone mapper files use `<mappers>` root with `<loadMapper>` and `<body>` elements. The `id` attribute of `<loadMapper>` must match the file name (without `.mapper.xml`).

```xml
<mappers>
    <loadMapper id="{route-name}.mapper">
        <body in="{source-field}" out="{pricefx-field}"/>
        <!-- Available mapping elements:
             <body in="csvColumn" out="pfxField"/>                                        — map from body field
             <body in="price" out="attribute1" converterExpression="stringToDecimal"/>     — with type conversion
             <constant expression="FixedValue" out="fieldName"/>                          — constant value
             <simple expression="${date:now:yyyy-MM-dd}" out="loadDate"/>                 — Camel Simple expression
             <groovy expression="body.Price?.toBigDecimal()" out="price"/>                — Groovy expression
             <header in="CamelFileName" out="attribute1"/>                                — from Camel header
             <property in="myProp" out="attribute2"/>                                     — from exchange property
        -->
    </loadMapper>
</mappers>
```

**DMDS mapper specifics:**
- Do NOT include `<constant expression="..." out="name"/>` — the data source is identified by `dsUniqueName` on the route URI, not in the mapper
- The key field for DMDS is `sku`

### Properties

Add the `archive.file` property to `src/main/resources/repo/config/application.properties` if not already present:

```properties
archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D
```

Other properties are only needed for SFTP connections, etc. Delimiter, skipHeaderRecord, mapper, batch size, and file path are all hardcoded in route XML.

## Scheduling for Long-Running DS Loads

For large data sources that take hours to load, add start/stop scheduling:

```xml
<!-- Start route at 23:00 UTC -->
<route id="start-{{ROUTE_ID}}" autoStartup="true">
  <from uri="quartz://scheduler-start?cron=0+0+23+?+*+*&amp;trigger.timeZone=UTC&amp;stateful=true"/>
  <toD uri="controlbus:route?routeId={{ROUTE_ID}}&amp;action=start"/>
</route>

<!-- Stop route at 06:00 UTC -->
<route id="stop-{{ROUTE_ID}}" autoStartup="true">
  <from uri="quartz://scheduler-stop?cron=0+0+6+?+*+*&amp;trigger.timeZone=UTC&amp;stateful=true"/>
  <toD uri="controlbus:route?routeId={{ROUTE_ID}}&amp;action=stop"/>
</route>
```

The import route must have `autoStartup="false"`. See [Scheduling Start/Stop Pattern](../../../integration-manager/docs/patterns/scheduling-start-stop.md).

## Important Rules

- NEVER hardcode values in route XML — always use `{{property}}` placeholders
- NEVER use generic/placeholder field names — always fetch real metadata
- Route ID MUST match the route file name (without `.xml`). Do NOT use `pfx:` prefix in route ID. Example: file `import-sales-data.xml` → `id="import-sales-data"`
- All URI parameters with `&` MUST be escaped as `&amp;` in XML
- **DS imports use `objectType=DMDS`** — not `DS`. The object type code on the pfx-api URI must be `DMDS`.
- `dsUniqueName=DMDS.{DataSourceName}` is **required** — identifies the target data source (e.g., `dsUniqueName=DMDS.PriceListDS`)
- `pfx-api:flush` is **mandatory** after loading — flushes data from `DMF.{name}` to `DMDS.{name}`
- DS mappers do NOT need `<constant expression="..." out="name"/>` — the data source is identified by `dsUniqueName` on the URI
- Use URL-encoded values for delimiter in XML:
  - Comma: `delimiter=,`
  - Semicolon: `delimiter=;`
  - Tab: `delimiter=%09`
  - Pipe: `delimiter=%7C`
- The file input directory MUST use `{{integration.sftp.root}}/{path}` directly in the route XML, NEVER a property placeholder
- NEVER use `noop=true` on file component
- NEVER use `include` parameter on file component by default
- Always use either `{{read.lock}}` (default) or `{{done.file}}` on file URIs — never both, never neither
- The `mapper` parameter in route XML MUST use the mapper file name (without `.mapper.xml`), e.g., `mapper=import-sales-data.mapper`. NEVER use a property placeholder.
- Do NOT include `connection=pricefx` parameter — the default Pricefx connection is named `pricefx` and is used automatically. Only add `connection={name}` when the project has multiple Pricefx connections and a non-default one is needed.
- Do NOT use `pfx-sftp` with `default-sftp-connection` — use `file://{{integration.sftp.root}}/{path}` instead. Only use `pfx-sftp` for external SFTP servers.
- **Resource ID naming rule:** The `id` attribute of mappers and routes MUST match the file name (without `.xml`). Example: file `import-sales-data.mapper.xml` → `id="import-sales-data.mapper"`. Using a different ID will cause deployment failure.
- **Key field for DMDS is `sku`** — NEVER use `customerId` for DS imports
