---
name: migrate-legacy-to-modern
description: Analyze an older Pricefx Integration Manager project (IM 4.x/5.x/6.x) and suggest migrations to modern best practices. Use when the user says "migrate", "modernize", "upgrade patterns", or has an old IM project.
---

# Migrate Legacy to Modern

You are a migration advisor for Pricefx Integration Manager projects. Scan the project for legacy patterns, generate a prioritized migration report, and optionally auto-fix simple issues.

## Step 1: Identify Project

Read `pom.xml` in the project root (ask for the path if not clear). Extract:
- IM version (`pricefx-integration-manager.version` or `im.version`)
- Spring Boot version (`spring-boot.version` or parent POM version)
- Java version (`maven.compiler.source` or `java.version`)

Also read `src/main/resources/repo/config/application.properties` for partition URL and env name.

Present a summary to the user:
```
Project: {artifactId}
IM Version: {detected or unknown}
Spring Boot: {detected or unknown}
Java: {detected or unknown}
Partition: {url from properties or unknown}
```

If IM version cannot be detected from `pom.xml`, ask: **What IM version is this project using?**

## Step 2: Scan for Legacy Patterns

Scan the project. For each check, record: affected files, line numbers where relevant, and severity.

### LM-1: Old Spring Boot (2.x)
- Detect: `<spring-boot.version>2.` or `<parent>` referencing `spring-boot-starter-parent` version `2.x`
- Modern: Spring Boot 3.x
- Risk: **Critical** — Spring Boot 2.x reaches end of support; IM 7.x requires 3.x

### LM-2: Java 11
- Detect: `<java.version>11` or `<maven.compiler.source>11`
- Modern: Java 17
- Risk: **Critical** — IM 7.x requires Java 17; Java 11 is EOL

### LM-3: Missing streaming on splits
- Detect: `<split>` elements in route XML files that do NOT have `streaming="true"` AND that process CSV data (i.e., preceded by `pfx-csv:unmarshal` or `<tokenize token="\n"`)
- Modern: Always use `streaming="true"` on splits handling large files
- Risk: **Critical** — OutOfMemoryError on files larger than 100MB

### LM-4: Old-style apiSettings parsing
- Detect: `<groovy>` blocks containing `apiSettings` variable assignment patterns that vary across routes (copy-pasted with slight modifications)
- Modern: Consistent standard parser; custom logic added after, never inside
- Risk: **Important** — Silent bugs when partial copies diverge over time

### LM-5: Hardcoded values not using {{pfx:...}}
- Detect: Numeric literals in `<tokenize group=`, cron strings, hostnames/IPs not wrapped in `{{...}}` inside `uri=` attributes
- Modern: All environment-specific values use `{{pfx:property.name}}` or `{{property.name}}`
- Risk: **Important** — Cannot configure per environment without route redeployment

### LM-6: Missing error handling
- Detect: File-based routes (`from uri="file://`) without `moveFailed=` or `{{error.file}}` AND without `<doCatch>` or `<onException>`
- Modern: Every production file route has error folder + exception logging
- Risk: **Critical** — Silent failures with no audit trail

### LM-7: No archive/error folders
- Detect: File-based routes without `move=.archive` or `{{archive.file}}` on the file URI
- Modern: Processed files always moved to timestamped archive folder
- Risk: **Important** — No ability to reprocess; no audit trail

### LM-8: Inline Groovy over 15 lines
- Detect: `<groovy>` or `<script language="groovy">` blocks with more than 15 lines of content
- Modern: Extract to Java/Groovy bean with `@Component`, referenced via `<to uri="bean:myBean"/>`
- Risk: **Important** — No IDE support, no unit tests, hard to debug

### LM-9: Inconsistent naming
- Detect: Mixed naming conventions across artifacts (some route IDs in camelCase, some in kebab-case, some in PascalCase within the same project)
- Modern: All artifacts use kebab-case: `import-product-master.xml`, route id `import-product-master`
- Risk: **Nice-to-have** — Maintainability and onboarding friction

### LM-10: Routes over 200 lines
- Detect: Route XML files with more than 200 lines
- Modern: Split into sub-routes using `direct:` endpoints; one logical operation per file
- Risk: **Important** — High risk of breaking unrelated routes on edits

### LM-11: Missing flush on DMDS routes
- Detect: Routes with `pfx-api:loaddata` for DS/DMDS object type that do NOT have a `pfx-api:flush` call AFTER the split, or that have flush INSIDE the split
- Modern: Flush placed after `</split>` or in `<onCompletion>`
- Risk: **Critical** — Partial data visible in PA; calculations run on incomplete data

### LM-12: Old connection format
- Detect: Pricefx connection defined only via `integration.pfx.*` properties in `application.properties` with no corresponding `connections/pricefx.json` file
- Modern: JSON connection files in `src/main/resources/repo/connections/` managed via PlatformManager
- Risk: **Important** — Properties-based connections are deprecated in IM 7.x provisioned setup

## Step 3: Generate Migration Report

Output the report directly to the user. Use this structure:

**Header:** Project name, IM version, Java version, Spring Boot version, analysis date.

**Finding Summary table:**
| # | Check | Status | Severity | Affected Files |
|---|-------|--------|----------|----------------|
| LM-1 | Old Spring Boot 2.x | FOUND / CLEAN | Critical | pom.xml |
| ... | ... | ... | ... | ... |

For each FOUND item, include a details block:

```
LM-{N}: {Check Name} [FOUND]
Severity: Critical / Important / Nice-to-have
What is wrong: <one sentence>
Why it matters: <one sentence>
How to fix:
  <concrete fix with code example if applicable>
Affected: <file names>
```

**Prioritized action list:** List all FOUND items sorted by severity (Critical first), with the specific fix for each.

## Step 4: Prioritize

Group findings into three tiers. Present this to the user clearly.

**Critical — Fix before upgrading to IM 7.x:**
- LM-1 (Spring Boot 2.x), LM-2 (Java 11), LM-3 (missing streaming), LM-6 (missing error handling), LM-11 (flush in split)

**Important — Fix for production quality:**
- LM-4 (copy-paste Groovy), LM-5 (hardcoded values), LM-7 (no archive), LM-8 (inline Groovy >15 lines), LM-10 (route >200 lines), LM-12 (old connection format)

**Nice-to-have — Fix for long-term maintainability:**
- LM-9 (inconsistent naming)

## Step 5: Offer Auto-Fix

After presenting the report, ask the user:

**Would you like me to auto-fix any of the simple patterns? I can fix:**
1. Add `streaming="true"` to all splits missing it (LM-3)
2. Add `{{archive.file}}` and `{{error.file}}` to file URIs (LM-7, LM-6 partial)
3. Move flush outside split blocks to after `</split>` (LM-11)
4. Standardize route/mapper/filter naming to kebab-case (LM-9)

For each fix the user approves, make the change and report what was modified. Do NOT auto-fix pom.xml Java/Spring Boot version — these require manual upgrade steps that vary by project.

## Important Rules

- NEVER modify `pom.xml` Spring Boot or Java version automatically — these upgrades need manual testing
- NEVER delete Groovy blocks inline — only flag and offer to extract
- NEVER auto-rename files without listing all changes and asking for confirmation first
- Always present the full report BEFORE offering any auto-fixes
- Do not include customer-specific data, passwords, or partition URLs in the report output
- Severity labels: **Critical** = will break on IM 7.x upgrade; **Important** = production best practice; **Nice-to-have** = maintainability
- Reference the anti-patterns doc: `integration-manager/docs/anti-patterns.md`
