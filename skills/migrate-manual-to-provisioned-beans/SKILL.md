---
name: migrate-manual-to-provisioned-beans
description: Use when migrating from manual to provisioned and the source project has Spring `<bean>` definitions bundled into shared XML files (e.g. `camel-context.xml`), legacy event-route beans using `priceFxConnection`, `${...}` property placeholders inside bean configs, or `<to uri="myBean"/>` references to beans without the `bean:` prefix.
---

# Migrate Manual → Provisioned: Beans

You are extracting Spring beans from a manual IM project and splitting them into the provisioned layout: one bean per file under `src/main/resources/repo/beans/{bean-id}.xml`. You also fix two related anti-patterns: event-route beans that use the deprecated `priceFxConnection` property name, and `<to>` route URIs that reference beans without the `bean:` prefix.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`, `.settings/`, `.vscode/`, `.github/`).

## Step 2: Extract Each `<bean>` Block

Run both patterns and collect every match. The patterns optionally allow a `beans:` namespace prefix because some XML files declare the Spring beans namespace explicitly (e.g. `xmlns:beans="http://www.springframework.org/schema/beans"`) and prefix every bean definition as `<beans:bean>`:

| Pattern | Captures |
|---|---|
| `<(beans:)?bean[ />]([^>]*?)id="(.*?)"[^>]*?/>` | self-closing bean |
| `(?s)<(beans:)?bean[ />]([^>]*?)id="(.*?)"(.*?)</(beans:)?bean>` | block bean |

The `[ />]` after `bean` ensures the next character is one of space / `/` / `>`, which avoids matching `<beans>` (next char is `s`) and `<beanstuff>` (next char is `s`). The id capture group is now group 3 (was group 1) because of the optional `beans:` prefix at group 1.

If a project declares the **Pricefx default namespace** (`xmlns="http://www.pricefx.eu/schema/pfx"`) and **prefixes Spring beans** as `xmlns:beans="..."`, an XML file looks like:
```xml
<beans:beans xmlns="http://www.pricefx.eu/schema/pfx" xmlns:beans="...">
    <loadMapper id="x">...</loadMapper>      <!-- pfx:loadMapper, default ns -->
    <beans:bean id="y" class="...">           <!-- spring bean, prefixed -->
</beans:beans>
```
The patterns above capture both `<bean>` (no prefix) and `<beans:bean>` (prefixed). The `<loadMapper>` is handled by the `-mappers` skill via its `<loadMapper>` (no-prefix) regex.

For each match, capture the bean `id` (group 3 in the new patterns). Sanitise the id for use as a filename: replace `/` with `_`, strip `'` and `"`.

### 2a — Skip connection beans (they belong in `connections/`, not `beans/`)

If the bean's `class` attribute matches one of the Pricefx connection discriminator classes, **skip it** — the `migrate-manual-to-provisioned-connections` skill extracts these as JSON files in `connections/`. Writing them as Spring beans in `beans/` AND as JSON in `connections/` would result in duplicate definitions.

Skip when class is any of:
- `net.pricefx.integration.component.rest.domain.connection.PriceFxConnection`
- `net.pricefx.integration.component.rest.domain.connection.BasicConnection`
- `net.pricefx.integration.component.rest.domain.connection.OAuth2Connection`
- `net.pricefx.integration.component.rest.domain.connection.JwtConnection`
- `net.pricefx.integration.component.rest.domain.connection.NoopConnection`
- `net.pricefx.integration.component.sftp.connection.SFTPConnection`
- `net.pricefx.integration.component.s3.connection.S3Connection`

Validated against `bridgestone-integration` where `<bean id="mulesoftConn" class="...BasicConnection">` is a connection bean that must end up in `connections/mulesoftConn.json`, not `beans/mulesoftConn.xml`.

## Step 3: Transform Each Bean

For each extracted bean block, apply these transformations in order:

### 3a — Detect event-route beans

Parse the bean as XML and check whether `class="net.pricefx.integration.route.EventRoute"`.

If yes, this is a **legacy event-route bean**. Apply two changes to its `<property>` children:
- For any `<property name="priceFxConnection" ref="..."/>`, rename to `<property name="priceFxClientName" value="..."/>` — the property name changes (`priceFxConnection` → `priceFxClientName`) AND the attribute changes (`ref` → `value`).
- For every other `<property>` whose `value` attribute contains `${...}`, rewrite as in 3b below.

### 3b — Rewrite property placeholders for non-event beans

For any extracted bean (event-route or not), find every `${name}` token inside the bean body (typically inside `<property name="..." value="...${envvar}..."/>`) and replace it with `#{environment['name']}`.

Concrete example:
```xml
<!-- Before -->
<property name="endpoint" value="${target.endpoint}"/>

<!-- After -->
<property name="endpoint" value="#{environment['target.endpoint']}"/>
```

The reason: provisioned IM evaluates `${...}` against Camel exchange properties, not Spring environment. Beans that need to read environment values must use the `#{environment['...']}` SpEL form.

## Step 4: Write One File Per Bean

For each transformed bean, write to `$TARGET_DIR/src/main/resources/repo/beans/{bean-id}.xml`:

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:pfx="http://www.pricefx.eu/schema/pfx"
    xmlns:util="http://www.springframework.org/schema/util"
    xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
    http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util.xsd
    http://camel.apache.org/schema/spring http://camel.apache.org/schema/spring/camel-spring.xsd
    http://www.pricefx.eu/schema/pfx http://www.pricefx.eu/schema/pfx.xsd">
{the transformed bean element}
</beans>
```

If the target file already exists, **read it, apply the same `${...}` → `#{environment['...']}` rewrite to its existing content if needed, then overwrite**. (Existing target files might have been hand-written before this migration ran.)

## Step 5: Add `bean:` Prefix to Bare Bean References in Routes

After bean files are extracted, scan `$TARGET_DIR/src/main/resources/repo/routes/*.xml` and `$SOURCE_DIR/**/*.xml` (depending on whether routes have already been extracted) for `<to>` and `<toD>` URIs that reference a bean without the `bean:` prefix.

Detection regex: `<toD? uri="([^"]+)"\s*/>`

For each matching URI, if the value does **NOT** contain a `:` (i.e. there is no Camel component scheme), prefix it with `bean:`:

```xml
<!-- Before -->
<to uri="myProcessor"/>

<!-- After -->
<to uri="bean:myProcessor"/>
```

URIs that already have a scheme (e.g. `direct:`, `pfx-api:`, `pfx-rest:`, `seda:`, `bean:`) are left alone.

Apply this rewrite **only to files in TARGET_DIR**, never to source files.

## Step 6: Report

```
Extracted N bean(s):
  - beans/myProcessor.xml (id: myProcessor)
  - beans/eventRouteBean.xml (id: eventRouteBean)
  ...

Transformations applied:
  - Event-route beans rewritten (priceFxConnection→priceFxClientName, ref→value): K
  - Property placeholders rewritten (${...} → #{environment['...']}): J locations
  - <to>/<toD> URIs prefixed with bean:: M

Skipped (already in target): P
```

## Rules

- **Do NOT modify the source project.**
- **Do NOT extract beans that are commented out** — verify the bean is not inside an XML comment block before extracting.
- **Preserve unrelated bean attributes verbatim** (class, scope, lazy-init, etc.).
- If a bean's `id` collides with another extracted bean (same id, different content), write the first occurrence and report the rest as a conflict warning.
