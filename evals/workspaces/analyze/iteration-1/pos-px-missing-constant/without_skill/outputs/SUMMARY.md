# Lint Report — `import-px-prices.xml` + `import-px-prices.mapper.xml`

**Route ID:** `import-px-prices`
**Pattern:** Inbound CSV → Product Extension (PX) bulk load via `pfx-api:loaddataFile` (streaming).

## Critical (blocker)

**The PX mapper `import-px-prices.mapper.xml` is missing the required `<constant expression="..." out="name"/>` line** that tells IM which PX extension table to write to. Per `docs/mappers.md` and `docs/components.md`, all PX/CX `loadMapper`s must include this constant — there is no `extensionName` URI parameter on the route. Without it the import either fails at runtime or silently writes to the wrong table.

**Fix:** add `<constant expression="Prices" out="name"/>` (or the actual table name) as the first child of `<loadMapper>` in `import-px-prices.mapper.xml`.

## Minor

- `businessKeys=sku` on `loaddataFile` is redundant — IM auto-detects join keys for P/PX.
- Confirm `{{archive.file}}`, `{{read.lock}}`, `{{error.file}}` are all defined in `application.properties`.

## Good

- Route/mapper IDs match filenames.
- `streamingUnmarshal` + `loaddataFile` combo (recommended for PX).
- `file://` + `{{integration.sftp.root}}` (not `pfx-sftp`).
- No redundant `connection=pricefx`.
- Reasonable `batchSize=100000`.

## Verdict

Do NOT deploy as-is — add the `name` constant in the mapper.
