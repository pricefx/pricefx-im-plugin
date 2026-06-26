# Lint Report — `import-products.xml`

**File:** `/Users/mnagas/Documents/pricefx/pricefx-im-plugin/evals/workspaces/analyze/iteration-2/pos-lint-import-products/fixture/import-products.xml`
**Route ID:** `import-products`
**Type:** Inbound CSV → Pricefx Product (P) load
**Camel form:** Camel 4 (`{{...}}` placeholders, no `routeContext` wrapper) — modern/provisioned

## Verdict

The route is well-structured and close to compliant. It uses the recommended `streamingUnmarshal` + `loaddataFile` pattern, a proper file-consumer URI with archive + read-lock, and correctly omits `noop`. **One genuine issue** (redundant `connection=pricefx`) and **two minor observations**.

## Route under review

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="import-products">
        <from uri="file://{{integration.sftp.root}}/inbound/products?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>
        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
        <to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;businessKeys=sku&amp;batchSize=500000&amp;connection=pricefx"/>
        <log message="Import complete: ${header.CamelFileName}" loggingLevel="INFO"/>
    </route>
</routes>
```

## Findings

| # | Severity | Convention | Status |
|---|----------|------------|--------|
| 1 | **Warning** | AP-15 — Redundant `connection=pricefx` | **Violation** |
| 2 | Info | `businessKeys=sku` on `loaddataFile` | OK (optional, not a defect) |
| 3 | Info | `batchSize=500000` for a P load | Verify vs. field count |
| — | Pass | Root element `<routes>`, route id matches filename | Pass |
| — | Pass | `streamingUnmarshal` + `loaddataFile` (preferred over `loaddata`) | Pass |
| — | Pass | File URI uses `{{archive.file}}` + `{{read.lock}}`, no `noop=true` | Pass |
| — | Pass | `&amp;` escaping in all URIs | Pass |
| — | Pass | Camel-4 attribute forms | Pass |

### 1. Redundant `connection=pricefx` — WARNING (AP-15)

`pfx-api:loaddataFile?...&connection=pricefx` carries an explicit `connection=pricefx`. Per `docs/connections.md` and anti-pattern **AP-15**, the connection bean named `pricefx` is the implicit default for all `pfx-api:*` components, so this parameter is redundant and should be removed.

**Fix:** drop `&amp;connection=pricefx` from the `loaddataFile` URI:

```xml
<to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;businessKeys=sku&amp;batchSize=500000"/>
```

(Only keep a `connection=` parameter when targeting a *non-default* Pricefx instance.)

### 2. `businessKeys=sku` — INFO (not a defect)

`businessKeys=sku` is present on `loaddataFile`. For P/PX loads IM auto-detects the join key (`sku`), so this is optional — it is **not** an anti-pattern and is safe to keep for explicitness. No action required.

### 3. `batchSize=500000` — INFO (verify)

`batchSize=500000` is the recommended value for rows with **< 10 fields** (`docs/components.md`). If the product CSV has 10–20 fields, lower it to `100000–200000`; for 20+ fields, `50000` or less. Confirm against the actual `import-products.mapper` field count.

## Conventions that could not be fully verified

These depend on files not present in the fixture directory (only the route was provided):

- **Mapper existence / ID:** route references `mapper=import-products.mapper`. The file `mappers/import-products.mapper.xml` with `id="import-products.mapper"` must exist; ID mismatch causes deployment failure.
- **Property definitions:** `{{integration.sftp.root}}`, `{{archive.file}}`, `{{read.lock}}` must be defined in `config/application.properties`. The naming matches the documented file-consumer convention, which is a good sign.

## Summary

1 real fix (remove `connection=pricefx`). The route otherwise follows IM conventions well — correct root element, matching route id, the preferred streaming load pattern, and a compliant file-consumer URI. Confirm the referenced mapper and properties exist, and sanity-check `batchSize` against the mapper's field count.
