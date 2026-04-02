---
name: explain-route
description: Explain what an IM route does in plain business language for non-technical stakeholders. Use when the user says "explain this route", "what does this do", "describe in business terms", or needs to document a route for handoff.
---

# Explain Route

Explain what an Integration Manager route does in plain business language for non-technical stakeholders. Read the route and its supporting files, then produce a clear summary and optional data flow diagram.

## Step 1: Identify the Route File

If `$ARGUMENTS` contains a route name or file path, locate it directly.
Otherwise ask: **Which route do you want explained?** Then list available routes:

```bash
ls src/main/resources/repo/routes/
```

## Step 2: Read the Route and Supporting Files

Read all relevant files in parallel:

1. **Route XML** — `src/main/resources/repo/routes/{route-name}.xml`
2. **Mapper(s)** — look for `{route-name}.mapper.xml` or any mapper referenced in the route:
   ```bash
   grep -o 'mapper=[^&"]*' src/main/resources/repo/routes/{route-name}.xml
   ```
   Then read: `src/main/resources/repo/mappers/{mapper-name}.xml`
3. **Filter(s)** — look for any filter referenced in the route:
   ```bash
   grep -o 'filter=[^&"]*' src/main/resources/repo/routes/{route-name}.xml
   ```
   Then read: `src/main/resources/repo/filters/{filter-name}.xml`
4. **Properties** — read `src/main/resources/repo/config/application.properties` for context on schedule, paths, and connections.

## Step 3: Analyze the Route

Extract the following from the files read:

| Aspect | What to look for |
|--------|-----------------|
| **Source** | `<from uri="...">` — file, SFTP, timer, event, REST, Kafka |
| **Trigger** | timer cron expression, file arrival, event name, manual |
| **Data format** | CSV, JSON, XML, database rows |
| **Transformations** | mapper field mappings, filters, Groovy expressions, splits |
| **Target** | `pfx-api:loaddata`, `pfx-api:loaddataFile`, `pfx-rest`, `pfx-sql` — what Pricefx object or external system |
| **Batch size** | `batchSize=` parameter |
| **On success** | archive/move/delete patterns, post-import calculations (`onCompletion`) |
| **On error** | `moveFailed`, `onException`, error folder pattern |
| **Schedule** | cron expression decoded to human language (e.g., `0 0 2 * * ?` → "daily at 2:00 AM") |

### Cron expression decoder

| Pattern | Meaning |
|---------|---------|
| `0 0 * * * ?` | Every hour |
| `0 0 2 * * ?` | Daily at 2:00 AM |
| `0 0 6 ? * MON` | Every Monday at 6:00 AM |
| `0 30 8 1 * ?` | 1st of every month at 8:30 AM |
| File `<from>` with no timer | On-demand (file trigger) |
| `repeatCount=1` timer | Runs once on startup |

### Source type decoder

| URI prefix | Business meaning |
|-----------|-----------------|
| `file://` | Local/SFTP folder (files dropped into a monitored folder) |
| `pfx-sftp:` | External SFTP server |
| `timer:` | Scheduled (runs on a cron or fixed interval) |
| `pfx-event:` | Triggered by a Pricefx event (e.g., after a calculation) |
| `pfx-rest:` | Calls an external REST API |
| `pfx-sql:` | Queries a database |

### Target object decoder

| objectType | Business name |
|-----------|---------------|
| `P` | Pricefx Product Master |
| `PX` | Pricefx Product Extension |
| `C` | Pricefx Customer Master |
| `CX` | Pricefx Customer Extension |
| `SL` | Pricefx Seller |
| `SX` | Pricefx Seller Extension |
| `DS` / `DMDS` | Pricefx PA Data Source |
| `PPV` / `LTV` / `MLTV2` | Pricefx Pricing Parameters |

## Step 4: Generate Plain-Language Summary

Output the following structure:

```
## Route: {route-name}

**What:** {One sentence describing the business purpose — what data moves where}
**When:** {Trigger description in plain language — file arrival, daily at X, on event, etc.}
**Source:** {What data comes in — file type, columns if known, system name}
**Target:** {Pricefx object type and table name, or external system}
**Processing:** {Key transformations in plain language — filtering, splitting, field mapping highlights}
**On Success:** {What happens after successful import — archive, calculation trigger, notification}
**On Error:** {What happens on failure — error folder, retry, alert}
**Schedule:** {Human-readable schedule or "on demand"}
```

### Example output

```
## Route: import-products-from-sftp

**What:** Imports product master data from CSV files into the Pricefx Product catalog.
**When:** Triggered when a new CSV file appears in the /inbound/products/ monitored folder.
**Source:** CSV file with columns: SKU, Name, Category, List Price, Status
**Target:** Pricefx Products (P) — maps to fields: sku, label, attribute1 (Category), attribute2 (Price), attribute3 (Status)
**Processing:** File is split into batches of 20,000 records for efficient loading. Prices converted from string to decimal. Inactive products (Status=N) filtered out before import.
**On Success:** File moved to .archive/2026/03/ folder. CFS calculation "UpdateProductAttributes" triggered.
**On Error:** File moved to .error/ folder. Error logged with file name and timestamp.
**Schedule:** On demand (file trigger — no cron schedule).
```

## Step 5: Generate Data Flow Diagram (Optional)

Ask: **Would you like a text-based data flow diagram?**

If yes, generate a diagram using ASCII art showing the flow:

```
{Source} → [{Parse/Unmarshal}] → [{Filter}] → [{Split batches}] → [{Map fields}] → {Target}
                                                                                        ↓
                                                                              {Post-import action}
```

### Example diagrams

**Simple file import:**
```
SFTP folder → [CSV Parse] → [Split 20K batches] → [Map fields] → Pricefx Products (P)
                                                                          ↓
                                                                  CFS Calculation
```

**Event-driven export:**
```
Pricefx Event → [Fetch CX data] → [Map to CSV] → [Write file] → SFTP /outbound/
```

**Scheduled database sync:**
```
Timer (daily 2AM) → [SQL Query] → [Map fields] → Pricefx Customer Master (C)
```

## Step 6: Offer Confluence / Handoff Export

Ask: **Do you want to save this explanation as a markdown file for handoff or documentation?**

If yes, write the summary to:
`docs/routes/{route-name}-explanation.md`

Keep the file concise — summary + diagram only, no raw XML or technical internals.
