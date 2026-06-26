# Modernization Request — Summary

**Request:** "Modernize this project — fix legacy patterns automatically."

## Result: Nothing to modernize — no IM project artifacts present

I inspected the working directory `/Users/mnagas/Documents/pricefx/pricefx-im-plugin` and found that **this is the Pricefx IM *plugin development* repository, not a Pricefx Integration Manager customer project.** There are no legacy integration patterns to fix here because there are no integration artifacts to begin with.

### What I checked

| Expected (for a real IM project) | Found here |
|---|---|
| `src/main/resources/repo/routes/` | Absent |
| `src/main/resources/repo/mappers/` | Absent |
| `src/main/resources/repo/filters/` | Absent |
| `src/main/resources/repo/connections/` | Absent |
| `src/main/resources/repo/config/application.properties` | Absent |
| `pom.xml` (for IM/Camel version detection) | Absent |

There is **no `src/` tree at all** and **no `repo/` directory** anywhere in the project.

### What the repo actually contains

This is the source repo for the `pricefx-im-plugin` Claude Code plugin:

- `skills/` — skill definitions (generate-*, migrate-*, analyze, etc.)
- `agents/` — agent definitions (analyze-project, migrate-project, upgrade-project, ...)
- `docs/` — the framework reference docs (project.md, routes.md, components.md, mappers.md, filters.md, connections.md, anti-patterns.md, ...)
- `evals/` — eval harness, including fixture and generated-output XML files under `evals/workspaces/`
- `README.md`, `LICENSE`, `CLAUDE.md`, `pricefx-im-plugin-overview.pptx`

The only route/mapper/filter XML files in the tree live under `evals/workspaces/.../fixture/` and `.../outputs/`. These are **test fixtures and generated eval outputs**, not a deployable integration. They are intentionally varied (some contain deliberate anti-patterns as negative test cases) and must not be "fixed" — doing so would corrupt the eval suite.

### Why no changes were made

1. **No target artifacts.** Modernization (the `migrate-project` workflow) operates on `routes/`, `mappers/`, `filters/`, `connections/`, and `application.properties` under `src/main/resources/repo/`. None exist here.
2. **The XML files that do exist are off-limits.** Eval fixtures deliberately include legacy/anti-pattern XML as test inputs; auto-"fixing" them would break the tests they support.
3. **No version metadata.** Without a `pom.xml` there is no Camel/IM version to detect, so the Camel 3→4 attribute/URI renames (errorHandlerRef→errorHandler, quartz2:→quartz:, etc.) have nothing to apply to.

## Recommendation

If you intended to modernize a real customer integration, point the tool at the **IM project directory** — the one containing `src/main/resources/repo/routes/`, a `pom.xml`, and `config/application.properties`. Once that directory is the working directory, the modernization pass can:

- Detect the Camel/IM version from `pom.xml`.
- Scan routes/mappers/filters for the documented anti-patterns (Camel 3 `*Ref` attributes, `${pfx:...}` placeholders, `<routeContext>`/`<inOnly>`/`<inOut>` wrappers, `quartz2:`/`vm:`/`direct-vm:`/`aws-s3:` URI schemes, `loaddata` where `loaddataFile` is preferable, `noop=true` file consumers, PX/CX mappers missing the `name` constant, ID/filename mismatches, etc.).
- Apply auto-fixes and report the diffs.

No files were edited in this run.
