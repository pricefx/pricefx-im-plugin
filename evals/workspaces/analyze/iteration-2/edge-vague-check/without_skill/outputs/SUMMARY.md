# Route Check — Summary

**Request:** "Check my route."

## Outcome: No route found to check

I searched the workspace for a Pricefx IM route to analyze, but there is no IM route file in this project that the request could refer to.

**What I checked:**
1. Canonical route location `src/main/resources/repo/routes/` — does not exist; there is no `src/` tree at all in this repo.
2. Whole-repo scan for `*.xml` route files (excluding eval fixtures) — only non-eval XML is IDE config under `.idea/`, not IM routes.
3. Eval workspace fixtures — `routes/*.xml` exist under `evals/workspaces/.../outputs/`, but these are generated test fixtures, not "your route."

**What I need from the user:** the request is too vague to act on because no route is present. Provide one of: a path to the route XML, the route XML pasted directly, or the IM project directory if you meant a different repo. Once a route is available, a check would cover route ID ↔ filename match, Camel 3/4 attribute correctness, component usage, mapper/filter ID conventions, the PX/CX table-name constant, file-consumer archive/read-lock rules, XML escaping, and scheduling pitfalls. The `pricefx-im-plugin:analyze` skill is the intended tool for single-route lints but still needs a concrete route file.
