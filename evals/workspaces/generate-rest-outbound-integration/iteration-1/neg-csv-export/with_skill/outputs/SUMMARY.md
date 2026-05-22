# Negative Case: CSV / SFTP export — `generate-rest-outbound-integration` does NOT apply

**User prompt:** `Export Pricefx changed products to CSV daily on SFTP.`

## Decision: did NOT generate any route, mapper, filter, properties, or connection JSON.

## Why this skill does NOT apply

The skill `generate-rest-outbound-integration` covers outbound integrations where IM **pushes data to an external system via HTTP** (POST / PUT / PATCH). Its description explicitly says: *"push to ERP", "send to webhook", "POST to external system" ... For an INBOUND endpoint exposed from IM use `generate-inbound-rest-endpoint`.* — and by extension, for file-based exports it is the wrong skill.

The user prompt here is a file-based SFTP/CSV export — no HTTP method, no REST URL, no OAuth / API-key / Basic / mTLS auth, no JSON payload. None of the skill's trigger keywords are present.

## Correct skill: `generate-export-integration`

`generate-export-integration` is the Pricefx → CSV → SFTP delta export skill.

## Correct pattern outline (for reference — not generated here)

1. **Trigger:** `quartz://export-products?cron=0+0+6+*+*+?&trigger.timeZone=UTC&stateful=true` (or whatever cron the user wants).
2. **Delta sync:** `pfx-config:get` reads `lastExportTimestamp` into a header; capture `currentExportTimestamp` from `${date-with-timezone:now:UTC:yyyy-MM-dd'T'HH:mm:ss}`.
3. **Filter file** (`filters/export-products.filter.xml`) on `lastUpdateDate` between the two bounds, with `sortBy` and `resultFields`.
4. **Fetch batched:** `pfx-api:fetch?objectType=P&filter=export-products.filter&batchedMode=true&batchSize=50000` → list of batch refs.
5. **Split + iterator** → `pfx-api:fetchIterator` → `pfx-model:transform?mapper=export-products.mapper` → `pfx-csv:marshal?header=...` → `pfx-sftp://{remote-path}?connection=sftp.connection&fileName=products-${date:now:yyyyMMdd}.csv&fileExist=Append`.
6. **After upload:** `pfx-config:set` the new watermark in `onCompletion onCompleteOnly="true"`.

## Artifacts that the correct skill would produce

| File | Purpose |
|---|---|
| `routes/export-products.xml` | The delta-export route |
| `mappers/export-products.mapper.xml` | Field projection for the CSV |
| `filters/export-products.filter.xml` | `lastUpdateDate`-bounded delta filter |
| `connections/sftp.connection.json` | `SFTPConnection` discriminator |
| `config/application.properties` | Watermark + sftp path + cron entries |

## No artefacts produced — by design

No route XML, mapper, filter, properties, or connection JSON written by this skill. The right next step is to switch to `generate-export-integration` and re-run with the same prompt.
