# This is a full-project job — wrong tool

Your request asks for three things: a **quality score**, a **route inventory**, and the **top 3 actions to fix** across the *whole* project. That is a full-project health check, which is **out of scope** for the `analyze` skill I'm loaded with.

## Why `analyze` is the wrong tool here

The `analyze` skill lints **exactly one route at a time**:
- Its description: *"Use when the user wants to lint or quality-check a **single** route... For a full project assessment use the `analyze-project` agent instead."*
- Step 1 reads **one** route file plus its associated mapper and filter; if none is given it asks *"Which route file should I analyze?"*
- Output is a single per-route `QUALITY REPORT` table (checks N-1…AP-5) — no project-wide score, no inventory, no ranked cross-codebase top-3.

Running it would force picking one arbitrary route or fabricating a project-level report it isn't designed to produce.

## Run the `analyze-project` agent instead

Its description matches the request almost verbatim: *"full assessment of an existing IM project... 'project health', 'health check', 'quality score', 'full code review'... health dashboard, **route inventory**, anti-pattern report, or **top-3 actions**."* It delivers all three things asked.

## How to proceed

> Use the `analyze-project` agent to run a full health check on this IM project — quality score, route inventory, and top 3 fixes.

(For a follow-up deep-dive on one flagged route, that's what `analyze` is for. To auto-fix legacy patterns rather than just report, use the `migrate-project` agent.)
