# Project Health Check — Baseline (no skill)

## Approach

The user asked for a full-project health check: quality score, route inventory, and top 3 fix actions. This is a project-wide analysis task that scans every route/mapper/filter/connection against the canonical anti-pattern catalog and produces a graded report.

Without invoking the dedicated `analyze-project` agent, I evaluated what I could do using only the general docs in `docs/*.md` (project.md, routes.md, components.md, mappers.md, filters.md, connections.md) and the anti-pattern catalog reference in `docs/anti-patterns.md`.

## What I checked

Looked for the standard IM project layout under `src/main/resources/repo/`:

```
src/main/resources/repo/
  routes/        - Camel route XML files
  mappers/       - Field mapping XML files
  connections/   - Connection JSON files
  filters/       - Filter XML files
  beans/         - Custom Java/Groovy beans
  config/        - application.properties
  resources/     - Static templates
```

Result: **the directory `src/main/resources/repo/` does not exist** in this repo. The project root contains only:

- `agents/` — agent definitions
- `docs/` — framework reference docs
- `evals/` — evaluation harness
- `skills/` — skill definitions
- `tools/` — supporting tools
- `CLAUDE.md`, `README.md`, `LICENSE`

This is the **pricefx-im-plugin meta-repository** (the plugin that provides skills/agents for IM projects), **not an IM project itself**. There are zero routes, mappers, filters, or connections to inventory.

## Route inventory

| Category | Count |
|---|---|
| Route files (`routes/*.xml`) | 0 |
| Mapper files (`mappers/*.mapper.xml`) | 0 |
| Filter files (`filters/*.filter.xml`) | 0 |
| Connection files (`connections/*.json`) | 0 |

## Quality score

Not applicable. With no routes to evaluate against the anti-pattern catalog (AP-1..AP-34), no meaningful quality score can be computed. A score of "N/A" is the correct answer; a score of "100" would be misleading since there is nothing to grade.

## Top 3 actions

Since the prompt seems to assume an IM project exists, the top 3 actions are about getting to a state where a health check is meaningful:

1. **Confirm the target.** This repo is the plugin itself, not a customer IM integration project. Run the health check inside an actual IM project that contains `src/main/resources/repo/routes/`. The plugin's own routes (if any are needed for testing) belong in eval fixtures, not the plugin root.
2. **If this IS meant to be an IM project**, scaffold the standard layout (`src/main/resources/repo/{routes,mappers,filters,connections,beans,config,resources}/`) and add at least one route before re-running the check.
3. **Use the right tool.** A full-project health check is the job of the `analyze-project` agent, which walks every route/mapper/filter against `docs/anti-patterns.md` (AP-1..AP-34) and produces a graded `ANALYSIS.md`. I did not invoke it here (baseline run), so a real audit should be performed by triggering that agent on an actual IM project.

## Scope recognition note

The right tool for "full project health check on the whole IM project" is the **`analyze-project`** agent. It is the canonical entrypoint for:

- Walking the whole `src/main/resources/repo/` tree
- Cross-referencing each file against the anti-pattern catalog
- Producing a graded report with quality score, route inventory, severity-ranked findings, and top recommended actions

For a single-route deep dive, the per-route review skill would be used instead. For project-wide scope as requested here, `analyze-project` is the correct match.
