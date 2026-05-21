---
name: compare-environments
description: Use when the user wants to compare a Pricefx Integration Manager project across two environments, branches, or directories — says "diff", "compare environments", "what changed", "dev vs prod", "branch diff", or asks which routes/mappers/filters/properties differ.
---

# Compare Environments

Compare Pricefx Integration Manager project files between two environments, branches, directories, or git commits. Produces a structured report with risk assessment for each change.

## Step 1: Determine What to Compare

If `$ARGUMENTS` specifies what to compare, parse it directly (e.g., `develop vs feature/new-export`).
Otherwise ask: **What do you want to compare?**

Present three options:

| Option | When to use | Example |
|--------|-------------|---------|
| **a) Two git branches** | Compare branch vs branch in this repo | `develop vs feature/new-export` |
| **b) Two git commits or tags** | Compare specific versions | `v2.1.0 vs v2.2.0` |
| **c) Two local directories** | Compare separate project checkouts | `/home/dev/proj vs /home/prod/proj` |

## Step 2: Collect the Diff

### For git branches or commits (options a and b)

```bash
git diff {base}...{target} --name-status
```

Then read the full diff for changed files:

```bash
git diff {base}...{target} -- src/main/resources/repo/
```

Limit to IM-relevant paths: `src/main/resources/repo/routes/`, `src/main/resources/repo/mappers/`, `src/main/resources/repo/filters/`, `src/main/resources/repo/config/`.

### For local directories (option c)

List files in both directories and compare:

```bash
diff -rq --include="*.xml" --include="*.properties" {dir-a}/src/main/resources/repo/ {dir-b}/src/main/resources/repo/
```

Then read any files that differ to extract the actual changes.

## Step 3: Categorize Changes

Group every changed file into one of these categories:

| Category | File pattern | Examples |
|----------|-------------|---------|
| **Routes** | `routes/*.xml` | New, removed, or modified route |
| **Mappers** | `mappers/*.xml` | Field mapping changes |
| **Filters** | `filters/*.xml` | Filter criteria changes |
| **Properties** | `config/application*.properties` | Config, schedule, batch size, connection |
| **Other** | Any other changed file | Test data, scripts |

For each changed file, determine the change type:

- **ADDED** — file exists in target but not in base
- **REMOVED** — file exists in base but not in target
- **MODIFIED** — file exists in both, content changed

For MODIFIED files, extract a brief human-readable description of what changed by reading the diff output:

| File type | What to highlight |
|-----------|-----------------|
| Route XML | Changed `<from>` URI, new/removed steps, changed `batchSize`, new `<onException>`, changed `objectType` |
| Mapper XML | Added/removed `<body>` mappings, changed `out=` fields, changed `converterExpression` |
| Filter XML | Changed filter criteria, added/removed conditions |
| Properties | Changed connection URLs, changed cron expressions, changed batch sizes, changed paths |

## Step 4: Assign Risk Level

For each change, assign a risk level:

| Risk | Colour | Conditions |
|------|--------|-----------|
| **LOW** | Green | New route (additive only), new mapper, cosmetic change (comments, formatting), new property with no code reference |
| **MEDIUM** | Amber | Changed batch size, changed cron schedule, new filter criteria, added optional processing step |
| **HIGH** | Red | Changed connection URL or connection name, changed `objectType`, removed error handling (`<onException>`, `moveFailed`), changed field mapping (`out=` field renamed or removed), removed a route, changed key field mapping (`sku`, `customerId`, `sellerId`) |

If multiple conditions apply to a single file, use the highest risk level.

## Step 5: Output Comparison Report

Print a structured report in this format:

```
## Environment Comparison: {base} vs {target}

**Compared:** {description of what was compared — branch names, commit hashes, or directory paths}
**Date:** {today}
**Changes:** {N} total ({N} HIGH, {N} MEDIUM, {N} LOW)

---

| Change | File | Risk | Description |
|--------|------|------|-------------|
| ADDED | routes/export-prices.xml | LOW | New scheduled export route |
| MODIFIED | mappers/productPMapper.xml | HIGH | Field 'price' mapping changed (out= attribute1 → attribute2) |
| MODIFIED | config/application.properties | MEDIUM | Batch size 20000→50000; cron schedule changed |
| REMOVED | filters/inactive-products.xml | HIGH | Filter removed — all products will now be imported |

---

### HIGH Risk Changes — Review Required

{For each HIGH risk change, provide a detailed paragraph explaining:}
- What changed (specific field, value, or structure)
- Why it is high risk (data impact, potential data loss, wrong target, loss of error protection)
- Suggested action before deploying (test in staging, verify mapping, check rollback plan)

### MEDIUM Risk Changes — Review Recommended

{For each MEDIUM risk change, provide a brief note on the impact.}

### Summary

{1–3 sentences summarising the overall risk of deploying {target} over {base}.}
```

## Step 6: Offer to Save Report

Ask: **Do you want to save this comparison report?**

If yes, write to: `docs/comparisons/{base}-vs-{target}-{date}.md`

Replace `/` in branch names with `-` for the filename (e.g., `develop-vs-feature-new-export-2026-04-01.md`).

## Important Rules

- Never include passwords, API keys, or credentials found in property files — mask them as `***` in the report
- Keep descriptions concise — one line per change in the table, details only in the HIGH/MEDIUM sections
- If the diff is very large (50+ files), focus on `routes/` and `mappers/` first, then summarise `config/` changes separately
- Always include the full file path relative to the project root in the File column (e.g., `routes/import-products.xml`, not just `import-products.xml`)
- When comparing branches, use `{base}...{target}` (three dots) to show only changes introduced by the target branch, not divergence
