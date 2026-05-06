---
name: migrate-manual-to-provisioned-connections
description: Extract every `<pfx:connection .../>` element from a manual IM project's bundled XML files and convert them to provisioned IM JSON connection files under `src/main/resources/repo/connections/`. Always ensures a default `pricefx` connection JSON file exists.
---

# Migrate Manual → Provisioned: Connections

You are converting Pricefx connection definitions from the manual IM XML form (`<pfx:connection .../>` inside camel-context) to the provisioned IM JSON form (one `*.json` file per connection under `src/main/resources/repo/connections/`).

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`).

## Step 2: Extract Each `<pfx:connection>` Element

Pattern: `<pfx:connection[^>]*?/>` (self-closing form is the only legacy form).

For each match, parse the attributes:
- `id`
- `uri`
- `partition`
- `username`
- `password`

## Step 3: Convert to JSON

For each extracted connection, write to `$TARGET_DIR/src/main/resources/repo/connections/{id}.json`:

```json
{
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection",
  "id": "{id}",
  "origin": "API",
  "prn": null,
  "certificateName": null,
  "partition": "{partition}",
  "username": "{username}",
  "password": "{password}",
  "uri": "{uri}",
  "connectTimeout": 6000,
  "debug": false,
  "acceptGZIPResponse": false,
  "useJsonWebToken": true
}
```

**Skip silently** if the target file already exists.

## Step 4: Ensure Default `pricefx` Connection Exists

After extracting from the source, check whether `$TARGET_DIR/src/main/resources/repo/connections/pricefx.json` exists.

If it does not, create a placeholder with id `pricefx` so the provisioned project can build. Use empty/placeholder values and **clearly mark them as placeholders** in the report so the user knows to fill in real credentials:

```json
{
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection",
  "id": "pricefx",
  "origin": "API",
  "prn": null,
  "certificateName": null,
  "partition": "REPLACE_WITH_PARTITION",
  "username": "REPLACE_WITH_USERNAME",
  "password": "REPLACE_WITH_ENCRYPTED_PASSWORD",
  "uri": "https://REPLACE_WITH_HOST/pricefx/",
  "connectTimeout": 6000,
  "debug": false,
  "acceptGZIPResponse": false,
  "useJsonWebToken": true
}
```

## Step 5: Report

```
Extracted N connection(s):
  - connections/pricefx.json (from <pfx:connection id="pricefx"/>)
  - connections/secondary-pfx.json (from <pfx:connection id="secondary-pfx"/>)
  ...

Default connection: created placeholder / already existed
Skipped (already in target): M
```

If a placeholder was created, add a prominent line:
```
ACTION REQUIRED: connections/pricefx.json contains placeholder credentials.
Edit the file before deploying.
```

## Rules

- **Do NOT modify the source project.**
- **Do NOT extract a non-Pricefx `<pfx:connection>` (e.g. SFTP, REST OAuth2)** with this skill — those have different discriminators and field shapes. They live in their own JSON shape (see `docs/connections.md`). If you encounter a non-Pricefx connection in the source XML, report it as a manual-action item and let the user decide.
- The **default Pricefx connection should be named `pricefx`** so it is implicitly the default for `pfx-api:*` operations (no `connection=` parameter needed in routes).
- Never include real credentials in the report output.
