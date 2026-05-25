# Shipping Cost LTV Import

Daily SFTP-driven CSV import into the Pricefx Pricing Parameter `ShippingCost`
(single-key LTV: country code -> decimal cost in EUR).

## Files

- `import-shipping-cost.xml` - Camel 4 route (SFTP -> CSV streaming unmarshal -> LTV load)
- `import-shipping-cost.mapper.xml` - loadMapper mapping CSV columns to LTV name (key) + value (decimal)
- `shipping-sftp.connection.json` - External SFTP server connection
- `application.properties` - Route properties + shared file consumer fragments

## CSV format expected

```
countryCode,cost
AT,12.5000
DE,9.9500
FR,11.0000
```

Header is required (`skipHeaderRecord=true`). Values parsed as BigDecimal with
up to 4 fractional digits via `stringToDecimal(us,0,4)`. Currency is implicit
EUR - LTV stores a single numeric value, currency is metadata-level.

## Route behavior

- Consumer: `pfx-sftp` polling configured SFTP path, only `*.csv` files.
- Scheduling: Quartz cron `0 0 2 * * ?` (daily at 02:00 UTC); override via `pfx:import-shipping-cost.cron`.
- File hygiene: `readLock=changed` for size stability; processed files moved to `.archive/YYYY/MM/...`; failures to `.error/...`.
- Streaming: `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile` streams the file to the Pricefx server rather than parsing in memory.
- Target: `pfx-api:loaddataFile?objectType=LTV&pricingParameterName=ShippingCost` - replaces current contents of the ShippingCost LTV table on each run.

## Prerequisites in Pricefx

Create the Pricing Parameter table once (if missing):
```
pfx create-pricing-parameter ShippingCost
```

## Deployment notes

- Update `shipping-sftp.connection.json` with real host, credentials.
- If the SFTP path is actually the IM pod's mounted SFTP storage (connection named `default-sftp-connection*`), swap the `pfx-sftp` consumer for `file://{{integration.sftp.root}}/...` per `docs/connections.md`.
- Cron uses `+` instead of spaces (Camel URI convention).
