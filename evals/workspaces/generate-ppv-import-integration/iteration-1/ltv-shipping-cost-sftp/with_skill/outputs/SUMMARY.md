# LTV Shipping Cost Import (SFTP, Daily)

Imports a single-key country-code -> EUR shipping-cost lookup table into the
Pricefx Pricing Parameter table `ShippingCost` (SIMPLE / LTV).

## Bundle Contents

| File | Purpose |
|---|---|
| `import-ppv-shipping-cost.xml` | Camel 4 route — polls SFTP daily, streams CSV, calls `pfx-api:loaddataFile` |
| `import-ppv-shipping-cost.mapper.xml` | `loadMapper` — maps `countryCode` -> `name`, `shippingCost` -> `value` (decimal) |
| `shipping-cost-sftp.connection.json` | `SFTPConnection` definition (host/port/path/credentials placeholders) |
| `application.properties` | File-handling defaults + per-route SFTP connection/path properties |

## Behavior

- **Source:** SFTP folder `/inbound/shipping-cost` on connection `shipping-cost-sftp`
- **Schedule:** Daily at 02:00 server time (`cron=0 0 2 * * ?`), via Quartz scheduler on the SFTP consumer
- **File handling:** Files are deleted from the SFTP server after successful processing (`delete=true`). The `delay=10000` gives a 10s settle window per poll cycle.
- **CSV format:** Header row present (`skipHeaderRecord=true`), comma delimiter
- **Target table:** `ShippingCost` — Pricefx Pricing Parameter, type `SIMPLE` -> IM `objectType=LTV`
- **Mode:** Replace (`loaddataFile`) — full refresh on each run
- **Decimal conversion:** `value` column is converted via `converterExpression="stringToDecimal"` to handle string-formatted decimals from the source CSV

## CSV -> Pricefx Field Mapping

| CSV column | Pricefx LTV field | Converter |
|---|---|---|
| `countryCode` | `name` (key) | — |
| `shippingCost` | `value` | `stringToDecimal` |

Example input row: `DE,8.95` -> `name=DE, value=8.95`

## Assumptions Made (no clarifying questions per eval rules)

1. **Table name** assumed to be `ShippingCost`. If the real partition uses a different `uniqueName`, update `pricingParameterName=` on the route URI.
2. **CSV columns** assumed to be `countryCode` and `shippingCost` (header row). Adjust mapper `in=` values if the real headers differ.
3. **SFTP connection details** (`host`, `username`, `password`) are placeholders — fill in real values before deploy.
4. **Schedule** chosen as 02:00 daily; change the Quartz cron if a different hour is preferred.
5. **No `.done` marker** assumed on the SFTP side, so no `doneFileName` is used. The route relies on `delete=true` plus the consumer's own atomic-rename handling. If the upstream system writes a `.done` marker, switch to `doneFileName=%24%7Bfile:name%7D.done` on the SFTP URI.
6. **EUR is implicit** — LTV SIMPLE tables only store `name` + `value`; the EUR currency is a property of the table semantics, not a stored column.

## Deployment Notes

- Place files under the standard project layout:
  - `src/main/resources/repo/routes/import-ppv-shipping-cost.xml`
  - `src/main/resources/repo/mappers/import-ppv-shipping-cost.mapper.xml`
  - `src/main/resources/repo/connections/shipping-cost-sftp.connection.json`
  - Merge `application.properties` into `src/main/resources/repo/config/application.properties`
- Ensure the Pricing Parameter table `ShippingCost` exists in Pricefx (type `SIMPLE`, valueType `REAL`) before first run.
- Observability trade-off: `streamingUnmarshal` + `loaddataFile` logs only start/end — no per-batch progress. Acceptable for a small country-code lookup.
