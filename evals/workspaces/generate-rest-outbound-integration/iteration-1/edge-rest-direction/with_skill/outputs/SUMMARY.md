# Edge Case: Ambiguous REST Direction — with skill

**User prompt:** "I need to integrate Pricefx with a REST API."

## Decision: Did NOT generate any route, mapper, connection, or properties files.

## Why this prompt is too ambiguous to safely generate

The prompt names a technology (REST) and the two parties (Pricefx, an external API) but does NOT establish the most important architectural decision: the **direction of the HTTP call**. Without that, the skill cannot pick the right template, auth model, or even the right artifact type.

This skill (`generate-rest-outbound-integration`) is scoped to **outbound** — IM is the HTTP client, pushing/pulling via `pfx-rest` / `<toD uri="https://...">`, triggered by event/schedule/timer/`direct:` inside IM.

If the user wants **inbound** — IM as the HTTP server that an external system calls — this skill is the wrong choice. That scenario uses `platform-http` / `rest-dsl`, different auth concerns (validating incoming requests, not managing outgoing credentials), and is handled by `generate-inbound-rest-endpoint`.

Picking blindly would generate ~5 files (route XML, shared outbound route, auth sub-route, properties, maybe a connection JSON) that the user then discards. The right move is one clarifying question first.

## Clarifying question to ask first

> Which direction is the integration?
> 1. **Outbound** — IM calls an external REST API. IM is the HTTP client.
> 2. **Inbound** — An external system calls a REST endpoint exposed by IM. IM is the HTTP server.

## Skill routing by branch

| Direction | Skill | Primary Camel construct |
|---|---|---|
| Outbound (IM → external) | `generate-rest-outbound-integration` | `<toD uri="${headers.serviceURL}?bridgeEndpoint=true&amp;...">` |
| Inbound (external → IM) | `generate-inbound-rest-endpoint` | `platform-http` / `rest-dsl` consumer in `<from>` |

## Secondary questions (only after the direction is settled)

For **outbound**, walk Step 1 of the skill questionnaire: route name; trigger (`event:` / `scheduled:` / `direct:` / `timer:`); target URL; HTTP method; content type; auth type (`none`/`apikey`/`basic`/`oauth2`/`oauth2-cached`/`mtls`/`sap-jwt-csrf`); payload strategy (Groovy/FreeMarker/pass-through); throttling; retry; dry-run toggle.

For **inbound**, hand off to `generate-inbound-rest-endpoint` for its own questionnaire (path/method, incoming auth, validation, downstream route).

## Additional ambiguities to surface after direction is clear

1. Business purpose / Pricefx object type involved.
2. Target system identity (Salesforce, SAP, generic webhook) — implies the auth shape.
3. Trigger style (event / schedule / on-demand / one-shot).
4. Volume profile (single vs bulk) — drives `oauth2-cached` vs `oauth2` and whether `<throttle>` is needed.

## Recommended behavior

Generate nothing. Ask the direction question first; wait for the answer; then either continue this skill's Step 1 (outbound) or hand off to `generate-inbound-rest-endpoint` (inbound).
