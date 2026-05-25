# Lint Report — `import-products.xml`

**File:** `fixture/import-products.xml`
**Route ID:** `import-products`
**Pattern:** Inbound CSV → Product (P) bulk load via `pfx-api:loaddataFile` (streaming).

## Summary
HIGH: 1 | MEDIUM: 0 | LOW: 2 | INFO: 1

## Findings

### H1 (HIGH) — Redundant `connection=pricefx` (line 7)

`docs/connections.md`: "NEVER add `connection=pricefx` to route URIs — it is redundant since `pricefx` is the default." Remove `&amp;connection=pricefx` from the `loaddataFile` URI.

### L1 (LOW) — Unnecessary `businessKeys=sku` (line 7)

For object type `P` with `loaddataFile`, IM auto-detects join keys. The parameter is harmless but misleading; drop it unless overriding.

### L2 (LOW) — `batchSize=500000` likely too large (line 7)

`docs/components.md` guidance: `<10` fields → `500000`; `10-20` → `100000-200000`; `20+` → `<= 50000`. Product Master mappers usually write 10+ attributes. Recommend `100000-200000` unless the mapper is genuinely narrow.

### I1 (INFO) — No `<onCompletion>` / `pfx-api:internalCopy?label=Product`

Common follow-up for Product loads to refresh downstream PX/derived data. Add only if the project needs it.

## Good Practices Observed

- `<routes>` root + Camel Spring namespace (correct provisioned-IM format).
- `id="import-products"` matches file name; mapper id `import-products.mapper` follows convention.
- Inbound URI uses recommended file-consumer placeholders (`{{integration.sftp.root}}`, `{{archive.file}}`, `{{read.lock}}`) with no `noop=true`.
- `pfx-csv:streamingUnmarshal?useReusableParser=true` paired with `pfx-api:loaddataFile` — recommended high-throughput combo.
- Proper `&amp;` escaping in URI query strings.
- Start/end logs include `${header.CamelFileName}` for traceability.

## Suggested Clean Version

```xml
<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="import-products">
        <from uri="file://{{integration.sftp.root}}/inbound/products?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
        <log message="Processing: ${header.CamelFileName}" loggingLevel="INFO"/>
        <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
        <to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;batchSize=200000"/>
        <log message="Import complete: ${header.CamelFileName}" loggingLevel="INFO"/>
    </route>
</routes>
```

Changes: drop `connection=pricefx`, drop `businessKeys=sku`, lower `batchSize` to `200000`.
