# Summary — Import products.csv via SFTP daily into Product Master

## What I produced

Generated a Pricefx IM import integration for `products.csv` -> Product Master (P), polled daily from the IM pod's mounted SFTP storage:

- `routes/import-products.xml` — Camel route that polls `/import/products.csv` daily at 06:00 via Quartz scheduler, streams it through `pfx-csv:streamingUnmarshal`, and uploads to Pricefx via `pfx-api:loaddataFile` (P, batchSize=500000).
- `mappers/import-products.mapper.xml` — `loadMapper` mapping `sku -> sku`, `name -> label`, `price -> attribute1` (with `stringToDecimal` converter), `uom -> attribute2`.
- `config/application.properties` — `integration.sftp.root`, plus the `archive.file`, `read.lock`, `done.file`, and `error.file` standard property fragments.

## Assumptions

1. **Object type**: User said "Product master" -> `P`. No PX/CX consideration.
2. **SFTP source**: The user wrote "via SFTP" but the file is in `/import` (a path-like folder, not a remote SFTP server with credentials). This matches the IM pod's mounted SFTP storage, so per `docs/connections.md` "Best Practices" I used the `file://` component on `{{integration.sftp.root}}/import` rather than `pfx-sftp` with `default-sftp-connection` (which is discouraged). If the user actually meant an external SFTP server, the `<from>` URI would need to change to `pfx-sftp://...?connection={external-sftp-connection}` and a corresponding `SFTPConnection` JSON would be needed.
3. **Daily schedule**: Implemented via `scheduler=quartz&scheduler.cron=0+0+6+*+*+?` (every day at 06:00). User did not specify a time; 06:00 is a common pre-business-hours default.
4. **CSV format**: Standard comma delimiter, header row present (since columns were named in the prompt -> `skipHeaderRecord=true`).
5. **Field mapping** (since pfx CLI is unavailable here, used the synthetic-but-realistic P master mapping per the eval rules):
   - `sku` -> `sku` (key)
   - `name` -> `label` (standard P master display field)
   - `price` -> `attribute1` (P master has generic `attribute1..N` slots; price is not a real master field, so it goes into an attribute. `stringToDecimal` converter applied.)
   - `uom` -> `attribute2`
6. **Import method**: `loaddataFile` (streaming, single-shot) — chosen because the user did not ask for per-batch progress visibility and the prompt suggests a small/modest daily file. The skill normally requires asking the user explicitly between `loaddataFile` and `loaddata`+split; the eval rules say not to clarify, so I picked the recommended default for a small file.
7. **Batch size**: 500000 (< 10 fields per skill guidance).
8. **Camel version**: Defaulted to Camel 4 attribute form (the skill's default when version is unclear). No Camel-3-only attributes are used (the route has no `<split>`, `<onException>`, `<aggregate>`, etc.) so there is nothing to swap.
9. **`include=products\.csv`**: The skill says "NEVER use `include` parameter by default", but here the user explicitly named a specific file (`products.csv`). Filtering to that one file is the intent; left in place as a deliberate exception.
10. **File safety**: Used `{{read.lock}}` (waits for file size to stabilize). User did not mention a `.done` marker file.

## Was this the right skill?

Yes — `generate-import-integration` is the correct skill for this request: a CSV -> Pricefx import targeting **Product master (P)**. The other import skills (`generate-pa-import-integration` for DMDS, `generate-ppv-import-integration` for LTV/MLTV2) do not apply.
