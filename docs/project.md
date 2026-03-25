# Pricefx Integration Manager Project

This is a Pricefx Integration Manager (IM) project. It uses Apache Camel routes to move data between external systems and Pricefx.

## Project Structure

```
src/main/resources/repo/
  routes/         - Camel route XML files
  mappers/        - Field mapping XML files
  connections/    - Connection JSON files (pricefx, sftp, etc.)
  filters/        - Filter XML files
  beans/          - Custom Java/Groovy beans
  classes/        - Custom classes
  config/         - application.properties (route configuration)
  resources/      - Static resources
```

## pfx CLI — Partition Metadata

Use the `pfx` CLI tool to discover tables and fetch field-level metadata from the Pricefx partition. There is NO MCP server for metadata — always use pfx CLI.

| Command | When to Use |
|---|---|
| `pfx product-extensions` | List available PX tables |
| `pfx product-extension {name}` | Get field names for a specific PX table |
| `pfx product-extension-metadata {name}` | Get attribute labels, types, and formats for a PX table (needed for Smart Auto-Mapping) |
| `pfx product-metadata` | Get Product (P) attribute metadata |
| `pfx customer-extensions` | List available CX tables |
| `pfx customer-extension {name}` | Get field names for a specific CX table |
| `pfx customer-extension-metadata {name}` | Get attribute labels, types, and formats for a CX table (needed for Smart Auto-Mapping) |
| `pfx data-sources` | List available DS tables |
| `pfx data-source {name}` | Get field names for a specific DS table |
| `pfx data-source-metadata {name}` | Get attribute labels, types, and formats for a DS table |
| `pfx create-product-extension {name}` | Create a new PX table |
| `pfx create-customer-extension {name}` | Create a new CX table |
| `pfx set-attribute {type} {table} {attr}` | Set attribute label/type on PX/CX (single) |
| `pfx set-attributes {type} {table} {attrs...}` | Set multiple attributes at once (batch, format: `field:TYPE:FORMAT:Label`) |
| `pfx pricing-parameters` | List all Pricing Parameter (Company Parameter) tables |
| `pfx pricing-parameter {name}` | Get fields and sample data for a specific Pricing Parameter table |
| `pfx test-connection` | Verify that .env credentials are valid |
| `pfx fetch-sample {type} --name {name} --limit N` | Fetch sample rows from any table (P, PX, CX, DMDS) |

## Pricefx Object Type Codes

| Code | Object |
|---|---|
| P | Product Master |
| PX | Product Extension |
| C | Customer Master |
| CX | Customer Extension |
| S | Seller |
| SX | Seller Extension |
| DS | Data Source |
| DMF | Data Feed (Company Parameters) |
| DMDS | Data Feed Data Source |
| PL | Price List |
| PLI | Price List Item |
| PG | Price Grid |
| PGI | Price Grid Item |
| LPG | Live Price Grid |
| LPGI | Live Price Grid Item |
| Q | Quote |
| QI | Quote Item |
| A | Agreement |
| AI | Agreement Item |
| CRCI | Condition Record |
| RBI | Rebate Item |

## Route File Conventions

- Route ID MUST match the file name (without `.xml`). Do NOT use `pfx:` prefix. Example: `import-products.xml` → `id="import-products"`
- Route file naming: `{descriptive-name}.xml`
- Mapper file naming: `{route-name}.mapper.xml`
- Filter file naming: `{route-name}.filter.xml`
- **Resource ID naming rule:** The `id` attribute of ALL resources (routes, mappers, filters) MUST match the file name (without `.xml`). Example: `export-products.filter.xml` → `id="export-products.filter"`. Mismatched IDs cause deployment failure.
- Properties prefix: `pfx\:{route-id}.propertyName`

## Key Pricefx Knowledge Base References

- Import CSV from File: https://knowledge.pricefx.com/space/PM/5457903783
- Import CSV from FTP: https://knowledge.pricefx.com/space/PM/5458952534
- pfx-api:import: https://knowledge.pricefx.com/space/IM/5867242141
- pfx-io:streamCompressedFile: https://knowledge.pricefx.com/space/IM/5867701085
- Mapper Configurations: https://knowledge.pricefx.com/space/IM/5867111059
- Type Codes: https://knowledge.pricefx.com/space/KB/99570616
