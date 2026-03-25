---
name: generate-from-requirement
description: Read a business requirement doc from docs/requirements/ and generate the full integration (route, mapper, filter, test data) without interactive questions. Use this skill when the user says "generate from requirement", "build from spec", references a requirement doc, or wants to turn a written specification into a working integration. All information comes from the document — no questions asked.
---

# Generate Integration from Requirement

You read a business requirement document and generate the complete integration without asking questions. All information needed is in the requirement doc.

## Step 1: Find the Requirement

If $ARGUMENTS contains a filename or path, read that file.
Otherwise, list all files in `docs/requirements/` (excluding TEMPLATE.md) and ask the user which one to generate.

## Step 2: Parse the Requirement

Read the markdown file and extract:

| Field | Required | Example |
|---|---|---|
| Direction | yes | `import` or `export` |
| Object type | yes | `P`, `PX`, `CX`, `C`, `DMDS`, `LTV`, `MLTV2` |
| Table name | for PX/CX/DMDS | `MichaluvTest` |
| Target/Source | yes | `CSV file`, `SFTP` |
| Fields | yes | table of mappings or `all fields` |
| Filter | no | conditions |
| Schedule | for exports | `every 10 minutes`, `cron`, `once` |
| Sync mode | for exports | `full` or `delta` |

## Step 3: Fetch Metadata

Run the appropriate `pfx` CLI command to get real field metadata:
- P: `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-metadata`
- PX: `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}` + `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}`
- CX: `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}` + `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {name}`

## Step 4: Resolve Fields

### If "all fields" is specified:
- Include all attributes that have labels set (from metadata)
- Always include the key field (sku for P/PX/DS, customerId for C/CX)
- Always include label
- Skip empty/unconfigured attributes

### If a field table is provided:
- Validate that listed fields exist in metadata
- Use the CSV Column names from the table for mapper `in`/`out` fields

### If field labels are listed without a table:
- Match labels against metadata to find the correct attributeN field names
- Warn if a label doesn't match any attribute

## Step 5: Resolve Filter

Parse the filter conditions from the requirement. Supported patterns:

| Requirement Pattern | Filter XML |
|---|---|
| `Field = value` | `<criterion fieldName="X" operator="equals" value="value"/>` |
| `Field != value` | `<criterion fieldName="X" operator="notEqual" value="value"/>` |
| `Field = A or B` | `<or><criterion ... value="A"/><criterion ... value="B"/></or>` |
| `Field > N` | `<criterion fieldName="X" operator="greaterThan" value="N"/>` |
| `Field >= N` | `<criterion fieldName="X" operator="greaterOrEqual" value="N"/>` |
| `Field < N` | `<criterion fieldName="X" operator="lessThan" value="N"/>` |
| `Field <= N` | `<criterion fieldName="X" operator="lessOrEqual" value="N"/>` |
| `Field is not empty` | `<criterion fieldName="X" operator="notNull"/>` |
| `Field is empty` | `<criterion fieldName="X" operator="isNull"/>` |
| `Field contains X` | `<criterion fieldName="X" operator="contains" value="X"/>` |
| `Field starts with X` | `<criterion fieldName="X" operator="startsWith" value="X"/>` |
| `Field between A and B` | `<criterion fieldName="X" operator="betweenInclusive" value="A;B"/>` |

Map field labels to actual fieldNames (attributeN) using metadata.

**Important:** For numeric fields, NEVER use `inSet`. Use `<or>` with multiple `equals` instead.

## Step 6: Resolve Schedule

| Requirement Pattern | URI |
|---|---|
| `once` | `timer://runOnce?repeatCount=1` |
| `every N minutes` | `timer://export?period={N*60000}` |
| `every N hours` | `timer://export?period={N*3600000}` |
| `every day at HH:MM` | `quartz://export/{route-name}?cron=0+{MM}+{HH}+*+*+?` |
| `every hour` | `quartz://export/{route-name}?cron=0+0+*+*+*+?` |
| `weekdays at HH:MM` | `quartz://export/{route-name}?cron=0+{MM}+{HH}+?+*+MON-FRI` |
| cron expression | Use as-is |

## Step 7: Derive Names

From the requirement filename and content, derive:
- **Route name:** `{direction}-{object}-{table}-to/from-{target}` in kebab-case
  - Example: `export-products-to-csv`, `import-csv-to-customer-hierarchy`
- **File output path:** `{{integration.sftp.root}}/{table-kebab-case}`

## Step 8: Generate All Files

Generate the complete integration. Follow ALL rules from the existing generate-import-integration (for P/PX/CX/C), generate-pa-import-integration (for DMDS/PA Data Source), and generate-export-integration skills.

### For Exports, generate:
1. Route XML (`src/main/resources/repo/routes/{name}.xml`)
2. Mapper XML (`src/main/resources/repo/mappers/{name}.mapper.xml`)
3. Filter XML (`src/main/resources/repo/filters/{name}.filter.xml`)

### For Imports, generate:
1. Route XML (`src/main/resources/repo/routes/{name}.xml`)
2. Mapper XML (`src/main/resources/repo/mappers/{name}.mapper.xml`)

### Always:
- Keep filter `resultFields` and mapper fields in sync (for exports)
- Use `{{integration.sftp.root}}` for file paths
- For PX/CX: include `name` criterion in filter (exports) or `<constant out="name">` in mapper (imports)
- For CX/C: use `customerId` as key field
- Follow all ID naming rules (ID must match filename)

## Step 9: Generate Test Data

After generating the integration files, also generate synthetic test data using the `scripts/generate-test-data.py` script:

```bash
python3 scripts/generate-test-data.py {OBJECT_TYPE} {TABLE_NAME} --rows 10
```

## Step 10: Summary

Print a summary of all generated files:

```
Generated from requirement: docs/requirements/export-products-daily.md

Files created:
- src/main/resources/repo/routes/export-products-to-csv.xml
- src/main/resources/repo/mappers/export-products-to-csv.mapper.xml
- src/main/resources/repo/filters/export-products-to-csv.filter.xml
- src/test/resources/data/products/test-data.csv

Configuration:
- Direction: export
- Object: P (Product)
- Schedule: every day at 6:00 AM
- Filter: Competition = AUTO or CHEM
- Fields: 7 (sku, label, attribute1-5)
```

## Important Rules

- **NEVER ask interactive questions** — all information must come from the requirement doc
- If critical information is missing from the requirement, list what's missing and stop
- Follow ALL rules from generate-import-integration (P/PX/CX/C), generate-pa-import-integration (DMDS), generate-ppv-import-integration (LTV/MLTV2), and generate-export-integration skills
- Validate generated files against review-integration agent rules before finishing
- If the requirement references fields that don't exist in metadata, warn and skip those fields
