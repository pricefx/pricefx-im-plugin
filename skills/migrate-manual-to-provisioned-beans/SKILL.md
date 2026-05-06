---
name: migrate-manual-to-provisioned-beans
description: Extract every Spring `<bean>` from a manual IM project's bundled XML files into one-bean-per-file under `src/main/resources/repo/beans/`, transform legacy event-route beans (rename priceFxConnection→priceFxClientName), rewrite property placeholders from `${...}` to `#{environment['...']}`, and add the `bean:` prefix to bare bean references in `<to uri="myBean"/>`.
---

# Migrate Manual → Provisioned: Beans

You are extracting Spring beans from a manual IM project and splitting them into the provisioned layout: one bean per file under `src/main/resources/repo/beans/{bean-id}.xml`. You also fix two related anti-patterns: event-route beans that use the deprecated `priceFxConnection` property name, and `<to>` route URIs that reference beans without the `bean:` prefix.

## Inputs

- **SOURCE_DIR** — original manual project (read-only)
- **TARGET_DIR** — current working directory (provisioned project, files written here)

## Step 1: Find Source XML Files

Glob every `*.xml` under SOURCE_DIR (skip `target/`, `.git/`, `.idea/`, `.gradle/`, `.mvn/`).

## Step 2: Extract Each `<bean>` Block

Run both patterns and collect every match:

| Pattern | Captures |
|---|---|
| `<bean[^s][^>]*?id="(.*?)"[^>]*?/>` | self-closing bean |
| `(?s)<bean[^s][^>]*?id="(.*?)"(.*?)</bean>` | block bean |

The `[^s]` exclusion avoids matching `<beans>` wrapper tags.

For each match, capture group 1 is the bean `id`. Sanitise the id for use as a filename: replace `/` with `_`, strip `'` and `"`.

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
