# Decision: deferral (wrong skill)

After reading `skills/generate-import-integration/SKILL.md`, the with-skill subagent decided this is NOT the right skill for the prompt and produced no route / mapper / properties artefacts.

## Why

- Frontmatter explicitly says: "For Pricing Parameters (LTV/MLTV2) use `generate-ppv-import-integration`."
- Body lists supported object types as P, PX, C, CX, SL, SX — LTV/MLTV2 are not in scope.

The prompt is unambiguously an LTV import:
- "LTV exchange rates" → objectType `LTV`
- "Pricefx Pricing Parameter table called ExchangeRates" → `pricingParameterName=ExchangeRates`
- "single column key value pairs USD/EUR" → canonical LTV shape (`name` + `value`)

## Recommended next action

Re-run the request against `generate-ppv-import-integration` (skill exists at `skills/generate-ppv-import-integration/`). That skill knows the LTV shape:

- `pfx-api:loaddata?objectType=LTV&mapper=...&pricingParameterName=ExchangeRates`
- `<loadMapper>` with `<body ... out="name"/>` and `<body ... out="value"/>`
- No `businessKeys` (LTV is keyed by `name`)
- No PX-style `<constant out="name"/>` table-name line — that's for PX/CX extensions, not PPV

## Files generated

None. Skill correctly deferred.
