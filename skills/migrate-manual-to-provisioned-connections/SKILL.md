---
name: migrate-manual-to-provisioned-connections
description: Use when migrating from manual to provisioned and the source project defines Pricefx connections via `<pfx:connection .../>` XML elements or the legacy properties form (`pfx.url=`, `pfx.partition=`, `pfx.username=`, `pfx.password=` in `application-{env}.properties`) instead of provisioned JSON files under `src/main/resources/repo/connections/`.
---

# Migrate Manual → Provisioned: Connections

You are converting Pricefx connection definitions to the provisioned IM JSON form (one `*.json` file per connection under `src/main/resources/repo/connections/`). Real manual IM projects use one of two source forms — both are supported here:

| Form | Where it lives | When |
|---|---|---|
| **XML** | `<pfx:connection id="x" uri="..." partition="..." username="..." password="..."/>` inside `camel-context.xml` (or imported XML) | Older IM projects, or projects following the `<pfx:>` namespace pattern |
| **Properties** | `pfx.url=`, `pfx.partition=`, `pfx.username=`, `pfx.password=` (sometimes `integration.pfx.*`) inside `application-{env}.properties` | Most real-world manual IM projects (e.g. bosch-rexroth, cargill, amd, fiskars). Connection details ride alongside other config; the runtime stitches them into a `PriceFxConnection` bean. |
| **Spring bean** | `<bean id="x" class="net.pricefx.integration.component.rest.domain.connection.{Type}Connection">` with `<property>` children for the connection fields | Projects that define non-Pricefx connections (e.g. external REST APIs with BasicAuth/OAuth2/JWT) inline as Spring beans. Validated against bridgestone-integration which has a `mulesoftConn` BasicConnection bean. |

The skill handles **all three** forms. If the project has overlap, prefer the XML form's data when ids clash and report the conflict.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`, `.settings/`, `.vscode/`, `.github/`).

## Step 2A: Extract Each `<pfx:connection>` Element (XML form)

Pattern: `<pfx:connection[^>]*?/>` (self-closing form is the only legacy form).

For each match, parse the attributes:
- `id`
- `uri`
- `partition`
- `username`
- `password`

## Step 2B: Extract from `application-{env}.properties` (Properties form)

Walk every `application*.properties` under SOURCE_DIR. For each file, look for any of these key sets (a complete set is usually present together):

| Key | Maps to |
|---|---|
| `pfx.url` | `uri` |
| `pfx.partition` | `partition` |
| `pfx.username` | `username` |
| `pfx.password` | `password` |
| `pfx.connect-timeout` (optional) | `connectTimeout` |
| `pfx.debug` (optional) | `debug` |
| `pfx.use-jwt` (optional) | `useJsonWebToken` |

Some projects use `integration.pfx.*` instead of `pfx.*` (e.g. `integration.pfx.url`); look for both prefixes.

A property-based connection always has the **id `pricefx`** (the conventional default name) — the manual project doesn't model a per-connection id in properties, but provisioned IM expects one.

If multiple environment files yield **different values for the same key** (typical: dev vs prod has different `pfx.url`/`pfx.partition`), do **not** write per-environment connection JSON files (provisioned IM has one `pricefx.json` per project). Instead:

1. Pick the placeholder form: write `connections/pricefx.json` with values left as Spring property placeholders so the runtime resolves per-environment:
   ```json
   {
     "discriminator": "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection",
     "id": "pricefx",
     "partition": "${pfx.partition}",
     "username": "${pfx.username}",
     "password": "${pfx.password}",
     "uri": "${pfx.url}",
     "connectTimeout": 6000,
     "debug": false,
     "acceptGZIPResponse": false,
     "useJsonWebToken": true
   }
   ```
2. Keep the original `pfx.*` properties in each `application-{env}.properties` (the orchestrator's `-properties` skill should preserve them so the placeholders resolve at runtime).

If the dev/qa/prod values are identical (all four point to the same partition, just with different env names), inline the literal values into the JSON instead of using placeholders.

If only ONE environment file has the keys (e.g. `application-bosch-rexroth_dev.properties` has them but `application-bosch-rexroth_prod.properties` does not), use that single set verbatim and report the missing files.

## Step 2C: Extract from Spring `<bean>` with Connection-Discriminator Class (Bean form)

Walk every `*.xml` under SOURCE_DIR. Scan for `<bean>` elements whose `class` attribute matches one of the Pricefx connection discriminator classes:

| Class attribute | Discriminator |
|---|---|
| `net.pricefx.integration.component.rest.domain.connection.PriceFxConnection` | `PriceFxConnection` |
| `net.pricefx.integration.component.rest.domain.connection.BasicConnection` | `BasicConnection` (HTTP Basic Auth REST) |
| `net.pricefx.integration.component.rest.domain.connection.OAuth2Connection` | `OAuth2Connection` |
| `net.pricefx.integration.component.rest.domain.connection.JwtConnection` | `JwtConnection` |
| `net.pricefx.integration.component.rest.domain.connection.NoopConnection` | `NoopConnection` |
| `net.pricefx.integration.component.sftp.connection.SFTPConnection` | `SFTPConnection` (note: uppercase) |
| `net.pricefx.integration.component.s3.connection.S3Connection` | `S3Connection` |

For each match, read every `<property name="X" value="Y"/>` child to recover the connection fields. The JSON key depends on the discriminator (see `docs/connections.md` → "Endpoint-field naming"). Common property mappings:
- For `PriceFxConnection`: bean `url` → JSON `uri`
- For REST family (`OAuth2`, `Basic`, `Jwt`, `Noop`): bean `url` → JSON `url` (keep as-is)
- For `SFTPConnection`: bean `host` → JSON `host` (plus `port`, `path`, `username`, `password`, `strictHostKeyChecking`)
- `username`, `password`, `partition` (Pricefx only) → same names
- For OAuth2: `clientId`, `clientSecret`, `authUrl` (not `authUri`). There is no `grantType` field — grant type is embedded in the default `authRequestTemplate`; only set `authRequestTemplate` if a non-`password` grant is needed.

The `value` may be a Spring property placeholder (`${bridgestone.mulesoft.url}`) — preserve it verbatim in the JSON so the runtime resolves per-environment.

**Bean id becomes the JSON file id.** Example:
```xml
<bean id="mulesoftConn" class="net.pricefx.integration.component.rest.domain.connection.BasicConnection">
    <property name="username" value="${bridgestone.mulesoft.username}"/>
    <property name="password" value="${bridgestone.mulesoft.password}"/>
    <property name="url"      value="${bridgestone.mulesoft.url}"/>
</bean>
```
becomes `connections/mulesoftConn.json`:
```json
{
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.BasicConnection",
  "id": "mulesoftConn",
  "url": "${bridgestone.mulesoft.url}",
  "username": "${bridgestone.mulesoft.username}",
  "password": "${bridgestone.mulesoft.password}"
}
```

After extracting a connection bean, **also remove it from the `-beans` skill's extraction set** (otherwise the bean would be written to BOTH `connections/` and `beans/`). The orchestrator should run `-connections` before `-beans` so this dedup happens correctly.

## Step 3: Convert to JSON

For each extracted connection (XML form, properties form, or bean form), write to `$TARGET_DIR/src/main/resources/repo/connections/{id}.json`:

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

### 4a — File exists but contains the IMigrator placeholder

The legacy IMigrator Go tool wrote a hard-coded template when no real connection was found in the source:

```json
{
  "partition": "mvich",
  "username": "ahoj1",
  "password": "{ENC}m07IjU973nuNn9dEo7kUDw0YdQUKxJjT",
  "uri": "https://test.pricefx.eu/pricefx/"
}
```

Many partially-migrated projects have this template sitting in `connections/pricefx.json` and never replaced it (validated against `amd-integration`, where the placeholder still ships with the project alongside real `integration.pfx.*` properties).

**Detect the placeholder** by reading the existing file and checking whether *any* of these signature values are present:
- `"partition": "mvich"`
- `"username": "ahoj1"`
- `"uri": "https://test.pricefx.eu/pricefx/"`
- `"password": "{ENC}m07IjU973nuNn9dEo7kUDw0YdQUKxJjT"`

If any is present, treat the file as a placeholder (NOT as a real existing connection). Show the user:
> The existing `connections/pricefx.json` looks like the IMigrator default template (partition `mvich`, username `ahoj1`, etc.). Real connection values were found in `application-{env}.properties` at `integration.pfx.*`. Overwrite the placeholder with the property-based form?

If the user agrees, overwrite per Step 3 (use the placeholder/property-reference form when env values differ; literal values otherwise).

### 4b — File does not exist

If `pricefx.json` does not exist at all, create a placeholder with id `pricefx` so the provisioned project can build. Use empty/placeholder values and **clearly mark them as placeholders** in the report so the user knows to fill in real credentials:

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
  - connections/pricefx.json (from <pfx:connection id="pricefx"/>)               [XML form]
  - connections/pricefx.json (from pfx.url= / pfx.partition= in application-*)   [Properties form, placeholder values used because dev/qa/prod differ]
  - connections/secondary-pfx.json (from <pfx:connection id="secondary-pfx"/>)
  ...

Default connection: created placeholder / already existed
Skipped (already in target): M

If properties-form extraction was used:
  Source pfx.url / pfx.partition / pfx.username / pfx.password keys
  remain in application-{env}.properties so the JSON placeholders
  resolve at runtime. Do NOT remove them.
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
