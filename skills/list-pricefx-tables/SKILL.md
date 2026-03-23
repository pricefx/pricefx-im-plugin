---
name: list-pricefx-tables
description: List available Pricefx tables, fields, and attribute metadata for any object type (P, PX, CX, DS). Use this skill whenever the user asks "what tables exist", "show me the fields", "list extensions", "what attributes does X have", or wants to browse partition metadata. Quick lookup — no file generation, just displays information.
---

# List Pricefx Tables

Quickly look up available tables and field metadata from the connected Pricefx partition using the `pfx` CLI.

## Available Commands

### List tables

| Command | Description |
|---------|-------------|
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` | List all Product Extension (PX) tables |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` | List all Customer Extension (CX) tables |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` | List all Data Source (DS/DMDS) tables |

### Get field names

| Command | Description |
|---------|-------------|
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-metadata` | Get Product Master (P) field names |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension {name}` | Get field names for a specific PX table |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension {name}` | Get field names for a specific CX table |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source {name}` | Get field names for a specific DS table |

### Get attribute labels, types, and formats

| Command | Description |
|---------|-------------|
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extension-metadata {name}` | Get PX attribute labels, types, and formats |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extension-metadata {name}` | Get CX attribute labels, types, and formats |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-source-metadata {name}` | Get DS attribute labels, types, and formats |

### Fetch sample data

| Command | Description |
|---------|-------------|
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs fetch-sample P --limit 5` | Fetch sample Product Master rows |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs fetch-sample PX --name {name} --limit 5` | Fetch sample PX rows |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs fetch-sample CX --name {name} --limit 5` | Fetch sample CX rows |
| `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs fetch-sample DMDS --name {name} --limit 5` | Fetch sample DS rows |

## Usage

If $ARGUMENTS is provided, use it to determine what to list. Otherwise ask:

**What type of tables do you want to see?**

| Code | Action | CLI Command |
|------|--------|-------------|
| P | Show Product Master fields | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-metadata` |
| PX | List Product Extension tables | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs product-extensions` |
| CX | List Customer Extension tables | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs customer-extensions` |
| DS | List Data Source (PA) tables | `node ${CLAUDE_PLUGIN_ROOT}/tools/bin/pfx.mjs data-sources` |

If the user also specifies a table name, fetch both fields AND metadata (labels/types) in parallel:
- P → `product-metadata`
- PX {name} → `product-extension {name}` + `product-extension-metadata {name}`
- CX {name} → `customer-extension {name}` + `customer-extension-metadata {name}`
- DS {name} → `data-source {name}` + `data-source-metadata {name}`

## Output

Run the CLI command(s) and display the results to the user in a formatted table. When metadata is available, show labels and types alongside field names for a complete picture.
