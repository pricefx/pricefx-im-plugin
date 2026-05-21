# Baseline (no skill) summary — neg-p-master

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-products.xml` — File consumer at `{{integration.sftp.root}}/import/products`, `pfx-csv:streamingUnmarshal?skipHeaderRecord=true&useReusableParser=true` → `pfx-api:loaddataFile?objectType=P&mapper=import-products.mapper&businessKeys=sku&batchSize=100000`. `onCompletion` → `pfx-api:internalCopy?label=Product`.
- `mappers/import-products.mapper.xml` — `loadMapper id="import-products.mapper"` mapping `sku`, `label`, `attribute1..5`.
- `config/application.properties` — `archive.file`, `read.lock`, `error.file`.

**Decisions:**
- `pfx-api:loaddataFile` for P (standard pattern).
- `businessKeys=sku`, `batchSize=100000`.
- `{{archive.file}}` + `{{read.lock}}`.
- No `connection=pricefx`.
- Camel 4 form.

Baseline correctly produced a standard P-master import — same pattern that with-skill (running a different skill) deferred from. Both are correct answers to the same prompt.
