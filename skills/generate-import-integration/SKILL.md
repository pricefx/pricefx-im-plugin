---
name: generate-import-integration
description: Generate a Pricefx import integration (route, mapper, properties) for any object type (P, PX, CX, DS, C). Fetches real metadata from the partition via pfx CLI.
---

# Generate Import Integration

You are generating an import integration for a Pricefx Integration Manager project. Follow the steps below precisely. NEVER use placeholder/generic fields — always use real field names from the partition.

## Step 1: Check Credentials

Check `src/main/resources/repo/config/application.properties` and `src/main/resources/repo/config/application-local.properties` for `integration.pfx.*` properties.
If not found, ASK the user for: URL, partition, username, password.

## Step 2: Determine Target Object Type

Ask the user: **What Pricefx object are you importing into?**

| Code | Object | CLI command to list | CLI for fields | CLI for labels & types |
|------|--------|--------------------|-----------------------|------------------------|
| P | Product Master | — | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-metadata` | — |
| PX | Product Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}` |
| C | Customer Master | — | — | — |
| CX | Customer Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {name}` |
| DMDS | PA Data Source | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source-metadata {name}` |

If the user already specified the object type (e.g., in $ARGUMENTS), skip asking.

### For PX: List available tables and fetch metadata
1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` to show available PX tables
2. Ask the user to select a table (or create a new one)
3. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {selected-table}` to get field names
4. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {selected-table}` to get attribute labels and types (needed for Smart Auto-Mapping)

### For CX: List available tables and fetch metadata
1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` to show available CX tables
2. Ask the user to select a table (or create a new one)
3. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {selected-table}` to get field names
4. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {selected-table}` to get attribute labels and types (needed for Smart Auto-Mapping)

### For DMDS: List available PA data sources and fetch metadata
1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` to show available data sources
2. Ask the user to select a data source
3. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {selected-table}` to get field names
4. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source-metadata {selected-table}` to get attribute labels and types

**Important:** DMDS imports use a different route pattern than P/PX/CX/C — they require `split+tokenize+loaddata` followed by `pfx-api:flush`. See the DMDS route template in Step 9.

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

After creating a new extension table, if sample CSV data is available, **auto-detect data types** from the sample rows and offer to set attribute labels and types using `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute`.

**Detection rules — analyze sample data rows for each column:**

| Detected Pattern | Pricefx Type | Pricefx Format | Example Values |
|---|---|---|---|
| All values are decimal numbers (with `.`) | `REAL` | `NUMERIC` | `4.57`, `0.247` |
| All values look like money/price | `REAL` | `MONEY` | `4.57`, `100.00` |
| All values are integers (no decimal point) | `INTEGER` | `INTEGER` | `12`, `500` |
| Values match date patterns | `DATE` | `DATE` | `2021-05-12`, `5/12/2021` |
| Values match datetime patterns | `DATETIME` | `DATETIME` | `2025-06-30 00:00:00` |
| `true`/`false`, `Y`/`N`, `0`/`1` only | `BOOLEAN` | — | `true`, `Y` |
| Everything else (default) | `STRING` | `TEXT` | any text |

**Important:** If a column has mixed types across rows (e.g., some rows are numbers, some are text), default to `STRING`/`TEXT`.

**Workflow:**
1. After creating the table, analyze the CSV sample data
2. Present detected types to the user in a table:

```
Detected attribute types for {ExtensionName}:
| Attribute | Label (from CSV header) | Detected Type | Format |
|---|---|---|---|
| attribute1 | Product Name | STRING | TEXT |
| attribute2 | Product Hierarchy 1 | STRING | TEXT |
| attribute9 | Product Costs | REAL | NUMERIC |
```

3. Ask the user: **Do you want to set these attribute labels and types? (yes/no/adjust)**
4. If yes, run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute` for each attribute:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute PX {ExtensionName} attribute1 --label "Product Name" --type STRING --format TEXT
node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs set-attribute PX {ExtensionName} attribute9 --label "Product Costs" --type REAL --format NUMERIC
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

For PX/CX: Use the `pfx` CLI commands above to get real field names and types from the partition.
For P/C/DS: Use sample data from the user or ask for field mappings manually.
Present the fields to the user in a clear table.

## Step 3b: Smart Auto-Mapping (when CSV sample data AND PX/CX metadata are available)

When you have BOTH a CSV sample/header AND target PX/CX metadata (with labels from `product-extension-metadata` or `customer-extension-metadata`), automatically propose field mappings using the algorithm below. **Do NOT ask the user to manually map fields** — propose the mapping and let them confirm or adjust.

### Auto-Mapping Algorithm

For each CSV column, find the best matching Pricefx field using these rules in priority order:

**Priority 1 — Exact key field match (confidence: HIGH)**
- CSV column name contains `id`, `sku`, `key`, `code`, `product_id`, `item_number` → map to key field:
  - For P/PX: map to `sku`
  - For C/CX: map to `customerId`
  - For DS: map to `sku`
- CSV column name contains `name`, `description`, `label`, `title` (and is not a category/hierarchy) → map to `label`

**Priority 2 — Fuzzy match against attribute labels (confidence: HIGH or MEDIUM)**
Compare each CSV column name against PX/CX attribute labels using these matching techniques:
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

- **No CSV sample data available** → fall back to manual mapping (Step 8)
- **No attribute labels set** (all labels empty in metadata) → fall back to sequential mapping + ask user
- **P, C, DS objects** (no `*-metadata` command available) → fall back to manual mapping

## Step 4: Determine Data Source

Ask the user: **What is the data source?**
- CSV file (local file system)
- Zipped/compressed CSV (local file system)
- SFTP
- Database (JDBC)
- REST API
- Other

### If file system (CSV or Zipped CSV):
**Always derive the folder name from context** — do NOT ask the user for the path. Use the target table/extension name converted to kebab-case:
- PX/CX table `MichaluvTest` → `/michaluv-test`
- CX table `CustomerHierarchy` → `/customer-hierarchy`
- Product Master → `/products`
- Customer Master → `/customers`
- DS table `SalesData` → `/sales-data`

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
| 2 | Product Name | label | String |
| 3 | Product Hierarchy 1 | attribute1 | String |
| ... | ... | ... | ... |
```

If auto-detected, skip Steps 6 (Batch Size), 7 (CSV Header) — they are already resolved.

## Step 5: Choose Import Method

**For DMDS (PA Data Source):** Skip this step — DMDS always uses `split+tokenize+loaddata+flush` pattern (see DMDS route template in Step 9). Do NOT offer `loaddataFile` for DMDS.

**For P, PX, CX, C:** Ask the user: **Which import method do you want to use?**

| Method | Best for | Description |
|--------|----------|-------------|
| `pfx-api:loaddataFile` | Default — large files, performance | Streams file directly to Pricefx server, handles batching internally |
| `pfx-api:loaddata` | Complex transformations | IM parses and maps data, sends via JSON API. Use when Groovy row-level logic is needed |

**Default:** Always use `loaddataFile` for P, PX, CX, C imports.

## Step 6: Batch Size

Ask the user: **What batch size do you want?**

Provide this guidance:
- **Few fields (< 10 attributes):** `batchSize=500000` is fine
- **Medium fields (10–20 attributes):** `batchSize=100000–200000`
- **Many fields (20+ attributes):** `batchSize=50000` or less
- More attributes per row = more memory per batch, so use smaller batch sizes

Default: `500000` for loaddataFile, `5000` for loaddata.

## Step 7: CSV Header

Skip this step if already auto-detected in Step 4b.

If the data source is CSV, ask: **Does the CSV file have a header row?**
- Yes (default) → `skipHeaderRecord=true`
- No → `skipHeaderRecord=false` — in this case, the `header` parameter must be provided on the unmarshal step with the column names

## Step 8: Field Mapping

Skip this step if already auto-detected and confirmed in Step 4b.

If not yet determined, the user can provide field mapping in one of these ways:

1. **Attach a sample CSV file** — read the file, extract the header row, and auto-generate the mapper from the column names. Propose mapping to the user (sku, label, attribute1, attribute2, ...) and let them adjust.
2. **Paste CSV header or sample data** — extract column names from the first row and propose mapping.
3. **Manually specify mappings** — ask: **Which source fields map to which Pricefx fields?** Show available target fields from Step 3.

Ask the user: **Can you attach a sample CSV file, paste the header, or list the field mappings?**

A mapper is almost always needed (99% of cases). Only skip the mapper if the CSV columns already match Pricefx field names exactly (1:1).

**Always generate a mapper file** unless the user explicitly says the file is 1:1 with Pricefx field names.

### Auto-mapping from CSV header

When extracting columns from a CSV file or header:
1. Read the first line (header row) and split by delimiter
2. The first column that looks like an ID/key → map to `sku`
3. The first column that looks like a name/description → map to `label`
4. Remaining columns → map to `attribute1`, `attribute2`, ... in order
5. Present the proposed mapping as a table and ask the user to confirm or adjust

## Step 9: Generate Files

Generate three artifacts using the conventions below.

### Route Naming
- File: `src/main/resources/repo/routes/{descriptive-name}.xml`
- Route ID: `{descriptive-name}` (must match file name without `.xml`, NO `pfx:` prefix)
- Use `$ARGUMENTS` or ask the user for a descriptive name

### Route XML — loaddataFile (recommended for CSV/zipped CSV)

Use `<routes>` format (standalone). Hardcode `batchSize` directly in the route XML based on the number of attributes.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{source-uri-with-placeholders}"/>

        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>

        <!-- Decompress (only for zipped files) -->
        <!-- <to uri="pfx-io:streamCompressedFile"/> -->

        <!-- Streaming CSV parse -->
        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord={true|false}&amp;useReusableParser=true&amp;delimiter={DELIMITER}"/>

        <!-- Import to Pricefx via file upload -->
        <to uri="pfx-api:loaddataFile?objectType={TYPE}&amp;mapper={route-name}.mapper&amp;batchSize={BATCH_SIZE}"/>

        <log message="Import completed for file: ${header.CamelFileName}" loggingLevel="INFO"/>
    </route>
</routes>
```

### Route XML — loaddata (for complex transformations)

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{source-uri-with-placeholders}"/>

        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>

        <!-- Unmarshal CSV -->
        <to uri="pfx-csv:unmarshal?skipHeaderRecord={true|false}&amp;delimiter={DELIMITER}"/>

        <!-- Map fields -->
        <to uri="pfx-mapper:{route-name}Mapper"/>

        <!-- Import to Pricefx -->
        <to uri="pfx-api:loaddata?objectType={TYPE}&amp;batchSize={BATCH_SIZE}"/>

        <log message="Import completed for file: ${header.CamelFileName}" loggingLevel="INFO"/>
    </route>
</routes>
```

### Route XML — DMDS import (PA Data Source)

DMDS imports use `loaddata` with `split+tokenize` pattern (NOT `loaddataFile`). After loading, a **flush** step is required to push data from the data feed (DMF) to the data source (DMDS).

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{source-uri-with-placeholders}"/>

        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>

        <split aggregationStrategy="recordsCountAggregation" stopOnException="true" parallelProcessing="false" streaming="true">
            <tokenize group="{BATCH_SIZE}" token="\n"/>

            <to uri="pfx-csv:unmarshal?skipHeaderRecord=true&amp;delimiter={DELIMITER}"/>

            <log loggingLevel="INFO" message="Running batch number# ${exchangeProperty.CamelSplitIndex}"/>

            <to uri="pfx-api:loaddata?objectType=DMDS&amp;dsUniqueName=DMDS.{DataSourceName}&amp;mapper={route-name}.mapper&amp;businessKeys={business-keys}"/>
        </split>

        <log message="Load completed, performing flush on {DataSourceName}" loggingLevel="INFO"/>

        <onCompletion onCompleteOnly="true">
            <toD uri="pfx-api:flush?dataFeedName=DMF.{DataSourceName}&amp;dataSourceName=DMDS.{DataSourceName}"/>
            <log message="Flush completed." loggingLevel="INFO"/>
        </onCompletion>
    </route>
</routes>
```

**DS import specifics:**
- `objectType=DMDS` — not `DS`
- `dsUniqueName=DMDS.{DataSourceName}` — required, identifies the target data source (e.g., `dsUniqueName=DMDS.PriceListDS`)
- `businessKeys` — comma-separated list of key fields (e.g., `sku` or custom keys)
- **Flush is mandatory** — after loading, `pfx-api:flush` pushes data from `DMF.{name}` to `DMDS.{name}`
- `onCompletion onCompleteOnly="true"` ensures flush only runs after successful load
- Groovy `<transform>` blocks can be added inside `<split>` for row-level filtering/transformation
- DS mappers do NOT need `<constant expression="..." out="name"/>` — the target is identified by `dsUniqueName` on the URI

**Source URI patterns by data source type:**

| Source | URI Pattern |
|--------|-------------|
| CSV file | `file://{{integration.sftp.root}}/{user-path}` |
| Zipped CSV | Same as CSV file, then add `<to uri="pfx-io:streamCompressedFile"/>` after `<from>` and before unmarshal |
| SFTP | `pfx-sftp://{{pfx:{route-name}.sftp.path}}?connection={{pfx:{route-name}.sftp.connection}}&amp;delete=true` |
| Database | Use `pfx-sql:select` as a `<to>` step |
| REST API | Use `pfx-rest:get` as a `<to>` step with connection |

**File component options:**
- NEVER use `noop=true` — files should be processed and moved/deleted
- NEVER use `include` parameter by default
- Offer the user **done file** option: `&amp;doneFileName=${file:name}.done` — waits for a `.done` marker file before processing
- Other useful options to offer: `delete=true` (delete after processing), `moveFailed=.error` (move failed files)

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
             <constant expression="FixedValue" out="name"/>                               — constant value
             <simple expression="${date:now:yyyy-MM-dd}" out="loadDate"/>                 — Camel Simple expression
             <groovy expression="body.Price?.toBigDecimal()" out="price"/>                — Groovy expression
             <header in="CamelFileName" out="attribute1"/>                                — from Camel header
             <property in="myProp" out="attribute2"/>                                     — from exchange property
        -->
    </loadMapper>
</mappers>
```

For integrate (upsert) use `<integrateMapper>` instead of `<loadMapper>`.

### Properties

Add to `src/main/resources/repo/config/application.properties` only when needed (e.g., SFTP connection, etc.).
Most CSV import routes require NO properties — delimiter, skipHeaderRecord, mapper, batchSize, and file path are all hardcoded in route XML.

## Important Rules

- NEVER hardcode values in route XML — always use `{{property}}` placeholders
- NEVER use generic/placeholder field names — always fetch real metadata
- Route ID MUST match the route file name (without `.xml`). Do NOT use `pfx:` prefix in route ID. Example: file `import-product-master.xml` → `id="import-product-master"`
- All URI parameters with `&` MUST be escaped as `&amp;` in XML
- There is NO `extensionName` parameter on `loaddataFile` or `loaddata`. For PX and CX, the table name is set in the **mapper** as a `<constant>` element (DS uses `dsUniqueName` on the URI instead):
  - `<constant expression="{TableName}" out="name"/>` — this MUST be present in the mapper (position does not matter)
  - Example for PX "Prices": `<constant expression="Prices" out="name"/>`
  - Example for CX "Segments": `<constant expression="Segments" out="name"/>`
- **DS (Data Source) imports use `objectType=DMDS`** — not `DS`. The object type code on the pfx-api URI must be `DMDS`.
- Use URL-encoded values for delimiter in XML:
  - Comma: `delimiter=,`
  - Semicolon: `delimiter=;`
  - Tab: `delimiter=%09`
  - Pipe: `delimiter=%7C`
- The file input directory MUST use `{{integration.sftp.root}}/{path}` directly in the route XML, NEVER a property placeholder. Always ask the user for the path.
- NEVER use `noop=true` on file component
- NEVER use `include` parameter on file component by default
- Offer done file option (`doneFileName=${file:name}.done`) to the user
- The `mapper` parameter in route XML MUST use the mapper file name (without `.mapper.xml`), e.g., `mapper=import-csv-to-products.mapper`. NEVER use a property placeholder.
- Do NOT include `connection=pricefx` parameter — the default Pricefx connection is named `pricefx` and is used automatically. Only add `connection={name}` when the project has multiple Pricefx connections and a non-default one is needed.
- Do NOT use `pfx-sftp` with `default-sftp-connection` — the SFTP storage is mounted into the IM pod's local file system. Use `file://{{integration.sftp.root}}/{path}` instead for better performance. Only use `pfx-sftp` for external SFTP servers.
- **Resource ID naming rule:** The `id` attribute of mappers and routes MUST match the file name (without `.xml`). Example: file `import-products.mapper.xml` → `id="import-products.mapper"`. Using a different ID (e.g., `importProductsMapper`) will cause deployment failure.
- **Key field name depends on object type:**
  - P (Product Master) and PX (Product Extension): key field is `sku`
  - C (Customer Master) and CX (Customer Extension): key field is `customerId`
  - DMDS (PA Data Source): key field is `sku`
  - NEVER use `sku` for Customer/CX imports — always use `customerId`
- **DS imports use `objectType=DMDS`** on the `pfx-api` URI, with `dsUniqueName=DMDS.{DataSourceName}` (e.g., `dsUniqueName=DMDS.PriceListDS`). DS mappers do NOT need `<constant expression="..." out="name"/>` — the data source is identified by `dsUniqueName` on the URI, not by the mapper.
