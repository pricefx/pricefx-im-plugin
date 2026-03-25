---
name: generate-ppv-import-integration
description: Generate a Pricefx Pricing Parameter (Company Parameter) import integration for LTV (single-key lookup table) or MLTV2 (multi-key matrix table). Use this skill whenever the user wants to import pricing parameters, company parameters, lookup tables, exchange rates, discount matrices, or any key/value configuration data into Pricefx. Fetches real metadata from the partition via pfx CLI.
---

# Generate Pricing Parameter Import Integration

You are generating an import integration for **Pricing Parameters** (also called Company Parameters / Lookup Tables) in a Pricefx Integration Manager project. Follow the steps below precisely. NEVER use placeholder/generic fields — always use real field names from the partition.

## Company Parameter Types Reference

### Table Types

| API Type | IM objectType | Description | Keys | Use Case |
|---|---|---|---|---|
| `SIMPLE` | `LTV` | Single-key lookup | 1 key (`name`) | Exchange rates, discount codes, status lookups |
| `RANGE` | `LTV` | Range-based lookup | 1 key (`name`) + bounds | Tax brackets, volume discounts, tiered pricing |
| `MATRIX` | `MLTV2` | 2-key matrix | `key1`, `key2` | Price by region+product, discount by segment+category |
| `MATRIX2` | `MLTV2` | 3-key matrix | `key1`–`key3` | Price by region+product+channel |
| `MATRIX3` | `MLTV2` | 4-key matrix | `key1`–`key4` | Multi-dimensional pricing |
| `MATRIX4` | `MLTV2` | 5-key matrix | `key1`–`key5` | Complex multi-dimensional lookups |
| `MATRIX5` | `MLTV2` | 6-key matrix | `key1`–`key6` | Maximum dimensionality lookups |

### Value Types (the `valueType` when creating a table)

| valueType | Description | Example |
|---|---|---|
| `REAL` | Decimal number (most common) | Prices, rates, percentages |
| `STRING` | Text value | Status codes, category names |
| `INTEGER` | Whole number | Counts, rankings |
| `DATE` | Date | Effective dates, expiry dates |
| `DATETIME` | Date + time | Timestamps |
| `BOOLEAN` | True/false | Flags, toggles |

## Field Structures

### LTV — SIMPLE (Single-Key Lookup)

Fixed field structure — every SIMPLE table has exactly these fields:

| Field | Description |
|---|---|
| `name` | The lookup key (required) |
| `value` | The lookup value (required) |

Example CSV: `code,rate` → maps to `name,value`

### LTV — RANGE (Range-Based Lookup)

| Field | Description |
|---|---|
| `name` | The lookup key (required) |
| `lowerBound` | Range lower bound |
| `upperBound` | Range upper bound |
| `value` | The lookup value (required) |

Example CSV: `tier,minQty,maxQty,discount` → maps to `name,lowerBound,upperBound,value`

### MLTV2 — MATRIX to MATRIX5 (Multi-Key Matrix)

Flexible field structure — number of keys depends on the MATRIX type:

| Field | MATRIX | MATRIX2 | MATRIX3 | MATRIX4 | MATRIX5 |
|---|---|---|---|---|---|
| `key1` | yes | yes | yes | yes | yes |
| `key2` | yes | yes | yes | yes | yes |
| `key3` | — | yes | yes | yes | yes |
| `key4` | — | — | yes | yes | yes |
| `key5` | — | — | — | yes | yes |
| `key6` | — | — | — | — | yes |
| `attribute1`–`attributeN` | values | values | values | values | values |

Example CSV (MATRIX): `region,productType,discount` → maps to `key1,key2,attribute1`
Example CSV (MATRIX2): `region,productType,channel,price` → maps to `key1,key2,key3,attribute1`

## Step 1: Check Credentials

Check `src/main/resources/repo/config/application.properties` and `src/main/resources/repo/config/application-local.properties` for `integration.pfx.*` properties.
If not found, ASK the user for: URL, partition, username, password.

## Step 2: Determine Table Type

If you already fetched the table metadata in Step 3 (the user specified a table name), the type is known from the API response. Otherwise ask:

**What type of pricing parameter are you importing?**

| Type | IM objectType | When to use |
|---|---|---|
| **SIMPLE** | `LTV` | Simple key→value pairs (exchange rates, discount codes) |
| **RANGE** | `LTV` | Range-based lookups (tax brackets, volume discounts) |
| **MATRIX** | `MLTV2` | 2-key matrix (price by region+product) |
| **MATRIX2** | `MLTV2` | 3-key matrix (price by region+product+channel) |
| **MATRIX3** | `MLTV2` | 4-key matrix |
| **MATRIX4** | `MLTV2` | 5-key matrix |
| **MATRIX5** | `MLTV2` | 6-key matrix |

If the user already specified the type (e.g., in $ARGUMENTS), skip asking. The `pricing-parameter` CLI command also shows the type in its output.

## Step 3: Select Pricing Parameter Table

Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs pricing-parameters` to list all available pricing parameter tables.

Ask the user to select a table. If the user already specified the name (e.g., in $ARGUMENTS), skip asking.

Then run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs pricing-parameter {name}` to get the table's field structure and sample data. This shows:
- Table type (LTV or MLTV2)
- Key fields and value fields
- Sample data rows

The table's `uniqueName` will be used as the `pricingParameterName` on the pfx-api URI.

## Step 4: Determine Import Mode

Ask the user: **Do you want to replace all data or upsert (update existing, insert new)?**

| Mode | API Method | Mapper Type | Description |
|---|---|---|---|
| **Replace** (default) | `pfx-api:loaddata` | `<loadMapper>` | Replaces all data in the table. Best for full refreshes. |
| **Upsert** | `pfx-api:integrate` | `<integrateMapper>` | Updates existing records, inserts new ones. Best for incremental updates. |

Default: `loaddata` (replace).

## Step 5: Determine Data Source

Ask the user: **What is the data source?**
- CSV file (local file system)
- Zipped/compressed CSV (local file system)
- SFTP
- REST API
- Other

### If file system (CSV or Zipped CSV):
**Always derive the folder name from context** — use the pricing parameter name converted to kebab-case:
- `ExchangeRate` → `/exchange-rate`
- `DiscountMatrix` → `/discount-matrix`

Propose the derived path and let the user override if needed.

The full `from` URI will be: `file://{{integration.sftp.root}}/{derived-path}?delay=10000&{{archive.file}}&{{read.lock}}`

## Step 5b: Auto-detect CSV Format from Sample Data

If the user attaches a CSV file or pastes sample data, analyze it automatically BEFORE asking remaining questions. Detect:

1. **Delimiter** — `,`, `;`, `\t`, `|`
2. **Has header row** — if the first row looks like column names
3. **Column names** — extract from header row
4. **Number of columns** — determines LTV (2 columns) vs MLTV2 (3+ columns)
5. **Data types per column** — for converter expression suggestions

Present the detected format and proposed mapping to the user for confirmation.

If auto-detected, skip Steps 6 (CSV Header), 7 (Field Mapping) — they are already resolved.

## Step 6: CSV Header

Skip this step if already auto-detected in Step 5b.

If the data source is CSV, ask: **Does the CSV file have a header row?**
- Yes (default) → `skipHeaderRecord=true`
- No → `skipHeaderRecord=false` with explicit `header` parameter

## Step 7: Field Mapping

Skip this step if already auto-detected and confirmed in Step 5b.

### For LTV:
The mapping is straightforward — ask which CSV column is the key and which is the value:

```
| CSV Column | → | Pricefx Field |
|---|---|---|
| {key column} | → | name |
| {value column} | → | value |
```

### For MLTV2:
Ask which CSV columns map to keys and which to attributes:

```
| CSV Column | → | Pricefx Field |
|---|---|---|
| {first key} | → | key1 |
| {second key} | → | key2 |
| {value column 1} | → | attribute1 |
| {value column 2} | → | attribute2 |
```

Present the proposed mapping and let the user confirm or adjust.

## Step 8: Generate Files

Generate the route and mapper files using the conventions below.

### Route Naming
- File: `src/main/resources/repo/routes/{descriptive-name}.xml`
- Route ID: `{descriptive-name}` (must match file name without `.xml`, NO `pfx:` prefix)
- Naming convention: `import-ppv-{parameter-name-kebab}` (e.g., `import-ppv-exchange-rate`)
- Use `$ARGUMENTS` or ask the user for a descriptive name

### Route XML — LTV/MLTV2 import

PPV imports use `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile` with the `pricingParameterName` parameter to identify the target table.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{route-name}">
        <from uri="{source-uri}"/>

        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>

        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true&amp;delimiter={DELIMITER}"/>

        <to uri="pfx-api:loaddataFile?objectType={LTV|MLTV2}&amp;pricingParameterName={ParameterName}&amp;mapper={route-name}.mapper&amp;batchSize={BATCH_SIZE}"/>

        <log message="Import completed for file: ${header.CamelFileName}" loggingLevel="INFO"/>
    </route>
</routes>
```

**Key parameters:**
- `objectType=LTV` for single-key lookup tables
- `objectType=MLTV2` for multi-key matrix tables
- `pricingParameterName={name}` — the pricing parameter table name in Pricefx (required). This is the `uniqueName` of the table.
- `mapper={route-name}.mapper` — field mapping
- `batchSize` — same guidance as standard imports (500000 for few fields, less for many)
- Use `loaddataFile` for loading (default), `integrate` for upsert (with `pfx-csv:unmarshal` instead of `streamingUnmarshal`)

**Source URI patterns by data source type:**

| Source | URI Pattern |
|--------|-------------|
| CSV file | `file://{{integration.sftp.root}}/{user-path}?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}` |
| Zipped CSV | Same as CSV file, then add `<to uri="pfx-io:streamCompressedFile"/>` after `<from>` and before unmarshal |
| SFTP | `pfx-sftp://{{pfx:{route-name}.sftp.path}}?connection={{pfx:{route-name}.sftp.connection}}&amp;delete=true` |
| REST API | Use `pfx-rest:get` as a `<to>` step with connection |

**File component options:**
- **Archive (default):** Always include `&amp;{{archive.file}}` on the file URI. The default property value is:
  ```properties
  archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D
  ```
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
- **Move failed (optional):** Offer `&amp;{{error.file}}` to move failed files:
  ```properties
  error.file=moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D
  ```
- NEVER use `noop=true` — files should be processed and archived/moved/deleted
- NEVER use `include` parameter by default

### Mapper XML

File: `src/main/resources/repo/mappers/{route-name}.mapper.xml`

#### LTV Mapper Example
```xml
<mappers>
    <loadMapper id="{route-name}.mapper">
        <body in="{csv-key-column}" out="name"/>
        <body in="{csv-value-column}" out="value"/>
    </loadMapper>
</mappers>
```

#### MLTV2 Mapper Example
```xml
<mappers>
    <loadMapper id="{route-name}.mapper">
        <body in="{csv-key1-column}" out="key1"/>
        <body in="{csv-key2-column}" out="key2"/>
        <body in="{csv-value1-column}" out="attribute1"/>
        <body in="{csv-value2-column}" out="attribute2" converterExpression="stringToDecimal"/>
    </loadMapper>
</mappers>
```

For upsert mode, use `<integrateMapper>` instead of `<loadMapper>`.

### Properties

Add the file handling properties to `src/main/resources/repo/config/application.properties` if not already present:

```properties
archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D
read.lock=readLock=changed
# Use done.file instead of read.lock when external system produces .done markers:
# done.file=doneFileName=%24%7Bfile:name%7D.done
```

Other properties are only needed for SFTP connections, etc.

## Important Rules

- Route ID MUST match the route file name (without `.xml`). Do NOT use `pfx:` prefix in route ID
- All URI parameters with `&` MUST be escaped as `&amp;` in XML
- `pricingParameterName` is **required** on the pfx-api URI — this identifies which pricing parameter table to load into
- The parameter on the URI is `pricingParameterName` — NOT `lookupTableName`
- PPV imports do NOT need `businessKeys` — the key structure is defined by the table type (LTV uses `name`, MLTV2 uses `key1`–`key6`)
- PPV mappers do NOT need `<constant expression="..." out="name"/>` — the table is identified by `pricingParameterName` on the URI
- Use URL-encoded values for delimiter in XML:
  - Comma: `delimiter=,`
  - Semicolon: `delimiter=;`
  - Tab: `delimiter=%09`
  - Pipe: `delimiter=%7C`
- The file input directory MUST use `{{integration.sftp.root}}/{path}` directly in the route XML
- The `mapper` parameter in route XML MUST use the mapper file name (without `.mapper.xml`), e.g., `mapper=import-ppv-exchange-rate.mapper`
- Do NOT include `connection=pricefx` parameter — the default connection is used automatically
- Do NOT use `pfx-sftp` with `default-sftp-connection` — use `file://{{integration.sftp.root}}/{path}` instead
- **Resource ID naming rule:** The `id` attribute of mappers and routes MUST match the file name (without `.xml`). Mismatched IDs cause deployment failure.
- NEVER use `noop=true` on file component
- NEVER use `include` parameter on file component by default
