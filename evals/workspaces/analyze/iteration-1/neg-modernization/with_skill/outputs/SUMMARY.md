# Negative case: modernization request — `analyze` skill does NOT apply

**User prompt:** `Modernize this project — fix legacy patterns automatically.`

## Decision: did NOT produce a single-route lint report.

## Why `analyze` is the wrong fit

Two mismatches against the skill's design:

1. **Scope mismatch.** `analyze` is explicitly a *single-route* linter (per its SKILL.md frontmatter: *"lint or quality-check a single Pricefx Integration Manager route … For a full project assessment use the `analyze-project` agent instead."*). The user asked for project-wide work.
2. **Mode mismatch.** `analyze` reports, then asks *"Would you like me to apply these fixes?"* and applies them one at a time only after explicit user confirmation. The user asked for *automatic* fixes. The skill also covers only a small lint subset (N-1..AP-3), not the full `docs/anti-patterns.md` catalog (AP-1..AP-34 + AP-2b/AP-2c).

## Correct alternative: the `migrate-project` agent

Scope of `migrate-project`:

- Project-wide sweep of routes, mappers, filters, connections, `application.properties`.
- Driven by `docs/anti-patterns.md` — every entry carries detection rule, severity, applicability, **auto-fix policy**, and a fix recipe.
- Mechanically applies auto-fixable items: Camel 3→4 attribute renames (`errorHandlerRef`→`errorHandler`, `strategyRef`→`aggregationStrategy`, etc.), legacy URI scheme swaps (`quartz2:`→`quartz:`, `vm:`→`seda:`, `aws-s3:`→`aws2-s3:`), `<routeContext>`→`<routes>`, `${pfx:foo}`→`{{pfx:foo}}`, redundant `connection=pricefx` removal, `noop=true` removal.
- Defers non-mechanical / semantic-risk items (large Groovy extractions, schema redesigns) as recommendations rather than silent rewrites.
- Pairs with `verification-before-completion` so the project still builds after the rewrite.

If the user only wants an audit (no changes), `analyze-project` is the read-only counterpart. `analyze` only becomes appropriate later, for spot-checking a single route post-migration.

## Routing summary

| User intent | Correct skill / agent |
|---|---|
| "Lint this one route" | `analyze` (this skill) |
| "Audit the whole project, no changes" | `analyze-project` agent |
| "Modernize / fix legacy patterns automatically" | `migrate-project` agent |
| "Manual → provisioned layout migration" | `migrate-manual-to-provisioned` agent |
