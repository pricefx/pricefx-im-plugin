---
name: migrate-manual-to-provisioned-java-code
description: Use when migrating from manual to provisioned and the source project has custom `.java` or `.groovy` code under `src/main/java/`, Pricefx legacy package imports (`com.sun.jersey`, `io.swagger.client`, `commons-lang`, `AggregationStrategy`, `ProducerUtils`), `javax.*` imports that need to move to `jakarta.*`, or pre-IM-7.x Pricefx Java API method signatures.
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

### 1a — Skip Spring Boot bootstrap classes

Provisioned IM provides its own bootstrap — the project does not need its own `Application.java` / `@SpringBootApplication`. Manual IM projects often have one (e.g. `net.pricefx.integration.Application` with `SpringApplication.run(Application.class, args)`).

**Detect** any source file that contains ANY of:
- `@SpringBootApplication`
- `SpringApplication.run(`
- `@EnableAutoConfiguration` together with `@ImportResource`

**Exclude** these files from the conversion. Do not write them to `repo/classes/`. Report them in the "Manual action required" section so the developer knows the bootstrap class was deliberately dropped:

> Skipped Spring Boot bootstrap class `{path}` — provisioned IM has its own boot. Delete from the source project after migration to avoid the entry point being loaded twice.

This was surfaced by `dieteren-integration`, where `src/main/java/net/pricefx/integration/Application.java` is the legacy main class.

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

For every file now in `classes/` (both newly-converted and pre-existing Groovy), apply the **Import renames** table in `references.md`. It covers Jersey → Jakarta, Swagger client → Pricefx integration API, Camel `AggregationStrategy`, commons-lang/collections → -lang3/-collections4, `PartitionConnectionFactory` → `ConnectionLookup`, plus two "do not auto-rewrite — flag for review" entries (`ApiClientRequestBuilder`, `@Autowired`).

After the rewrite pass, scan each file for **duplicate active import lines** (two non-commented `import X;` lines with the same fully-qualified name) and report them. Do not remove duplicates automatically — the rewrite operates on raw text and may leave a commented-out legacy import alongside the new active one.

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

Apply the **Pricefx API method renames** table in `references.md` — roughly 15 method renames across `getDatamartApi`, `getGeneralApi`, `getFormulaApi`, `getLookuptableApi`, `getContractApi`, and `getPricegridApi`.

**These method renames change the parameter list as well as the name.** The textual rewrite produces code that compiles only if the parameter shape happens to match — usually it doesn't. Flag every rewritten call site as **REVIEW** in the report.

## Step 5b–5d: Additional Flag-for-Review Scans

After the imports and method-renames pass, scan the converted files for these patterns and flag every match in the report. **Do NOT auto-fix any of them** — each requires a developer judgement call about the right replacement.

- **Step 5b — Legacy Pricefx API client imports** (`net.pricefx.integration.api.client.*` and related internal-Pricefx package roots whose paths shifted between IM 6 and IM 7)
- **Step 5c — Apache HttpClient 4** (`org.apache.http.*`) which Spring Boot 3 replaced with HttpClient 5 (`org.apache.hc.*`) — substantial API change, not a rename
- **Step 5d — Class names that shadow Groovy auto-imports** (`File`, `String`, `List`, `Map`, `Set`, `Date`, etc.) — converted classes whose simple name collides with a Groovy auto-imported type cause subtle resolution bugs in inline `<groovy>` blocks elsewhere in the project

See `references.md` for the full detection rules, the affected package roots, and the per-step reviewer guidance.

## Step 6a: Manual-Action Hint — PartitionConnectionFactory

Search for `PartitionConnectionFactory.getPriceFxClient` in any file in `classes/`. This API is gone in IM 7.x. Report the affected files with the suggestion:

> Replace `PartitionConnectionFactory.getPriceFxClient(...)` with `ConnectionLookup.lookupPriceFx(...).getClient()`. The argument list also changes — refer to the IM 7.x `ConnectionLookup` javadoc.

Do NOT auto-fix this — the call shape changes meaningfully.

## Step 6b: Replacement Snippet for Pricefx Client Lookup

When fixing the call sites flagged in Step 6a, the canonical IM 7.x replacement uses `ConnectionLookup.lookupPriceFx(...)` (with a `Registry`-based or 2-arg `exchange`-based form). See `references.md` → **ConnectionLookup snippet** for the full code template.

This is **report-only** — the developer must apply the fix manually because surrounding code (state, caching, exception handling) usually needs adjustment too.

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
