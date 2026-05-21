# PA Invoices Import — Generation Summary

## Request

> Build me a PA Data Source import for line-item invoice data from
> `/im/inbound/invoices/`. Needs flush after load completes. Schedule daily at 3am.

## What was generated

| File | Purpose |
|---|---|
| `routes/import-pa-invoices.xml` | Camel route — file consumer + CSV streaming unmarshal + `pfx-api:loaddataFile` + `pfx-api:flush` in `onCompletion` |
| `mappers/import-pa-invoices.mapper.xml` | `loadMapper` mapping CSV columns to data-source fields (best-effort scaffold) |
| `config/application.properties` | Shared `archive.file` / `read.lock` / `error.file` fragments and the route's cron schedule |

## Design decisions

- Object type: `DM` (Data Mart / Data Source bulk load), with `dsUniqueName=DMDS.Invoices` and `direct2ds=true` so rows go straight into the data source's data feed.
- Component: `pfx-api:loaddataFile` (streaming, preferred default for CSV imports). `pfx-csv:streamingUnmarshal` is used upstream so very large invoice files are not loaded into memory.
- Flush: triggered from `<onCompletion onCompleteOnly="true">` — runs after a successful load, calling `pfx-api:flush?dataSourceName=DMDS.Invoices&dataFeedName=DMF.Invoices`.
- Scheduling: daily at 03:00 via Quartz scheduler on the file consumer (`scheduler=quartz&scheduler.cron=...`). Cron lives in `application.properties` as `import-pa-invoices.cron=0+0+3+*+*+?` (spaces encoded as `+` because the value is interpolated into a Camel URI).
- File handling: uses shared properties `{{archive.file}}` (move processed file to a timestamped `.archive/` folder) and `{{read.lock}}` (`readLock=changed`). No `.done` marker assumed — switch to `{{done.file}}` if upstream writes one.
- Charset: `pfx-io:detectCharset` + `pfx-io:setupCharset` included so non-UTF-8 invoice CSVs still parse correctly.
- Camel 4 syntax used (modern attribute names, `{{...}}` placeholders). No `*Ref` attributes — route is compatible with Camel 3 as well.

## Assumptions & follow-ups

`pfx` CLI not configured, so:

1. DMDS.Invoices is assumed to exist — confirm with `pfx data-sources` / `pfx data-source DMDS.Invoices`. Create on the partition before deploy if absent.
2. DMF.Invoices is assumed to be the data feed feeding DMDS.Invoices. Replace with the actual feed name in the `flush` call.
3. Mapper field names are a best-effort scaffold. Inspect the actual CSV header and `pfx data-source-metadata DMDS.Invoices` and adjust each `<body in="..." out="..."/>` row accordingly.
4. If invoice files are guaranteed UTF-8, the two `pfx-io` steps can be removed.
5. Cron uses JVM default time zone — add `&scheduler.timeZone=America/New_York` (or similar) on the `<from>` URI to pin it.

## Deployment paths (target project layout)

| Generated file | Copy to |
|---|---|
| `routes/import-pa-invoices.xml` | `src/main/resources/repo/routes/import-pa-invoices.xml` |
| `mappers/import-pa-invoices.mapper.xml` | `src/main/resources/repo/mappers/import-pa-invoices.mapper.xml` |
| `config/application.properties` | merge entries into `src/main/resources/repo/config/application.properties` |

IDs match file names — `id="import-pa-invoices"` and `id="import-pa-invoices.mapper"` — per the resource-ID naming rule in `docs/project.md`.
