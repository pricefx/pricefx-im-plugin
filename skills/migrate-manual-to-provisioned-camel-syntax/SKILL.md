---
name: migrate-manual-to-provisioned-camel-syntax
description: Apply mechanical Apache Camel syntax fixes that the version bump (Camel 2.x/3.x → 4.x) requires — quartz2→quartz, property[]→exchangeProperty[], setHeader headerName→setHeader name, setProperty propertyName→setProperty name, strategyRef→aggregationStrategy, aws-s3://→aws2-s3://, plus reports for `useList=`, `synchronous=`, and `startDelayedSeconds=` parameters that are no longer supported.
---

# Migrate Manual → Provisioned: Camel Syntax

You are applying mechanical Camel syntax modernizations to every file in the target project. These are safe, idempotent search-and-replace operations needed for Camel 4.x. They apply across route XML, mappers, filters, beans, properties, Java, and Groovy files.

## Inputs

- **TARGET_DIR** — current working directory (provisioned project). Files are modified in place.

This skill assumes the extraction skills (`migrate-manual-to-provisioned-routes`, `-mappers`, `-filters`, `-beans`, `-connections`) have already run, so the artifacts to modernise are in TARGET_DIR.

## Step 1: Auto-Fix Replacements

Apply each replacement in sequence. For each one, first list the affected files, ask for confirmation, then apply.

Walk all files under `$TARGET_DIR/src/` (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`).

| # | Search | Replace | Files to scan | Why |
|---|---|---|---|---|
| 1 | `quartz2` | `quartz` | `*.xml`, `*.properties`, `*.java`, `*.groovy` | The `camel-quartz2` component was merged back into `camel-quartz` in Camel 3.x |
| 2 | `property[` | `exchangeProperty[` | `*.xml` (route XMLs only) | Camel 3 renamed Simple's `${property[x]}` to `${exchangeProperty[x]}` |
| 3 | `property.` (Simple) | `exchangeProperty.` | `*.xml` (route XMLs only) | Same rename in dotted form (`${property.foo}` → `${exchangeProperty.foo}`) |
| 4 | `setHeader headerName` | `setHeader name` | `*.xml` | Attribute renamed in Camel 3 (`<setHeader headerName="x">` → `<setHeader name="x">`) |
| 5 | `setProperty propertyName` | `setProperty name` | `*.xml` | Same rename for properties |
| 6 | `strategyRef=` | `aggregationStrategy=` | `*.xml` | Camel 3 renamed the parameter for `<split>`, `<aggregate>`, `<enrich>`, `<pollEnrich>` |
| 7 | `aws-s3://` | `aws2-s3://` | `*.xml`, `*.properties` | The `camel-aws-s3` component was renamed to `camel-aws2-s3` in Camel 3.x |

For replacement #3 (`property.` → `exchangeProperty.`) be careful: the source string `property.` could appear in non-Simple contexts (Spring property keys, comments). Restrict it to `${...}` Simple expressions:
- Match `\$\{property\.([a-zA-Z0-9_]+)\}`
- Replace with `\${exchangeProperty.$1}`

## Step 2: Report-Only Warnings

These are anti-patterns from the old Camel API that no longer work in Camel 4.x. Do **not** auto-fix — flag them for the developer because the right replacement depends on intent.

| Pattern | Where | Hint |
|---|---|---|
| `useList=` parameter on Camel components | route XMLs | `useList=` is no longer supported. Lists are the default representation. Remove the parameter. |
| `synchronous=` parameter on `pfx-*` components | route XMLs | Producers are synchronous by default in IM 7.x. Remove the parameter. |
| `startDelayedSeconds=` parameter on `quartz` URIs | route XMLs | `startDelayedSeconds` is not a valid Quartz parameter. Use `triggerStartDelay=` (milliseconds) or `cron=` to control first-run timing. |
| `org.joda` import | Java/Groovy files | `org.joda.time` is removed. Use `java.time` or Camel Simple expressions like `${date:now-24h}`. |
| `@Autowired` annotation | Java/Groovy files | Field-level `@Autowired` is discouraged in IM 7.x. Use constructor injection or read from `connectionLookup`. |
| `@PropertyInject` annotation | Java/Groovy files | `@PropertyInject` has been removed. Use Camel Simple `${properties:my.key}` in routes, or `@Value` in Spring beans. |

For each pattern that is found, list the affected files and the specific suggestion.

## Step 3: Report

```
Camel-syntax modernization summary
==================================

Auto-fixes applied:
  quartz2 → quartz                     N file(s)
  property[ → exchangeProperty[        N file(s)
  property. → exchangeProperty.        N file(s)
  setHeader headerName → name          N file(s)
  setProperty propertyName → name      N file(s)
  strategyRef → aggregationStrategy    N file(s)
  aws-s3:// → aws2-s3://               N file(s)

Manual action required:
  useList= present in routes:           [files]
  synchronous= present in routes:       [files]
  startDelayedSeconds= present:         [files]
  org.joda imports:                     [files]
  @Autowired annotations:               [files]
  @PropertyInject annotations:          [files]
```

## Rules

- **Always confirm before applying** — show affected files, ask `proceed?`, then write.
- **Never apply replacements to `target/`, `.git/`, etc.** Use the same exclusions as the other skills.
- **Idempotent.** Running the skill twice should be a no-op on a clean target.
- The `property[` / `property.` rewrites apply to Camel Simple expressions — be careful inside attribute values that mix Simple and literal text. When in doubt, escape and ask.
