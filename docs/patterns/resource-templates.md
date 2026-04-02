# Resource Templates Pattern

This pattern covers how to store and reference external resource files — FreeMarker templates, XSLT stylesheets, Velocity templates, and static JSON/XML files — from Camel routes in an IM project.

## When to Use

| Engine | Best for |
|---|---|
| FreeMarker (`.ftl`) | Generating structured XML or HTML output (e.g., SOAP envelopes, IDoc payloads, HTML emails) |
| XSLT (`.xsl`) | Transforming or parsing XML documents (e.g., parsing SAP IDocs, converting one XML schema to another) |
| Velocity (`.vm`) | Generating plain-text or lightly structured output (e.g., email bodies, simple reports) |
| Static JSON/XML | Fixed lookup data, seed payloads, or test fixtures loaded at route startup |

Use `repo/classes/` (Groovy classes) instead when the logic requires conditional branching, external API calls, or reuse across multiple routes. See [Groovy Classes](#groovy-classes-repoclasses) below.

## How to Store Files

Place resource files in:

```
src/main/resources/repo/resources/{filename}
```

IM's `ResourcesService` deploys this directory to `{{integration.data}}/repository/resources/` on the IM pod filesystem at startup. There is no subdirectory convention — keep all files flat inside `resources/` unless the project is large enough to warrant grouping.

## How to Reference from Routes

Always use the `file://` URI scheme. Templates are NOT on the Camel classpath and `classpath:` will not find them.

```
file://{{integration.data}}/repository/resources/{filename}
```

### FreeMarker

```xml
<to uri="freemarker:file://{{integration.data}}/repository/resources/MyTemplate.ftl?allowContextMapAll=true"/>
```

Pass a structured model by setting the `CamelFreemarkerDataModel` header to a Groovy map before the `<to>`:

```xml
<setHeader name="CamelFreemarkerDataModel">
    <groovy>[ referenceId: exchange.properties.DATA_id, items: body ]</groovy>
</setHeader>
<setBody>
    <groovy>[ referenceId: exchange.properties.DATA_id, items: body ]</groovy>
</setBody>
<to uri="freemarker:file://{{integration.data}}/repository/resources/MyTemplate.ftl?allowContextMapAll=true"/>
```

Template rules:
- Always use `${field!""}` for optional fields — without the default, `null` renders as the literal string `"null"` in XML.
- Use `<#list items as item>...</#list>` for repeating elements.
- `allowContextMapAll=true` is required when the template needs access to exchange properties or headers beyond the body.

### XSLT

```xml
<to uri="xslt:file://{{integration.data}}/repository/resources/Transform.xsl"/>
```

The exchange body is passed as the XML input document. The result replaces the body.

### Velocity

```xml
<to uri="velocity:file://{{integration.data}}/repository/resources/email.vm"/>
```

## Example: SAP IDoc Generation (FreeMarker)

Route excerpt — preparing and rendering a SOAP/IDoc payload:

```xml
<setHeader name="CamelFreemarkerDataModel">
    <groovy>[ referenceId: exchange.properties.DATA_event_uniqueName, items: body ]</groovy>
</setHeader>
<setBody>
    <groovy>[ referenceId: exchange.properties.DATA_event_uniqueName, items: body ]</groovy>
</setBody>
<to uri="freemarker:file://{{integration.data}}/repository/resources/PriceList_IDoc.ftl?allowContextMapAll=true"/>
```

Template file `src/main/resources/repo/resources/PriceList_IDoc.ftl`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <PRICES_SEND>
      <IDOC BEGIN="1">
        <EDI_DC40 SEGMENT="1">
          <DOCREL>${docRel!""}</DOCREL>
          <MESTYP>PRICES</MESTYP>
        </EDI_DC40>
        <#list items as item>
        <E1WP1001 SEGMENT="1">
          <MATNR>${item.sku!""}</MATNR>
          <KONDM>${item.priceGroup!""}</KONDM>
          <KBETR>${item.price!""}</KBETR>
        </E1WP1001>
        </#list>
      </IDOC>
    </PRICES_SEND>
  </soapenv:Body>
</soapenv:Envelope>
```

## Example: SAP IDoc Parsing (XSLT)

Route excerpt:

```xml
<to uri="xslt:file://{{integration.data}}/repository/resources/IDoc_to_Products.xsl"/>
<to uri="pfx-json:unmarshal"/>
```

The XSLT transforms an inbound IDoc XML into a JSON-compatible structure. The result replaces the body and is then unmarshalled into a Groovy map for further processing.

## Groovy Classes (repo/classes/)

Use `src/main/resources/repo/classes/` (not `resources/`) when you need a reusable Java/Groovy class — for example, a custom bean that formats dates or performs business logic shared across routes.

Classes are compiled at startup and registered as Spring beans. Reference them from routes:

```xml
<bean ref="myHelperBean" method="transform"/>
```

Do NOT use `repo/classes/` for template rendering — that is the role of FreeMarker/XSLT/Velocity in `repo/resources/`.

## Common Mistakes

| Mistake | Correct Approach |
|---|---|
| `freemarker:classpath:templates/MyTemplate.ftl` | `freemarker:file://{{integration.data}}/repository/resources/MyTemplate.ftl` |
| Omitting `?allowContextMapAll=true` when the template needs exchange properties | Always add `allowContextMapAll=true` when properties or headers are referenced in the template |
| Placing `.ftl` files in `repo/routes/` or `repo/beans/` | Files must be in `repo/resources/` — only that directory is deployed to `repository/resources/` at runtime |
| Using `${field}` without a default for optional fields | Use `${field!""}` — `null` renders as `"null"` without the FreeMarker default operator |
| Referencing a file with a `classpath:` prefix | Use `file://` — templates are not on the classpath after IM startup |
