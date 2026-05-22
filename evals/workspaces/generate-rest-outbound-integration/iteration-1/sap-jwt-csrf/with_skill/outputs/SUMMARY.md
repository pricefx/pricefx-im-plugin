# post-quote-to-sap — Outbound REST Integration (SAP JWT + CSRF + Cookies)

## Trigger and flow

Pricefx publishes a `QUOTE_SUBMITTED` event whenever a quote is submitted.
This integration consumes that event and POSTs the quote payload to an SAP
OData service fronted by SAP API Management, using the SAP-style auth combo:
OAuth 2.0 bearer **JWT** + **CSRF** token + sticky **session cookie**.

```
QUOTE_SUBMITTED (pfx-event:fetch)
   │
   ▼
post-quote-to-sap            ← business route (this skill)
   │  builds OData JSON body from quote header + line items
   │  sets Authorization (cached JWT), X-CSRF-Token (cached), APIM key
   ▼
direct:rest_outbound_call    ← shared outbound route (rest-outbound-shared)
   │  applies dry-run toggle, timeouts, structured error logging
   │  POST → SAP OData EntitySet with cookieHandler=#instanceCookieHandler
   ▼
SAP API Management → SAP OData service
```

Two scheduled side-flows keep the cache warm:

```
timer://refresh-api-tokens (every 30 min)
   ├─► direct:get-jwt-token   → simpleCache['JWT']
   └─► direct:get-csrf-token  → simpleCache['CSRF'] (+ session cookie in instanceCookieHandler)
```

## Files generated

| File | Purpose |
|---|---|
| `routes/post-quote-to-sap.xml` | Business route. Listens for `QUOTE_SUBMITTED`, builds the OData payload, sets SAP auth headers from `simpleCache`, delegates to the shared outbound route. Includes 401/403 onException hooks that refresh the cache and retry once. |
| `routes/rest-outbound-shared.xml` | Generic `direct:rest_outbound_call` route. Honors `call_is_DISABLED` dry-run, applies socket/connect timeouts, structured error logging, and passes `cookieHandler=#instanceCookieHandler` on the HTTP call so the SAP session cookie sticks. |
| `routes/get-jwt-token.xml` | OAuth 2.0 client-credentials token fetch. Writes `access_token` into `simpleCache['JWT']`. Uses `throwExceptionOnFailure=false` so auth failures are logged with the response body. |
| `routes/get-csrf-token.xml` | Authenticated SAP OData GET with `x-csrf-token: fetch`. Stores the returned CSRF token in `simpleCache['CSRF']` and captures the SAP session cookie via the shared `instanceCookieHandler`. |
| `routes/refresh-api-tokens.xml` | Timer route that refreshes JWT then CSRF every 30 min (configurable). Order matters: JWT first, CSRF second. |
| `beans/simpleCache.xml` | `ConcurrentHashMap` shared by all routes; stores JWT + CSRF. Single instance — do not declare twice. |
| `beans/instanceCookieHandler.xml` | `InstanceCookieHandler` shared by the CSRF fetch and the business write. SAP binds the CSRF token to the cookie returned by the fetch; using a fresh cookie jar on the write yields HTTP 403. |
| `config/application.properties` | All configurable values: SAP OData URL, environment, APIM subscription key, OAuth client/secret/scope, token refresh interval, retry, dry-run toggle. Credentials are placeholders only — encrypted with `{ENC}` prefix in real environments. |

## SAP-style auth: why three things, not one

SAP OData write operations require all three concurrently:

1. **JWT** in `Authorization: Bearer …` — proves the caller is a registered OAuth client.
2. **CSRF token** in `X-CSRF-Token: …` — proves the caller fetched the token from this specific service.
3. **Session cookie** (e.g. `SAP_SESSIONID_*`) in `Cookie:` — binds the CSRF token to the session. SAP rejects the call (HTTP 403) if the cookie differs from the one returned by the CSRF fetch.

Plumbing:
- JWT and CSRF live in `simpleCache` so all business routes share one fetch.
- The session cookie lives in a single `instanceCookieHandler` bean. Both `get-csrf-token` and `rest-outbound-shared` reference `#instanceCookieHandler`.

## Error-recovery hooks

| Status | Reason | Recovery in `post-quote-to-sap` |
|---|---|---|
| 401 | JWT expired (cached value no longer accepted) | onException → `direct:get-jwt-token` + `direct:get-csrf-token`, redeliver once |
| 403 | CSRF token / cookie mismatch | onException → `direct:get-csrf-token`, redeliver once |
| 5xx / SSL / IO | transient | shared route logs and rethrows |

## Operational toggles

- **`ext.api.call_is_DISABLED=true`** — suppresses the outbound POST. Use during cut-over rehearsals.
- **`ext.api.tokens.autoStartup=false`** — disables the refresh timer (useful in local dev where SAP is unreachable). Routes will still try to acquire tokens lazily via the 401/403 hooks.
- **`ext.api.tokens.refreshPeriodMs`** — set to a value safely under the SAP token TTL (commonly 1h → refresh every 30m).

## Assumptions and version note

- Targeting **Camel 4** (IM 7.x default). No `*Ref` legacy attribute names used. If the target project's `pom.xml` declares Camel 3, swap `redeliveryPolicy` → `redeliveryPolicyRef` per `docs/routes.md`.
- The Pricefx event payload is assumed to expose a quote-like object on `body` with `uniqueName`, `label`, `customerId`, `totalCost`, `currency`, and `quoteLineItems`. Adjust the Groovy body-builder in `post-quote-to-sap.xml` to your actual event shape.
- The SAP OData EntitySet name (`QuoteSet`) and field names in the JSON payload are illustrative; align with your actual SAP service metadata.

## Self-check (per SKILL Step 8)

1. Every `{{placeholder}}` has a matching `application.properties` entry. OK.
2. Route file names match `id` attributes (`post-quote-to-sap`, `rest_outbound_call`, `get-jwt-token`, `get-csrf-token`, `refresh-api-tokens`). OK.
3. `&amp;` used for every `&` in XML URI attributes. OK.
4. No credentials hardcoded — all sensitive values use `{ENC}` placeholders. OK.
5. `socketTimeout` and `connectTimeout` set on every business `<toD>` and token-fetch `<toD>`. OK.
6. No `direct:rest_auth_get_token` sub-route — SAP JWT+CSRF flow uses `simpleCache` + refresh timer instead (per references.md Step 5d). OK.
7. `throwExceptionOnFailure=false` only on token/CSRF endpoints; `=true` on the business POST. OK.
8. `simpleCache` bean declared once; business route reads via `${bean:simpleCache.getOrDefault('JWT','')}` and `${bean:simpleCache.getOrDefault('CSRF','')}`. OK.
9. Same `cookieHandler=#instanceCookieHandler` on both `get-csrf-token` and `rest-outbound-shared`. OK.
