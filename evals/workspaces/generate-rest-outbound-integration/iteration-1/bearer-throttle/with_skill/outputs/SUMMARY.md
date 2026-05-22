# export-webhook-daily — generation summary

## What this integration does
- Triggers daily at **02:00** via Quartz (`stateful=true`, no overlap).
- Fetches Pricefx data (in batches of 50,000) and POSTs each row to the webhook at `https://partner.example.com/webhook`.
- Authenticates with a **static Bearer token** read from `ext.api.auth.bearerToken` and injected via the `Authorization: Bearer …` header.
- Throttles the outbound HTTP call to **5 requests/second** using Camel's `<throttle>` EIP (configurable via `ext.api.throttle.requestsPerSecond`).
- Dry-run support: setting `ext.api.call_is_DISABLED=true` suppresses the HTTP call but still runs the rest of the route — safe for staging tests.
- Per-request `correlationId` for log correlation.

## Mode chosen
**Simple mode** — single self-contained route. Bearer-token auth is set as a single header (`Authorization: Bearer …`), so no OAuth token-exchange sub-route is needed and no `rest-outbound-shared.xml` was generated. Adding a shared route can be done later by switching `<toD>` to `direct:rest_outbound_call`.

## Files
| File | Purpose |
|---|---|
| `export-webhook-daily.xml` | Route: Quartz trigger → fetch from Pricefx → split → throttle → POST to webhook |
| `application.properties` | URL, bearer token (encrypted), throttle rate, schedule, dry-run toggle, source dataset |

## Key design notes
- **Throttle placement**: the `<throttle>` wraps the HTTP send inside the split, so the 5 req/s limit applies per request — not per batch. The throttle's `<constant>` reads `{{ext.api.throttle.requestsPerSecond}}` so ops can re-tune without redeploying.
- **Schedule encoding**: the cron is `0 0 2 * * ?`, encoded as `0+0+2+*+*+?` because Camel URI parameters replace spaces with `+`.
- **Source dataset**: `ext.api.source.dsUniqueName` and `ext.api.source.filter` are placeholders — point them at the actual DMDS / filter / mapper for the data you need to push. The route uses `pfx-api:fetch` + `pfx-api:fetchIterator` in batched mode, which is the standard outbound export pattern from `docs/routes.md`.
- **Timeouts**: `socketTimeout=60000`, `connectTimeout=30000`, `connectionClose=true` on every `<toD>` — per the skill's self-check rule.
- **No hardcoded credentials**: bearer token is `{ENC}…`. Customers can rotate it without code changes.
- **Camel version**: templates target **Camel 4** (IM 7.x default). The `<throttle>` body using a `<constant>` (rather than `executorServiceRef`) is Camel 4 form. No Camel 3 attributes were emitted.

## What was intentionally not added
- No retry/redelivery — the partner asked for daily push only; transient failures are logged. If retry is required later, add `rest-outbound-retry-policy.xml` per SKILL Step 7 and wire `redeliveryPolicy` on an `<onException>`.
- No OAuth token sub-route — the prompt specified "Bearer token", which is read as a static, pre-issued token. If the partner moves to OAuth 2.0 client credentials, switch to the Complex-mode shared route + `rest_auth_get_token` sub-route (SKILL Steps 3b–5).
- No status writeback — the webhook receiver does not return record-level acknowledgements.
