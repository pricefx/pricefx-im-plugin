# Working with Metadata

## When You Need This

You want to know what tables and fields exist in your Pricefx partition — before generating an integration, while debugging, or just to explore. Metadata is also what powers the plugin's auto-mapping and validation features.

## Browsing Tables and Fields

**Slash command:**

```
/pricefx-integration:list-pricefx-tables
```

**Or natural language:**
- "What PX tables exist in my partition?"
- "Show me the fields in the Prices extension"
- "List all Data Sources"
- "What attributes does Product Master have?"

**Example session:**

> **You:** What PX tables exist?
>
> **Plugin:** Found 5 Product Extension tables:
>
> | Table | Attributes Used |
> |-------|----------------|
> | Prices | 8 of 30 |
> | Specifications | 12 of 30 |
> | Logistics | 5 of 30 |
> | CompetitorPrices | 6 of 30 |
> | Compliance | 3 of 30 |

> **You:** Show me the fields in Prices
>
> **Plugin:** Prices (Product Extension):
>
> | Field | Label | Type |
> |-------|-------|------|
> | sku | SKU | STRING |
> | attribute1 | List Price | NUMERIC |
> | attribute2 | Cost Price | NUMERIC |
> | attribute3 | Discount Tier | STRING |
> | attribute4 | Currency | STRING |
> | attribute5 | Effective Date | DATE |
> | attribute6 | Price Group | STRING |
> | attribute7 | Min Order Qty | INTEGER |
> | attribute8 | Notes | STRING |

This is the same information the generation skills use when proposing field mappings.

## Direct pfx CLI Commands

You can also run CLI commands directly for quick lookups. Prefix with `!` to run shell commands from Claude Code:

```
! pfx product-extensions                    — list all PX tables
! pfx product-extension Prices              — field names only
! pfx product-extension-metadata Prices     — field names + labels + types
! pfx customer-extensions                   — list all CX tables
! pfx data-sources                          — list all PA Data Sources
! pfx data-source-metadata SalesHistory     — fields for a Data Source
! pfx pricing-parameters                    — list all pricing parameter tables
! pfx pricing-parameter ExchangeRates       — fields + sample data
! pfx fetch-sample PX --name Prices --limit 3  — see actual data
! pfx test-connection                       — verify credentials work
```

## How Metadata Powers the Plugin

When you run any generation skill, it fetches metadata from your partition behind the scenes:

1. **Table discovery** — "Which PX tables exist?" → shows real options, not a generic list
2. **Field mapping** — matches CSV column names against field labels and types for smart auto-mapping
3. **Converter suggestions** — knows `attribute1` is NUMERIC → suggests `stringToDecimal`
4. **Validation** — if you reference a table or field that doesn't exist, the skill warns you before generating

This is why the `.env` file matters — without valid credentials, skills fall back to generic templates instead of partition-aware generation.

## Creating Tables from the Plugin

If the table you need doesn't exist yet:

> **You:** "I need a PX table called Warranties"
>
> **Plugin:** Table `Warranties` doesn't exist. Want me to create it?
>
> **You:** Yes, with 5 string attributes and 3 numeric
>
> **Plugin:** Created Product Extension `Warranties` with 8 attributes.

Or via CLI:

```
! pfx create-product-extension Warranties
! pfx set-attributes PX Warranties attribute1:STRING::Warranty_Type attribute2:NUMERIC::Duration_Months
```

## Tips

- **Check metadata before generating.** If your partition metadata is outdated (labels not set, types wrong), the auto-mapping will be less accurate. Run `list-pricefx-tables` first to verify.
- **Use `fetch-sample` to see real data.** Useful when you're not sure what values a field contains or what format dates are in.
- **Labels matter for auto-mapping.** If your PX attribute1 has label "List Price", the plugin maps a CSV column called "listPrice" with HIGH confidence. Unlabeled attributes get MEDIUM or LOW confidence. Ask your Pricefx admin to set labels.
- **Metadata is cached per session.** If you create a table during the session, run `list-pricefx-tables` again to refresh.

## See Also

- [Your First Integration](01-your-first-integration.md) — see metadata-powered auto-mapping in action
- [Import Data from CSV](02-import-data-from-csv.md) — generate imports using partition metadata
- [All guides](00-what-this-plugin-does.md#where-to-start)
