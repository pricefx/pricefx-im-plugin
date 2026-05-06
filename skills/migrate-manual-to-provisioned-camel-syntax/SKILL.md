---
name: migrate-manual-to-provisioned-camel-syntax
description: Apply mechanical Apache Camel syntax fixes for the Camel 3.3.5 → 4.1+ upgrade — Simple-expression renames (property[]→exchangeProperty[]), attribute renames (setHeader headerName→name, setProperty propertyName→name, all `*Ref`→non-Ref), removed elements (`<inOnly>`, `<inOut>`, `<routeContext>` wrapper), property-placeholder syntax (`${pfx:foo}`→`{{pfx:foo}}`), URI-scheme renames (quartz2→quartz, aws-s3→aws2-s3, direct-vm→direct, vm→seda), plus reports for `useList=`, `synchronous=`, `startDelayedSeconds=`, `transferException=`, `tracerEnabled=`, `LoggingLevel.OFF`, `org.joda`, `@Autowired`, `@PropertyInject`.
---

# Migrate Manual → Provisioned: Camel Syntax (3.3.5 → 4.1+)

You are applying mechanical Camel syntax modernizations to every file in the target project. These are the safe, idempotent search-and-replace operations needed to take a Camel 3.3.5-era project to Camel 4.1+ (the IM 7.x baseline). They apply across route XML, mappers, filters, beans, properties, Java, and Groovy files.

**This skill assumes** the extraction skills (`migrate-manual-to-provisioned-routes`, `-mappers`, `-filters`, `-beans`, `-connections`) have already run, so the artifacts to modernise are in TARGET_DIR.

## Inputs

- **TARGET_DIR** — current working directory (provisioned project). Files are modified in place.
- **SRC_CAMEL** (optional) — source Camel version detected by the orchestrator (e.g. `3.3.5`, `3.20`, `4.1`). When passed, gate the work by this version (skip rewrites that don't apply to the source line).
- **TGT_CAMEL** (optional) — target Camel version (e.g. `4.4`).

If neither is set, run the full rewrite set.

## Version-gated behavior

| Source line | What runs |
|---|---|
| Camel 2.x | Full set + warn that `streaming="true"` was added in 2.18 (so older patterns may need it added by hand) |
| Camel 3.x (any) | Full set — every Camel-3→4 fix |
| Camel 4.0+ | Skip Step 1 #1 (`quartz2`) and #6 (`aws-s3`); skip Step 2 (`*Ref` renames); skip Step 3 #3a/#3b (`<inOnly>`/`<inOut>` were already removed in 3.x). Still run the `${pfx:foo}` → `{{pfx:foo}}` rewrite (often missed across migrations). Still run Step 4 reports. |
| Unknown | Run full set; flag in the report that the source Camel version was unknown |

## Step 1: Simple-Expression and Attribute Renames

Walk all files under `$TARGET_DIR/src/` (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`). For each replacement, first list the affected files, ask for confirmation, then apply.

| # | Search | Replace | Files | Why |
|---|---|---|---|---|
| 1 | `quartz2` | `quartz` | `*.xml`, `*.properties`, `*.java`, `*.groovy` | `camel-quartz2` was merged back into `camel-quartz` in Camel 3.x |
| 2 | `property[` | `exchangeProperty[` | `*.xml` | Camel 3 renamed `${property[x]}` to `${exchangeProperty[x]}` |
| 3 | Simple `${property.X}` | `${exchangeProperty.X}` | `*.xml` | Same rename in dotted form. Use regex: `\$\{property\.([a-zA-Z0-9_]+)\}` → `${exchangeProperty.$1}` (do **not** do a blind `property.` → `exchangeProperty.` rewrite — `property.` may legitimately appear in Spring property keys or comments) |
| 4 | `setHeader headerName=` | `setHeader name=` | `*.xml` | Attribute renamed in Camel 3 |
| 5 | `setProperty propertyName=` | `setProperty name=` | `*.xml` | Same |
| 6 | `aws-s3://` | `aws2-s3://` | `*.xml`, `*.properties` | `camel-aws-s3` was renamed to `camel-aws2-s3` in Camel 3.x |
| 7 | `direct-vm:` | `direct:` | `*.xml`, `*.java`, `*.groovy` | `camel-direct-vm` component removed in Camel 4 |
| 8 | `vm:` | `seda:` | `*.xml`, `*.java`, `*.groovy` | `camel-vm` component removed in Camel 4 (only `seda:` remains for in-JVM in-memory queues) |
| 9 | `${pfx:` | `{{pfx:` (and matching `}` → `}}`) | `*.xml` | Property placeholder syntax must be `{{...}}` in Camel 3+/4. The `${...}` Simple-expression syntax only resolves Simple variables, not properties. Apply only to property-placeholder uses; never to `${body}`, `${header.X}`, `${date:...}`, `${exchangeProperty.X}`, etc. Detect the matching closing `}` token and replace it with `}}` (regex: `\$\{(pfx:[^}]+)\}` → `{{$1}}`) |

## Step 2: `*Ref` → non-Ref Attribute Renames

In Camel 3 → 4 the historical `*Ref` attributes (Spring-bean references) lost their `Ref` suffix. Scan all `*.xml` files in TARGET_DIR for these attribute name occurrences and rename:

| Old | New |
|---|---|
| `strategyRef=` | `aggregationStrategy=` |
| `executorServiceRef=` | `executorService=` |
| `aggregationRepositoryRef=` | `aggregationRepository=` |
| `messageIdRepositoryRef=` | `messageIdRepository=` |
| `comparatorRef=` | `comparator=` |
| `onRedeliveryRef=` | `onRedelivery=` |
| `onExceptionOccurredRef=` | `onExceptionOccurred=` |
| `redeliveryPolicyRef=` | `redeliveryPolicy=` |
| `retryWhileRef=` | `retryWhile=` |
| `onPrepareFailureRef=` | `onPrepareFailure=` |
| `marshallerRef=` | `marshaller=` |
| `unmarshallerRef=` | `unmarshaller=` |
| `routePolicyRef=` | `routePolicy=` |
| `customLoadBalancerRef=` | `customLoadBalancer=` |
| `processorRef=` | `processor=` |

These renames affect `<split>`, `<aggregate>`, `<enrich>`, `<pollEnrich>`, `<errorHandler>`, `<onException>`, `<dataFormats>`, `<resequencer>`, `<idempotentConsumer>`, `<routePolicy>`, `<loadBalance>`.

## Step 3: Removed XML Elements

These elements no longer exist in Camel 4 — rewrite them:

### 3a — `<inOnly uri="X"/>` → `<to uri="X" pattern="InOnly"/>`

Detect: `<inOnly\s+uri="([^"]+)"\s*/>`
Replace with: `<to uri="$1" pattern="InOnly"/>`

### 3b — `<inOut uri="X"/>` → `<to uri="X" pattern="InOut"/>`

Detect: `<inOut\s+uri="([^"]+)"\s*/>`
Replace with: `<to uri="$1" pattern="InOut"/>`

### 3c — `<routeContext id="X">...</routeContext>` wrapper

In Camel 4 routes XML, the `<routeContext>` wrapper has been replaced by the file-level `<routes>` root. The extraction skill (`migrate-manual-to-provisioned-routes`) already removes this wrapper by re-emitting each route inside its own `<routes>` root, but if any leftover `<routeContext>` element remains in TARGET_DIR (e.g. inside a bean XML or a partially-migrated file), strip the wrapper:
- Replace `<routeContext\s+id="[^"]+">` with empty string
- Replace `</routeContext>` with empty string

### 3d — `<setBody><expression><simple>...</simple></expression></setBody>` (verbose form)

Camel 4 simplified the inline-language form. The verbose `<expression><simple>...</simple></expression>` wrapper is still accepted, but the recommended form is just `<simple>...</simple>` directly inside `<setBody>` / `<setHeader>` / `<filter>` / `<when>`.

This is **report-only** (the verbose form still works) — flag the affected files so the developer can simplify if desired.

## Step 4: Report-Only Warnings (manual action required)

These are anti-patterns or removed features. Do **not** auto-fix — the right replacement depends on intent.

| Pattern | Where | Hint |
|---|---|---|
| `useList=` parameter | route XMLs | Removed in Camel 3. Lists are the default. Remove the parameter. |
| `synchronous=` parameter on `pfx-*` | route XMLs | Producers are synchronous by default in IM 7.x. Remove. |
| `startDelayedSeconds=` parameter on `quartz` | route XMLs | Not a valid Quartz parameter. Use `triggerStartDelay=` (ms) or `cron=`. |
| `transferException=true` parameter on `http`/`http4` | route XMLs | Removed for security in Camel 3.x. Catch the exception locally instead. |
| `tracerEnabled=` route attribute | route XMLs | Route-level tracing removed in Camel 3. Configure via `CamelContext` or a route policy. |
| `<log loggingLevel="OFF"/>` | route XMLs | `OFF` removed from `LoggingLevel` enum. Use `TRACE` (or remove the `<log>`). |
| Verbose `<setBody><expression><simple>...</simple></expression></setBody>` | route XMLs | Simplify to `<setBody><simple>...</simple></setBody>` (covered in 3d). |
| `org.joda` import | Java/Groovy | `joda-time` removed. Use `java.time` or Camel Simple `${date:now-24h}`. |
| `@Autowired` annotation | Java/Groovy | Discouraged in IM 7.x sandbox. Use constructor injection or `connectionLookup`. |
| `@PropertyInject` annotation | Java/Groovy | Removed. Use Camel Simple `${properties:my.key}` in routes, or `@Value` in Spring beans. |
| `<process ref="..."/>` to a bean defined inside `<camelContext>` | route XMLs | Camel 4 prefers `<to uri="bean:processorId"/>` to reference a Spring bean. |

For each pattern found, list the affected files and the suggestion.

## Step 5: Report

```
Camel-syntax modernization summary (3.3.5 → 4.1+)
=================================================

Auto-fixes applied:
  Simple-expression renames:
    quartz2 → quartz                     N file(s)
    ${property[x]} → ${exchangeProperty[x]} N file(s)
    ${property.x} → ${exchangeProperty.x}   N file(s)
    setHeader headerName → name             N file(s)
    setProperty propertyName → name         N file(s)
    aws-s3:// → aws2-s3://                  N file(s)
    direct-vm: → direct:                    N file(s)
    vm: → seda:                             N file(s)
    ${pfx:foo} → {{pfx:foo}}                N file(s)

  *Ref → non-Ref attributes:
    strategyRef → aggregationStrategy       N file(s)
    executorServiceRef → executorService    N file(s)
    aggregationRepositoryRef → ...          N file(s)
    onRedeliveryRef → onRedelivery          N file(s)
    redeliveryPolicyRef → redeliveryPolicy  N file(s)
    routePolicyRef → routePolicy            N file(s)
    marshallerRef / unmarshallerRef         N file(s)
    (other Ref renames)                     N file(s)

  Removed elements rewritten:
    <inOnly uri=...> → <to ... pattern="InOnly"/>      N occurrence(s)
    <inOut uri=...>  → <to ... pattern="InOut"/>       N occurrence(s)
    <routeContext> wrapper stripped                     N occurrence(s)

Manual action required:
  useList=:                            [files]
  synchronous=:                        [files]
  startDelayedSeconds=:                [files]
  transferException=:                  [files]
  tracerEnabled=:                      [files]
  <log loggingLevel="OFF">:            [files]
  Verbose <expression><simple> form:   [files]
  org.joda imports:                    [files]
  @Autowired annotations:              [files]
  @PropertyInject annotations:         [files]
```

## Rules

- **Always confirm before applying** — show affected files, ask `proceed?`, then write.
- **Never apply replacements inside `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`.**
- **Idempotent.** Running the skill twice should be a no-op on a clean target.
- The `property[` / `${property.X}` / `${pfx:X}` rewrites apply to Camel Simple / property-placeholder expressions — be careful inside attribute values that mix Simple and literal text. When in doubt, escape and ask.
- The `vm:` → `seda:` rewrite is a semantic change (process-wide vs route-context-wide queue). Both are in-JVM, but `vm:` was shared across all CamelContexts in the JVM — IM does not run multiple contexts in one JVM, so the change is safe in practice. Note this in the report.
- The `direct-vm:` → `direct:` rewrite is similar; flag any usage so the developer confirms.
- Do NOT rewrite `${pfx:` if the closing `}` cannot be unambiguously located on the same line (e.g. multi-line constructs); flag those for manual review.
