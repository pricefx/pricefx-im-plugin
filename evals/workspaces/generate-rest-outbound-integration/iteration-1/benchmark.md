# generate-rest-outbound-integration — iteration-1 benchmark

_Generated 2026-05-22T13:24:31.952911+00:00_

## Aggregate

| Config | Pass rate | Time (s) | Tokens |
|---|---|---|---|
| with_skill | 1.000 ± 0.000 | 0.0 ± 0.0 | 0 ± 0 |
| without_skill | 0.976 ± 0.058 | 0.0 ± 0.0 | 0 ± 0 |
| **delta** | +0.0238 | +0.0 | +0 |

## Per-eval pass rate

| Eval | Category | with_skill | without_skill |
|---|---|---|---|
| bearer-throttle | positive | 5/5 | 5/5 |
| edge-rest-direction | edge | 2/2 | 2/2 |
| evt-erp-post-oauth2 | positive | 5/5 | 5/5 |
| neg-csv-export | negative | 2/2 | 2/2 |
| neg-inbound-rest | negative | 2/2 | 2/2 |
| sap-jwt-csrf | positive | 6/6 | 5/6 |
| sched-webhook-retry | positive | 5/5 | 5/5 |

## Analyst notes

- Output-quality benchmark for the outbound REST integration generator (IM → external HTTP). The skill covers Simple, Complex, and Complex+ modes plus six auth variants (no-auth, API-key, OAuth2 client-credentials, OAuth2 cached, HTTP Basic, mTLS, SAP JWT+CSRF). Test asks whether Claude reliably picks the right shared-route pattern, auth flow, and observability hooks with vs without the skill.
- Positive cases cover the common auth & trigger combinations: event-driven OAuth2 POST, scheduled webhook with retry, SAP JWT+CSRF event POST, daily Bearer + throttling. Together they exercise pfx-event:fetch / quartz / direct triggers and the OAuth2 / SAP-JWT auth variants.
- Negative cases (inbound endpoint, CSV file export) test that the skill recognizes the wrong direction or wrong protocol and defers to generate-inbound-rest-endpoint / generate-export-integration. The skill's closest confusion partner is generate-inbound-rest-endpoint (inverse direction).
- Edge case ('integrate Pricefx with a REST API' — direction unclear) tests whether the skill asks outbound-or-inbound rather than silently picking one.
- Trigger evals NOT measured here — see evals/benchmarks/config.md. This benchmark is output-quality only.
- Caveat: pfx CLI was unavailable (no .env). REST outbound has no partition-metadata dependency, so this caveat is informational only.
- Delta +4 pts (with_skill 100%, baseline 96%) is driven entirely by ONE assertion on sap-jwt-csrf — the canonical instanceCookieHandler+simpleCache pattern from references.md Step 5d that the skill teaches explicitly. The baseline manually captured Set-Cookie and replayed it, which is functionally similar but more fragile when SAP sessions expire mid-flight.
- On the other 6 cases (event-driven OAuth2 POST, scheduled webhook + retry, Bearer + throttle, inbound-rest negative, csv-export negative, ambiguous-direction edge) the baseline matches the skill on output correctness — Claude with just docs/components.md + docs/routes.md + docs/connections.md produces externalized URLs (via property placeholder OR connection JSON), correct auth wiring, throttling, retry, event triggers, and proper negative-case routing.
- Two assertions were relaxed after the first pass to remove false positives: url-via-placeholder on evt-erp-post-oauth2 and sched-webhook-retry was widened to also accept the connection-JSON `url` field (a valid externalization per docs/connections.md), and bearer-token-auth on bearer-throttle was widened to accept any Bearer-with-placeholder form. Both were genuine convention differences, not correctness gaps.
- Iter-2 recommendation: add more sap-jwt-csrf-style discriminating cases — auth variants where the skill teaches a specific robust pattern over a naive equivalent (e.g. mTLS sslContextParameters bean vs inline JKS handling, oauth2-cached simpleCache vs per-call token fetch, status writeback with defaultErrorHandler vs inheriting redelivery policy).
