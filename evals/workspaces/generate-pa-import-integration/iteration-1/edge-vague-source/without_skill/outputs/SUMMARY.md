# Summary - Baseline (no specialized skill)

## User request

> "I need to load data from a source into Pricefx."

## Outcome

Status: Clarification required - no route/mapper/filter/connection artefacts generated.

The request is too vague to produce a correct integration without making many independent guesses. The shape of the deliverables changes drastically based on source type, format, target object, mapping, scheduling, and Camel version. Producing one arbitrary variant would be useful only by coincidence.

## Clarifying questions

### 1. Source system

- Type of source? One of:
  - Local file drop on the IM pod's mounted storage (use `file:` component, NOT `pfx-sftp`)
  - External SFTP server (`pfx-sftp` + `SFTPConnection`)
  - REST API (`pfx-rest` + OAuth2/Basic/JWT/Noop connection)
  - Relational DB (`pfx-sql` + JDBC dataSource)
  - AWS S3 (`pfx-s3` + `S3Connection`)
  - Another Pricefx partition (second `PriceFxConnection`)
- For files: format (CSV / XLSX / JSON / XML / zipped)? delimiter, quote char, header row, encoding?
- For SFTP/file: path or folder?
- For REST: endpoint, auth type, pagination?
- Approximate row volume per run? (drives `loaddata` vs `loaddataFile` and `batchSize`.)

### 2. Target in Pricefx

- Which object type? P, PX, C, CX, SL, SX, LTV, MLTV2, CRCP, DMDS, etc. (full list in CLAUDE.md "Pricefx Object Type Codes").
- For PX / CX: extension table name (set as `<constant out="name"/>` in mapper).
- For LTV / MLTV2: `pricingParameterName`.
- For CRCP: `conditionRecordSetName`.
- Business keys (e.g. `sku` for P/PX, `customerId` for C/CX)?
- Replace (`loaddata` / `loaddataFile`) vs upsert (`integrate`)?

### 3. Field mapping

Without the source schema AND target attribute metadata we cannot author a mapper. Need:
- Sample row / column list of the source.
- Target attribute labels (or permission to run `pfx product-extension-metadata` / `pfx customer-extension-metadata`).
- Type conversions (string-to-decimal, date parsing, etc.).
- Any constants required on every row.

### 4. Scheduling / triggering

- File polling (poll interval, `.done` marker vs `readLock=changed`, archive policy)?
- Quartz cron (timezone, frequency)?
- One-shot timer?
- Event-driven (`pfx-event:fetch` - which event type)?
- Direct endpoint (manually invoked)?

### 5. Post-load actions

- `pfx-api:internalCopy` after a P or C load?
- Data Mart refresh / Data Feed flush?
- Publish a custom event?
- Error / archive folder layout?

### 6. Project context

- Camel version of the target project (3 vs 4 - changes attribute names, scheme names; see `docs/routes.md`)?
- Is there already a `pricefx` connection configured?
- Project's route-id naming convention?

## Why I did not proceed with assumptions

| Source type | Component | Connection needed |
|---|---|---|
| Local file drop | file://{{integration.sftp.root}}/... + {{archive.file}} + {{read.lock}} | none |
| External SFTP | pfx-sftp://...?connection=sftp.connection | SFTPConnection |
| REST | pfx-rest:get?uri=...&connection=... | OAuth2Connection / BasicConnection / etc. |
| Database | pfx-sql:select?dataSource=... | JDBC dataSource |

The mapper also differs entirely:
- P load: `sku` business key, no `name` constant.
- PX load: must set `<constant expression="<table>" out="name"/>`.
- LTV load: `name`/`value` pair + `pricingParameterName` on the route URI.
- CRCP load: `conditionRecordSetName` constant + `validFrom`/`validTo`/`conditionValue`.

## Suggested minimal answer template

```
SOURCE     : <file | sftp | rest | sql | s3 | pfx>
FORMAT     : <csv | xlsx | json | xml | n/a>
LOCATION   : <path / URL / endpoint>
TARGET     : <P | PX:<table> | C | CX:<table> | LTV:<name> | MLTV2:<name> | CRCP | DMDS | ...>
KEYS       : <comma-separated business key field names>
TRIGGER    : <file-drop | cron:<expr> | event:<type> | timer:once | direct>
SAMPLE ROW : <one example row from the source>
CAMEL VER  : <3 | 4 | unknown>
```

Once provided, the route XML, mapper XML, optional filter XML, connection JSON, and `application.properties` entries can be generated per the conventions in `docs/routes.md`, `docs/mappers.md`, `docs/filters.md`, and `docs/connections.md`.
