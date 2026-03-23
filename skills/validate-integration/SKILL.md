---
name: validate-integration
description: Validate all Integration Manager routes, mappers, and filters against project rules. Reports violations and warnings.
---

# Validate Integration

You are a code quality engineer reviewing a Pricefx Integration Manager project. Read ALL route, mapper, and filter files and check every rule below. Report violations grouped by file.

## How to Run

1. Glob all files in `src/main/resources/repo/routes/`, `src/main/resources/repo/mappers/`, `src/main/resources/repo/filters/`
2. Read every file
3. Check all rules below
4. Report results in this format:

```
## Validation Results

### ✅ route-name.xml — PASS
No issues found.

### ❌ route-name.xml — 2 errors, 1 warning
- ❌ ERROR: Route ID "pfx:route-name" does not match filename "route-name"
- ❌ ERROR: Mapper file "missing-mapper.mapper.xml" referenced but not found
- ⚠️ WARNING: batchSize is set via property placeholder, should be hardcoded

### Summary
- Files checked: 12 (4 routes, 4 mappers, 4 filters)
- Passed: 10
- Failed: 2
- Errors: 3
- Warnings: 1
```

## Route Rules

### ID and Naming
- [ ] Route ID MUST match filename without `.xml` (e.g., file `export-products.xml` → `id="export-products"`)
- [ ] Route ID must NOT have `pfx:` prefix

### XML Syntax
- [ ] All `&` in URI parameters MUST be escaped as `&amp;`

### Hardcoded vs. Property Placeholders
Both hardcoded values and property placeholders (`{{property.name}}`) are valid for ANY route parameter. Do NOT flag placeholders as warnings.

### File Paths
- [ ] File input/output URIs MUST use `{{integration.sftp.root}}`, NOT `{{integration.data}}` or `{{data.directory}}`

### Pricefx API
- [ ] `pfx-api:fetch`, `pfx-api:loaddata`, `pfx-api:loaddataFile` must NOT have `extensionName` parameter
- [ ] `connection=pricefx` must NOT be present (it's the default, adding it is redundant)

### Import Routes
- [ ] For CX/C object types: mapper must use `customerId` as key field, NOT `sku`
- [ ] For P/PX/DS object types: mapper must use `sku` as key field

### Export Routes
- [ ] Recommend using the two-step batched fetch pattern: `pfx-api:fetch` with `batchedMode=true` → `<split>` → `pfx-api:fetchIterator`. Using `pfx-api:fetch` inside `<split>` also works — this is a recommendation, not an error.

### File Component
- [ ] Import routes: check if `noop=true` is intentional (warn if present — files won't be moved/deleted after processing)

### References
- [ ] Every `mapper=X` reference in route must have a corresponding file `src/main/resources/repo/mappers/X.mapper.xml`
- [ ] Every `filter=X` reference in route must have a corresponding file `src/main/resources/repo/filters/X.filter.xml`

## Filter Rules

### ID and Naming
- [ ] Filter ID MUST match filename without `.xml` (e.g., file `export-products.filter.xml` → `id="export-products.filter"`)

### Operators
- [ ] `inSet` and `notInSet` must ONLY be used on String fields. For numeric fields, use `<or>` with multiple `equals` instead. To verify: check if the field is a numeric type in the partition metadata (use `pfx` CLI if needed).

### PX/CX Exports
- [ ] Filter MUST include `<criterion fieldName="name" operator="equals" value="{ExtensionName}"/>` when objectType is PX or CX

### Delta Sync
- [ ] If route uses delta pattern (has `pfx-config:get` for timestamp), filter MUST have both:
  - `<criterion fieldName="lastUpdateDate" operator="greaterThan" value="simple:${headers.lastExportTimestamp}"/>`
  - `<criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:${headers.currentExportTimestamp}"/>`

## Mapper Rules

### ID and Naming
- [ ] Mapper ID MUST match filename without `.xml` (e.g., file `export-products.mapper.xml` → `id="export-products.mapper"`)

### PX/CX Imports
- [ ] For PX/CX imports: mapper MUST have `<constant expression="{ExtensionName}" out="name"/>` (position within mapper does not matter)

### Key Fields
- [ ] P/PX/DS imports: must map to `sku` (not `customerId`)
- [ ] C/CX imports: must map to `customerId` (not `sku`)

## Cross-File Consistency

### Filter ↔ Mapper Sync (Exports)
- [ ] Every field in the filter's `resultFields` that is used in the route MUST have a corresponding `<body in="...">` in the mapper
- [ ] Every `<body in="...">` in the mapper MUST be present in the filter's `resultFields`
- [ ] If either is changed, both must be updated together

### Orphan Detection
- [ ] Every mapper file should be referenced by at least one route
- [ ] Every filter file should be referenced by at least one route
- [ ] Warn about unreferenced mapper/filter files (possible orphans from deleted routes)

## Running Metadata Checks

For rules that require partition metadata (e.g., checking if `inSet` is used on numeric fields):
1. Run `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-metadata`, `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}`, or `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {name}` as needed
2. Cross-reference field types with filter operators
3. Only run metadata checks if the `pfx` CLI is available (check `.env` exists)
