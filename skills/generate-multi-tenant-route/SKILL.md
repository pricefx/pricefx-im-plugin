---
name: generate-multi-tenant-route
description: Generate a Pricefx Integration Manager multi-tenant routing structure where a single IM instance manages data flows for multiple independent Pricefx partitions (tenants, business units, or regions). Use this skill when the user needs per-partition event entry routes, a shared handler with partition-aware connection headers, partition-specific S3/SFTP destinations, or a supervisor scheduler that iterates over active partitions.
---

# Generate Multi-Tenant Route

You are generating a multi-tenant routing structure for a Pricefx Integration Manager project. Follow the steps below. This skill creates per-partition thin entry routes and a shared handler that uses a `partitionPfxApi` header to route API calls to the correct partition connection.

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Integration type** — what is being integrated across partitions:
   - `event` — react to a Pricefx event (e.g., action status, data load completed) per partition
   - `export` — export data from each partition to a shared or partition-specific destination
   - `import` — import data into each partition from partition-specific source paths
   - `supervisor` — a scheduler that iterates over active partitions and dispatches to per-partition routes
2. **Event type** (for `event` integrations) — the Pricefx event name (e.g., `ActionStatus`, `PADataLoadCompleted`, `QuoteSubmitted`).
3. **Partition list** — names and codes for each partition. For each partition, collect:
   - **Connection name** — the IM connection name (e.g., `Pricefx_PartitionA`). Must match the connection defined in IM configuration.
   - **Partition code** — short code used for file paths and property keys (e.g., `pa`, `eu`, `us`).
   - **Display name** — human-readable name (e.g., `Partition A`, `EU Region`).
4. **Shared handler route name** — the name for the shared logic route (e.g., `actionStatus-shared`, `export-data-shared`).
5. **Post-processing per partition** (for `export`) — does each partition need a partition-specific post-step (e.g., flush a DMDS data feed, write to a partition-specific S3 prefix)?
6. **Supervisor schedule** (for `supervisor`) — Quartz cron expression and timezone.
7. **Unmanaged interface tolerance** (for `event`) — should the shared handler silently ignore events for interfaces not deployed in this IM instance? Default: `yes`.

## Step 2: Plan Route Structure

For each integration type, the following files are generated:

| Integration type | Per-partition files | Shared file | Supervisor file |
|---|---|---|---|
| `event` | `event-{EventType}_{partition-code}.xml` per partition | `event-{EventType}-shared.xml` | — |
| `export` | `export-{name}-{partition-code}.xml` per partition | `export-{name}-shared.xml` | optional |
| `import` | `import-{name}-{partition-code}.xml` per partition | `import-{name}-shared.xml` | — |
| `supervisor` | — | shared handler files (already generated) | `supervisor-{name}.xml` |

Present the planned file list to the user for confirmation before generating.

## Step 3a: Generate Per-Partition Event Entry Routes

One file per partition in `src/main/resources/repo/routes/`.

**event-{EventType}_{partition-code}.xml** (repeat for each partition):

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="event-{EventType}_{partition-code}">
    <from uri="direct:{eventTypeEventReceived}{PartitionCode}"/>
    <setHeader name="partitionPfxApi">
      <constant>{Connection-Name}</constant>
    </setHeader>
    <to uri="direct:{eventType}-shared"/>
  </route>
</routes>
```

**Example** for two partitions and `ActionStatus` event:

```xml
<!-- event-ActionStatus_pa.xml -->
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="event-ActionStatus_pa">
    <from uri="direct:actionStatusEventReceivedPartitionA"/>
    <setHeader name="partitionPfxApi">
      <constant>Pricefx_PartitionA</constant>
    </setHeader>
    <to uri="direct:actionStatus-shared"/>
  </route>
</routes>
```

```xml
<!-- event-ActionStatus_pb.xml -->
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="event-ActionStatus_pb">
    <from uri="direct:actionStatusEventReceivedPartitionB"/>
    <setHeader name="partitionPfxApi">
      <constant>Pricefx_PartitionB</constant>
    </setHeader>
    <to uri="direct:actionStatus-shared"/>
  </route>
</routes>
```

The `direct:` URI naming convention for events is determined by the IM event framework. Confirm the exact `direct:` endpoint names with the user or from the IM event configuration.

## Step 3b: Generate the Shared Event Handler

File: `src/main/resources/repo/routes/{eventType}-shared.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="{eventType}-shared">
    <from uri="direct:{eventType}-shared"/>

    <!-- Extract interface names from the event payload -->
    <transform>
      <groovy>
        def fullFileNames = body.data.result;
        def interfaces = [];
        for (file in fullFileNames) {
          file.each {
            def fullName = it.key.split('/').last();
            def trimLength = 32;
            if (fullName.contains("common")) { trimLength = 36 }
            interfaces &lt;&lt; fullName.substring(0, fullName.length() - trimLength);
          };
        };
        return interfaces;
      </groovy>
    </transform>

    <split>
      <simple>${body}</simple>
      <setHeader name="interfaceName">
        <simple>${body}</simple>
      </setHeader>
      <log message="[{eventType}-shared] Calling ${header.interfaceName}-loaded for ${header.partitionPfxApi}" loggingLevel="INFO"/>

      <!-- Tolerate events for interfaces not managed by this IM instance -->
      <doTry>
        <toD uri="direct:${header.interfaceName}-loaded"/>
        <doCatch>
          <exception>org.apache.camel.component.direct.DirectConsumerNotAvailableException</exception>
          <transform><constant>true</constant></transform>
        </doCatch>
      </doTry>
    </split>
  </route>
</routes>
```

Adapt the Groovy `transform` block to match the actual event payload structure for the specific event type.

## Step 3c: Generate Per-Partition Export Entry Routes

One file per partition. Each thin route sets partition context headers and delegates to the shared export route.

**export-{name}-{partition-code}.xml** (repeat for each partition):

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="export-{name}-{partition-code}">
    <from uri="direct:export{Name}{PartitionCodePascal}"/>
    <setHeader name="partitionPfxApi">
      <simple>{Connection-Name}</simple>
    </setHeader>
    <setHeader name="partitionCode">
      <simple>{partition-code}</simple>
    </setHeader>
    <setHeader name="partitionFileName">
      <simple>{Display-Name}</simple>
    </setHeader>
    <to uri="direct:export-{name}-shared"/>
    <!-- Post-export: flush the data feed for this partition (if applicable) -->
    <!-- <toD uri="pfx-api:flush?dataFeedName=DMF.MyDataFeed&amp;dataSourceName=DMDS.MyDataFeed&amp;connection=${header.partitionPfxApi}"/> -->
  </route>
</routes>
```

## Step 3d: Generate the Shared Export Handler

File: `src/main/resources/repo/routes/export-{name}-shared.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="export-{name}-shared">
    <from uri="direct:export-{name}-shared"/>

    <!-- All pfx-api calls use ${header.partitionPfxApi} for the connection -->
    <toD uri="pfx-api:fetch?objectType={OBJECT_TYPE}&amp;filter={filter-id}&amp;connection=${header.partitionPfxApi}"/>

    <!-- Build partition-specific S3 key or SFTP path -->
    <setHeader name="CamelAwsS3Key">
      <simple>{{s3.bucket.subdir}}/${header.partitionCode.toUpperCase()}/Export/${header.interfaceFileName}.csv</simple>
    </setHeader>
    <toD uri="${header.s3Endpoint}"/>

    <log message="[export-{name}-shared] Export complete for ${header.partitionPfxApi}" loggingLevel="INFO"/>
  </route>
</routes>
```

## Step 3e: Generate the Supervisor Route (optional)

File: `src/main/resources/repo/routes/supervisor-{name}.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="supervisor-{name}">
    <from uri="quartz://supervisor-{name}?cron={{supervisor.{name}.cron}}&amp;trigger.timeZone={{supervisor.{name}.timezone}}&amp;stateful=true"/>

    <!-- Fetch active partition list from a shared Company Parameter table -->
    <toD uri="pfx-api:fetch?filter=fetch-active-partitions-filter&amp;objectType=MLTV&amp;valueFields=name&amp;connection={{shared.pfx.connection}}"/>
    <log message="[supervisor-{name}] Partitions to process: ${body}" loggingLevel="INFO"/>

    <split>
      <simple>${body}</simple>
      <choice>
        <when>
          <groovy>body == '{Connection-Name-A}'</groovy>
          <to uri="direct:export{Name}PartitionA"/>
        </when>
        <when>
          <groovy>body == '{Connection-Name-B}'</groovy>
          <to uri="direct:export{Name}PartitionB"/>
        </when>
        <!-- Add one <when> block per additional partition -->
      </choice>
    </split>

    <!-- Flush shared aggregation feed after all partitions complete (if applicable) -->
    <!-- <to uri="pfx-api:flush?dataFeedName=DMF.SharedOutput&amp;dataSourceName=DMDS.SharedOutput&amp;connection={{shared.pfx.connection}}"/> -->
  </route>
</routes>
```

## Step 4: Generate Properties

Add to `src/main/resources/repo/config/application.properties`:

```properties
# === Multi-Tenant Connections ===

# Partition A
pfx\:Pricefx_PartitionA.url=https://partitiona.pricefx.eu
pfx\:Pricefx_PartitionA.partition=partitiona
pfx\:Pricefx_PartitionA.username=integration-user
pfx\:Pricefx_PartitionA.password={ENC}...encryptedValue...

# Partition B
pfx\:Pricefx_PartitionB.url=https://partitionb.pricefx.eu
pfx\:Pricefx_PartitionB.partition=partitionb
pfx\:Pricefx_PartitionB.username=integration-user
pfx\:Pricefx_PartitionB.password={ENC}...encryptedValue...

# Add one block per additional partition

# === Supervisor Schedule (if applicable) ===
supervisor.{name}.cron=0+0+4+?+*+*
supervisor.{name}.timezone=UTC

# === Shared connection for supervisor partition lookup ===
shared.pfx.connection=Pricefx_PartitionA
```

The connection name (e.g., `Pricefx_PartitionA`) must exactly match the value used in `partitionPfxApi` headers and the `connection=` parameter in all `pfx-api:` URIs.

## Step 5: Self-Check

After generating all files, verify automatically:

1. Each per-partition route file has a **globally unique** route `id` (e.g., `event-ActionStatus_pa`, `event-ActionStatus_pb`).
2. `partitionPfxApi` is set as the **first** step in every per-partition entry route — before any processing or forwarding.
3. The shared handler uses `${header.partitionPfxApi}` (not a hardcoded connection name) in every `pfx-api:` call.
4. `<toD>` is used wherever the URI contains `${header.partitionPfxApi}` — `<to>` resolves the URI only once at route startup.
5. All `&` in URI parameters are escaped as `&amp;` in XML.
6. No credentials hardcoded in route XML — passwords use `{ENC}...` format in properties.
7. Supervisor route flushes the shared data feed AFTER all partitions complete — not inside the per-partition shared route.
8. `<doTry>/<doCatch>` for `DirectConsumerNotAvailableException` is present in the shared event handler if unmanaged interface tolerance is required.
9. Route IDs match file names without `.xml`.

Fix any issues silently and report corrections.

## Important Rules

- ALWAYS set `partitionPfxApi` as the FIRST step in every per-partition entry route — if it is missing or set after any processing, the shared handler will use the wrong partition or null
- NEVER hardcode the connection name inside the shared route — always read it from `${header.partitionPfxApi}` to keep the shared route truly generic
- Use `<toD>` (not `<to>`) for any URI that includes `${header.partitionPfxApi}` — `<to>` is resolved once at startup and cannot handle dynamic values
- Each per-partition route file MUST have a unique `id` — duplicate route IDs cause a startup failure or silent route override
- Flush the shared data feed ONLY in the supervisor or the per-partition entry route (after the shared route returns) — flushing inside the shared route triggers one flush per partition and can cause partial or duplicate flushes
- Wrap `<toD>` event dispatches in `<doTry>/<doCatch DirectConsumerNotAvailableException>` in the shared handler — events may reference interfaces not deployed in this IM instance, and unhandled exceptions stop the entire event processing
- The `direct:` URI for event entry routes is determined by the IM event framework convention — confirm the expected naming with the IM documentation or an existing integration before generating the `<from uri="direct:..."/>` values
- Connection names in `partitionPfxApi` headers and `pfx\:{ConnectionName}.*` properties MUST match exactly — a casing or spelling difference causes all API calls for that partition to fail silently or error
- `pfx\:` prefix in properties (e.g., `pfx\:Pricefx_PartitionA.url`) requires the colon to be escaped with `\` in Java `.properties` files — without the escape the property key is malformed
- Use `{ENC}...` encrypted values for all passwords in properties — never commit plain text credentials to source control

## References

- [S3 Integration Skill](../generate-s3-integration/SKILL.md) — for partition-specific S3 key path generation
- [Event-Driven Route Skill](../generate-event-driven-route/SKILL.md) — for single-partition event handling
- [Export Integration Skill](../generate-export-integration/SKILL.md) — for the Pricefx fetch/export steps used in the shared export handler
