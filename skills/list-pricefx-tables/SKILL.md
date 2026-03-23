---
name: list-pricefx-tables
description: List available Pricefx tables and their fields for any object type (PX, CX, DS). Quick metadata lookup using pfx CLI.
---

# List Pricefx Tables

Quickly look up available tables and field metadata from the connected Pricefx partition using the `pfx` CLI.

## Available Commands

| Command | Description |
|---------|-------------|
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` | List all Product Extension (PX) tables |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}` | Get field metadata for a specific PX table |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` | List all Customer Extension (CX) tables |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}` | Get field metadata for a specific CX table |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` | List all Data Source (DS) tables |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {name}` | Get field metadata for a specific DS table |

## Usage

If $ARGUMENTS is provided, use it to determine what to list. Otherwise ask:

**What type of tables do you want to see?**

| Code | Action | CLI Command |
|------|--------|-------------|
| PX | List Product Extension tables | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` |
| CX | List Customer Extension tables | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` |
| DS | List Data Source tables | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` |

If the user also specifies a table name, fetch its metadata directly:
- PX {name} → `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}`
- CX {name} → `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}`
- DS {name} → `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {name}`

## Output

Run the CLI command and display the results to the user in a formatted table.
