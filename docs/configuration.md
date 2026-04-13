# Properties & Configuration Guide

## Application Properties

The main configuration file is `src/main/resources/application.properties`.

### Required Properties

```properties
###############################################################################
# Common configuration
###############################################################################
integration.name=my-integration-manager

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
# Read lock — waits until file size stabilizes before processing (use when
# no .done marker is available). Default alternative to done.file.
###############################################################################
read.lock=readLock=changed

###############################################################################
# Done file — waits for a .done marker file before processing the data file
# (use instead of read.lock when the external system produces a .done marker)
###############################################################################
done.file=doneFileName=%24%7Bfile:name%7D.done

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

## Deployment Structure

Customer integration projects follow this directory structure:

```
my-integration/
├── src/
│   └── main/
│       ├── java/                          # Custom Java code (if needed)
│       └── resources/
│           ├── application.properties     # Main configuration
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

