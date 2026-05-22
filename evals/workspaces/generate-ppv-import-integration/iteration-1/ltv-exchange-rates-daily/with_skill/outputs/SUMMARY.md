# PPV Import — Daily ECB Exchange Rates → LTV `ExchangeRates`

## Prompt

> Set up daily exchange rates load from ECB. CSV has columns `currencyCode`, `rate`. Target: LTV table called `ExchangeRates`.

## Design decisions

| Topic | Choice | Reasoning |
|---|---|---|
| Table type | **LTV / SIMPLE** | The prompt specifies an LTV target, and the source has exactly two columns (key + value) — the canonical SIMPLE shape. |
| `objectType` | `LTV` | Per SKILL.md, `SIMPLE` Company Parameters map to `LTV` in IM. |
| `pricingParameterName` | `ExchangeRates` | Taken verbatim from the prompt — this is the table's `uniqueName` in Pricefx. |
| Mapping | `currencyCode` → `name`, `rate` → `value` | The two LTV fields are fixed (`name`, `value`); `currencyCode` is the key and `rate` is the value. |
| `rate` converter | `stringToDecimal` | ECB exchange rates are decimal (e.g. `1.0856`); CSV columns arrive as strings and must be converted explicitly. The `name` column is left as-is (string). |
| Import mode | **Replace** (`loaddataFile`) | "Daily exchange rates load" — daily full refreshes are the natural fit. Each run replaces yesterday's snapshot. |
| Streaming pattern | `pfx-csv:streamingUnmarshal` + `pfx-api:loaddataFile` | Skill default; the no-per-batch-logs trade-off is acceptable for a tiny file (~35 ISO currencies). |
| `batchSize` | `500000` | < 10 fields per row → largest batch size per the components doc. |
| `businessKeys` | omitted | PPV imports do not take `businessKeys` — LTV uses the implicit `name` key. |
| `<constant out="name"/>` in mapper | omitted | PPV mappers must NOT include the `name` constant — the table is identified by `pricingParameterName` on the URI. |
| Source URI | `file://{{integration.sftp.root}}/exchange-rates?...` | Skill rule: derive the folder from the parameter name in kebab-case → `/exchange-rates`. |
| Schedule | `quartz` cron `0 0 6 * * ?` (daily 06:00) | "Daily" load — 06:00 chosen because ECB publishes daily reference rates at ~16:00 CET the previous business day, so by 06:00 the file is reliably present. Wired into the file consumer rather than a separate timer route. |
| File safety | `{{read.lock}}` (readLock=changed) | No `.done` marker mentioned, so wait until file size stabilises before processing. |
| Archive | `{{archive.file}}` always on | Mandatory per the file-consumer convention. |
| `delimiter` | `,` (comma) | Standard CSV — explicit on the URI for clarity. |
| `skipHeaderRecord` | `true` | CSV "has columns" implies a header row. |
| Camel form | Camel 4 (no `Ref` suffixes, `{{...}}` placeholders) | Plugin default for IM 7.x. |
| Resource IDs | `import-ppv-exchange-rates` (route) / `import-ppv-exchange-rates.mapper` (mapper) | Match file names exactly per the resource-id naming rule. |

## Caveats — no `pfx` CLI available in this eval

- The skill normally runs `pfx pricing-parameter ExchangeRates` to confirm the table exists, its type (SIMPLE vs RANGE), `uniqueName`, and `valueType`. The .env is absent here so I trusted the prompt: assumed **SIMPLE** with **REAL** value type. If the real partition has `ExchangeRates` defined as `RANGE` or a non-numeric value type, the mapper would need a different shape.
- I did not verify that the `ExchangeRates` table exists in the target partition. If it doesn't, it must be created first (`pfx create-pricing-parameter ExchangeRates`, then configured as SIMPLE/REAL).
- The ECB CSV format from the prompt (`currencyCode, rate`) is not the literal ECB published format (their daily file is XML-ish or has additional columns). I trusted the prompt that the file has been pre-shaped to those two columns. If the real feed includes a date column, LTV/SIMPLE has no date field, so any date would have to be a separate effective-date parameter — out of scope here.

## Files

- `import-ppv-exchange-rates.xml` — Camel route
- `import-ppv-exchange-rates.mapper.xml` — load mapper
- `application.properties` — file-handling helper properties
