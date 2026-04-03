# Review and Debug

## When You Need This

Two scenarios:

1. **Before deploying** — you want to catch issues before they hit production. Run a project review.
2. **Something is broken** — a route is failing, data isn't loading correctly, or you see an error. Run the debugger.

## Review: Check Quality Before Deploying

**Trigger:**
- "Review my project"
- "Run a full code review"
- "Check for issues before I deploy"

The `review-project` agent reads all routes, mappers, filters, and config files, then checks 10+ rule categories:

- Connection configuration (redundant `connection=pricefx`?)
- Route structure (proper archiving, read lock, error handling?)
- Filter logic (missing bounds, empty criteria?)
- Mapper correctness (ID matches file name, converters appropriate?)
- Cross-file consistency (mapper referenced in route actually exists?)
- Performance (batch sizes appropriate for data volume?)
- Anti-patterns (hardcoded values, `noop=true`, missing flush for DMDS?)

**What you get:**

```
## Critical Issues (fix before deploying)
1. import-prices: mapper ID "priceMapper" doesn't match file name "import-prices.mapper"
   → Rename ID to "import-prices.mapper" in mappers/import-prices.mapper.xml:2

## Warnings (should fix)
2. export-customers: no error handling — route will fail silently on API errors
3. import-transactions: batchSize=500000 with 25 columns may cause memory pressure

## Best Practices
4. import-products: consider adding onCompletion for post-load CFS trigger

## Quality Score: YELLOW (2 critical, 1 warning)
```

Every finding includes the file name, line number, and specific fix.

## Debug: Fix a Broken Route

**Trigger — describe the problem:**
- "My import-products route is failing with: No bean could be found in the registry"
- "Data imports but all prices are null"
- "The export route runs but produces an empty file"
- "Files aren't being picked up from the import directory"

The `debug-integration` agent:

1. **Reads the error** — parses the error message or your description
2. **Reads the route** — loads the route XML, mapper, filter, and properties
3. **Cross-references** — checks for common patterns that cause this specific error
4. **Verifies partition state** — uses pfx CLI to check if tables/fields exist, connection works
5. **Diagnoses** — identifies the root cause and proposes a specific fix

**Example session:**

> **You:** My import-prices route is failing with: "No bean could be found in the registry of type: net.pricefx.integration.component.mapper.MapperProducer for name: priceMapper"
>
> **Plugin:** Found the issue. The route references `mapper=priceMapper` but the mapper file is `import-prices.mapper.xml` with `id="import-prices.mapper"`.
>
> **Root cause:** Mapper ID mismatch. The route says `priceMapper`, but the actual mapper ID is `import-prices.mapper`.
>
> **Fix:** In `routes/import-prices.xml`, change:
> ```xml
> <!-- Before -->
> <to uri="pfx-api:loaddataFile?objectType=PX&amp;mapper=priceMapper"/>
> <!-- After -->
> <to uri="pfx-api:loaddataFile?objectType=PX&amp;mapper=import-prices.mapper"/>
> ```
>
> **Prevention:** Mapper IDs must match the file name (without `.xml`). The `generate-import-integration` skill enforces this automatically.

> **You:** Fix it

> **Plugin:** Done. Updated `routes/import-prices.xml` line 5.

## When to Use Which

| Situation | What to Run |
|-----------|------------|
| Before deploying | `review-project` — catches issues proactively |
| After major changes | `review-project` — verify nothing broke |
| Route is failing | `debug-integration` — paste the error message |
| Data looks wrong | `debug-integration` — describe what's wrong vs expected |
| Regular maintenance | `health-check` — scored dashboard with trends |
| Before MR/merge | `review-project` + `check-route-compliance` on changed routes |

## Tips

- **Paste the full error message.** The more context the debug agent has, the faster it finds the root cause. Stack traces are helpful.
- **Run review before every MR.** Make it a habit. The agent catches things human reviewers miss — especially cross-file consistency issues.
- **Critical ≠ warning.** Critical issues will cause runtime failures. Warnings are about maintainability. Fix critical first, warnings when you have time.
- **The debug agent can fix issues directly.** After it diagnoses a problem, say "fix it" and it applies the change. Review the diff before committing.
