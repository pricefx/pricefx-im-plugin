# Negative Case: DMDS / Price Analyser Feed — Skill Does NOT Apply

## User Prompt

> Daily transactional feed (5M rows) needs to land in DMDS SalesHistoryDS for Price Analyser.

## Decision: Decline / Defer to a Different Skill

The `generate-ppv-import-integration` skill is **not** the correct tool for this request. No route XML, mapper XML, or `application.properties` has been generated.

---

## 1. Why this skill does NOT apply

`generate-ppv-import-integration` is scoped exclusively to **Pricing Parameter Values (PPV)** — also known as Company Parameters / Lookup Tables. Its supported `objectType` values are:

| objectType | Table kind | Use case |
|---|---|---|
| `LTV` | `SIMPLE` (single key) or `RANGE` | Exchange rates, status lookups, tax tiers |
| `MLTV2` … `MLTV5` | `MATRIX` / `MATRIX2`–`MATRIX5` | Multi-key matrix lookups (discount by region+product, etc.) |

These are **small, slowly-changing configuration/lookup tables**, typically keyed by a code or composite of codes and holding a single value or a row of attributes.

The user's request has none of those characteristics:

- **Target is `DMDS.SalesHistoryDS`** — a **Data Mart Data Source**, i.e. a Price Analyser fact table. The IM `objectType` for DMDS is `DM` / `DMDS`, not `LTV` / `MLTV2`.
- **5M rows per day, transactional sales records** — this is bulk fact data destined for analytics in Price Analyser. PPV tables are not designed to hold transactional volume.
- **"Price Analyser"** is explicitly the Pricefx PA module. DMDS feeds for PA have their own pattern (streaming split + batched `loaddata` + flush + internal copy), which differs materially from the PPV `loaddata` pattern.

Generating an LTV or MLTV2 route here would silently produce a broken integration: wrong `objectType`, wrong field shape (`name`/`value` vs. transactional columns), wrong `pricingParameterName` parameter, no flush step, and no batching strategy suitable for 5M rows.

## 2. Which skill DOES apply

**`generate-pa-import-integration`** — the skill dedicated to Price Analyser / DMDS imports. It understands:

- DMDS target tables (`DMDS.<name>`) and their data feed (`DMF.<name>`) counterpart
- Streaming + tokenised batching for multi-million-row files
- The required `pfx-api:flush` step that promotes data feed rows into the data source
- Optional `pfx-api:internalCopy` / refresh / calculate steps to make the data available to PA dashboards

## 3. Correct pattern (outline only — not generated here)

The correct route, produced by `generate-pa-import-integration`, would look roughly like this (sketch, not committed to disk):

1. **Consume the file** — `from file:{{data.directory}}/import/sales-history` (or `pfx-sftp://…`) with archive + readLock or doneFile semantics.
2. **Stream-split for 5M rows** — `<split streaming="true" aggregationStrategy="recordsCountAggregation">` with `<tokenize token="\n" group="50000"/>` so the file is never fully loaded into memory.
3. **Parse each chunk** — `pfx-csv:unmarshal?header=…&skipHeaderRecord=true` (or `pfx-csv:streamingUnmarshal` with `loaddataFile`).
4. **Load into the Data Feed** — `pfx-api:loaddata?objectType=DMDS&dsUniqueName=DMDS.SalesHistoryDS&mapper=import-sales-history.mapper&direct2ds=false` (load lands in the data feed first).
5. **Flush feed -> data source** — `<onCompletion onCompleteOnly="true">` containing `pfx-api:flush?dataSourceName=DMDS.SalesHistoryDS&dataFeedName=DMF.SalesHistory` to promote feed rows into the DMDS, followed optionally by `pfx-api:internalCopy` / `pfx-api:refresh` for downstream PA artefacts.
6. **Mapper** — a standard `<loadMapper id="import-sales-history.mapper">` with `<body>` mappings for transactional columns (date, sku, customerId, quantity, netPrice, etc.), discovered from the partition via `pfx data-source-metadata DMDS.SalesHistoryDS` rather than the LTV `name`/`value` shape.

## Recommendation

Re-run the request against `generate-pa-import-integration`, which will inspect `DMDS.SalesHistoryDS` field metadata via the `pfx` CLI, auto-map the transactional columns, and emit the streaming + flush route described above.
