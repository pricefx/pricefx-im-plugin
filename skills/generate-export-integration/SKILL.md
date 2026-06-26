---
name: generate-export-integration
description: Use when the user wants to export or extract data FROM Pricefx for any object type (P, PX, CX, C, SL, SX, DS/DMDS) — says "export data", "extract from Pricefx", "delta sync", "incremental export", "scheduled export", or needs to push Pricefx data to CSV / SFTP / database / REST.
---

# Generate Export Integration

You are generating an export integration for a Pricefx Integration Manager project. Follow the steps below precisely. NEVER use placeholder/generic fields — always use real field names from the partition.

## Step 1: Check Credentials

Check `src/main/resources/repo/config/application.properties` and `src/main/resources/repo/config/application-local.properties` for `integration.pfx.*` properties.
If not found, ASK the user for: URL, partition, username, password.

## Step 2: Determine Source Object Type

Ask the user: **What Pricefx object are you exporting from?**

| Code | Object | CLI to list | CLI for fields | CLI for labels & types |
|------|--------|-------------|----------------|------------------------|
| P | Product Master | — | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-metadata` | — |
| PX | Product Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension-metadata {name}` |
| C | Customer Master | — | — (use sample data) | — |
| CX | Customer Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension-metadata {name}` |
| DS | Data Source | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs data-sources` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs data-source {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs data-source-metadata {name}` |

If the user already specified the object type (e.g., in $ARGUMENTS), skip asking.

### For PX, CX, DS: List available tables first
1. Run the appropriate `pfx` CLI list command to show available tables
2. Ask the user to select a table (or create a new one for PX/CX)
3. For PX/CX: also run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension-metadata {name}` or `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension-metadata {name}` to get attribute labels and types

### Creating a new PX/CX table

If the user wants a new extension table, use the `pfx` CLI to create it:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs create-product-extension {Name} --label "{Label}" --attributes {N}
node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs create-customer-extension {Name} --label "{Label}" --attributes {N}
```

**Validation rules (enforced by Pricefx API — violations are silently ignored!):**
- **Name format:** Only `A-Z`, `a-z`, `0-9`, `_` allowed. Must NOT start with a number.
- **Allowed attribute counts:** Only `3, 6, 8, 10, 20, 30, 50` are valid. Any other value will be silently ignored by the API.
- When choosing the attribute count, pick the smallest allowed value that covers the number of fields needed. E.g., if 13 fields are needed, use `20`.

### Setting attribute metadata on new PX/CX tables

After creating a new extension table, offer to set attribute labels and types using `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute`.

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute PX {ExtensionName} attribute1 --label "Field Label" --type STRING --format TEXT
node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute CX {ExtensionName} attribute1 --label "Field Label" --type REAL --format NUMERIC
```

**Available types and formats:**

| Type | Formats | Use for |
|---|---|---|
| `STRING` | `TEXT`, `LINK` | Text values, codes, IDs |
| `REAL` | `NUMERIC`, `MONEY`, `PERCENT` | Decimal numbers, prices, percentages |
| `INTEGER` | `INTEGER` | Whole numbers |
| `DATE` | `DATE` | Date values |
| `DATETIME` | `DATETIME` | Date+time values |
| `BOOLEAN` | — | True/false flags |

## Step 3: Fetch Metadata

Use the `pfx` CLI to get the real field names and types for the source object:
- **P, C:** Use sample data from the user or ask for field mappings manually
- **PX:** `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension {name}`
- **CX:** `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension {name}`
- **DS:** `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs data-source {name}`

Present the fields to the user in a clear table.

## Step 4: Determine Target

Ask the user: **Where should the data be exported to?**
- CSV file (local directory)
- SFTP
- Database (JDBC)
- REST API
- Other

## Step 4b: Sync Mode

Ask the user: **Full export, delta sync, or marked (consistent) export?**

| Mode | Description | Best for |
|------|-------------|----------|
| **Full** | Exports all records every time | Small data sets, full snapshots |
| **Delta** | Only exports records modified since the last run, using a stored timestamp on the partition | Master data (P/PX/C/CX) with a reliable `lastUpdateDate` |
| **Marked / Consistent** | Status-flag-based: mark rows `Processing` before export, `Exported` after, `Failed` on error. Requires a status column (e.g. `Exported`) on the data source. | DMDS / DS exports where background flushes or calculations may modify data **during** the export window — guarantees a stable snapshot |

### Delta sync pattern

Delta sync uses a time window to ensure no records are missed — even if records change during the export.

**How it works:**
1. Read stored timestamp from partition → `headers.lastExportTimestamp` (lower bound)
2. If empty (first run), fallback to `1970-01-01T00:00:00` → exports everything
3. Capture current time → `headers.currentExportTimestamp` (upper bound)
4. Filter: `lastUpdateDate > timestamp AND lastUpdateDate <= currentExportTimestamp`
5. After export, save `currentExportTimestamp` as the new stored timestamp

Records that change **during** the export have `lastUpdateDate > currentExportTimestamp` and will be picked up in the next run.

**Delta route template:**
```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{scheduler-uri}"/>

        <log message="Starting delta export: {route-name}" loggingLevel="INFO"/>

        <setHeader name="CamelFileName">
            <simple>{filename-expression}</simple>
        </setHeader>

        <!-- Read last export timestamp from partition -->
        <toD uri="pfx-config:get?name={{integration.name}}.${routeId}.export.timestamp&amp;toHeader=lastExportTimestamp"/>

        <!-- Fallback: if no timestamp stored yet, use earliest possible date (full export) -->
        <choice>
            <when>
                <simple>${headers.lastExportTimestamp} == null || ${headers.lastExportTimestamp} == ''</simple>
                <setHeader name="lastExportTimestamp">
                    <constant>1970-01-01T00:00:00</constant>
                </setHeader>
            </when>
        </choice>

        <!-- Capture current time as upper bound for delta window -->
        <setHeader name="currentExportTimestamp">
            <simple>${date-with-timezone:now:UTC:yyyy-MM-dd'T'HH:mm:ss}</simple>
        </setHeader>

        <!-- Fetch only changed records in batches -->
        <toD uri="pfx-api:fetch?objectType={TYPE}&amp;filter={route-name}.filter&amp;batchedMode=true&amp;batchSize={BATCH_SIZE}"/>

        <split>
            <simple>${body}</simple>
            <to uri="pfx-api:fetchIterator"/>
            <toD uri="pfx-model:transform?mapper={route-name}.mapper"/>
            <toD uri="pfx-csv:marshal?camelSplitIndexAware=true"/>
            <to uri="{target-uri}"/>
            <setBody><constant/></setBody>
        </split>

        <!-- Save upper bound timestamp to partition for next run -->
        <toD uri="pfx-config:set?name={{integration.name}}.${routeId}.export.timestamp&amp;value=${headers.currentExportTimestamp}"/>

        <log message="Delta export completed: {route-name}" loggingLevel="INFO"/>
    </route>
</routes>
```

**Delta filter template** (see `docs/filters.md` for all operators and patterns):
```xml
<filter id="{route-name}.filter"
        sortBy="lastUpdateDate"
        resultFields="{comma-separated-fields}">
    <and>
        <!-- For PX/CX: also add <criterion fieldName="name" operator="equals" value="{ExtensionName}"/> -->
        <criterion fieldName="lastUpdateDate" operator="greaterThan" value="simple:${headers.lastExportTimestamp}"/>
        <criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:${headers.currentExportTimestamp}"/>
    </and>
</filter>
```

The `${headers.lastExportTimestamp}` is populated by `pfx-config:get` with the stored timestamp. On first run (no stored value), all records are exported.

**Note:** Always use UTC timestamps and set timezone explicitly on Quartz (e.g., `trigger.timeZone=UTC`).

### Marked / consistent export pattern (DMDS/DS)

This pattern uses a row-level status flag instead of a timestamp window. Best for DMDS or DS exports where background flushes, recalculations, or upstream loads may modify rows **during** the export. By marking rows as `Processing` up front, the export operates on a stable snapshot regardless of concurrent writes.

**Prerequisites:**
- The data source must have a status column (the sample uses `Exported`, but any name works — `IntegrationStatus`, `ExportStatus`, etc.).
- Optional but recommended companion columns: `ExportedFile` (records which file each row went into) and `ExportedDate` (timestamp).

**How it works:**
1. Pre-count rows with `countOnly=true`; if 0, stop early.
2. `massedit` flips matching rows from null/non-Exported to `Processing`.
3. Fetch rows where status = `Processing` (paginated, batched).
4. Marshal to CSV, append to file.
5. `massedit` flips `Processing` → `Exported` and stamps `ExportedFile` + `ExportedDate`.
6. Write a `.done` marker file.
7. On any error, `onException` flips the `Processing` rows to `Failed` (preserving file + date for traceability).

**Two filters are needed** (reused by both fetch and massedit):

`src/main/resources/repo/filters/{TableName}-count-filter.xml` — rows eligible to be exported:
```xml
<filters>
    <filter id="{TableName}-count-filter" sortBy="{stable-sort-fields}">
        <or>
            <criterion fieldName="Exported" operator="isNull"/>
            <criterion fieldName="Exported" operator="notEqual" value="Exported"/>
        </or>
    </filter>
</filters>
```

`src/main/resources/repo/filters/{TableName}-processing-filter.xml` — rows currently marked for this run:
```xml
<filters>
    <filter id="{TableName}-processing-filter" sortBy="{stable-sort-fields}">
        <and>
            <criterion fieldName="Exported" operator="equals" value="Processing"/>
        </and>
    </filter>
</filters>
```

**Naming note:** filters in this pattern are named after the **table** (not the route), because the route references them dynamically as `${header.source}-count-filter` / `${header.source}-processing-filter`. The filter `id` still matches the file name (per the resource-ID rule).

**Marked export route template:**
```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}"
           autoStartup="{{pfx:{route-name}.auto-startup:false}}"
           description="Consistent export of {TableName} to CSV.">
        <from uri="seda:{route-name}?concurrentConsumers=1"/>

        <!-- On failure, mark Processing rows as Failed and propagate -->
        <onException redeliveryPolicyRef="defaultRedeliveryPolicyConfig">
            <exception>java.lang.Exception</exception>
            <handled><constant>false</constant></handled>
            <toD uri="pfx-api:massedit?massEditFields=Exported;Failed,ExportedFile;${header.CamelFileNameOnly},ExportedDate;${header.dateExported}&amp;filter=${header.source}-processing-filter&amp;objectType=DMDS&amp;dataSourceName=DMDS.${header.source}"/>
            <log message="${header.source} marked as Failed." loggingLevel="ERROR"/>
        </onException>

        <setHeader name="source"><constant>{TableName}</constant></setHeader>

        <!-- Count rows to export -->
        <toD uri="pfx-api:fetch?objectType=DM&amp;dsUniqueName=DMDS.${header.source}&amp;filter=${header.source}-count-filter&amp;countOnly=true"/>
        <setProperty name="exportedRows"><simple>${header.totalRows}</simple></setProperty>
        <log message="Determined ${exchangeProperty.exportedRows} rows to export." loggingLevel="INFO"/>
        <choice>
            <when>
                <simple>${exchangeProperty.exportedRows} == 0</simple>
                <log message="Nothing to export. Stopping route..."/>
                <stop/>
            </when>
        </choice>

        <setHeader name="CamelFileNameOnly"><simple>{TableName}_${date:now:yyyyMMdd_HHmmss}.csv</simple></setHeader>
        <setHeader name="CamelFileName"><simple>{{integration.sftp.root}}/{export-folder}/tmp/${header.CamelFileNameOnly}</simple></setHeader>
        <!-- Update CSVHeader whenever resultFields on the processing-filter changes -->
        <setHeader name="CSVHeader"><constant>{Col1},{Col2},{Col3}</constant></setHeader>
        <setHeader name="dateExported"><simple>${date:now:yyyy-MM-dd'T'HH:mm:ss.SSS'Z'}</simple></setHeader>

        <!-- Mark rows as Processing → creates the stable snapshot -->
        <toD uri="pfx-api:massedit?massEditFields=Exported;Processing&amp;filter=${header.source}-count-filter&amp;objectType=DMDS&amp;dataSourceName=DMDS.${header.source}"/>

        <!-- Fetch the marked rows in batches -->
        <toD uri="pfx-api:fetch?objectType=DM&amp;dsUniqueName=DMDS.${header.source}&amp;filter=${header.source}-processing-filter&amp;batchedMode=true&amp;batchSize={{pfx:{route-name}.batch-size}}"/>
        <split>
            <simple>${body}</simple>
            <log loggingLevel="INFO" message="Exporting batch #${exchangeProperty.CamelSplitIndex} for ${header.CamelFileNameOnly}"/>
            <toD uri="pfx-api:fetch?objectType=DM&amp;dsUniqueName=DMDS.${header.source}&amp;filter=${header.source}-processing-filter"/>
            <toD uri="pfx-model:transform?mapper={route-name}.mapper"/>
            <toD uri="pfx-csv:marshal?header=${header.CSVHeader}&amp;camelSplitIndexAware=true"/>
            <to uri="file://?fileExist=Append"/>
            <setBody><constant/></setBody>
        </split>

        <!-- Mark exported rows as Exported and stamp file + date -->
        <toD uri="pfx-api:massedit?massEditFields=Exported;Exported,ExportedFile;${header.CamelFileNameOnly},ExportedDate;${header.dateExported}&amp;filter=${header.source}-processing-filter&amp;objectType=DMDS&amp;dataSourceName=DMDS.${header.source}"/>

        <!-- Done file marker for downstream consumers -->
        <setBody><constant/></setBody>
        <toD uri="file://{{integration.sftp.root}}/{export-folder}/tmp/?fileName=${header.CamelFileNameOnly}.done"/>

        <log message="${header.source} export done."/>
    </route>
</routes>
```

**Key details:**
- **`objectType=DM` for fetch, `objectType=DMDS` for massedit.** The data mart fetch and the data source massedit are on different objects — getting this wrong silently no-ops the massedit.
- **`camelSplitIndexAware=true` on `pfx-csv:marshal`** writes the CSV header only on the first chunk; subsequent chunks are data-only. Required when using `fileExist=Append` with chunked CSV.
- **`<setBody><constant/></setBody>` after the file write** prevents the body from accumulating across split iterations — important for large exports.
- **`autoStartup="{{pfx:{route-name}.auto-startup:false}}"`** lets ops enable/disable the route via property without redeploy.
- **`from seda:`** means the route is triggered asynchronously. Pair it with either a scheduler route, a `direct:` caller, or an event listener (e.g. the `PADATALOAD_COMPLETED` event for DS-flush-driven exports — see [generate-event-driven-route](../generate-event-driven-route/SKILL.md)).
- **`redeliveryPolicyRef="defaultRedeliveryPolicyConfig"`** references a shared redelivery bean. If the project does not have one, omit the attribute or define the bean.

## Step 4c: Smart Field Selection (for PX/CX with metadata)

When exporting from PX/CX and attribute metadata is available (from `product-extension-metadata` or `customer-extension-metadata`), **automatically propose the export field list and CSV column names** using the attribute labels. Do NOT ask the user to manually list fields — propose and let them confirm.

### Auto-Proposal Algorithm

1. Fetch attribute metadata → get labels and types for each attribute
2. Include only attributes that have labels set (skip empty/unconfigured attributes)
3. Always include `sku` (mapped to "SKU" or "Product ID" in CSV)
4. Use the attribute label as the CSV column name in the mapper

**Example proposal:**

```
Based on metadata for PX "MichaluvTest", I propose exporting these fields:

| # | Pricefx Field | → | CSV Column Name       | Type     |
|---|---------------|---|-----------------------|----------|
| 1 | sku           | → | SKU                   | string   |
| 2 | attribute1    | → | Product Name          | TEXT     |
| 3 | attribute2    | → | Product Hierarchy 1   | TEXT     |
| 4 | attribute9    | → | Product Costs         | NUMERIC  |
| 5 | attribute13   | → | Generic Product Attr 3| DATE     |

Skipped: attribute3–attribute8, attribute10–attribute12 (no labels configured)
```

Ask: **Does this look correct? Add/remove fields or adjust column names?**

This replaces the manual field selection in Step 5 when metadata is available.

## Step 5: Field Selection

Ask the user: **Which fields do you want to export?**
Show the available fields from Step 3. Also ask about:
- Filters (which records to include/exclude)
- Sort order
- Any field transformations needed

## Step 5b: Scheduling

Ask the user: **When should the export run?**

| Option | Scheduler URI | Description |
|---|---|---|
| Once (manual/on startup) | `timer://runOnce?repeatCount=1` | Runs once when IM starts |
| Every N minutes | `timer://export?period={N*60000}` | Simple repeating timer |
| Cron (Quartz) | `quartz://export/{route-name}?cron={cron-expression}` | Full cron scheduling |

**Common Quartz cron examples:**

| Schedule | Cron Expression | URI |
|---|---|---|
| Every day at 6:00 AM | `0+0+6+*+*+?` | `quartz://export/{route-name}?cron=0+0+6+*+*+?` |
| Every day at midnight | `0+0+0+*+*+?` | `quartz://export/{route-name}?cron=0+0+0+*+*+?` |
| Every hour | `0+0+*+*+*+?` | `quartz://export/{route-name}?cron=0+0+*+*+*+?` |
| Every 30 minutes | `0+0/30+*+*+*+?` | `quartz://export/{route-name}?cron=0+0/30+*+*+*+?` |
| Mon–Fri at 8:00 AM | `0+0+8+?+*+MON-FRI` | `quartz://export/{route-name}?cron=0+0+8+?+*+MON-FRI` |
| Every Sunday at 2:00 AM | `0+0+2+?+*+SUN` | `quartz://export/{route-name}?cron=0+0+2+?+*+SUN` |
| First day of month at 1:00 AM | `0+0+1+1+*+?` | `quartz://export/{route-name}?cron=0+0+1+1+*+?` |

**Note:** In Quartz cron URIs, spaces are replaced with `+` in the URI. Cron format: `seconds minutes hours day-of-month month day-of-week`.

### Quartz Best Practices
- ALWAYS set `trigger.timeZone` explicitly (e.g., `Europe/Prague`, `UTC`)
- ALWAYS set `stateful=true` to prevent overlapping executions
- Use `+` instead of spaces in cron expressions within URIs

Default: `timer://runOnce?repeatCount=1` (run once).

## Step 6: Generate Files

Generate four artifacts in separate files:

### Route Naming
- Route file: `src/main/resources/repo/routes/{descriptive-name}.xml`
- Mapper file: `src/main/resources/repo/mappers/{descriptive-name}.mapper.xml`
- Filter file: `src/main/resources/repo/filters/{descriptive-name}.filter.xml`
- Route ID: `{descriptive-name}` (must match file name without `.xml`)

### Route XML — Fetch and Export Pattern

Use `<routes>` format (standalone). Route file contains ONLY the route — no mapper, no filter.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{scheduler-uri}"/>

        <log message="Starting export: {route-name}" loggingLevel="INFO"/>

        <setHeader name="CamelFileName">
            <simple>{filename-expression}</simple>
        </setHeader>

        <!-- Fetch from Pricefx in batches -->
        <toD uri="pfx-api:fetch?objectType={TYPE}&amp;filter={route-name}.filter&amp;batchedMode=true&amp;batchSize={BATCH_SIZE}"/>

        <split>
            <simple>${body}</simple>
            <to uri="pfx-api:fetchIterator"/>
            <toD uri="pfx-model:transform?mapper={route-name}.mapper"/>
            <!-- camelSplitIndexAware=true: write CSV header only on the first chunk (required with fileExist=Append) -->
            <toD uri="pfx-csv:marshal?camelSplitIndexAware=true"/>
            <!-- Write to target -->
            <to uri="{target-uri}"/>
            <!-- Free the body so it doesn't accumulate across split iterations -->
            <setBody><constant/></setBody>
        </split>

        <log message="Export completed: {route-name}" loggingLevel="INFO"/>
    </route>
</routes>
```

There is NO `extensionName` parameter on `pfx-api:fetch`. For PX and CX, the extension/table name is specified in the **filter** as a criterion: `<criterion fieldName="name" operator="equals" value="{ExtensionName}"/>`

**Target URI patterns:**

| Target | URI Pattern |
|--------|-------------|
| CSV file | `file://{{integration.sftp.root}}/{user-path}?fileName=${header[CamelFileName]}&amp;fileExist=Append` |
| SFTP | `pfx-sftp://{{pfx:{route-name}.sftp.path}}?connection={{pfx:{route-name}.sftp.connection}}` |
| Database | Use `pfx-sql:insert` or `pfx-sql:upsert` |
| REST API | Use `pfx-rest:post` with connection |

### Filter XML (separate file)

File: `src/main/resources/repo/filters/{route-name}.filter.xml`

**Full filter reference (operators, logic, patterns):** See `docs/filters.md`

```xml
<filter id="{route-name}.filter"
        sortBy="{sort-field}"
        resultFields="{comma-separated-fields}">
    <and>
        <!-- For PX/CX: MUST include name criterion to specify the extension table -->
        <criterion fieldName="name" operator="equals" value="{ExtensionName}"/>
        <!-- Add more criteria as needed -->
    </and>
</filter>
```

For PX and CX exports, the `<criterion fieldName="name" ...>` is **required** to specify which extension table to fetch from. For P, C, DS this criterion is not needed.

Ask the user if they want to add filter conditions. Offer common options:
- Filter by field value (equals, contains, startsWith, etc.)
- Filter by numeric range (greaterOrEqual/lessOrEqual or isBetween)
- Filter by non-empty fields (notNull)
- Filter by list of values (in)
- See `docs/filters.md` for the full list of operators and examples.

### Mapper XML (separate file)

File: `src/main/resources/repo/mappers/{route-name}.mapper.xml`

Maps Pricefx field names to output CSV column names.

```xml
<mappers>
    <loadMapper id="{route-name}.mapper">
        <body in="sku" out="Product ID"/>
        <body in="attribute1" out="Column Name"/>
        <!-- ... -->
    </loadMapper>
</mappers>
```

### Output Filename

The filename is set directly in the `<setHeader name="CamelFileName">` element using a Camel Simple expression. NEVER use a property placeholder for the filename.

Ask the user: **What should the output file be named?** Offer these options:

| Option | Example Expression | Result |
|---|---|---|
| Static name | `export-kokos.csv` | `export-kokos.csv` |
| With date | `export-kokos-${date:now:yyyy-MM-dd}.csv` | `export-kokos-2026-03-11.csv` |
| With date+time | `export-kokos-${date:now:yyyy-MM-dd_HH-mm-ss}.csv` | `export-kokos-2026-03-11_14-30-00.csv` |
| With timestamp | `export-kokos-${date:now:yyyyMMddHHmmss}.csv` | `export-kokos-20260311143000.csv` |

Default: static name like `export-{type}.csv`.

### Properties

Export routes typically require NO properties. The filename, scheduler, batchSize, and file path are all hardcoded in the route XML. Only add properties when needed (e.g., SFTP connection).

**Important:** The file output directory MUST use `{{integration.sftp.root}}/{path}` directly in the route XML, NEVER as a property placeholder. **Always derive the folder name from context** — do NOT ask the user for the path. Use the source table/extension name converted to kebab-case (e.g., `MichaluvTest` → `/michaluv-test`, `CustomerHierarchy` → `/customer-hierarchy`). Propose the derived path and let the user override if needed.

### Parallel Export to Multiple Destinations

When exporting to both SFTP and S3, or writing multiple file formats:

```xml
<multicast parallelProcessing="true">
  <to uri="direct:export-to-sftp"/>
  <to uri="direct:export-to-s3"/>
</multicast>
```

## Batch Size

Choose `batchSize` based on number of fields:
- **Few fields (< 10):** `batchSize=500000`
- **Medium fields (10–20):** `batchSize=100000–200000`
- **Many fields (20+):** `batchSize=50000` or less

## Important Rules

- **When changing exported fields, ALWAYS update BOTH the filter (`resultFields`) AND the mapper (`<body>` entries) to keep them in sync.** Changing only one causes errors or missing columns.
- NEVER use generic/placeholder field names — always fetch real metadata
- Route ID MUST match the route file name (without `.xml`). Do NOT use `pfx:` prefix in route ID. Example: file `export-products-to-csv.xml` → `id="export-products-to-csv"`
- All URI parameters with `&` MUST be escaped as `&amp;` in XML
- For batched fetch: use the two-step pattern (batched fetch for pagination, then inner fetch per batch)
- Export routes use `<routes>` format (standalone) — route, mapper, and filter are in SEPARATE files
- Route file contains ONLY the route XML, NEVER inline mapper or filter beans
- Do NOT include `connection=pricefx` parameter — the default Pricefx connection is named `pricefx` and is used automatically. Only add `connection={name}` when the project has multiple Pricefx connections and a non-default one is needed.
- Do NOT use `pfx-sftp` with `default-sftp-connection` — the SFTP storage is mounted into the IM pod's local file system. Use `file://{{integration.sftp.root}}/{path}` instead for better performance. Only use `pfx-sftp` for external SFTP servers.
- **Resource ID naming rule:** The `id` attribute of filters, mappers, and routes MUST match the file name (without `.xml`). Example: file `export-products.filter.xml` → `id="export-products.filter"`. Using a different ID (e.g., `exportProductsFilter`) will cause deployment failure.
- For incremental exports, save the timestamp AFTER successful export, not before
- Always add `sortBy=lastUpdateDate,id` on fetch to ensure consistent pagination
- Never use `batchedMode=false` for large exports — it loads everything into memory
- For DMDS / DS exports where background flushes or calculations may modify data during the export, prefer the **marked / consistent export pattern** (Step 4b) over timestamp delta — it guarantees a stable snapshot.
- In the marked pattern, **fetch uses `objectType=DM`** but **massedit uses `objectType=DMDS` with `dataSourceName=DMDS.{table}`**. Mismatching these silently no-ops the massedit.
- When using `fileExist=Append` with chunked CSV exports, always set `camelSplitIndexAware=true` on `pfx-csv:marshal` — otherwise the CSV header is repeated in every batch.
- Inside a large `<split>`, clear the body after the file write with `<setBody><constant/></setBody>` to prevent per-iteration memory growth.
- For DMDS exports triggered by `PADATALOAD_COMPLETED` / `DS_FLUSH` events, use `seda:{route-name}?concurrentConsumers=1` so the event listener returns immediately and the export runs asynchronously. See [generate-event-driven-route](../generate-event-driven-route/SKILL.md).
- Use `countOnly=true` to precheck row count and `<stop/>` early when there is nothing to export — avoids writing empty files and pointless massedits.
