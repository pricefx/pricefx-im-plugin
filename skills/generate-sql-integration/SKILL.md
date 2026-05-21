---
name: generate-sql-integration
description: Use when a Pricefx Integration Manager route reads from or writes to a relational/cloud SQL database (Snowflake, SQL Server, Postgres, MySQL, Oracle) — says "load from Snowflake", "call stored procedure", "export to database table", "bulk load via Snowflake stage", "JDBC connection", or names a SQL source/target. Covers JDBC datasource beans, paginated SELECT loops, `sql-stored:` calls, incremental sync via `pfx-config`, batch INSERT, and Snowflake `COPY INTO` stage exports.
---

# Generate SQL Integration

You are generating a SQL database integration for a Pricefx Integration Manager project. The route either reads rows from a database and loads them into Pricefx, or fetches data from Pricefx and writes it back to a database table. Follow the steps below. Never hardcode database credentials — always read them via `#{environment['...']}` placeholders that resolve to profile-specific properties.

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Integration type** — choose one:
   - `inbound-paginated` — SELECT from a table/view in a paginated `LIMIT/OFFSET` loop, load into Pricefx (P, C, PX, CX, DM, etc.)
   - `inbound-incremental` — wraps an inbound route with `pfx-config:get/set` to track the last-processed timestamp/key
   - `inbound-stored-proc` — call a stored procedure that returns batches and acknowledges success/failure (Customer pattern)
   - `inbound-bulk-snowflake` — Snowflake-specific: `COPY INTO` stage → download `.csv.gz` → `pfx-io:streamCompressedFile` → `loaddata` (initial loads of very large datasets)
   - `outbound` — fetch from Pricefx, transform, batch-INSERT into a database table
2. **Route name** — descriptive PascalCase or kebab-case (e.g., `import-Product-Route`, `export-Guardrails-Route`). Used as file name and route ID.
3. **Database type** — `snowflake`, `sqlserver`, `postgres`, `mysql`, `oracle`, etc. Determines the JDBC driver and the URL/dialect.
4. **DataSource bean name** — e.g., `snowflakeDataSource`, `azureSQLCustomerDataSource`. Used as `dataSource=#{name}` on the `sql:`/`jdbc:` URI.
5. **Source/target SQL object** — fully-qualified table or view name (e.g., `${properties:my.snowflake.database}.${properties:my.snowflake.schema}.v_product`) for inbound; target table for outbound.
6. **Pricefx target/source object** — `objectType` (P, C, PX, CX, DM, LTV, MLTV2, etc.) and any extra args (`dsUniqueName`, `pricingParameterName`, `businessKeys`).
7. **Columns** — list of SQL columns to project, plus the primary key (used for stable `ORDER BY` in pagination).
8. **Batch size** — rows per page. Default `10000`–`100000` depending on row width. Snowflake handles `100000` well; SQL Server stored procs typically use `10`–`5000` per batch.
9. **Mapper name** — e.g., `import-Product-Mapper`, `Guardrails-Export-Mapper`. Each route gets its own mapper file.
10. **Schedule** (if any) — `direct:` entry point only (default), Quartz cron, or polled via `timer:`. Most production routes use `direct:` and are driven by a separate scheduler route.

If the user provided some of these in `$ARGUMENTS`, skip asking.

## Step 2: Plan Files

| Integration type | Files to create |
|---|---|
| `inbound-paginated` | `routes/{route-name}.xml`, `mappers/{route-name}.mapper.xml` (or shared mapper), properties for `batch-size`, `database`, `schema`, JDBC creds |
| `inbound-incremental` | `routes/{route-name}-Incremental-Route.xml` (wrapper) + the underlying inbound route |
| `inbound-stored-proc` | `routes/{route-name}.xml`, mapper, properties for `batch-size`, datasource bean |
| `inbound-bulk-snowflake` | `routes/{route-name}-Snowflake-Route.xml` (extract to stage), `routes/{route-name}-CSV-Route.xml` (load gzipped CSV), mapper |
| `outbound` | `routes/{route-name}.xml`, `mappers/{route-name}-Mapper.xml`, optional `filters/{filter-name}.xml`, properties |

Always ensure the JDBC driver is on the classpath (`pom.xml` dependency). Snowflake → `net.snowflake:snowflake-jdbc` plus `org.apache.camel:camel-jdbc`. SQL Server → `com.microsoft.sqlserver:mssql-jdbc`. Postgres → `org.postgresql:postgresql`.

## Step 3: Generate the JDBC DataSource Bean

File: `src/main/resources/repo/beans/{name}DataSource.xml`

Driver-specific datasource is registered as a Spring bean and referenced from routes via `dataSource=#{beanId}`. Credentials come from environment-resolved properties — never inline.

### Snowflake

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">

    <bean id="snowflakeDataSource" class="net.snowflake.client.jdbc.SnowflakeBasicDataSource">
        <property name="url"          value="#{environment['my.snowflake.url']}"/>
        <property name="user"         value="#{environment['my.snowflake.username']}"/>
        <property name="password"     value="#{environment['my.snowflake.password']}"/>
        <property name="databaseName" value="#{environment['my.snowflake.database']}"/>
        <property name="schema"       value="#{environment['my.snowflake.schema']}"/>
        <!-- optional: <property name="role"      value="#{environment['my.snowflake.role']}"/> -->
        <!-- optional: <property name="warehouse" value="#{environment['my.snowflake.warehouse']}"/> -->
    </bean>
</beans>
```

The Snowflake URL must include `?jdbc_query_result_format=json` so result rows come back as `Map`s (which Camel's `pfx-csv`/`pfx-api:loaddata` expect). Without it the rows are arrays and mappers cannot resolve column names.

### SQL Server (HikariCP-wrapped)

```xml
<bean id="azureSQLCustomerDataSource" class="com.zaxxer.hikari.HikariDataSource" destroy-method="close">
    <property name="jdbcUrl"          value="#{environment['customer.sqlserver.url']}"/>
    <property name="username"         value="#{environment['customer.sqlserver.username']}"/>
    <property name="password"         value="#{environment['customer.sqlserver.password']}"/>
    <property name="maximumPoolSize"  value="3"/>
    <property name="connectionTimeout" value="30000"/>
</bean>
```

## Step 4a: Inbound — Paginated SELECT Loop

The dominant inbound pattern. A bounded `loop doWhile` issues `SELECT ... LIMIT ? OFFSET ?` until a page returns zero rows, sending each page through `pfx-api:loaddata`.

File: `src/main/resources/repo/routes/import-{Object}-Route.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{Object}-Route">
    <description>Paginated SELECT from {source} into Pricefx {Object}.</description>
    <from uri="direct:import-{Object}-Route"/>

    <setHeader name="source"><simple>${properties:my.snowflake.database}.${properties:my.snowflake.schema}.v_{object}</simple></setHeader>
    <setHeader name="target"><constant>{Object}</constant></setHeader>

    <!-- Total rows for logging only -->
    <setHeader name="interfaceQuery"><simple>SELECT count(*) AS count FROM ${header.source}</simple></setHeader>
    <to uri="sql:${header.interfaceQuery}?dataSource=#snowflakeDataSource"/>
    <setProperty name="rowCount"><groovy>body.COUNT</groovy></setProperty>
    <log message="Row count for ${header.source}: ${exchangeProperty.rowCount}"/>

    <!-- Columns + primary key (stable ORDER BY is required for LIMIT/OFFSET pagination) -->
    <setProperty name="sqlColumns"><constant>COL1,COL2,COL3,COL4</constant></setProperty>
    <setProperty name="sqlPrimaryKey"><constant>COL1</constant></setProperty>

    <!-- Loop state -->
    <setProperty name="rowsReturned"><constant>1</constant></setProperty>
    <setProperty name="sqlOffsetIndex"><constant>0</constant></setProperty>
    <setProperty name="sqlBatchSize"><simple>${properties:my.{object}.sql.batch-size}</simple></setProperty>

    <log message="Fetching ${header.source} (batchSize=${exchangeProperty.sqlBatchSize})"/>

    <loop doWhile="true">
      <simple>${exchangeProperty.rowsReturned} &gt; 0</simple>

      <setProperty name="sqlOffset">
        <groovy>return exchange.properties.sqlOffsetIndex.toInteger() * exchange.properties.sqlBatchSize.toInteger()</groovy>
      </setProperty>

      <setHeader name="interfaceQuery">
        <simple>SELECT ${exchangeProperty.sqlColumns} FROM ${header.source} ORDER BY ${exchangeProperty.sqlPrimaryKey} LIMIT ${exchangeProperty.sqlBatchSize} OFFSET ${exchangeProperty.sqlOffset}</simple>
      </setHeader>
      <log logName="SQL" message="${header.interfaceQuery}"/>

      <to uri="sql:${header.interfaceQuery}?dataSource=#snowflakeDataSource"/>

      <setProperty name="rowsReturned"><groovy>body.size()</groovy></setProperty>
      <log message="Rows returned: ${exchangeProperty.rowsReturned}"/>

      <filter>
        <simple>${exchangeProperty.rowsReturned} &gt; 0</simple>
        <toD uri="pfx-api:loaddata?objectType=P&amp;mapper=import-${header.target}-Mapper"/>
      </filter>

      <setProperty name="sqlOffsetIndex"><simple>${exchangeProperty.sqlOffsetIndex}++</simple></setProperty>
    </loop>

    <log message="Finished."/>
  </route>
</routes>
```

For DMDS (data feed) targets, swap the `loaddata` line and add a `flush` after the loop:

```xml
<toD uri="pfx-api:loaddata?objectType=DM&amp;mapper=import-${header.target}-Mapper&amp;dsUniqueName=${header.target}"/>
...
<toD uri="pfx-api:flush?dataFeedName=DMF.${header.target}&amp;dataSourceName=DMDS.${header.target}"/>
```

For datasets where you only want the last N days, keep a `WHERE` clause keyed off a `${header.fromDate}` plus a `sqlWindow` property and apply it in **both** the count query and the page query.

## Step 4b: Inbound — Incremental Wrapper

A small wrapper route reads/writes the last-processed timestamp via `pfx-config` and delegates to the underlying paginated route. The wrapper is what the scheduler calls; the underlying route stays usable on its own for ad-hoc replays.

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{Object}-Incremental-Route">
    <from uri="direct:import-{Object}-Incremental-Route"/>
    <setHeader name="startTimestamp"><simple>${date:now:yyyy-MM-dd}</simple></setHeader>

    <to uri="pfx-config:get?name=Integration.{Object}.LastDate"/>
    <choice>
      <when>
        <groovy>body != ''</groovy>
        <setHeader name="fromDate"><simple>${body}</simple></setHeader>
      </when>
      <otherwise>
        <setHeader name="fromDate"><simple>${header.startTimestamp}</simple></setHeader>
      </otherwise>
    </choice>
    <log message="Last successful timestamp: ${header.fromDate}"/>

    <to uri="direct:import-{Object}-Route"/>

    <toD uri="pfx-config:set?name=Integration.{Object}.LastDate&amp;value=${header.startTimestamp}"/>
    <log message="Incremental import finished."/>
  </route>
</routes>
```

The window should overlap the previous run by some safety margin (e.g., `WHERE updated >= DATEADD(day, -${sqlWindow}, '${fromDate}')`) so late-arriving rows are picked up.

## Step 4c: Inbound — Stored Procedure with Acknowledgement

Use this when the source system maintains its own change log and exposes a "give me the next batch and tell me when you're done" pair of stored procedures (common with SQL Server / CDC-style feeds).

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{Object}-stored-proc-Route">
    <from uri="direct:import-{Object}-stored-proc-Route"/>

    <setProperty name="rowsReturned"><constant>1</constant></setProperty>

    <loop doWhile="true">
      <simple>${exchangeProperty.rowsReturned} &gt; 0</simple>

      <doTry>
        <to uri="sql-stored:{Object}_GetData('batchSize' INTEGER ${properties:my.sql.{object}.batch-size:10})?dataSource=#azureSQL{Object}DataSource"/>

        <setProperty name="rowsReturned"><groovy>body.'#result-set-1'.size()</groovy></setProperty>
        <log message="call returned ${exchangeProperty.rowsReturned} rows"/>

        <filter>
          <simple>${exchangeProperty.rowsReturned} &gt; 0</simple>
          <setProperty name="batchId"><groovy>body.'#result-set-1'[0].batchId</groovy></setProperty>
          <log message="batchId: ${exchangeProperty.batchId}"/>

          <setBody><groovy>return body.'#result-set-1'</groovy></setBody>

          <to uri="pfx-api:loaddata?objectType=C&amp;mapper={Object}-Loaddata-Mapper"/>

          <to uri="sql-stored:{Object}_SetBatchSuccess('batchId' VARCHAR(255) ${exchangeProperty.batchId})?dataSource=#azureSQL{Object}DataSource"/>
        </filter>

        <doCatch>
          <exception>java.lang.Exception</exception>
          <log loggingLevel="WARN" message="Failed batchId: ${exchangeProperty.batchId}, ex=${exception.stacktrace}"/>
          <to uri="sql-stored:{Object}_SetBatchFailure('batchId' VARCHAR(255) ${exchangeProperty.batchId})?dataSource=#azureSQL{Object}DataSource"/>
        </doCatch>
      </doTry>
    </loop>
  </route>
</routes>
```

Key notes on `sql-stored:`:
- Procedure parameters are declared inline: `('paramName' SQL_TYPE ${expression}, 'p2' INTEGER 5)`.
- A multi-result-set procedure exposes rows under `body.'#result-set-N'`. Quote the key when accessing with Groovy/Simple.
- The `SetBatchFailure` call lives in `<doCatch>` so a failing `loaddata` does not leave the source batch in "in-flight" state.

## Step 4d: Inbound — Bulk Initial Load via Snowflake Stage

For multi-million-row initial loads, paginated SELECT is too slow and creates Snowflake compute pressure. Instead, run a `COPY INTO @~/.../{file}.csv.gz` to push to the user stage, `GET` the gzipped file to a local folder, then process it with a CSV streaming route. Two routes:

**1. Extract route — runs the Snowflake COPY/GET/REMOVE sequence:**

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{Object}-Snowflake-Route">
    <description>Stage export to gzipped CSV; downloaded for the CSV route.</description>
    <from uri="direct:import-{Object}-Snowflake-Route"/>

    <setHeader name="interfaceName"><constant>pfx_{Object}</constant></setHeader>
    <setHeader name="sourceTable"><constant>V_{OBJECT}</constant></setHeader>
    <setHeader name="interfaceFileFormat"><simple>(type='CSV' record_delimiter='${properties:my.snowflake.csv.eol}' field_delimiter='${properties:my.snowflake.csv.delimiter}' FIELD_OPTIONALLY_ENCLOSED_BY='"' NULL_IF=('') EMPTY_FIELD_AS_NULL=FALSE compression='gzip') header=true single=true max_file_size=${properties:my.snowflake.max-file-size};</simple></setHeader>
    <setHeader name="interfaceFileName"><simple>${header.interfaceName}_${header.year}_${date:now:yyyyMMdd_HHmmss}.csv.gz</simple></setHeader>

    <!-- Build SELECT for the slice (e.g., one year per call) -->
    <setHeader name="interfaceQuery"><simple>SELECT COL1,COL2,COL3 FROM ${properties:my.snowflake.schema}.${header.sourceTable} WHERE date_col &gt;= '${header.year}-01-01' AND date_col &lt;= '${header.year}-12-31' LIMIT ${properties:my.snowflake.limit}</simple></setHeader>

    <setBody><simple>COPY INTO @~/{{integration.environment}}/${header.interfaceFileName} FROM (${header.interfaceQuery}) file_format = ${header.interfaceFileFormat};</simple></setBody>
    <to uri="jdbc:snowflakeDataSource"/>

    <setBody><simple>GET @~/{{integration.environment}}/${header.interfaceFileName} file:///{{my.snowflake.stage-folder}};</simple></setBody>
    <to uri="jdbc:snowflakeDataSource"/>

    <setBody><simple>REMOVE @~/{{integration.environment}}/${header.interfaceFileName}</simple></setBody>
    <to uri="jdbc:snowflakeDataSource"/>

    <log message="Staged ${header.interfaceFileName}"/>
  </route>
</routes>
```

**2. Load route — picks up the gzipped file with `pfx-io:streamCompressedFile` and tokenizes:**

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="import-{Object}-CSV-Route">
    <from uri="{{my.{object}.csv.from-uri}}"/>
    <setHeader name="CSVHeader"><constant>COL1,COL2,COL3</constant></setHeader>
    <setHeader name="target"><constant>{Object}</constant></setHeader>

    <log message="Loading ${header.target} file ${header.CamelFileNameOnly}"/>
    <to uri="pfx-io:streamCompressedFile"/>

    <split streaming="true" aggregationStrategy="recordsCountAggregation" stopOnException="true">
      <tokenize token="\n" group="{{my.{object}.csv.batch-size}}"/>
      <toD uri="pfx-csv:unmarshal?skipHeaderRecord=true&amp;delimiter={{my.pfx.csv.delimiter}}&amp;recordSeparator={{my.pfx.csv.eol}}&amp;trim=true&amp;header=${header.CSVHeader}"/>
      <toD uri="pfx-api:loaddata?objectType=DM&amp;dsUniqueName=${header.target}&amp;mapper=import-${header.target}-Mapper"/>
      <setBody><constant/></setBody>
    </split>

    <log message="${header.target} saved. Total: ${header.PfxTotalInputRecordsCount}"/>
    <toD uri="pfx-api:flush?dataFeedName=DMF.${header.target}&amp;dataSourceName=DMDS.${header.target}"/>
  </route>
</routes>
```

The CSV delimiter/EOL must match what `COPY INTO` produced. URL-encode any non-printable delimiters in properties (`` → `%14`, LF → `%0A`).

## Step 4e: Outbound — Fetch from Pricefx, Batch INSERT into SQL

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="export-{Object}-Route">
    <from uri="direct:export-{Object}-Route"/>

    <setHeader name="source"><constant>{PpvName}</constant></setHeader>
    <setHeader name="target"><constant>{TARGET_TABLE}</constant></setHeader>

    <!-- Truncate target before load -->
    <setHeader name="interfaceQuery"><simple>DELETE FROM ${properties:my.snowflake.output-schema}.${header.target}</simple></setHeader>
    <toD uri="sql:${header.interfaceQuery}?dataSource=#snowflakeDataSource"/>

    <!-- Get total row count for logging -->
    <toD uri="pfx-api:fetch?objectType=LTV&amp;pricingParameterName=${header.source}&amp;countOnly=true"/>
    <setProperty name="exportedRows"><simple>${header.totalRows}</simple></setProperty>
    <log message="Determined ${exchangeProperty.exportedRows} total rows"/>

    <!-- Build the parameterized INSERT once; reused across all batches -->
    <setHeader name="interfaceQuery"><simple>INSERT INTO ${properties:my.snowflake.output-schema}.${header.target} (KEY1,KEY2,VALUE1,VALUE2) VALUES (:#key1,:#key2,:#attribute1,:#attribute2)</simple></setHeader>

    <!-- Batched fetch from Pricefx, batch INSERT to SQL -->
    <toD uri="pfx-api:fetch?objectType=LTV&amp;pricingParameterName=${header.source}&amp;filter=${header.source}-Filter&amp;batchedMode=true&amp;batchSize=${properties:my.snowflake.batch-size}&amp;enableNullFields=true"/>

    <split stopOnException="true">
      <simple>${body}</simple>
      <toD uri="pfx-api:fetchIterator"/>
      <toD uri="pfx-model:transform?mapper=${header.source}-Export-Mapper"/>
      <log message="Running batch #${exchangeProperty.CamelSplitIndex}, batchSize=${properties:my.snowflake.batch-size} of ${exchangeProperty.exportedRows}"/>
      <toD uri="sql:${header.interfaceQuery}?dataSource=#snowflakeDataSource&amp;batch=true&amp;allowNamedParameters=true"/>
    </split>

    <log message="Done. Exported ${exchangeProperty.exportedRows} rows."/>
  </route>
</routes>
```

Critical points:
- `batch=true&allowNamedParameters=true` enables JDBC batch INSERT with `:#name` placeholders. Without these flags Camel sends rows one-by-one and a 100k-row export takes forever.
- The mapper exists because Pricefx returns numeric values as `Integer` when the value is a whole number and `BigDecimal` otherwise. JDBC batch insert will fail with `incompatible data type` between batches if the column type drifts. Use `converter="numberToDouble"` (or `numberToBigDecimal`) on every numeric column in the export mapper to force a stable type.
- Fetch column names in the mapper match the Pricefx PPV/object field layout (`key1..keyN`, `attribute1..attributeM`), not the SQL column names.

## Step 5: Generate the Mapper

File: `src/main/resources/repo/mappers/{route-name}-Mapper.xml` (one mapper per route — no shared mappers; the file id must match the file name without `.xml`).

### Inbound — SQL columns to Pricefx attributes

```xml
<mappers>
  <loadMapper id="import-{Object}-Mapper" convertEmptyStringToNull="true">
    <body in="MATERIAL"      out="sku"/>
    <body in="MATERIAL_DESC" out="label"/>
    <body in="PRODUCT_SPEC"  out="attribute1"/>
    <body in="GLOB_PROD_LVL3" out="attribute4"/>
    <body in="BR_UB"         out="attribute7"/>
  </loadMapper>
</mappers>
```

`convertEmptyStringToNull="true"` is essential — Snowflake/SQL Server returns empty strings for NULL VARCHARs in JSON mode, and Pricefx will silently store them as the literal empty string unless converted.

### Outbound — Pricefx attributes to numeric-stable export

```xml
<mappers>
  <loadMapper id="{Source}-Export-Mapper" convertEmptyStringToNull="true">
    <body in="key1"       out="key1"/>
    <body in="key2"       out="key2"/>
    <body in="attribute1" out="attribute1"/>
    <body in="attribute4" out="attribute4" converter="numberToDouble"/>
    <body in="attribute5" out="attribute5" converter="numberToDouble"/>
  </loadMapper>
</mappers>
```

## Step 6: Add Properties

In `src/main/resources/application-app_{env}.properties` (per-environment) and locally in `application-local.properties`:

```properties
###############################################################################
# {Database} connection
###############################################################################
my.snowflake.url=jdbc:snowflake://account.snowflakecomputing.com?jdbc_query_result_format=json
my.snowflake.username=PFX_USER
my.snowflake.password={ENC}...
my.snowflake.database=ANALYTICS
my.snowflake.schema=PRICING

###############################################################################
# Batch sizes — tune per dataset
###############################################################################
my.{object}.sql.batch-size=10000
my.snowflake.batch-size=50000

###############################################################################
# Optional: bulk-load CSV staging
###############################################################################
my.snowflake.csv.delimiter=%14
my.snowflake.csv.eol=%0A
my.snowflake.max-file-size=104857600
my.snowflake.stage-folder=/tmp/snowflake-stage
my.{object}.csv.from-uri=file:///{{my.snowflake.stage-folder}}?include=pfx_{Object}_.*\\.csv\\.gz&move=.processed
my.{object}.csv.batch-size=50000
```

JDBC URL: pin the result format to JSON (`jdbc_query_result_format=json`) for Snowflake. Without it the Camel SQL component returns column-array result rows that mappers cannot key by name.

Passwords go in `application-local.properties` (gitignored) for dev and as `{ENC}...` values for deployed envs. Never commit a plaintext password.

## Step 7: Wire the Schedule

The route's `<from>` is `direct:` so a separate scheduler/orchestrator route triggers it. A typical wrapper:

```xml
<route id="schedule-import-{Object}">
  <from uri="quartz://import-{Object}?cron=0+0+2+*+*+?"/>  <!-- daily at 02:00 -->
  <to uri="direct:import-{Object}-Incremental-Route"/>
</route>
```

Use Quartz cron when the source is a database (you control the polling cadence) — file-poll URIs are inappropriate here.

## Important Rules

- **Always use a separate `<from uri="direct:..."/>` entry point** for the data-fetch route. Schedulers, retries, and ad-hoc tools all call into the same route this way. Never put `quartz://` directly on the inbound route.
- **`ORDER BY` is mandatory** for `LIMIT/OFFSET` pagination. The order key must include enough columns to be deterministic — usually the primary key. Without it, pages can repeat or skip rows on databases that don't guarantee an order.
- **Snowflake URL must include `?jdbc_query_result_format=json`.** Otherwise rows come back as `List<Object>` instead of `Map<String,Object>` and mapper field lookups fail silently.
- **`batch=true&allowNamedParameters=true`** for outbound INSERTs. Single-row inserts at 100k+ rows are unusably slow.
- **Force numeric type stability** on outbound mapper columns where Pricefx might return both `Integer` and `BigDecimal` for the same logical column across batches. Use `converter="numberToDouble"` or `numberToBigDecimal` consistently.
- **Stored proc routes:** wrap `loaddata` + `SetBatchSuccess` together in `<doTry>`. Put `SetBatchFailure` in `<doCatch>` so a failed Pricefx load returns the source batch to a retryable state.
- **Bulk Snowflake loads:** match `delimiter`/`recordSeparator` between the `COPY INTO file_format` and the `pfx-csv:unmarshal` URI character-for-character. URL-encode non-printable delimiters.
- **Never hardcode credentials** in beans. Always `value="#{environment['{key}']}"` and resolve via profile-specific properties.
- **One mapper per route file.** File `mappers/import-Product-Mapper.xml` → `id="import-Product-Mapper"`.
- **`convertEmptyStringToNull="true"`** on all SQL-sourced mappers. Empty-string and NULL behave very differently in Pricefx attribute-type coercion.
- **`pfx-api:flush`** is required after every DMDS load. Without it the data feed sits in staged-but-not-applied state.
- **Driver dependency is mandatory.** Add the JDBC driver to `pom.xml` — the route will fail at startup with `ClassNotFoundException` otherwise.

## References

- Apache Camel SQL component: https://camel.apache.org/components/4.0.x/sql-component.html
- Apache Camel SQL Stored Procedure component: https://camel.apache.org/components/4.0.x/sql-stored-component.html
- Snowflake `COPY INTO <location>`: https://docs.snowflake.com/en/sql-reference/sql/copy-into-location
- Provisioned sample: `provisioned-integration-samples/sql-inbound-and-outbound`
