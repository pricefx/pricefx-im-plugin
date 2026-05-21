---
name: generate-import-integration
description: Generate a Pricefx import integration (route, mapper, properties) for Product (P), Product Extension (PX), Customer (C), Customer Extension (CX), Seller (SL), or Seller Extension (SX). Use this skill whenever the user wants to load, import, or push data INTO Pricefx from CSV files, SFTP, database, or REST API. Covers loaddataFile (streaming) and loaddata patterns, smart auto-mapping from CSV headers, and new table creation. For PA/Data Source (DMDS) imports, use generate-pa-import-integration instead. Fetches real metadata from the partition via pfx CLI.
---

# Generate Import Integration

You are generating an import integration for a Pricefx Integration Manager project. Follow the steps below precisely. NEVER use placeholder/generic fields — always use real field names from the partition.

**Supported object types:** P (Product), PX (Product Extension), C (Customer), CX (Customer Extension), SL (Seller), SX (Seller Extension).
For PA Data Source (DMDS) imports, use the `/generate-pa-import-integration` skill instead.

## Step 1: Check Credentials

Check `src/main/resources/repo/config/application.properties` and `src/main/resources/repo/config/application-local.properties` for `integration.pfx.*` properties.
If not found, ASK the user for: URL, partition, username, password.

## Step 2: Determine Target Object Type

Ask the user: **What Pricefx object are you importing into?**

| Code | Object | CLI command to list | CLI for fields | CLI for labels & types |
|------|--------|--------------------|-----------------------|------------------------|
| P | Product Master | — | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-metadata` | — |
| PX | Product Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension-metadata {name}` |
| C | Customer Master | — | — | — |
| CX | Customer Extension | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extensions` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension {name}` | `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension-metadata {name}` |
| SL | Seller Master | — | — | — |
| SX | Seller Extension | — | — | — |

**Note on SL/SX:** Seller metadata CLI commands may not be available. If metadata cannot be fetched, ask the user to provide the field mapping manually. Key field for SL/SX is `sellerId`.

If the user already specified the object type (e.g., in $ARGUMENTS), skip asking.

### For PX: List available tables and fetch metadata
1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extensions` to show available PX tables
2. Ask the user to select a table (or create a new one)
3. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension {selected-table}` to get field names
4. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs product-extension-metadata {selected-table}` to get attribute labels and types (needed for Smart Auto-Mapping)

### For CX: List available tables and fetch metadata
1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extensions` to show available CX tables
2. Ask the user to select a table (or create a new one)
3. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension {selected-table}` to get field names
4. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs customer-extension-metadata {selected-table}` to get attribute labels and types (needed for Smart Auto-Mapping)

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

After creating a new extension table, if sample CSV data is available, **auto-detect data types** from the sample rows and offer to set attribute labels and types using `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute`.

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
4. If yes, run `node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute` for each attribute:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute PX {ExtensionName} attribute1 --label "Product Name" --type STRING --format TEXT
node ${CLAUDE_PLUGIN_ROOT}/tools/dist/pfx.cjs set-attribute PX {ExtensionName} attribute9 --label "Product Costs" --type REAL --format NUMERIC
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
For P/C: Use sample data from the user or ask for field mappings manually.
Present the fields to the user in a clear table.

## Step 3b: Smart Auto-Mapping (when CSV sample data AND PX/CX metadata are available)

When you have BOTH a CSV sample/header AND target PX/CX metadata (with labels from `product-extension-metadata` or `customer-extension-metadata`), automatically propose field mappings using the algorithm below. **Do NOT ask the user to manually map fields** — propose the mapping and let them confirm or adjust.

### Auto-Mapping Algorithm

For each CSV column, find the best matching Pricefx field using these rules in priority order:

**Priority 1 — Exact key field match (confidence: HIGH)**
- CSV column name contains `id`, `sku`, `key`, `code`, `product_id`, `item_number` → map to key field:
  - For P/PX: map to `sku`
  - For C/CX: map to `customerId`
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
- **P, C objects** (no `*-metadata` command available) → fall back to manual mapping

### LLM-Enhanced Mapping Reasoning

When the 4-tier automatic matching produces LOW confidence results, apply semantic reasoning:

1. **Analyze field semantics** — don't just match names, understand meaning:
   - `Cust_Num`, `Customer_Number`, `KUNNR`, `customer_id`, `cust_no` → all map to `customerId`
   - `Mat_No`, `Material`, `SKU`, `ItemCode`, `product_code` → all map to `sku`
   - `Desc`, `Description`, `Label`, `Name`, `Title` → likely maps to `label`
   - `Cat`, `Category`, `Group`, `Class`, `Segment` → likely maps to an attribute

2. **Analyze data values** — if header matching is ambiguous, sample the data:
   - Column with values like "PRD-001", "SKU-123" → product identifier → `sku`
   - Column with values like "C-1001", "CUST-42" → customer identifier → `customerId`
   - Column with numeric values and 2 decimal places → likely a price/cost → needs `stringToDecimal` converter
   - Column with dates → needs `stringToDate` converter with detected format

3. **Cross-reference with Pricefx metadata** — if connected to a partition:
   - Fetch existing field labels and descriptions
   - Match CSV headers against field descriptions, not just field names
   - Example: Pricefx field `attribute3` has label "Product Category" → CSV column "Category" maps here

4. **Confidence display with reasoning:**
   ```
   CSV Column          → Pricefx Field    Confidence  Reasoning
   Customer_Number     → customerId       HIGH        Semantic match: customer identifier
   Mat_Desc            → label            MEDIUM      "Desc" commonly maps to description/label
   Unit_Price          → attribute1       MEDIUM      Numeric with decimals, likely price field
   XYZABC              → ???              LOW         No semantic match — ask user
   ```

5. **Always ask for confirmation** — display the proposed mapping and let user adjust before generating.

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

**IMPORTANT:** This step applies ONLY to P, PX, CX, C, SL, SX imports. For DS/DMDS (PA Data Sources), ALWAYS use the `generate-pa-import-integration` skill which uses the split+tokenize+loaddata+flush pattern. NEVER offer `loaddataFile` for DS/DMDS.

> ⚠️ **Critical trade-off — read this before choosing:**
>
> `loaddataFile` + `streamingUnmarshal` is faster and simpler, BUT it gives **NO row-level or batch-level feedback** during processing. The file streams to Pricefx as a single opaque upload; IM logs only show "started" and "complete" with the final record count. If a load takes hours, you have no visibility into how far it has progressed, no per-batch timing, and no way to spot a slow batch or partial failure mid-stream.
>
> `loaddata` + split/tokenize parses the file in IM and loads in named batches — every batch logs its number, file name, and starting row (see the batch log line in the loaddata template below). You can watch progress in the IM logs.

**You MUST ask the user explicitly before generating the route:**

> **Which import method do you want?**
> 1. **`loaddataFile`** (streaming, fast, **no progress visibility**) — recommended for small/medium files where you don't need to watch progress, or when downstream monitoring (Pricefx UI, events) is sufficient.
> 2. **`loaddata` + split/tokenize** (slower, **per-batch logging**) — recommended for large files (>500k rows), long-running loads, or any production load where you want to see batch progress in IM logs.

Do NOT silently default to `loaddataFile`. The observability difference is significant and the user should make this choice deliberately.

| Method | Best for | Observability | Description |
|--------|----------|---------------|-------------|
| `pfx-api:loaddataFile` | Small/medium files, simple maps | ❌ None — single-shot stream | Streams file to Pricefx server. Server handles batching. Minimal route code (~5 lines). |
| `pfx-api:loaddata` | Large files, long-running loads, row-level Groovy logic | ✅ Per-batch logging | IM parses CSV, batches via tokenize, logs each batch. Use when you need progress visibility or Groovy row-level transforms. |

### loaddataFile Sync Modes

| Mode | Parameter | Behavior |
|---|---|---|
| **Synchronous** (default) | _(none)_ | Route waits for Pricefx to finish processing. You get record count in response. |
| **Asynchronous** | `async=true` | Route returns immediately after upload. Pricefx processes in background. Faster, but no immediate result feedback. |

Use async when:
- Files are very large (1M+ records) and you don't need immediate confirmation
- The route triggers a CFS calculation afterward via event (not onCompletion)
- You want to minimize IM resource usage during processing

### loaddataFile Route Template

```xml
<route id="import-{{entity}}-from-sftp">
  <from uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}&amp;directory={{pfx:sftp.directory}}&amp;moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D&amp;streamDownload=true&amp;stepwise=false&amp;sortBy=file:name&amp;delay=10000"/>

  <log message="[${routeId}] Received file ${headers.CamelFileName}"/>
  <to uri="pfx-io:streamCompressedFile"/>
  <toD uri="pfx-io:setupCharset?specifiedCharset={{pfx:charset:UTF-8}}"/>
  <toD uri="pfx-csv:streamingUnmarshal?{{pfx:csv.settings}}&amp;skipHeaderRecord=true&amp;useReusableParser=true"/>
  <toD uri="pfx-api:loaddataFile?nullValue=NULL&amp;objectType={{pfx:objectType}}&amp;mapper={{pfx:mapper}}&amp;batchSize={{pfx:batch.size}}&amp;connection={{pfx:connection}}"/>

  <log message="[${routeId}] Import complete. Records: ${header.PfxTotalInputRecordsCount}"/>
</route>
```

Key: `pfx-csv:streamingUnmarshal` + `useReusableParser=true` + `pfx-api:loaddataFile` — no split, no tokenize, no Groovy.

### loaddata Route Template (only when needed)

Use this ONLY if the user explicitly needs row-level Groovy transformations:

```xml
<route id="import-{{entity}}-from-sftp">
  <from uri="pfx-sftp:parameters?connection={{pfx:sftp.connection}}&amp;directory={{pfx:sftp.directory}}&amp;move=.archive/%24%7Bdate:now:yyyyMMdd%7D/&amp;moveFailed=.error/%24%7Bdate:now:yyyyMMdd%7D/"/>

  <log message="[${routeId}] Received file ${headers.CamelFileName}"/>
  <to uri="pfx-io:streamCompressedFile"/>
  <toD uri="pfx-io:setupCharset?specifiedCharset={{pfx:charset:UTF-8}}"/>

  <split aggregationStrategy="recordsCountAggregation" streaming="true">
    <tokenize group="{{pfx:batch.size:20000}}" token="\n"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <log message="Loading batch #${exchangeProperty.CamelSplitIndex + 1} of ${header.CamelFileName} (batch size: {{pfx:batch.size:20000}}, starting at row ${exchangeProperty.CamelSplitIndex * {{pfx:batch.size:20000}} + 1})" loggingLevel="INFO"/>
    <toD uri="pfx-api:loaddata?objectType=P&amp;mapper={{pfx:mapper}}&amp;connection={{pfx:connection}}"/>
    <setBody><constant/></setBody>
  </split>

  <log message="[${routeId}] Import complete. Records: ${header.PfxTotalInputRecordsCount}"/>
</route>
```

## Step 6: Batch Size

Ask the user: **What batch size do you want?**

Provide this guidance:

**For loaddataFile (recommended):**
- **Few fields (< 10 attributes):** `batchSize=500000`
- **Medium fields (10–20 attributes):** `batchSize=100000–200000`
- **Many fields (20+ attributes):** `batchSize=50000`

**For loaddata (split+tokenize):**

| Object Type | Default Batch Size | Notes |
|---|---|---|
| P, C, SL | 20,000 | Standard master data |
| PX, CX, SX | 20,000 | Extensions |
| PPV (LTV/MLTV2) | 5,000-10,000 | Heavier records |

If the route uses `loaddata` (not `loaddataFile`), ALWAYS use `streaming="true"` on the `<split>` element.

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
2. The first column that looks like an ID/key → map to `sku` (P/PX) or `customerId` (C/CX)
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

**Source URI patterns by data source type:**

| Source | URI Pattern |
|--------|-------------|
| CSV file | `file://{{integration.sftp.root}}/{user-path}?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}` |
| Zipped CSV | Same as CSV file, then add `<to uri="pfx-io:streamCompressedFile"/>` after `<from>` and before unmarshal |
| SFTP | `pfx-sftp://{{pfx:{route-name}.sftp.path}}?connection={{pfx:{route-name}.sftp.connection}}&amp;delete=true` |
| Database | Use `pfx-sql:select` as a `<to>` step |
| REST API | Use `pfx-rest:get` as a `<to>` step with connection |

**File component options:**
- **Archive (default):** Always include `&amp;{{archive.file}}` on the file URI. This uses the `archive.file` property from `application.properties` to move processed files to a timestamped archive folder. The default property value is:
  ```properties
  archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D
  ```
  This moves processed files to e.g. `.archive/2026/03/products__20260323_143000.csv`
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
  Moves failed files to e.g. `.error/products__20260323-143000.csv`
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

Add the `archive.file` property to `src/main/resources/repo/config/application.properties` if not already present:

```properties
archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D
```

Other properties are only needed for SFTP connections, etc. Delimiter, skipHeaderRecord, mapper, batchSize, and file path are all hardcoded in route XML.

## Important Rules

- **When a route needs external template files (FreeMarker, XSLT, Velocity)**, store them in `src/main/resources/repo/resources/` and reference via `file://{{integration.data}}/repository/resources/{filename}`. Do NOT use `classpath:` — resource files are NOT on the Camel classpath after IM startup. Example: `<to uri="freemarker:file://{{integration.data}}/repository/resources/MyTemplate.ftl?allowContextMapAll=true"/>`
- NEVER hardcode values in route XML — always use `{{property}}` placeholders
- NEVER use generic/placeholder field names — always fetch real metadata
- Route ID MUST match the route file name (without `.xml`). Do NOT use `pfx:` prefix in route ID. Example: file `import-product-master.xml` → `id="import-product-master"`
- All URI parameters with `&` MUST be escaped as `&amp;` in XML
- There is NO `extensionName` parameter on `loaddataFile` or `loaddata`. For PX and CX, the table name is set in the **mapper** as a `<constant>` element:
  - `<constant expression="{TableName}" out="name"/>` — this MUST be present in the mapper (position does not matter)
  - Example for PX "Prices": `<constant expression="Prices" out="name"/>`
  - Example for CX "Segments": `<constant expression="Segments" out="name"/>`
- Use URL-encoded values for delimiter in XML:
  - Comma: `delimiter=,`
  - Semicolon: `delimiter=;`
  - Tab: `delimiter=%09`
  - Pipe: `delimiter=%7C`
- The file input directory MUST use `{{integration.sftp.root}}/{path}` directly in the route XML, NEVER a property placeholder. Always ask the user for the path.
- NEVER use `noop=true` on file component
- NEVER use `include` parameter on file component by default
- Always use either `{{read.lock}}` (default) or `{{done.file}}` on file URIs — never both, never neither
- The `mapper` parameter in route XML MUST use the mapper file name (without `.mapper.xml`), e.g., `mapper=import-csv-to-products.mapper`. NEVER use a property placeholder.
- Do NOT include `connection=pricefx` parameter — the default Pricefx connection is named `pricefx` and is used automatically. Only add `connection={name}` when the project has multiple Pricefx connections and a non-default one is needed.
- Do NOT use `pfx-sftp` with `default-sftp-connection` — the SFTP storage is mounted into the IM pod's local file system. Use `file://{{integration.sftp.root}}/{path}` instead for better performance. Only use `pfx-sftp` for external SFTP servers.
- **Resource ID naming rule:** The `id` attribute of mappers and routes MUST match the file name (without `.xml`). Example: file `import-products.mapper.xml` → `id="import-products.mapper"`. Using a different ID (e.g., `importProductsMapper`) will cause deployment failure.
- **Key field name depends on object type:**
  - P (Product Master) and PX (Product Extension): key field is `sku`
  - C (Customer Master) and CX (Customer Extension): key field is `customerId`
  - SL (Seller Master) and SX (Seller Extension): key field is `sellerId`
  - NEVER use `sku` for Customer/CX imports — always use `customerId`
  - NEVER use `sku` for Seller/SX imports — always use `sellerId`
- **SX requires table name constant:** Like PX/CX, Seller Extensions require `<constant expression="{TableName}" out="name"/>` in the mapper.
- When the user specifies a post-import calculation (CFS), use `<onCompletion onCompleteOnly="true">` to trigger it AFTER all batches complete — never inside the split loop
- Always include `<setBody><constant/></setBody>` after loaddata inside the split to release memory per batch

## Data Source Patterns (Database, REST API)

### Database Import (pfx-sql)

When the user's data source is a database, use this route pattern instead of file consumer:

```xml
<route id="{name}">
    <from uri="timer://{name}?repeatCount=1"/>
    <to uri="pfx-sql:select?sql={{db.query}}&amp;dataSource=externalDb&amp;dialect={{db.dialect}}"/>
    <to uri="pfx-api:loaddata?objectType={type}&amp;mapper={name}.mapper&amp;businessKeys={key}"/>
</route>
```

For large datasets (50k+ rows), use `pfx-sql:selectIterator` with `split`:

```xml
<to uri="pfx-sql:selectIterator?sql={{db.query}}&amp;dataSource=externalDb&amp;dialect={{db.dialect}}&amp;batchSize=5000"/>
<split>
    <simple>${body}</simple>
    <to uri="pfx-sql:selectIterator?dataSource=externalDb"/>
    <to uri="pfx-api:loaddata?objectType={type}&amp;mapper={name}.mapper&amp;businessKeys={key}"/>
</split>
```

Add database connection properties to application.properties:
```properties
integration.connections.externalDb.type=jdbc
integration.connections.externalDb.url=jdbc:{{db.type}}://{{db.host}}:{{db.port}}/{{db.name}}
integration.connections.externalDb.username={{db.username}}
integration.connections.externalDb.password={{db.password}}
db.dialect=POSTGRESQL
```

**Important:** Mapper `in` fields must match the exact database column names (typically UPPERCASE).

### REST API Import (pfx-rest)

When the user's data source is a REST API, use this route pattern:

```xml
<route id="{name}">
    <from uri="timer://{name}?repeatCount=1"/>
    <to uri="pfx-rest:get?url={{api.base.url}}/{endpoint}&amp;connection=externalApi"/>
    <to uri="pfx-json:unmarshal"/>
    <to uri="pfx-api:loaddata?objectType={type}&amp;mapper={name}.mapper&amp;businessKeys={key}"/>
</route>
```

For nested JSON responses, extract the array before loading:
```xml
<setBody>
    <groovy>body.data.items</groovy>
</setBody>
```

Use Groovy expressions in the mapper for nested fields:
```xml
<groovy expression="body.details?.name" out="label"/>
```

Add REST connection properties to application.properties:
```properties
integration.connections.externalApi.type=rest
integration.connections.externalApi.url={{api.base.url}}
integration.connections.externalApi.auth.type=oauth2
integration.connections.externalApi.auth.tokenUrl={{api.token.url}}
integration.connections.externalApi.auth.clientId={{api.client.id}}
integration.connections.externalApi.auth.clientSecret={{api.client.secret}}
```

## Step 10: Self-Check

After generating all files, run this checklist automatically. Fix any issues BEFORE presenting the result to the user. Do NOT ask — just fix silently and mention what was corrected.

### Checklist

1. **Property placeholders resolved:** Read the generated route XML. For every `{{placeholder}}` used in the route, verify the property exists in `application.properties`. If missing, add it with a sensible default. Common ones:
   - `{{integration.sftp.root}}` → `integration.sftp.root=/var/pricefx/sftp`
   - `{{archive.file}}` → the standard archive property
   - `{{read.lock}}` → `read.lock=readLock=changed`
   - `{{done.file}}` → `done.file=doneFileName=%24%7Bfile:name%7D.done`
   - `{{error.file}}` → the standard error.file property

2. **Error handling offered:** If the data source is file-based (CSV, zipped CSV, SFTP) and `{{error.file}}` is NOT on the file URI, add it and ensure the property exists in `application.properties`.

3. **Batch size vs field count:**
   - < 10 fields → batchSize should be ≤ 500000
   - 10–20 fields → batchSize should be ≤ 200000 (prefer 100000)
   - 20+ fields → batchSize should be ≤ 50000
   If the generated batchSize exceeds the recommendation, reduce it.

4. **ID consistency:**
   - Route file `{name}.xml` → route `id="{name}"`
   - Mapper file `{name}.mapper.xml` → loadMapper `id="{name}.mapper"`
   - `mapper=` parameter in route must reference the mapper ID exactly

5. **PX/CX/SX table name constant:** If objectType is PX, CX, or SX, verify the mapper contains `<constant expression="{TableName}" out="name"/>`. If missing, add it.

6. **Key field correctness:**
   - P/PX → mapper must map to `sku`
   - C/CX → mapper must map to `customerId`
   - SL/SX → mapper must map to `sellerId`

7. **No forbidden patterns:**
   - No `noop=true` on file component
   - No `connection=pricefx` (redundant)
   - No `include=` on file component
   - No `pfx-sftp` with default-sftp-connection
   - `&amp;` used for all `&` in XML attributes

8. **Additional quality gates:**
   - [ ] `streaming="true"` is set on `<split>` (for loaddata routes)
   - [ ] Batch size matches object type guidelines
   - [ ] Archive/error folder pattern is configured on file source
   - [ ] No inline Groovy exceeding 15 lines
   - [ ] All values that could change per environment use `{{pfx:...}}` properties
   - [ ] Route references pattern catalog: [CSV/SFTP Import](../../../integration-manager/docs/patterns/import-csv-sftp.md)
