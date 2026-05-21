# Baseline (no skill) summary — p-master-sftp-daily

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-products.xml` — Camel 4 route polling SFTP `/import` daily at 02:00 via Quartz cron (`0 0 2 * * ?`). `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile?objectType=P&businessKeys=sku&batchSize=200000`. `<onCompletion>` triggers `pfx-api:internalCopy?label=Product`. `delete=true` after successful read.
- `mappers/import-products.mapper.xml` — `loadMapper id="import-products.mapper"` with `sku → sku`, `name → label`, `price → attribute1` (stringToDecimal(us,0,2)), `uom → attribute2`.
- `connections/sftp.connection.json` — `SFTPConnection` placeholder.
- `connections/pricefx.json` — default `PriceFxConnection` placeholder.
- `config/application.properties` — `pfx\:import-products.cron`, `archive.file`, `read.lock`, `error.file`.

**Assumptions:**
- Target P (Product) master, business key `sku`.
- `name → label`, `uom → attribute2` by convention.
- `price` decimal with 2 fractional digits, US locale.
- "Daily" interpreted as 02:00 server time.
- `/import` assumed to be EXTERNAL SFTP (hence `pfx-sftp`); if IM pod default-sftp, switch to `file://`.
- Camel 4 form.
