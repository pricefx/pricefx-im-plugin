# Baseline (no skill) summary — c-customer-sftp-6am

(Recovered from response — harness blocked .md write.)

**Files produced:**
- `routes/import-customers.xml` — Camel 4 route polling SFTP daily at 06:00, streaming CSV into Pricefx C.
- `mappers/import-customers.mapper.xml` — `loadMapper` for CSV → Customer Master.
- `connections/sftp.connection.json` — SFTP connection bean (placeholder host/creds).
- `config/application.properties` — schedule + SFTP path/filename properties.

**Design decisions:**
- Camel 4 (assumed; no pom.xml available).
- `pfx-sftp` because the file lands on an external SFTP server (not `default-sftp-connection`).
- Schedule: `scheduler=quartz&scheduler.cron=0+0+6+*+*+?` — daily at 06:00.
- `pfx-api:loaddataFile` with `pfx-csv:streamingUnmarshal`, `batchSize=100000`.
- Object type `C`, no `<constant out="name"/>` (only PX/CX need that).
- `businessKeys=customerId`.
- `onCompletion` → `pfx-api:internalCopy?label=Customer`.
- Default Pricefx connection (no `connection=` param).

**Synthesized mapping:** customerId (bk), name, status, address→attr1, city→attr2, state→attr3, postalCode→attr4, country→attr5, email→attr6, phone→attr7, segment→attr8, industry→attr9, salesRep→attr10.
