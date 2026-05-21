# Smart Auto-Mapping

Shared algorithm used by `generate-import-integration` and `generate-pa-import-integration` to propose a CSV → Pricefx field mapping automatically when **both** a CSV sample/header AND target metadata (with labels) are available. The skills should NOT ask the user to manually map fields when this algorithm is applicable — propose the mapping and let the user confirm or adjust.

## When to apply

| Skill | Trigger | Metadata source | Key field |
|---|---|---|---|
| `generate-import-integration` (P / PX / C / CX / SL / SX) | CSV sample/header is available AND target is PX/CX/SX | `product-extension-metadata` / `customer-extension-metadata` (no metadata command for P/C/SL — fall back to manual mapping there) | P/PX → `sku`, C/CX → `customerId`, SL/SX → `sellerId` |
| `generate-pa-import-integration` (DMDS) | CSV sample/header is available AND target DS has metadata | `data-source-metadata` | `sku` (DMDS convention) |

If the trigger condition is not met (no CSV sample, no metadata available, or P/C/SL master without an attribute table), fall back to the skill's manual-mapping step.

## Auto-Mapping Algorithm

For each CSV column, find the best matching Pricefx field using these rules in priority order.

### Priority 1 — Exact key field match (confidence: HIGH)

- CSV column name contains `id`, `sku`, `key`, `code`, `product_id`, `item_number` → map to the **key field** for the object type (see table above).
- CSV column name contains `name`, `description`, `label`, `title` (and is not a category/hierarchy column) → map to `label`.

### Priority 2 — Fuzzy match against attribute labels (confidence: HIGH or MEDIUM)

Compare each CSV column name against the attribute labels from metadata using these matching techniques (in order):

1. **Exact match** (case-insensitive): `"Product Name"` = `"Product Name"` → HIGH confidence
2. **Normalized match** (remove spaces / underscores / hyphens, lowercase): `"product_name"` = `"ProductName"` → HIGH confidence
3. **Contains match**: CSV `"Hierarchy Level 1"` contains label `"Hierarchy 1"` → MEDIUM confidence
4. **Word overlap** (≥50% of words shared): CSV `"Product Cost USD"` ↔ label `"Product Costs"` → MEDIUM confidence
5. **Abbreviation match**: CSV `"Prod Name"` ↔ label `"Product Name"` → MEDIUM confidence

### Priority 3 — Type-based matching (confidence: LOW)

If no label match is found, match by data-type compatibility:

- CSV column with decimal values → attribute with type `REAL` / `NUMERIC`
- CSV column with date values → attribute with type `DATE` / `DATETIME`

Only apply when there is a **single** compatible unmatched attribute of that type — otherwise the result is ambiguous.

### Priority 4 — Sequential fallback (confidence: LOW)

Remaining unmatched CSV columns → assign to the next available `attributeN` slot in order.

## Confidence Display

Present the proposed mapping as a table with confidence indicators. Use this exact format:

```
Smart Auto-Mapping Result:
| # | CSV Column          | → | Pricefx Field | Label          | Confidence | Match Reason              |
|---|---------------------|---|---------------|----------------|------------|---------------------------|
| 1 | Product ID          | → | sku           | —              | ✅ HIGH    | Key field (contains "ID") |
| 2 | Product Name        | → | attribute1    | Product Name   | ✅ HIGH    | Exact label match         |
| 3 | Hierarchy Level 1   | → | attribute2    | Product Hier 1 | 🟡 MEDIUM | Word overlap (73%)        |
| 4 | Cost                | → | attribute9    | Product Costs  | 🟡 MEDIUM | Word overlap + type match |
| 5 | Internal Code       | → | attribute11   | —              | 🔴 LOW    | Sequential fallback       |
```

Then ask: **Does this mapping look correct? You can adjust any row.**

## Converter Expression Auto-Detection

When proposing the mapping, also detect and suggest a `converterExpression` per field based on:

1. **Target field type** from metadata (e.g., `NUMERIC` → `stringToDecimal`)
2. **CSV sample data** patterns (e.g., recognised date format → `stringToDate`)

| Target Type | Suggested Converter |
|---|---|
| `NUMERIC`, `MONEY`, `PERCENT` | `converterExpression="stringToDecimal"` |
| `INTEGER` | `converterExpression="stringToInteger"` |
| `DATE` | `converterExpression="stringToDate"` (detect format from CSV sample) |
| `DATETIME` | `converterExpression="stringToDateTime"` |
| `TEXT`, `STRING` | none needed |

## LLM-Enhanced Mapping Reasoning

When the 4-tier automatic matching produces LOW-confidence results for a column, apply semantic reasoning before falling back:

1. **Analyse field semantics** — don't just match names, understand meaning:
   - `Cust_Num`, `Customer_Number`, `KUNNR`, `customer_id`, `cust_no` → all map to `customerId`
   - `Mat_No`, `Material`, `SKU`, `ItemCode`, `product_code` → all map to `sku`
   - `Desc`, `Description`, `Label`, `Name`, `Title` → likely maps to `label`
   - `Cat`, `Category`, `Group`, `Class`, `Segment` → likely maps to an attribute (not a key)

2. **Analyse data values** — if header matching is ambiguous, sample the CSV data:
   - Values like `"PRD-001"`, `"SKU-123"` → product identifier → `sku`
   - Values like `"C-1001"`, `"CUST-42"` → customer identifier → `customerId`
   - Numeric values with 2 decimal places → likely a price/cost field; needs `stringToDecimal`
   - ISO/locale date strings → needs `stringToDate` with the detected format

3. **Cross-reference with Pricefx metadata** when connected to a partition:
   - Match CSV headers against field **descriptions**, not just names.
   - Example: Pricefx field `attribute3` has label "Product Category" → CSV column "Category" maps here.

4. **Confidence display with reasoning** — extend the standard mapping table with a Reasoning column when semantic logic was applied:
   ```
   CSV Column          → Pricefx Field    Confidence  Reasoning
   Customer_Number     → customerId       HIGH        Semantic match: customer identifier
   Mat_Desc            → label            MEDIUM      "Desc" commonly maps to description/label
   Unit_Price          → attribute1       MEDIUM      Numeric with decimals, likely price field
   XYZABC              → ???              LOW         No semantic match — ask user
   ```

5. **Always ask for confirmation** — display the final proposed mapping and let the user adjust before generating files.

## When Auto-Mapping is NOT possible

Fall back to manual mapping (the skill's "Field Mapping" step) when any of these holds:

- **No CSV sample data available** — the algorithm cannot run without column names.
- **No attribute labels set** (all labels empty in metadata) — sequential mapping only; ask the user before generating.
- **P / C / SL master objects** — there is no `*-metadata` command for these (only labels exist on extension tables), so fuzzy label matching is not applicable. Use Priority 1 (key fields) plus manual mapping for the rest.
