# Department Cost Center Lookup Import (LTV Pricing Parameter)

## Overview
Imports a ~200 row CSV that maps department codes to cost centers into a Pricefx single-key Pricing Parameter (LTV) table named `DepartmentCostCenters`. LTV is the correct object type for a single-key lookup (one key -> one value); MLTV2 would be used for matrix (multi-key) lookups.

## Files
- `import-department-cost-centers.xml` - Camel route
- `import-department-cost-centers.mapper.xml` - CSV to LTV field mapping
- `application.properties` - shared file-handling settings + route property

## CSV Format
Header row plus two columns:
```
departmentCode,costCenter
DEPT001,CC-1001
DEPT002,CC-1002
```
- `departmentCode` -> LTV `name` (key)
- `costCenter`     -> LTV `value`

Drop location: `{integration.sftp.root}/import/ppv/department-cost-centers` on the IM pod's local mount. The route uses the `file` component (not `pfx-sftp`) because this is the pod-local SFTP storage.

## Route Flow
1. Poll the import directory every 10s with `readLock=changed` so the file is only picked up once its size stabilizes.
2. Stream-unmarshal the CSV with `pfx-csv:streamingUnmarshal` (pairs with `loaddataFile`).
3. Load into Pricefx via `pfx-api:loaddataFile` with `objectType=LTV` and `pricingParameterName=DepartmentCostCenters`. For 200 rows, `batchSize=500000` means everything fits in one batch.
4. Archive the processed file under `.archive/yyyy/MM/<basename>__<timestamp>.csv` via `{{archive.file}}`.

## Why LTV
LTV is Pricefx's single-key Pricing Parameter table. Its two fixed columns are `name` (the key) and `value`. No `<constant out="name"/>` is required in the mapper - that pattern is for PX/CX extension tables. For LTV the table is identified via the `pricingParameterName` URI parameter.

## Prerequisites
1. Create the Pricing Parameter table in the partition:
   ```
   pfx create-pricing-parameter DepartmentCostCenters
   ```
2. Confirm with `pfx pricing-parameter DepartmentCostCenters` that the schema is a single-key `name` + `value` lookup.

## Triggering
File-arrival triggered. To switch to scheduled polling instead, append `scheduler=quartz&scheduler.cron=0+0/10+*+*+*+?+*` to the `from` URI.

## Camel Version
Built for Camel 4 (IM 7.x+) - property placeholders use `{{...}}`, no legacy `*Ref` attribute names.
