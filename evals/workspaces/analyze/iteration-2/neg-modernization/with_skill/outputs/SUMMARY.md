# Modernize this project — routing decision

**Request:** "Modernize this project — fix legacy patterns automatically."

**Verdict: out of scope for the `analyze` skill. Use the `migrate-project` agent instead.**

I did not run a single-route lint report, because this request is not a single-route lint job.

## Why `analyze` is the wrong tool

The `analyze` skill (`skills/analyze/SKILL.md`) is narrowly scoped, and this request violates that scope on three counts:

| Dimension | What `analyze` does | What this request needs |
|---|---|---|
| **Scope** | One route at a time. Step 1 reads a single route file (and its mapper/filter), and if none is named it *asks* "Which route file should I analyze?" | The whole **project** — every route, mapper, filter, property, connection. |
| **Action** | Read-only assessment. It produces a quality report, then asks "Would you like me to apply these fixes?" and never modifies anything without explicit confirmation (Rules: "Never modify the route unless the user explicitly confirms"). | **Automatic** fixing of legacy patterns. |
| **Subject** | Quality/naming/anti-pattern lint against a fixed checklist (N-, X-, F-, A-, D-, E-, S-, AP-1..AP-5). | "Legacy patterns" / modernization — the canonical AP-1..AP-34 catalog in `docs/anti-patterns.md`, applied and auto-fixed across the project. |

The skill's own `description` makes the boundary explicit: *"For a full project assessment use the `analyze-project` agent instead."* Fabricating a single-route report here would be wrong — there is no single route to report on, and the user asked for fixes, not a lint table.

## The right tool

**`migrate-project` agent** — its description matches verbatim: *"Use when the user wants to modernise an existing Pricefx Integration Manager project's legacy patterns (without changing the IM version) — says 'migrate', 'modernize', 'upgrade patterns', 'fix legacy patterns', or asks to scan for anti-patterns and apply auto-fixes."*

That is exactly this request: "Modernize this project — fix legacy patterns automatically." It is project-wide, it modernizes legacy patterns, and it applies auto-fixes — all three of the dimensions where `analyze` falls short.

### Adjacent agents, and why they are not the pick here

- **`analyze-project`** — right scope (full project) but read-only; it assesses and reports, it does not auto-fix. Use it if the user only wants a health check.
- **`upgrade-project`** — also modernizes, but specifically when **bumping the IM version**. The user said nothing about changing the IM version, so `migrate-project` (same modernization, version held constant) is the better fit.
- **`migrate-manual-to-provisioned`** — for lifting a legacy manual (`camel-context.xml`) layout into the provisioned layout. This request is a pattern modernization, not a layout migration.

## Recommendation

Hand this to the **`migrate-project`** agent. If the user instead wants only a non-destructive, read-only assessment first (no file changes), run **`analyze-project`** and review its report before deciding what to auto-fix.
