---
name: visualize-project
description: Generates a complete visual documentation package for a Pricefx Integration Manager project. Creates Mermaid flow diagrams for every route plus a project-level architecture overview and data-flow summary. Use when the user wants to visualize the project, generate diagrams, create flow charts, document flows, or draw the architecture.
model: sonnet
tools: Read, Grep, Glob, Bash, Write
maxTurns: 80
---

# Integration Manager Project Visualizer

Generates a complete visual documentation package for an IM project. All output is `.md` files with Mermaid code blocks — no HTML, no customer names, no secrets.

## Trigger Phrases

"visualize project", "generate diagrams", "create flow charts", "document flows", "draw architecture"

## Output Structure

```
docs/diagrams/
  README.md                 # Index of all diagrams
  project-overview.md       # High-level system architecture
  data-flow-overview.md     # All data flows and dependencies
  routes/
    {route-name}-flow.md    # One diagram per route
```

---

## Phase 1 — Project Scan

1. Glob all route, mapper, and filter files under `src/main/resources/repo/`
2. Read `src/main/resources/repo/config/application.properties` for connection details
3. For each route extract: route ID, source URI (`<from>`), target URI(s), `direct:` references, mapper/filter names, error handling presence, post-completion steps

**Categorize routes:**

| Category | Detection rule |
|----------|---------------|
| import | Target contains `pfx-api:loaddata` or `pfx-api:loaddataFile` |
| export | Source contains `pfx-api:fetch`; target is file/REST/SFTP/S3 |
| event | Source contains `pfx-event:` or inbound `pfx-rest:` |
| utility | `timer:repeatCount=1` source, or only reached via `direct:` |

**Map external system labels from URI patterns:**

| URI pattern | Label |
|------------|-------|
| `file://` or `pfx-sftp:` with `{{integration.sftp.root}}` | `SFTP Storage` |
| `pfx-sftp:` with external host | `SFTP Server` |
| `pfx-rest:` outbound | `REST API` |
| `kafka:` | `Kafka` |
| `aws-s3:` / `pfx-s3:` | `S3` |
| `pfx-sql:` | `Database` |
| `timer:` / `quartz:` | `Scheduler` |
| `pfx-event:` | `Pricefx Events` |

Never embed actual hostnames, partition names, IP addresses, or credentials. Replace `{{pfx:route.*.host}}` style placeholders with generic role labels.

---

## Phase 2 — Project Overview Diagram (`project-overview.md`)

Use `flowchart LR`. Group external systems on the left, Pricefx targets on the right. Each route is a labeled edge between its external system node and its Pricefx target node.

- External systems: `EXT[Label]`; Pricefx stores: `PFX[[Label]]`; Schedulers: `SCH([Label])`
- Use `subgraph External["External Systems"]` and `subgraph PFX["Pricefx"]`
- Import routes flow left-to-right; export routes right-to-left; events originate from `Pricefx Events`
- Keep under 20 nodes; if >10 external systems, group by protocol (e.g., `SFTP Sources`)
- Color hint: green labels = import, blue = export, orange = event, gray = utility (use `linkStyle` or subgraph styling)

---

## Phase 3 — Data Flow Overview (`data-flow-overview.md`)

Use `flowchart TB`. Show chronological execution order and route dependencies.

- **Top:** scheduled/file-triggered routes (run first)
- **Middle:** event-driven routes in `subgraph events["Event Phase"]`
- **Bottom:** export routes in `subgraph exports["Export Phase"]`
- Connect chained routes with `-->|direct|` edges; trace `<onCompletion>` and `pfx-event:` to show what triggers what
- Group import routes in `subgraph imports["Import Phase"]`

---

## Phase 4 — Per-Route Diagrams (`routes/{route-name}-flow.md`)

Use `flowchart LR` for each route.

**Node shapes and color classes:**

```
classDef source  fill:#28a745,color:#fff,stroke:#1e7e34
classDef process fill:#007bff,color:#fff,stroke:#0056b3
classDef target  fill:#fd7e14,color:#fff,stroke:#e36209
classDef error   fill:#dc3545,color:#fff,stroke:#bd2130
classDef cfs     fill:#6f42c1,color:#fff,stroke:#5a32a3
```

| Element | Shape | Class |
|---------|-------|-------|
| File/SFTP/event source | `([Label])` | `:::source` |
| Parse/split/map/Groovy step | `[Label]` | `:::process` |
| Choice/branch | `{Label}` | `:::process` |
| Pricefx API or external target | `[[Label]]` | `:::target` |
| Error folder / dead-letter | `[Label]` | `:::error` |
| CFS trigger / flush | `[Label]` | `:::cfs` |

**Arrow conventions:** `-->` normal flow · `-.->|error|` error path · `-.->|on complete|` post-completion · `-->|condition|` choice branch

**Chained routes:** wrap each part in a named subgraph and read the chained file to show its internal steps.

**Complexity limit:** max 20 nodes per diagram. For routes with many fields, show the structural skeleton (source → parse → split → load → CFS) and add a note: "N fields mapped — see mapper file for full mapping."

**File format for each route:**
```markdown
# {Route Name} — Data Flow

**Category:** import/export/event/utility | **Source:** ... | **Target:** ...

Generated from `src/main/resources/repo/routes/{route-name}.xml`.

[mermaid diagram]

**Mapper:** `{name}` | **Filter:** `{name}` | **Error handling:** yes/no
```

---

## Phase 5 — Index README (`README.md`)

Write last. List all diagrams organized by category (Architecture, Import Routes, Export Routes, Event-Driven Routes, Utility Routes) as Markdown tables with columns: Diagram link, Object type, Source/Target, one-line description.

Footer: `Generated: {date} | Routes: N | Diagrams: N`

---

## Execution Order

1. Phase 1 — scan ALL files before writing anything; `mkdir -p docs/diagrams/routes`
2. Phase 2 — write `docs/diagrams/project-overview.md`
3. Phase 3 — write `docs/diagrams/data-flow-overview.md`
4. Phase 4 — write `docs/diagrams/routes/{route-name}-flow.md` for each route
5. Phase 5 — write `docs/diagrams/README.md`

After completion, report all files written and route counts (imports/exports/events/utility).

## Critical Rules

- All output is `.md` with Mermaid code blocks — no HTML, no SVG, no PNG
- No customer names, hostnames, IP addresses, passwords, or API keys in any label
- Max 20 nodes per diagram — use subgraphs for complex routes
- Consistent shapes and `classDef` colors across every diagram
- Do not modify any existing source files
