# Outbound REST: Price List -> Webhook

Pushes updated Pricefx Price List Items to a downstream webhook on a daily schedule. Retries automatically on transient (HTTP 5xx) failures with exponential backoff.

## Mode chosen

Simple+ - single business route file. The skill's "Complex" shared-outbound pattern is unnecessary here: there is no auth, no token caching, no second outbound route in scope. The only shared artefact extracted is the reusable `restOutboundRedeliveryPolicy` bean so other routes added later can reuse the same retry semantics.

## Generated artefacts

| File | Destination in IM project | Purpose |
|---|---|---|
| export-pricelist-to-webhook.xml | src/main/resources/repo/routes/ | Business route: daily Quartz trigger, delta fetch, batched POST to webhook, dry-run toggle, 5xx-only retry, last-export-timestamp writeback. |
| export-pricelist-to-webhook.filter.xml | src/main/resources/repo/filters/ | Delta filter on lastUpdateDate between previous and current export timestamps. |
| rest-outbound-retry-policy.xml | src/main/resources/repo/routes/ | Spring bean restOutboundRedeliveryPolicy with exponential backoff (5s / 10s / 20s, capped at 60s). |
| application.properties | src/main/resources/repo/config/ | Endpoint / timeout / retry / schedule / dry-run properties. Merge into the project's existing file. |

## Design choices

- Trigger: Quartz cron `0 0 2 ? * *` (daily at 02:00 UTC), stateful=true. Cron and timezone property-driven.
- Delta sync: pfx-config get/set for lastExportTimestamp; current upper bound captured at top of run; both bounds used in filter to avoid mid-export gaps. First-run default 1970-01-01T00:00:00.
- Source: pfx-api:fetch on objectType=PLI in batchedMode=true with split + fetchIterator to avoid loading large lists into memory.
- Payload: per batch, Groovy builds {correlationId, exportTimestamp, previousTimestamp, recordCount, items[]}; route marshals to JSON.
- HTTP call: toD on {{ext.api.url}} with bridgeEndpoint=true, throwExceptionOnFailure=true, connectionClose=true, explicit socketTimeout/connectTimeout.
- Retry on 5xx only:
  - onException on HttpOperationFailedException with onWhen filtering statusCode 500-599 references restOutboundRedeliveryPolicy. handled=false lets Camel apply redeliveries.
  - A second onException on HttpOperationFailedException (no onWhen) handles 4xx and similar non-retryable errors - logged and marked handled.
  - A final onException on java.lang.Exception catches unexpected non-HTTP failures.
- Dry-run: ext.api.call_is_DISABLED=true short-circuits the toD POST and logs DRY_RUN.
- Correlation: UUID correlationId header threaded through every log line.
- No credentials in source. Webhook is unauthenticated by design. If a shared secret is later required, add setHeader X-Webhook-Secret referencing an {ENC}-encrypted property.

## Camel version

Generated in Camel 4 form (IM 7.x default). onException redeliveryPolicy="restOutboundRedeliveryPolicy" matches Camel 4. If the target project is Camel 3, rename redeliveryPolicy -> redeliveryPolicyRef per docs/routes.md.

## How to wire it in

1. Drop the four files into the locations shown in the table above.
2. Merge application.properties into the project's existing config/application.properties.
3. Tune ext.api.schedule.cron / timezone per environment.
4. Set ext.api.call_is_DISABLED=true in non-prod until the webhook contract is validated.

## Self-check (Step 8)

- Every {{placeholder}} has a matching key in application.properties. OK
- Route file name matches id (export-pricelist-to-webhook). OK
- All & in XML URI attributes are escaped as &amp;. OK
- No hardcoded credentials, URLs, or tokens - ext.api.url is the only URL and lives in properties. OK
- socketTimeout and connectTimeout set on the business toD. OK
- throwExceptionOnFailure=true on the business call. OK
- No auth sub-route generated (auth = none). OK
- Retry policy bean defined; route references it via redeliveryPolicy=. OK
- 5xx-only onException ordered before the generic HttpOperationFailedException handler so the 5xx filter wins. OK
