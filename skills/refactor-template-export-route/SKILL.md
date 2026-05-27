---
name: refactor-template-export-route
description: Use when the user wants to flatten a templated Pricefx Integration Manager export route (Pricefx → CSV/SFTP/REST) into a straight-line route — says "refactor this export route", "hardwire the export properties", "remove the {{pfx:...}} placeholders from export", "straight export route without properties", or "convert templated export to plain", and the source route has heavy `{{pfx:...}}` parameterisation plus a Groovy `<script>` parsing `pfxApiSettings`.
---

# Refactor Templated Export Route

You are refactoring a Pricefx Integration Manager Pricefx-to-{CSV,SFTP,REST} export route that was generated from a template heavy with `{{pfx:<route-id>.*}}` property placeholders, a `pfxApiSettings` Groovy parser, `<choice>` blocks for `objectType` / DMDS handling / split-preserved headers / max-lines / virtual headers, and a `<from>` URI built from `{{pfx:...sync.cron}}`. The goal is a short, hardwired, straight-line export route that does exactly what the property values say — nothing more.

This skill is the export counterpart of `refactor-template-import-route`. For the canonical shape of a clean export route, cross-reference `generate-export-integration` — the refactored output should match those templates (basic, delta, or marked/consistent depending on which `<choice>` arms survive).

> **Camel version note:** the refactored `<split>` template uses Camel 4 `aggregationStrategy=` form (IM 7.x default). Before writing the file, detect the target project's Camel version from `pom.xml` `<camel.version>` (or infer from IM version per `migrate-manual-to-provisioned-pom` Step 1). For Camel 3 (IM ≤ 6.x), swap to `strategyRef=` per `docs/routes.md` → "Camel 3 ↔ Camel 4". When the version is unclear, default to Camel 4 and flag the assumption. If the input route already uses `*Ref` form, preserve it (this skill is a flatten, not a Camel-version upgrade).

## When to use

The route looks like a template with most of these traits:
- `<from uri="quartz://exportPfxToCSV-{{pfx:...export.pfx.to.csv.mapper}}?cron={{pfx:...sync.cron}}&amp;stateful=true&amp;trigger.timeZone=..."/>` (or a commented-out `timer:`/`direct:` alternative)
- `<setHeader name="pfxApiSettings"><constant>{{pfx:...pfx-api.settings}}</constant></setHeader>` followed by a Groovy `<script>` that splits `pfxApiSettings` into per-key headers (`objectType`, `entityName`, `dsUniqueName`, `nullValue`)
- A `<choice>` setting `dsUniqueNameHeader` only when `objectType == 'DMDS'`
- A `<setHeader name="fetchObjectType">` from `headers.objectType`
- A two-step batched `pfx-api:fetch` (batched outer fetch → `<split>` → inner fetch per batch) with templated `connection`, `batchSize`, `${headers.ppNameHeader}${headers.typedIdHeader}${headers.dsUniqueNameHeader}${headers.filterClause}` URI suffix
- `pfx-model:transform?mapper={{pfx:...export.pfx.to.csv.mapper}}`
- `pfx-csv:marshal?quoteMode=NON_NUMERIC&amp;skipHeaderRecord={{pfx:...skip.header.record}}&amp;delimiter={{pfx:...csv.delimiter}}` *or* `<marshal><json library="Jackson"/></marshal>` for REST exports
- Optional PGP `<marshal>` + `<multicast>` SFTP destinations + `{{pfx:...done.file.clause}}` placeholder
- Optional `splitPreservedHeaders` Groovy map (prepends the CSV header line to each chunk after the first)
- Optional incremental sync via `pfx-config:get`/`pfx-config:set` on a `{{integration.name}}.${routeId}.export.timestamp.${headers.objectType}.${headers.entityName}` key plus a `whereFilterClause` Groovy
- A trailing `<otherwise><stop/></otherwise>` for the "nothing to export" path

If the route is REST-targeted (e.g. SFDC), it may additionally have:
- A complex `<onException>` block with `massedit` to mark `Integration_Status = Exception:...`
- A pre-export `<massedit>` to mark rows `Export_Status = Processing`
- A post-export `<onCompletion>` with `massedit` to finalize `Export_Status` based on `Integration_Status`

## Step 1: Identify the route and load context

If the user did not name a route file, ask: **Which route file should I refactor?** (typically `src/main/resources/repo/routes/export-*-to-{ftp,sfdc,...}.xml`).

Read the full route XML. Note the route `id` — every property key for this route is `pfx:<route-id>.<suffix>`.

Then read all properties for this route from `src/main/resources/repo/config/application.properties`:

```
grep -n "^pfx\\\\:<route-id>\\." src/main/resources/repo/config/application.properties
```

Collect every value into a key → value map. Many will be empty strings — those represent inactive branches.

Then read the mapper file referenced by `pfx:<route-id>.export.pfx.to.csv.mapper` so you can confirm the output column list and the source field names.

## Step 2: Decide which branches stay and which die

For every `<choice>` / `<script>` / `${headers.X}` substitution in the route, resolve it using the hardwired property value. If the predicate is constant after substitution, **delete the whole `<choice>` and inline only the surviving branch**.

| Property / Trait | Typical value | Effect on route |
|---|---|---|
| `pfx-api.settings` `objectType` | one of `DM`, `DMDS`, `P`, `PX`, `C`, `CX`, `SL`, `SX` | Becomes a literal `objectType=<X>` in the fetch URI. The `dsUniqueNameHeader` choice collapses: keep `&dsUniqueName=<entityName>` inline iff `objectType=DMDS`, drop otherwise. |
| `pfx-api.settings` `entityName` | required for DMDS, PX, CX | Inline as the `dsUniqueName=` parameter for DMDS, or as the `name` criterion in the filter for PX/CX. |
| `pfx-api.settings` `dsUniqueName` | usually equals `entityName` for DMDS | Inline directly. |
| `pfx-api.settings` `nullValue` | `""` | Drop — pfx-model handles the default. |
| `useVirtualHeaders` | `false` | Drop both the `useVirtualHeaders` and `virtualHeaders` properties; the marshal output is used as-is. If `true`, keep a literal `header=<csv-of-virtualHeaders>` on the marshal. |
| `skip.header.record` | `true` or `false` | Hardwire into `pfx-csv:marshal?skipHeaderRecord=<bool>`. |
| `csv.delimiter` | `,`, `\|`, `;` (URL-encoded in the property file) | URL-decode and hardwire into `pfx-csv:marshal?delimiter=<d>`. |
| `incremental.export` | `true` | Keep `pfx-config:get`, the `whereFilterClause` choice (first-run vs subsequent-run), and the `<onCompletion>` `pfx-config:set`. |
| `incremental.export` | `false` | Drop all three. Use a static `WHERE` clause (often `WHERE 1=1` or whatever the project-specific predicate is). |
| `custom.timestamp.column` | `lastUpdateDate` or e.g. `Effective_From` | Use this column name in the WHERE-clause comparison. |
| `max.lines.per.file` | empty | Drop the `splitPreservedHeaders` Groovy map and the chunking branches entirely. If non-empty, keep that block but hardwire the value. |
| `max.lines.add.suffix` | `true` or `false` | Inline into the chunking logic if it survives. |
| `done.file.clause` | empty | Drop the trailing `{{pfx:...done.file.clause}}` placeholder. If non-empty, hardwire the resulting `&doneFileName=...` directly into the destination URI. |
| `pfx-connection` | `pricefx` | Drop `&connection=pricefx` from every URI — `pricefx` is the implicit default (see `docs/connections.md`). |
| `sftp.connection` | `default-sftp-connection` | If `default-sftp-connection`, replace the `pfx-sftp:parameters?...` URI with `file://{{integration.sftp.root}}/<sftp.directory>?fileName=${headers.exportFileName}` — the local-mounted IM storage. If a real external SFTP, keep `pfx-sftp:` with the connection inline. |
| `sftp.directory` | `/outbound/...` | Inline. |
| `sync.cron` | e.g. `0+0+*+*+*+?+*` | Inline into the `quartz://` `cron=` parameter. |
| `batch.size` | `10000` | Inline as `batchSize=<N>`. |
| `export.pfx.to.csv.mapper` | `pfx:<route-id>.export.pfx.to.csv.mapper` | Inline as `mapper=<value>`. |
| `export.file.timestamp.format` | `yyyy-MM-dd'T'HHmmss` or similar | Inline into the Groovy that builds the file name. |
| `export.file.name` | empty or template | Inline into the file-name Groovy. |

Drop the Groovy `<script>` that parses `pfxApiSettings` into headers — every field it sets becomes a literal in the URI.

## Step 3: Rebuild the `from` URI

Hardwire `sync.cron` and timezone directly into the URI. Drop the `exportPfxToCSV-{{...mapper}}` token in favor of a stable name derived from the route id:

```
quartz://export-<route-id>?cron=<cron-literal>&amp;stateful=true&amp;trigger.timeZone=<TZ>
```

Cron expressions: spaces are encoded as `+` inside Camel URIs (`0 0 * * * ?` → `0+0+*+*+*+?`).

If the active `<from>` is a `direct:` or `timer:` (the templates often leave both `quartz` and `direct:manualStart...` and a `timer:testTimer...` commented out), keep whichever the user is actually using. Don't change a manually-triggered route into a scheduled one without confirmation.

`stateful=true` and `trigger.timeZone=...` are always set; preserve them.

## Step 4: Rebuild the `pfx-api:fetch` URIs

There are **three** fetch URIs in the refactored route: a `countOnly=true` upstream gate, the batched outer fetch, and the inner per-batch fetch. All three share the same `objectType=` / `dsUniqueName=` / `sql=` / `sortBy=` shape — the count fetch adds `countOnly=true`, the batched fetch adds `batchedMode=true&batchSize=<N>`, the inner fetch has neither extra parameter.

### Add a `countOnly` upstream gate

The templated route checks `${body} != ''` *after* the batched-fetch metadata call to decide whether to enter the split. That's wasteful (the batched fetch already ran) and inverts the natural flow. Replace it with a `countOnly=true` fetch in front, and gate everything else with `<simple>${body} &gt; 0</simple>`. This collapses the original two `<choice>` blocks (count gate + non-empty-metadata check) into a single one.

```
pfx-api:fetch?objectType=<obj>&amp;dsUniqueName=<entityName>&amp;sql=SELECT * ${headers.whereFilterClause}&amp;countOnly=true
```

Log the count for operability (`<log message="rows to export: ${body}"/>`).

**Common DMDS case:**

```
pfx-api:fetch?objectType=DMDS&amp;dsUniqueName=<entityName>&amp;sql=SELECT * <whereFilterClause>&amp;sortBy=lastUpdateDate,id&amp;batchedMode=true&amp;batchSize=<N>
```

Where `<entityName>` is the literal value from `pfx-api.settings`. Note: the `dsUniqueName=` parameter on `pfx-api:fetch` does **not** include the `DMDS.` prefix when the object type itself is `DMDS` — the prefix belongs only to the `dataSourceName=` parameter of `pfx-api:massedit`. Verify the source route's exact convention before flipping.

**Common DM (data mart) case:** use `objectType=DM&dsUniqueName=DMDS.<entityName>` instead — see `generate-export-integration` for the rules on when to use `DM` vs `DMDS`.

**For P / C / PX / CX / SL / SX:** drop `&dsUniqueName=...`. For PX/CX, the extension table name moves into a filter criterion (`<criterion fieldName="name" operator="equals" value="<table>"/>`) — extract the SQL fragment into a `<filter>` file under `filters/` and reference it via `&filter=<route-id>.filter` instead of `sql=`.

The inner (per-batch) fetch uses the same URI without `batchedMode` and `batchSize`.

## Step 5: Rebuild the marshal step

**CSV exports:**

```
pfx-csv:marshal?quoteMode=NON_NUMERIC&amp;skipHeaderRecord=<bool>&amp;delimiter=<d>
```

URL-decode `delimiter` before writing (`%2C` → `,`, `%7C` → `|`, `%3B` → `;`). XML-escape inside attributes (`"` → `&quot;`, `&` → `&amp;`).

If the route writes the file in chunks via `<split>` with `fileExist=Append`, add `camelSplitIndexAware=true` so the CSV header is written only on the first chunk — see `generate-export-integration` for the rationale.

**JSON exports (REST destination):** keep `<marshal><json library="Jackson"/></marshal>` as-is — that's not template scaffolding.

## Step 6: Rebuild the incremental timestamp logic (when `incremental.export=true`)

Hardwire the `pfx-config:get` / `pfx-config:set` URIs. The key format stays the same:

```
pfx-config:get?name={{integration.name}}.<route-id>.export.timestamp.<objectType>.<entityName>
pfx-config:set?name={{integration.name}}.<route-id>.export.timestamp.<objectType>.<entityName>&amp;value=${headers.interfaceStartTimestamp}
```

`{{integration.name}}` is a project-level placeholder (provided by IM) — keep it as a placeholder, not as a literal. The `<objectType>` and `<entityName>` segments come from `pfx-api.settings` and are now literals.

**Keep the first-run vs subsequent-run `<choice>`** — it picks between `WHERE 1=1 AND lastUpdateDate <= '<start>'` (first run) and `WHERE 1=1 AND lastUpdateDate > '<stored>' AND lastUpdateDate <= '<start>'` (subsequent runs). That's business logic, not template scaffolding.

If `custom.timestamp.column` is set to something other than `lastUpdateDate`, substitute that column name in the WHERE clauses.

## Step 7: Preserve route-specific business logic

Do not strip:
- `onException` blocks (including the SFDC-style JSON-error parsing and `massedit` Integration_Status updates)
- Project-specific `<script>` blocks that are NOT the `pfxApiSettings` parser — e.g. `splitPreservedHeaders` header-prepending logic, `RowIds` collection for follow-up massedit, `ErrorMessage` cleaning
- PGP `<marshal>` blocks
- `<multicast>` to multiple destinations (e.g. main + backup SFTP folder)
- Pre-export `<massedit>` (mark `Export_Status = Processing`) and post-export `<massedit>` (mark `Exported` / `Failed`)
- `<onCompletion>` blocks
- `<delay>` steps — but add `asyncDelayed="false"` if the source uses the bare `<delay>` form (see "Notes and gotchas" → delay; AP-35)
- Logging steps
- HTTP-related header setups (`Authorization`, `Content-Type`, `X-Correlation-Id`, `CamelHttpMethod`) and the REST `toD` to the external endpoint

Only the template scaffolding goes — `pfxApiSettings` parser, `dsUniqueNameHeader` setter, `fetchObjectType` setter, the empty `${headers.ppNameHeader}${headers.typedIdHeader}${headers.filterClause}` URI suffix slots, and any `<choice>` whose predicate is constant after substitution.

Drop empty header references like `${headers.ppNameHeader}` and `${headers.typedIdHeader}` from the URIs unless the property they correspond to has a non-empty value (they're nearly always empty in real projects).

**Drop `<doTry>/<doCatch>` blocks** that wrap `pfx-api:fetch` or other template steps. They swallow the exception (typically `net.pricefx.integration.api.NonRecoverableException`) and run `<stop/>` in the catch, which has three bad effects: (a) IM's retry/redelivery is disabled because the exception never reaches its error handler; (b) `<onCompletion onCompleteOnly="true">` still fires because the exchange completed "successfully" from Camel's POV — so the watermark in `pfx-config:set` advances even though the export failed (silent data loss); (c) the route's `onException` block (if any) doesn't fire either. Let the exception propagate. Also drop the `<log>` + `<stop/>` that lived inside the `<doCatch>` — they only exist to suppress the exception.

## Step 8: Write the rewritten route

Use Write to overwrite the route file with the new content. Layout for the **CSV → SFTP** variant (modelled on `pim-nvidia/export-sap-condition-899-to-ftp` after refactor):

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
<route id="<route-id>" xmlns="http://camel.apache.org/schema/spring"
       description="<keep existing description or 'in use'>">
    <from uri="quartz://export-<route-id>?cron=<cron>&amp;stateful=true&amp;trigger.timeZone=<TZ>"/>

    <setHeader name="interfaceStartTimestamp">
        <groovy>new Date().format("yyyy-MM-dd'T'HH:mm:ss", TimeZone.getTimeZone('UTC'))</groovy>
    </setHeader>

    <!-- incremental.export=true: read last export timestamp -->
    <toD uri="pfx-config:get?name={{integration.name}}.<route-id>.export.timestamp.<objectType>.<entityName>"/>
    <setHeader name="whereFilterClause">
        <groovy>'WHERE 1=1'</groovy>
    </setHeader>
    <choice>
        <when>
            <simple>${body} == null || ${body} == ''</simple>
            <setHeader name="whereFilterClause">
                <groovy>headers.whereFilterClause + " AND lastUpdateDate&lt;='" + headers.interfaceStartTimestamp + "' AND <project-specific predicate>"</groovy>
            </setHeader>
        </when>
        <otherwise>
            <setHeader name="whereFilterClause">
                <groovy>headers.whereFilterClause + " AND lastUpdateDate&gt;'" + request.body + "' AND lastUpdateDate&lt;='" + headers.interfaceStartTimestamp + "' AND <project-specific predicate>"</groovy>
            </setHeader>
        </otherwise>
    </choice>

    <!-- count rows to export -->
    <toD uri="pfx-api:fetch?objectType=<obj>&amp;dsUniqueName=<entityName>&amp;sql=SELECT * ${headers.whereFilterClause}&amp;countOnly=true"/>
    <log message="rows to export: ${body}"/>

    <choice>
        <when>
            <simple>${body} &gt; 0</simple>
            <!-- fetching real data using batching -->
            <toD uri="pfx-api:fetch?objectType=<obj>&amp;dsUniqueName=<entityName>&amp;sql=SELECT * ${headers.whereFilterClause}&amp;sortBy=lastUpdateDate,id&amp;batchedMode=true&amp;batchSize=<N>"/>
            <log message="batching on interval: ${body}"/>

            <split>
                <simple>${body}</simple>
                <toD uri="pfx-api:fetch?objectType=<obj>&amp;dsUniqueName=<entityName>&amp;sql=SELECT * ${headers.whereFilterClause}&amp;sortBy=lastUpdateDate,id"/>
                <to uri="pfx-model:transform?mapper=<mapper-ref>"/>
                <to uri="pfx-csv:marshal?quoteMode=NON_NUMERIC&amp;skipHeaderRecord=<bool>&amp;delimiter=<d>&amp;camelSplitIndexAware=true"/>
                <setHeader name="exportFileName">
                    <groovy>return "pfx_export_<objectType>_<entityName>_" + new Date().format("<ts-format>", TimeZone.getTimeZone('UTC')) + ".csv"</groovy>
                </setHeader>
                <!-- optional PGP marshal preserved -->
                <!-- optional multicast preserved -->
                <to uri="file://{{integration.sftp.root}}<sftp.directory>?fileName=${headers.exportFileName}&amp;fileExist=Append"/>
                <setBody><constant/></setBody>
            </split>
        </when>
        <otherwise>
            <log message="nothing to export, stopping"/>
            <stop/>
        </otherwise>
    </choice>

    <!-- incremental.export=true: persist new high-water mark -->
    <onCompletion onCompleteOnly="true">
        <toD uri="pfx-config:set?name={{integration.name}}.<route-id>.export.timestamp.<objectType>.<entityName>&amp;value=${headers.interfaceStartTimestamp}"/>
    </onCompletion>
</route>
</routes>
```

For the **REST/JSON destination** variant, keep the destination block and surrounding `onException`/`onCompletion` massedit logic untouched. Only the front of the route (pfxApiSettings parser, dsUniqueNameHeader, fetchObjectType) is removed; the batched-fetch URI becomes a literal as above; the marshal stays as `<marshal><json/></marshal>`; the destination `toD uri="{{sfdc-...-url}}?bridgeEndpoint=true"` is preserved.

Remove all blank lines inside `<route>...</route>`. Match the indentation used by the rest of the project.

## Step 9: Delete the now-unused properties

In `src/main/resources/repo/config/application.properties`, delete the contiguous block of `pfx\:<route-id>.*` lines that became literals. The typical set generated by the export template is:

```
batch.size
csv.delimiter
custom.timestamp.column
done.file.clause
export.file.name
export.file.timestamp.format
export.pfx.to.csv.mapper
incremental.export
max.lines.add.suffix
max.lines.per.file
pfx-api.settings
pfx-connection
sftp.connection
sftp.directory
skip.header.record
sync.cron
useVirtualHeaders
virtualHeaders
```

(REST variants additionally have `sfdc-*-url` etc. — those are usually project-wide URLs, **not** route-specific; do **not** delete them just because the route was refactored. Confirm before removing anything that doesn't follow the `pfx\:<route-id>.*` prefix.)

Use Edit with the full block as `old_string` and an empty `new_string` so the lines disappear cleanly.

## Step 10: Report back

Tell the user:
1. The route file path that changed and a short summary of what was hardwired vs dropped (`pfxApiSettings` parser, `dsUniqueNameHeader` choice, empty `ppNameHeader`/`typedIdHeader`/`filterClause` slots, etc.).
2. The properties file path and how many `pfx\:<route-id>.*` entries were removed.
3. Any non-obvious decisions — e.g. "dropped `<doTry>/<doCatch>` so exceptions reach IM's retry/error handler and the `onCompletion` watermark doesn't advance on failure", "kept PGP marshal", "kept `splitPreservedHeaders` because `max.lines.per.file=20000`", "kept the SFDC `<onException>` + post-export `massedit` chain — that's business logic, not template scaffolding", "added `countOnly` upstream gate and collapsed the two `<choice>` blocks into one".
4. If the route still references `{{integration.sftp.root}}` or `{{integration.name}}`, note that these are provided by IM at runtime so no `application.properties` entry is required.
5. If the refactor changed `pfx-sftp:` to `file://{{integration.sftp.root}}/...` because the connection was `default-sftp-connection`, call out the performance reason (see `docs/connections.md`).

## Notes and gotchas

- **`dsUniqueName` prefix.** `pfx-api:fetch?objectType=DMDS&dsUniqueName=<X>` uses the entity name **without** a `DMDS.` prefix. `pfx-api:massedit?objectType=DMDS&dataSourceName=DMDS.<X>` uses **with** the prefix. The template hides this — when flattening, copy what the source route did literally, don't add or remove the prefix from instinct.
- **`objectType=DM` vs `objectType=DMDS` for fetch.** When fetching from a Data Mart via its DMDS source, `objectType=DM&dsUniqueName=DMDS.<X>` is the correct form. The template uses whatever the user typed in `pfx-api.settings`. Don't second-guess it during the flatten — match the source route's behavior exactly.
- **`connection=pricefx` is the implicit default.** Drop every `&connection=pricefx` parameter (the connection bean named `pricefx` is used automatically). Only keep `connection=` for non-default Pricefx instances or for external systems.
- **`default-sftp-connection` → `file://`.** When `sftp.connection=default-sftp-connection`, the destination is the IM pod's local mounted storage. Replace `pfx-sftp:parameters?connection=default-sftp-connection&directory=<D>&fileName=<F>` with `file://{{integration.sftp.root}}<D>?fileName=<F>` for better performance. See `docs/connections.md` "Default SFTP connection".
- **Empty URI slot headers.** `${headers.ppNameHeader}${headers.typedIdHeader}${headers.filterClause}` are template placeholders that are almost always empty strings — drop them from the URI. If any are non-empty in the source's actual run, inline the value.
- **Mapper reference uses `:` not `_`** — same as the import refactor skill: the on-disk filename uses `_` but the IM reference inside the URI uses `pfx:<route-id>.export.pfx.to.csv.mapper`.
- **`{{integration.name}}` and `{{integration.sftp.root}}`** are IM-provided runtime properties, **not** project properties. Keep them as placeholders in the rewritten route; do not add them to `application.properties`.
- **`<delay>` must be `asyncDelayed="false"`.** A bare `<delay>` relies on Camel's `asyncDelayed` default, which schedules the delay on a thread pool and releases the route thread rather than blocking it — so the pause doesn't reliably serialize with the steps after it (e.g. waiting for a `pfx-sftp` / `file://` write to settle). Always write `<delay asyncDelayed="false">` so it takes the synchronous `Thread.sleep()` path. This is AP-35 in `docs/anti-patterns.md`. (A fixed delay is still a weak substitute for a real `doneFileName` completion handshake — flag that to the user when you see delays papering over SFTP write ordering.)
- **PGP key paths.** PGP `keyFileName="file:/home/im/repository/resources/..."` paths are environment-specific resources, not template scaffolding. Keep them verbatim.
- Do not introduce `description="deprecated, ..."` unless the user has already marked the route as such. Preserve the existing `description` attribute verbatim.
- For DMDS exports where background jobs may modify data **during** the export, consider promoting the refactor to the marked/consistent pattern from `generate-export-integration` Step 4b. That's a route-level redesign, not a flatten — ask the user before applying.
