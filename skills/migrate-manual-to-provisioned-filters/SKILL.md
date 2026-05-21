---
name: migrate-manual-to-provisioned-filters
description: Use when migrating from manual to provisioned and the source project has `<filter>` or legacy `<pfx:filter>` elements (block or self-closing form) bundled into shared XML files instead of standalone `*.filter.xml` files under `src/main/resources/repo/filters/`.
---

# Migrate Manual → Provisioned: Filters

You are extracting filter definitions from a manual IM project and splitting them into the provisioned layout: one filter per file under `src/main/resources/repo/filters/{filter-id}.xml`.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`).

## Step 2: Extract Each Filter Block

Run all four patterns and collect every match:

| Pattern | Captures |
|---|---|
| `(?s)<pfx:filter[^>]*?id="(.*?)"(.*?)</pfx:filter>` | legacy block filter |
| `(?s)<filter[^s][^>]*?id="(.*?)"(.*?)</filter>` | provisioned block filter |
| `<pfx:filter[^>]*?id="(.*?)"(.*?)/>` | legacy self-closing filter |
| `<filter[^s][^>]*?id="(.*?)"(.*?)/>` | provisioned self-closing filter |

The `[^s]` exclusion in the unprefixed patterns avoids matching `<filters>` wrapper tags.

Group 1 is the filter `id`, group 0 is the full element.

## Step 3: Transform

For each captured filter block:

1. **Strip the `pfx:` namespace prefix** wherever it appears inside the block:
   - `<pfx:filter>` → `<filter>`
   - `<pfx:and>`, `<pfx:or>`, `<pfx:not>` → `<and>`, `<or>`, `<not>`
   - `<pfx:criterion>` → `<criterion>`

## Step 4: Write One File Per Filter

For each extracted filter, write to `$TARGET_DIR/src/main/resources/repo/filters/{filter-id}.xml`:

```xml
<filters>
{the transformed filter element}
</filters>
```

No `<?xml ...?>` declaration. The wrapper element is `<filters>` (plural). Format per `docs/filters.md`.

**Skip silently** if the target file already exists.

## Step 5: Report

```
Extracted N filter(s):
  - filters/export-products.filter.xml (id: export-products.filter)
  - filters/condition-records.filter.xml (id: condition-records.filter)
  ...

Skipped (already in target): M
```

## Rules

- **Do NOT modify the source project.**
- **Preserve filter contents verbatim** apart from the namespace strip.
- The filter file's `id` must match the file name without `.xml`. Mismatched IDs cause deployment failure.
- A self-closing filter (e.g. `<filter id="x" sortBy="id" resultFields="a,b"/>`) is valid — preserve it as self-closing.
- For PX/CX export filters, a `<criterion fieldName="name" operator="equals" value="..."/>` is required. If it is missing in the source filter, flag it as a warning but do not invent one.
