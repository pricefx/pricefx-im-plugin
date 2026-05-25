# Negative Case — generate-ppv-import-integration does NOT apply

**User prompt:** `Load product master from /import/products.csv into Pricefx P table, business key sku.`

**Decision:** Decline. No artefacts generated.

## 1. Why this skill does NOT apply

The `generate-ppv-import-integration` skill is scoped exclusively to **Pricing Parameters** (also called Company Parameters / Lookup Tables) — specifically:

- `LTV` — SIMPLE single-key lookup or RANGE-based lookup
- `MLTV2` / `MLTV3` / `MLTV4` / `MLTV5` — multi-key matrix lookups

These tables are configuration / reference data (exchange rates, discount tiers, tax brackets, lookup matrices) loaded via `pfx-api:loaddata` (or `loaddataFile`) with a required `pricingParameterName=...` URI parameter.

The user's prompt explicitly targets the **Product master** object (`objectType=P`) with a business key of `sku`. Product master is **not** a Pricing Parameter:

- It has no `pricingParameterName`.
- Its key field is `sku`, not `name` / `key1..keyN`.
- It uses `attribute1..attributeN` for descriptive product attributes, not key/value lookup semantics.

Generating an LTV/MLTV2 route here would produce a non-functional integration (wrong objectType, missing `pricingParameterName`, wrong field structure, wrong business-key semantics).

## 2. Which skill DOES apply

**`generate-import-integration`** — the canonical skill for importing into the core master/extension objects: `P`, `PX`, `C`, `CX`, `SL`, `SX`.

The skill description in `generate-ppv-import-integration/SKILL.md` itself defers explicitly:

> "For P/PX/C/CX use `generate-import-integration`; for PA/DMDS use `generate-pa-import-integration`."

So the correct action is to stop and route the user to `generate-import-integration`.

## 3. Brief outline of the correct pattern (for reference only — NOT generated here)

The right shape, produced by `generate-import-integration`, would be:

- **Route** (`src/main/resources/repo/routes/import-products.xml`):
  - `<from uri="file://{{integration.sftp.root}}/import/products?...&amp;{{archive.file}}&amp;{{read.lock}}"/>`
  - `<to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>`
  - `<to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;batchSize=500000"/>` (no `connection=pricefx` — `pricefx` is the implicit default; `businessKeys=sku` is optional on `loaddataFile` for P/PX — IM auto-detects join keys)
  - Optional `<onCompletion onCompleteOnly="true"><to uri="pfx-api:internalCopy?label=Product"/></onCompletion>`

- **Mapper** (`src/main/resources/repo/mappers/import-products.mapper.xml`):
  - Root `<mappers>`; `<loadMapper id="import-products.mapper">` with `<body in="sku" out="sku"/>` and `<body>` entries for the remaining CSV columns mapped to `label` / `attribute1..N`, plus `converterExpression` for numeric/date fields.
  - No `<constant ... out="name"/>` — that is for PX/CX only, not for P.

- **Properties** (`config/application.properties`):
  - Standard `archive.file=...`, `read.lock=readLock=changed` (or `done.file`), optional `error.file=...`.

Re-invoke with `generate-import-integration` (the matching skill) to produce these files.
