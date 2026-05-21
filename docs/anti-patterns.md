# Pricefx IM Anti-Patterns Catalog

Canonical list of legacy patterns to detect, report, and (where safe) auto-fix when migrating, upgrading, or auditing an Integration Manager project. Single source of truth for the `migrate-project`, `upgrade-project`, and `migrate-manual-to-provisioned` agents.

## How agents use this catalog

Each agent declares which **subset** of anti-patterns it scans for and which **policy** it applies to each finding (auto-fix vs. flag vs. aggregate from a skill). The agent does **not** redefine detection rules or fix recipes — those live here.

If you add a new anti-pattern, add it here only. The agents pick it up via the "Applies to" filter.

## Entry format

Each entry below uses this shape:

- **Severity:** `Critical` (will break on upgrade or in production) · `Important` (production best practice) · `Nice-to-have` (maintainability)
- **Applies to:** which migration / upgrade contexts the check runs in
- **Auto-fixable:** `Yes` (mechanical), `Yes (with caveat)`, or `No (reason)`
- **Detect:** a regex, glob, or shell expression an agent can run
- **Why it matters:** one sentence
- **Fix:** before/after, code, or steps

## Applicability flags

| Flag | Meaning |
|---|---|
| `version-independent` | Best-practice check; runs regardless of the IM/Camel/Spring Boot version |
| `5→6` | Relevant when upgrading IM 5.x → 6.x |
| `6→7` | Relevant when upgrading IM 6.x → 7.x |
| `manual→provisioned` | Relevant when lifting a legacy "manual" project (everything in `camel-context.xml`, Java in `src/main/java/`) to the modern "provisioned" layout |

A single AP may carry several flags.

---

## Versioning & pom.xml

### AP-1 — Spring Boot 2.x in `pom.xml`

- **Severity:** Critical
- **Applies to:** `5→6`, `6→7`, `manual→provisioned`
- **Auto-fixable:** No — version bumps need manual testing

**Detect:** `<spring-boot.version>2.` OR parent referencing `spring-boot-starter-parent` 2.x

**Why it matters:** Spring Boot 2.x is EOL. IM 7.x requires 3.x.

**Fix:** Bump the parent or `<spring-boot.version>` property to the latest 3.x. Run `mvn dependency:resolve` to verify the new artifacts resolve.

### AP-2 — Java 11 in `pom.xml`

- **Severity:** Critical
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** No — JVM bump needs manual testing

**Detect:** `<java.version>11` OR `<maven.compiler.source>11` in `pom.xml`

**Why it matters:** IM 7.x requires Java 17. Java 11 is EOL.

**Fix:** Bump `<java.version>` to `17` and matching `<maven.compiler.source>` / `<maven.compiler.target>` entries.

### AP-2b — Camel 3.x pinned in `pom.xml`

- **Severity:** Critical
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** Yes — remove the explicit pin

**Detect:** `<camel.version>3.` in `pom.xml`

**Why it matters:** Camel 4.1+ is required by IM 7.x. The IM 7.x parent BOM already manages the Camel version, so an explicit pin to 3.x both blocks the upgrade and is redundant.

**Fix:** Remove the explicit `<camel.version>` property; let the IM parent BOM resolve Camel.

### AP-2c — Java sources still under `src/main/java/`

- **Severity:** Critical
- **Applies to:** `manual→provisioned`
- **Auto-fixable:** Yes — convert to Groovy and relocate

**Detect:** Any `.java` file under `src/main/java/` after migration

**Why it matters:** Provisioned IM does not compile Java sources — classes must be Groovy under `src/main/resources/repo/classes/`.

**Fix:** Convert each `.java` → `.groovy`, move to `src/main/resources/repo/classes/{package}/`. See `migrate-manual-to-provisioned-java-code` for the mechanical conversion rules and the package/import rename tables.

---

## Camel 3 → 4 syntax

### AP-20 — Old property placeholder syntax `${pfx:...}`

- **Severity:** Important
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** Yes (mechanical text replace)

**Detect:** `${pfx:` in route XML files

**Why it matters:** Camel 4 uses `{{...}}` placeholder syntax; `${...}` is the Simple-expression syntax and no longer works as a property placeholder.

**Fix:** Replace `${pfx:` with `{{pfx:` and the matching closing `}` with `}}`.

### AP-21 — `<inOnly>` / `<inOut>` elements

- **Severity:** Critical
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** Yes

**Detect:** `<inOnly\|inOut uri=` in route XML

**Why it matters:** These elements were removed in Camel 4 in favour of explicit `pattern` attributes on `<to>`.

**Fix:** `<inOnly uri="X"/>` → `<to uri="X" pattern="InOnly"/>`. Same for `<inOut>` → `pattern="InOut"`.

### AP-22 — `*Ref` attributes on EIPs

- **Severity:** Critical
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** Yes — drop the `Ref` suffix

**Detect:** `executorServiceRef=`, `aggregationRepositoryRef=`, `onRedeliveryRef=`, `redeliveryPolicyRef=`, `routePolicyRef=`, `strategyRef=`, etc., on any EIP element

**Why it matters:** Renamed in Camel 4 — the `Ref` suffix was dropped from every attribute.

**Fix:** Strip the `Ref` suffix on each matching attribute (e.g. `executorServiceRef="X"` → `executorService="X"`).

### AP-23 — `<routeContext>` wrapper

- **Severity:** Critical
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** Yes — strip the wrapper

**Detect:** `<routeContext` or `</routeContext>` in XML

**Why it matters:** The `<routeContext>` wrapper was removed in Camel 4 — files use `<routes>` root only.

**Fix:** Remove the `<routeContext id="...">` opening tag and the matching `</routeContext>` closing tag. Routes go directly inside `<routes>`.

### AP-24 — `vm:` or `direct-vm:` URI scheme

- **Severity:** Critical
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** Yes

**Detect:** `vm:` or `direct-vm:` in `uri=` attributes

**Why it matters:** Both components were removed in Camel 4.

**Fix:** `vm:` → `seda:`, `direct-vm:` → `direct:`. Adjust any options that don't carry over.

### AP-25 — `transferException=true` on `http` / `http4`

- **Severity:** Important
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** No — security-relevant; needs developer review

**Detect:** `transferException=` in `uri=` for `http:` / `http4:` / `https:` endpoints

**Why it matters:** Removed in Camel 3 for security (it deserialised exceptions over the wire).

**Fix:** Catch the exception on the producer side using `<doTry>` / `<onException>` and rethrow as needed.

### AP-26 — `tracerEnabled=` on a route

- **Severity:** Important
- **Applies to:** `6→7`, `manual→provisioned`
- **Auto-fixable:** No — needs alternative tracer config

**Detect:** `tracerEnabled=` attribute on a `<route>` element

**Why it matters:** Removed in Camel 3 — route-level tracing is no longer a thing.

**Fix:** Configure tracing on the `CamelContext` itself, or attach a route policy. See Camel 4 tracer docs.

---

## Code modernization

### AP-27 — `javax.*` imports

- **Severity:** Critical
- **Applies to:** `5→6`, `manual→provisioned` (when Spring Boot 2 → 3)
- **Auto-fixable:** Yes (with revert list for packages that stayed on `javax`)

**Detect:** `import javax\.` in Java/Groovy files and `<groovy>` script blocks

**Why it matters:** Spring Boot 3.x (Jakarta EE 9) renamed `javax.*` → `jakarta.*` for most platform packages.

**Fix:** Bulk replace `import javax.` → `import jakarta.`. Then **revert** these packages back (they stayed on `javax`):

| Keep as `javax.*` |
|---|
| `javax.sql.*` |
| `javax.crypto.*` |
| `javax.security.auth.*` |
| `javax.xml.transform.*`, `javax.xml.parsers.*`, `javax.xml.stream.*` |
| `javax.naming.*` |
| `javax.management.*` |
| `javax.net.ssl.*` |

---

## Route structure

### AP-3 — Missing `streaming="true"` on splits

- **Severity:** Critical
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes

**Detect:** `<split>` without `streaming="true"` paired with `<tokenize token="\n"/>` (or preceded by `pfx-csv:unmarshal`)

**Why it matters:** OutOfMemoryError on files larger than 100MB — the full file is loaded into memory before any record is emitted.

**Fix:**
```xml
<!-- Before -->
<split>
    <tokenize group="..." token="\n"/>

<!-- After -->
<split streaming="true">
    <tokenize group="..." token="\n"/>
```

### AP-8 — Inline Groovy > 15 lines

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** No — needs developer judgement on what to extract

**Detect:** `<groovy>` or `<script language="groovy">` block longer than 15 lines

**Why it matters:** No IDE support, no unit tests, hard to debug, hard to review.

**Fix:** Extract the block into a Groovy class under `src/main/resources/repo/classes/`, reference via `<to uri="bean:..."/>`.

### AP-10 — Routes > 200 lines

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** No — needs developer judgement on the split

**Detect:** Route XML files longer than 200 lines

**Why it matters:** High blast radius on edits — touching one branch risks breaking the rest.

**Fix:** Split into sub-routes via `direct:` endpoints. One logical operation per file.

### AP-11 — Missing flush on DMDS

- **Severity:** Critical
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes — relocate the flush

**Detect:** Route with `pfx-api:loaddata objectType=DMDS` that has no `pfx-api:flush` after the `</split>`, or that has the flush INSIDE the split

**Why it matters:** Without a final flush after the split closes, partial data is visible in PA and calculations run on incomplete data.

**Fix:** Move `pfx-api:flush` after `</split>` (or place it inside `<onCompletion>`). Use `dataFeedName=DMF.{name}` and `dataSourceName=DMDS.{name}`.

### AP-13 — `split+tokenize+loaddata` for P/PX/CX/C imports

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes — rewrite to `loaddataFile`

**Detect:** Route with `<split>` + `<tokenize>` + `pfx-api:loaddata` for `objectType` P/PX/CX/C (**NOT** DMDS — DMDS imports legitimately need the split pattern)

**Why it matters:** `loaddataFile` handles batching internally. The legacy pattern is more code, slower (per-row JSON), and easier to get wrong.

**Fix:** Replace the entire `<split>` block with:
```xml
<to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true&amp;delimiter=,"/>
<to uri="pfx-api:loaddataFile?objectType={TYPE}&amp;mapper={mapper}&amp;batchSize=500000"/>
```
Preserve any logging steps before/after the import. Remove unused aggregation strategy beans.

---

## File handling

### AP-6 — Missing error handling on file routes

- **Severity:** Critical
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes — add `moveFailed=`

**Detect:** File route (`from uri="file://`) that has neither `moveFailed=` (or `{{error.file}}`) nor `<doCatch>` / `<onException>`

**Why it matters:** Silent failures with no audit trail.

**Fix:** Add `moveFailed=` to the file URI or wrap the body in `<doTry>` / `<doCatch>`. Combined fix with AP-7:
```xml
<from uri="file://{{integration.sftp.root}}/input/route-name
    ?move=../archive/${date:now:yyyyMMdd}/${file:name}
    &amp;moveFailed=../error/${file:name}"/>
```

### AP-7 — No archive folder on file routes

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes — add `move=`

**Detect:** File route without `move=` / `{{archive.file}}` on the file URI

**Why it matters:** No ability to reprocess; no audit trail of what was consumed.

**Fix:** Add `move=` (see AP-6 example for the combined URI).

### AP-14 — `pfx-sftp` with `default-sftp-connection`

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes

**Detect:** `pfx-sftp:` URI with `connection=default-sftp-connection` (or any connection name starting with `default-sftp-connection`)

**Why it matters:** The default SFTP connection points at the IM pod's own locally-mounted storage. Going through the SFTP protocol to read those files adds unnecessary protocol overhead — `file://` reads them directly.

**Fix:** `pfx-sftp://{path}?connection=default-sftp-connection&...` → `file://{{integration.sftp.root}}/{path}?...`. Preserve the file-component options (`delete=`, `moveFailed=`, etc.).

### AP-17 — Old path placeholder

- **Severity:** Important
- **Applies to:** `manual→provisioned`
- **Auto-fixable:** Yes

**Detect:** `{{integration.data}}` or `{{data.directory}}` in any `uri=` attribute

**Why it matters:** Both placeholders are deprecated — provisioned IM uses `{{integration.sftp.root}}`.

**Fix:** Replace `{{integration.data}}` and `{{data.directory}}` with `{{integration.sftp.root}}`.

### AP-19 — `noop=true` on a file consumer

- **Severity:** Critical
- **Applies to:** `version-independent`
- **Auto-fixable:** No — developer must decide the archive/delete policy

**Detect:** `noop=true` on a `from uri="file://..."/>`

**Why it matters:** `noop=true` neither moves nor deletes processed files, so they are picked up forever on every poll. No archive, no reprocessing semantics.

**Fix:** Replace with explicit `move=.archive/...` and `moveFailed=.error/...`, or `delete=true` if the file is genuinely throwaway.

---

## Properties & connections

### AP-5 — Hardcoded values not using `{{pfx:...}}`

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** No — needs property extraction + naming

**Detect:** Numeric literals in `<tokenize group=...>`, hostnames/IPs/cron literals in `uri=` attributes

**Why it matters:** No way to configure per environment without redeploying the route XML.

**Fix:** Extract to `application-{env}.properties`, reference via `{{pfx:property.name}}` or `{{property.name}}`.

### AP-12 — Old connection format (property-based Pricefx)

- **Severity:** Important
- **Applies to:** `manual→provisioned`, `6→7`
- **Auto-fixable:** Yes — create JSON file, remove properties

**Detect:** `pfx-api:*` calls relying on `integration.pfx.*` properties in `application.properties` when no `connections/pricefx.json` exists

**Why it matters:** Properties-based Pricefx connections are deprecated in IM 7.x provisioned setup. Provisioned IM expects JSON connection files.

**Fix:** Create `src/main/resources/repo/connections/pricefx.json` with the corresponding fields from the legacy `integration.pfx.*` keys. Move the password to `src/main/resources/local-secret.properties`. Remove the `integration.pfx.*` entries from `application.properties`.

### AP-15 — Redundant `connection=pricefx`

- **Severity:** Nice-to-have
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes (when `pricefx` is the only Pricefx connection)

**Detect:** Any `pfx-api:*`, `pfx-model:*`, `pfx-csv:*`, `pfx-config:*` URI with `connection=pricefx`

**Why it matters:** `pricefx` is the default connection name — repeating it adds noise and misleads readers.

**Fix:** Remove `connection=pricefx` from each matching URI. Only apply when there is a single `PriceFxConnection` and it is named `pricefx`.

### AP-16 — Route ID with `pfx:` prefix

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes

**Detect:** Route id starting with `pfx:` (e.g. `id="pfx:import-products"`)

**Why it matters:** Non-standard prefix; breaks monitoring tools that key off the route id.

**Fix:** Strip the `pfx:` prefix from the route id and any references (`<to uri="direct:pfx:foo">` → `<to uri="direct:foo">`).

### AP-18 — `extensionName` parameter on `pfx-api`

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** Yes — remove parameter; ensure mapper/filter has `name`

**Detect:** `pfx-api:fetch`, `pfx-api:loaddata`, or `pfx-api:loaddataFile` URI with `extensionName=...`

**Why it matters:** `extensionName` is silently ignored — there is no such parameter on `pfx-api`. The extension table name belongs in the **mapper** (`<constant out="name">`) for imports or in the **filter** (`<criterion fieldName="name" ...>`) for exports.

**Fix:** Remove `extensionName=` from the URI. For imports, add `<constant expression="{table}" out="name"/>` to the mapper. For exports, add `<criterion fieldName="name" operator="equals" value="{table}"/>` to the filter.

---

## Quality & naming

### AP-4 — Copy-pasted `apiSettings` parser

- **Severity:** Important
- **Applies to:** `version-independent`
- **Auto-fixable:** No — extraction to shared bean is a developer call

**Detect:** `<groovy>` blocks across multiple routes that all assign `apiSettings` with slight variations

**Why it matters:** Silent bugs when partial copies diverge over time.

**Fix:** Extract the canonical parser into a Groovy class under `src/main/resources/repo/classes/`. Reference via `<to uri="bean:..."/>` from every route.

### AP-9 — Inconsistent naming

- **Severity:** Nice-to-have
- **Applies to:** `version-independent`
- **Auto-fixable:** No — requires file renames + cross-reference updates

**Detect:** Route ids mixing camelCase / kebab-case / PascalCase in the same project

**Why it matters:** Maintenance and onboarding friction.

**Fix:** Pick one convention (recommend kebab-case) and apply to route ids and file names. Update any cross-references.
