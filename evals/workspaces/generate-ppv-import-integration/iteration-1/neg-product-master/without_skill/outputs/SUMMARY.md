# Product Master Import — Generated Bundle

## Overview

Generated a standard CSV → Pricefx Product (P) import integration based on the user prompt without invoking any plugin skill, relying only on the shared docs.

## Files

- `routes/import-products.xml` — Camel 4 route that polls `/import/products`, streams via `pfx-csv:streamingUnmarshal`, loads into Pricefx via `pfx-api:loaddataFile` with `objectType=P`, then triggers `internalCopy`.
- `mappers/import-products.mapper.xml` — `<loadMapper>` with `id="import-products.mapper"` mapping CSV columns to `sku`, `label`, and `attribute1..attribute5`. No `<constant ... out="name"/>` because the target is the P (Product Master) table, not a PX extension.
- `config/application.properties` — file-handling snippets (`archive.file`, `read.lock`, `error.file`).

## Design Choices

- **Object type:** `P` (Product Master) per prompt.
- **Business key:** `sku` (Pricefx-standard key for P/PX).
- **Component:** `pfx-api:loaddataFile` with `pfx-csv:streamingUnmarshal` — recommended default for CSV imports (streaming, no in-memory parse).
- **File polling:** uses `{{integration.sftp.root}}/import/products` with `archive.file` + `read.lock` per file-consumer best practices.
- **Camel 4 form:** `<routes>` root, no `routeContext` wrapper, `{{...}}` property placeholders.
- **No `connection=pricefx`** parameter (default connection).
- **`onCompletion`** triggers `pfx-api:internalCopy?label=Product` after a successful load.

## Assumptions

- CSV columns: `sku`, `label`, `attribute1..attribute5`. Prompt did not specify a column list — adjust to actual CSV header.
- Pricefx connection named `pricefx` exists (project default).
- `integration.sftp.root` resolves to the directory containing `/import/products/`.
- Camel 4 target (IM 7.x+).

## Not Generated

- No filter file (not needed for load).
- No connection JSON (default Pricefx connection assumed).
- No scheduler (default file polling).
