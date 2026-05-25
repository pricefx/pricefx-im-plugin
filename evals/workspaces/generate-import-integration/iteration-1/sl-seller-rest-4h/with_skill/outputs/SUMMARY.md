# With-skill summary — sl-seller-rest-4h

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-sellers-from-rest.xml`
- `mappers/import-sellers-from-rest.mapper.xml`
- `connections/erp.json`
- `config/application.properties`

**Decisions:**
- Object type SL (Seller Master). Business key `sellerId`.
- Import method: `pfx-api:loaddata` (REST → JSON unmarshal → loaddata pattern). `loaddataFile` is for file streaming, not REST.
- Schedule: Quartz cron `0+0+0/4+*+*+?` every 4h, `stateful=true`.
- Synthesized 10-field seller payload: `sellerId`, `name → label`, plus `firstName`, `lastName`, `email`, `phone`, `region`, `territory`, `department`, `managerId`, `status`, `hireDate` (stringToDate).
- Connection: `NoopConnection` (no auth specified). Easy swap to OAuth2/Basic/JWT.
- Camel 4 form (default per skill guidance).
- Batch size 50,000.

**Self-check (Step 10):** All gates pass — IDs match file names; `sellerId` key not `sku`; no `connection=pricefx`, no `noop=true`, no `include=`; `&amp;` escaped; PX/CX `<constant out="name"/>` not applicable (SL is master).

**Caveats:** JSON field names guessed — confirm against actual payload. `erp.json` uses `NoopConnection`; swap if auth needed. Add paging loop / split if API paginates or wraps response.
