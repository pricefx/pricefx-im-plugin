# Onboard an Existing Project

## When You Need This

You inherited an IM project from another partner or team. You need to understand what it does, how healthy it is, and where the risks are — without spending days reading XML files.

## Which Agent to Use

This isn't a slash command — it's an agent you trigger with natural language:

- "Onboard me to this project"
- "I inherited this IM project, help me understand it"
- "New project orientation"
- "Analyze and document this project"

## What Happens

The `onboard-project` agent runs 6 phases automatically — you don't need to answer questions. Just point it at the project and let it work.

**Phase 1 — Project Overview:**
Scans all route, mapper, filter, and connection files. Builds a route inventory table showing each route's direction (import/export), object type, source/target, and schedule.

**Phase 2 — Compliance Check:**
Checks every route against best practices:
- Route ID matches file name?
- Proper XML escaping (`&amp;` not `&`)?
- File archiving configured (`{{archive.file}}`)?
- Read lock or done file present?
- Key fields correct for object type?
- DMDS routes have flush in the right place?
- Error handling present?

Each finding is tagged as **Critical** (will cause errors) or **Warning** (works but risky).

**Phase 3 — Test Coverage:**
Lists which routes have corresponding test files and which don't. Flags orphaned test files (tests for routes that no longer exist).

**Phase 4 — Documentation:**
Auto-generates requirement docs for any route that doesn't have one. Each doc describes: direction, object type, field mappings, schedule, filter conditions.

**Phase 5 — Visual Documentation:**
Generates Mermaid flow diagrams:
- Project-level architecture overview
- Data flow summary (chronological order)
- Detailed per-route flow diagrams

**Phase 6 — Consolidated Report:**
Outputs everything as one structured report:

```
# Project Onboarding Report

## Executive Summary
12 routes, 3 critical issues, quality score: YELLOW

## Route Inventory
| Route ID | Direction | Object | Table | Schedule |
| ... | ... | ... | ... | ... |

## Quality Issues
### Critical
- import-products: mapper ID mismatch (file: import-products.mapper, ID: productMapper)
- ...

### Warnings
- export-customers: no error handling
- ...

## Test Coverage
8 of 12 routes have tests (67%)

## Recommended Actions
1. Fix mapper ID mismatch in import-products (Critical — will fail at runtime)
2. Add error handling to export routes
3. Generate tests for 4 untested routes
```

## How to Interpret the Report

- **Quality score GREEN** (0-1 critical issues): Project is healthy. Minor improvements optional.
- **Quality score YELLOW** (2-4 critical issues): Project works but has risks. Fix critical issues before next deployment.
- **Quality score RED** (5+ critical issues): Project has significant problems. Prioritize fixes.

Critical issues will cause runtime failures. Warnings are about maintainability and best practices — they won't break things today but make the project harder to maintain.

## After Onboarding

Now that you understand the project, useful next steps:

- **Fix critical issues:** The report tells you exactly what's wrong and where. Ask the plugin: "Fix the mapper ID mismatch in import-products" — it can apply the fix directly.
- **Run health check periodically:** `/pricefx-im:health-check` gives you a scored dashboard. Run it before deployments or after major changes.
- **Generate missing tests:** For each untested route, run `/generate-integration-test` — the plugin creates a Spock test based on the existing route.
- **Visualize for stakeholders:** The generated Mermaid diagrams are great for stakeholder presentations. Share them in MR descriptions or project documentation.

## Tips

- **Run onboarding before touching anything.** Get the full picture first, then make changes. The report might reveal dependencies you wouldn't notice from reading individual files.
- **The generated requirement docs are drafts.** They reverse-engineer the route's behavior, but may miss business context that isn't in the code. Review and enrich them.
- **Combine with `explain-route`** for routes that are hard to understand from the inventory alone. Ask "explain the import-prices route" for a plain-English walkthrough.

## See Also

- [Review and Debug](06-review-and-debug.md) — ongoing quality checks and troubleshooting
- [Working with Metadata](07-working-with-metadata.md) — explore the partition your project connects to
- [All guides](00-what-this-plugin-does.md#where-to-start)
