---
name: generate-kafka-integration
description: Use when the user wants to consume Kafka CDC (change-data-capture) events into a Pricefx Data Source (DMDS) — says "Kafka consumer", "near-real-time ingestion", "CDC events", "stream into PA", or needs multi-tenant OPCO grouping, sequence-based deduplication, or a dual-pipeline setup alongside an existing file-based import route.
---

# Generate Kafka Integration

You are generating a Kafka consumer integration for a Pricefx Integration Manager project. Follow the steps below. This skill creates a Kafka consumer route that reads CDC events, deduplicates them, groups by OPCO, and loads batches into a Pricefx DMDS table.

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Entity name** — the logical name of the data being consumed (e.g., `item-master`, `customer-master`, `price-list`). Used to name files and properties.
2. **Kafka topic** — the full topic name to consume from (e.g., `cdc.source-system.items`).
3. **DMDS table prefix** — the base name of the target Pricefx Data Source table. The OPCO code will be appended at runtime (e.g., `ItemMaster` → loads into `ItemMaster_US`, `ItemMaster_EU`, etc.).
4. **Consumer group ID** — a unique Kafka consumer group ID (e.g., `pricefx_{entity}_consumer`). Must be unique per route in the Kafka cluster.
5. **Message format** — how records arrive in Kafka messages:
   - `json-array` — message body is a JSON array of records
   - `json-single` — message body is a single JSON object per message
   - `avro` — binary Avro (requires schema registry; ask for schema registry URL)
6. **OPCO field** — the field in each Kafka record that identifies the operating company/tenant (e.g., `OPCO`, `region`, `company`). Used for grouping.
7. **Business key fields** — comma-separated field names that form the unique key per record (e.g., `ITEM_ID,PLANT_CODE`). Used for sequence-key deduplication.
8. **Sequence key fields** — fields used to determine record freshness. Default: `opTimeStamp,sequenceNumber`.
9. **Dual-pipeline?** — is there also a file-based import route for the same entity? (yes/no). If yes, note the existing route name — the Kafka route must use the same mapper and table prefix.
10. **Aggregation timeout** — how long (in ms) to wait for an OPCO batch to fill before loading. Default: `30000` (30 seconds).
11. **Max poll records** — how many Kafka records to fetch per poll. Default: `500`.

## Step 2: Design the Route Structure

Based on the answers, plan the following files:

- `src/main/resources/repo/routes/import-kafka-ds-{entity}-route.xml` — the Kafka consumer route
- Mapper: either reference the existing mapper from the file route, or create a new one at `src/main/resources/repo/mappers/import-kafka-ds-{entity}-route.mapper.xml`
- Properties block in `application.properties`

If dual-pipeline is `yes`, the mapper ID must match the existing file route mapper. Confirm the existing mapper name with the user.

## Step 3: Generate the Kafka Consumer Route

File: `src/main/resources/repo/routes/import-kafka-ds-{entity}-route.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-kafka-ds-{entity}-route">
    <from uri="kafka:{{import-kafka-ds-{entity}-route.kafka.topic}}?{{import-kafka-ds-{entity}-route.kafka-general-parameters}}{{import-kafka-ds-{entity}-route.kafka.performance-parameters}}{{pfx:general-kafka-error-connectivity-parameters}}{{pfx:general-kafka-security-parameters}}"/>

    <onCompletion onCompleteOnly="true">
      <to uri="direct:kafkaOnCompletion"/>
    </onCompletion>

    <onException>
      <exception>java.lang.Exception</exception>
      <handled>
        <constant>false</constant>
      </handled>
      <to uri="direct:kafkaOnException"/>
    </onException>

    <!-- Capture start time and route context for logging/metrics -->
    <setHeader name="interfaceStartTimestamp">
      <simple>${date:now:yyyy-MM-dd HH:mm:ss.SSS}</simple>
    </setHeader>
    <setHeader name="originalRouteId">
      <simple>${routeId}</simple>
    </setHeader>
    <setHeader name="prefixTableName">
      <constant>{{import-kafka-ds-{entity}-route.prefix.tableName}}</constant>
    </setHeader>

    <!-- Guard: skip empty messages -->
    <filter>
      <simple>${body} == null</simple>
      <log loggingLevel="DEBUG" message="No Exchange to Process"/>
      <setHeader name="status"><constant>Empty Kafka message</constant></setHeader>
      <stop/>
    </filter>

    <!--
        Parse the raw Kafka JSON payload.
        Each record is enriched with: OPCO, opTimeStamp, sequenceNumber, manipType.
        Sets header bodySize = number of parsed records.
    -->
    <process ref="processorKafkaJsonMessageParser"/>
    <filter>
      <simple>${headers.bodySize} == 0</simple>
      <log loggingLevel="DEBUG" message="No Records to Process After JSON parsing"/>
      <setHeader name="status"><constant>No relevant data in Kafka message</constant></setHeader>
      <stop/>
    </filter>
    <log loggingLevel="DEBUG" message="After JSON parse: bodySize=${headers.bodySize}"/>

    <!--
        OPTIONAL: Domain-specific business filtering.
        Remove this block if no pre-filter is needed.
    -->
    <process ref="processorBusinessFiltering"/>
    <filter>
      <simple>${headers.bodySize} == 0</simple>
      <log loggingLevel="DEBUG" message="No Records to Process After Business Filtering"/>
      <setHeader name="status"><constant>No relevant data after business filtering</constant></setHeader>
      <stop/>
    </filter>

    <!--
        Sequence-key deduplication via database.
        Drops any record whose (opTimeStamp, sequenceNumber) is not newer
        than the last committed value for that business key.
    -->
    <process ref="processorSequenceKeyDatabaseFilter"/>
    <filter>
      <simple>${headers.bodySize} == 0</simple>
      <log loggingLevel="DEBUG" message="No Records to Process After Database Filtering"/>
      <setHeader name="status"><constant>No relevant data after DB filtering</constant></setHeader>
      <stop/>
    </filter>
    <log loggingLevel="DEBUG" message="After DB filter: bodySize=${headers.bodySize}"/>

    <!--
        OPTIONAL: Field-level data transformation before load.
        Remove this block if no transformation is required.
    -->
    <process ref="processorDataTransformation"/>
    <log loggingLevel="DEBUG" message="After transformation: bodySize=${headers.bodySize}"/>

    <!--
        Group records by OPCO.
        Sets header groupCount = number of distinct OPCOs.
    -->
    <process ref="processorOpCodeGroup"/>
    <log loggingLevel="DEBUG" message="After OPCO grouping: groupCount=${headers.groupCount}"/>

    <!--
        Split by OPCO, then aggregate each group before loading.
    -->
    <split streaming="true">
      <simple>${body}</simple>

      <setHeader name="OPCO"><simple>${body.key}</simple></setHeader>
      <setBody><simple>${body.value}</simple></setBody>

      <aggregate
          completionTimeout="{{import-kafka-ds-{entity}-route.aggregation.completionTimeout}}"
          parallelProcessing="true"
          aggregationStrategy="aggregationStrategyListMerge"
          aggregationRepository="importKafka{Entity}AggregationRepository">

        <correlationExpression>
          <simple>${headers.OPCO}</simple>
        </correlationExpression>
        <completionPredicate>
          <method ref="predicateAggregationCompletion"/>
        </completionPredicate>

        <setHeader name="loaddataParams">
          <simple>dsUniqueName=${headers.prefixTableName}_${headers.OPCO}{{import-kafka-ds-{entity}-route.pfx-api.settings}}mapper={{import-kafka-ds-{entity}-route.import.mapper}}&amp;connection={{pfx:kafka-pricefx-connection}}</simple>
        </setHeader>
        <to uri="direct:common-loaddataToPFX-route"/>
        <log loggingLevel="INFO" message="Loaded OPCO ${headers.OPCO}: ${headers.pfxInputRecordsCount} records"/>

        <setBody><constant/></setBody>
      </aggregate>

      <setBody><constant/></setBody>
    </split>

    <setHeader name="status">
      <simple>Processed ${headers.bodySize} records from Kafka message</simple>
    </setHeader>
    <setBody><constant/></setBody>
  </route>
</routes>
```

Replace `{entity}` with the kebab-case entity name and `{Entity}` with the PascalCase version (e.g., `item-master` / `ItemMaster`).

## Step 4: Generate Properties

Add to `src/main/resources/repo/config/application.properties`:

```properties
# === Kafka Consumer: import-kafka-ds-{entity}-route ===

# Topic to consume
import-kafka-ds-{entity}-route.kafka.topic={your.kafka.topic.name}

# Consumer group and connection parameters
# autoOffsetReset: use "earliest" for initial load; switch to "latest" (new groupId) once caught up
# autoCommitEnable=false + allowManualCommit=true: enables at-least-once safety via manual offset commit
import-kafka-ds-{entity}-route.kafka-general-parameters=consumersCount=2&autoOffsetReset=earliest&autoCommitEnable=false&allowManualCommit=true&groupId=pricefx_{entity}_consumer_earliest&brokers={{pfx:confluent.kafka.brokers}}

# Performance tuning
# maxPollRecords: records fetched per poll (tune based on message size)
# maxPollIntervalMs: max ms between polls before consumer is considered dead
# batching=true: Camel Kafka batching mode — delivers List<KafkaRecord> per exchange
import-kafka-ds-{entity}-route.kafka.performance-parameters=&maxPollIntervalMs=300000&maxPollRecords=500&batching=true

# Pricefx load settings
import-kafka-ds-{entity}-route.pfx-api.settings=&nullValue=""&objectType=DMDS&
import-kafka-ds-{entity}-route.prefix.tableName={EntityTableName}

# Mapper reference (use same mapper as file route if dual-pipeline)
import-kafka-ds-{entity}-route.import.mapper=import-kafka-ds-{entity}-route.mapper

# Aggregation timeout (ms) before partial batch is flushed to Pricefx
import-kafka-ds-{entity}-route.aggregation.completionTimeout=30000

# Sequence-key deduplication database settings
import-kafka-ds-{entity}-route.database.businessKeys={FIELD1},{FIELD2}
import-kafka-ds-{entity}-route.database.sequenceKeys=opTimeStamp,sequenceNumber
import-kafka-ds-{entity}-route.database.table={source_table_name}

# --- Shared provisioned properties (stored once, not per-route) ---
# pfx:confluent.kafka.brokers               — Kafka broker list
# pfx:general-kafka-security-parameters     — SASL/SSL credentials block
# pfx:general-kafka-error-connectivity-parameters — retry/backoff settings
# pfx:kafka-pricefx-connection              — Pricefx partition URL + credentials
```

## Step 5: Generate the Mapper (if new)

If this is NOT a dual-pipeline route with an existing mapper, create:

File: `src/main/resources/repo/mappers/import-kafka-ds-{entity}-route.mapper.xml`

```xml
<mappers>
  <loadMapper id="import-kafka-ds-{entity}-route.mapper" convertEmptyStringToNull="true">
    <!-- Map Kafka record fields to DMDS columns -->
    <!-- Example mappings — adapt field names to actual Kafka payload -->
    <body in="{KAFKA_FIELD_1}" out="key1"/>
    <body in="{KAFKA_FIELD_2}" out="attribute1"/>
    <body in="{NUMERIC_FIELD}" out="attribute2" converterExpression="stringToDecimal"/>
    <body in="{DATE_FIELD}" out="attribute3" converterExpression="stringToDate"/>
    <!-- Add all fields from the Kafka message schema -->
  </loadMapper>
</mappers>
```

Ask the user for the Kafka message schema (field names and types) to populate the mapper correctly.

## Step 6: Dual-Pipeline Note

When a file-based import route already exists for the same entity:

- Both routes MUST use the same `prefix.tableName` (target DMDS table prefix)
- Both routes MUST use the same mapper
- The file route handles bulk/historical loads; the Kafka route handles incremental CDC
- The sequence-key database filter in the Kafka route prevents CDC events from overwriting more recent data loaded by the file route (provided `opTimeStamp` and `sequenceNumber` are present in both feeds)

## Important Rules

- NEVER share a consumer group ID (`groupId`) across routes — each route must have a unique group ID; a missing or duplicate group ID causes offset loss on restart or message starvation
- ALWAYS use `autoCommitEnable=false&allowManualCommit=true` — auto-commit with true risks skipping messages on route failure
- ALWAYS provide an `onException` block routing to `direct:kafkaOnException` — without it, a processing failure may stop the consumer entirely
- Each route requires its own `aggregationRepository` bean declared in the Spring context — sharing a repository across routes corrupts aggregation state
- Use `autoOffsetReset=earliest` for initial load; change to `latest` with a new `groupId` suffix once the consumer has caught up to avoid replaying historical data
- `completionTimeout` must match actual throughput — too short causes partial batches; too long delays DMDS updates
- `parallelProcessing=true` on `<aggregate>` submits all OPCO groups concurrently — reduce to `false` if the Pricefx API throttles under load
- The `aggregationRepository` bean name MUST follow the convention `importKafka{Entity}AggregationRepository` (e.g., `importKafkaItemMasterAggregationRepository`) and must be unique per route
- `businessKeys` and `sequenceKeys` in properties must exactly match field names in the parsed Kafka JSON — a mismatch makes the deduplication filter a no-op or causes it to reject all records
- NEVER hardcode the Kafka broker list or security credentials in the route XML — always use provisioned properties via `{{pfx:...}}` references

## References

- [PA Import Integration Skill](../generate-pa-import-integration/SKILL.md) — for the DMDS loaddata pattern used in the shared load route
- [Scheduling Route Skill](../generate-scheduling-route/SKILL.md) — if initial catch-up load needs a time window
