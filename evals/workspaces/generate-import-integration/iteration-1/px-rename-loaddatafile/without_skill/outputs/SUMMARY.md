# Baseline (no skill) summary — px-rename-loaddatafile

(Recovered from response — harness blocked .md write.)

Generated a CSV-to-Pricefx PX import for the Pricing extension table using `pfx-api:loaddataFile`.

**Files:**
- `routes/import-pricing.xml`
- `mappers/import-pricing.mapper.xml`
- `config/application.properties`

**Route `import-pricing`:**
- `from`: `file://{{integration.sftp.root}}/import/pricing?delay=10000&{{archive.file}}&{{read.lock}}`
- `pfx-csv:streamingUnmarshal?skipHeaderRecord=true&useReusableParser=true`
- `pfx-api:loaddataFile?objectType=PX&mapper=import-pricing.mapper&batchSize=200000`

**Mapper `import-pricing.mapper` (provisioned-IM format):**
- `<constant expression="Pricing" out="name"/>` — required for PX.
- `<body in="partNumber" out="sku"/>` — business key.
- `<body in="listPrice" out="attribute1" converterExpression="stringToDecimal"/>`.
- `<body in="costCenter" out="attribute2"/>`.

**Assumptions:**
- PX table name exactly `Pricing`.
- Attribute slot assignment positional.
- IM 7.x / Camel 4 form, default Pricefx connection.
- No scheduler — continuous file polling at `delay=10000`. `read.lock=changed`.
