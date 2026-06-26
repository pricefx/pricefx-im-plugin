# Route Analysis: `import-px-prices`

Analyzed:
- Route: `fixture/import-px-prices.xml`
- Mapper: `fixture/import-px-prices.mapper.xml`

## Verdict

**Do NOT deploy as-is.** There is one blocking bug that will cause the PX import to fail or write to the wrong table, plus a couple of minor robustness notes.

---

## Critical — Blocking Bug

### 1. PX mapper is missing the required table-name `<constant out="name"/>`

The route loads into a **Product Extension** (`objectType=PX`):

```xml
<to uri="pfx-api:loaddataFile?objectType=PX&amp;mapper=import-px-prices.mapper&amp;businessKeys=sku&amp;batchSize=100000"/>
```

But the mapper does not set the extension table name:

```xml
<loadMapper id="import-px-prices.mapper">
    <body in="sku" out="sku"/>
    <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
    <body in="currency" out="attribute2"/>
</loadMapper>
```

For PX (and CX) loads, **there is no `extensionName` parameter on the component** — the target extension table name is set *in the mapper* as a constant mapped to the `name` field. This is stated explicitly in both `docs/components.md` and `docs/mappers.md`:

> "PX / CX mappers must include the table name as a constant." Without `<constant ... out="name"/>`, the PX/CX import will fail or write to the wrong table.

**Fix** — add the constant (replace `Prices` with the real PX table unique name):

```xml
<loadMapper id="import-px-prices.mapper">
    <constant expression="Prices" out="name"/>  <!-- required: PX extension table name -->
    <body in="sku" out="sku"/>
    <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
    <body in="currency" out="attribute2"/>
</loadMapper>
```

Confirm the exact table unique name with `pfx product-extension {name}` / `pfx product-extensions` before settling on the constant value.

---

## Minor / Advisory

### 2. `businessKeys=sku` is redundant (not a bug)

On `loaddataFile` for P/PX, IM auto-detects the join keys, so `businessKeys=sku` is optional and harmless. Leave it or drop it — no functional impact.

### 3. File-consumer config looks correct

The `<from>` URI follows the documented file-consumer pattern: `{{archive.file}}` is present, and `{{read.lock}}` is used (read-lock vs. done-file — only one, satisfied). `{{error.file}}` is the optional extra. No `noop=true`. This part is good.

### 4. ID / naming conventions are correct

- Route `id="import-px-prices"` matches the filename `import-px-prices.xml`.
- Mapper `id="import-px-prices.mapper"` matches `import-px-prices.mapper.xml` and the route's `mapper=` reference.

### 5. Streaming + batch sizing is appropriate

`pfx-csv:streamingUnmarshal` paired with `loaddataFile` is the recommended large-file pattern. With ~4 fields per row, `batchSize=100000` is reasonable (docs suggest up to 500000 for <10 fields, so this is conservative but fine).

---

## Summary

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Blocking** | PX mapper missing `<constant ... out="name"/>` — import will fail or target wrong table |
| 2 | Info | `businessKeys=sku` redundant on `loaddataFile` (harmless) |
| 3–5 | OK | File consumer, naming, and streaming/batch config are correct |

The single must-fix before deploy is **#1**.
