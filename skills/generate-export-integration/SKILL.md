---
name: generate-export-integration
description: Generate a Pricefx export integration (route, mapper, properties) for any object type. Fetches real metadata from the partition via pfx CLI.
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
| P | Product Master | — | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-metadata` | — |
| PX | Product Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}` |
| C | Customer Master | — | — (use sample data) | — |
| CX | Customer Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {name}` |
| DS | Data Source | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source-metadata {name}` |

If the user already specified the object type (e.g., in $ARGUMENTS), skip asking.

### For PX, CX, DS: List available tables first
1. Run the appropriate `pfx` CLI list command to show available tables
2. Ask the user to select a table (or create a new one for PX/CX)
3. For PX/CX: also run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}` or `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {name}` to get attribute labels and types

### Creating a new PX/CX table

If the user wants a new extension table, use the `pfx` CLI to create it:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs create-product-extension {Name} --label "{Label}" --attributes {N}
node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs create-customer-extension {Name} --label "{Label}" --attributes {N}
```

**Validation rules (enforced by Pricefx API — violations are silently ignored!):**
- **Name format:** Only `A-Z`, `a-z`, `0-9`, `_` allowed. Must NOT start with a number.
- **Allowed attribute counts:** Only `3, 6, 8, 10, 20, 30, 50` are valid. Any other value will be silently ignored by the API.
- When choosing the attribute count, pick the smallest allowed value that covers the number of fields needed. E.g., if 13 fields are needed, use `20`.

### Setting attribute metadata on new PX/CX tables

After creating a new extension table, offer to set attribute labels and types using `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute`.

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute PX {ExtensionName} attribute1 --label "Field Label" --type STRING --format TEXT
node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute CX {ExtensionName} attribute1 --label "Field Label" --type REAL --format NUMERIC
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
- **PX:** `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}`
- **CX:** `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}`
- **DS:** `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {name}`

Present the fields to the user in a clear table.

## Step 4: Determine Target

Ask the user: **Where should the data be exported to?**
- CSV file (local directory)
- SFTP
- Database (JDBC)
- REST API
- Other

## Step 4b: Sync Mode

Ask the user: **Full export or delta sync (only changed records)?**

| Mode | Description |
|------|-------------|
| **Full** | Exports all records every time |
| **Delta** | Only exports records modified since the last run, using a stored timestamp on the partition |

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
            <toD uri="pfx-csv:marshal"/>
            <to uri="{target-uri}"/>
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
            <toD uri="pfx-csv:marshal"/>
            <!-- Write to target -->
            <to uri="{target-uri}"/>
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

## Batch Size

Choose `batchSize` based on number of fields:
- **Few fields (< 10):** `batchSize=500000`
- **Medium fields (10–20):** `batchSize=100000–200000`
- **Many fields (20+):** `batchSize=50000` or less

## Important Rules

- **When changing exported fields, ALWAYS update BOTH the filter (`resultFields`) AND the mapper (`<body>` entries) to keep them in sync.** Changing only one causes errors or missing columns.
- NEVER use generic/placeholder field names — always fetch real metadata
- Route ID MUST start with `pfx:`
- All URI parameters with `&` MUST be escaped as `&amp;` in XML
- For batched fetch: use the two-step pattern (batched fetch for pagination, then inner fetch per batch)
- Export routes use `<routes>` format (standalone) — route, mapper, and filter are in SEPARATE files
- Route file contains ONLY the route XML, NEVER inline mapper or filter beans
- Do NOT include `connection=pricefx` parameter — the default Pricefx connection is named `pricefx` and is used automatically. Only add `connection={name}` when the project has multiple Pricefx connections and a non-default one is needed.
- Do NOT use `pfx-sftp` with `default-sftp-connection` — the SFTP storage is mounted into the IM pod's local file system. Use `file://{{integration.sftp.root}}/{path}` instead for better performance. Only use `pfx-sftp` for external SFTP servers.
- **Resource ID naming rule:** The `id` attribute of filters, mappers, and routes MUST match the file name (without `.xml`). Example: file `export-products.filter.xml` → `id="export-products.filter"`. Using a different ID (e.g., `exportProductsFilter`) will cause deployment failure.
