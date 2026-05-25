# Import Integration — PX Prices (hourly)

## Request
> Set me up an import that reads PX Prices table data from `/home/im/inbound/prices/` and loads into Pricefx with proper field mapping. Schedule: every hour.

## Generated artifacts

| File | Purpose |
|---|---|
| `routes/import-px-prices.xml` | Camel route that polls the source folder hourly and streams CSVs into Pricefx via `pfx-api:loaddataFile` |
| `mappers/import-px-prices.mapper.xml` | `loadMapper` for PX `Prices` (sku + attribute1..attribute10) |
| `config/application.properties` | `archive.file`, `read.lock`, `error.file` properties referenced by the route |

## Key decisions

| Question | Decision | Rationale |
|---|---|---|
| Object type | `PX` (Product Extension), table name `Prices` | Request says "PX Prices table" |
| Key field | `sku` | PX always keyed on `sku` |
| Import method | `pfx-api:loaddataFile` (streaming) | Faster than split+tokenize; recommended for typical CSV loads. Trade-off: no per-batch progress logging (single-shot stream). |
| Batch size | `200000` | 11 fields → "10–20 fields" tier (100k–200k); chose upper bound for hourly throughput |
| Scheduler | Quartz cron `0 0 0/1 * * ?` (URI: `0+0+0/1+*+*+?+*`) on the file consumer | "Every hour" → top-of-the-hour poll, scheduler driving the file component |
| File safety | `readLock=changed` (`{{read.lock}}`) | No `.done` marker mentioned — wait for file size to stabilize |
| Archive | `{{archive.file}}` → `.archive/YYYY/MM/<name>__<ts>.<ext>` | Plugin default, always-on |
| Error folder | `{{error.file}}` → `.error/<name>__<ts>.<ext>` | Recommended for file-based imports |
| CSV format | Comma delimiter, header row present, UTF-8 | Most common defaults; no sample data provided |
| Camel version | Default to **Camel 4** | This eval workspace has no `pom.xml` — per the skill's "unknown → default Camel 4 and flag" rule |

## Assumptions (per eval rules — pfx CLI not configured)

1. **PX Prices schema:** assumed `attribute1`..`attribute10`. The mapper maps incoming CSV columns named `attribute1`..`attribute10` in order. If the CSV uses different column headers (e.g., `price`, `currency`, `validFrom`), update the `in=` values on each `<body>` element. The `out=` side (Pricefx attribute slots) stays the same.
2. **Business key column** in the CSV is named `sku`. Rename `in="sku"` if the source column has a different header.
3. **Path used as given:** the route uses `file:///home/im/inbound/prices` exactly as the user specified. The plugin's normal convention is `file://{{integration.sftp.root}}/{path}` — switch to that form if `/home/im/inbound/prices` should be relative to the IM SFTP root rather than an absolute filesystem path.
4. **No converters applied.** Without metadata, all attributes are mapped as raw strings. If specific columns are decimals/integers/dates, add `converterExpression="stringToDecimal"`, `stringToInteger`, `stringToDate`, etc.
5. **No `.done` marker** assumed → `readLock=changed`. If the upstream system writes a `<file>.done` marker, swap `{{read.lock}}` for `{{done.file}}` (define `done.file=doneFileName=%24%7Bfile:name%7D.done` in properties).

## How the route works

1. **Hourly trigger:** Quartz scheduler on the file consumer fires at minute 0 of every hour (`0 0 0/1 * * ?`).
2. **Pick up file:** Camel scans `/home/im/inbound/prices`, applies `readLock=changed` (waits until file size is stable), and acquires the next file.
3. **Stream-parse CSV:** `pfx-csv:streamingUnmarshal` parses with `skipHeaderRecord=true` and `useReusableParser=true` — no full-file load into memory.
4. **Upload to Pricefx:** `pfx-api:loaddataFile` streams the parsed records to the partition. The mapper supplies the PX table name (`Prices`) via `<constant out="name"/>`, sku, and 10 attribute slots. Default Pricefx connection (`pricefx`) is used.
5. **Archive / error:** On success the file is moved under `.archive/YYYY/MM/...`. On failure it goes to `.error/...`.
6. **Log:** Start and completion lines emit the file name and the final `PfxTotalInputRecordsCount`.

## Self-check results (Step 10)

- [x] Property placeholders resolved — all `{{...}}` in the route XML have matching properties.
- [x] Error handling included (`{{error.file}}` on file URI).
- [x] Batch size matches field-count tier (11 fields → 200k).
- [x] ID consistency — route id, mapper id, and `mapper=` parameter all line up with file names.
- [x] PX table name constant present in mapper (`<constant expression="Prices" out="name"/>`).
- [x] Key field correct (PX → `sku`).
- [x] No forbidden patterns: no `noop=true`, no `connection=pricefx`, no `include=`, no `pfx-sftp` on local storage, all `&` escaped as `&amp;`.
