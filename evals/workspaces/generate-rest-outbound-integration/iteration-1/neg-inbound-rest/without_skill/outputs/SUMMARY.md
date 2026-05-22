# Baseline (without_skill): Inbound REST endpoint — declined to generate

**User prompt:** `I want to expose a REST endpoint from IM that external systems can call to submit a quote via POST /quotes. Needs JSON request validation and structured 400 errors.`

## Decision: did NOT generate any route, mapper, connection, or properties files.

## Rationale (from shared docs only — no plugin skill invoked)

The Pricefx IM framework as documented in `docs/components.md`, `docs/routes.md`, and `docs/connections.md` does NOT expose an inbound HTTP endpoint:

1. **`docs/components.md` is explicit:** *"All components use the `pfx-` prefix and are **producer-only** (used in `<to>` or `<toD>`, not `<from>`) — with the exception of `pfx-event:fetch`, the event-polling consumer."* `pfx-rest` is therefore producer-only and cannot host an HTTP endpoint.
2. **No inbound REST DSL** (`<restConfiguration>`, `<rest path="/quotes">`, `platform-http`, Jetty / Netty / Undertow / Servlet) is documented or sanctioned anywhere in the framework reference.
3. **The only documented consumer endpoints** are `file`, `pfx-sftp`, Quartz, `pfx-sql`, `pfx-event:fetch`, and `direct:` — none of these accept inbound HTTP.
4. **None of Patterns 1–9 in `docs/routes.md`** describes exposing a webhook / endpoint. Pattern 4 (REST API Integration) is explicitly an outbound call.
5. **All REST connection discriminators** in `docs/connections.md` (`OAuth2Connection`, `BasicConnection`, `JwtConnection`, `NoopConnection`) describe outbound client config (`url`, `authUrl`, credentials) — there is no server-side listener config.

## Correct skill for this scenario

`generate-inbound-rest-endpoint` (the inverse of `generate-rest-outbound-integration`). The skill catalogue lists it as the canonical confusion partner for outbound REST.

## What the user could do instead

- **External system drops files:** `file` / `pfx-sftp` consumer + `pfx-api:loaddata` against `Q` / `QLI`.
- **External system calls Pricefx directly:** point them at Pricefx's own REST API (e.g. `/quote.*`) and remove IM from the request path.
- **Webhook into IM:** not supported by the documented component set — needs the `generate-inbound-rest-endpoint` skill to confirm whether the deployment includes the necessary REST DSL bundle.

## Artefacts produced

None — no route XML, mapper, connection JSON, or properties. Producing an outbound `pfx-rest:post` skeleton for an inbound prompt would actively mislead.
