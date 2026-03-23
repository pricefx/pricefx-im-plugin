# Properties & Configuration Guide

## Application Properties

The main configuration file is `src/main/resources/application.properties`.

### Required Properties

```properties
###############################################################################
# Common configuration
###############################################################################
integration.name=my-integration-manager

# Camel context XML location (default: classpath)
integration.context=classpath*:camel-context.xml

###############################################################################
# PFX Client (mandatory)
###############################################################################
integration.pfx.url=https://your-cluster.pricefx.eu/pricefx
integration.pfx.username=admin
integration.pfx.partition=your-partition
integration.pfx.password=your-password
integration.pfx.debug=false

###############################################################################
# Internal properties remapping (do not change)
###############################################################################
application.context=${integration.context}
logging.file.name=${integration.logging.file}
```

### Common Custom Properties

```properties
###############################################################################
# File archiving — moves processed files to timestamped archive folder
###############################################################################
archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D

###############################################################################
# Move failed files — moves files that fail processing to timestamped error folder
###############################################################################
error.file=moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D

###############################################################################
# Done file — waits for a .done marker file before processing the data file
###############################################################################
done.file=doneFileName=${file:name}.done

###############################################################################
# Data directories
###############################################################################
data.directory=/var/pricefx/data
rootFolder-outbound=/var/pricefx/data/export

###############################################################################
# Scheduler configuration
###############################################################################
scheduler-products=quartz://importProductTimer?cron=0+00+06+?+*+*&trigger.timeZone=America/New_York

scheduler-customer=quartz://importCustomer?cron=0+00+06+?+*+*&trigger.timeZone=America/New_York

###############################################################################
# CSV common options (reusable across routes)
###############################################################################
pfx-csv.common=&delimiter=,&ignoreEmptyLines=true

###############################################################################
# External system credentials
###############################################################################
salesforce.username=integrationuser@company.com
salesforce.password=password+securityToken
salesforce.clientId=your-client-id
salesforce.clientSecret=your-client-secret
salesforce.url=https://customer.my.salesforce.com
salesforce.authUrl=https://customer.my.salesforce.com/services/oauth2/token
salesforce.apiVersion=v48.0
```

## Property Placeholders in Routes

Reference any property using `{{property.name}}` in XML routes:

```xml
<!-- File paths -->
<from uri="file:{{data.directory}}/import/products?noop=true"/>

<!-- Scheduler URIs (externalize entire URI) -->
<from uri="{{scheduler-products}}"/>

<!-- Auto-startup flag -->
<route id="myRoute">

<!-- Append to component parameters -->
<to uri="pfx-csv:unmarshal?header=field1,field2{{pfx-csv.common}}"/>
```

## Camel Context XML

The `camel-context.xml` is the entry point that wires routes together:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:pfx="http://www.pricefx.eu/schema/pfx"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd
       http://camel.apache.org/schema/spring http://camel.apache.org/schema/spring/camel-spring.xsd
       http://www.pricefx.eu/schema/pfx http://www.pricefx.eu/schema/pfx.xsd">

    <!-- Import route files -->
    <import resource="refs/routes/ProductRoutes.xml"/>
    <import resource="refs/routes/CustomerRoutes.xml"/>

    <!-- Optional: custom beans -->
    <bean id="myBean" class="com.example.MyBean"/>

    <camelContext useMDCLogging="true" xmlns="http://camel.apache.org/schema/spring" errorHandlerRef="defaultErrorHandler">
        <contextScan/>
        <streamCaching id="streamCacheConfig" spoolEnabled="true" spoolThreshold="1"/>

        <!-- Reference imported routeContexts by ID -->
        <routeContextRef ref="productRoutes"/>
        <routeContextRef ref="customerRoutes"/>
    </camelContext>
</beans>
```

### Key camelContext Settings

| Attribute | Description |
|-----------|-------------|
| `useMDCLogging="true"` | Enable MDC logging for route tracing |
| `errorHandlerRef="defaultErrorHandler"` | Default error handler bean |
| `<contextScan/>` | Auto-discover route builders |
| `<streamCaching>` | Enable stream caching with spool to disk |

## Deployment Structure

Customer integration projects follow this directory structure:

```
my-integration/
├── src/
│   └── main/
│       ├── java/                          # Custom Java code (if needed)
│       └── resources/
│           ├── application.properties     # Main configuration
│           ├── camel-context.xml          # Route wiring
│           └── refs/
│               └── routes/
│                   ├── ProductRoutes.xml
│                   ├── CustomerRoutes.xml
│                   └── examples/          # Reference examples
├── config/                                # Runtime configuration (external)
│   ├── routes/                            # Route XML files
│   ├── mappers/                           # Standalone mapper files
│   ├── connections/                       # Connection JSON files
│   └── properties/                        # External properties
├── pom.xml
└── CLAUDE.md
```

## Quartz Scheduler Cron Syntax

Quartz cron expressions use 7 fields: `seconds minutes hours dayOfMonth month dayOfWeek year`

```properties
# Every 10 minutes
cron=0+0/10+*+*+*+?+*

# Daily at 6 AM
cron=0+00+06+?+*+*

# Every 30 minutes
cron=0+0/30+*+*+*+?+*

# Monday-Friday at 8 AM EST
cron=0+00+08+?+*+MON-FRI
```

Note: In XML URIs, spaces are encoded as `+` in Quartz cron expressions.

Add `&trigger.timeZone=America/New_York` for timezone-specific scheduling.

Use `stateful=true` to prevent overlapping executions:

```xml
<from uri="quartz://timerName?cron=0+0/10+*+*+*+?+*&amp;stateful=true"/>
```

## Error Handling

### Default Error Handler

The `defaultErrorHandler` is provided by IM framework. Custom error handlers can be defined:

```xml
<bean id="customErrorHandler" class="org.apache.camel.builder.DeadLetterChannelBuilder">
    <property name="deadLetterUri" value="log:dead?level=ERROR"/>
    <property name="redeliveryPolicy" ref="redeliveryPolicy"/>
</bean>

<bean id="redeliveryPolicy" class="org.apache.camel.processor.errorhandler.RedeliveryPolicy">
    <property name="maximumRedeliveries" value="3"/>
    <property name="redeliveryDelay" value="5000"/>
</bean>
```

### Route-Level Error Handling

```xml
<route id="myRoute" errorHandlerRef="customErrorHandler">
    <from uri="..."/>
    <doTry>
        <to uri="pfx-api:loaddata?..."/>
        <doCatch>
            <exception>java.lang.Exception</exception>
            <log message="Error processing: ${exception.message}" loggingLevel="ERROR"/>
        </doCatch>
        <doFinally>
            <log message="Processing complete"/>
        </doFinally>
    </doTry>
</route>
```

## Logging

### Route Logging

```xml
<log message="Processing ${header[CamelFileNameOnly]}" loggingLevel="INFO" logName="custom.trigger"/>
```

| Level | Usage |
|-------|-------|
| `INFO` | Normal progress messages |
| `WARN` | Recoverable issues |
| `ERROR` | Failures requiring attention |
| `DEBUG` | Detailed diagnostic info |

### Custom Logger Name

Use `logName` to categorize log output:

```xml
<log message="..." logName="custom.trigger"/>
<log message="..." logName="data.import"/>
```

## PFX XSD Bean Elements

Beyond mappers, the PFX XSD defines reusable beans for data operations:

| Element | Description | Key Attributes |
|---------|-------------|----------------|
| `<pfx:dsLoad>` | Load to data source | objectType, mapper, businessKeys |
| `<pfx:dsIntegrate>` | Integrate to data source | objectType, mapper, businessKeys, condition |
| `<pfx:dsFetch>` | Fetch from data source | objectType, filter |
| `<pfx:dsDelete>` | Delete from data source | objectType, filter |
| `<pfx:dmLoad>` | Load to data mart | dsUniqueName, mapper, businessKeys |
| `<pfx:dmCalculate>` | Calculate data mart | typedId, targetName |
| `<pfx:dmFlush>` | Flush data feed | dataSourceName, dataFeedName |
| `<pfx:dmTruncate>` | Truncate data mart | targetName |
| `<pfx:dmRefresh>` | Refresh data mart | dataMartName |
| `<pfx:dmCustomers>` | Load customers to DM | — |
| `<pfx:dmProducts>` | Load products to DM | — |
| `<pfx:ppvLoad>` | Load pricing parameters | mapper, tableType, pricingParameterName |
| `<pfx:ppvIntegrate>` | Integrate pricing params | mapper, tableType, pricingParameterName |
| `<pfx:ppvFetch>` | Fetch pricing params | pricingParameterName, filter |
| `<pfx:ppvDelete>` | Delete pricing params | pricingParameterName, filter |
| `<pfx:csvExport>` | CSV export pipeline | dataFormat, outputUri, batchSize |
| `<pfx:xmlExport>` | XML export pipeline | elementName, outputUri |
| `<pfx:dbExport>` | Database export pipeline | tableOrView, sqlDialect, dataSource |
| `<pfx:listToCsv>` | Convert list to CSV | outputUri, mapper, delimiter |
| `<pfx:filter>` | Reusable filter definition | resultFields, sortBy |
| `<pfx:connection>` | PFX connection bean | uri, partition, username, password |
