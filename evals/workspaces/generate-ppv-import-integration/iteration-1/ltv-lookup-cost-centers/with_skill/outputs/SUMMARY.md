# Import PPV: Department Cost Centers (LTV / SIMPLE)

Imports a 200-row CSV lookup table mapping **department codes** to **cost centers** into a Pricefx Pricing Parameter table as a single-key (SIMPLE / LTV) lookup.

## Generated files

| File | Purpose |
|---|---|
| `import-ppv-department-cost-centers.xml` | Camel route — picks up CSV, streams it to Pricefx |
| `import-ppv-department-cost-centers.mapper.xml` | Maps CSV columns to LTV `name` / `value` fields |
| `application.properties` | Shared file-handling properties (archive, read lock) |

Install paths:
- `src/main/resources/repo/routes/import-ppv-department-cost-centers.xml`
- `src/main/resources/repo/mappers/import-ppv-department-cost-centers.mapper.xml`
- properties merge into `src/main/resources/repo/config/application.properties`

## Design choices (assumed defaults — no pfx CLI available)

| Aspect | Value | Reason |
|---|---|---|
| Pricing parameter table | `DepartmentCostCenters` | Derived from prompt; LTV / SIMPLE single-key shape |
| `objectType` | `LTV` | User explicitly said "single-key" |
| Pricing parameter name | `DepartmentCostCenters` | `pricingParameterName` URI param |
| Import mode | Replace (`loaddataFile`) | Most common for full-refresh lookup tables |
| Source | Local file system | Default — drop CSV in `{{integration.sftp.root}}/department-cost-centers` |
| CSV header | Yes (`skipHeaderRecord=true`) | Standard CSV convention |
| Delimiter | `,` (comma) | Default CSV delimiter |
| File-safety | `readLock=changed` | No `.done` marker assumed |
| Batch size | `500000` | LTV has only 2 fields — use the high end of the recommended range |
| Camel version | 4 form | Per project default (no `Ref` suffixes, `routes` wrapper) |

## CSV -> Pricefx mapping

| CSV column | Pricefx field | Notes |
|---|---|---|
| `departmentCode` | `name` | LTV key (lookup key) |
| `costCenter` | `value` | LTV value (lookup result) |

LTV uses a fixed `name` / `value` schema — no `attribute1..N` and no `<constant ... out="name"/>` (the table is identified by `pricingParameterName` on the URI, not in the mapper).

## How it runs

1. Camel polls `{{integration.sftp.root}}/department-cost-centers` every 10 seconds.
2. `readLock=changed` waits until the file size is stable before reading.
3. `pfx-csv:streamingUnmarshal` parses the CSV header and streams rows.
4. `pfx-api:loaddataFile` streams the file straight to Pricefx with `objectType=LTV` and `pricingParameterName=DepartmentCostCenters`. This is a **replace** load.
5. The processed file is archived to `.archive/YYYY/MM/<name>__<timestamp>.<ext>`.

## Observability note

`streamingUnmarshal` + `loaddataFile` uploads as one opaque stream — IM logs only show start/end, no per-batch progress. For a 200-row file this is fine; if the file ever grows large and per-batch logging is required, switch to a `<split>` + `tokenize` + `pfx-api:loaddata` pattern.

## Things the user may want to adjust

- Real CSV column names — `departmentCode` / `costCenter` are assumptions; rename in the mapper if the source uses different headers.
- Folder path — currently `department-cost-centers` under `integration.sftp.root`; change in the `<from>` URI if needed.
- Upsert instead of replace — swap `loaddataFile`/`loadMapper` for `pfx-api:integrate` + `pfx-csv:unmarshal` + `<integrateMapper>` if records should be merged instead of replaced.
- Create the `DepartmentCostCenters` Pricing Parameter table in the partition first via the Pricefx UI or `pfx create-pricing-parameter DepartmentCostCenters` (type SIMPLE, valueType STRING).
