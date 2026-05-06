---
name: migrate-manual-to-provisioned-java-code
description: Move Java and Groovy custom code from a manual IM project into the provisioned `src/main/resources/repo/classes/` Groovy class folder, converting `.java` files to `.groovy`. Applies IM 7.x package/import renames (com.sun.jersey, io.swagger.client, commons-lang, AggregationStrategy, ProducerUtils), javax→jakarta with a keep-as-javax revert list, and Pricefx Java API method-signature renames.
---

# Migrate Manual → Provisioned: Java & Groovy Code

You are migrating custom code (beans, processors, predicates, aggregation strategies) from the manual IM layout (Java in `src/main/java/...`) into the provisioned IM layout (Groovy in `src/main/resources/repo/classes/...`). Provisioned IM does not compile Java sources — it loads Groovy classes at runtime through the Groovy sandbox. **All Java code therefore has to be converted to Groovy and placed under `classes/`.**

Java is mostly valid Groovy, so the conversion is mainly: rename, relocate, and apply IM 7.x package/method renames.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project; files written under `src/main/resources/repo/classes/`)
- **SRC_SB** (optional) — source Spring Boot version (e.g. `2.7`, `3.2`). When `>= 3.0`, skip the `javax.*` → `jakarta.*` rewrite — the source code is already on Jakarta.
- **SRC_IM** (optional) — source IM version. Used to gate the Pricefx API method-signature renames in Step 5 (those renames only apply going from IM 6.x → 7.x; if the source is already on IM 7.x, skip them).

## Step 1: Discover Source Code

Walk these locations in `$SOURCE_DIR` (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`):

- `src/main/java/**/*.java`
- `src/main/groovy/**/*.groovy`
- `src/main/resources/repo/classes/**/*.groovy` (already-provisioned-style code)
- `src/main/resources/repo/beans/**/*.groovy` (rare — Groovy in beans dir)

Capture the package path (e.g. `com.example.processor`) for each source file. The target path is:

```
$TARGET_DIR/src/main/resources/repo/classes/{package-dir}/{ClassName}.groovy
```

For example: `src/main/java/com/example/processor/PriceFilter.java` → `src/main/resources/repo/classes/com/example/processor/PriceFilter.groovy`.

If the source file already lives at `src/main/resources/repo/classes/...`, mirror the same relative path inside the target.

## Step 2: Convert `.java` → `.groovy`

For each `.java` source file, apply these mechanical conversions (in this order):

### 2a — Drop trailing semicolons on `package` and `import` lines

Groovy accepts both forms, but the convention in IM-provisioned classes is no trailing `;` on these declarations:

- `package com.example.foo;` → `package com.example.foo`
- `import com.example.Bar;` → `import com.example.Bar`
- `import static com.example.Util.foo;` → `import static com.example.Util.foo`

Leave `;` on regular statement lines as-is — Groovy accepts them, and stripping them risks breaking `for (init; cond; step)` loops.

### 2b — Drop redundant `public` on top-level class declarations

`public class Foo extends Bar` → `class Foo extends Bar`

Groovy classes are public by default. Same for methods that don't need to express their visibility:
- `public Foo()` (constructor) → `Foo()`
- Leave methods alone — `public`, `private`, `protected` all still apply when present.

### 2c — Flag (do not auto-rewrite) Java-only constructs

These need the developer's eyes. Report them — do NOT rewrite:

- **Lambdas** (`(x, y) -> x + y`). Groovy 3+ accepts lambdas, but the idiomatic form is a closure (`{ x, y -> x + y }`). Flag for review.
- **`var` local-variable inference** (`var x = ...`). Groovy uses `def x = ...` instead.
- **Diamond operator** (`new ArrayList<>()`). Groovy 3+ accepts this; Groovy 2.x does not. Flag if the IM version uses Groovy 2.x.
- **Anonymous inner classes** with a `@Override` annotation on the implementing method — the `@Override` works fine in Groovy, but `new Runnable() { ... }` syntax can confuse the parser if the surrounding context expects a closure.
- **Records** (Java 14+). Groovy has no `record` keyword. Convert to `@Canonical` or a plain class.
- **`final`** on local variables — works in Groovy but stylistically Groovy uses no modifier.
- **Switch-expressions** (`int x = switch (y) { ... }`). Groovy 4+ supports these; Groovy 3.x does not.

### 2d — File extension and location

Rename `.java` → `.groovy`. Move under `$TARGET_DIR/src/main/resources/repo/classes/{package}/`. Preserve the package directory structure.

## Step 3: Fix Imports

For every file now in `classes/` (both newly-converted and pre-existing Groovy), apply this exact-match replacement table to `import ...` lines (the trailing `;` may or may not be present after step 2a):

| Old import | New import |
|---|---|
| `import com.sun.jersey.api.client.GenericType` | `import jakarta.ws.rs.core.GenericType` |
| `import io.swagger.client.ApiClient` | `import net.pricefx.integration.api.ApiClient` |
| `import io.swagger.client.ApiException` | `import net.pricefx.integration.api.ApiException` |
| `import io.swagger.client.Pair` | `import net.pricefx.integration.api.Pair` |
| `import net.pricefx.integration.mapper.converter.Converter` | `import net.pricefx.integration.api.converter.Converter` |
| `import net.pricefx.integration.connection.PartitionConnectionFactory` | `import net.pricefx.integration.connection.service.ConnectionLookup` |
| `import net.pricefx.integration.api.client.ApiClientRequestBuilder` | (do NOT auto-rewrite — flag for review; the IMigrator's old mapping to `ApiResponse` was wrong because the classes are unrelated. The replacement depends on call-site intent: a request builder caller usually wants a different class than a response holder.) |
| `import org.apache.camel.processor.aggregate.AggregationStrategy` | `import org.apache.camel.AggregationStrategy` |
| `import net.pricefx.integration.component.producer.ProducerUtils` | `import net.pricefx.integration.util.ProducerUtils` |
| `import org.apache.commons.lang.Validate` | `import org.apache.commons.lang3.Validate` |
| `import org.apache.commons.lang.StringUtils` | `import org.apache.commons.lang3.StringUtils` |
| `import org.apache.commons.collections.MapUtils` | `import org.apache.commons.collections4.MapUtils` |
| `import org.apache.commons.collections.CollectionUtils` | `import org.apache.commons.collections4.CollectionUtils` |
| `import org.apache.commons.collections.ListUtils` | `import org.apache.commons.collections4.ListUtils` |
| `import org.apache.commons.collections.SetUtils` | `import org.apache.commons.collections4.SetUtils` |
| `import org.apache.commons.collections.` (any other) | `import org.apache.commons.collections4.` (same suffix) |
| `import org.springframework.beans.factory.annotation.Autowired` | (do NOT auto-rewrite — flag for review; in IM 7.x sandbox, prefer constructor injection or `connectionLookup`) |

Original IMigrator mapped `com.sun.jersey.api.client.GenericType` → `javax.ws.rs.core.GenericType`, but for IM 7.x (Spring Boot 3 / Jakarta EE 9) the new package is `jakarta.ws.rs.core.GenericType` — that's the form to use.

## Step 4: javax → jakarta

After the import-rename pass, do a global rewrite across all files in `classes/`:

```
import javax.   →   import jakarta.
```

**Caveat:** Some `javax.*` packages stayed on `javax`. After the bulk replace, scan and **revert** these back to `javax`:

| Keep as `javax.*` (revert) |
|---|
| `javax.sql.*` |
| `javax.crypto.*` |
| `javax.security.auth.*` |
| `javax.xml.transform.*`, `javax.xml.parsers.*`, `javax.xml.stream.*` |
| `javax.naming.*` |
| `javax.management.*` |
| `javax.net.ssl.*` |

Strategy: do the bulk replace, then revert specific lines with a second targeted pass. Ask the user before reverting anything ambiguous.

## Step 5: Pricefx API Method Signature Renames

Apply this exact-match replacement across all files now in `classes/`:

| Old call | New call |
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

**These method renames change the parameter list as well as the name.** The textual rewrite produces code that compiles only if the parameter shape happens to match — usually it doesn't. Flag every rewritten call site as **REVIEW** in the report.

## Step 5b: Flag Legacy Pricefx API Client Imports

The `net.pricefx.integration.api.client.*` package (including `PriceFxClient`, `FetchFilterBuilder`, `FilterCriteriaBuilder`, `FetchRequest`, `FetchResponse`, `FilterCriteria`, `Response`, `MassEditBuilder`, `FcResponse`, `FormulaExecuteRequest`, `MasseditRequest`, `MasseditResponse`, `ApiClientRequestBuilder`) was reorganised in IM 7.x. The package paths often moved to `net.pricefx.integration.api.client.builder.*` or `net.pricefx.integration.api.client.model.*` in IM 6, and again in IM 7. There is no single mechanical rewrite that holds across all IM versions, so:

- **Do NOT auto-rewrite.** Flag every import that starts with `net.pricefx.integration.api.client.` as **REVIEW**.
- Suggest the developer cross-check against the IM 7.x javadoc and replace with the correct types from `net.pricefx.integration.api.*`.

Likewise flag these other internal-Pricefx package roots that have shifted between IM lines (validated against `cargill-anh-tca-integration`):

- `net.pricefx.integration.command.*` (e.g. `Command`)
- `net.pricefx.integration.component.bean.*` (e.g. `Filter`)
- `net.pricefx.integration.filter.*` (e.g. `FilterConverter`)
- `net.pricefx.integration.util.ExpressionUtils`

These are all flag-for-review.

## Step 5c: Flag Apache HttpClient 4 (`org.apache.http.*`) Usage

Spring Boot 3 (IM 7.x baseline) replaced Apache HttpClient 4 with HttpClient 5. The package root changed from `org.apache.http.*` to `org.apache.hc.*` (with substantial API changes — not a pure rename). 

- **Do NOT auto-rewrite** — the API differences require code changes, not just import renames.
- Flag every import starting with `org.apache.http.` as **REVIEW**, with the suggestion: "Migrate to `org.apache.hc.client5.*` / `org.apache.hc.core5.*`. The fluent API and connection-management classes changed significantly."

This was surfaced by `cargill-anh-tca-integration` where `AzureAuthentication.java` uses `CloseableHttpClient`, `HttpClientBuilder`, `BasicResponseHandler`, `UrlEncodedFormEntity`, `BasicNameValuePair` from HC4.

## Step 5d: Flag Class Names That Shadow Groovy Auto-Imports

When a Java class name matches a type that Groovy auto-imports for every script, the converted `.groovy` class can cause subtle resolution bugs in inline `<groovy>` blocks elsewhere in the project. Groovy auto-imports include:

```
java.io.*       (File, FileInputStream, ...)
java.lang.*     (String, Integer, Exception, ...)
java.util.*     (List, Map, Set, Date, ...)
java.net.*      (URL, ...)
java.math.*     (BigDecimal, BigInteger)
groovy.lang.*
groovy.util.*
```

After conversion, scan the target `classes/` for any `.groovy` file whose **simple class name** matches a Groovy auto-imported type (e.g. `File`, `String`, `List`, `Map`, `Set`, `Date`, `Exception`, `URL`).

- **Do NOT rename automatically** — that would break every reference site.
- Flag for review: "Class `{name}` shadows the Groovy auto-imported `{auto-import-target}`. Inline `<groovy>` blocks that reference `{name}` unqualified will resolve to the auto-import, not your class. Consider renaming the class (e.g. `File` → `FileService`) or always using the fully-qualified name."

This was surfaced by `cargill-anh-tca-integration` where `net.pricefx.integration.cargill.service.File` shadows `java.io.File`.

## Step 6: Manual-Action Hint — PartitionConnectionFactory

Search for `PartitionConnectionFactory.getPriceFxClient` in any file in `classes/`. This API is gone in IM 7.x. Report the affected files with the suggestion:

> Replace `PartitionConnectionFactory.getPriceFxClient(...)` with `ConnectionLookup.lookupPriceFx(...).getClient()`. The argument list also changes — refer to the IM 7.x `ConnectionLookup` javadoc.

Do NOT auto-fix this — the call shape changes meaningfully.

## Step 7: Stop Compiling Java in pom.xml

Provisioned IM does not compile Java. After the conversion, the `src/main/java/` directory should be empty in the target. If `pom.xml` configures `maven-compiler-plugin` with a `<source>/<target>` for Java compilation of `src/main/java`, that's harmless if no Java is left, but you may want to remove the plugin to make the build leaner.

This is **report-only** — do not auto-edit `pom.xml` here. The `migrate-manual-to-provisioned-pom` skill is the right place for `pom.xml` changes.

## Step 8: Report

```
Java/Groovy code migration summary
==================================

Source code discovered:
  src/main/java:                  N file(s)
  src/main/groovy:                N file(s)
  src/main/resources/repo/classes: N file(s)

Conversion (Java → Groovy):
  Files renamed .java → .groovy:  N
  Trailing ';' stripped from package/import: K lines
  'public' modifier dropped on classes:       K
  Lambdas flagged for review:                 K
  'var' usages flagged for review:            K
  Records flagged (no Groovy equivalent):     K
  Anonymous-inner-class blocks flagged:       K

Imports rewritten:
  - com.sun.jersey → jakarta.ws.rs:      N file(s)
  - io.swagger.client → net.pricefx.api: N file(s)
  - commons-lang → commons-lang3:        N file(s)
  - AggregationStrategy package:         N file(s)
  - ProducerUtils package:               N file(s)
  - PartitionConnectionFactory→Lookup:   N file(s)
  - other:                               N file(s)

javax.* → jakarta.*:                  N file(s) (M lines reverted as platform stayed on javax)

Pricefx API method renames (all flagged REVIEW):
  - .getDatamartApi().fetch(...):        N call site(s)
  - .getGeneralApi().loaddata(...):      N call site(s)
  - ... (one line per renamed method)

Files written to:
  src/main/resources/repo/classes/com/example/...   N file(s)
  src/main/resources/repo/classes/com/other/...     N file(s)

Manual action required:
  - PartitionConnectionFactory.getPriceFxClient: [files]
  - REVIEW each flagged Pricefx API rewrite
  - REVIEW each flagged Java-only construct (lambdas, var, records, anon inner classes)
  - Optional: remove maven-compiler-plugin from pom.xml (no Java to compile)
```

## Rules

- **Do NOT modify the source project.** All extracted/converted files are written into `$TARGET_DIR/src/main/resources/repo/classes/`.
- **Do NOT leave Java in the target.** Provisioned IM does not compile `src/main/java`. After this skill runs, `src/main/java/` should be empty in the target.
- **Always confirm before writing.** Show the user the target paths first.
- **API method renames produce code that often does not compile.** Always flag them as **REVIEW**. The developer must check each call site.
- The Groovy sandbox has reflection allow-listing — types referenced in the converted code feed into the next skill (`migrate-manual-to-provisioned-groovy-sandbox`), which generates the `integration.groovy-sandbox.custom-allowed-types` property.
- Preserve the package path. A class declared `package com.example.foo` must end up at `classes/com/example/foo/ClassName.groovy`.
- Idempotent: running this skill twice on a clean target is a no-op.
