# Pricefx Camel Component Reference

All components use the `pfx-` prefix and are producer-only (used in `<to>` or `<toD>`, not `<from>` except `pfx-api:events`).

**KB Reference:** https://knowledge.pricefx.com/space/IM/

## pfx-api — Pricefx API Operations

**Syntax:** `pfx-api:method?params`

The primary component for all Pricefx server interactions.

**KB:** https://knowledge.pricefx.com/space/IM/10551379/pfx-api+Component

### Methods

| Method | Description |
|--------|-------------|
| `loaddata` | Bulk load data (replace). IM parses and maps data, sends via JSON API. Requires `objectType`, `mapper`. |
| `loaddataFile` | Stream file directly to Pricefx server. More efficient for large files. Supports `mapper` for field mapping. Requires `objectType`. |
| `integrate` | Upsert data (insert or update). Requires `objectType`, `mapper`. |
| `fetch` | Query data. Requires `objectType` and either `sql` or `filter`. |
| `delete` | Delete records. Requires `objectType` and `filter`. |
| `flush` | Flush data feed to data source. Requires `dataSourceName`, `dataFeedName`. |
| `truncate` | Truncate data mart/feed/source. Requires `targetName`. |
| `calculate` | Trigger data mart calculation. Requires `typedId`, `targetName`. |
| `internalCopy` | Copy data source internally. Requires `label`. |
| `refresh` | Refresh data mart. |
| `events` | Poll for system events (consumer). Requires `eventTypes`, `delay`. |
| `execute` | Execute a formula. Requires `formulaName`. |
| `update` | Update records. |
| `save` | Save records. |
| `massEdit` | Mass edit fields matching a filter. |
| `customers` | Load customers to data mart. |
| `products` | Load products to data mart. |
| `cancel` | Cancel an operation. |
| `resetColumn` | Reset a column in a data source. |
| `addProducts` | Add products to a quote/agreement. |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `objectType` | Target object type (P, C, PX, CX, SX, DM, LTV, MLTV2, CRCP, etc.) | — |
| `mapper` | Mapper bean ID for field mapping | — |
| `businessKeys` | Comma-separated business key fields | — |
| `sql` | SQL-like query for fetch (`select field1,field2 where name='X'`) | — |
| `filter` | Filter bean ID for fetch/delete | — |
| `batchedMode` | Enable batched fetching | `false` |
| `batchSize` | Records per batch | `5000` |
| `startRow` / `endRow` | Row range for fetch | — |
| `pricingParameterName` | PPV table name (for LTV/MLTV2) | — |
| `pricingParameterId` | PPV table ID | — |
| `conditionRecordSetName` | Condition record set name (for CRCP) | — |
| `dsUniqueName` | Data mart/source unique name (e.g., `DMDS.MySource`) | — |
| `dataSourceName` | Data source name for flush | — |
| `dataFeedName` | Data feed name for flush | — |
| `typedId` | Typed ID for calculate | — |
| `targetName` | Target name for truncate/calculate | — |
| `label` | Object label for internalCopy | — |
| `connection` | Connection ID to use | default |
| `resultFields` | Comma-separated fields to return from fetch | — |
| `sortBy` | Sort field for fetch | — |
| `incrementalDate` | Incremental date for refresh/truncate | — |
| `direct2ds` | Load directly to data source | `false` |
| `detectJoinFields` | Auto-detect join fields | `true` |
| `async` | Async processing | `false` |
| `asyncTimeout` | Async timeout (ms) | `30000` |
| `delay` | Poll delay for events (ms) | — |
| `eventTypes` | Comma-separated event types for polling | — |
| `countOnly` | Return only count from fetch | `false` |
| `enableNullFields` | Include null fields in response | `false` |
| `truncate` | Truncate before load | `false` |
| `deDuplicate` | De-duplicate records | `true` |
| `maxRows` | Max rows for fetch | `50000` |
| `converterStrategyType` | Converter strategy type | — |

### loaddataFile vs loaddata

| Method | When to Use | Default batchSize |
|--------|-------------|-------------------|
| `loaddataFile` | **Default** for all CSV imports (P, PX, C, CX, LTV, MLTV2). Streams file directly to server — much faster for large files. | `5000` |
| `loaddata` | Only when Groovy row-level logic is needed per record. IM parses and maps each row in memory. | `5000` |

**Batch size guidance for `loaddataFile`:**

| Fields per row | Recommended batchSize |
|---|---|
| < 10 | `500000` |
| 10–20 | `100000`–`200000` |
| 20+ | `50000` or less |

**PX / CX imports — no `extensionName` parameter exists.** The table name is set in the **mapper** as a constant:

```xml
<loadMapper id="import-prices.mapper">
    <constant expression="Prices" out="name"/>  <!-- table name — required for PX/CX -->
    <body in="sku" out="sku"/>
    <body in="price" out="attribute1" converterExpression="stringToDecimal"/>
</loadMapper>
```

**Key field names by object type:**
- P / PX → `sku`
- C / CX → `customerId`

**Do not include `connection=pricefx`** — the default connection bean is named `pricefx` and is used automatically.

### Examples

```xml
<!-- Load products via file streaming (recommended) -->
<to uri="pfx-csv:streamingUnmarshal?skipHeaderRecord=true&amp;useReusableParser=true"/>
<to uri="pfx-api:loaddataFile?objectType=P&amp;mapper=import-products.mapper&amp;batchSize=500000"/>

<!-- Load products row-by-row (use only when Groovy logic is needed) -->
<to uri="pfx-api:loaddata?objectType=P&amp;mapper=productMapper&amp;businessKeys=sku"/>

<!-- Fetch with SQL-like syntax -->
<to uri="pfx-api:fetch?sql=select sku,attribute1 where name='Cars'&amp;objectType=PX&amp;batchedMode=true&amp;batchSize=5000"/>

<!-- Fetch with filter bean -->
<to uri="pfx-api:fetch?objectType=CRCI1&amp;filter=myFilterBean"/>

<!-- Integrate (upsert) pricing parameters -->
<to uri="pfx-api:integrate?objectType=LTV&amp;mapper=currencyMapper&amp;pricingParameterName=ExchangeRate"/>

<!-- Trigger internal copy -->
<to uri="pfx-api:internalCopy?label=Product"/>

<!-- Flush data feed -->
<to uri="pfx-api:flush?dataSourceName=DMDS.MySource&amp;dataFeedName=DMF.MyFeed"/>

<!-- Poll events (consumer) -->
<from uri="pfx-api:events?delay=60000&amp;eventTypes=ITEM_UPDATE_PPV,PADATALOAD_COMPLETED"/>
```

---

## File Consumer Patterns

When reading files from the local file system, define these properties once in `config/application.properties` and reference them in route URIs:

```properties
# Move processed files to timestamped archive (always include)
archive.file=move=.archive/%24%7Bdate:now:yyyy%7D/%24%7Bdate:now:MM%7D/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd_HHmmss%7D.%24%7Bfile:ext%7D

# Wait until file size stabilizes (default — use when no .done marker)
read.lock=readLock=changed

# Wait for a .done marker file (use when upstream writes a .done file)
done.file=doneFileName=%24%7Bfile:name%7D.done

# Move failed files to error folder (optional)
error.file=moveFailed=.error/%24%7Bfile:name.noext%7D__%24%7Bdate:now:yyyyMMdd-HHmmss%7D.%24%7Bfile:ext%7D
```

**File URI template:**

```xml
<from uri="file://{{integration.sftp.root}}/my-path?delay=10000&amp;{{archive.file}}&amp;{{read.lock}}"/>
```

**Rules:**
- Always include `{{archive.file}}`
- Use **either** `{{read.lock}}` **or** `{{done.file}}` — never both, never neither
- `{{error.file}}` is optional
- Never use `noop=true`

---

## Scheduled Exports with Quartz Cron

In Camel URIs, **spaces in Quartz cron expressions are replaced with `+`**:

```xml
<from uri="quartz://export/my-export?cron=0+0+6+*+*+?"/>   <!-- daily at 6:00 AM -->
<from uri="quartz://export/my-export?cron=0+0+0+*+*+?"/>   <!-- daily at midnight -->
<from uri="quartz://export/my-export?cron=0+0+8+?+*+MON-FRI"/>  <!-- Mon–Fri at 8:00 AM -->
```

Cron format: `seconds minutes hours day-of-month month day-of-week`

---

## Delta Sync via pfx-config

Use `pfx-config:get/set` to persist a timestamp between runs for incremental exports:

```xml
<!-- Read stored timestamp into header -->
<toD uri="pfx-config:get?name={{integration.name}}.${routeId}.export.timestamp&amp;toHeader=lastExportTimestamp"/>

<!-- Fallback for first run -->
<choice>
    <when>
        <simple>${headers.lastExportTimestamp} == null || ${headers.lastExportTimestamp} == ''</simple>
        <setHeader name="lastExportTimestamp"><constant>1970-01-01T00:00:00</constant></setHeader>
    </when>
</choice>

<!-- Capture upper bound -->
<setHeader name="currentExportTimestamp">
    <simple>${date-with-timezone:now:UTC:yyyy-MM-dd'T'HH:mm:ss}</simple>
</setHeader>

<!-- ... fetch, split, export ... -->

<!-- Save upper bound for next run -->
<toD uri="pfx-config:set?name={{integration.name}}.${routeId}.export.timestamp&amp;value=${headers.currentExportTimestamp}"/>
```

**Delta filter** (use both bounds to avoid missing records that change during export):

```xml
<filters>
    <filter id="my-export.filter" sortBy="lastUpdateDate">
        <and>
            <criterion fieldName="lastUpdateDate" operator="greaterThan" value="simple:${headers.lastExportTimestamp}"/>
            <criterion fieldName="lastUpdateDate" operator="lessOrEqual" value="simple:${headers.currentExportTimestamp}"/>
        </and>
    </filter>
</filters>
```

---

## pfx-csv — CSV Processing

**Syntax:** `pfx-csv:method?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551427/pfx-csv+Component

### Methods

| Method | Description |
|--------|-------------|
| `unmarshal` | Parse CSV into list of maps |
| `marshal` | Convert list of maps to CSV |
| `streamingUnmarshal` | Parse CSV without loading full file into memory — use with `loaddataFile` for large files |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `skipHeaderRecord` | Skip first row as header | `false` |
| `header` | Comma-separated column names | — |
| `delimiter` | Field delimiter | `,` |
| `escapeCharacter` | Escape character | — |
| `quoteCharacter` | Quote character | — |
| `quoteMode` | Quote mode (NONE, ALL, MINIMAL, etc.) | — |
| `quoteDisabled` | Disable quoting | `false` |
| `useMaps` | Parse into maps (vs lists) | `true` |
| `ignoreEmptyLines` | Skip empty lines | — |
| `nullString` | String to treat as null | — |

### Examples

```xml
<to uri="pfx-csv:unmarshal?skipHeaderRecord=true"/>
<to uri="pfx-csv:unmarshal?header=sku,name,price&amp;skipHeaderRecord=true"/>
<to uri="pfx-csv:marshal?header=sku,name,price&amp;delimiter=,"/>
<to uri="pfx-csv:marshal?quoteMode=NONE&amp;escapeCharacter=^&amp;skipHeaderRecord=true"/>
```

---

## pfx-json — JSON Processing

**Syntax:** `pfx-json:method`

**KB:** https://knowledge.pricefx.com/space/IM/10551429/pfx-json+Component

### Methods

| Method | Description |
|--------|-------------|
| `unmarshal` | Parse JSON string into Java objects |
| `marshal` | Convert Java objects to JSON string |

### Examples

```xml
<to uri="pfx-json:unmarshal"/>
<to uri="pfx-json:marshal"/>
```

---

## pfx-xml — XML Processing

**Syntax:** `pfx-xml:method`

### Methods

| Method | Description |
|--------|-------------|
| `unmarshal` | Parse XML into Java objects |
| `marshal` | Convert Java objects to XML |

---

## pfx-excel — Excel Processing

**Syntax:** `pfx-excel:method?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551431/pfx-excel+Component

### Methods

| Method | Description |
|--------|-------------|
| `unmarshal` | Parse Excel file into list of maps |
| `streamingUnmarshal` | Parse large Excel files with streaming |
| `marshal` | Convert to Excel format |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `skipHeaderRecord` | Skip first row | `false` |
| `hasHeaderRecord` | First row is header | `true` |
| `header` | Expected header values | — |
| `format` | Output format | `xlsx` |
| `sheetIndex` | Sheet index | `0` |
| `sheetName` | Sheet name | — |
| `fileToAppend` | Path to file for appending | — |
| `dataConversionMode` | `AUTO` or `NONE` | `AUTO` |

---

## pfx-rest — REST API Calls

**Syntax:** `pfx-rest:method?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551435/pfx-rest+Component
When using pfx-rest to call Pricefx always look at Pricefx REST API for details.
**API Docs** https://api.pricefx.com/rest-api

### Methods

`get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `uri` | URL path to invoke | — |
| `connection` | Connection bean ID (OAuth2, Basic, etc.) | — |
| `contentType` | Content type | `application/json` |
| `connectionTimeoutMs` | Connection timeout | — |
| `okStatusCodeRange` | Success status codes | `200-299` |
| `mapper` | Mapper for response transformation | — |
| `filter` | Filter for request | — |
| `queryParams` | Query parameters | — |
| `autoDecode` | Auto decode response | `true` |
| `failIfNoConnection` | Fail if connection not found | `false` |
| `proxyHost` / `proxyPort` | Proxy configuration | — |
| `inputSource` | Input source (header, property, body) | — |
| `inputSourceName` | Input source name | — |
| `outputTarget` | Output target (header, property, body) | — |
| `outputTargetName` | Output target name | — |
| `maxResponseSizeInMB` | Max response size | `0` (unlimited) |

### Examples

```xml
<!-- GET with OAuth2 connection -->
<toD uri="pfx-rest:get?uri=/api/v1/data&amp;connection=myOAuth2Connection"/>

<!-- GET with query parameters in URI -->
<toD uri="pfx-rest:get?uri=/services/data/v48.0/query/&amp;q=select Name from Account&amp;connection=salesforce.connection&amp;connectionTimeoutMs=500000"/>

<!-- POST with body -->
<to uri="pfx-rest:post?uri=/api/v1/data&amp;connection=myConnection"/>
```

---

## pfx-sftp — SFTP File Transfer

**Syntax:** `pfx-sftp://path?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551437/pfx-sftp+Component

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `connection` | SFTP connection bean ID |

Inherits all standard Camel SFTP parameters (delete, noop, fileName, etc.).

### Examples

```xml
<!-- Download files -->
<from uri="pfx-sftp://remote/path?connection=sftpConnection&amp;delete=true"/>

<!-- Upload files -->
<to uri="pfx-sftp://remote/path?connection=sftpConnection"/>
```

---

## pfx-sql — Database Operations

**Syntax:** `pfx-sql:method?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551439/pfx-sql+Component

### Methods

| Method | Description |
|--------|-------------|
| `select` | Query database |
| `selectIterator` | Streaming query |
| `insert` | Insert records |
| `upsert` | Insert or update records |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `dataSource` | DataSource bean name | `dataSource` |
| `table` | Target table name | — |
| `mapper` | Mapper for field mapping | — |
| `sql` | SQL query (for select) | — |
| `batchSize` | Fetch batch size | `5000` |
| `batchMode` | Batched select | `false` |
| `businessKeys` | Business keys for upsert | — |
| `dialect` | SQL dialect | `MYSQL` |

---

## pfx-io — File I/O Operations

**Syntax:** `pfx-io:method?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551441/pfx-io+Component

### Methods

| Method | Description |
|--------|-------------|
| `detectCharset` | Detect file character encoding |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `specifiedCharset` | Override charset | — |
| `compressionType` | Compression type | `ZIP` |
| `compressedFileOutputPath` | Output path for compressed files | — |
| `maxLinesForSplit` | Max lines per split file | — |
| `skipHeader` | Skip header when splitting | `false` |
| `outputFileName` | Output file name | — |

---

## pfx-config — Configuration Store

**Syntax:** `pfx-config:method?params`

**KB:** https://knowledge.pricefx.com/space/IM/10551443/pfx-config+Component

### Methods

| Method | Description |
|--------|-------------|
| `get` | Read a value from Pricefx object store |
| `set` | Write a value to Pricefx object store |

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `name` | Configuration key |
| `value` | Value to store (for set) |
| `toHeader` | Header to store retrieved value in |
| `defaultValue` | Default value if key not found |
| `connection` | Connection ID |

### Examples

```xml
<!-- Read config value into header -->
<to uri="pfx-config:get?name=LAST_SYNC_DATE&amp;toHeader=lastUpdate&amp;defaultValue=1900-01-01"/>

<!-- Write config value -->
<toD uri="pfx-config:set?name=LAST_SYNC_DATE&amp;value=${header.nowDate}"/>
```

---

## pfx-model — Data Model Transformation

**Syntax:** `pfx-model:method?params`

### Methods

| Method | Description |
|--------|-------------|
| `transform` | Transform data using a mapper |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mapper` | Mapper bean ID | — |
| `truncateAttributes` | Truncate long attributes | `YES` |

### Examples

```xml
<toD uri="pfx-model:transform?mapper=exportMapper"/>
```

---

## pfx-validator — Data Validation

**Syntax:** `pfx-validator:method?params`

### Methods

| Method | Description |
|--------|-------------|
| `csv` | Validate CSV format |

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `checkEmptyLines` | Check for empty lines | `false` |
| `regularExpression` | Regex for line validation | — |
| `formatRef` | Format bean reference | — |
| `onlyPrintWarning` | Only warn, don't fail | `false` |
| `skipHeaderRecord` | Skip header | `false` |
| `header` | Expected header values | — |

---

## pfx-s3 — AWS S3 Operations

**Syntax:** `pfx-s3:bucketName?params`

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `connection` | S3 connection bean ID |

---

## pfx-connection — Connection Lookup

**Syntax:** `pfx-connection:method`

### Methods

| Method | Description |
|--------|-------------|
| `get` | Retrieve a connection object |

---

## pfx-salesforce — Salesforce Integration

**Syntax:** `pfx-salesforce:method?params`

Specialized component for Salesforce-specific operations.

---

## Other Components

| Component | Description |
|-----------|-------------|
| `pfx-smtp` | Email sending |
| `pfx-event` | Event handling |
| `pfx-resources` | Resource management |
| `pfx-info` | System information |
| `pfx-hybris` | SAP Hybris integration |
| `pfx-greenplum` | Greenplum database |
| `pfx-odata2` | OData v2 protocol |
| `pfx-c4c` | SAP Cloud for Customers |
| `pfx-google-shopping` | Google Shopping |
