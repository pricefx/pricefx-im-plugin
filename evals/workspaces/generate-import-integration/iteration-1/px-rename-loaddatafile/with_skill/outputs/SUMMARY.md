# With-skill summary — px-rename-loaddatafile

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-pricing.xml` — file consumer → `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile?objectType=PX&mapper=import-pricing.mapper&batchSize=500000`.
- `mappers/import-pricing.mapper.xml` — `loadMapper id="import-pricing.mapper"` with required `<constant expression="Pricing" out="name"/>`, `partNumber → sku`, `listPrice → attribute1` (stringToDecimal), `costCenter → attribute2`.
- `config/application.properties` — `archive.file`, `read.lock`, `error.file`, `integration.sftp.root=/var/pricefx/sftp`.

**Decisions:**
- Object type PX, table `Pricing`.
- `loaddataFile` per user request.
- File source: local IM storage at `file://{{integration.sftp.root}}/pricing` (folder = kebab-cased PX table name).
- Batch size 500000 (3 fields tier).
- `{{read.lock}}` (no .done marker mentioned), `{{archive.file}}`, `{{error.file}}`.
- Business key `sku`.
- PX attribute mapping synthesized (pfx CLI unavailable): listPrice → attribute1 stringToDecimal, costCenter → attribute2.
- Camel 4 form (also portable to Camel 3 since no renamed attributes used).

**Self-check passes:** ID consistency, PX `name` constant present, `&` escaped, no `noop=true`, no `connection=pricefx`, no `include=`, no `pfx-sftp` against default storage.
