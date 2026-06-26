---
name: refactor-template-import-route
description: Use when the user wants to flatten a templated Pricefx Integration Manager FTP-to-Pricefx import route into a straight-line route — says "refactor this route", "hardwire the properties", "remove the {{pfx:...}} placeholders", "straight route without properties", or "convert templated import route to plain", and the source route has heavy `{{pfx:...}}` parameterisation and dead-branch logic.
---

# Refactor Templated Import Route

You are refactoring a Pricefx Integration Manager FTP-to-Pricefx import route that was generated from a template heavy with `{{pfx:<route-id>.*}}` property placeholders and branching `<choice>` blocks for objectType / charset / business keys / virtual headers / DMDS flush / internal copy. The goal is a short, hardwired, straight-line route that does exactly what the property values say it does — nothing more.

> **Camel version note:** the refactored `<split>` template uses Camel 4 `aggregationStrategy=` form (IM 7.x default). Before writing the file, detect the target project's Camel version from `pom.xml` `<camel.version>` (or infer from IM version per `migrate-manual-to-provisioned-pom` Step 1). For Camel 3 (IM ≤ 6.x), swap to `strategyRef=` per `docs/routes.md` → "Camel 3 ↔ Camel 4". When the version is unclear, default to Camel 4 and flag the assumption. If the input route already uses `*Ref` form, preserve it as-is rather than rewriting (this skill is a flatten, not a Camel-version upgrade — for the latter use the migration agents).

## When to use

The route looks like a template with most of these traits:
- `from uri="pfx-sftp:parameters?connection={{pfx:...sftp.connection}}&..."` reading from a templated SFTP directory
- `setHeader pfxCsvSettings` / `pfxApiSettings` + a Groovy script that splits `pfxApiSettings` into per-key headers and rebuilds `parsedPfxApiSettings`
- A `<choice>` for charset (`{{pfx:...specified.charset}}` vs `'UTF-8'`)
- A `<choice>` for `use.configured.business.keys`
- A `<choice>` branching on `objectType` between `pfx-api:import` (DMF/DMDS/DM/DMSIM/DMM) and a `split` + `pfx-api:loaddata` path
- A `<choice>` inside the split for `useVirtualHeaders`
- A `<choice>` inside the split for `objectType == 'U'` (`importUsers`) vs `loaddata`
- A trailing `<choice>` for DMDS flush
- A trailing `<choice>` for internal copy

## Step 1: Identify the route and load context

If the user did not name a route file, ask: **Which route file should I refactor?** (typically `src/main/resources/repo/routes/import-*-from-ftp-to-pricefx.xml`).

Read the full route XML. Note the route `id` — every property key for this route is `pfx:<route-id>.<suffix>`.

Then read all properties for this route from `src/main/resources/repo/config/application.properties`:

```
grep -n "^pfx\\\\:<route-id>\\." src/main/resources/repo/config/application.properties
```

Collect every value into a key → value map. Many will be empty strings or `false` — those represent the inactive branches.

## Step 2: Decide which branches stay and which die

For every `<choice>` in the route, resolve its predicate using the hardwired property value. If the predicate is constant after substitution, **delete the whole `<choice>` and inline only the surviving branch**.

| Property | Default value | Effect on route |
|---|---|---|
| `pfx-api.settings` | `entityName=X&nullValue=""&objectType=Y` | objectType decides which `<choice>` arm wins (DMF/DMDS/DM/DMSIM/DMM → `pfx-api:import`; U → `importUsers`; everything else → `pfx-api:loaddata`) |
| `specified.charset` | empty | charset `<choice>` collapses to `setupCharset?specifiedCharset=UTF-8` |
| `use.configured.business.keys` | `false` or `true` | `false` → drop both `businessKeysClause` and `businessKeysMaxLengthsClause` choices; `true` → hardwire `&businessKeys=<keys>` (and `&businessKeysMaxLengths=...` if `businesskeys.length` non-empty) directly into the `loaddata` URI |
| `useVirtualHeaders` | `false` → use `skipHeaderRecord=true`; `true` → use `skipHeaderRecord=false&header=<virtualHeaders>` | Collapse the inner `<choice>` to the surviving `pfx-csv:unmarshal` URI |
| `internal.copy` | `false` | Drop the entire trailing internal-copy `<choice>` |
| `pfx-api.settings.objectType` not `DMDS` | — | Drop the trailing DMDS flush `<choice>` |
| `pfx-api.settings.objectType` not `U` | — | Drop the `importUsers` arm of the inner choice |

Also drop the Groovy `<script>` that parses `pfxApiSettings` into headers — every field it sets becomes a literal in the URI of `pfx-api:loaddata` (or `pfx-api:import`, depending on objectType).

## Step 3: Rebuild the `from` URI

Replace `pfx-sftp:parameters?...` with the local file component, prefixed by `{{integration.sftp.root}}` (provided by IM at runtime, not a project property):

```
file:{{integration.sftp.root}}<sftp.directory>?move=<archive.file.clause without leading "move=">&moveFailed=.error/...&sortBy=file:name&delay=10000&readLock=changed
```

Drop SFTP-only options: `connection`, `streamDownload`, `stepwise`, `useUserKnownHostsFile`. Keep `move`, `moveFailed`, `sortBy`, `delay`, and the `readLock=changed` from `done.file.clause`.

Keep `${...}` file/date expressions URL-encoded (`%24%7B...%7D`) to match existing convention used in `moveFailed`.

## Step 4: Rebuild the `pfx-api:loaddata` (or `pfx-api:import`) URI

For the common case (objectType is C / P / PX / SL / SX / CX), the URI becomes:

```
pfx-api:loaddata?objectType=<obj>&entityName=<name>&nullValue=""&mapper=<mapper-ref>&businessKeys=<keys>&connection=<conn>
```

- Omit `entityName=` if the original `pfx-api.settings` did not include it (e.g. `objectType=C`).
- Omit `&businessKeys=...` if `use.configured.business.keys=false`.
- `<mapper-ref>` is the literal value of `pfx:<route-id>.import.csv.from.ftp.mapper` (usually `pfx:<route-id>.import.csv.from.ftp.mapper` — note the colon, not underscore).
- `<conn>` is the value of `pfx-connection`.

For the CSV unmarshal step inside the split, hardwire `pfx-csv.settings`:

```
pfx-csv:unmarshal?delimiter=<d>&quoteCharacter="&escapeCharacter=\&skipHeaderRecord=true
```

XML-escape inside attributes: `&` → `&amp;`, `"` → `&quot;`. Decode URL-encoded values from `pfx-csv.settings` (`%3D`=`=`, `%26`=`&`, `%22`=`"`, `%7C`=`|`, `%5C`=`\`) before writing them into the URI.

## Step 5: Preserve route-specific business logic

Do not strip:
- PGP `<unmarshal>` blocks (route may decrypt SAP files)
- Project-specific Groovy `<script>` blocks that aren't the `pfxApiSettings` parser — for example, the kits route extracts unique SKUs and pre-deletes existing rows
- `<doTry>` / `<doCatch>` error-handling wrappers (e.g. `MalformedInputException`)
- `<delay>` steps — but add `asyncDelayed="false"` if the source uses the bare `<delay>` form (see "Notes and gotchas" → delay; AP-36)
- Logging steps

Only the template scaffolding goes. Business logic stays.

## Step 6: Write the rewritten route

Use Write to overwrite the route file with the new content. Layout:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
<route id="<route-id>" xmlns="http://camel.apache.org/schema/spring"
description="<keep existing description or 'in use'>"
>
    <from uri="file:{{integration.sftp.root}}<dir>?..."/>
    <log message="Received file ${headers.CamelFileName}"/>
    <to uri="pfx-io:streamCompressedFile"/>
    <!-- optional: <unmarshal><pgp .../></unmarshal> -->
    <to uri="pfx-io:setupCharset?specifiedCharset=UTF-8"/>
    <!-- optional: route-specific pre-load steps (e.g. delete-then-reload) -->
    <doTry>  <!-- only if original had it -->
        <split aggregationStrategy="recordsCountAggregation" streaming="true">
            <tokenize group="20000" token="\n"/>
            <log loggingLevel="INFO" message="[${header[CamelFileNameOnly]}][${header[CamelSplitIndex]}] batch number."/>
            <to uri="pfx-csv:unmarshal?delimiter=...&amp;quoteCharacter=&quot;&amp;escapeCharacter=\&amp;skipHeaderRecord=true"/>
            <to uri="pfx-api:loaddata?objectType=...&amp;...&amp;connection=..."/>
        </split>
        <doCatch>
            <exception>java.nio.charset.MalformedInputException</exception>
            ...
        </doCatch>
    </doTry>
    <log message="Data from file ${header[CamelFileNameOnly]} have been saved. Total input records count : ${header.PfxTotalInputRecordsCount}"/>
</route>
</routes>
```

Remove all blank lines inside `<route>...</route>`.

## Step 7: Delete the now-unused properties

In `src/main/resources/repo/config/application.properties`, delete the contiguous block of `pfx\:<route-id>.*` lines (typically 15 entries: `archive.file.clause`, `business.keys`, `businesskeys.length`, `done.file.clause`, `import.csv.from.ftp.mapper`, `internal.copy`, `pfx-api.settings`, `pfx-connection`, `pfx-csv.settings`, `sftp.connection`, `sftp.directory`, `specified.charset`, `use.configured.business.keys`, `useVirtualHeaders`, `virtualHeaders`).

Use Edit with the full block as `old_string` and an empty `new_string` so the lines disappear cleanly.

## Step 8: Report back

Tell the user:
1. The route file path that changed and a short summary of what was hardwired vs dropped.
2. The properties file path and how many entries were removed.
3. Any non-obvious decisions — e.g. "kept `<doTry>` because it catches a real exception", "kept PGP decrypt", "kept the SKU-delete script — that's business logic, not template scaffolding".
4. If the route still relies on `{{integration.sftp.root}}`, note that this is provided by IM at runtime so no `application.properties` entry is required.

## Notes and gotchas

- **`use.configured.business.keys=true`** means you must inline `&businessKeys=<value>` in the `loaddata` URI. Do not forget — load semantics change without it.
- **Delimiter decoding**: `%3D`→`=`, `%26`→`&`, `%22`→`"`, `%7C`→`|`, `%5C`→`\`. The CSV settings property is doubly URL-encoded so it survives Camel property substitution.
- **PGP password** stays as `{{pgp-key}}` (it's a secret, not a template parameter).
- **`<delay>` must be `asyncDelayed="false"`.** A bare `<delay>` processor relies on Camel's `asyncDelayed` default, which schedules the delay on a thread pool and releases the route thread rather than blocking it — so the pause doesn't reliably serialize with the steps after it. Always write `<delay asyncDelayed="false">` so it takes the synchronous `Thread.sleep()` path. This is AP-36 in `docs/anti-patterns.md`. **Do not confuse this with the file-consumer `delay=` URI option** (the polling interval on `from uri="file:...?...&delay=10000"`, see Step 3) — that is unrelated and stays as-is.
- **Mapper reference uses `:` not `_`** — the on-disk filename uses `_` (`pfx_<route-id>.import.csv.from.ftp.mapper.xml`) but the IM reference inside the URI uses `pfx:<route-id>.import.csv.from.ftp.mapper`.
- Do not introduce `description="deprecated, ..."` unless the user has already marked the route as such. Preserve the existing `description` attribute verbatim.
- The user's IM platform provides `{{integration.sftp.root}}` — do not add this property to `application.properties`.
