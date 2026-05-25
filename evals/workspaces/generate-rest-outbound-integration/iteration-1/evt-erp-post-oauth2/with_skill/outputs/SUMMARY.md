# export-approved-contracts-to-erp - Design Decisions

## Inputs interpreted from the prompt

| Decision point | Choice | Reason |
|---|---|---|
| Route name | `export-approved-contracts-to-erp` | Kebab-case, describes direction + object + target. |
| Trigger | Pricefx event `ITEM_APPROVED_PL` via `pfx-event:fetch` | Prompt: "After Pricefx event ITEM_APPROVED_PL". `pfx-event:fetch` is the canonical event consumer per `docs/routes.md` Pattern 7. |
| Target URL | `https://erp.internal/api/v2/contracts` | From prompt; stored under `ext.api.url`. |
| HTTP method | `POST` | From prompt. |
| Content type | `application/json` | Default for modern REST; marshalled via `<marshal><json/></marshal>`. |
| Auth | OAuth 2.0 client credentials (`oauth2`) | From prompt. Uses standard `rest_auth_get_token` sub-route (not `oauth2-cached` - event-driven, low volume). |
| Mode | Complex (shared outbound + auth sub-route) | SKILL Step 2: OAuth 2.0 implies Complex; shared infra is reusable. |
| Dry-run toggle | Yes (`ext.api.call_is_DISABLED`) | SKILL recommends always including it. |

## Files generated

1. `export-approved-contracts-to-erp.xml` - Business route. Consumes `pfx-event:fetch?eventType=ITEM_APPROVED_PL`, fetches the contract by `PfxTypedId` (objectType `CT`), groovy-transforms to ERP JSON, sets headers (`serviceURL`, `CamelHttpMethod`, `Content-Type`, `call_is_DISABLED`, `correlationId`), and delegates to `direct:rest_outbound_call`.
2. `rest-outbound-shared.xml` - Generic outbound caller from SKILL Step 4: preserves body, calls auth, `toD` with `bridgeEndpoint=true`, `throwExceptionOnFailure=true`, `socketTimeout=60000`, `connectTimeout=30000`, dry-run guard, full `<doCatch>` matrix.
3. `rest-auth-shared.xml` - OAuth 2.0 client-credentials token fetch from SKILL Step 5: POSTs to `{{ext.api.auth.url}}`, parses JSON, sets `Authorization: Bearer ...`.
4. `application.properties` - Only the OAuth + dry-run + throttling keys actually referenced.

## Conformance to SKILL rules

- Camel 4 form (no `*Ref` legacy attributes).
- All credentials placeholder-only; `clientSecret` as `{ENC}encryptedValue==`.
- All `&` escaped as `&amp;` in XML URI attributes.
- Route IDs match file names (sans `.xml`).
- `socketTimeout` and `connectTimeout` set on every HTTP `<toD>`.
- `throwExceptionOnFailure=false` ONLY on token endpoint; `throwExceptionOnFailure=true` on business call.
- `REST_requestBody` exchange property preserves body before the auth sub-route consumes it.
- No `connection=pricefx` and no `noop=true`.

## Notes / Assumptions

- Used `pfx-api:fetch?objectType=CT&sql=select * where typedId='${header.PfxTypedId}'` to materialise the full contract from the event's `PfxTypedId`. If the event payload already contains the full record, the fetch step can be removed.
- Object type code `CT` = Contract (Agreement) per `docs/project.md`. Because the event name is `ITEM_APPROVED_PL` (Price List Item approval), if "contract" in the prompt actually refers to a Price List Item, change `objectType=CT` to `objectType=PLI` and adjust the groovy payload. Flagging this as the most likely interpretation gap.
- ERP URL externalised via `ext.api.url` per the no-hardcoding rule.
