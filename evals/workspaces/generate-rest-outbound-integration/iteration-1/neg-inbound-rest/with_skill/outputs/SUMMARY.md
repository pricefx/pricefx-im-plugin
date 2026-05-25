# Skill Does Not Apply — Request Is Inbound, Not Outbound

## User Request

> "I want to expose a REST endpoint from IM that external systems can call to submit a quote via POST /quotes. Needs JSON request validation and structured 400 errors."

## Why `generate-rest-outbound-integration` Does NOT Apply

This skill generates **outbound** integrations — where IM is the HTTP **client** that calls an external REST API (POST/PUT/PATCH to an external system, with OAuth2 / API-key / Basic / mTLS / SAP-JWT auth, throttling, retry, dry-run, etc.). It uses `pfx-rest` / `<toD>` HTTP producer endpoints.

The user's request is the **opposite direction**: IM must act as an HTTP **server**, exposing `POST /quotes` so external systems can call into IM. This requires:

- A `restConfiguration` (Camel REST DSL host/port/binding settings)
- A `<rest>` block with a `<post path="/quotes">` declaration
- JSON unmarshalling + schema/bean validation of the request payload
- A structured 400 error response on validation failure (consistent JSON error envelope)
- Optional 201 Created response with a Location header on success

None of the outbound-skill artifacts apply — there is no external URL to call, no outbound auth, no `serviceURL` header, no `direct:rest_outbound_call`, no dry-run toggle for suppressing HTTP calls.

The `generate-rest-outbound-integration` SKILL.md explicitly states in its description:

> "For an INBOUND endpoint exposed from IM use `generate-inbound-rest-endpoint`."

## Correct Skill

**`generate-inbound-rest-endpoint`** — the dedicated skill for IM-as-server REST endpoints.

## Brief Outline of the Correct Inbound Pattern

A correct implementation would look roughly like:

1. **`restConfiguration`** in a routes XML file (or shared config) — declares the component (`platform-http` / `jetty` / `servlet`), `bindingMode="json"`, `contextPath`, JSON data formats, and CORS if needed.

2. **`<rest>` DSL block** declaring the endpoint:
   ```xml
   <rest path="/quotes" consumes="application/json" produces="application/json">
     <post type="QuoteRequest" outType="QuoteResponse">
       <to uri="direct:submit-quote"/>
     </post>
   </rest>
   ```

3. **JSON validation** — either:
   - JSON Schema validation via `json-validator:` component pointing at a `.json` schema in `repo/resources/`, OR
   - Bean validation (`bean-validator:`) with JSR-380 annotations on a DTO class.

4. **Structured 400 error handling** — `<onException>` on `javax.validation.ConstraintViolationException` / `org.apache.camel.component.jsonvalidator.JsonValidationException` that:
   - Sets `CamelHttpResponseCode=400`
   - Sets `Content-Type=application/json`
   - Builds an error envelope body (e.g., `{ "error": "...", "details": [...] }`) via Groovy or a FreeMarker template
   - Marks the exception `<handled><constant>true</constant></handled>`

5. **Business route** (`direct:submit-quote`) — transforms the validated payload and calls `pfx-api:loaddata` / `pfx-api:integrate` against the Pricefx Quote (`Q`) / Quote Line Item (`QLI`) object types.

6. **Properties** — `inbound.rest.host`, `inbound.rest.port`, `inbound.rest.contextPath`, and any auth-token configuration if the endpoint must be secured to callers.

## Recommendation

Re-invoke the request against `generate-inbound-rest-endpoint`. No outbound artifacts (routes, mappers, connections, properties) were generated under this skill, as that would be incorrect for the user's actual need.
