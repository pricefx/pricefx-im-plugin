---
name: migrate-manual-to-provisioned-groovy-sandbox
description: Walk every Java and Groovy file in the target project, collect every type referenced in `import` statements, and produce the `integration.groovy-sandbox.custom-allowed-types` application property — the comma-separated allow-list IM 7.x uses to whitelist types for Groovy script execution.
---

# Migrate Manual → Provisioned: Groovy Sandbox Allow-list

You are generating the `integration.groovy-sandbox.custom-allowed-types` allow-list for IM 7.x. This list tells the Groovy sandbox which Java types may be referenced from inline `<groovy>` scripts inside route XML or from custom Groovy beans. Without it, Groovy scripts that worked under IM 6.x will throw `SandboxSecurityException` at runtime in IM 7.x.

## Inputs

- **TARGET_DIR** — current working directory (provisioned project)

## Step 1: Collect All Imports

Walk every `*.java` and `*.groovy` file under TARGET_DIR (skip `target/`, `.git/`, etc.). For each file, extract every line matching the pattern `import .*;`.

Strip `import static ` and `import ` and the trailing `;` — keep just the fully qualified type name.

**Skip imports that contain `*`** (wildcard imports are not allowed in the sandbox allow-list).

## Step 2: Deduplicate

Remove duplicate type names. Keep the order stable (first occurrence wins).

## Step 3: Remove Already-Whitelisted Types

These types are allow-listed by the platform itself — do not include them in the custom list:

```
net.pricefx.integration.autoconfigure.banner.IMBanner
org.springframework.boot.Banner
org.springframework.boot.SpringApplication
org.springframework.boot.autoconfigure.SpringBootApplication
net.pricefx.integration.connection.service.ConnectionsService.LOCAL_APP_PROFILE_PREFIX
```

## Step 4: Produce the Property Line

Output a single application-property line:

```
integration.groovy-sandbox.custom-allowed-types=type1,type2,type3,...
```

Comma-separated, no spaces.

## Step 5: Add to application.properties

Show the user the generated line, the count of types, and the list. Ask:

> Add this line to `src/main/resources/repo/config/application-{env}.properties`?
> Pick: dev / prod / both / all environments / cancel.

If yes, append the property to the chosen `application-{env}.properties` files (or insert if a `integration.groovy-sandbox.custom-allowed-types=` key already exists — in that case **read the existing value, merge with new types, deduplicate, write back**).

## Step 6: Report

```
Groovy sandbox allow-list generation summary
============================================

Source files scanned:           N java/groovy files
Total imports found:            J
Wildcard imports skipped:       K
After deduplication:            M types
After removing platform-listed: P types

Generated property line written to:
  - config/application-dev.properties
  - config/application-prod.properties

Sample of generated allow-list (first 10):
  com.example.MyClass,
  org.apache.commons.lang3.StringUtils,
  ...
```

## Rules

- The output must be a **single line** — no newlines inside the comma-separated value.
- Never wildcard-include packages — explicit fully-qualified type names only.
- If the user already has a `integration.groovy-sandbox.custom-allowed-types=` line, **merge** rather than overwrite. Deduplicate after merging.
- This skill is run after Java/Groovy code has been copied to TARGET (i.e. after `migrate-manual-to-provisioned-java-code`).
- Do not include types that are referenced only inside `<groovy>` blocks in route XML (those are handled by the platform reflection allow-list separately). This skill only inspects `import` statements in `.java` and `.groovy` files.
