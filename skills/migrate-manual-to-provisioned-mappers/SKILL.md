---
name: migrate-manual-to-provisioned-mappers
description: Extract every `<loadMapper>`, `<integrateMapper>`, and legacy `<pfx:loadMapper>` / `<pfx:integrateMapper>` element from a manual IM project's bundled XML files and split them into one-mapper-per-file under `src/main/resources/repo/mappers/` in the target provisioned project. Also rewrites legacy `<pfx:simple>` to `<pfx:constant>` inside mappers.
---

# Migrate Manual → Provisioned: Mappers

You are extracting mapper definitions from a manual IM project and splitting them into the provisioned layout: one mapper per file under `src/main/resources/repo/mappers/{mapper-id}.xml`.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`).

## Step 2: Extract Each Mapper Block

Run these four regex patterns over every source XML and collect every match:

| Pattern | Captures |
|---|---|
| `(?s)<pfx:loadMapper[^>]*?id="(.*?)"(.*?)</pfx:loadMapper>` | legacy load mapper |
| `(?s)<loadMapper[^>]*?id="(.*?)"(.*?)</loadMapper>` | provisioned load mapper |
| `(?s)<pfx:integrateMapper[^>]*?id="(.*?)"(.*?)</pfx:integrateMapper>` | legacy integrate mapper |
| `(?s)<integrateMapper[^>]*?id="(.*?)"(.*?)</integrateMapper>` | provisioned integrate mapper |

For each match capture group 1 is the mapper `id`, group 0 is the full element including its tag.

## Step 3: Transform

For each captured mapper block:

1. **Strip the `pfx:` namespace prefix** wherever it appears inside the block:
   - `<pfx:loadMapper>` → `<loadMapper>`
   - `<pfx:body ...>` → `<body ...>`
   - `<pfx:constant ...>` → `<constant ...>`
   - `<pfx:groovy ...>` → `<groovy ...>`
   - `<pfx:integrateMapper>` → `<integrateMapper>`

2. **Rewrite `<pfx:simple expression="..."/>` → `<pfx:constant expression="..."/>`** before stripping the namespace. In manual IM, mapper authors sometimes wrote `<pfx:simple expression="ProductSync" out="name"/>` for what is conceptually a fixed string — `<simple>` evaluates the value at runtime, which causes load failures on certain IM versions. Use `<constant>` for literal values. After this rewrite the namespace strip turns it into `<constant expression="ProductSync" out="name"/>`.

   Detection regex: `<pfx:simple(\s[^/>]*expression=)` → replace with `<pfx:constant$1`. Apply only inside extracted mapper bodies, not anywhere else.

3. **Mapper id sanity check.** The `id` attribute must match the future file name. The convention in provisioned IM is `{route-name}.mapper`. If the mapper id already follows that pattern, keep it. If it does not (e.g. `productMasterDataMapper`), keep it as-is during this skill — renaming is a separate concern owned by the orchestrator.

## Step 4: Write One File Per Mapper

For each extracted mapper, write to `$TARGET_DIR/src/main/resources/repo/mappers/{mapper-id}.xml`:

```xml
<mappers>
{the transformed mapper element}
</mappers>
```

No `<?xml ...?>` declaration. No namespace on the `<mappers>` wrapper. The file format follows `docs/mappers.md` provisioned section.

**Skip silently** if the target file already exists.

## Step 5: Report

```
Extracted N mapper(s):
  - mappers/import-products.mapper.xml (id: import-products.mapper)
  - mappers/export-prices.mapper.xml (id: export-prices.mapper)
  ...

Transformations applied:
  - pfx: namespace stripped from N mapper(s)
  - <pfx:simple> → <pfx:constant> rewritten in K mapper(s)

Skipped (already in target): M
```

## Rules

- **Do NOT modify the source project.**
- **Do NOT delete or alter the original manual XML** — the orchestrator may make a final pass to remove already-extracted blocks from the source if the user wants the source cleaned up after migration. This skill only writes new files.
- **Preserve mapping content verbatim** apart from the two transformations above (namespace strip, `simple`→`constant`).
- The mapper file's `id` must match the file name without `.mapper.xml` (or without `.xml` if the id doesn't end in `.mapper`). Mismatched IDs cause deployment failure.
- For PX/CX mappers the `<constant ... out="name"/>` element that sets the extension table name is part of the original mapper body — preserve it. If it is missing in the source, flag it as a warning but do not invent one.
