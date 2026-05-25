# Pricefx Integration Manager Plugin

Shared reference documentation for all skills in this plugin.

## Framework Reference

@docs/project.md
@docs/routes.md
@docs/components.md
@docs/mappers.md
@docs/filters.md
@docs/connections.md

## On-Demand References

The following docs are NOT auto-loaded — read them when the topic comes up:

- `docs/faq.md` — operational FAQs (file streaming, encrypted properties, env separation, scheduling pitfalls, etc.). Source: [Confluence – Provisioned Integration FAQs](https://pricefx.atlassian.net/wiki/spaces/CUST/pages/4697128997/Provisioned+Integration+FAQs).
- `docs/anti-patterns.md` — canonical catalog of legacy patterns (AP-1..AP-34, plus AP-2b/AP-2c) shared by the `analyze-project`, `migrate-project`, `upgrade-project`, and `migrate-manual-to-provisioned` agents. Each entry has detection rule, severity, applicability, auto-fix policy, and fix recipe.
- `docs/smart-auto-mapping.md` — algorithm for proposing a CSV → Pricefx field mapping automatically, shared by `generate-import-integration` and `generate-pa-import-integration`. Covers the 4-tier matching priority, confidence display, converter-expression auto-detection, and LLM-enhanced semantic reasoning.
- `evals/triggers.md` — manual test plan listing `(user prompt) → (expected skill/agent)` for every skill and agent in the plugin. Run after any `description:` field change to catch trigger regressions.
