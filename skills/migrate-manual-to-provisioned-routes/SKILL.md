---
name: migrate-manual-to-provisioned-routes
description: Use when migrating from manual to provisioned and the source project has multiple `<route>` elements bundled into a single shared XML file (e.g. `camel-context.xml`) instead of one-route-per-file under `src/main/resources/repo/routes/`.
---

# Migrate Manual → Provisioned: Routes

You are extracting routes from a manual Pricefx Integration Manager project (where many routes are bundled inside a single `camel-context.xml`, `routes.xml`, or similar) and splitting them into the provisioned IM layout: one route per file under `src/main/resources/repo/routes/{route-id}.xml`.

## Inputs

- **SOURCE_DIR** — path to the original manual IM project (provided by the orchestrator agent or asked from the user). Read-only.
- **TARGET_DIR** — current working directory (the new provisioned IM project). Files are written here.

If either is missing, ask the user for the path.

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`).

```bash
find "$SOURCE_DIR" -name "*.xml" -not -path "*/target/*" -not -path "*/.git/*" -not -path "*/.idea/*" -not -path "*/.gradle/*" -not -path "*/.mvn/*"
```

## Step 2: Extract Each `<route>` Block

For every XML file:

1. **First, identify exclusion zones** — `<route>` elements that must stay inline because they are part of a containing DSL, not standalone routes:
   - `<route>` nested inside `<rest>...</rest>` (REST DSL — the route IS the handler for a `<get>`/`<post>`/`<put>`/`<delete>` endpoint)
   - `<route>` nested inside `<routeBuilder>...</routeBuilder>` (Java DSL fragment — Camel 4 removes this anyway, but skip extraction so it doesn't get duplicated)

   Strategy: scan the file once, mark the `[start, end]` byte ranges of every `<rest>...</rest>` and `<routeBuilder>...</routeBuilder>` block, and skip any `<route>` whose match falls inside one.

2. Find every `<route ... >...</route>` block outside the exclusion zones. Use a non-greedy multi-line regex:
   ```
   (?s)<route[^Cs][^>]*>.*?</route>
   ```
   The `[^Cs]` exclusion avoids matching `<routeContext>` and `<routes>` wrapper tags.
3. For each match:
   - **Determine the route id.** Look for `id="..."` on the `<route>` element.
   - **If no id is present**, generate one from the `<from uri="..."/>` URI:
     - Replace `:`, `.` with `-`
     - Strip `{`, `}`, `[`, `]`
     - Truncate at the first `?`
     - Example: `pfx-sftp://{{integration.sftp.root}}/import/products?delete=true` → `pfx-sftp---integration-sftp-root-/import/products`
     - Then sanitise to valid kebab-case (replace consecutive `-` with single `-`, strip leading/trailing `-`, lowercase)
   - **Strip any `pfx:` prefix** from the route id (e.g. `pfx:import-products` → `import-products`).

## Step 3: Write One File Per Route

For each extracted route, write to `$TARGET_DIR/src/main/resources/repo/routes/{route-id}.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns="http://camel.apache.org/schema/spring">
{the original <route>...</route> block, with id added if it was missing}
</routes>
```

**Skip silently** if the target file already exists — never overwrite a route that's already in the target.

## Step 4: Verify Route ID Matches Filename

After writing, double-check that every `id="..."` value matches the file name without `.xml`. This is a hard requirement in provisioned IM — mismatched IDs cause deployment failure.

## Step 5: Report

Report back with:

```
Extracted N route(s) from {source}:
  - routes/import-products.xml (id: import-products)
  - routes/export-customers.xml (id: export-customers)
  ...

Skipped (already in target): M
Generated IDs (no id was present in source): K
```

## Rules

- **Do NOT modify the source project.** All writes go to TARGET_DIR.
- **Do NOT auto-fix anti-patterns** here (no streaming flags, no archive folders, no connection-pricefx removal). Those are applied later by `migrate-manual-to-provisioned-anti-patterns`-style steps in the orchestrator.
- **Preserve the original route body verbatim** (whitespace, comments, indentation). Only the `id` attribute may be added if it was missing.
- A `<route>` element nested inside `<routeContext>` is still one route — extract it. The wrapper element is dropped; the new file uses `<routes>` as the root.
- A `<route>` element nested inside `<rest>` or `<routeBuilder>` must NOT be extracted — those routes are part of a containing DSL and have to stay where they are. List the skipped routes in the report so the developer knows the REST DSL handlers are still in `camel-context.xml`.
- If the same route id appears more than once across source files, write the first occurrence and report the duplicates as a warning.
- File header rule: The output file's `<route id="X">` must match the file name `X.xml` exactly.
