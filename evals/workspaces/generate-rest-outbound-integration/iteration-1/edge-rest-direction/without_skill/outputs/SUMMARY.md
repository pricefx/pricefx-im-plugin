# REST API Integration — Edge Case Evaluation

## Decision: DO NOT GENERATE — Too Ambiguous

The prompt "I need to integrate Pricefx with a REST API" lacks essential information. Generating without these details would fabricate an artifact unlikely to match user intent.

## Why Ambiguous

Direction of data flow is unspecified. At least four valid interpretations exist:

1. **Inbound (pull):** IM calls external REST API (`pfx-rest:get`), unmarshals JSON, loads into Pricefx (`pfx-api:loaddata`/`loaddataFile`/`integrate`).
2. **Outbound (push):** IM fetches from Pricefx (`pfx-api:fetch`), transforms, POSTs to external API (`pfx-rest:post`).
3. **Bidirectional:** Both, often with delta tracking via `pfx-config:get/set`.
4. **Event-driven outbound:** React to Pricefx events (`pfx-event:fetch`) by calling external API.

Each variant needs a different route skeleton, mapper, filter, and `application.properties`.

## Other Missing Information

- **External system identity** (Salesforce/SAP/custom) — drives connection type, field names.
- **Auth scheme** (OAuth2/Basic/JWT/Noop/mTLS) — drives connection `discriminator`.
- **HTTP method & path**, query params, pagination.
- **Pricefx object type** (P, PX, C, CX, DMDS, LTV, MLTV2, CRCP, RBA, etc.).
- **Business key(s)** for inbound load.
- **Field mapping** source → Pricefx attributes, including converters.
- **Trigger** (one-shot, cron, file arrival, event).
- **Payload format** (JSON, XML, multipart).
- **Delta strategy** (full vs. incremental with watermark).
- **Volume/batching** (streaming + `<split>` needed?).
- **Error handling** (retry, DLQ, partial-success).

## Clarifying Questions

1. **Direction:** Inbound to Pricefx, outbound from Pricefx, or both?
2. **External system:** Which one (Salesforce, SAP, custom)? Sample request/response available?
3. **Authentication:** OAuth2 / Basic / JWT / mTLS / API key / none?
4. **Pricefx object:** Which object type (P, PX, C, CX, DMDS, LTV, MLTV2, CRCP, ...)?
5. **Field mapping:** Which source fields map to which Pricefx attributes?
6. **Trigger:** Schedule (cron), on demand, file arrival, or Pricefx event?
7. **Delta vs. full:** Full reload each run, or incremental since last run?
8. **Volume:** Roughly how many records per run?

## What Was NOT Generated

No route XML, mapper XML, filter XML, connection JSON, or `application.properties` was written. Producing any of these from one ambiguous sentence would require fabricating all of the above and would likely mislead the user.

## Next Step

After the user answers questions 1–4 at minimum, a concrete bundle can be generated.
