---
name: migrate-manual-to-provisioned-properties
description: Migrate `application.properties` and `application-*.properties` from a manual IM project to the provisioned shape — rename Spring Boot keys to integration.* equivalents, copy required keys that are missing, and warn about overrides and invalid error-handling exception classes.
---

# Migrate Manual → Provisioned: Application Properties

You are migrating `application.properties` and `application-{env}.properties` from a manual IM project to the provisioned shape used by IM 7.x.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source Property Files

Glob every `application*.properties` under SOURCE_DIR. Pay attention to environment-specific files (`application-dev.properties`, `application-prod.properties`, etc.) — each environment has its own destination file.

## Step 2: Read & Copy

For each source `application{-env}.properties` file:

1. Read it.
2. If `$TARGET_DIR/src/main/resources/repo/config/application{-env}.properties` does not exist, create it as a copy of the source.
3. If it already exists, read both files and merge (target takes precedence on key collisions; report any collisions).

## Step 3: Rename Renamed Keys

Apply this **search-and-replace map** to each target properties file (whole-line, not partial — match the key followed by `=`):

| Old key | New key |
|---|---|
| `server.port` | `integration.server.port` |
| `spring.security.user.name` | `integration.user` |
| `spring.security.user.password` | `integration.password` |
| `spring.application.name` | `integration.name` |
| `application.context` | `integration.context` |

## Step 4: Check Required Keys for `application-{env}.properties`

For each `application-{env}.properties` (the environment-specific files only — not the base `application.properties`), verify these keys are present. If a key is missing, add it with the recommended default value:

| Required key | Recommended value |
|---|---|
| `spring.cloud.config.enabled` | `false` |
| `application.context` | `classpath*:camel-context.xml` |
| `integration.context` | `classpath*:camel-context.xml` |
| `integration.name` | (use the project name — ask the user if unclear) |
| `integration.event-driven.auto-registration.pfx-cluster` | `true` |
| `integration.monitoring.enabled` | `true` |
| `integration.logstash.enabled` | `true` |
| `integration.logstash.address` | `elkint.pricefx.eu:4560` |
| `integration.server.port` | `8080` |
| `integration.security.allowed-paths` | `/home,/var/pricefx` |

Report missing keys before adding them, and ask for confirmation if any are uncertain.

## Step 5: Warn About Overrides and Invalid Classes

These are **report-only**, do not auto-fix:

### 5a — Logging file override

Search every target `application-{env}.properties` for `integration.logging.file=`. This property overrides the platform-managed logging configuration and causes runtime issues. Report each file where it is present with the suggestion:
> Remove `integration.logging.file` — the platform manages the log location automatically.

### 5b — Invalid error-handling exception classes

Search every target `application-{env}.properties` for `com.sun.jersey.api.client.ClientHandlerException`. This class no longer exists in IM 7.x. Report each file where it is present with the suggestion:
> Replace `com.sun.jersey.api.client.ClientHandlerException` with the appropriate `net.pricefx.integration.api.ApiException` or remove from the error-handling list.

## Step 6: Report

```
Migrated N application*.properties file(s) to TARGET:
  - config/application.properties
  - config/application-dev.properties
  - config/application-prod.properties

Renames applied: K (server.port → integration.server.port, etc.)
Missing required keys added: J across M file(s)

Warnings (manual action required):
  - integration.logging.file present in: [files]
  - com.sun.jersey ClientHandlerException present in: [files]

Already-existing keys preserved (no overwrite): P
```

## Rules

- **Do NOT modify the source project.**
- **Never overwrite a value the user already has in the target** — only add missing keys.
- The base `application.properties` (no env suffix) typically contains very little. Most settings live in `application-{env}.properties`. Apply renames everywhere; apply required-key checks only to env-specific files.
- Never log or include real partition URLs, usernames, or passwords in the report.
- For values like `integration.name`, prefer reading the project artifactId from the target `pom.xml` rather than asking the user.
