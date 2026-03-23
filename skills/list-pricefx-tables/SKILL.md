---
name: list-pricefx-tables
description: List available Pricefx tables and their fields for any object type (PX, CX). Quick metadata lookup using pfx CLI.
---

# List Pricefx Tables

Quickly look up available tables and field metadata from the connected Pricefx partition using the `pfx` CLI.

## Available Commands

| Command | Description |
|---------|-------------|
| `pfx product-extensions` | List all Product Extension (PX) tables |
| `pfx product-extension {name}` | Get field metadata for a specific PX table |
| `pfx customer-extensions` | List all Customer Extension (CX) tables |
| `pfx customer-extension {name}` | Get field metadata for a specific CX table |

## Usage

If $ARGUMENTS is provided, use it to determine what to list. Otherwise ask:

**What type of tables do you want to see?**

| Code | Action | CLI Command |
|------|--------|-------------|
| PX | List Product Extension tables | `pfx product-extensions` |
| CX | List Customer Extension tables | `pfx customer-extensions` |

If the user also specifies a table name, fetch its metadata directly:
- PX {name} → `pfx product-extension {name}`
- CX {name} → `pfx customer-extension {name}`

## Output

Run the CLI command and display the results to the user in a formatted table.
