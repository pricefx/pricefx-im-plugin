# Out of Scope for `analyze` Skill — Deferring to `analyze-project` Agent

## Why `analyze` does NOT apply here

The user asked for a **full project health check** including a quality score, route inventory, and top 3 actions across the whole IM project.

The `analyze` skill is explicitly scoped to **a single Pricefx Integration Manager route**. From its `SKILL.md` description:

> Use when the user wants to lint or quality-check a **single** Pricefx Integration Manager route — says "analyze route", "check my route", "lint", "compliance check", "check route quality", "compare to best practice". **For a full project assessment use the `analyze-project` agent instead.**

Concretely, the skill:

- Asks the user which single route file to analyze (Step 1).
- Reads exactly one route XML plus its referenced mapper/filter.
- Detects route type from a single `from` URI (Step 2).
- Runs per-route checks (naming, XML escaping, file consumer hygiene, Pricefx API usage, DMDS-specific, export-specific, split processing, anti-patterns AP-1..AP-3).
- Emits a single `QUALITY REPORT` table for that one route, followed by per-finding fix suggestions.

It has no mechanism to:

- Enumerate every route under `src/main/resources/repo/routes/`.
- Aggregate findings into a project-level **quality score**.
- Produce a **route inventory** (counts by type, scheduling, object types, etc.).
- Rank cross-project top-N remediation actions.

Running `analyze` here would produce, at best, a lint report for one arbitrarily chosen route — which is not what the user asked for and would misrepresent project health.

## Correct alternative: the `analyze-project` agent

The right tool is the **`analyze-project` agent** (referenced by the `analyze` skill's own description as the project-wide counterpart).

What `analyze-project` does, conceptually:

- **Project-wide scan**: enumerates all routes under `src/main/resources/repo/routes/`, their mappers (`mappers/`), filters (`filters/`), connections (`config/connections/`), and `application.properties`.
- **Quality score**: aggregates per-route lint findings plus the canonical anti-pattern catalog in `docs/anti-patterns.md` (AP-1..AP-34, plus AP-2b/AP-2c — severity-weighted) into a single project score.
- **Route inventory**: groups routes by detected type (CSV/SFTP Import, DMDS/DS Import, PPV Import, Scheduled Export, Incremental Export, Event-Driven, Chained/Utility), object types touched (P, PX, C, CX, DMDS, LTV/MLTV2, CRCP, etc.), and scheduling mode (file poll, quartz, timer, event).
- **Top actions**: ranks the top remediation actions across the whole project by impact and severity, surfacing the 3 highest-leverage fixes (e.g., systemic missing `name` constants on PX mappers, redundant `connection=pricefx`, missing read locks, hardcoded hostnames, oversized inline Groovy, CFS triggers inside splits, etc.).
- **Migration-aware**: cross-references `docs/anti-patterns.md` so legacy patterns flagged here can be handed off to `migrate-project`, `upgrade-project`, or `migrate-manual-to-provisioned` agents as appropriate.

## Recommended next step

Invoke the `analyze-project` agent on this repository. It will produce the project-level quality score, route inventory, and prioritized top-3 actions the user requested — none of which the single-route `analyze` skill is designed to deliver.
