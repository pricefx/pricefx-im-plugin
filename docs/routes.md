# XML Route Authoring Guide

## Route File Format

Routes use `<routes>` as the root element:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="myRoute">
        <from uri="..."/>
        <to uri="..."/>
    </route>
</routes>
```

## Camel 3 ↔ Camel 4 — version-aware attribute names

A handful of EIP attributes and a few URI schemes were renamed between Camel 3 (shipped in IM ≤ 6.x) and Camel 4 (IM 7.x). Generation skills must emit the form that matches the **target project's Camel version**, not a fixed default.

### How to detect

Read `<camel.version>` from the target `pom.xml`. If missing, infer from IM version using the layered recipe in `skills/migrate-manual-to-provisioned-pom/SKILL.md` Step 1 (parent BOM lookup → IM-major → Camel inference table → `mvn dependency:list` fallback).

| Detected | Use |
|---|---|
| Camel 4.x (or IM ≥ 7.0) | **Camel 4 form** (modern, non-`Ref`) |
| Camel 3.x (or IM ≤ 6.x) | **Camel 3 form** (`*Ref`, legacy URI schemes) |
| Unknown | Default to **Camel 4** and flag the assumption in the route's generation report |

### Attribute mapping

| Camel 3 (IM ≤ 6.x) | Camel 4 (IM 7.x+) | Where it appears |
|---|---|---|
| `errorHandlerRef=` | `errorHandler=` | `<route>`, `<camelContext>` |
| `redeliveryPolicyRef=` | `redeliveryPolicy=` | `<onException>` |
| `strategyRef=` | `aggregationStrategy=` | `<split>`, `<aggregate>` |
| `aggregationRepositoryRef=` | `aggregationRepository=` | `<aggregate>` |
| `executorServiceRef=` | `executorService=` | `<multicast>`, `<split>`, `<aggregate>` |
| `routePolicyRef=` | `routePolicy=` | `<route>` |
| `onRedeliveryRef=` | `onRedelivery=` | `<onException>` |
| `<inOnly uri="X"/>` | `<to uri="X" pattern="InOnly"/>` | route body |
| `<inOut uri="X"/>` | `<to uri="X" pattern="InOut"/>` | route body |
| `<routeContext id="X">…</routeContext>` wrapper | `<routes>…</routes>` only (no wrapper) | route XML root |
| `${pfx:foo}` (Simple syntax) | `{{pfx:foo}}` (property placeholder) | URI attributes |
| `quartz2:` | `quartz:` | `<from uri=…>` |
| `vm:` | `seda:` | `<to>`, `<from>` |
| `direct-vm:` | `direct:` | `<to>`, `<from>` |
| `aws-s3:` | `aws2-s3:` | `<to>`, `<from>` |

These are the same renames the migration agents detect — see `docs/anti-patterns.md` AP-20..AP-26 for the migration angle.

### Examples below

Every generation skill in this plugin shows its templates in **Camel 4** form (the IM 7.x default). When the detected target is Camel 3, swap the attributes per the table above before writing the file.

## Common Route Patterns

### Pattern 1: Inbound CSV to Pricefx (Product Load)

The most common pattern — read a CSV file, unmarshal it, and load into Pricefx.

```xml
<loadMapper id="productMapper">
    <body in="partNumber"  out="sku"/>
    <body in="description" out="label"/>
    <body in="uom"         out="attribute1"/>
    <body in="price"       out="attribute2" converterExpression="stringToInteger"/>
</loadMapper>

<routeContext id="productRoutes" xmlns="http://camel.apache.org/schema/spring">
    <route id="importProducts">
        <from uri="file:{{data.directory}}/import/p?noop=true"/>
        <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
        <to uri="pfx-api:loaddata?objectType=P&amp;mapper=productMapper&amp;businessKeys=sku"/>
    </route>
</routeContext>
```

### Pattern 2: Inbound CSV with Split/Batch Processing

For large files, use `tokenize` to split into chunks and `recordsCountAggregation` to track totals.

```xml
<route id="importLargeFile">
    <from uri="{{fromUri}}"/>
    <split aggregationStrategy="recordsCountAggregation" streaming="true">
        <tokenize token="\n" group="50000"/>
        <setProperty name="CamelCharsetName">
            <constant>UTF-8</constant>
        </setProperty>
        <to uri="pfx-csv:unmarshal?header=field1,field2,field3&amp;skipHeaderRecord=true"/>
        <log message="Loading batch from ${header[CamelFileNameOnly]}"/>
        <to uri="pfx-api:loaddata?objectType=P&amp;mapper=myMapper&amp;businessKeys=sku"/>
    </split>
    <log message="Total records: ${header.PfxTotalInputRecordsCount}"/>
    <onCompletion onCompleteOnly="true">
        <to uri="pfx-api:internalCopy?label=Product"/>
    </onCompletion>
</route>
```

### Pattern 3: Outbound Pricefx to CSV Export

Fetch data from Pricefx, transform, and write to CSV file.

```xml
<filter id="fetchFilter" sortBy="id" resultFields="field1,field2,field3">
    <and/>
</filter>

<route id="exportData">
    <from uri="direct:exportData"/>
    <setHeader name="CamelFileName">
        <constant>export.csv</constant>
    </setHeader>
    <toD uri="pfx-api:fetch?objectType=DM&amp;dsUniqueName=DMDS.MyDataSource&amp;filter=fetchFilter&amp;batchedMode=true&amp;batchSize=50000"/>
    <split>
        <simple>${body}</simple>
        <toD uri="pfx-api:fetch?objectType=DM&amp;dsUniqueName=DMDS.MyDataSource&amp;filter=fetchFilter"/>
        <toD uri="pfx-model:transform?mapper=exportMapper"/>
        <toD uri="pfx-csv:marshal"/>
        <to uri="file://{{rootFolder-outbound}}?fileName=${header[CamelFileName]}&amp;fileExist=Append"/>
    </split>
</route>
```

### Pattern 4: REST API Integration (Salesforce Example)

Call an external REST API, unmarshal JSON, and load into Pricefx.

```xml
<loadMapper id="customerMapper">
    <groovy expression="body.Name"       out="name"/>
    <groovy expression="body.Id"         out="customerId"/>
    <groovy expression="body.Segment__c" out="attribute1"/>
</loadMapper>

<route id="importFromAPI">
    <from uri="timer:runOnce?repeatCount=1"/>
    <!-- Get last sync date from Pricefx config store -->
    <to uri="pfx-config:get?name=LAST_SYNC_DATE&amp;toHeader=lastUpdate&amp;defaultValue=1900-01-01T00:00:00Z"/>
    <setHeader name="nowDate">
        <simple>${date:now:yyyy-MM-dd'T'HH:mm:ss'.000Z'}</simple>
    </setHeader>
    <!-- Fetch from external API -->
    <toD uri="pfx-rest:get?uri=/api/endpoint&amp;connection=myRestConnection&amp;connectionTimeoutMs=500000"/>
    <to uri="pfx-json:unmarshal"/>
    <!-- Load into Pricefx -->
    <to uri="pfx-api:loaddata?objectType=C&amp;mapper=customerMapper&amp;businessKeys=customerId"/>
    <!-- Update last sync date -->
    <toD uri="pfx-config:set?name=LAST_SYNC_DATE&amp;value=${header.nowDate}"/>
    <to uri="pfx-api:internalCopy?label=Customer"/>
</route>
```

### Pattern 5: Integrate (Upsert) Pattern

Use `integrate` instead of `loaddata` when you need to update existing records.

```xml
<integrateMapper id="currencyMapper">
    <body in="name"/>
    <body in="value"/>
</integrateMapper>

<route id="updateCurrencies">
    <from uri="quartz://currencyTimer?cron=0+0/30+*+*+*+?+*&amp;stateful=true"/>
    <to uri="http://api.exchangeratesapi.io/latest"/>
    <to uri="jolt:classpath:jolt/transform.jolt?inputType=JsonString&amp;outputType=Hydrated"/>
    <to uri="pfx-api:integrate?objectType=LTV&amp;mapper=currencyMapper&amp;pricingParameterName=ExchangeRate"/>
</route>
```

### Pattern 6: Pricing Parameter Load (LTV / MLTV2)

```xml
<!-- Single-key lookup table (LTV) -->
<loadMapper id="ltvMapper">
    <body in="code" out="name"/>
    <body in="value" out="value"/>
</loadMapper>

<route id="importLTV">
    <from uri="file:{{data.directory}}/import/ppv/currency?noop=true"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <to uri="pfx-api:loaddata?objectType=LTV&amp;mapper=ltvMapper&amp;pricingParameterName=currency"/>
</route>

<!-- Multi-key matrix table (MLTV2) -->
<loadMapper id="mltvMapper">
    <body in="key1" out="key1"/>
    <body in="key2" out="key2"/>
    <body in="attribute1" out="attribute1"/>
</loadMapper>

<route id="importMLTV2">
    <from uri="file:{{data.directory}}/import/ppv/matrix?noop=true"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <to uri="pfx-api:loaddata?objectType=MLTV2&amp;mapper=mltvMapper&amp;pricingParameterName=matrixTable"/>
</route>
```

### Pattern 7: Event Polling

Listen for Pricefx system events and react. The consumer is `pfx-event:fetch`; one route listens for one `eventType` — use multiple routes (or a `<choice>` downstream) for multiple types.

```xml
<route id="fetchEvents">
    <from uri="pfx-event:fetch?eventType=ITEM_UPDATE_PPV&amp;delay=60000"/>
    <log message="Event received: ${header.PfxEventType}"/>
    <to uri="direct:handleEvent"/>
</route>
```

### Pattern 8: SFTP File Transfer

```xml
<route id="sftpDownload">
    <from uri="pfx-sftp://remote/path?connection=sftpConnection&amp;delete=true"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <to uri="pfx-api:loaddata?objectType=P&amp;mapper=myMapper&amp;businessKeys=sku"/>
</route>
```

### Pattern 9: Condition Records

```xml
<filter id="crFilter">
    <and>
        <criterion fieldName="conditionRecordSetId" operator="equals" value="8"/>
    </and>
</filter>

<loadMapper id="crMapper">
    <constant expression="myConditionSet" out="conditionRecordSetName"/>
    <body in="key1" out="key1"/>
    <body in="validFrom" out="validFrom"/>
    <body in="validTo" out="validTo"/>
    <body in="conditionValue" out="conditionValue"/>
</loadMapper>

<route id="loadConditionRecords">
    <from uri="file:{{data.directory}}/import/condition-records?noop=true"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <to uri="pfx-api:loaddata?objectType=CRCP&amp;mapper=crMapper"/>
</route>

<route id="fetchConditionRecords">
    <from uri="timer://runOnce?repeatCount=1&amp;delay=5000"/>
    <to uri="pfx-api:fetch?objectType=CRCI1&amp;filter=crFilter"/>
    <log message="${body}"/>
</route>
```

## Scheduling

### Quartz Scheduler

```xml
<!-- Run every 10 minutes -->
<from uri="quartz://timerName?cron=0+0/10+*+*+*+?+*&amp;stateful=true"/>

<!-- Run daily at 6 AM EST -->
<from uri="quartz://timerName?cron=0+00+06+?+*+*&amp;trigger.timeZone=America/New_York"/>
```

Use `stateful=true` to prevent overlapping executions.

### Timer (One-shot)

```xml
<from uri="timer://runOnce?repeatCount=1"/>
<from uri="timer://delayed?repeatCount=1&amp;delay=5000"/>
```

### File Polling

```xml
<!-- noop=true: don't move/delete processed files -->
<from uri="file:{{data.directory}}/import/products?noop=true"/>

<!-- delete=true: delete files after processing -->
<from uri="file:{{data.directory}}/import/products?delete=true"/>
```

### File Polling with Scheduler

```xml
<!-- delete=true: delete files after processing -->
<from uri="file:{{data.directory}}/import/products?delete=true&amp;scheduler=quartz&amp;scheduler.cron=0+0/10+*+*+*+?+*&amp;scheduler.timeZone=CET"/>
```

### File Polling without lock processing file older then 5 minutes
Used when there is no signal file. Avoids locking files and scanning all files for writes.
```xml
<!-- File Filter definition is deserialized for clarity. --> 
<from uri="file:{{data.directory}}/import/products?delete=true&amp;filterFile=${file:modified} < ${date:now-5m}"/>
<!-- Serialized version of the above URI: -->
<from uri="file:{{data.directory}}/import/products?delete=true&amp;filterFile=%24%7Bfile%3Amodified%7D+%3C+%7Bdate%3Anow-5m%7D"/>
```
## Error Handling

### doTry/doCatch

```xml
<route id="safeRoute">
    <from uri="direct:start"/>
    <doTry>
        <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
        <to uri="pfx-api:loaddata?objectType=P&amp;mapper=myMapper"/>
        <doCatch>
            <exception>java.lang.Exception</exception>
            <log message="Error: ${exception.message}" loggingLevel="ERROR"/>
        </doCatch>
    </doTry>
</route>
```

### onCompletion

```xml
<route id="routeWithCompletion">
    <from uri="direct:start"/>
    <to uri="pfx-api:loaddata?objectType=P&amp;mapper=myMapper"/>
    <onCompletion onCompleteOnly="true">
        <log message="Triggering internal copy"/>
        <to uri="pfx-api:internalCopy?label=Product"/>
    </onCompletion>
</route>
```

## Property Placeholders

Use `{{property.name}}` to reference values from `application.properties`:

```xml
<from uri="file:{{data.directory}}/import/products?noop=true"/>
<from uri="{{scheduler-products}}"/>
<route id="myRoute">
```

## Filters

Define reusable filters for fetch and delete operations:

```xml
<filter id="myFilter" sortBy="id" resultFields="field1,field2,field3">
    <and>
        <criterion fieldName="status" operator="equals" value="Active"/>
        <criterion fieldName="name" operator="notNull"/>
    </and>
</filter>
```

**Available operators:** `equals`, `notEqual`, `greaterThan`, `lessThan`, `greaterOrEqual`, `lessOrEqual`, `contains`, `startsWith`, `endsWith`, `isNull`, `notNull`, `inSet`, `notInSet`, `iContains`, `iStartsWith`, `iEndsWith`, `iNotContains`, `notContains`, `custom`

Nested logic with `<and>`, `<or>`, `<not>`:

```xml
<filter id="complexFilter">
    <or>
        <and>
            <criterion fieldName="status" operator="equals" value="Active"/>
            <criterion fieldName="region" operator="equals" value="US"/>
        </and>
        <criterion fieldName="priority" operator="equals" value="High"/>
    </or>
</filter>
```

## Using Resource Files (Templates)

Resource files such as FreeMarker templates (`.ftl`), XSLT stylesheets (`.xsl`), Velocity templates (`.vm`), and static JSON/XML files are stored in the project under `src/main/resources/repo/resources/`. At runtime, IM deploys this directory to `{{integration.data}}/repository/resources/` on the filesystem.

Routes must reference resource files using the `file://` URI scheme — **not** `classpath:`. Templates are NOT on the Camel classpath.

### FreeMarker

```xml
<to uri="freemarker:file://{{integration.data}}/repository/resources/MyTemplate.ftl?allowContextMapAll=true"/>
```

- `allowContextMapAll=true` exposes all exchange properties and headers to the template, not just the body.
- Use `${field!""}` for optional fields to prevent `null` from rendering as the literal string `"null"`.
- Set `CamelFreemarkerDataModel` header to a Groovy map to pass a structured model to the template.

### XSLT

```xml
<to uri="xslt:file://{{integration.data}}/repository/resources/Transform.xsl"/>
```

### Velocity

```xml
<to uri="velocity:file://{{integration.data}}/repository/resources/email.vm"/>
```

### Summary

| Store file at | Reference from route |
|---|---|
| `src/main/resources/repo/resources/{filename}` | `file://{{integration.data}}/repository/resources/{filename}` |

For a deeper guide including common mistakes and when to use each template engine, see [Resource Templates Pattern](patterns/resource-templates.md).

## XML Escaping Reminders

In XML attributes, always escape:
- `&` → `&amp;` (most common in URIs with multiple parameters)
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;` (inside attribute values using double quotes)
