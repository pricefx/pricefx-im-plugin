# With-skill summary — c-customer-sftp-6am

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-customer-master.xml` — Camel route polling external SFTP daily at 06:00. `pfx-csv:streamingUnmarshal` → `pfx-api:loaddataFile`.
- `mappers/import-customer-master.mapper.xml` — `<loadMapper id="import-customer-master.mapper">` mapping 13 typical customer-master columns including `customerId` (business key) and a `stringToDate` on `createdDate`.
- `connections/customerMasterSftp.json` — `SFTPConnection` placeholder.
- `config/application.properties` — placeholder credentials.

**Decisions:**
- Object type `C`, business key `customerId`.
- External SFTP via `pfx-sftp` + dedicated `SFTPConnection` (not `default-sftp-connection`).
- Schedule: Quartz cron `0+0+6+*+*+?` embedded in SFTP consumer via `scheduler=quartz&scheduler.cron=...`.
- Import method: `pfx-api:loaddataFile` + `pfx-csv:streamingUnmarshal` + `useReusableParser=true`.
- Batch size 200000 (10–20 fields tier).
- File handling: `delete=true`, `readLock=changed`, `streamDownload=true`, `stepwise=false`.
- Camel 4 form (flagged).

**Mapper assumptions:** Synthesized 13 columns — `customerId, name, customerType, status, street, city, state, postalCode, country, phone, email, salesRep, createdDate` (last with `stringToDate`).

**Self-check (Step 10):** IDs consistent, business key `customerId`, no forbidden patterns, `&` escaped.
