# XML Route Authoring Guide

## Route File Formats

There are two XML formats for defining routes:

### Format 1: Routes with Beans (most common)

Used when routes need mapper or filter bean definitions. Uses Spring `<beans>` as root with `<routeContext>` inside.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:pfx="http://www.pricefx.eu/schema/pfx"
       xmlns:util="http://www.springframework.org/schema/util"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
       http://www.springframework.org/schema/util http://www.springframework.org/schema/util/spring-util.xsd
       http://camel.apache.org/schema/spring http://camel.apache.org/schema/spring/camel-spring.xsd
       http://www.pricefx.eu/schema/pfx http://www.pricefx.eu/schema/pfx.xsd">

    <!-- Bean definitions (mappers, filters) go here -->
    <pfx:loadMapper id="myMapper">
        <pfx:body in="sku" out="sku"/>
    </pfx:loadMapper>

    <routeContext id="myRoutes" xmlns="http://camel.apache.org/schema/spring">
        <route id="myRoute">
            <from uri="..."/>
            <to uri="..."/>
        </route>
    </routeContext>
</beans>
```

### Format 2: Standalone Routes

Used for simple routes without bean definitions. Uses `<routes>` as root.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="myRoute">
        <from uri="..."/>
        <to uri="..."/>
    </route>
</routes>
```

## Registering Routes in camel-context.xml

Routes must be imported and referenced in `camel-context.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:pfx="http://www.pricefx.eu/schema/pfx"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
       http://camel.apache.org/schema/spring http://camel.apache.org/schema/spring/camel-spring.xsd
       http://www.pricefx.eu/schema/pfx http://www.pricefx.eu/schema/pfx.xsd">

    <import resource="refs/routes/MyRoutes.xml"/>

    <camelContext useMDCLogging="true" xmlns="http://camel.apache.org/schema/spring" errorHandlerRef="defaultErrorHandler">
        <contextScan/>
        <streamCaching id="streamCacheConfig" spoolEnabled="true" spoolThreshold="1"/>
        <routeContextRef ref="myRoutes"/>
    </camelContext>
</beans>
```

## Common Route Patterns

### Pattern 1: Inbound CSV to Pricefx (Product Load)

The most common pattern — read a CSV file, unmarshal it, and load into Pricefx.

```xml
<pfx:loadMapper id="productMapper">
    <pfx:body in="partNumber"  out="sku"/>
    <pfx:body in="description" out="label"/>
    <pfx:body in="uom"         out="attribute1"/>
    <pfx:body in="price"       out="attribute2" converterExpression="stringToInteger"/>
</pfx:loadMapper>

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
<pfx:filter id="fetchFilter" sortBy="id" resultFields="field1,field2,field3">
    <pfx:and/>
</pfx:filter>

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
<pfx:loadMapper id="customerMapper">
    <pfx:groovy expression="body.Name"       out="name"/>
    <pfx:groovy expression="body.Id"         out="customerId"/>
    <pfx:groovy expression="body.Segment__c" out="attribute1"/>
</pfx:loadMapper>

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
<pfx:integrateMapper id="currencyMapper">
    <pfx:body in="name"/>
    <pfx:body in="value"/>
</pfx:integrateMapper>

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
<pfx:loadMapper id="ltvMapper">
    <pfx:body in="code" out="name"/>
    <pfx:body in="value" out="value"/>
</pfx:loadMapper>

<route id="importLTV">
    <from uri="file:{{data.directory}}/import/ppv/currency?noop=true"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <to uri="pfx-api:loaddata?objectType=LTV&amp;mapper=ltvMapper&amp;pricingParameterName=currency"/>
</route>

<!-- Multi-key matrix table (MLTV2) -->
<pfx:loadMapper id="mltvMapper">
    <pfx:body in="key1" out="key1"/>
    <pfx:body in="key2" out="key2"/>
    <pfx:body in="attribute1" out="attribute1"/>
</pfx:loadMapper>

<route id="importMLTV2">
    <from uri="file:{{data.directory}}/import/ppv/matrix?noop=true"/>
    <to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
    <to uri="pfx-api:loaddata?objectType=MLTV2&amp;mapper=mltvMapper&amp;pricingParameterName=matrixTable"/>
</route>
```

### Pattern 7: Event Polling

Listen for Pricefx system events and react.

```xml
<route id="fetchEvents">
    <from uri="pfx-api:events?delay=60000&amp;eventTypes=ITEM_UPDATE_PPV,PADATALOAD_COMPLETED"/>
    <log message="Event: ${body[operation]}"/>
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
<pfx:filter id="crFilter">
    <pfx:and>
        <pfx:criterion fieldName="conditionRecordSetId" operator="equals" value="8"/>
    </pfx:and>
</pfx:filter>

<pfx:loadMapper id="crMapper">
    <pfx:constant expression="myConditionSet" out="conditionRecordSetName"/>
    <pfx:body in="key1" out="key1"/>
    <pfx:body in="validFrom" out="validFrom"/>
    <pfx:body in="validTo" out="validTo"/>
    <pfx:body in="conditionValue" out="conditionValue"/>
</pfx:loadMapper>

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
<pfx:filter id="myFilter" sortBy="id" resultFields="field1,field2,field3">
    <pfx:and>
        <pfx:criterion fieldName="status" operator="equals" value="Active"/>
        <pfx:criterion fieldName="name" operator="notNull"/>
    </pfx:and>
</pfx:filter>
```

**Available operators:** `equals`, `notEqual`, `greaterThan`, `lessThan`, `greaterOrEqual`, `lessOrEqual`, `contains`, `startsWith`, `endsWith`, `isNull`, `notNull`, `inSet`, `notInSet`, `iContains`, `iStartsWith`, `iEndsWith`, `iNotContains`, `notContains`, `custom`

Nested logic with `<pfx:and>`, `<pfx:or>`, `<pfx:not>`:

```xml
<pfx:filter id="complexFilter">
    <pfx:or>
        <pfx:and>
            <pfx:criterion fieldName="status" operator="equals" value="Active"/>
            <pfx:criterion fieldName="region" operator="equals" value="US"/>
        </pfx:and>
        <pfx:criterion fieldName="priority" operator="equals" value="High"/>
    </pfx:or>
</pfx:filter>
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
