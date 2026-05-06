---
name: migrate-manual-to-provisioned-pom
description: Migrate the manual project's `pom.xml` to the provisioned IM 7.x layout — bump Java to 17, Spring Boot to 3.x, Camel to 4.x, IM to 7.x, and remove unwanted dependencies (`quartz2`, `camel-aws-starter`, `joda-time`).
---

# Migrate Manual → Provisioned: pom.xml

You are bringing the project's `pom.xml` up to the IM 7.x baseline. This is the most version-sensitive step — you should preview every change before applying it.

## Inputs

- **SOURCE_DIR** — original manual project (read its `pom.xml` for context — read-only)
- **TARGET_DIR** — current working directory (provisioned project; modify `pom.xml` here)

## Step 1: Read the Target pom.xml

Read `$TARGET_DIR/pom.xml`. If the target does not have a pom.xml yet, copy from source as a starting point, then continue. Capture:
- `<groupId>`, `<artifactId>`, `<version>`
- Current parent (e.g. `spring-boot-starter-parent`, `pricefx-integration-manager-parent`)
- `<java.version>`, `<maven.compiler.source>`, `<maven.compiler.target>`
- `<spring-boot.version>`, `<camel.version>`, `<pricefx-integration-manager.version>` / `<im.version>` if defined
- All `<dependency>` entries

## Step 2: Detect Anti-Patterns

| # | Detect | Action |
|---|---|---|
| P-1 | `<java.version>11` or `<maven.compiler.source>11` | Bump to `17` |
| P-2 | `<spring-boot.version>2.` | Bump to the latest Spring Boot 3.x |
| P-3 | `<parent>` referencing `spring-boot-starter-parent` 2.x | Bump parent to 3.x |
| P-4 | Camel version `< 4.1` | Bump to Camel 4.1+ (managed by the IM 7.x parent BOM — usually Camel 4.4 LTS) |
| P-5 | IM version `< 7.0` | Ask the user for the target IM version, then bump |
| P-6 | Dependency on `camel-quartz2` or any artifactId containing `quartz2` | Remove (now `camel-quartz`) |
| P-7 | Dependency on `camel-aws-starter` | Remove (renamed to `camel-aws2-s3-starter` in Camel 3.x) |
| P-8 | Dependency on `joda-time` | Flag for review (use `java.time` instead) |
| P-9 | Dependency on `org.apache.commons:commons-lang` | Replace with `org.apache.commons:commons-lang3` |
| P-10 | `maven-compiler-plugin` configured for `src/main/java` and target has no `.java` after Java→Groovy conversion | Flag for removal — provisioned IM does not need to compile Java |

## Step 3: Present the Plan

Output a diff-style plan **before** modifying `pom.xml`:

```
pom.xml migration plan
======================

Version bumps:
  java.version:                          11 → 17
  spring-boot.version:                   2.7.x → 3.2.x
  pricefx-integration-manager.version:   6.x → 7.x          (confirm target with user)
  camel.version:                         3.3.5 → 4.1+ (typically 4.4.x LTS; managed by IM parent — remove explicit pin if redundant)

Dependencies to remove:
  - org.apache.camel:camel-quartz2      (renamed)
  - org.apache.camel:camel-aws-starter  (renamed)

Dependencies to flag for review:
  - joda-time:joda-time                 (use java.time)
  - org.apache.commons:commons-lang     (use commons-lang3)
```

Ask: **Apply all version bumps and dependency removals?** Wait for confirmation.

## Step 4: Apply

Edit `$TARGET_DIR/pom.xml`:

1. Replace `<java.version>11</java.version>` → `<java.version>17</java.version>` (and the corresponding `maven.compiler.source` / `maven.compiler.target` entries).
2. Bump Spring Boot.
3. Bump IM.
4. Remove the deprecated `<dependency>` blocks (full block including `<dependency>...</dependency>`).
5. For commons-lang, replace the `<artifactId>` value (`commons-lang` → `commons-lang3`) and bump the version to a 3.x value.

After edits, run a sanity check:

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.14/libexec/openjdk.jdk/Contents/Home \
  mvn -f "$TARGET_DIR/pom.xml" dependency:resolve -q --no-transfer-progress 2>&1 | tail -30
```

Report any unresolvable artifacts. Do NOT claim the migration is done until `dependency:resolve` is clean.

## Step 5: Report

```
pom.xml migration summary
=========================

Before:
  Java:        11
  Spring Boot: 2.7.18
  IM:          6.5.0
  Camel:       3.20.x

After:
  Java:        17
  Spring Boot: 3.2.5
  IM:          7.3.0  (confirm with user)
  Camel:       4.4.x  (managed by IM parent)

Dependencies removed: 2
  - camel-quartz2
  - camel-aws-starter

Dependencies flagged for review: 1
  - joda-time:joda-time

Resolution check: PASSED / FAILED (see details)
```

## Rules

- **Always present the plan before editing pom.xml.**
- **Do not bump IM version without an explicit user confirmation** — the target version drives everything else.
- **Never delete the entire `<dependencies>` block.** Remove only the specific `<dependency>...</dependency>` entries listed.
- If `dependency:resolve` fails, report the specific unresolved artifacts. The user may need to add the IM Nexus credentials or the parent BOM.
- Never include credentials, partition URLs, or any secrets from `application.properties` in the report.
