# Full project health check

Health check could not be run as requested against a real integration: the working directory is the `pricefx-im-plugin` plugin source itself (skills, agents, docs, evals), not a deployed IM project.

The things a real IM project must have are absent:

- No `src/main/resources/repo/{routes,mappers,filters,connections,config}` — the only `routes/`/`mappers/`/`filters/` dirs anywhere are throwaway fixtures under `evals/workspaces/.../outputs/`.
- No `pom.xml` anywhere.
- No `application*.properties` anywhere.
- No route/mapper/filter XML outside `evals/` and `schemas/`.

So a quality score, route inventory, and top-3 fixes for an integration would be fabricated.

To get a real health check, point me at an actual IM project (a directory with `src/main/resources/repo/...` and a `pom.xml`). The plugin's own `analyze-project` agent is purpose-built to produce exactly the score + route inventory + top-3 actions, but it needs a real project as input.
