# Baseline (no skill) summary — sl-seller-rest-4h

(Recovered from response — harness blocked .md write.)

**Files:**
- `routes/import-sellers.xml` — Camel 4 route, Quartz cron `0+0+0/4+*+*+?` (every 4h, `stateful=true`), `pfx-rest:get /api/sellers` via `erp.connection`, `pfx-json:unmarshal`, `pfx-api:loaddata?objectType=SL&mapper=import-sellers.mapper&businessKeys=sellerId`, `onCompletion → pfx-api:internalCopy?label=Seller`.
- `mappers/import-sellers.mapper.xml` — `loadMapper id="import-sellers.mapper"` mapping assumed JSON fields (`sellerId`, `name`, `status`, `email`, `phone`, `region`, `department`, `managerId`, `lastUpdated`) to SL fields and attribute1..6 via Groovy expressions.
- `connections/erp.connection.json` — `OAuth2Connection` skeleton, `https://erp.internal`, placeholders for credentials, `authUrl=https://erp.internal/oauth2/token`.
- `config/application.properties` — route description and `connectionTimeoutMs=500000`.

**Assumptions:**
- Object type `SL`, business key `sellerId`.
- OAuth2 (most common for internal enterprise APIs). Swap to BasicConnection/NoopConnection if different.
- ERP response is a flat JSON array of sellers. If wrapped, insert `<split><simple>${body[data]}</simple></split>` before `loaddata`.
- No pagination, delta sync, or `onException` — not specified.
- Camel 4 form.
