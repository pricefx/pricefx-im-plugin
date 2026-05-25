# Baseline (no skill) summary — px-prices-hourly

(Recovered from the agent response — the harness blocked direct SUMMARY.md write.)

Produced three files for a complete hourly PX Prices import:

**Files:**
- `routes/import-px-prices.xml` — Camel 4 route. File consumer at `/home/im/inbound/prices/` with `scheduler=quartz&scheduler.cron=0+0+0/1+*+*+?&scheduler.stateful=true`, `{{archive.file}}` + `{{read.lock}}`. Streams via `pfx-csv:streamingUnmarshal` into `pfx-api:loaddataFile?objectType=PX&mapper=import-px-prices.mapper&businessKeys=sku&batchSize=100000`. `onCompletion` triggers `pfx-api:internalCopy?label=Product`.
- `mappers/import-px-prices.mapper.xml` — `<mappers>` root, `loadMapper id="import-px-prices.mapper"` with mandatory `<constant expression="Prices" out="name"/>` and synthesized field mappings.
- `config/application.properties` — reusable file-component URI fragments.

**Design choices:**
- Object type `PX`, table `Prices` set via mapper constant (no `extensionName` URI param).
- Business key `sku`.
- `loaddataFile` + `streamingUnmarshal`.
- Hourly schedule on the file consumer, `scheduler.stateful=true`.
- Camel 4 form.

**Synthesized mapping:** sku, price→attribute1 (stringToDecimal), currency→attribute2, uom→attribute3, priceList→attribute4, validFrom→attribute5 (stringToDate), validTo→attribute6 (stringToDate).

**Naming:** route id matches file name; mapper id matches file name.
