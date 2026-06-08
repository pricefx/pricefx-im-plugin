---
name: migrate-manual-to-provisioned-camel-syntax
description: Use when migrating from manual to provisioned and the source project uses Apache Camel 3.3.5 patterns that break on Camel 4.1+ — `${pfx:foo}` property placeholders, `<inOnly>` / `<inOut>` / `<routeContext>` elements, `setHeader headerName=` / `setProperty propertyName=` / any `*Ref` attributes, `quartz2:` / `aws-s3:` / `direct-vm:` / `vm:` URI schemes, bare bean URIs without `bean:` prefix, Java import package renames, application property key renames, Pricefx API method signature renames, or `useList=` / `synchronous=` / `startDelayedSeconds=` / `transferException=` / `tracerEnabled=` / `LoggingLevel.OFF` options.
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
| Camel 4.0+ | Skip Step 1 #1 (`quartz2`) and #6 (`aws-s3`); skip Step 2 (`*Ref` renames); skip Step 4 #4a/#4b (`<inOnly>`/`<inOut>` were already removed in 3.x). Still run the `${pfx:foo}` → `{{pfx:foo}}` rewrite (often missed across migrations). Still run Step 8 reports. |
| Unknown | Run full set; flag in the report that the source Camel version was unknown |

## Step 1: Simple-Expression and Attribute Renames

Walk all files under `$TARGET_DIR/src/` (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`, `.settings/`, `.vscode/`, `.github/`). For each replacement, first list the affected files, ask for confirmation, then apply.

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

## Step 3: Bean URI Prefix

Scan all `*.xml` files for `<to uri="..."/>` and `<toD uri="..."/>` elements where the URI value contains **no `:` character** — these are bare bean references that require the `bean:` scheme prefix in Camel 4.

Detection regex: `(<toD? uri=")([^:"]+)(".*/>)`

Replace with: `$1bean:$2$3`

Do **not** apply if the URI already contains `:` (i.e. it already has a scheme such as `direct:`, `activemq:`, `pfx-api:`, etc.).

## Step 4: Removed XML Elements

These elements no longer exist in Camel 4 — rewrite them:

### 4a — `<unmarshal ref="X"/>` → inline data format

In Camel 3 the `ref` attribute on `<unmarshal>` (and `<marshal>`) pointed to a named data-format bean defined in `<dataFormats>` or as a Spring bean. Camel 4 removed `ref` — the data format must be declared inline.

Detection: `<unmarshal ref="([^"]+)"/>`

Replacement depends on the ref name:

| `ref` value | Inline replacement |
|---|---|
| `jackson-xml` | `<unmarshal><jacksonXml/></unmarshal>` |
| `jackson` / `json-jackson` | `<unmarshal><json library="Jackson"/></unmarshal>` |
| `csv` | `<unmarshal><csv/></unmarshal>` |
| `jaxb` | `<unmarshal><jaxb contextPath="com.example"/></unmarshal>` (contextPath must be set — flag for review) |
| Any other ref | Flag for manual review — look up the bean definition in the source project to determine the correct inline element |

Same rule applies to `<marshal ref="X"/>`.

### 4b — `<inOnly uri="X"/>` → `<to uri="X" pattern="InOnly"/>`

Detect: `<inOnly\s+uri="([^"]+)"\s*/>`
Replace with: `<to uri="$1" pattern="InOnly"/>`

### 4c — `<inOut uri="X"/>` → `<to uri="X" pattern="InOut"/>`

Detect: `<inOut\s+uri="([^"]+)"\s*/>`
Replace with: `<to uri="$1" pattern="InOut"/>`

### 4d — `<routeContext id="X">...</routeContext>` wrapper

In Camel 4 routes XML, the `<routeContext>` wrapper has been replaced by the file-level `<routes>` root. The extraction skill (`migrate-manual-to-provisioned-routes`) already removes this wrapper by re-emitting each route inside its own `<routes>` root, but if any leftover `<routeContext>` element remains in TARGET_DIR (e.g. inside a bean XML or a partially-migrated file), strip the wrapper:
- Replace `<routeContext\s+id="[^"]+">` with empty string
- Replace `</routeContext>` with empty string

### 4e — `<routeContextRef ref="X"/>` references

`<routeContextRef ref="X"/>` was the Camel-3 way to import a routeContext defined in another file (typical inside `<camelContext>...</camelContext>` in `camel-context.xml`). Camel 4 has no `routeContext` and provisioned IM auto-discovers routes from `repo/routes/`, so every `<routeContextRef>` becomes dead config.

- Detect: `<routeContextRef\s+ref="[^"]+"\s*/>`
- Replace with: empty string (delete the line)

After deletion, the `<camelContext>` block in the target's `camel-context.xml` may end up almost empty. That's expected — provisioned IM does not need a `<camelContext>` declaration at all (it's auto-configured), so the file can be removed entirely once empty. Flag this in the report.

### 4f — `<setBody><expression><simple>...</simple></expression></setBody>` (verbose form)

Camel 4 simplified the inline-language form. The verbose `<expression><simple>...</simple></expression>` wrapper is still accepted, but the recommended form is just `<simple>...</simple>` directly inside `<setBody>` / `<setHeader>` / `<filter>` / `<when>`.

This is **report-only** (the verbose form still works) — flag the affected files so the developer can simplify if desired.

## Step 5: Java / Groovy Import Renames

Scan all `*.java` and `*.groovy` files under `$TARGET_DIR/src/`. Apply the following import replacements (exact-string, whole-line match):

| Old import | New import |
|---|---|
| `import com.sun.jersey.api.client.GenericType;` | `import javax.ws.rs.core.GenericType;` |
| `import io.swagger.client.ApiClient;` | `import net.pricefx.integration.api.ApiClient;` |
| `import io.swagger.client.ApiException;` | `import net.pricefx.integration.api.ApiException;` |
| `import io.swagger.client.Pair;` | `import net.pricefx.integration.api.Pair;` |
| `import net.pricefx.integration.mapper.converter.Converter;` | `import net.pricefx.integration.api.converter.Converter;` |
| `import net.pricefx.integration.connection.PartitionConnectionFactory;` | `import net.pricefx.integration.connection.service.ConnectionLookup;` |
| `import net.pricefx.integration.api.client.ApiClientRequestBuilder;` | **Do NOT auto-rewrite — flag for review.** The IMigrator's original mapping to `ApiResponse` is wrong (the classes are unrelated). The correct replacement depends on call-site intent; refer to IM 7.x javadoc. |
| `import org.apache.camel.processor.aggregate.AggregationStrategy;` | `import org.apache.camel.AggregationStrategy;` |
| `import net.pricefx.integration.component.producer.ProducerUtils;` | `import net.pricefx.integration.util.ProducerUtils;` |
| `import org.apache.commons.lang.Validate;` | `import org.apache.commons.lang3.Validate;` |
| `import org.apache.commons.lang.StringUtils;` | `import org.apache.commons.lang3.StringUtils;` |
| `import org.apache.commons.collections.MapUtils;` | `import org.apache.commons.collections4.MapUtils;` |
| `import org.apache.commons.collections.CollectionUtils;` | `import org.apache.commons.collections4.CollectionUtils;` |
| `import org.apache.commons.collections.ListUtils;` | `import org.apache.commons.collections4.ListUtils;` |
| `import org.apache.commons.collections.SetUtils;` | `import org.apache.commons.collections4.SetUtils;` |
| `import org.apache.commons.collections.` (any other suffix) | `import org.apache.commons.collections4.` (same suffix) |

Also replace `javax.` → `jakarta.` in all `*.java` and `*.groovy` files (package rename for the Jakarta EE migration in Java 17+). Be careful not to apply this inside string literals that reference the old javax namespace for backward-compat reasons — flag those for manual review.

## Step 6: Application Properties Renames

Scan all `application-*.properties` files under TARGET_DIR. Replace these property key names (left side of `=`):

| Old key | New key |
|---|---|
| `server.port` | `integration.server.port` |
| `spring.security.user.name` | `integration.user` |
| `spring.security.user.password` | `integration.password` |
| `spring.application.name` | `integration.name` |
| `application.context` | `integration.context` |

## Step 7: Other XML and Code Fixes

### 7a — Event-route bean property rename

In bean XML files, replace:

```
<property name="priceFxClient"
```
with:
```
<property name="priceFxConnection"
```

### 7b — Mapper `<pfx:simple>` → `<pfx:constant>`

In mapper files (`*.xml` under `repo/mappers/`), the `<pfx:simple expression=...>` element was renamed to `<pfx:constant expression=...>`. Replace:

```
<pfx:simple expression
```
with:
```
<pfx:constant expression
```

### 7c — Pricefx API method signature renames

In all `*.java` and `*.groovy` files, replace the following method call fragments (these are exact-string replacements on the call site):

| Old | New |
|---|---|
| `.getDatamartApi().getdataloads(` | `.getDatamartApi().datamartGetdataloads(` |
| `.getGeneralApi().asyncForcefilter(` | `.getGeneralApi().deleteAsyncBatchTypecode(` |
| `.getGeneralApi().fetchByTypeCode(` | `.getGeneralApi().fetchByTypeCodeTypecode(` |
| `.getFormulaApi().executeformula(` | `.getFormulaApi().formulamanagerExecuteformulaFormulaname(` |
| `.getDatamartApi().massedit(` | `.getDatamartApi().datamartMasseditTypeid(` |
| `.getDatamartApi().getfcs(` | `.getDatamartApi().datamartGetfcsFCtype(` |
| `.getLookuptableApi().fetchTable(` | `.getLookuptableApi().lookuptablemanagerFetchTable(` |
| `.getContractApi().save(` | `.getContractApi().contractmanagerSave(` |
| `.getDatamartApi().fetch(` | `.getDatamartApi().datamartFetchObjectid(` |
| `.getLookuptableApi().fetchValue(` | `.getLookuptableApi().lookuptablemanagerFetchValueTableid(` |
| `.getLookuptableApi().integrate(` | `.getLookuptableApi().lookuptablemanagerIntegrateTableid(` |
| `.getGeneralApi().loaddata(` | `.getGeneralApi().loaddataTypecode(` |
| `.getContractApi().fetch(` | `.getContractApi().contractmanagerFetchContractid(` |
| `.getPricegridApi().updupdateItems(` | `.getPricegridApi().pricegridmanagerUpdateItemsPGid(` |
| `.getPricegridApi().fetchItems(` | `.getPricegridApi().pricegridmanagerFetchItemsPGid(` |

## Step 8: Report-Only Warnings (manual action required)

These are anti-patterns or removed features. Do **not** auto-fix — the right replacement depends on intent.

| Pattern | Where | Hint |
|---|---|---|
| `useList=` parameter | route XMLs | Removed in Camel 3. Lists are the default. Remove the parameter. |
| `synchronous=` parameter on `pfx-*` | route XMLs | Producers are synchronous by default in IM 7.x. Remove. |
| `startDelayedSeconds=` parameter on `quartz` | route XMLs | Not a valid Quartz parameter. Use `triggerStartDelay=` (ms) or `cron=`. |
| `transferException=true` parameter on `http`/`http4` | route XMLs | Removed for security in Camel 3.x. Catch the exception locally instead. |
| `tracerEnabled=` route attribute | route XMLs | Route-level tracing removed in Camel 3. Configure via `CamelContext` or a route policy. |
| `<log loggingLevel="OFF"/>` | route XMLs | `OFF` removed from `LoggingLevel` enum. Use `TRACE` (or remove the `<log>`). |
| Verbose `<setBody><expression><simple>...</simple></expression></setBody>` | route XMLs | Simplify to `<setBody><simple>...</simple></setBody>` (covered in Step 4e). |
| `org.joda` import | Java/Groovy | `joda-time` removed. Use `java.time` or Camel Simple `${date:now-24h}`. |
| `@Autowired` annotation | Java/Groovy | Discouraged in IM 7.x sandbox. Use constructor injection or `connectionLookup`. |
| `@PropertyInject` annotation | Java/Groovy | Removed. Use Camel Simple `${properties:my.key}` in routes, or `@Value` in Spring beans. |
| `<process ref="..."/>` to a bean defined inside `<camelContext>` | route XMLs | Camel 4 prefers `<to uri="bean:processorId"/>` to reference a Spring bean. |
| `errorHandlerRef=` attribute on `<camelContext>` / `<route>` | route XMLs | Camel 4 still accepts `errorHandlerRef` for backward compatibility, but the modern attribute name is `errorHandler`. Rename when convenient. |
| `<dataFormats>` block at the `<camelContext>` level | `camel-context.xml` | In provisioned IM there is no `<camelContext>` to attach `<dataFormats>` to. Move the inline data-format definitions into individual routes (`<marshal><jacksonxml/></marshal>`) or extract to a bean. |
| `<contextScan/>` element | `camel-context.xml` | Provisioned IM doesn't scan a Spring bean context for routes — it discovers them in `repo/routes/`. Remove the element. |
| `PartitionConnectionFactory.getPriceFxClient` | Java/Groovy | Change to `ConnectionLookup.lookupPriceFx(...)` with `.getClient()` appended. Import also needs updating (covered in Step 5). |
| `integration.logging.file` property | `application-*.properties` | Overriding the logging file path can cause problems in IM 7.x. Remove this property. |
| `com.sun.jersey.api.client.ClientHandlerException` | `application-*.properties` (error handler config) | Invalid class for Camel error handling in this version. Replace with a valid exception class (e.g. `java.lang.Exception`). |

For each pattern found, list the affected files and the suggestion.

## Step 9: POM and Properties Audit

### 9a — Unwanted pom.xml dependencies

Scan `pom.xml` files for these artifact IDs that must be removed or replaced:

| Dependency | Action |
|---|---|
| `quartz2` | Remove — superseded by `camel-quartz` |
| `camel-aws-starter` | Remove — superseded by `camel-aws2-s3` / `camel-aws2-*` starters |

Report affected `pom.xml` lines; do not auto-modify the POM (dependency changes must be reviewed by the developer).

### 9b — Required application properties

Each `application-*.properties` file should contain the following keys. Report any that are missing:

```
spring.cloud.config.enabled
application.context
integration.context=classpath*:camel-context.xml
integration.name=
integration.event-driven.auto-registration.pfx-cluster
integration.monitoring.enabled=true
integration.logstash.enabled=true
integration.logstash.address=elkint.pricefx.eu:4560
integration.server.port
integration.security.allowed-paths=/home,/var/pricefx
```

## Step 10: Report

```
Camel-syntax modernization summary (3.3.5 → 4.1+)
=================================================

Auto-fixes applied:
  Simple-expression renames (Step 1):
    quartz2 → quartz                          N file(s)
    ${property[x]} → ${exchangeProperty[x]}   N file(s)
    ${property.x} → ${exchangeProperty.x}     N file(s)
    setHeader headerName → name               N file(s)
    setProperty propertyName → name           N file(s)
    aws-s3:// → aws2-s3://                    N file(s)
    direct-vm: → direct:                      N file(s)
    vm: → seda:                               N file(s)
    ${pfx:foo} → {{pfx:foo}}                  N file(s)

  *Ref → non-Ref attributes (Step 2):
    strategyRef → aggregationStrategy         N file(s)
    executorServiceRef → executorService      N file(s)
    aggregationRepositoryRef → ...            N file(s)
    onRedeliveryRef → onRedelivery            N file(s)
    redeliveryPolicyRef → redeliveryPolicy    N file(s)
    routePolicyRef → routePolicy              N file(s)
    marshallerRef / unmarshallerRef           N file(s)
    (other Ref renames)                       N file(s)

  Bean URI prefix added (Step 3):            N occurrence(s)

  Removed elements rewritten (Step 4):
    <inOnly uri=...> → <to ... pattern="InOnly">   N occurrence(s)
    <inOut uri=...>  → <to ... pattern="InOut">    N occurrence(s)
    <routeContext> wrapper stripped                 N occurrence(s)

  Java/Groovy import renames (Step 5):       N file(s)
  javax. → jakarta. (Step 5):               N file(s)

  Application property key renames (Step 6): N file(s)

  Other XML/code fixes (Step 7):
    priceFxClient → priceFxConnection bean   N file(s)
    <pfx:simple expression → <pfx:constant   N file(s)
    API method signature renames             N file(s)

Manual action required (Step 8):
  useList=:                                  [files]
  synchronous=:                              [files]
  startDelayedSeconds=:                      [files]
  transferException=:                        [files]
  tracerEnabled=:                            [files]
  <log loggingLevel="OFF">:                 [files]
  Verbose <expression><simple> form:         [files]
  org.joda imports:                          [files]
  @Autowired annotations:                    [files]
  @PropertyInject annotations:               [files]
  PartitionConnectionFactory.getPriceFxClient: [files]
  integration.logging.file property:         [files]
  invalid error handling exception class:    [files]

POM / properties audit (Step 9):
  Unwanted pom.xml deps (quartz2, camel-aws-starter): [files]
  Missing required application property keys:         [per-file list]
```

## Rules

- **Always confirm before applying** — show affected files, ask `proceed?`, then write.
- **Never apply replacements inside `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`.**
- **Idempotent.** Running the skill twice should be a no-op on a clean target.
- The `property[` / `${property.X}` / `${pfx:X}` rewrites apply to Camel Simple / property-placeholder expressions — be careful inside attribute values that mix Simple and literal text. When in doubt, escape and ask.
- The `vm:` → `seda:` rewrite is a semantic change (process-wide vs route-context-wide queue). Both are in-JVM, but `vm:` was shared across all CamelContexts in the JVM — IM does not run multiple contexts in one JVM, so the change is safe in practice. Note this in the report.
- The `direct-vm:` → `direct:` rewrite is similar; flag any usage so the developer confirms.
- Do NOT rewrite `${pfx:` if the closing `}` cannot be unambiguously located on the same line (e.g. multi-line constructs); flag those for manual review.
