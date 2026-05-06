---
name: migrate-manual-to-provisioned-pom
description: Migrate the manual project's `pom.xml` to the provisioned IM 7.x layout — bump Java to 17, Spring Boot to 3.x, Camel to 4.x, IM to 7.x, and remove unwanted dependencies (`quartz2`, `camel-aws-starter`, `joda-time`).
---

# Migrate Manual → Provisioned: pom.xml

You are bringing the project's `pom.xml` up to the IM 7.x baseline. This is the most version-sensitive step — you should preview every change before applying it.

## Inputs

- **SOURCE_DIR** — original manual project (read its `pom.xml` for context — read-only)
- **TARGET_DIR** — current working directory (provisioned project; modify `pom.xml` here)

## Step 1: Read the Target pom.xml and Detect Versions

Read `$TARGET_DIR/pom.xml`. If the target does not have a pom.xml yet, copy from source as a starting point, then continue. Capture:
- `<groupId>`, `<artifactId>`, `<version>`
- Current parent (e.g. `spring-boot-starter-parent`, `pricefx-integration-manager-parent`)
- All `<dependency>` entries

### Version detection (layered — fall through until found)

Real IM poms use **inconsistent property names** (`im.version` vs `pricefx-im-version` vs `pricefx-integration-manager.version`; `spring-boot.version` vs `spring-boot-version`; `java.version` vs `version.Java`) and **rarely pin Camel explicitly**. Apply the layers in order:

1. **Explicit property** in `<properties>`:
   ```bash
   grep -oE '<camel(\.|-)?version>[^<]+</' "$pom"
   grep -oE '<spring-boot(\.|-)?version>[^<]+</' "$pom"
   grep -oE '<(java(\.|-)?version|maven\.compiler\.source|version\.Java)>[^<]+</' "$pom"
   grep -oE '<(im|pricefx-im|pricefx-integration-manager)(\.|-)?version>[^<]+</' "$pom"
   ```

2. **Parent BOM** — read the `<parent>` block. If `pricefx-integration-manager-parent` or `spring-boot-starter-parent`, the parent version implies Camel/Spring Boot.

3. **Explicit `<version>` on a `camel-*` dependency**:
   ```bash
   awk '
     /<groupId>org.apache.camel/{flag=1}
     flag && /<version>[^$<]/{ sub(/.*<version>/, ""); sub(/<\/version>.*/, ""); print; exit }
     /<\/dependency>/{flag=0}
   ' "$pom"
   ```

4. **Infer Camel from IM version** (when nothing else resolves):

   | IM major | Camel line | Java | Spring Boot |
   |---|---|---|---|
   | 1.x | 2.20–2.25 | 8 | 1.5.x |
   | 4.x | 3.0–3.5 | 11 | 2.1–2.3 |
   | 5.x | 3.x | 11 | 2.x |
   | 6.x | 3.18–3.20 | 11 | 2.7 |
   | 7.0 | 4.0 | 17 | 3.1 |
   | 7.1+ | 4.1–4.4 LTS | 17 | 3.2+ |

5. **Maven fallback** — only if the above do not resolve and `mvn` is available:
   ```bash
   JAVA_HOME=... mvn -f "$pom" help:evaluate -Dexpression=camel.version -q -DforceStdout 2>/dev/null
   JAVA_HOME=... mvn -f "$pom" dependency:list -q -DincludeGroupIds=org.apache.camel --no-transfer-progress 2>/dev/null \
     | grep -oE 'camel-core[^:]*:[^:]+:[0-9.]+' | head -1
   ```

State which layer resolved each version: `"Camel 3.20 (layer 4 — inferred from IM 6.5)"`. If anything is still unknown, **ask the user** before continuing.

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
