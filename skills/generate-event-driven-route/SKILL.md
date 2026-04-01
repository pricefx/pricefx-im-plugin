---
name: generate-event-driven-route
description: Generate a Pricefx event-driven integration route that reacts to Pricefx events (data load completion, calculation completion, custom events). Use this skill when the user wants to trigger a route after a Pricefx operation completes, react to events, set up event listeners, or create reactive integrations. Supports properties-based event mapping (recommended), direct pfx-event:fetch polling, and custom event publishing.
---

# Generate Event-Driven Route

You are generating an event-driven integration route for a Pricefx Integration Manager project. Event-driven routes react to Pricefx events instead of using timers or file consumers.

## Event Types Reference

| Event Type | When It Fires | Common Use Case |
|---|---|---|
| `PADATALOAD_COMPLETED` | After PA Data Source load finishes | Trigger export after import |
| `CALCULATION_COMPLETED_CFS` | After CFS calculation completes | Export calculation results |
| `REFRESH_COMPLETED` | After datamart refresh completes | Export refreshed data |
| `CUSTOM.*` | Custom events sent by other routes | Chain integrations together |

## Three Approaches

### Approach 1: Properties-Based Event Mapping (Recommended)

The simplest approach — configure event-to-route mapping in properties, write only the handler route.

**When to use:** Most cases. One event -> one handler route.

### Approach 2: Direct pfx-event:fetch Consumer

Use `pfx-event:fetch` as the route consumer for custom polling intervals or handling multiple event types.

**When to use:** Custom polling intervals, handling multiple event types with shared logic.

### Approach 3: Custom Event Publishing

Use `pfx-event:sendCustom` to publish custom events from within a route.

**When to use:** Chain integrations — route A completes -> fires event -> route B starts.

## Step 1: Check Credentials

Check `src/main/resources/repo/config/application.properties` for `integration.pfx.*` properties.

## Step 2: Determine Event Type

Ask the user: **What event should trigger the route?**

Show the common event types table above. If the user describes a scenario (e.g., "after PA calculation"), map it to the correct event type.

## Step 3: Determine Handler Action

Ask: **What should happen when the event fires?**

Common patterns:
- Export data to CSV/SFTP
- Trigger another import
- Refresh a datamart
- Send notification
- Call external API

## Step 4: Determine Approach

Based on the use case, recommend an approach:

| Scenario | Recommended Approach |
|---|---|
| Single event -> single handler | Approach 1 (properties-based) |
| Need custom polling interval | Approach 2 (pfx-event:fetch) |
| Need to filter/route events | Approach 2 (pfx-event:fetch) |
| Chain routes together | Approach 3 (sendCustom) |

## Step 5: Generate Files

### Approach 1: Properties-Based

**application.properties additions:**

```properties
# Enable event polling
integration.events.enabled=true

# Map event type to handler route
integration.events.event-to-route-mapping.{EVENT_TYPE}=direct:{handler-route-name}
```

**Handler route (routes/{name}.xml):**

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{handler-route-name}">
        <from uri="direct:{handler-route-name}"/>
        <log message="Event received: {EVENT_TYPE}" loggingLevel="INFO"/>

        <!-- Handler logic here (export, import, API call, etc.) -->

    </route>
</routes>
```

### Approach 2: Direct pfx-event:fetch

**Route (routes/{name}.xml):**

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="{name}">
        <from uri="pfx-event:fetch?eventType={EVENT_TYPE}&amp;delay=60000"/>
        <log message="Event received: ${header.PfxEventType}" loggingLevel="INFO"/>

        <!-- Handler logic here -->

    </route>
</routes>
```

**pfx-event:fetch parameters:**

| Parameter | Default | Description |
|---|---|---|
| `eventType` | — | Event type to listen for |
| `delay` | `60000` | Polling interval in ms (default: 1 minute) |
| `initialDelay` | `0` | Delay before first poll |
| `greedy` | `false` | If true, process all pending events in one poll cycle |

### Approach 3: Custom Event Publishing

**Publishing route (add to existing route):**

```xml
<onCompletion onCompleteOnly="true">
    <to uri="pfx-event:sendCustom?eventType=CUSTOM.{EVENT_NAME}"/>
</onCompletion>
```

**Receiving route (via properties):**

```properties
integration.events.event-to-route-mapping.CUSTOM.{EVENT_NAME}=direct:{handler-route}
```

## Step 6: Add Handler Logic

Based on what the user wants to do when the event fires, generate the handler route body using patterns from other skills:

- **Export:** Follow generate-export-integration patterns (fetch -> marshal -> file/SFTP)
- **Import:** Follow generate-import-integration patterns (file -> unmarshal -> loaddata)
- **Datamart refresh:** `<to uri="pfx-api:dmRefresh?targetName={dmName}"/>`
- **External API:** `<to uri="pfx-rest:post?url={{api.url}}&amp;connection=externalApi"/>`

## Example: Export After PA Data Load

```properties
integration.events.enabled=true
integration.events.event-to-route-mapping.PADATALOAD_COMPLETED=direct:export-after-load
```

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
    <route id="export-after-load">
        <from uri="direct:export-after-load"/>
        <log message="PA data load completed, starting export" loggingLevel="INFO"/>
        <to uri="pfx-api:fetch?objectType=DM&amp;dsUniqueName=Product&amp;batchedMode=true&amp;batchSize=5000"/>
        <split>
            <simple>${body}</simple>
            <to uri="pfx-api:fetchIterator"/>
            <to uri="pfx-csv:marshal"/>
            <to uri="file:{{integration.sftp.root}}/export?fileName=products-${date:now:yyyyMMdd-HHmmss}.csv&amp;fileExist=Append"/>
        </split>
        <log message="Export completed" loggingLevel="INFO"/>
    </route>
</routes>
```

## Example: Chain Two Routes via Custom Event

Import route publishes event on completion:
```xml
<route id="import-products">
    <from uri="file:{{integration.sftp.root}}/import/products?{{archive.file}}&amp;{{read.lock}}"/>
    <to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
    <to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;batchSize=200000"/>
    <onCompletion onCompleteOnly="true">
        <to uri="pfx-event:sendCustom?eventType=CUSTOM.PRODUCTS_IMPORTED"/>
    </onCompletion>
</route>
```

Handler route triggered by custom event:
```properties
integration.events.event-to-route-mapping.CUSTOM.PRODUCTS_IMPORTED=direct:refresh-after-import
```

```xml
<route id="refresh-after-import">
    <from uri="direct:refresh-after-import"/>
    <log message="Products imported, refreshing datamart" loggingLevel="INFO"/>
    <to uri="pfx-api:dmRefresh?targetName=ProductAnalytics"/>
</route>
```

## Important Rules

- **Approach 1 is recommended** for most cases — it's simpler and easier to maintain
- **Custom events MUST use `CUSTOM.` prefix** in event-to-route-mapping properties (e.g., `CUSTOM.MY_EVENT`)
- When using pfx-event:sendCustom, use `CUSTOM_` prefix in eventType parameter (e.g., `eventType=CUSTOM_MY_EVENT`) — note the underscore vs dot difference
- Event handler routes using `direct:` MUST have a corresponding `<from uri="direct:{name}"/>` route
- For Approach 2: the `delay` parameter controls how often IM polls for events — lower values mean faster reaction but more API calls
- **Resource ID naming rule:** The `id` attribute of routes MUST match the file name (without `.xml`)
- All `&` in URI attributes MUST be escaped as `&amp;`
- Do NOT include `connection=pricefx` — it's the default
- Use `{{integration.sftp.root}}` for file paths, never hardcode
